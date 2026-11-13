'use strict';
const express=require('express');
const crypto=require('node:crypto');
const mongoose=require('mongoose');
const router=express.Router();
const {protect}=require('../utils/authMiddleware');
const Campaign=require('../models/AdvertisingCampaign');
const Pricing=require('../models/AdvertisingPricing');
const Quote=require('../models/AdvertisingQuote');
const Intent=require('../models/AdvertisingPaymentIntent');
const FundingLot=require('../models/AdvertisingFundingLot');
const BannerAd=require('../models/BannerAd');
const Ad=require('../models/Ad');
const {DEFAULTS,validatePricing,quotedAmounts}=require('../services/advertisingPricingRules');
const {validateAgencyGeo}=require('../services/agencyAdGeo');
const gateway=require('../services/ilumaGatewayClient');
const stage=(req,res,next)=>process.env.APP_ENV==='staging'?next():
 res.status(503).json({error:'Advertising v2 is staging only'});
router.use(protect,stage);
const isAgency=req=>req.user?.role==='agency';
const isAdmin=req=>req.user?.role==='admin';
const objectId=value=>mongoose.isValidObjectId(value);
const idString=x=>String(x||'');
const pricingId='iradios-advertising-v2';
const freshPricing=()=>JSON.parse(JSON.stringify(DEFAULTS));
async function pricing(){
 const saved=await Pricing.findById(pricingId).lean();
 return saved||{_id:pricingId,...freshPricing()};
}
const errorResponse=(res,error,code=400)=>res.status(code).json({error:String(error.message||error)});

// Pricing changes are versioned and never mutate a funded lot's CPM snapshot.
router.get('/advertising/pricing',async(req,res)=>{
 if(!isAgency(req)&&!isAdmin(req))return res.status(403).json({error:'Forbidden'});
 try{return res.json(await pricing());}
 catch{return res.status(500).json({error:'Pricing unavailable'});}
});
router.put('/admin/advertising/pricing',async(req,res)=>{
 if(!isAdmin(req))return res.status(403).json({error:'Admin required'});
 try{
  const previous=await Pricing.findOneAndUpdate({_id:pricingId},
   {$setOnInsert:freshPricing()},{upsert:true,new:true});
  if(req.body?.expectedVersion!==previous.version)
   return res.status(409).json({error:'Pricing version changed; reload before editing.'});
  const next={...freshPricing(),...{
   cpmMicros:req.body.cpmMicros,minBudgetCents:req.body.minBudgetCents,
   maxBudgetCents:req.body.maxBudgetCents,minTopupCents:req.body.minTopupCents,
   durationDays:req.body.durationDays,taxMode:req.body.taxMode,
   taxBps:req.body.taxBps,enabled:req.body.enabled
  }};
  validatePricing(next);
  const history={
   version:previous.version,at:new Date(),by:req.user._id,
   settings:{cpmMicros:previous.cpmMicros,
    minBudgetCents:previous.minBudgetCents,maxBudgetCents:previous.maxBudgetCents,
    minTopupCents:previous.minTopupCents,durationDays:previous.durationDays,
    taxMode:previous.taxMode,taxBps:previous.taxBps,enabled:previous.enabled}
  };
  const updated=await Pricing.findOneAndUpdate({_id:pricingId,version:previous.version},
   {$set:{...next,changedBy:req.user._id},$inc:{version:1},$push:{history}},
   {new:true,runValidators:true});
  if(!updated)return res.status(409).json({error:'Concurrent pricing update'});
  return res.json(updated);
 }catch(error){return errorResponse(res,error);}
});

