'use strict';
// Admin-only, explicitly opted-in staging shadow pipeline. NEVER imports or
// invokes any CPM settlement or payment service. No public listener traffic.
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {execFile}=require('node:child_process');
const ffprobe=promisify(execFile);
const Campaign=require('../models/AdvertisingCampaign');
const Banner=require('../models/BannerAd');
const Audio=require('../models/Ad');
const Lot=require('../models/AdvertisingFundingLot');
const Ticket=require('../models/AdvertisingDeliveryTicket');
const Qualified=require('../models/AdvertisingQualifiedEvent');
const Counter=require('../models/AdvertisingDeliveryCounter');
const {localAudioFile}=require('./adAudioDelivery');
const {matchesAgencyGeo}=require('./agencyAdGeoMatch');
const {evaluateBudgetAffordability}=require('./advertisingBudgetAffordability');
const {qualifiedEventDebitNanos}=require('./advertisingCpmMath');
const {clientFingerprint,issueTicket,sealTicket,verifyTicket,observation}=
 require('./advertisingQualifiedDelivery');
const {hourlyQuota,hourBucket,tenMinuteBucket,fairOrder}=require('./advertisingPacing');
const ID=/^[a-f0-9]{24}$/;
let indexReady=null;
function enabled(){
 return process.env.APP_ENV==='staging'&&
  process.env.AD_QUALIFICATION_SHADOW_ENABLED==='1'&&
  typeof process.env.AD_QUALIFICATION_SHADOW_SECRET==='string'&&
  Buffer.byteLength(process.env.AD_QUALIFICATION_SHADOW_SECRET)>=32;
}
function secret(){if(!enabled())throw Error('Shadow qualification disabled');
 return process.env.AD_QUALIFICATION_SHADOW_SECRET;}
