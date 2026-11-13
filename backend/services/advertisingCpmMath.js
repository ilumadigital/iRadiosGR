'use strict';
// Monetary sub-unit: EUR nanos (10^9 per EUR). A CPM expressed in EUR
// micros (10^6 per EUR) equals EXACTLY that many nanos per impression:
//   CPM_micros / 1000 impressions * 1000 nanos/micro = CPM_micros.
// This avoids losing fractional micros when billing single events.
const MAX_BUDGET_CENTS=100000000;
const NANOS_PER_CENT=10000000;
function budgetCentsToNanos(cents){
 if(!Number.isSafeInteger(cents)||cents<1||cents>MAX_BUDGET_CENTS)
  throw new RangeError('Invalid EUR cent budget');
 return cents*NANOS_PER_CENT;
}
function qualifiedEventDebitNanos(cpmMicros){
 if(!Number.isSafeInteger(cpmMicros)||cpmMicros<1000||cpmMicros>1000000000)
  throw new RangeError('Invalid historical CPM micros snapshot');
 return cpmMicros;
}
function chargeNanosForEvents(cpmMicros,qualifiedEvents){
 const single=qualifiedEventDebitNanos(cpmMicros);
 if(!Number.isSafeInteger(qualifiedEvents)||qualifiedEvents<0)
  throw new RangeError('Invalid qualified event count');
 const sum=BigInt(single)*BigInt(qualifiedEvents);
 if(sum>BigInt(Number.MAX_SAFE_INTEGER))
  throw new RangeError('Financial amount exceeds safe integer range');
 return Number(sum);
}
function canDebitNanos(remainingNanos,cpmMicros){
 if(!Number.isSafeInteger(remainingNanos)||remainingNanos<0)
  throw new RangeError('Invalid financial balance');
 return remainingNanos>=qualifiedEventDebitNanos(cpmMicros);
}
module.exports={budgetCentsToNanos,qualifiedEventDebitNanos,
 chargeNanosForEvents,canDebitNanos,NANOS_PER_CENT};
