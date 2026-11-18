'use strict';
// Exact, path-scoped listener endpoints. Never mount blanket authentication
// on /api: guests can listen, Premium cannot generate advertising charges.
const router=require('express').Router();
const mongoose=require('mongoose');
const jwt=require('jsonwebtoken');
const User=require('../models/User');
const Station=require('../models/Station');
const Campaign=require('../models/AdvertisingCampaign');
const Audio=require('../models/Ad');
const Banner=require('../models/BannerAd');
const Lot=require('../models/AdvertisingFundingLot');
const Daily=require('../models/AdvertisingDailyBudget');
const Event=require('../models/AdvertisingV2Event');
const Ticket=require('../models/AdvertisingV2Reservation');
const {matchesAgencyGeo}=require('../services/agencyAdGeoMatch');
const ledger=require('../services/advertisingV2Ledger');
const listenerSessions=require('../services/advertisingListenerSessions');
const {durationForAudio}=require('../services/advertisingQualificationEngine');
const policy=require('../services/advertisingV2Policy');
const {getAdvertisingPricing}=require('../services/advertisingPricingStore');
const {analyzeAvailability}=require('../services/advertisingV2CampaignAvailability');
const {localAudioFile}=require('../services/adAudioDelivery');
const {aggregateBalances}=require('../services/advertisingBalances');
const {protect}=require('../utils/authMiddleware');
const ID=/^[a-f0-9]{24}$/i;
const AUDIO_PLACEMENTS=new Set(Object.keys(policy.AUDIO_RATE_CARD));
const VISUAL_PLACEMENTS=new Set(Object.keys(policy.VISUAL_IMPRESSION_NANOS));
const error=(res,e)=>res.status(e.status||500).json({error:e.status?e.message:
 'Η προβολή δεν είναι διαθέσιμη αυτή τη στιγμή.'});
