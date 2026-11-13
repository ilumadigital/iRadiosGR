'use strict';
// v2 paid inventory remains non-billable until qualified, atomic settlement
// is wired to actual delivery. Staging can explicitly preview APPROVED, PAID
// creatives in listener placements without debiting funds or changing receipts.
const Campaign=require('../models/AdvertisingCampaign');
const FundingLot=require('../models/AdvertisingFundingLot');
const User=require('../models/User');
const {paidPlacementPreviewEnabled,affordablePaidPreview}=
 require('./advertisingStagePaidPreview');
const ATOMIC_SETTLEMENT_IMPLEMENTED=false;

// Return exact eligible creative ids; a banner with hero and standard
// placements must afford BOTH, not just some other creative in its campaign.
async function stageEligibleCreativeIds(creatives,now){
 const ids=[...new Set(creatives.map(ad=>ad?.campaignId).filter(Boolean).map(String))];
 if(!ids.length)return new Set();
 // Agency approval is the activation event on staging. The historical
 // wizard defaulted startsAt to tomorrow, leaving already-approved and
 // funded campaigns invisible. Keep the end-date, approval and wallet gates.
 const common={_id:{$in:ids},workflowVersion:2,agencyEnabled:true,
  adminSuspended:false,isStageCampaign:true,deletedAt:null,
  endsAt:{$gt:now}};
 const preview=paidPlacementPreviewEnabled();
 const [adminCampaigns,paidCampaigns]=await Promise.all([
  Campaign.find({...common,startsAt:{$lte:now},createdByRole:'admin',approvalStatus:'approved'})
   .select('_id agencyId createdByRole').lean(),
  preview?Campaign.find({...common,createdByRole:'agency',approvalStatus:'approved'})
   .select('_id agencyId createdByRole').lean():Promise.resolve([])
 ]);
 const campaigns=[...adminCampaigns,...paidCampaigns];
 if(!campaigns.length)return new Set();
 const ownerIds=[...new Set(campaigns.map(c=>String(c.agencyId)))];
 const owners=await User.find({_id:{$in:ownerIds},
  role:{$in:['admin','agency']}}).select('_id role').lean();
 const roles=new Map(owners.map(u=>[String(u._id),u.role]));
 const admins=new Map(adminCampaigns.filter(c=>roles.get(String(c.agencyId))==='admin')
  .map(c=>[String(c._id),c]));
 const paid=new Map(paidCampaigns.filter(c=>roles.get(String(c.agencyId))==='agency')
  .map(c=>[String(c._id),c]));
 const lots=paid.size?await FundingLot.find({
  campaignId:{$in:[...paid.keys()]},source:'nexi_verified'
 }).select('campaignId source budgetNanos remainingNanos ratesMicros settlementMode settledEvents').lean():[];
 const lotsByCampaign=new Map();
 for(const lot of lots){
  const id=String(lot.campaignId);
  if(!lotsByCampaign.has(id))lotsByCampaign.set(id,[]);
  lotsByCampaign.get(id).push(lot);
 }
 const allowed=new Set();
 for(const ad of creatives){
  if(!ad?.campaignId||!ad?._id)continue;
  const id=String(ad.campaignId);
  const owner=admins.get(id)||paid.get(id);
  if(!owner||String(ad.agencyId)!==String(owner.agencyId))continue;
  if(Array.isArray(ad.placement)&&ad.isActive===false)continue;
  if(admins.has(id)||(
   paid.has(id)&&affordablePaidPreview(lotsByCampaign.get(id)||[],ad)
  ))allowed.add(String(ad._id));
 }
 return allowed;
}
async function eligibleCampaignIds(creatives,now=new Date()){
 const ids=[...new Set(creatives.map(ad=>ad?.campaignId).filter(Boolean).map(String))];
 if(!ids.length)return new Set();
 if(!ATOMIC_SETTLEMENT_IMPLEMENTED){
  if(process.env.APP_ENV!=='staging')return new Set();
  const allowed=await stageEligibleCreativeIds(creatives,now);
  return new Set(creatives.filter(ad=>allowed.has(String(ad._id)))
   .map(ad=>String(ad.campaignId)));
 }
 // Future paid mode requires verified per-event settlement before activation.
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
 if(!creatives.length)return [];
 if(!ATOMIC_SETTLEMENT_IMPLEMENTED&&process.env.APP_ENV==='staging'){
  const permitted=await stageEligibleCreativeIds(creatives,now);
  return creatives.filter(ad=>!ad.campaignId||permitted.has(String(ad._id)));
 }
 const permitted=await eligibleCampaignIds(creatives,now);
 return creatives.filter(ad=>!ad.campaignId||permitted.has(String(ad.campaignId)));
}
async function isFundedCreative(creative,now=new Date()){
 if(!creative?.campaignId)return true;
 return (await filterFundedCreatives([creative],now)).length===1;
}
module.exports={eligibleCampaignIds,filterFundedCreatives,isFundedCreative};
