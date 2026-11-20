'use strict';
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {inspectOne, runRepair, guardScope, stagingOnly} =
  require('../services/billingRepair');
const {options} = require('../scripts/billingRepairProduction');
const scheduler = require('../utils/productionBillingRepairScheduler');

const keys = ['APP_ENV','IRADIOS_GATEWAY_ENV',
  'IRADIOS_PRODUCTION_CUTOVER_APPROVED',
  'IRADIOS_PRODUCTION_BILLING_REPAIR_ENABLED',
  'IRADIOS_PRODUCTION_BILLING_REPAIR_AUTO_ENABLED'];
const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
after(() => Object.entries(old).forEach(([k, v]) =>
  v == null ? delete process.env[k] : process.env[k] = v));
function configure(write = false, automatic = false) {
  process.env.APP_ENV = 'production';
  process.env.IRADIOS_GATEWAY_ENV = 'production';
  process.env.IRADIOS_PRODUCTION_CUTOVER_APPROVED = '1';
  process.env.IRADIOS_PRODUCTION_BILLING_REPAIR_ENABLED = write ? '1' : '0';
  process.env.IRADIOS_PRODUCTION_BILLING_REPAIR_AUTO_ENABLED = automatic ? '1' : '0';
}
configure();
const account = '507f1f77bcf86cd799439012';
const uuid = '00000000-0000-4000-8000-000000000000';
const NOW = new Date('2026-11-20T22:00:00Z');
const payment = 'b'.repeat(32), gatewayOrder = 'IL'+'A'.repeat(24);
const environment = {mode: () => 'production', configured: () => true};
function listener(patch = {}) {
  return {_id: '507f1f77bcf86cd799439011', accountId: account,
    environment: 'production', sku: 'L-PREM', billingOrigin: 'checkout',
    requestKey: 'iradios-stage-'+account+'-'+uuid,
    status: 'unknown', amountCents: 399, currency: 'EUR',
    lockKey: account+':L-PREM', eventIds: [], eventLog: [],
    createdAt: new Date(+NOW-700000), updatedAt: new Date(+NOW-300000),
    paidAt: null, ...patch};
}
function broadcaster(patch = {}) {
  return {...listener(), sku: 'B-PREM', amountCents: 9900,
    requestKey: 'iradios-bstage-'+account+'-'+uuid,
    lockKey: account+':B-PREM:account', ...patch};
}
function advertising(patch = {}) {
  return {...listener(), environment: undefined, sku: undefined, billingOrigin: undefined,
    agencyId: account, campaignId: '507f1f77bcf86cd799439010',
    quoteId: '507f1f77bcf86cd799439013', lockKey: undefined,
    activeLockKey: '507f1f77bcf86cd799439010', amountCents: 20000,
    ...patch};
}
function fixture(row, opts = {}) {
  const calls = {reads: 0, writes: 0, quotes: 0, fundingChecks: 0, post: 0, queries: []};
  const provider = opts.provider || {payment_id: payment, order_id: gatewayOrder, status: 'canceled'};
  const gateway = {
    configured: () => true,
    async paymentByRequestKey() {calls.reads++; if(opts.error) throw {code: opts.error}; return provider;},
    async broadcasterPaymentByRequestKey() {calls.reads++; if(opts.error) throw {code: opts.error}; return provider;},
    async advertisingPaymentByRequestKey() {calls.reads++; if(opts.error) throw {code: opts.error}; return provider;},
    async checkout() {calls.post++; throw Error('FORBIDDEN_CHECKOUT');}
  };
  const Model = {
    async updateOne(query, patch) {
      calls.writes++;
      assert.equal(query._id, row._id);
      if (row.environment) assert.equal(query.environment, 'production');
      assert.equal(query.updatedAt, row.updatedAt);
      if (opts.race) return {modifiedCount: 0};
      Object.assign(row, patch.$set || {});
      for (const k of Object.keys(patch.$unset || {})) delete row[k];
      return {modifiedCount: 1};
    },
    find(query) {calls.queries.push(query);return {
      sort() {return this;}, limit() {return this;}, async lean() {return [row];}
    };}
  };
  const models = {listener: Model, broadcaster: Model, advertising: Model,
    FundingLot: {async exists(){calls.fundingChecks++; return Boolean(opts.funded);}},
    Quote: {async updateOne(){calls.quotes++;}}};
  return {row, calls, gateway, models,
    inspect: (family, apply = false) => inspectOne(family, row,
      {models, gateway, environment, apply, now: NOW, target: 'production'})};
}
test('production audit defaults to read-only without production write flag', async () => {
  configure(false);
  const f = fixture(listener());
  const out = await f.inspect('listener');
  assert.equal(out.state, 'READY');
  assert.equal(out.reason, 'GATEWAY_TERMINAL_CANCELED');
  assert.equal(f.calls.writes, 0);
  assert.equal(f.calls.post, 0);
});
test('production apply is rejected BEFORE a provider call without opt-in', async () => {
  configure(false);
  const f = fixture(listener());
  await assert.rejects(f.inspect('listener', true), /PRODUCTION_BILLING_REPAIR_DISABLED/);
  assert.equal(f.calls.reads, 0);
  assert.equal(f.calls.writes, 0);
});
test('production apply is rejected unless live cutover is approved', async () => {
  configure(true);
  process.env.IRADIOS_PRODUCTION_CUTOVER_APPROVED = '0';
  const f = fixture(listener());
  await assert.rejects(f.inspect('listener', true), /PRODUCTION_BILLING_REPAIR_DISABLED/);
  assert.equal(f.calls.reads, 0);
  configure(false);
});
test('no staging process can read or repair production data', async () => {
  configure(true);
  process.env.APP_ENV='staging';
  const f=fixture(listener());
  await assert.rejects(f.inspect('listener'), /PRODUCTION_BILLING_REPAIR_GUARD/);
  await assert.rejects(f.inspect('listener',true), /PRODUCTION_BILLING_REPAIR_GUARD/);
  assert.throws(() => stagingOnly(environment, f.gateway), /STAGING_BILLING_REPAIR_GUARD/);
  assert.equal(f.calls.reads,0);
  configure(false);
});
test('production scope rejects staging orders even with write flag on', async () => {
  configure(true);
  const f=fixture(listener({environment:'staging'}));
  assert.equal((await f.inspect('listener',true)).reason,'INVALID_SCOPE_OR_REFERENCES');
  assert.equal(f.calls.writes,0);
  configure(false);
});
test('confirmed canceled Gateway result releases only production lock with opt-in', async () => {
  configure(true);
  const f=fixture(broadcaster({gatewayPaymentId: payment, gatewayOrderId: gatewayOrder}));
  const out=await f.inspect('broadcaster',true);
  assert.equal(out.state,'REPAIRED');
  assert.equal(out.reason,'GATEWAY_TERMINAL_CANCELED');
  assert.equal(f.row.status,'canceled');
  assert.equal(f.row.lockKey,undefined);
  assert.equal(f.calls.writes,1);
  assert.equal(f.calls.post,0);
  configure(false);
});
test('production never releases unknown provider or missing Gateway with references', async () => {
  configure(true);
  for(const status of ['unknown','pending','redirect','paid']){
    const f=fixture(listener(),{provider:{payment_id:payment,order_id:gatewayOrder,status}});
    assert.notEqual((await f.inspect('listener',true)).state,'REPAIRED');
    assert.equal(f.calls.writes,0);
  }
  const orphan=fixture(broadcaster({gatewayOrderId:gatewayOrder}),{error:'GATEWAY_HTTP_404'});
  assert.equal((await orphan.inspect('broadcaster',true)).reason,
    'GATEWAY_MISSING_WITH_STORED_PROVIDER_REFERENCE');
  assert.equal(orphan.calls.writes,0);
  configure(false);
});
test('production signed 404 without stored IDs still requires minimum age', async () => {
  configure(true);
  const early=fixture(listener({createdAt:new Date(+NOW-80000)}),{error:'GATEWAY_HTTP_404'});
  assert.equal((await early.inspect('listener',true)).reason,'CHECKOUT_STILL_RECENT');
  assert.equal(early.calls.writes,0);
  const aged=fixture(listener(),{error:'GATEWAY_HTTP_404'});
  assert.equal((await aged.inspect('listener',true)).reason,'UNCREATED_GATEWAY_PAYMENT_CONFIRMED');
  assert.equal(aged.calls.writes,1);
  configure(false);
});
test('production paid evidence, webhook and funding lot prevent release', async () => {
  configure(true);
  for(const patch of [{paidAt:NOW},{eventIds:['signed']},{periodStartsAt:NOW}]){
    const f=fixture(listener(patch));
    assert.equal((await f.inspect('listener',true)).reason,'PAYMENT_EVIDENCE_OR_EVENT_PRESENT');
    assert.equal(f.calls.writes,0);
  }
  const funded=fixture(advertising(),{funded:true});
  assert.equal((await funded.inspect('advertising',true)).reason,
    'PRODUCTION_ADVERTISING_SCOPE_NOT_VERIFIED');
  assert.equal(funded.calls.writes,0);
  assert.equal(funded.calls.reads,0);
  assert.equal(funded.calls.fundingChecks,0);
  configure(false);
});
test('production Gateway unavailability never unlocks and cannot issue checkout POST', async () => {
  configure(true);
  const f=fixture(listener(),{error:'GATEWAY_TIMEOUT'});
  assert.equal((await f.inspect('listener',true)).reason,'GATEWAY_LOOKUP_UNAVAILABLE');
  assert.equal(f.calls.writes,0);
  assert.equal(f.calls.post,0);
  configure(false);
});
test('concurrent webhook race preserves the lock', async () => {
  configure(true);
  const f=fixture(listener(),{race:true});
  assert.equal((await f.inspect('listener',true)).reason,'CONCURRENT_CHANGE');
  assert.ok(f.row.lockKey);
  configure(false);
});
test('production CLI requires explicit --apply and --confirm-live together', () => {
  assert.deepEqual(options([]), {apply:false,confirmLive:false,limit:100});
  assert.deepEqual(options(['--limit','500']), {apply:false,confirmLive:false,limit:500});
  assert.deepEqual(options(['--apply','--confirm-live']),
    {apply:true,confirmLive:true,limit:100});
  for(const args of [['--apply'],['--confirm-live'],['--limit','501'],
    ['--limit','NaN'],['--apply','--apply'],['--unknown']])
    assert.throws(()=>options(args));
});
test('production scheduler is off by default and requires BOTH distinct flags', () => {
  configure(false,false);
  assert.equal(scheduler.enabled(),false);
  configure(true,false);
  assert.equal(scheduler.enabled(),false);
  configure(false,true);
  assert.equal(scheduler.enabled(),false);
  configure(true,true);
  assert.equal(scheduler.enabled(),true);
  process.env.IRADIOS_GATEWAY_ENV='staging';
  assert.equal(scheduler.enabled(),false);
  configure(false,false);
});
test('production audit uses production-only environment filter for ledgers', async () => {
  configure(false);
  const f=fixture(listener());
  const summary=await runRepair({models:f.models,gateway:f.gateway,environment,
    target:'production',apply:false,now:NOW});
  assert.equal(summary.environment,'production');
  assert.equal(summary.mode,'DRY_RUN');
  assert.equal(summary.inspected,3);
  assert.equal(f.calls.writes,0);
  assert.equal(f.calls.queries[0].environment,'production');
  assert.equal(f.calls.queries[1].environment,'production');
  assert.equal(f.calls.queries[2].environment,undefined);
});
