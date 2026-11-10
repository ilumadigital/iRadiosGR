'use strict';

// Pure, deterministic renewal window. No payment state is ever trusted from
// the browser and no automatic charges are made by this policy.
const DAY_MS=24*60*60*1000;
function paidRenewalState(order,now=new Date()){
 if(!order||order.status!=='paid'||!order.periodEndsAt)return null;
 const today=+new Date(now);
 const end=+new Date(order.periodEndsAt);
 const graceRaw=order.graceEndsAt?+new Date(order.graceEndsAt):end;
 if(!Number.isFinite(today)||!Number.isFinite(end)||!Number.isFinite(graceRaw))return null;
 const graceEnd=Math.max(end,graceRaw);
 let kind=null;
 if(today<end && end-today<=DAY_MS)kind='soon';
 else if(today>=end && today<graceEnd)kind='grace';
 else if(today>=graceEnd)kind='expired';
 if(!kind)return null;
 return {kind,cycleId:String(order._id),periodEndsAt:new Date(end).toISOString(),
  graceEndsAt:new Date(graceEnd).toISOString(),priceCents:399,currency:'EUR'};
}
function paidRenewalPeriod(confirmedAt,previousPeriodEndsAt=null){
 const confirmed=new Date(confirmedAt),prev=previousPeriodEndsAt?new Date(previousPeriodEndsAt):null;
 if(!Number.isFinite(+confirmed)|| (prev&&!Number.isFinite(+prev)))throw Error('Invalid renewal dates');
 // When the paid renewal is bought while the old month is still active,
 // append the next month instead of charging for overlapping days.
 return prev&&prev>confirmed?prev:confirmed;
}
module.exports={DAY_MS,paidRenewalState,paidRenewalPeriod};