router.post('/advertising/campaigns',async(req,res)=>{
 if(!isAgency(req))return res.status(403).json({error:'Agency required'});
 try{
  const title=String(req.body?.title||'').trim();
  const brand=String(req.body?.brand||'').trim();
  const description=String(req.body?.description||'').trim();
  const start=new Date(req.body?.startsAt),end=new Date(req.body?.endsAt);
  if(title.length<3||title.length>180||brand.length<2||brand.length>150||
     description.length>3000)throw Error('Invalid campaign details');
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||
     start.getTime()<Date.now()-86400000||end<=start||
     end.getTime()>Date.now()+366*86400000)throw Error('Invalid campaign dates');
  const days=Math.ceil((end-start)/86400000);
  if(!(await pricing()).durationDays.includes(days))
   throw Error('Campaign duration outside configured ranges');
  const geo=validateAgencyGeo({
   targetCountry:req.body?.country||'Ελλάδα',
   targetRegion:req.body?.region||'All',
   targetLocations:[req.body?.prefecture||(
    req.body?.region&&req.body.region!=='All'?req.body.region:'Ελλάδα')]
  });
  const created=await Campaign.create({
   agencyId:req.user._id,title,brand,description,
   startsAt:start,endsAt:end,country:geo.targetCountry,
   region:geo.targetRegion,prefecture:geo.targetLocations[0]
  });
  return res.status(201).json(created);
 }catch(error){return errorResponse(res,error);}
});
router.get('/advertising/campaigns',async(req,res)=>{
 if(!isAgency(req)&&!isAdmin(req))return res.status(403).json({error:'Forbidden'});
 try{
  const filter=isAdmin(req)?{}:{agencyId:req.user._id};
  const campaigns=await Campaign.find(filter).sort({createdAt:-1}).limit(150).lean();
  const lots=await FundingLot.aggregate([{$match:{campaignId:{$in:campaigns.map(c=>c._id)}}},
   {$group:{_id:'$campaignId',fundedMicros:{$sum:'$budgetMicros'},remainingMicros:{$sum:'$remainingMicros'}}}]);
  const totals=new Map(lots.map(row=>[String(row._id),row]));
  res.json(campaigns.map(c=>({...c,budget:{
   fundedMicros:totals.get(String(c._id))?.fundedMicros||0,
   remainingMicros:totals.get(String(c._id))?.remainingMicros||0
  }})));
 }catch(error){return errorResponse(res,error,500);}
});
router.patch('/advertising/campaigns/:id/enabled',async(req,res)=>{
 if(!isAgency(req)||!objectId(req.params.id)||typeof req.body?.enabled!=='boolean')
  return res.status(400).json({error:'Invalid campaign or switch'});
 try{
  // Operational pause/resume does not rewrite approved creatives or prices.
  const saved=await Campaign.findOneAndUpdate({_id:req.params.id,agencyId:req.user._id},
   {$set:{agencyEnabled:req.body.enabled}},{new:true});
  if(!saved)return res.status(404).json({error:'Campaign not found'});
  res.json(saved);
 }catch(error){return errorResponse(res,error,500);}
});

