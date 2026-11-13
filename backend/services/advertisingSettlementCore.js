'use strict';
const {qualifiedEventDebitNanos}=require('./advertisingCpmMath');
const EVENT_ID=/^[a-f0-9]{32}$/;
const ENTITY_ID=/^[a-f0-9]{24}$/;
const TIERS=new Set(['standard','hero','audio']);
function normalize(input){
 if(!input||!EVENT_ID.test(input.eventId||'')||
    !ENTITY_ID.test(input.campaignId||'')||
    !ENTITY_ID.test(input.creativeId||'')||
    !TIERS.has(input.tier)||
    !((input.tier==='audio')===(input.kind==='audio')))
  throw Error('Invalid server-qualified advertising event');
 const qualifiedAt=input.qualifiedAt instanceof Date?input.qualifiedAt:
  new Date(input.qualifiedAt);
 if(!Number.isFinite(qualifiedAt.getTime()))throw Error('Invalid qualification timestamp');
 return {eventId:input.eventId,campaignId:input.campaignId,
  creativeId:input.creativeId,kind:input.kind,tier:input.tier,qualifiedAt};
}
const same=(a,b)=>String(a)===String(b);
function assertClaimMatches(event,request){
 if(!event||event._id!==request.eventId ||
    !same(event.campaignId,request.campaignId)||
    !same(event.creativeId,request.creativeId)||
    event.kind!==request.kind||event.tier!==request.tier||
    new Date(event.qualifiedAt).getTime()!==request.qualifiedAt.getTime()||
    !ENTITY_ID.test(String(event.fundingLotId))||
    qualifiedEventDebitNanos(event.rateMicros)!==event.costNanos)
  throw Error('Advertising event ID collision or corrupted claim');
}
function assertReceiptMatches(receipt,event){
 if(!receipt||receipt.eventId!==event._id||
    receipt.costNanos!==event.costNanos||
    receipt.tier!==event.tier||
    !same(receipt.creativeId,event.creativeId))
  throw Error('Advertising settlement receipt mismatch');
}
// No HTTP route invokes this function. Its caller must supply a genuinely
// server-verified qualified event; never accept a browser impression as proof.
// The paid delivery gate stays hard-disabled until qualification/pacing/UAT.
async function settleQualifiedEvent(input,store){
 const request=normalize(input);
 let event=await store.getEvent(request.eventId);
 if(!event){
  const lot=await store.chooseFundedLot(request.campaignId,request.tier);
  if(!lot)return {status:'unfunded',charged:false};
  const rateMicros=lot.ratesMicros?.[request.tier];
  const costNanos=qualifiedEventDebitNanos(rateMicros);
  if(!Number.isSafeInteger(lot.remainingNanos)||lot.remainingNanos<costNanos)
   throw Error('Selected funding lot is not financially eligible');
  event=await store.claimEvent({
   _id:request.eventId,campaignId:request.campaignId,
   creativeId:request.creativeId,kind:request.kind,tier:request.tier,
   fundingLotId:lot._id,rateMicros,costNanos,
   qualifiedAt:request.qualifiedAt,status:'pending'
  });
 }
 assertClaimMatches(event,request);
 if(!['pending','charged'].includes(event.status))
  throw Error('Invalid settlement status');
 // Receipt is the primary financial truth: debit and immutable marker were
 // written TOGETHER inside one Mongo document, without a replica-set txn.
 let receipt=await store.findReceipt(event);
 if(!receipt&&event.status==='charged')
  throw Error('Charged event has no immutable funding-lot receipt');
 let debited=false;
 if(!receipt){
  let unknownError=null;
  try{debited=Boolean(await store.atomicDebitWithReceipt(event));}
  catch(error){unknownError=error;}
  receipt=await store.findReceipt(event);
  if(!receipt){
   if(unknownError)throw Error('Unknown debit result; retry original advertising event ID');
   return {status:'pending',charged:false,reason:'funding_or_receipt_capacity'};
  }
 }
 assertReceiptMatches(receipt,event);
 await store.markCharged(event._id);
 return {status:'charged',charged:true,duplicate:!debited,
  eventId:event._id,costNanos:event.costNanos,fundingLotId:String(event.fundingLotId)};
}
module.exports={normalize,assertClaimMatches,assertReceiptMatches,settleQualifiedEvent};