function indexes(){
 if(!indexReady)indexReady=Promise.all([Ticket.createIndexes(),
  Qualified.createIndexes(),Counter.createIndexes()])
  .catch(err=>{indexReady=null;throw err;});
 return indexReady;
}
function userKey(req){
 return clientFingerprint(secret(),
  // Never trust visitor-controlled forwarding headers for anti-fraud.
  String(req.socket?.remoteAddress||''),String(req.get('user-agent')||''));
}
async function durationForAudio(ad){
 const filename=await localAudioFile(ad.audioUrl);
 if(!filename)return 0;
 try{
  const {stdout}=await ffprobe('ffprobe',['-v','error','-show_entries',
   'format=duration','-of','default=noprint_wrappers=1:nokey=1',filename],
   {timeout:3500,maxBuffer:4096});
  const seconds=Number(stdout.trim());
  if(!Number.isFinite(seconds)||seconds<1||seconds>300)return 0;
  return Math.round(seconds*1000);
 }catch{return 0;}
}
function campaignGeo(c){
 return {targetCountry:c.country,targetRegion:c.region,
  targetLocations:[c.prefecture]};
}
function tierFor(kind,placement){
 if(kind==='audio'&&placement==='audio')return 'audio';
 if(kind==='visual'&&placement==='hero')return 'hero';
 if(kind==='visual'&&['home','radio_feed','news_feed','station_profile']
  .includes(placement))return 'standard';
 throw Error('Invalid shadow placement');
}
async function candidates(kind,placement,geo,now){
 const tier=tierFor(kind,placement);
 const q={status:'active',isStageCreative:true,campaignId:{$ne:null},
  expiresAt:{$not:{$lte:new Date(now)}}};
 const creatives=kind==='audio'?
  await Audio.find(q).limit(250).lean():
  await Banner.find({...q,isActive:true,placement}).limit(250).lean();
 const scoped=creatives.filter(c=>ID.test(String(c.campaignId))&&
  matchesAgencyGeo(c,geo));
 if(!scoped.length)return [];
 const campaigns=await Campaign.find({_id:{$in:scoped.map(c=>c.campaignId)},
  approvalStatus:'approved',agencyEnabled:true,adminSuspended:false,
  isStageCampaign:true,deletedAt:null,startsAt:{$lte:new Date(now)},
  endsAt:{$gt:new Date(now)}}).lean();
 const byId=new Map(campaigns.filter(c=>matchesAgencyGeo(campaignGeo(c),geo))
  .map(c=>[String(c._id),c]));
 const lots=await Lot.find({campaignId:{$in:[...byId.keys()]}})
  .sort({paidAt:1,_id:1}).lean();
 const byCampaign=new Map();
 for(const lot of lots){
  const key=String(lot.campaignId);
  if(!byCampaign.has(key))byCampaign.set(key,[]);
  byCampaign.get(key).push(lot);
 }
 const result=[];
 for(const creative of scoped){
  const c=byId.get(String(creative.campaignId));
  if(!c||String(creative.agencyId)!==String(c.agencyId))continue;
  const funded=byCampaign.get(String(c._id))||[];
  const budget=evaluateBudgetAffordability(funded,[tier]);
  if(!budget.canDeliver)continue;
  const priced=funded.filter(l=>l.source==='nexi_verified'&&
   Number.isSafeInteger(l.remainingNanos)&&l.remainingNanos>0&&
   (l.settlementMode==='mongo_transaction_v2'||
    (l.settledEvents||[]).length<6000));
  let cheapest=Infinity;
  for(const lot of priced){
   try{
    const cost=qualifiedEventDebitNanos(lot.ratesMicros?.[tier]);
    if(lot.remainingNanos>=cost)cheapest=Math.min(cheapest,cost);
   }catch{/* Invalid lot never authorizes delivery. */}
  }
  if(!Number.isFinite(cheapest))continue;
  const quota=hourlyQuota(budget.remainingNanos,cheapest,c.endsAt,now);
  if(quota>0)result.push({creative,campaign:c,tier,quota});
 }
 return result;
}
async function reserve(key,max,expiry){
 if(!Number.isInteger(max)||max<1)return false;
 try{
  const saved=await Counter.findOneAndUpdate({_id:key,count:{$lt:max}},
   {$inc:{count:1},$setOnInsert:{expiresAt:new Date(expiry)}},
   {upsert:true,new:true,runValidators:true});
  return Boolean(saved);
 }catch(error){
  if(error.code!==11000)throw error;
  // Competing insert for same unique counter: bounded retry of an existing row.
  const won=await Counter.findOneAndUpdate({_id:key,count:{$lt:max}},
   {$inc:{count:1}},{new:true,runValidators:true});
  return Boolean(won);
 }
}
async function issueShadow({kind,placement,geo,req}){
 await indexes();
 const now=Date.now(),fingerprint=userKey(req);
 const pool=await candidates(kind,placement,geo,now);
 if(!pool.length)return {status:'no_eligible_inventory'};
 const enriched=await Promise.all(pool.map(async c=>{
  const bucket='pace:'+String(c.campaign._id)+':'+c.tier+':'+hourBucket(now);
  const counter=await Counter.findById(bucket).lean();
  return {...c,used:counter?.count||0,bucket};
 }));
 const ordered=fairOrder(enriched.map(c=>({
  ...c,campaignId:String(c.campaign._id)
 })),fingerprint,now);
 // Limiter bounds even legitimate Admin testing; production rollout needs WAF.
 if(!await reserve('global:'+fingerprint+':'+hourBucket(now),60,now+7200000))
  return {status:'shadow_rate_limited'};
 for(const item of ordered){
  const id=String(item.campaign._id);
  const frequency='freq:'+id+':'+fingerprint+':'+hourBucket(now);
  const quiet='quiet:'+id+':'+fingerprint+':'+tenMinuteBucket(now);
  if(!await reserve(quiet,1,now+3600000))continue;
  if(!await reserve(frequency,3,now+7200000))continue;
  if(!await reserve(item.bucket,item.quota,now+7200000))continue;
  const durationMs=kind==='audio'?await durationForAudio(item.creative):0;
  if(kind==='audio'&&!durationMs)continue;
  const doc=issueTicket({campaignId:id,creativeId:String(item.creative._id),
   kind,tier:item.tier,placement,durationMs,clientKey:fingerprint,now,
   id:crypto.randomBytes(16).toString('hex')});
  await Ticket.create({...doc,cleanupAt:new Date(now+86400000)});
  return {status:'issued',capability:sealTicket(doc,secret()),
   creativeId:String(item.creative._id),campaignId:id,kind,tier:item.tier,
   placement,durationMs,expiresAt:doc.expiresAt,billable:false};
 }
 return {status:'pacing_or_frequency_cap'};
}
async function writeShadowAudit(ticket){
 const event={_id:ticket._id,campaignId:ticket.campaignId,
  creativeId:ticket.creativeId,kind:ticket.kind,tier:ticket.tier,
  placement:ticket.placement,qualifiedAt:ticket.qualifiedAt,
  observedMs:ticket.continuousMs,status:'shadow_qualified',billable:false};
 await Qualified.updateOne({_id:ticket._id},{$setOnInsert:event},{upsert:true});
}
async function heartbeatShadow({req,capability,report}){
 await indexes();
 const fingerprint=userKey(req);
 const id=typeof capability==='string'?capability.split('.')[0]:'';
 if(!/^[a-f0-9]{32}$/.test(id))throw Error('Invalid shadow ticket');
 for(let i=0;i<4;i++){
  const original=await Ticket.findById(id).lean();
  if(!verifyTicket(capability,original,fingerprint,secret(),Date.now()))
   throw Error('Invalid or expired shadow ticket');
  if(original.status==='qualified'){
   await writeShadowAudit(original);
   return {status:'qualified',duplicate:true,billable:false};
  }
  const now=Date.now();
  const campaign=await Campaign.exists({_id:original.campaignId,
   approvalStatus:'approved',agencyEnabled:true,adminSuspended:false,
   isStageCampaign:true,deletedAt:null,startsAt:{$lte:new Date(now)},
   endsAt:{$gt:new Date(now)}});
  if(!campaign)throw Error('Campaign approval or period revoked');
  const creative=original.kind==='audio'?
   await Audio.exists({_id:original.creativeId,campaignId:original.campaignId,
    isStageCreative:true,status:'active',
    expiresAt:{$not:{$lte:new Date(now)}}}):
   await Banner.exists({_id:original.creativeId,campaignId:original.campaignId,
    isStageCreative:true,status:'active',isActive:true,
    expiresAt:{$not:{$lte:new Date(now)}},placement:original.placement});
  if(!creative)throw Error('Creative approval revoked');
  const change=observation(original,report,now);
  if(change.duplicate)return {status:original.status,duplicate:true,billable:false};
  const updated=await Ticket.findOneAndUpdate({
   _id:original._id,seq:original.seq,status:'issued'
  },{$set:{seq:change.state.seq,lastAt:change.state.lastAt,
   lastActive:change.state.lastActive,lastPositionMs:change.state.lastPositionMs,
   continuousMs:change.state.continuousMs,status:change.state.status,
   qualifiedAt:change.state.qualifiedAt}},{new:true,runValidators:true}).lean();
  if(!updated)continue;
  if(updated.status==='qualified')await writeShadowAudit(updated);
  return {status:updated.status,qualified:updated.status==='qualified',
   observedMs:updated.continuousMs,duplicate:false,billable:false};
 }
 throw Error('Concurrent shadow heartbeat; retry original sequence');
}
module.exports={enabled,issueShadow,heartbeatShadow,durationForAudio};
