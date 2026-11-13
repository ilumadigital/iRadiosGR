'use strict';
const {auditLot}=require('./advertisingLotReconciliation');
function auditFundingSet(lots,events){
 if(!Array.isArray(lots)||!Array.isArray(events))
  throw Error('Invalid financial audit data');
 const byId=new Map();
 const claimById=new Map();
 const issues=[];
 const reports=lots.map(lot=>{
  const id=String(lot._id);
  if(byId.has(id))issues.push('duplicate_lot:'+id);
  byId.set(id,lot);
  const result=auditLot(lot);
  if(!result.safe)issues.push(result.status+':'+id);
  return result;
 });
 for(const event of events){
  const id=String(event._id);
  if(claimById.has(id))issues.push('duplicate_event_claim:'+id);
  claimById.set(id,event);
  if(!byId.has(String(event.fundingLotId)))
   issues.push('orphaned_claim:'+id);
  if(!['pending','charged'].includes(event.status))
   issues.push('invalid_event_status:'+id);
 }
 let pending=0,charged=0;
 for(const event of events){
  if(event.status==='pending')pending++;
  if(event.status==='charged')charged++;
  const lot=byId.get(String(event.fundingLotId));
  if(!lot)continue;
  const receipt=(lot.settledEvents||[]).find(x=>x.eventId===event._id);
  if(event.status==='charged'&&!receipt)
   issues.push('charged_without_receipt:'+String(event._id));
  if(receipt&&(receipt.costNanos!==event.costNanos||
      receipt.tier!==event.tier||
      String(receipt.creativeId)!==String(event.creativeId)))
   issues.push('claim_receipt_mismatch:'+String(event._id));
 }
 for(const lot of lots){
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