router.post('/advertising/campaigns/:id/quotes',async(req,res)=>{
 if(!isAgency(req)||!objectId(req.params.id))
  return res.status(403).json({error:'Not allowed'});
 try{
  const campaign=await Campaign.findOne({_id:req.params.id,agencyId:req.user._id,
   deletedAt:null,isStageCampaign:true});
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  const kind=req.body?.kind==='topup'?'topup':req.body?.kind==='initial'?'initial':null;
  if(!kind)throw Error('Invalid purchase kind');
  const funded=await FundingLot.exists({campaignId:campaign._id});
  if((kind==='topup'&&!funded)||(kind==='initial'&&funded))
   throw Error('Invalid initial purchase/top-up sequence');
  const current=await pricing();
  const amounts=quotedAmounts(req.body?.budgetCents,current,kind);
  const quote=await Quote.create({
   agencyId:req.user._id,campaignId:campaign._id,...amounts,
   currency:'EUR',taxMode:current.taxMode,taxBps:current.taxBps,
   priceVersion:current.version,ratesMicros:current.cpmMicros,
   kind,expiresAt:new Date(Date.now()+20*60000)
  });
  res.status(201).json(quote);
 }catch(error){return errorResponse(res,error);}
});
router.post('/advertising/quotes/:id/checkout',async(req,res)=>{
 if(!isAgency(req)||!objectId(req.params.id))
  return res.status(403).json({error:'Forbidden'});
 if(process.env.AD_PAYMENTS_SANDBOX_ENABLED!=='1')
  return res.status(503).json({error:'Advertising Nexi sandbox checkout is disabled.'});
 try{
  const quote=await Quote.findOne({_id:req.params.id,agencyId:req.user._id,
   status:'quoted',isStageQuote:true,expiresAt:{$gt:new Date()}});
  if(!quote)return res.status(409).json({error:'Quote expired or already used'});
  const campaign=await Campaign.findOne({_id:quote.campaignId,agencyId:req.user._id,
   isStageCampaign:true,deletedAt:null});
  if(!campaign)return res.status(404).json({error:'Campaign unavailable'});
  // No parallel unresolved HPP intents: an unknown provider outcome is never
  // cleared simply because the browser retries or starts a new quote.
  const unresolved=await Intent.findOne({campaignId:campaign._id,
   status:{$in:['creating','redirect','unknown']}});
  if(unresolved)return res.status(409).json({
   error:'An advertising payment is awaiting provider confirmation.',intentId:unresolved._id
  });
  await Intent.init();
  const key='iradios-stage-'+idString(req.user._id)+'-'+crypto.randomUUID();
  let intent;
  try{
   intent=await Intent.create({agencyId:req.user._id,campaignId:campaign._id,
    quoteId:quote._id,requestKey:key,amountCents:quote.paymentCents,
    activeLockKey:String(campaign._id),status:'creating'});
  }catch(error){
   if(error.code===11000)return res.status(409).json({
    error:'Checkout already started for this quote or campaign. Recover the existing payment first.'
   });
   throw error;
  }
  // Mark as consumed before initiating the provider request; no second HPP
  // call is ever made with a fresh key for an ambiguous first attempt.
  await Quote.updateOne({_id:quote._id,status:'quoted'},{$set:{status:'checkout'}});
  try{
   const result=await gateway.advertisingCheckout({user:req.user,requestKey:key,
    campaignId:campaign._id,quoteId:quote._id,amountCents:quote.paymentCents});
   // Checkout response can NEVER grant budget, even if it claims paid.
   const next=result.status==='redirect'?'redirect':'unknown';
   await Intent.updateOne({_id:intent._id,status:{$ne:'paid'}},{$set:{
    status:next,gatewayPaymentId:result.payment_id,gatewayOrderId:result.order_id
   }});
   return res.status(202).json({intentId:intent._id,status:next,
    checkoutUrl:next==='redirect'?result.checkout_url:null});
  }catch(error){
   await Intent.updateOne({_id:intent._id,status:{$ne:'paid'}},
    {$set:{status:'unknown',lastError:String(error.code||'GATEWAY_TIMEOUT').slice(0,70)}});
   return res.status(503).json({error:'Payment outcome unconfirmed. Do not retry checkout.',
    intentId:intent._id});
  }
 }catch(error){return errorResponse(res,error,500);}
});
router.put('/admin/advertising/campaigns/:id/approval',async(req,res)=>{
 if(!isAdmin(req)||!objectId(req.params.id))
  return res.status(403).json({error:'Admin required'});
 const approval=req.body?.approval;
 const reason=String(req.body?.reason||'').trim().slice(0,1000);
 if(!['approved','rejected'].includes(approval)||
    (approval==='rejected'&&!reason))
  return res.status(400).json({error:'Invalid review decision or missing reason'});
 try{
  const campaign=await Campaign.findById(req.params.id);
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  if(approval==='approved'){
   const funded=await FundingLot.exists({campaignId:campaign._id,remainingMicros:{$gt:0}});
   if(!funded)return res.status(409).json({error:'Verified funding required before approval'});
   const approvedCreative=await Promise.all([
    BannerAd.exists({campaignId:campaign._id,agencyId:campaign.agencyId,status:'active',
     isStageCreative:true,isActive:true}),
    Ad.exists({campaignId:campaign._id,agencyId:campaign.agencyId,status:'active',
     isStageCreative:true})
   ]);
   if(!approvedCreative.some(Boolean))
    return res.status(409).json({error:'Approve at least one funded campaign creative first'});
  }
  campaign.approvalStatus=approval;
  campaign.approvedBy=approval==='approved'?req.user._id:null;
  campaign.approvedAt=approval==='approved'?new Date():null;
  campaign.rejectedReason=approval==='rejected'?reason:'';
  await campaign.save();
  if(approval==='approved'){
   const now=new Date();
   // No "activated" claim until atomically billable CPM delivery exists.
   const active=false;
   try{
    await require('../services/advertisingCampaignMailScheduler').enqueue({
     eventKey:'campaign-approved:'+String(campaign._id)+':'+campaign.approvedAt.toISOString(),
     kind:active?'campaign_activated':'campaign_approved',campaign
    });
   }catch(error){console.warn('[AD MAIL] Activation message pending',error.message);}
  }
  res.json(campaign);
 }catch(error){return errorResponse(res,error,500);}
});
router.put('/admin/advertising/campaigns/:id/suspend',async(req,res)=>{
 if(!isAdmin(req)||!objectId(req.params.id)||
    typeof req.body?.suspended!=='boolean')
  return res.status(400).json({error:'Invalid suspension'});
 const changed=await Campaign.findByIdAndUpdate(req.params.id,
  {$set:{adminSuspended:req.body.suspended}},{new:true});
 if(!changed)return res.status(404).json({error:'Campaign not found'});
 res.json(changed);
});
router.get('/advertising/campaigns/:id/finance',async(req,res)=>{
 if(!isAgency(req)&&!isAdmin(req))return res.status(403).json({error:'Forbidden'});
 if(!objectId(req.params.id))return res.status(400).json({error:'Invalid campaign'});
 try{
  const campaign=await Campaign.findOne({_id:req.params.id,
   ...(isAdmin(req)?{}:{agencyId:req.user._id})});
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  const [lots,intents]=await Promise.all([
   FundingLot.find({campaignId:campaign._id}).sort({paidAt:1}).lean(),
   Intent.find({campaignId:campaign._id}).sort({createdAt:-1}).limit(30).lean()]);
  const fundedMicros=lots.reduce((total,lot)=>total+lot.budgetMicros,0);
  const remainingMicros=lots.reduce((total,lot)=>total+lot.remainingMicros,0);
  return res.json({campaignId:campaign._id,fundedMicros,remainingMicros,
   spentMicros:fundedMicros-remainingMicros,lots,intents});
 }catch(error){return errorResponse(res,error,500);}
});


