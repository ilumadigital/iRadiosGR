'use strict';
// Read-only financial compatibility preview for a shadow-qualified event.
// NEVER debits a funding lot, never creates AdvertisingBillableEvent claims.
const mongoose=require('mongoose');
const Qualified=require('../models/AdvertisingQualifiedEvent');
const Campaign=require('../models/AdvertisingCampaign');
const Banner=require('../models/BannerAd');
const Audio=require('../models/Ad');
const Lot=require('../models/AdvertisingFundingLot');
const {qualifiedEventDebitNanos}=require('./advertisingCpmMath');
const {evaluateBudgetAffordability}=require('./advertisingBudgetAffordability');
async function previewShadowCharge(id,now=new Date()){
 if(!/^[a-f0-9]{32}$/.test(String(id)))throw Error('Invalid qualified event ID');
 const event=await Qualified.findById(id).lean();
 if(!event||event.status!=='shadow_qualified'||event.billable!==false)
  return {status:'not_verified',dryRun:true,charged:false};
 const campaign=await Campaign.findOne({_id:event.campaignId,
  approvalStatus:'approved',isStageCampaign:true,agencyEnabled:true,
  adminSuspended:false,deletedAt:null,startsAt:{$lte:now},
  endsAt:{$gt:now}}).lean();
 if(!campaign)return {status:'approval_or_period_blocked',dryRun:true,charged:false};
 const creative=event.kind==='audio'?
  await Audio.exists({_id:event.creativeId,campaignId:event.campaignId,
   agencyId:campaign.agencyId,isStageCreative:true,status:'active'}):
  await Banner.exists({_id:event.creativeId,campaignId:event.campaignId,
   agencyId:campaign.agencyId,isStageCreative:true,status:'active',
   isActive:true,placement:event.placement});
 if(!creative||((event.kind==='audio')!==(event.tier==='audio'))||
    (event.kind==='visual'&&
     ((event.placement==='hero')!==(event.tier==='hero'))))
  return {status:'creative_scope_blocked',dryRun:true,charged:false};
 const lots=await Lot.find({campaignId:campaign._id})
  .sort({paidAt:1,_id:1}).lean();
 const affordability=evaluateBudgetAffordability(lots,[event.tier]);
 if(!affordability.canDeliver)
  return {status:affordability.status,dryRun:true,charged:false};
 for(const lot of lots){
  if(lot.source!=='nexi_verified'||
     lot.settlementMode!=='mongo_transaction_v2'&&
      (lot.settledEvents||[]).length>=6000)continue;
  let cost;
  try{cost=qualifiedEventDebitNanos(lot.ratesMicros?.[event.tier]);}
  catch{continue;}
  if(!Number.isSafeInteger(lot.remainingNanos)||
     lot.remainingNanos<cost)continue;
  return {status:'would_be_affordable',dryRun:true,charged:false,
   eventId:event._id,campaignId:String(campaign._id),
   fundingLotId:String(lot._id),historicalCpmMicros:lot.ratesMicros[event.tier],
   estimatedCostNanos:cost,remainingNanos:lot.remainingNanos,
   settlementMode:lot.settlementMode};
 }
 return {status:'not_affordable',dryRun:true,charged:false};
}
module.exports={previewShadowCharge};
