'use strict';
// Pure policy; the supplied store MUST implement a majority-transaction
// decrement and charged ledger marker in the SAME MongoDB transaction.
const {normalize,assertClaimMatches}=require('./advertisingSettlementCore');
function charged(event,duplicate){
 if(event.status!=='charged'||!event.settledAt)
  throw Error('Invalid committed transactional advertising event');
 return {status:'charged',charged:true,duplicate,
  eventId:event._id,costNanos:event.costNanos,
  fundingLotId:String(event.fundingLotId)};
}
async function settleQualifiedEventTransactional(input,store){
 const request=normalize(input);
 if(!store||typeof store.ensureIndexes!=='function'||
    typeof store.getEvent!=='function'||
    typeof store.claimEvent!=='function'||
    typeof store.transactionalDebit!=='function')
  throw Error('Transactional financial store is required');
 await store.ensureIndexes();
 let event=await store.getEvent(request.eventId);
 if(!event)event=await store.claimEvent(request);
 if(!event)return {status:'unfunded',charged:false};
 assertClaimMatches(event,request);
 if(event.status==='charged')return charged(event,true);
 if(event.status!=='pending')throw Error('Invalid transaction claim status');
 try{
  const state=await store.transactionalDebit(event);
  if(state==='unfunded')
   return {status:'pending',charged:false,reason:'funding_depleted'};
  if(!['charged','already_charged'].includes(state))
   throw Error('Unexpected transactional commit status');
  const saved=await store.getEvent(event._id);
  assertClaimMatches(saved,request);
  return charged(saved,state==='already_charged');
 }catch(error){
  // UnknownTransactionCommitResult: never issue an independent second debit.
  const after=await store.getEvent(event._id);
  assertClaimMatches(after,request);
  if(after.status==='charged')return charged(after,true);
  throw error;
 }
}
module.exports={settleQualifiedEventTransactional};
