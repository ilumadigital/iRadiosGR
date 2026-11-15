'use strict';
// Atomic v2 financial reservation, settlement and release. This is deliberately
// separate from the historical CPM receipt store: no paid delivery may occur
// without a replica-set transaction, verified Nexi lot and a qualified ticket.
const crypto=require('node:crypto');
const mongoose=require('mongoose');
const Campaign=require('../models/AdvertisingCampaign');
const Lot=require('../models/AdvertisingFundingLot');
const Daily=require('../models/AdvertisingDailyBudget');
const Ticket=require('../models/AdvertisingV2Reservation');
const Event=require('../models/AdvertisingV2Event');
const {NANOS_PER_CENT,feeNanos,eventReserveNanos,athensDay,validDailyBudget}=
 require('./advertisingV2Policy');
const TICKET=/^[a-f0-9]{32}$/;
const SECRET_MIN=32;
let ready=null;
function enabled(){
 return process.env.APP_ENV==='staging'&&
  process.env.ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED==='1'&&
  typeof process.env.ADVERTISING_V2_DELIVERY_SECRET==='string'&&
  Buffer.byteLength(process.env.ADVERTISING_V2_DELIVERY_SECRET)>=SECRET_MIN;
}
function secret(){
 if(!enabled())throw Error('Advertising v2 paid delivery is not enabled');
 return process.env.ADVERTISING_V2_DELIVERY_SECRET;
}
function clientKey(req){
 return crypto.createHmac('sha256',secret())
  .update('visitor|'+String(req.socket?.remoteAddress||'').slice(0,128)+
   '|'+String(req.get('user-agent')||'').slice(0,180)).digest('hex');
}
function capability(ticket){
 const payload=ticket._id+'.'+new Date(ticket.expiresAt).getTime();
 const mac=crypto.createHmac('sha256',secret()).update(
  'paid-v2|'+payload+'|'+ticket.clientKey).digest('hex');
 return payload+'.'+mac;
}
function verifyCapability(value,ticket,requestKey,now=Date.now()){
 if(!ticket||!TICKET.test(String(ticket._id))||
   ticket.clientKey!==requestKey||typeof value!=='string')return false;
 const parts=value.split('.');
 if(parts.length!==3||!TICKET.test(parts[0])||
   !/^\d{13}$/.test(parts[1])||!/^[a-f0-9]{64}$/.test(parts[2]))return false;
 if(parts[0]!==ticket._id||
   Number(parts[1])!==new Date(ticket.expiresAt).getTime()||
   now>Number(parts[1])||now<new Date(ticket.issuedAt).getTime()-1000)
  return false;
 const expected=capability(ticket).split('.')[2];
 return crypto.timingSafeEqual(Buffer.from(parts[2],'hex'),Buffer.from(expected,'hex'));
}
function fail(message,code=409){return Object.assign(new Error(message),{status:code});}
async function indexes(){
 if(!ready)ready=Promise.all([Daily.createIndexes(),Ticket.createIndexes(),
   Event.createIndexes()]).catch(e=>{ready=null;throw e;});
 return ready;
}
async function transaction(fn){
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(()=>fn(session),{
   readConcern:{level:'snapshot'},writeConcern:{w:'majority'},
   readPreference:'primary',maxCommitTimeMS:10000
  });
 }finally{await session.endSession();}
}
async function reserve({campaign,creative,kind,placement,clientKey:visitor,durationMs=0}){
 await indexes();
 if(!enabled())throw fail('Paid delivery disabled',503);
 const total=campaign.plannedBudgetCents,daily=campaign.dailyBudgetCents;
 if(!validDailyBudget(daily,total)||!(/^[a-f0-9]{64}$/.test(visitor)))
  throw fail('Campaign daily limit unavailable');
 if(kind==='audio'&&(!Number.isInteger(durationMs)||durationMs<10000||durationMs>46000))
  throw fail('Audio creative must be 10–46 seconds');
 if(kind==='visual'&&durationMs!==0)throw fail('Invalid visual duration');
 const amount=eventReserveNanos(kind,placement);
 const dailyMax=daily*NANOS_PER_CENT;
 if(!Number.isSafeInteger(amount)||amount<1||amount>dailyMax)
  throw fail('Daily budget cannot cover the complete possible spot cost');
 const now=Date.now(),day=athensDay(now);
 const id=crypto.randomBytes(16).toString('hex');
 let ticket=null;
 await transaction(async session=>{
  const fresh=await Campaign.findOne({
   _id:campaign._id,approvalStatus:'approved',agencyEnabled:true,
   adminSuspended:false,deletedAt:null,
   startsAt:{$lte:new Date(now)},endsAt:{$gt:new Date(now)},
   dailyBudgetCents:daily,plannedBudgetCents:total,createdByRole:'agency'
  }).session(session).lean();
  if(!fresh)throw fail('Campaign no longer eligible');
  const lots=await Lot.find({campaignId:campaign._id,source:'nexi_verified',
   remainingNanos:{$gte:amount},budgetNanos:{$ne:null},rateModel:'v2_event'})
   .sort({paidAt:1,_id:1}).session(session).lean();
  // A campaign bought under a different historical rate card must not
  // silently inherit future, more expensive pricing.
  const {AUDIO_RATE_CARD,VISUAL_IMPRESSION_NANOS}=require('./advertisingV2Policy');
  const matchesSnapshot=l=>{
   const stored=l.rateCardSnapshot;
   return stored&&Object.entries(AUDIO_RATE_CARD).every(([p,events])=>
    Object.entries(events).every(([e,cost])=>stored.audio?.[p]?.[e]===cost))&&
    Object.entries(VISUAL_IMPRESSION_NANOS).every(([p,cost])=>
      stored.visual?.[p]===cost);
  };
  const lot=lots.find(l=>matchesSnapshot(l)&&
   Number.isSafeInteger(l.remainingNanos)&&
   l.remainingNanos-(l.reservedNanos||0)>=amount);
  if(!lot)throw fail('Insufficient verified prepaid balance');
  await Daily.findOneAndUpdate({campaignId:campaign._id,day},
   {$setOnInsert:{limitNanos:dailyMax,spentNanos:0,reservedNanos:0}},
   {upsert:true,new:true,session,runValidators:true});
  const d=await Daily.updateOne({campaignId:campaign._id,day,
   limitNanos:dailyMax,
   $expr:{$lte:[{$add:['$spentNanos','$reservedNanos']},dailyMax-amount]}},
   {$inc:{reservedNanos:amount}},{session});
  if(d.modifiedCount!==1)throw fail('Daily budget exhausted');
  const hold=await Lot.updateOne({_id:lot._id,campaignId:campaign._id,
   source:'nexi_verified',
   $expr:{$gte:[{$subtract:['$remainingNanos',
    {$ifNull:['$reservedNanos',0]}]},amount]}},
   {$inc:{reservedNanos:amount}},{session});
  if(hold.modifiedCount!==1)throw fail('Balance reservation conflict');
  ticket={_id:id,campaignId:campaign._id,creativeId:creative._id,lotId:lot._id,
   clientKey:visitor,kind,placement,day,reservedNanos:amount,spentNanos:0,
   durationMs,issuedAt:new Date(now),expiresAt:new Date(now+120000),
   cleanupAt:new Date(now+7*86400000)};
  await Ticket.create([ticket],{session});
 });
 return {id,capability:capability(ticket),expiresAt:ticket.expiresAt,
  kind,placement,billable:true,nonSkippable:daily>4500};
}
async function debit(ticket,name,session){
 if(ticket.eventNames.includes(name))return false;
 const cost=feeNanos(ticket.kind,ticket.placement,name);
 if(ticket.reservedNanos<cost)throw fail('Ticket funds exhausted');
 const wallet=await Lot.updateOne({_id:ticket.lotId,campaignId:ticket.campaignId,
  remainingNanos:{$gte:cost},reservedNanos:{$gte:cost}},
  {$inc:{reservedNanos:-cost,remainingNanos:-cost}},
  {session});
 if(wallet.modifiedCount!==1)throw fail('Wallet settlement failed');
 const day=await Daily.updateOne({campaignId:ticket.campaignId,day:ticket.day,
  reservedNanos:{$gte:cost}},
  {$inc:{reservedNanos:-cost,spentNanos:cost}},{session});
 if(day.modifiedCount!==1)throw fail('Daily settlement failed');
 await Event.create([{reservationId:ticket._id,campaignId:ticket.campaignId,
  creativeId:ticket.creativeId,lotId:ticket.lotId,kind:ticket.kind,
  placement:ticket.placement,name,day:ticket.day,costNanos:cost}],{session});
 ticket.eventNames.push(name);
 ticket.reservedNanos-=cost;
 ticket.spentNanos+=cost;
 return true;
}
function checkTicket(capabilityValue,key,now,session){
 if(typeof capabilityValue!=='string'||!TICKET.test(capabilityValue.split('.')[0]||''))
  throw fail('Invalid delivery ticket',400);
 return Ticket.findById(capabilityValue.split('.')[0]).session(session);
}
async function withTicket(value,key,action){
 if(!enabled())throw fail('Paid delivery disabled',503);
 return transaction(async session=>{
  const ticket=await checkTicket(value,key,Date.now(),session);
  if(!verifyCapability(value,ticket,key)||ticket.status!=='active')
   throw fail('Expired or invalid delivery ticket');
  const result=await action(ticket,session);
  await Ticket.updateOne({_id:ticket._id,status:'active'},
   {$set:{playedMs:ticket.playedMs,positionMs:ticket.positionMs,
    lastHeartbeatAt:ticket.lastHeartbeatAt,continuousVisualMs:ticket.continuousVisualMs,
    visibleSince:ticket.visibleSince,eventNames:ticket.eventNames,
    reservedNanos:ticket.reservedNanos,spentNanos:ticket.spentNanos}},{session});
  return result;
 });
}
async function observe({value,key,report}){
 const now=Date.now();
 return withTicket(value,key,async(ticket,session)=>{
  if(!report||typeof report!=='object')throw fail('Invalid observation',400);
  const previous=ticket.lastHeartbeatAt?new Date(ticket.lastHeartbeatAt).getTime():0;
  const gap=previous?now-previous:0;
  if(gap<0)throw fail('Invalid server clock');
  if(ticket.kind==='audio'){
   const position=report.positionMs;
   if(!Number.isInteger(position)||position<0||
    position>ticket.durationMs+250||
    typeof report.playing!=='boolean'||typeof report.foreground!=='boolean'||
    typeof report.seeking!=='boolean'||typeof report.muted!=='boolean')
    throw fail('Invalid audio evidence',400);
   if(position<ticket.positionMs||position-ticket.positionMs>Math.max(300,gap*1.16+300)){
    ticket.positionMs=position;ticket.lastHeartbeatAt=new Date(now);
    return {status:'ignored_seek',qualified:false};
   }
   const active=report.playing&&report.foreground&&!report.muted&&!report.seeking;
   if(active&&gap>0&&gap<=3500&&position>ticket.positionMs)
    ticket.playedMs+=Math.min(position-ticket.positionMs,gap);
   ticket.positionMs=position;
   ticket.lastHeartbeatAt=new Date(now);
   let charged=false;
   if(ticket.playedMs>=10000)charged=await debit(ticket,'listen10',session);
   if(ticket.playedMs>=ticket.durationMs-350&&position>=ticket.durationMs-350 &&
     ticket.playedMs>=10000)
    charged=(await debit(ticket,'complete',session))||charged;
   return {status:'observed',qualified:ticket.eventNames.includes('listen10'),
    completed:ticket.eventNames.includes('complete'),charged};
  }
  if(typeof report.foreground!=='boolean'||!Number.isFinite(report.ratio)||
     report.ratio<0||report.ratio>1)throw fail('Invalid visual evidence',400);
  const active=report.foreground&&report.ratio>=0.5;
  if(!active){ticket.visibleSince=null;ticket.continuousVisualMs=0;}
  else if(!ticket.visibleSince)ticket.visibleSince=new Date(now);
  else ticket.continuousVisualMs=Math.max(0,now-new Date(ticket.visibleSince).getTime());
  ticket.lastHeartbeatAt=new Date(now);
  const charged=ticket.continuousVisualMs>=300?
   await debit(ticket,'impression',session):false;
  return {status:'observed',qualified:ticket.eventNames.includes('impression'),charged};
 });
}
async function click({value,key}){
 return withTicket(value,key,async(ticket,session)=>{
  if(ticket.kind==='audio'){
   const charged=await debit(ticket,'cta',session);
   return {status:'click',charged,duplicate:!charged};
  }
  // Visual clicks are analytics-only, with one event per reserved impression.
  if(ticket.eventNames.includes('click'))
   return {status:'click',charged:false,duplicate:true};
  await Event.create([{reservationId:ticket._id,campaignId:ticket.campaignId,
   creativeId:ticket.creativeId,lotId:ticket.lotId,kind:'visual',
   placement:ticket.placement,name:'click',day:ticket.day,costNanos:0}],{session});
  ticket.eventNames.push('click');
  return {status:'click',charged:false,duplicate:false};
 });
}
async function closeTicket(id,reason='closed'){
 return transaction(async session=>{
  const ticket=await Ticket.findOne({_id:id,status:'active'}).session(session);
  if(!ticket)return false;
  const amount=ticket.reservedNanos;
  const updated=await Ticket.updateOne({_id:id,status:'active'},
   {$set:{status:'closed',reservedNanos:0,closedAt:new Date(),closeReason:reason}},
   {session});
  if(updated.modifiedCount!==1)throw fail('Concurrent close conflict');
  if(amount>0){
   // MongoDB driver forbids parallel operations on one transaction session.
   const a=await Lot.updateOne({_id:ticket.lotId,reservedNanos:{$gte:amount}},
    {$inc:{reservedNanos:-amount}},{session});
   const b=await Daily.updateOne({campaignId:ticket.campaignId,day:ticket.day,
    reservedNanos:{$gte:amount}},{$inc:{reservedNanos:-amount}},{session});
   if(a.modifiedCount!==1||b.modifiedCount!==1)
    throw fail('Reservation release inconsistent');
  }
  return true;
 });
}
async function release({value,key,reason='finished'}){
 if(!enabled())throw fail('Paid delivery disabled',503);
 const id=typeof value==='string'?value.split('.')[0]:'';
 if(!TICKET.test(id))throw fail('Invalid ticket',400);
 const ticket=await Ticket.findById(id).lean();
 if(!ticket||!verifyCapability(value,ticket,key))throw fail('Invalid ticket');
 await closeTicket(id,reason==='skipped'?'skipped':'finished');
 return {status:'released'};
}
async function sweepExpired(){
 if(!enabled())return;
 const docs=await Ticket.find({status:'active',expiresAt:{$lte:new Date()}})
  .select('_id').limit(100).lean();
 for(const doc of docs)try{await closeTicket(doc._id,'expired');}
 catch(e){console.warn('[AD V2] Deferred release',e.message);}
}
function startSweeper(){
 if(!enabled())return;
 const interval=setInterval(()=>void sweepExpired().catch(e=>
  console.warn('[AD V2] Sweep failed:',e.message)),30000);
 interval.unref?.();
}
module.exports={enabled,clientKey,capability,verifyCapability,reserve,
 observe,click,release,closeTicket,sweepExpired,startSweeper};
