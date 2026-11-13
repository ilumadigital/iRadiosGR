'use strict';
// Brand/template email delivery is delegated to the existing staging Mailpit
// outbox. This job is intentionally NOT scheduled until qualified settlement
// is deployed, Mongo UAT passes and paid delivery is explicitly authorized.
const Campaign=require('../models/AdvertisingCampaign');
const FundingLot=require('../models/AdvertisingFundingLot');
const Banner=require('../models/BannerAd');
const Audio=require('../models/Ad');
const BillableEvent=require('../models/AdvertisingBillableEvent');
const mailer=require('./advertisingCampaignMailScheduler');
const {activeCreativeTiers,evaluateBudgetAffordability,
 shouldNotifyBudgetExhausted}=require('./advertisingBudgetAffordability');
async function checkAndQueueBudgetExhaustion(campaignId,now=new Date()){
 if(process.env.APP_ENV!=='staging')
  return {status:'disabled'};
 const campaign=await Campaign.findOne({
  _id:campaignId,isStageCampaign:true,deletedAt:null,
  approvalStatus:'approved',startsAt:{$lte:now},endsAt:{$gt:now}
 }).lean();
 if(!campaign)return {status:'not_active'};
 const [lots,banners,audios,charged]=await Promise.all([
  // Include unsupported funding sources: a mixed wallet must fail closed,
  // never produce a false exhaustion alert by filtering those lots out.
  FundingLot.find({campaignId:campaign._id})
   .sort({paidAt:1,_id:1}).lean(),
  Banner.find({campaignId:campaign._id,isStageCreative:true,
   status:'active',isActive:true}).select('placement status isActive').lean(),
  Audio.find({campaignId:campaign._id,isStageCreative:true,
   status:'active'}).select('status').lean(),
  BillableEvent.exists({campaignId:campaign._id,status:'charged'})
 ]);
 const tiers=activeCreativeTiers(banners,audios);
 const evaluation=evaluateBudgetAffordability(lots,tiers);
 if(!charged||!shouldNotifyBudgetExhausted(evaluation.status))
  return {status:evaluation.status,notified:false};
 // The outbox idempotency key includes the latest verified funding lot:
 // a later signed top-up starts a new exhaustion notification cycle.
 const fundingGeneration=lots.at(-1);
 if(!fundingGeneration)return {status:'not_funded',notified:false};
 const eventKey='budget-exhausted:'+String(campaign._id)+
  ':'+String(fundingGeneration._id);
 await mailer.enqueue({eventKey,kind:'budget_exhausted',campaign});
 return {status:evaluation.status,notified:true,eventKey};
}
module.exports={checkAndQueueBudgetExhaustion};
