'use strict';
const DEFAULTS=Object.freeze({
 enabled:false,version:1,cpmMicros:{standard:4000000,hero:8000000,audio:12000000},
 minBudgetCents:2000,maxBudgetCents:100000000,minTopupCents:1000,
 taxMode:'unconfigured',taxBps:null,durationDays:[7,10,14,30]
});
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function validatePricing(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid pricing');
 const rates=input.cpmMicros;
 if(!rates||!['standard','hero','audio'].every(k=>integer(rates[k],1000,1000000000)))
  throw Error('CPM must use exact integer EUR micros');
 const min=input.minBudgetCents,max=input.maxBudgetCents,top=input.minTopupCents;
 if(!integer(min,100,100000000)||!integer(max,min,100000000)||
    !integer(top,100,max))throw Error('Invalid budget boundaries');
 const duration=input.durationDays;
 if(!Array.isArray(duration)||!duration.length||duration.length>20||
    new Set(duration).size!==duration.length||
    duration.some(d=>!integer(d,1,365)))throw Error('Invalid durations');
 if(!['unconfigured','budget_net_plus_vat'].includes(input.taxMode))
  throw Error('Invalid tax mode');
 if(input.taxMode==='budget_net_plus_vat'&&!integer(input.taxBps,0,3000))
  throw Error('Explicit tax rate must be configured');
 if(input.taxMode==='unconfigured'&&input.enabled===true)
  throw Error('Pricing cannot be enabled without explicit tax policy');
 if(typeof input.enabled!=='boolean')throw Error('Invalid enabled flag');
 return true;
}
function quotedAmounts(budgetCents,pricing,kind){
 validatePricing(pricing);
 if(!pricing.enabled||pricing.taxMode!=='budget_net_plus_vat')
  throw Error('Advertising payment policy is not enabled');
 if(!integer(budgetCents,kind==='topup'?pricing.minTopupCents:pricing.minBudgetCents,
   pricing.maxBudgetCents))throw Error('Budget outside configured limits');
 // BigInt rounding half-up keeps payable cents exact and deterministic.
 const tax=Number((BigInt(budgetCents)*BigInt(pricing.taxBps)+5000n)/10000n);
 const payment=budgetCents+tax;
 if(!integer(payment,100,125000000))throw Error('Payable amount exceeds Gateway cap');
 return {budgetCents,taxCents:tax,paymentCents:payment};
}
const budgetMicros=budgetCents=>{
 if(!integer(budgetCents,1,100000000))throw Error('Invalid budget');
 return budgetCents*10000;
};
module.exports={DEFAULTS,validatePricing,quotedAmounts,budgetMicros};
