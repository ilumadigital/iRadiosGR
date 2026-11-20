'use strict';
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {requireProduction, classify, inventory} =
  require('../services/productionBillingInventory');
const {options} = require('../scripts/billingInventoryProduction');

const prev = {APP_ENV:process.env.APP_ENV, IRADIOS_GATEWAY_ENV:process.env.IRADIOS_GATEWAY_ENV};
function env(app='production', gateway='production') {
  process.env.APP_ENV=app; process.env.IRADIOS_GATEWAY_ENV=gateway;
}
env();
after(() => Object.entries(prev).forEach(([k,v]) => v==null ?
  delete process.env[k] : process.env[k]=v));
const NOW=new Date('2026-11-20T22:00:00Z');
const oid='507f1f77bcf86cd799439012';
function row(overrides={}) {
  return {_id:oid,sku:'L-PREM',environment:'production',
    status:'unknown',lockKey:'pending-lock',
    createdAt:new Date(+NOW-600000),gatewayOrderId:null,gatewayPaymentId:null,
    eventIds:[],eventLog:[],paidAt:null,billingOrigin:'checkout',...overrides};
}
function dbFixture(entries) {
  const calls={find:[],writes:0,collections:[]};
  const db={collection(name){
    calls.collections.push(name);
    return {find(filter, options){
      calls.find.push({name,filter,options});
      return {sort(){return this;},limit(n){assert.ok(n<=500);return this;},
        async toArray(){return entries[name]||[];}};
    },updateOne(){calls.writes++;throw Error('WRITES_FORBIDDEN');},
    insertOne(){calls.writes++;throw Error('WRITES_FORBIDDEN');}};
  }};
  return {db,calls};
}
test('read-only inventory refuses staging and cross-tenant scope', async() => {
  const f=dbFixture({});
  env('staging','staging');
  await assert.rejects(inventory({db:f.db}),/PRODUCTION_INVENTORY_SCOPE_REQUIRED/);
  env('production','staging');
  assert.throws(requireProduction,/PRODUCTION_INVENTORY_SCOPE_REQUIRED/);
  assert.equal(f.calls.find.length,0);
  env();
});
test('production local inventory works even when billing/cutover flags are off', async() => {
  env();
  const f=dbFixture({
    billingorders:[row()],
    broadcasterbillingorders:[row({sku:'B-PREM',gatewayOrderId:'ILA'.repeat(1)+'A'.repeat(23)})],
    advertisingpaymentintents:[row({sku:undefined,environment:undefined,activeLockKey:'ad'})]
  });
  const seen=[];
  const out=await inventory({db:f.db,limit:10,now:NOW,onRow:x=>seen.push(x)});
  assert.equal(out.environment,'production');
  assert.equal(out.mode,'READ_ONLY_LOCAL_INVENTORY');
  assert.equal(out.inspected,3);
  assert.equal(out.candidate,2);
  assert.equal(out.review,1);
  assert.equal(f.calls.writes,0);
  assert.deepEqual(f.calls.collections, ['billingorders','broadcasterbillingorders','advertisingpaymentintents']);
  assert.equal(f.calls.find[0].filter.environment,'production');
  assert.equal(f.calls.find[1].filter.environment,'production');
  assert.equal(f.calls.find[2].filter.environment,undefined);
  assert.equal(seen[0].reason,'GATEWAY_REQUEST_KEY_CHECK_REQUIRED');
  assert.equal(seen[1].reason,'PROVIDER_REFERENCES_REQUIRE_SIGNED_CHECK');
  assert.equal(seen[2].reason,'ADVERTISING_SCOPE_REQUIRES_SEPARATE_AUDIT');
  assert.equal(JSON.stringify(seen).includes('pending-lock'),false);
});
test('local inventory never calls Gateway and cannot claim charge absence', () => {
  env();
  const x=classify(row({gatewayPaymentId:'b'.repeat(32)}),'listener',NOW);
  assert.equal(x.state,'CANDIDATE');
  assert.equal(x.reason,'PROVIDER_REFERENCES_REQUIRE_SIGNED_CHECK');
  assert.equal(x.hasProviderReference,true);
});
test('paid/signed-event and terminal leftovers remain reviewable', () => {
  env();
  for(const patch of [{paidAt:NOW},{eventIds:['signed']},{providerStatus:'paid'}]){
    const x=classify(row(patch),'listener',NOW);
    assert.equal(x.state,'REVIEW');
    assert.equal(x.reason,'PAYMENT_OR_WEBHOOK_EVIDENCE_PRESENT');
  }
  assert.equal(classify(row({status:'failed'}),'listener',NOW).reason,
    'TERMINAL_LOCK_REQUIRES_RECONCILIATION');
  assert.equal(classify(row({status:'failed',lockKey:undefined}),'listener',NOW).state,'CLEAN');
});
test('advertising never claims safe production cleanup even for paid or failed intents', () => {
  for(const status of ['failed','canceled','paid','unknown']){
    const x=classify(row({status,sku:undefined,environment:undefined,
      activeLockKey:'ad',gatewayOrderId:'IL'+'A'.repeat(24)}),'advertising',NOW);
    assert.equal(x.state,'REVIEW');
    assert.equal(x.reason,'ADVERTISING_SCOPE_REQUIRES_SEPARATE_AUDIT');
  }
});
test('local-only audit CLI has explicit acknowledgement and no apply option', () => {
  assert.deepEqual(options(['--confirm-readonly-audit']),
    {limit:100,confirm:true});
  assert.deepEqual(options(['--limit','500','--confirm-readonly-audit']),
    {limit:500,confirm:true});
  for(const args of [[],['--apply','--confirm-readonly-audit'],
    ['--confirm-readonly-audit','--limit','501'],
    ['--confirm-readonly-audit','--limit','NaN'],
    ['--confirm-readonly-audit','--confirm-readonly-audit']])
    assert.throws(()=>options(args));
});
