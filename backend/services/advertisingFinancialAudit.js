'use strict';
const {auditLot}=require('./advertisingLotReconciliation');
// Full read-only reconciliation across BOTH settlement protocols.
// A charged transactional claim is the financial receipt; embedded legacy
// lots store their immutable receipts inside the funding document.
function auditFundingSet(lots,events){
 if(!Array.isArray(lots)||!Array.isArray(events))
  throw Error('Invalid financial audit data');
 const byId=new Map(),claimsByLot=new Map(),claimById=new Map();
 const issues=[];
 for(const lot of lots){
  const id=String(lot._id);
  if(byId.has(id))issues.push('duplicate_lot:'+id);
  byId.set(id,lot);
  claimsByLot.set(id,[]);
 }
 let pending=0,charged=0;
 for(const event of events){
  const id=String(event._id),lotId=String(event.fundingLotId);
  if(claimById.has(id))issues.push('duplicate_event_claim:'+id);
  claimById.set(id,event);
  const lot=byId.get(lotId);
  if(!lot)issues.push('orphaned_claim:'+id);
  else{
   claimsByLot.get(lotId).push(event);
   if(String(lot.campaignId)!=='undefined'&&
      String(event.campaignId)!==String(lot.campaignId))
    issues.push('claim_campaign_mismatch:'+id);
  }
  if(!['pending','charged'].includes(event.status))
   issues.push('invalid_event_status:'+id);
  if(event.status==='pending')pending++;
  if(event.status==='charged')charged++;
 }
 const reports=lots.map(lot=>{
  const id=String(lot._id);
  const result=auditLot(lot,claimsByLot.get(id));
  if(!result.safe)issues.push(result.status+':'+id);
  return result;
 });
 for(const event of events){
  const lot=byId.get(String(event.fundingLotId));
  if(!lot||lot.settlementMode==='mongo_transaction_v2')continue;
  const receipt=(lot.settledEvents||[]).find(x=>x.eventId===event._id);
  if(event.status==='charged'&&!receipt)
   issues.push('charged_without_receipt:'+String(event._id));
  if(event.status==='pending'&&receipt)
   issues.push('pending_with_receipt_needs_recovery:'+String(event._id));
  if(receipt&&(receipt.costNanos!==event.costNanos||
      receipt.tier!==event.tier||
      String(receipt.creativeId)!==String(event.creativeId)))
   issues.push('claim_receipt_mismatch:'+String(event._id));
 }
 for(const lot of lots){
  if(lot.settlementMode==='mongo_transaction_v2')continue;
  for(const receipt of lot.settledEvents||[]){
   const event=claimById.get(receipt.eventId);
   if(!event)issues.push('receipt_without_claim:'+receipt.eventId);
   else if(String(event.fundingLotId)!==String(lot._id))
    issues.push('receipt_lot_mismatch:'+receipt.eventId);
  }
 }
 return {safe:issues.length===0,pending,charged,
  fundedLots:lots.length,issues,reports};
}
module.exports={auditFundingSet};
