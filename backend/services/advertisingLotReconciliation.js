'use strict';
// Read-only financial reconciliation. Legacy funding lots store a receipt
// atomically inside the wallet; mongo_transaction_v2 lots commit the charged
// event marker and wallet debit in ONE MongoDB majority transaction.
const {qualifiedEventDebitNanos}=require('./advertisingCpmMath');
function auditLot(lot,chargedEvents){
 const id=String(lot?._id||'');
 if(lot?.budgetNanos===undefined||lot?.remainingNanos===undefined)
  return {lotId:id,status:'legacy_needs_review',safe:false,
   message:'Micros-only lot requires reviewed nano balance backfill'};
 const budget=lot.budgetNanos,remaining=lot.remainingNanos;
 if(!Number.isSafeInteger(budget)||!Number.isSafeInteger(remaining)||
    budget<=0||remaining<0||remaining>budget)
  return {lotId:id,status:'invalid_balance',safe:false};
 const receipts=lot.settledEvents||[];
 if(!Array.isArray(receipts))
  return {lotId:id,status:'invalid_receipts',safe:false};
 const transactional=lot.settlementMode==='mongo_transaction_v2';
 if(lot.settlementMode&&
    !['mongo_transaction_v2','embedded_receipts'].includes(lot.settlementMode))
  return {lotId:id,status:'unsupported_settlement_mode',safe:false};
 if(transactional&&(!Array.isArray(chargedEvents)||receipts.length))
  return {lotId:id,status:'transactional_ledger_unavailable_or_mixed',safe:false};
 const seen=new Set();
 let spent=0n,count=0;
 const records=transactional?chargedEvents.filter(e=>e.status==='charged'):receipts;
 for(const item of records){
  const eventId=transactional?String(item._id):item?.eventId;
  if(!/^[a-f0-9]{32}$/.test(eventId)||seen.has(eventId))
   return {lotId:id,status:'invalid_or_duplicate_event',safe:false};
  seen.add(eventId);
  if(transactional&&(
    !item.settledAt||
    String(item.fundingLotId)!==id||
    String(item.campaignId)!==String(lot.campaignId)
  ))return {lotId:id,status:'invalid_transactional_event',safe:false};
  const rate=lot.ratesMicros?.[item.tier];
  try{
   if(qualifiedEventDebitNanos(rate)!==item.costNanos||
      (transactional&&item.rateMicros!==rate))
    return {lotId:id,status:'incorrect_historical_rate',safe:false};
  }catch{return {lotId:id,status:'incorrect_historical_rate',safe:false};}
  spent+=BigInt(item.costNanos);
  count++;
 }
 const debited=BigInt(budget)-BigInt(remaining);
 if(debited!==spent)
  return {lotId:id,status:'balance_receipt_mismatch',safe:false,
   receiptCount:count,expectedSpentNanos:debited.toString(),
   journalSpentNanos:spent.toString()};
 if(lot.remainingMicros!==Math.floor(remaining/1000))
  return {lotId:id,status:'stale_legacy_projection',safe:false};
 return {lotId:id,status:'reconciled',safe:true,
  receiptCount:count,spentNanos:Number(spent),
  remainingNanos:remaining,budgetNanos:budget,
  settlementMode:transactional?'mongo_transaction_v2':'embedded_receipts'};
}
module.exports={auditLot};
