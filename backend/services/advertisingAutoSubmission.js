'use strict';
// Payment-authorized, idempotent Agency wizard transition. Only a signed
// Gateway event can create a nexi_verified funding lot; this worker merely
// reconciles that verified ledger into Admin review. Never credits money.
const Campaign=require('../models/AdvertisingCampaign');
const FundingLot=require('../models/AdvertisingFundingLot');
const Banner=require('../models/BannerAd');
const Audio=require('../models/Ad');
const mailer=require('./advertisingCampaignMailScheduler');
const noticeOutbox=require('./agencyAdNoticeOutbox');
const {budgetCentsToNanos}=require('./advertisingCpmMath');
let timer=null,working=false;

async function submitPaidCampaign(campaignId){
 if(process.env.APP_ENV!=='staging')return {status:'disabled'};
 const campaign=await Campaign.findOne({_id:campaignId,workflowVersion:2,
  createdByRole:'agency',isStageCampaign:true,deletedAt:null,
  approvalStatus:{$in:['draft','pending']}});
 if(!campaign)return {status:'not_applicable'};
 if(!Number.isSafeInteger(campaign.plannedBudgetCents)||
    campaign.plannedBudgetCents<1)return {status:'missing_plan'};
 const lots=await FundingLot.find({campaignId:campaign._id,source:'nexi_verified'})
  .select('budgetNanos source').lean();
 // Never trust browser redirect, a status=paid string, or the planned budget.
 // A funding lot exists only after signed Gateway payment correlation.
 const funded=lots.reduce((sum,lot)=>sum+
  (Number.isSafeInteger(lot.budgetNanos)&&lot.budgetNanos>0?
   BigInt(lot.budgetNanos):0n),0n);
 if(funded<BigInt(budgetCentsToNanos(campaign.plannedBudgetCents)))
  return {status:'awaiting_verified_payment'};
 const scope={campaignId:campaign._id,agencyId:campaign.agencyId,
  isStageCreative:true};
 const [banners,audios]=await Promise.all([
  Banner.countDocuments({...scope,status:{$in:['draft','pending','active']}}),
  Audio.countDocuments({...scope,status:{$in:['draft','pending','active']}})
 ]);
 if(banners+audios<1)return {status:'no_creatives'};
 // Stage the creatives FIRST. If the process crashes between the writes and
 // campaign CAS, the next webhook retry/recovery pass safely finishes the job.
 await Promise.all([
  Banner.updateMany({...scope,status:'draft'},{$set:{
   status:'pending',isActive:false,agencyDraftNoticeVersion:1}}),
  Audio.updateMany({...scope,status:'draft'},{$set:{
   status:'pending',agencyDraftNoticeVersion:1}})
 ]);
 const updated=await Campaign.findOneAndUpdate({_id:campaign._id,
  workflowVersion:2,createdByRole:'agency',approvalStatus:'draft',
  deletedAt:null,isStageCampaign:true},{$set:{
   approvalStatus:'pending',submittedAt:new Date()
  }},{new:true});
 // The mail outbox has a unique eventKey. Replayed webhooks and recovery
 // cannot duplicate an Admin notification or alter approved campaigns.
 if(updated||campaign.approvalStatus==='pending'){
  await mailer.enqueue({eventKey:'wizard-paid-submit:'+String(campaign._id),
   kind:'paid_pending_review',campaign:updated||campaign,
   amountCents:campaign.plannedBudgetCents});
  noticeOutbox.kick();
 }
 return {status:updated?'submitted':'already_pending'};
}

async function recover(){
 if(working||process.env.APP_ENV!=='staging')return;
 working=true;
 try{
  // Narrow, bounded scan over VERIFIED funding, not all agency drafts.
  const lots=await FundingLot.find({source:'nexi_verified'})
   .select('campaignId').sort({paidAt:-1}).limit(250).lean();
  const ids=[...new Set(lots.map(lot=>String(lot.campaignId)))];
  if(!ids.length)return;
  const campaigns=await Campaign.find({_id:{$in:ids},workflowVersion:2,
   createdByRole:'agency',isStageCampaign:true,deletedAt:null,
   approvalStatus:{$in:['draft','pending']}}).select('_id').lean();
  for(const campaign of campaigns){
   try{await submitPaidCampaign(campaign._id);}
   catch(error){console.warn('[AD REVIEW] Paid submit retry:',String(error.message).slice(0,150));}
  }
 }finally{working=false;}
}
function start(){
 if(timer||process.env.APP_ENV!=='staging')return;
 timer=setInterval(()=>recover().catch(error=>
  console.error('[AD REVIEW] Reconcile:',error.message)),60000);
 timer.unref?.();
 recover().catch(error=>console.error('[AD REVIEW] Initial reconcile:',error.message));
}
module.exports={submitPaidCampaign,recover,start};
