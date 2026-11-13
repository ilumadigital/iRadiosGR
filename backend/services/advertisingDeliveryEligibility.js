'use strict';
// New v2 creatives reference an AdvertisingCampaign. Legacy independent
// creatives keep their existing delivery policy until an explicit migration.
const Campaign=require('../models/AdvertisingCampaign');
const FundingLot=require('../models/AdvertisingFundingLot');
async function eligibleCampaignIds(creatives,now=new Date()){
 // Do not serve prepaid inventory until atomic billable-event settlement exists.
 // Hard stop: changing an environment flag must not bypass the missing
 // atomic event-settlement implementation in this development phase.
 const ATOMIC_SETTLEMENT_IMPLEMENTED=false;
 const ids=[...new Set(creatives.map(ad=>ad?.campaignId)
  .filter(Boolean).map(String))];
 if(!ids.length)return new Set();
 // Admin-origin staging creatives are complimentary, not prepaid inventory.
 // The campaign must still be approved, active in period, and owned by an
 // actual Admin role. Never lift this exception for Agency campaigns.
 if(!ATOMIC_SETTLEMENT_IMPLEMENTED){
  if(process.env.APP_ENV!=='staging')return new Set();
  const User=require('../models/User');
  const campaigns=await Campaign.find({_id:{$in:ids},workflowVersion:2,
   createdByRole:'admin',approvalStatus:'approved',agencyEnabled:true,
   adminSuspended:false,isStageCampaign:true,deletedAt:null,
   startsAt:{$lte:now},endsAt:{$gt:now}}).select('_id agencyId').lean();
  const ownerIds=[...new Set(campaigns.map(c=>String(c.agencyId)))];
  const owners=await User.find({_id:{$in:ownerIds},role:'admin'}).select('_id').lean();
  const allowedOwners=new Set(owners.map(u=>String(u._id)));
  return new Set(campaigns.filter(c=>allowedOwners.has(String(c.agencyId)))
   .map(c=>String(c._id)));
 }
 const campaigns=await Campaign.find({_id:{$in:ids},
  approvalStatus:'approved',agencyEnabled:true,adminSuspended:false,
  isStageCampaign:true,deletedAt:null,startsAt:{$lte:now},endsAt:{$gt:now}
 }).select('_id').lean();
 if(!campaigns.length)return new Set();
 const activeIds=campaigns.map(c=>c._id);
 const lots=await FundingLot.aggregate([
  {$match:{campaignId:{$in:activeIds},remainingMicros:{$gt:0}}},
  {$group:{_id:'$campaignId',balance:{$sum:'$remainingMicros'}}}
 ]);
 return new Set(lots.filter(l=>l.balance>0).map(l=>String(l._id)));
}
async function filterFundedCreatives(creatives,now=new Date()){
 const permitted=await eligibleCampaignIds(creatives,now);
 return creatives.filter(ad=>!ad.campaignId||permitted.has(String(ad.campaignId)));
}
async function isFundedCreative(creative,now=new Date()){
 if(!creative?.campaignId)return true;
 return (await eligibleCampaignIds([creative],now)).has(String(creative.campaignId));
}
module.exports={eligibleCampaignIds,filterFundedCreatives,isFundedCreative};
