'use strict';
// Read-only, deterministic financial reconciliation. A permanent receipt is
// stored atomically with its lot debit. Missing or duplicate receipts are
// financial alarms, not silently repairable guesses.
const {qualifiedEventDebitNanos}=require('./advertisingCpmMath');
function auditLot(lot){
 const id=String(lot?._id||'');
 if(lot?.budgetNanos===undefined||lot?.remainingNanos===undefined)
  return {lotId:id,status:'legacy_needs_review',safe:false,
   message:'Micros-only lot requires reviewed nano balance backfill'};
 const budget=lot.budgetNanos,remaining=lot.remainingNanos;
 if(!Number.isSafeInteger(budget)||!Number.isSafeInteger(remaining)||
    budget<=0||remaining<0||remaining>budget)
  return {lotId:id,status:'invalid_balance',safe:false};
 const seen=new Set();
 let spent=0n;
 const receipts=lot.settledEvents||[];
 if(!Array.isArray(receipts))
  return {lotId:id,status:'invalid_receipts',safe:false};
 for(const item of receipts){
  if(!item||typeof item.eventId!=='string'||
     !/^[a-f0-9]{32}$/.test(item.eventId)||seen.has(item.eventId))
   return {lotId:id,status:'invalid_or_duplicate_event',safe:false};
  seen.add(item.eventId);
  const rate=lot.ratesMicros?.[item.tier];
  try{
   if(qualifiedEventDebitNanos(rate)!==item.costNanos)
    return {lotId:id,status:'incorrect_historical_rate',safe:false};
  }catch{return {lotId:id,status:'incorrect_historical_rate',safe:false};}
  spent+=BigInt(item.costNanos);
 }
 const debited=BigInt(budget)-BigInt(remaining);
 if(debited!==spent)
  return {lotId:id,status:'balance_receipt_mismatch',safe:false,
   receiptCount:receipts.length,expectedSpentNanos:debited.toString(),
   journalSpentNanos:spent.toString()};
 if(lot.remainingMicros!==Math.floor(remaining/1000))
  return {lotId:id,status:'stale_legacy_projection',safe:false};
 return {lotId:id,status:'reconciled',safe:true,
  receiptCount:receipts.length,spentNanos:Number(spent),
  remainingNanos:remaining,budgetNanos:budget};
}
module.exports={auditLot};
