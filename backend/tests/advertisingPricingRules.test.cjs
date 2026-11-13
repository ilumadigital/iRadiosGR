'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {DEFAULTS,validatePricing,quotedAmounts,budgetMicros}=
 require('../services/advertisingPricingRules');
test('unfinished tax policy fails closed',()=>{
 assert.throws(()=>quotedAmounts(10000,DEFAULTS,'initial'),/not enabled/);
 assert.throws(()=>validatePricing({...DEFAULTS,enabled:true}),/without explicit tax/);
});
test('admin explicitly enables a taxable net budget',()=>{
 const card={...DEFAULTS,enabled:true,taxMode:'budget_net_plus_vat',taxBps:2400};
 assert.equal(validatePricing(card),true);
 assert.deepEqual(quotedAmounts(10000,card,'initial'),{
  budgetCents:10000,taxCents:2400,paymentCents:12400
 });
 assert.equal(budgetMicros(10000),100000000);
});
test('rounding is deterministic in whole cents',()=>{
 const card={...DEFAULTS,enabled:true,taxMode:'budget_net_plus_vat',taxBps:2400};
 assert.equal(quotedAmounts(1001,card,'topup').taxCents,240);
 assert.throws(()=>quotedAmounts('10000',card,'initial'),/outside/);
 assert.throws(()=>quotedAmounts(1,card,'topup'),/outside/);
});
