'use strict';
const Event=require('../models/AdvertisingBillableEvent');
const FundingLot=require('../models/AdvertisingFundingLot');
const {qualifiedEventDebitNanos}=require('./advertisingCpmMath');
const {ensureAdvertisingFinancialIndexes}=require('./advertisingFinancialIndexes');
// Temporary bounded immutable receipt journal. It must be replaced with
// partitioned financial buckets before public delivery is enabled. The cap
// deliberately FAILS CLOSED rather than silently dropping debit receipts.
const MAX_RECEIPTS_PER_LOT=6000;
const capPath='settledEvents.'+(MAX_RECEIPTS_PER_LOT-1);
async function getEvent(eventId){
 return Event.findById(eventId).lean();
}
async function chooseFundedLot(campaignId,tier){
 const lots=await FundingLot.find({
  campaignId,remainingNanos:{$gt:0},[capPath]:{$exists:false},
  source:'nexi_verified'
 }).sort({paidAt:1,_id:1}).select('_id remainingNanos ratesMicros').limit(100).lean();
 return lots.find(lot=>{
  try{return lot.remainingNanos>=qualifiedEventDebitNanos(lot.ratesMicros?.[tier]);}
  catch{return false;}
 })||null;
}
async function claimEvent(claim){
 await ensureAdvertisingFinancialIndexes();
 try{return (await Event.create(claim)).toObject();}
 catch(error){
  if(error.code!==11000)throw error;
  // The winner fixed the lot and rate. Do NOT retry using our other lot.
  const existing=await Event.findById(claim._id).lean();
  if(!existing)throw Error('Event claim collision has no recoverable record');
  return existing;
 }
}
async function findReceipt(event){
 const lot=await FundingLot.findOne({
  _id:event.fundingLotId,campaignId:event.campaignId,
  'settledEvents.eventId':event._id
 },{settledEvents:{$elemMatch:{eventId:event._id}}}).lean();
 return lot?.settledEvents?.[0]||null;
}
async function atomicDebitWithReceipt(event){
 const amount=event.costNanos;
 const receipt={
  eventId:event._id,costNanos:amount,creativeId:event.creativeId,
  tier:event.tier,settledAt:new Date()
 };
 // Conditional money decrement and a permanent immutable receipt commit
 // atomically in ONE funding lot document. Replays cannot pass the filter.
 // A parallel request cannot write a negative balance or overfill the journal.
 const change=await FundingLot.updateOne({
  _id:event.fundingLotId,campaignId:event.campaignId,
  remainingNanos:{$gte:amount},'settledEvents.eventId':{$ne:event._id},
  [capPath]:{$exists:false}
 },[{$set:{
  remainingNanos:{$subtract:['$remainingNanos',amount]},
  remainingMicros:{$floor:{$divide:[
   {$subtract:['$remainingNanos',amount]},1000]}},
  settledEvents:{$concatArrays:[{$ifNull:['$settledEvents',[]]},[receipt]]}
 }}]);
 return change.modifiedCount===1;
}
async function markCharged(eventId){
 const done=await Event.findOneAndUpdate({_id:eventId,status:'pending'},
  {$set:{status:'charged',settledAt:new Date()}},{new:true}).lean();
 if(done)return done;
 const existing=await Event.findById(eventId).lean();
 if(existing?.status!=='charged')throw Error('Advertising ledger reconciliation pending');
 return existing;
}
const store={getEvent,chooseFundedLot,claimEvent,findReceipt,
 atomicDebitWithReceipt,markCharged};
module.exports={store,MAX_RECEIPTS_PER_LOT};
