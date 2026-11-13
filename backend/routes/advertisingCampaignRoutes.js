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
const User=require('../models/User');
const {matchesDeliveryGeo}=require('../services/agencyAdGeoMatch');
const {filterFundedCreatives}=require('../services/advertisingDeliveryEligibility');
const {paidPlacementPreviewEnabled,affordablePaidPreview}=
 require('../services/advertisingStagePaidPreview');
const {localAudioFile}=require('../services/adAudioDelivery');
const {DEFAULTS,validatePricing,quotedAmounts}=require('../services/advertisingPricingRules');
const {getAdvertisingPricing}=require('../services/advertisingPricingStore');
const {validateAgencyGeo}=require('../services/agencyAdGeo');
const gateway=require('../services/ilumaGatewayClient');
const {ensureAdvertisingFinancialIndexes}=require('../services/advertisingFinancialIndexes');
const {fromLot,aggregateBalances}=require('../services/advertisingBalances');
const {activeCreativeTiers,evaluateBudgetAffordability}=
 require('../services/advertisingBudgetAffordability');
const {allowUnfundedReview}=require('../services/advertisingStageQa');
const stage=(req,res,next)=>process.env.APP_ENV==='staging'?next():
 res.status(503).json({error:'Advertising v2 is staging only'});
// Scope Agency/Admin JWT checks ONLY to advertising routes. This router is
// mounted at /api before /api/proxy-stream; a bare router.use(protect) blocks
// anonymous radio playback and every later public API endpoint with HTTP 401.
router.use(['/advertising','/admin/advertising'],protect,stage);
const isAgency=req=>req.user?.role==='agency';
const isAdmin=req=>req.user?.role==='admin';
const objectId=value=>mongoose.isValidObjectId(value);
const idString=x=>String(x||'');
const pricingId='iradios-advertising-v2';
const freshPricing=()=>JSON.parse(JSON.stringify(DEFAULTS));
const pricing=getAdvertisingPricing;
const errorResponse=(res,error,code=400)=>res.status(code).json({error:String(error.message||error)});