const noCache=(_req,res,next)=>{res.set('Cache-Control','no-store, private');next();};
async function optionalListener(req,res,next){
 const authorization=req.get('Authorization');
 if(!authorization)return next();
 const m=/^Bearer ([^ ]{10,4000})$/.exec(authorization);
 if(!m)return res.status(401).json({error:'Invalid session'});
 try{
  const payload=jwt.verify(m[1],process.env.JWT_SECRET);
  const user=await User.findById(payload.id||payload._id).select('_id role isPremium');
  if(!user)return res.status(401).json({error:'Invalid session'});
  // Token used for live paid events must not be a stale Premium grant.
  if(user.role!=='user'||user.isPremium===true)return res.status(403)
   .json({error:'No advertisements for this account'});
  req.adListenerUserId=String(user._id);
  return next();
 }catch{return res.status(401).json({error:'Invalid session'});}
}
function requirePaid(_req,res,next){
 if(!ledger.enabled())return res.status(503).json({
  error:'Η οικονομική προβολή Advertising v2 είναι κλειδωμένη μέχρι το τελικό QA.',
  enabled:false});
 return next();
}
router.get('/advertising/v2/status',noCache,async(req,res)=>{
 const readiness=await ledger.financialReadiness();
  const rateCard=policy.rateCardForPricing(await getAdvertisingPricing());
  return res.json({
 enabled:readiness.acceptingTickets&&req.adGeoTrusted===true,
 configured:readiness.configured,
 mongoReplicaSetReady:readiness.mongoReplicaSetReady,
 mongoReason:readiness.mongoReason,
 trustedGeoReady:req.adGeoTrusted===true,
 geoPrecision:req.adGeoTrusted===true?
  (req.geo?.prefecture?'prefecture':req.geo?.region?'region':'country'):'untrusted',
 maxBreakSpots:policy.MAX_BREAK_SPOTS,
 audioRateCard:rateCard.audio,
  visualCpmNanos:Object.fromEntries(Object.entries(rateCard.visual)
   .map(([place,nanos])=>[place,nanos*1000])),
 visualMinimumMs:policy.MIN_VISUAL_VIEW_MS,
 audioMinSeconds:policy.MIN_AUDIO_BILLABLE_SECONDS,
 audioMaxSeconds:policy.MAX_AUDIO_DURATION_SECONDS,
 skipSeconds:[15,40,55],nonSkippableDailyCents:4500
 });
});
router.post('/advertising/v2/transition',noCache,requirePaid,optionalListener,async(req,res)=>{
 try{
  // Station transitions do not debit money and never trust browser counters.
  const visitor=ledger.clientKey(req);
  const result=await listenerSessions.register({visitor,
   stationId:req.body?.stationId,token:req.body?.sessionToken});
  return res.json(result);
 }catch(e){return error(res,e);}
});
router.post('/advertising/v2/tickets',noCache,requirePaid,optionalListener,async(req,res)=>{
 try{
  // Never charge a regional/national placement from a fixture IP location.
  // Only the reverse proxy's authenticated geo can enable billable tickets.
  if(req.adGeoTrusted!==true)return res.status(503).json({
   error:'Verified visitor geography is required for billable advertising'});
  const readiness=await ledger.financialReadiness();
  if(!readiness.acceptingTickets)return res.status(503).json({
   error:'MongoDB replica-set transactions must be ready before paid delivery'});
  const {creativeId,kind,placement,stationId,transitionProof}=req.body||{};
  if(!ID.test(String(creativeId||''))||
    !((kind==='audio'&&AUDIO_PLACEMENTS.has(placement))||
      (kind==='visual'&&VISUAL_PLACEMENTS.has(placement))))
   return res.status(400).json({error:'Invalid placement'});
  const now=new Date();
  const model=kind==='audio'?Audio:Banner;
  const creative=await model.findOne({_id:creativeId,isStageCreative:true,
   status:'active',campaignId:{$ne:null},
   expiresAt:{$not:{$lte:now}},
   ...(kind==='visual'?{isActive:true,placement}:{} )}).lean();
  if(!creative||!matchesAgencyGeo(creative,req.geo))
   return res.status(404).json({error:'No eligible creative'});
  const campaign=await Campaign.findOne({_id:creative.campaignId,
   agencyId:creative.agencyId,createdByRole:'agency',workflowVersion:2,
   approvalStatus:'approved',agencyEnabled:true,adminSuspended:false,
   isStageCampaign:true,deletedAt:null,
   startsAt:{$lte:now},endsAt:{$gt:now}}).lean();
  if(!campaign||!policy.validDailyBudget(campaign.dailyBudgetCents,
     campaign.plannedBudgetCents)||
     !matchesAgencyGeo({targetCountry:campaign.country,
       targetRegion:campaign.region,targetLocations:[campaign.prefecture]},req.geo))
   return res.status(404).json({error:'No eligible campaign'});
  let durationMs=0;
  if(kind==='audio'){
   const places=Array.isArray(creative.frequencies)&&creative.frequencies.length?
    creative.frequencies:[creative.frequency];
   if(!places.includes(placement))return res.status(404).json({error:'Wrong placement'});
   if(!ID.test(String(stationId||'')))return res.status(400).json({error:'Station required'});
   const station=await Station.findById(stationId)
    .select('_id disableNetworkAds isOffline').lean();
   if(!station||station.isOffline||station.disableNetworkAds)
    return res.status(404).json({error:'Station excludes network advertising'});
   if(creative.isGlobal===false&&String(creative.stationId)!==String(station._id))
    return res.status(404).json({error:'Wrong station'});
   durationMs=await durationForAudio(creative);
   if(durationMs<10000||durationMs>46000)
    return res.status(422).json({error:'Spot duration must be 10 to 46 seconds'});
  }
  const visitor=ledger.clientKey(req);
  let breakId=null;
  if(kind==='audio'){
   const places=Array.isArray(creative.frequencies)&&creative.frequencies.length?
    creative.frequencies:[creative.frequency];
   if(listenerSessions.isDue(placement,1)||/^(every_(5|10|20|30)_stations)$/.test(placement)){
    const proof=await listenerSessions.verify({visitor,stationId,placement,proof:transitionProof});
    if(!proof)return res.status(403).json({error:'Verified station transition required for paid placement'});
    // At count 10, a creative placed at both 5 and 10 stations can only
    // be billed for the highest-priority eligible match, exactly like player.
    const official=['entry','every_5_stations','every_10_stations',
     'every_20_stations','every_30_stations'];
    const selected=official.find(p=>places.includes(p)&&listenerSessions.isDue(p,proof.count));
    if(placement!==selected)return res.status(409).json({error:'Ambiguous station placement'});
    breakId='switch:'+proof.breakId;
   }else{
    // Clock breaks open at :15 and :45; three 46-second creatives may span
    // several minutes. Never issue a billable timed ticket outside its slot.
    const minute=now.getUTCMinutes();
    const allowedWindow=(minute>=15&&minute<=19)||(minute>=45&&minute<=49);
    if(!allowedWindow)return res.status(409).json({error:'No scheduled time break'});
    const halfHourBucket=Math.floor(now.getTime()/1800000);
    // The server—not a client-supplied break ID—owns each slot's quotas.
    breakId='timed:'+halfHourBucket;
   }
  }
  const issued=await ledger.reserve({campaign,creative,kind,placement,
   durationMs,clientKey:visitor,breakId});
  return res.status(201).json(issued);
 }catch(e){return error(res,e);}
});
router.post('/advertising/v2/heartbeat',noCache,requirePaid,optionalListener,async(req,res)=>{
 try{
  if(typeof req.body?.capability!=='string')
   return res.status(400).json({error:'Missing ticket'});
  return res.json(await ledger.observe({value:req.body.capability,
   key:ledger.clientKey(req),report:req.body.report}));
 }catch(e){return error(res,e);}
});
router.post('/advertising/v2/click',noCache,requirePaid,optionalListener,async(req,res)=>{
 try{
  return res.json(await ledger.click({value:req.body?.capability,
   key:ledger.clientKey(req)}));
 }catch(e){return error(res,e);}
});
router.post('/advertising/v2/release',noCache,requirePaid,optionalListener,async(req,res)=>{
 try{
  return res.json(await ledger.release({value:req.body?.capability,
   key:ledger.clientKey(req),reason:req.body?.reason}));
 }catch(e){return error(res,e);}
});
router.get('/advertising/v2/campaigns/:id/analytics',protect,noCache,async(req,res)=>{
 try{
  if(!ID.test(String(req.params.id)))return res.status(400).json({error:'Invalid campaign'});
  const campaign=await Campaign.findOne({_id:req.params.id,
   ...(req.user.role==='admin'?{}:{agencyId:req.user._id})}).lean();
  if(!campaign||!['admin','agency'].includes(req.user.role))
   return res.status(404).json({error:'Not found'});
  const [lots,daily,events,reservations,skips]=await Promise.all([
   Lot.find({campaignId:campaign._id,source:'nexi_verified'}).lean(),
   Daily.find({campaignId:campaign._id}).sort({day:-1}).limit(31).lean(),
   Event.aggregate([{$match:{campaignId:campaign._id}},
    {$group:{_id:{kind:'$kind',placement:'$placement',name:'$name'},
     count:{$sum:1},costNanos:{$sum:'$costNanos'}}}]),
   Ticket.countDocuments({campaignId:campaign._id,status:'active'}),
   Ticket.aggregate([{$match:{campaignId:campaign._id,closeReason:'skipped'}},
     {$group:{_id:'$placement',count:{$sum:1}}}])
  ]);
  const balance=aggregateBalances(lots);
  const readiness=await ledger.financialReadiness();
  // Historical Nexi-funded/legacy-CPM lots may display prepaid money, but
  // they cannot silently fund the newer per-event rate card. Surface this
  // distinction explicitly in the Agency's audited metrics.
  const eligibleLots=lots.filter(lot=>
   lot.rateModel==='v2_event'&&
   lot.settlementMode==='mongo_transaction_v2'&&
   Number.isSafeInteger(lot.remainingNanos)&&
   Number.isSafeInteger(lot.reservedNanos||0)&&
   lot.remainingNanos>(lot.reservedNanos||0)&&
   policy.matchesRateCardSnapshot(lot.rateCardSnapshot));
  const eligibleLotCount=eligibleLots.length;
  // Never label historical CPM money as spendable under the immutable v2 card.
  const compatibleAvailableNanos=Math.min(Number.MAX_SAFE_INTEGER,
   eligibleLots.reduce((total,lot)=>total+
    Math.max(0,lot.remainingNanos-(lot.reservedNanos||0)),0));
  const today=daily.find(d=>d.day===policy.athensDay())||null;
  const dayAvailableNanos=today?
   Math.max(0,today.limitNanos-today.spentNanos-today.reservedNanos):
   campaign.dailyBudgetCents*policy.NANOS_PER_CENT;
  // A single ticket reserves the COMPLETE potential event cost. Do not
  // report active distribution merely because 0.01 EUR remains in the day.
  // Compare every active placement against the day AND one indivisible lot.
  const now=new Date();
  const [liveAudio,liveBanners]=await Promise.all([
   Audio.find({campaignId:campaign._id,agencyId:campaign.agencyId,
    isStageCreative:true,status:'active',expiresAt:{$not:{$lte:now}}})
    .select('status isStageCreative audioUrl frequency frequencies').lean(),
   Banner.find({campaignId:campaign._id,agencyId:campaign.agencyId,
    isStageCreative:true,status:'active',isActive:true,
    expiresAt:{$not:{$lte:now}}})
    .select('status isStageCreative isActive imageUrl placement').lean()
  ]);
  const checkedAudio=await Promise.all(liveAudio.map(async ad=>({
   ...ad,mediaReady:Boolean(await localAudioFile(ad.audioUrl))
  })));
  const capacity=analyzeAvailability({audios:checkedAudio,banners:liveBanners,
   eligibleLots,dayAvailableNanos:dayAvailableNanos});
  const time=Date.now();
  const campaignRunning=campaign.approvalStatus==='approved'&&
   campaign.agencyEnabled===true&&campaign.adminSuspended!==true&&
   !campaign.deletedAt&&new Date(campaign.startsAt).getTime()<=time&&
   new Date(campaign.endsAt).getTime()>time;
  return res.json({campaignId:campaign._id,dailyBudgetCents:campaign.dailyBudgetCents,
   today:today?{day:today.day,spentNanos:today.spentNanos,
     reservedNanos:today.reservedNanos,
     availableNanos:dayAvailableNanos}:
    {day:policy.athensDay(),spentNanos:0,reservedNanos:0,
     availableNanos:dayAvailableNanos},
   balance,
   compatibleAvailableNanos,
   delivery:{configured:readiness.configured,
    mongoReplicaSetReady:readiness.mongoReplicaSetReady,
    trustedGeoReady:req.adGeoTrusted===true,
    compatibleFunding:eligibleLotCount>0,
    campaignRunning,
    hasEligibleCreative:capacity.hasEligibleCreative,
    minimumReservationNanos:capacity.minimumReservationNanos,
    dayShortfallNanos:capacity.dayShortfallNanos,
    nextTicketAffordable:capacity.nextTicketAffordable,
    dayCapable:capacity.dayCapable,walletCapable:capacity.walletCapable,
    placements:capacity.slots,
    payable:readiness.acceptingTickets&&req.adGeoTrusted===true&&
     campaignRunning&&capacity.nextTicketAffordable},
   activeReservations:reservations,skips:skips.map(x=>({placement:x._id,count:x.count})),
   daily:daily.map(x=>({
    day:x.day,spentNanos:x.spentNanos,reservedNanos:x.reservedNanos})),
   events:events.map(x=>({kind:x._id.kind,placement:x._id.placement,
    event:x._id.name,count:x.count,costNanos:x.costNanos}))});
 }catch(e){return error(res,e);}
});
module.exports=router;
