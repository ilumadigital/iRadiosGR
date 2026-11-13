'use strict';
// EXPERIMENTAL / UNWIRED: unlimited-volume accounting uses MongoDB majority
// transactions. Requires a replica set, real Mongo concurrency UAT and
// explicit financial approval. Does not enable paid ad delivery.
const {normalize,assertClaimMatches}=require('./advertisingSettlementCore');
const {qualifiedEventDebitNanos}=require('./advertisingCpmMath');
const {ensureAdvertisingFinancialIndexes}=require('./advertisingFinancialIndexes');
const Event=require('../models/AdvertisingBillableEvent');
const FundingLot=require('../models/AdvertisingFundingLot');
const mongoose=require('mongoose');
function charged(event,duplicate){
 if(event.status!=='charged'||!event.settledAt)
  throw Error('Invalid committed transactional advertising event');
 return {status:'charged',charged:true,duplicate,
  eventId:event._id,costNanos:event.costNanos,
  fundingLotId:String(event.fundingLotId)};
}
async function chooseFundedLot(campaignId,tier){
 const ratePath='$ratesMicros.'+tier;
 return FundingLot.findOne({
  campaignId,source:'nexi_verified',
  settlementMode:'mongo_transaction_v2',
  remainingNanos:{$gt:0},
  $expr:{$gte:['$remainingNanos',{$ifNull:[ratePath,Number.MAX_SAFE_INTEGER]}]}
 }).sort({paidAt:1,_id:1})
  .select('_id remainingNanos ratesMicros settlementMode').lean();
}
async function claimEvent(request){
 await ensureAdvertisingFinancialIndexes();
 const lot=await chooseFundedLot(request.campaignId,request.tier);
 if(!lot)return null;
 const rateMicros=lot.ratesMicros?.[request.tier];
 const costNanos=qualifiedEventDebitNanos(rateMicros);
 if(!Number.isSafeInteger(lot.remainingNanos)||lot.remainingNanos<costNanos)
  throw Error('Transactional lot is not financially eligible');
 const claim={_id:request.eventId,campaignId:request.campaignId,
  creativeId:request.creativeId,kind:request.kind,tier:request.tier,
  fundingLotId:lot._id,rateMicros,costNanos,
  qualifiedAt:request.qualifiedAt,status:'pending'};
 try{return (await Event.create(claim)).toObject();}
 catch(error){
  if(error.code!==11000)throw error;
  const winner=await Event.findById(request.eventId).lean();
  if(!winner)throw Error('Unrecoverable transactional event ID collision');
  return winner;
 }
}
async function transactionalDebit(event){
 // A per-event ledger marker and wallet decrement commit or rollback TOGETHER.
 // No embedded receipts; the charged Event document IS the immutable receipt.
 const session=await mongoose.startSession();
 try{
  return await session.withTransaction(async()=>{
   const claim=await Event.findById(event._id).session(session).lean();
   assertClaimMatches(claim,event);
   if(claim.status==='charged')return 'already_charged';
   if(claim.status!=='pending')throw Error('Invalid settlement claim state');
   const lot=await FundingLot.findOne({
    _id:event.fundingLotId,campaignId:event.campaignId,
    source:'nexi_verified',settlementMode:'mongo_transaction_v2'
   }).session(session).lean();
   if(!lot)throw Error('Transactional lot missing or incorrectly scoped');
   if(qualifiedEventDebitNanos(lot.ratesMicros?.[event.tier])!==event.costNanos||
      event.rateMicros!==lot.ratesMicros[event.tier])
    throw Error('Historical CPM rate mismatch');
   if(!Number.isSafeInteger(lot.remainingNanos)||lot.remainingNanos<0)
    throw Error('Invalid canonical wallet balance');
   if(lot.remainingNanos<event.costNanos)return 'unfunded';
   const debit=await FundingLot.updateOne({
    _id:event.fundingLotId,campaignId:event.campaignId,
    source:'nexi_verified',settlementMode:'mongo_transaction_v2',
    remainingNanos:{$gte:event.costNanos}
   },[{$set:{
    remainingNanos:{$subtract:['$remainingNanos',event.costNanos]},
    remainingMicros:{$floor:{$divide:[
     {$subtract:['$remainingNanos',event.costNanos]},1000]}}
   }}],{session});
   if(debit.modifiedCount!==1)throw Error('Atomic wallet debit did not commit');
   const commit=await Event.updateOne({
    _id:event._id,campaignId:event.campaignId,
    fundingLotId:event.fundingLotId,status:'pending'
   },{$set:{status:'charged',settledAt:new Date()}},{session});
   if(commit.modifiedCount!==1)
    throw Error('Atomic ledger receipt did not commit');
   return 'charged';
  },{
   readConcern:{level:'snapshot'},writeConcern:{w:'majority'},
   readPreference:'primary',maxCommitTimeMS:10000
  });
 }finally{await session.endSession();}
}
async function settleQualifiedEventTransactional(input){
 // Only a privileged, independently validated server event may call this.
 // No browser token, HTTP counter, or stream request proves qualification.
 const request=normalize(input);
 await ensureAdvertisingFinancialIndexes();
 let event=await Event.findById(request.eventId).lean();
 if(!event)event=await claimEvent(request);
 if(!event)return {status:'unfunded',charged:false};
 assertClaimMatches(event,request);
 if(event.status==='charged')return charged(event,true);
 if(event.status!=='pending')throw Error('Invalid transaction claim status');
 try{
  const state=await transactionalDebit(event);
  if(state==='unfunded')
   return {status:'pending',charged:false,reason:'funding_depleted'};
  const saved=await Event.findById(event._id).lean();
  assertClaimMatches(saved,request);
  return charged(saved,state==='already_charged');
 }catch(error){
  // UnknownTransactionCommitResult is resolvable ONLY by reading the durable
  // unique event marker, not by issuing an independent second wallet debit.
  const after=await Event.findById(event._id).lean();
  assertClaimMatches(after,request);
  if(after.status==='charged')return charged(after,true);
  throw error;
 }
}
module.exports={settleQualifiedEventTransactional,transactionalDebit,
 chooseFundedLot,claimEvent};
