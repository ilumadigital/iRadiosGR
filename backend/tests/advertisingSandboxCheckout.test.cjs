'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {DEFAULTS,quotedAmounts}=require('../services/advertisingPricingRules');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');

function loadPolicy(model,appEnv='staging'){
 const module={exports:{}};
 vm.runInNewContext(read('services/advertisingPricingStore.js'),{
  module,exports:module.exports,process:{env:{APP_ENV:appEnv}},
  require(id){
   if(id==='../models/AdvertisingPricing')return model;
   if(id==='./advertisingPricingRules')return {DEFAULTS};
   throw Error('Unexpected dependency '+id);
  }
 });
 return module.exports;
}
const cursor=row=>({lean:async()=>row});
const row={_id:'iradios-advertising-v2',...DEFAULTS,history:[],changedBy:null};
test('fresh staging policy makes EUR 100 net budget payable EUR 124 incl 24% VAT',async()=>{
 const calls=[];
 const model={
  findById:()=>cursor(null),
  findOneAndUpdate:(filter,update,options)=>{
   calls.push({filter,update,options});
   return cursor({...row,...update.$setOnInsert});
  }
 };
 const result=await loadPolicy(model).getAdvertisingPricing();
 assert.equal(result.enabled,true);
 assert.equal(result.taxMode,'budget_net_plus_vat');
 assert.equal(result.taxBps,2400);
 assert.equal(result.cpmMicros.standard,4000000);
 assert.equal(quotedAmounts(10000,result,'initial').paymentCents,12400);
 assert.equal(calls.length,1);
 assert.equal(calls[0].options.upsert,true);
});
test('only pristine legacy placeholder is upgraded; existing Admin policy is preserved',async()=>{
 let updates=0;
 const pristine={...row};
 const model={
  findById:()=>cursor(pristine),
  findOneAndUpdate:(filter,update)=>{
   updates++;
   assert.equal(filter['history.0'].$exists,false);
   assert.equal(update.$inc.version,1);
   return cursor({...pristine,...update.$set,version:2});
  }
 };
 const upgraded=await loadPolicy(model).getAdvertisingPricing();
 assert.equal(upgraded.taxBps,2400);
 assert.equal(upgraded.version,2);
 assert.equal(updates,1);
 const customized={...row,history:[{by:'admin'}],changedBy:'admin',enabled:false};
 const model2={findById:()=>cursor(customized),findOneAndUpdate:()=>{throw Error('Must not auto-enable Admin-disabled pricing');}};
 assert.equal((await loadPolicy(model2).getAdvertisingPricing()).enabled,false);
});
test('production policy never auto-enables advertising checkout',async()=>{
 const model={findById:()=>cursor(null),findOneAndUpdate:()=>{throw Error('No production writes');}};
 const policy=await loadPolicy(model,'production').getAdvertisingPricing();
 assert.equal(policy.enabled,false);
 assert.equal(policy.taxMode,'unconfigured');
});
test('checkout and read-only recovery reuse existing signed Gateway staging credentials',()=>{
 const route=read('routes/advertisingCampaignRoutes.js');
 const client=read('services/ilumaGatewayClient.js');
 assert.match(route,/sandboxCheckoutReady:[^;]*gateway\.configured\(\)/s);
 assert.doesNotMatch(route,/process\.env\.AD_PAYMENTS_SANDBOX_ENABLED/);
 assert.doesNotMatch(client,/process\.env\.AD_PAYMENTS_SANDBOX_ENABLED/);
 assert.match(route,/await gateway\.advertisingCheckout\(/);
 assert.match(route,/gateway\.advertisingPaymentByRequestKey\(/);
 assert.match(read('services/advertisingPaymentEvents.js'),/source:'nexi_verified'/);
 assert.match(read('controllers/gatewayBillingController.js'),/verifyWebhookHeaders\(/);
});