// Read-only recovery of the ORIGINAL Gateway idempotency key. Even a provider
// status of paid never credits budget; only the signed webhook can do that.
router.get('/advertising/payments/:id',async(req,res)=>{
 if(!isAgency(req)||!objectId(req.params.id))
  return res.status(403).json({error:'Forbidden'});
 try{
  const intent=await Intent.findOne({_id:req.params.id,agencyId:req.user._id});
  if(!intent)return res.status(404).json({error:'Payment intent not found'});
  if(intent.status==='paid'||intent.status==='failed'||intent.status==='canceled')
   return res.json({id:intent._id,status:intent.status});
  if(process.env.AD_PAYMENTS_SANDBOX_ENABLED!=='1')
   return res.json({id:intent._id,status:intent.status,recovery:'disabled'});
  try{
   const provider=await gateway.paymentByRequestKey(intent.requestKey,intent.amountCents);
   if(intent.gatewayPaymentId&&intent.gatewayPaymentId!==provider.payment_id||
      intent.gatewayOrderId&&intent.gatewayOrderId!==provider.order_id)
    return res.status(409).json({error:'Gateway reference mismatch'});
   await Intent.updateOne({_id:intent._id,status:{$nin:['paid','failed','canceled']}},
    {$set:{gatewayPaymentId:provider.payment_id,gatewayOrderId:provider.order_id,
      status:provider.status==='redirect'?'redirect':'unknown'}});
   return res.json({id:intent._id,status:'pending_verification',
    gatewayStatus:provider.status,
    checkoutUrl:provider.status==='redirect'?provider.checkout_url:null});
  }catch(error){
   return res.status(503).json({id:intent._id,status:'unknown',
    error:'Provider result is not yet recoverable. Contact support before retrying.'});
  }
 }catch(error){return errorResponse(res,error,500);}
});

// Route registration initializes staging-only advertising mail retries.
require('../services/advertisingCampaignMailScheduler').start();
module.exports=router;