// Pricing changes are versioned and never mutate a funded lot's CPM snapshot.
router.get('/advertising/pricing',async(req,res)=>{
 if(!isAgency(req)&&!isAdmin(req))return res.status(403).json({error:'Forbidden'});
 try{
  const row=await pricing();
  return res.json({...row?.toObject?.()||row,
   sandboxCheckoutReady:row.enabled===true&&row.taxMode==='budget_net_plus_vat'&&
     gateway.configured()});
 }catch{return res.status(500).json({error:'Pricing unavailable'});}
});
router.put('/admin/advertising/pricing',async(req,res)=>{
 if(!isAdmin(req))return res.status(403).json({error:'Admin required'});
 try{
  await pricing();
  const previous=await Pricing.findById(pricingId);
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
  // Never $set version and $inc version in the same MongoDB update.
  // This was the source of 'Updating the path version would create a conflict'.
  const {version:obsoleteVersion,...updatedFields}=next;
  const updated=await Pricing.findOneAndUpdate({_id:pricingId,version:previous.version},
   {$set:{...updatedFields,changedBy:req.user._id},$inc:{version:1},$push:{history}},
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
  // Operational listings omit archived campaigns; Admin may inspect audit archive.
  const filter=isAdmin(req)?
   (req.query.includeDeleted==='1'?{deletedAt:{$ne:null}}:{deletedAt:null}):
   {agencyId:req.user._id,deletedAt:null};
  const campaigns=await Campaign.find(filter).sort({createdAt:-1}).limit(150).lean();
  const lots=await FundingLot.find({campaignId:{$in:campaigns.map(c=>c._id)}})
   .select('campaignId budgetNanos remainingNanos budgetMicros remainingMicros').lean();
  const byCampaign=new Map();
  for(const lot of lots){
   const key=String(lot.campaignId);
   if(!byCampaign.has(key))byCampaign.set(key,[]);
   byCampaign.get(key).push(lot);
  }
  res.json(campaigns.map(c=>({...c,budget:
   aggregateBalances(byCampaign.get(String(c._id))||[])
  })));
 }catch(error){return errorResponse(res,error,500);}
});
router.patch('/advertising/campaigns/:id/enabled',async(req,res)=>{
 if(!isAgency(req)||!objectId(req.params.id)||typeof req.body?.enabled!=='boolean')
  return res.status(400).json({error:'Invalid campaign or switch'});
 try{
  // Operational pause/resume does not rewrite approved creatives or prices.
  const saved=await Campaign.findOneAndUpdate({_id:req.params.id,agencyId:req.user._id,deletedAt:null},
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
  if(campaign.workflowVersion===2&&kind==='initial'){
   if(campaign.approvalStatus!=='draft'||
      campaign.plannedBudgetCents!==req.body?.budgetCents)
    return res.status(409).json({error:'Το budget στο quote πρέπει να συμφωνεί με το Overview.'});
   const exists=await Promise.all([
    BannerAd.exists({campaignId:campaign._id,isStageCreative:true,status:'draft'}),
    Ad.exists({campaignId:campaign._id,isStageCreative:true,status:'draft'})
   ]);
   if(!exists.some(Boolean))return res.status(409).json({error:'Απαιτείται δημιουργικό πριν από την πληρωμή.'});
  }
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
 if(!gateway.configured())
  return res.status(503).json({error:'ILUMA Gateway staging credentials are unavailable.'});
 try{
  // Disabling the current tax/checkout policy also blocks old unconsumed quotes.
  // Their immutable price snapshots remain readable, but cannot charge Nexi.
  const checkoutPolicy=await pricing();
  if(!checkoutPolicy.enabled||checkoutPolicy.taxMode!=='budget_net_plus_vat')
   return res.status(503).json({error:'Advertising checkout policy is disabled.'});
  const quote=await Quote.findOne({_id:req.params.id,agencyId:req.user._id,
   status:'quoted',isStageQuote:true,expiresAt:{$gt:new Date()}});
  if(!quote)return res.status(409).json({error:'Quote expired or already used'});
  const campaign=await Campaign.findOne({_id:quote.campaignId,agencyId:req.user._id,
   isStageCampaign:true,deletedAt:null});
  if(!campaign)return res.status(404).json({error:'Campaign unavailable'});
  if(campaign.workflowVersion===2&&quote.kind==='initial'&&
     (campaign.approvalStatus!=='draft'||campaign.plannedBudgetCents!==quote.budgetCents))
   return res.status(409).json({error:'Το quote δεν αντιστοιχεί πλέον στο draft.'});
  // No parallel unresolved HPP intents: an unknown provider outcome is never
  // cleared simply because the browser retries or starts a new quote.
  const unresolved=await Intent.findOne({campaignId:campaign._id,
   status:{$in:['creating','redirect','unknown']}});
  if(unresolved)return res.status(409).json({
   error:'An advertising payment is awaiting provider confirmation.',intentId:unresolved._id
  });
  await ensureAdvertisingFinancialIndexes();
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
  const campaign=await Campaign.findOne({_id:req.params.id,isStageCampaign:true,deletedAt:null});
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  if(campaign.approvalStatus!=='pending')
   return res.status(409).json({error:'Only pending campaigns may be reviewed.'});
  if(approval==='approved'){
   const funded=await FundingLot.exists({campaignId:campaign._id,remainingMicros:{$gt:0}});
   // Optional staging QA: test Admin decisions/emails without Nexi funding.
   // No lot is fabricated and paid delivery remains completely disabled.
   if(!funded&&(campaign.workflowVersion===2||!allowUnfundedReview()))
    return res.status(409).json({error:'Verified funding required before approval'});
   const approvedCreative=await Promise.all([
    BannerAd.exists({campaignId:campaign._id,agencyId:campaign.agencyId,status:'active',
     isStageCreative:true,isActive:true}),
    Ad.exists({campaignId:campaign._id,agencyId:campaign.agencyId,status:'active',
     isStageCreative:true})
   ]);
   if(!approvedCreative.some(Boolean))
    return res.status(409).json({error:'Approve at least one Agency creative first'});
  }
  // The pending -> final transition is atomic: competing Admin decisions
  // cannot overwrite a previous decision or produce a second mail event.
  const reviewedAt=new Date();
  // Agency campaigns start serving on approval. If the old wizard placed
  // their start tomorrow, preserve purchased duration by shifting both dates.
  const startsImmediately=approval==='approved'&&
   campaign.createdByRole==='agency'&&campaign.startsAt>reviewedAt;
  const originalDuration=campaign.endsAt-campaign.startsAt;
  const updated=await Campaign.findOneAndUpdate({
   _id:campaign._id,approvalStatus:'pending',isStageCampaign:true,deletedAt:null
  },{$set:{
   approvalStatus:approval,
   approvedBy:approval==='approved'?req.user._id:null,
   approvedAt:approval==='approved'?reviewedAt:null,
   rejectedReason:approval==='rejected'?reason:'',
   ...(startsImmediately&&originalDuration>0?{
    startsAt:reviewedAt,endsAt:new Date(reviewedAt.getTime()+originalDuration)
   }:{})
  }},{new:true,runValidators:true});
  if(!updated)return res.status(409).json({error:'Campaign has already been reviewed.'});
  try{
   await require('../services/advertisingCampaignMailScheduler').enqueue({
    eventKey:'campaign-review:'+String(updated._id)+':'+reviewedAt.toISOString(),
    kind:approval==='approved'?'campaign_approved':'campaign_rejected',
    campaign:updated
   });
  }catch(error){console.warn('[AD MAIL] Review message pending',error.message);}
  // QA approval is not paid activation: qualified CPM settlement stays hard-disabled.
  return res.json(updated);
 }catch(error){return errorResponse(res,error,500);}
});
router.put('/admin/advertising/campaigns/:id/suspend',async(req,res)=>{
 if(!isAdmin(req)||!objectId(req.params.id)||
    typeof req.body?.suspended!=='boolean')
  return res.status(400).json({error:'Invalid suspension'});
 const changed=await Campaign.findOneAndUpdate({_id:req.params.id,deletedAt:null,isStageCampaign:true},
  {$set:{adminSuspended:req.body.suspended}},{new:true});
 if(!changed)return res.status(404).json({error:'Campaign not found'});
 res.json(changed);
});
// An Admin can remove any staging campaign from active management without
// destroying a payment receipt, funding lot, billing event or creative history.
// The archived record remains available to Admin for financial reconciliation.
router.delete('/admin/advertising/campaigns/:id',async(req,res)=>{
 if(!isAdmin(req))return res.status(403).json({error:'Admin required'});
 if(!objectId(req.params.id))return res.status(400).json({error:'Invalid campaign'});
 const reason=typeof req.body?.reason==='string'?req.body.reason.trim():'';
 const confirmTitle=req.body?.confirmTitle;
 if(reason.length<5||reason.length>1000||typeof confirmTitle!=='string')
  return res.status(400).json({error:'Απαιτείται επιβεβαίωση τίτλου και αιτιολογία τουλάχιστον 5 χαρακτήρων.'});
 try{
  const campaign=await Campaign.findOne({_id:req.params.id,isStageCampaign:true});
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  if(campaign.deletedAt)return res.status(409).json({error:'Η καμπάνια έχει ήδη αρχειοθετηθεί.'});
  if(confirmTitle!==campaign.title)
   return res.status(400).json({error:'Ο τίτλος επιβεβαίωσης δεν ταιριάζει.'});
  // Do not hide a campaign while its outcome may still turn into a signed
  // Nexi credit; the Admin must first resolve the ORIGINAL payment intent.
  const unresolved=await Intent.exists({campaignId:campaign._id,
   status:{$in:['creating','redirect','unknown']}});
  if(unresolved)return res.status(409).json({
   error:'Υπάρχει πληρωμή σε εξέλιξη ή άγνωστη κατάσταση. Ολοκλήρωσε τον οικονομικό έλεγχο πριν από τη διαγραφή.'
  });
  // Atomic state transition is the delivery kill switch. The campaign-based
  // creative eligibility query excludes deletedAt != null at every read.
  const archived=await Campaign.findOneAndUpdate({
   _id:campaign._id,isStageCampaign:true,deletedAt:null
  },{$set:{deletedAt:new Date(),deletedBy:req.user._id,
   deletionReason:reason,agencyEnabled:false,adminSuspended:true}},
   {new:true,runValidators:true});
  if(!archived)return res.status(409).json({error:'Campaign was already deleted'});
  // Quotes not yet sent to Nexi cannot be used again. Existing intents,
  // quotes, funding lots and receipts remain intact for tax / audit records.
  try{
   await Quote.updateMany({campaignId:archived._id,status:'quoted'},
    {$set:{status:'canceled'}});
  }catch(error){
   console.error('[AD ARCHIVE] Quote cleanup deferred',error.message);
  }
  return res.json({deleted:true,campaignId:String(archived._id),
   deletedAt:archived.deletedAt,deletionReason:archived.deletionReason,
   financialHistoryPreserved:true,refundIssued:false});
 }catch(error){return errorResponse(res,error,500);}
});

// Diagnostic parity with the public /ads/public and /banners/active filters.
// Read-only: no credit, no impression, no status or approval mutation.
router.get('/admin/advertising/campaigns/:id/delivery-check',async(req,res)=>{
 if(!isAdmin(req)||!objectId(req.params.id))
  return res.status(403).json({error:'Admin required'});
 try{
  const now=new Date();
  const campaign=await Campaign.findOne({_id:req.params.id,isStageCampaign:true}).lean();
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  const [owner,lots,banners,audios]=await Promise.all([
   User.findById(campaign.agencyId).select('role').lean(),
   FundingLot.find({campaignId:campaign._id,source:'nexi_verified'})
    .select('campaignId source budgetNanos remainingNanos ratesMicros settlementMode settledEvents').lean(),
   BannerAd.find({campaignId:campaign._id}).lean(),
   Ad.find({campaignId:campaign._id}).lean()
  ]);
  const creativeRows=[
   ...banners.map(creative=>({kind:'banner',creative})),
   ...audios.map(creative=>({kind:'audio',creative}))
  ];
  const permitted=new Set((await filterFundedCreatives(
   creativeRows.map(row=>row.creative),now)).map(row=>String(row._id)));
  const campaignIssues=[];
  if(campaign.deletedAt)campaignIssues.push('Η καμπάνια έχει διαγραφεί.');
  if(campaign.workflowVersion!==2)campaignIssues.push('Η καμπάνια δεν χρησιμοποιεί τον νέο wizard.');
  if(campaign.approvalStatus!=='approved')campaignIssues.push('Η καμπάνια δεν έχει τελική έγκριση Admin.');
  if(!campaign.agencyEnabled)campaignIssues.push('Η Agency έχει θέσει την καμπάνια σε παύση.');
  if(campaign.adminSuspended)campaignIssues.push('Υπάρχει αναστολή από Admin.');
  if(!campaign.isStageCampaign)campaignIssues.push('Λείπει ο δείκτης staging καμπάνιας.');
  if(owner?.role!==campaign.createdByRole)
   campaignIssues.push('Ο ρόλος του ιδιοκτήτη δεν συμφωνεί με την καμπάνια.');
  if(campaign.createdByRole==='admin'&&new Date(campaign.startsAt)>now)
   campaignIssues.push('Η έναρξη της Admin καμπάνιας είναι στο μέλλον.');
  if(new Date(campaign.endsAt)<=now)campaignIssues.push('Η ημερομηνία λήξης έχει παρέλθει.');
  if(campaign.createdByRole==='agency'){
   if(!paidPlacementPreviewEnabled())
    campaignIssues.push('Το μη χρεώσιμο staging preview πληρωμένων καμπανιών είναι ανενεργό.');
   if(!lots.length)campaignIssues.push('Δεν βρέθηκε επαληθευμένη πίστωση Nexi στην καμπάνια.');
  }
  const creatives=await Promise.all(creativeRows.map(async({kind,creative})=>{
   const reasons=[...campaignIssues];
   if(creative.status!=='active')reasons.push('Το creative δεν είναι εγκεκριμένο/active.');
   if(creative.isStageCreative!==true)reasons.push('Το creative δεν έχει staging marker.');
   if(creative.expiresAt&&new Date(creative.expiresAt)<=now)
    reasons.push('Το creative έχει λήξει.');
   if(kind==='banner'){
    if(creative.isActive===false)reasons.push('Το banner είναι ανενεργό.');
    if(!Array.isArray(creative.placement)||!creative.placement.length)
     reasons.push('Δεν υπάρχει banner placement.');
    if(!creative.imageUrl)reasons.push('Λείπει η εικόνα του banner.');
   }else if(!(await localAudioFile(creative.audioUrl))){
    reasons.push('Το αρχείο audio δεν υπάρχει ή δεν είναι αναπαράξιμο στον staging server.');
   }
   if(!matchesDeliveryGeo(creative,req))
    reasons.push('Η γεωγραφική στόχευση δεν ταιριάζει με το τρέχον trusted geo.');
   if(campaign.createdByRole==='agency'&&lots.length&&
      !affordablePaidPreview(lots,creative))
    reasons.push('Το επαληθευμένο budget δεν καλύπτει το συγκεκριμένο placement/CPM.');
   if(!permitted.has(String(creative._id))&&!reasons.length)
    reasons.push('Το delivery eligibility απέρριψε το creative.');
   return {id:creative._id,title:creative.title,kind,
    placements:kind==='banner'?creative.placement:['audio'],
    status:creative.status,ready:reasons.length===0,reasons};
  }));
  return res.json({campaignId:campaign._id,checkedAt:now,
   isNonBillablePreview:paidPlacementPreviewEnabled(),
   geoMode:req.adGeoTrusted?'signed_proxy':'staging_fixture',
   fundedLots:lots.length,deliverableCreatives:creatives.filter(row=>row.ready).length,
   campaignIssues,creatives});
 }catch(error){return errorResponse(res,error,500);}
});
// Read-only financial reconciliation for the Admin. This endpoint never
// adjusts balances, creates credits, or starts payment recovery.
router.get('/admin/advertising/campaigns/:id/reconciliation',async(req,res)=>{
 if(!isAdmin(req)||!objectId(req.params.id))
  return res.status(403).json({error:'Admin required'});
 try{
  const campaign=await Campaign.exists({_id:req.params.id,isStageCampaign:true});
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  const Event=require('../models/AdvertisingBillableEvent');
  const [lotCount,eventCount]=await Promise.all([
   FundingLot.countDocuments({campaignId:req.params.id}),
   Event.countDocuments({campaignId:req.params.id})
  ]);
  // An incomplete audit must never be presented as fully reconciled.
  if(lotCount>100||eventCount>50000)
   return res.status(409).json({error:'Audit exceeds safe staging bounds'});
  const [lots,events]=await Promise.all([
   FundingLot.find({campaignId:req.params.id}).lean(),
   Event.find({campaignId:req.params.id}).lean()
  ]);
  const {auditFundingSet}=require('../services/advertisingFinancialAudit');
  return res.json({campaignId:req.params.id,...auditFundingSet(lots,events)});
 }catch(error){return errorResponse(res,error,500);}
});
router.get('/advertising/campaigns/:id/finance',async(req,res)=>{
 if(!isAgency(req)&&!isAdmin(req))return res.status(403).json({error:'Forbidden'});
 if(!objectId(req.params.id))return res.status(400).json({error:'Invalid campaign'});
 try{
  const campaign=await Campaign.findOne({_id:req.params.id,
   ...(isAdmin(req)?{}:{agencyId:req.user._id,deletedAt:null})});
  if(!campaign)return res.status(404).json({error:'Campaign not found'});
  const [lots,intents,banners,audios]=await Promise.all([
   FundingLot.find({campaignId:campaign._id}).sort({paidAt:1}).lean(),
   Intent.find({campaignId:campaign._id}).sort({createdAt:-1}).limit(30).lean(),
   BannerAd.find({campaignId:campaign._id,isStageCreative:true,
    status:'active',isActive:true}).select('placement status isActive').lean(),
   Ad.find({campaignId:campaign._id,isStageCreative:true,
    status:'active'}).select('status').lean()
  ]);
  const balances=aggregateBalances(lots);
  const affordability=evaluateBudgetAffordability(lots,
   activeCreativeTiers(banners,audios));
  // Keep the existing micros response compatible, without exposing the
  // permanent financial receipt journal or stale micros-only counters.
  const publicLots=lots.map(lot=>{
   const row=fromLot(lot);
   const {settledEvents,...safeLot}=lot;
   return {...safeLot,budgetNanos:row.fundedNanos,
    remainingNanos:row.remainingNanos,
    budgetMicros:Math.floor(row.fundedNanos/1000),
    remainingMicros:Math.floor(row.remainingNanos/1000)};
  });
  return res.json({campaignId:campaign._id,...balances,
   affordability,lots:publicLots,intents});
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
  if(!gateway.configured())
   return res.json({id:intent._id,status:intent.status,recovery:'gateway_unavailable'});
  try{
   const provider=await gateway.advertisingPaymentByRequestKey(intent.requestKey,intent.amountCents);
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
// Retry verified paid v2 campaigns after webhook/DB/notification interruptions.
require('../services/advertisingAutoSubmission').start();
module.exports=router;
