'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const {budgetCentsToNanos,qualifiedEventDebitNanos,
 chargeNanosForEvents,canDebitNanos}=require('../services/advertisingCpmMath');

test('exact fractional-micro CPM event accounting without floating point',()=>{
 assert.equal(budgetCentsToNanos(10000),100000000000);
 assert.equal(qualifiedEventDebitNanos(4000000),4000000);
 assert.equal(chargeNanosForEvents(4000000,1000),4000000000);
 assert.equal(chargeNanosForEvents(4000001,1000),4000001000);
 assert.equal(canDebitNanos(3999999,4000000),false);
 assert.equal(canDebitNanos(4000000,4000000),true);
 assert.throws(()=>budgetCentsToNanos(100000001),/Invalid/);
 assert.throws(()=>budgetCentsToNanos(1.1),/Invalid/);
 assert.throws(()=>chargeNanosForEvents(4000000,-1),/Invalid/);
 assert.throws(()=>chargeNanosForEvents(1000000000,Number.MAX_SAFE_INTEGER),/safe integer/);
});
test('Mongo unique lock is acquired prior to any outgoing checkout',()=>{
 const model=read('models/AdvertisingPaymentIntent.js');
 const routes=read('routes/advertisingCampaignRoutes.js');
 const indexes=read('services/advertisingFinancialIndexes.js');
 assert.match(model,/activeLockKey:\\{type:String,unique:true,sparse:true\\}/);
 assert.match(routes,/activeLockKey:String\\(campaign\\._id\\)/);
 assert.ok(routes.indexOf('await ensureAdvertisingFinancialIndexes();')<
  routes.indexOf('await gateway.advertisingCheckout('));
 assert.match(indexes,/Intent\\.createIndexes\\(\\)/);
 assert.match(indexes,/FundingLot\\.createIndexes\\(\\)/);
});
test('verified paid/canceled events unlock checkout, unknown never does',()=>{
 const source=read('services/advertisingPaymentEvents.js');
 assert.match(source,/event\\.event_type!=='payment\\.paid'/);
 assert.equal((source.match(/\\$unset:\\{activeLockKey:''\\}/g)||[]).length,2);
 const routes=read('routes/advertisingCampaignRoutes.js');
 assert.match(routes,/status:'unknown',lastError/);
});
test('legacy unaudited counters cannot count paid advertising v2 events',()=>{
 for(const name of ['controllers/adController.js','controllers/bannerController.js']){
  const source=read(name);
  assert.match(source,/if\\(!live\\(\\w+\\)\\|\\|\\w+\\.campaignId\\)return res\\.status\\(404\\)/);
  assert.match(source,/activeCampaignQuery\\(\\),campaignId:null/);
 }
 const eligibility=read('services/advertisingDeliveryEligibility.js');
 assert.match(eligibility,/const ATOMIC_SETTLEMENT_IMPLEMENTED=false/);
});
