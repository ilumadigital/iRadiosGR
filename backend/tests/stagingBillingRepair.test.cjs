'use strict';
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {inspectOne, runRepair, stagingOnly} = require('../services/stagingBillingRepair');
const original = {APP_ENV: process.env.APP_ENV, IRADIOS_GATEWAY_ENV: process.env.IRADIOS_GATEWAY_ENV};
process.env.APP_ENV = 'staging';
process.env.IRADIOS_GATEWAY_ENV = 'staging';
after(() => Object.entries(original).forEach(([k,v]) => v == null ? delete process.env[k] : process.env[k] = v));
const account = '507f1f77bcf86cd799439012';
const uuid = '00000000-0000-4000-8000-000000000000';
const NOW = new Date('2026-11-20T22:00:00Z');
const payment = 'b'.repeat(32), gatewayOrder = 'IL' + 'A'.repeat(24);
const environment = {mode: () => 'staging', configured: () => true};
const listener = (overrides = {}) => ({
 _id: '507f1f77bcf86cd799439011', accountId: account, environment: 'staging',
 requestKey: 'iradios-stage-' + account + '-' + uuid, sku: 'L-PREM', billingOrigin: 'checkout',
 status: 'unknown', lockKey: account + ':L-PREM', amountCents: 399, currency: 'EUR',
 createdAt: new Date(+NOW - 600000), updatedAt: new Date(+NOW - 250000),
 eventIds: [], eventLog: [], paidAt: null, ...overrides});
const broadcaster = (overrides = {}) => ({
 ...listener(), sku: 'B-PREM', amountCents: 9900,
 requestKey: 'iradios-bstage-' + account + '-' + uuid,
 lockKey: account + ':B-PREM:account', ...overrides});
const advertising = (overrides = {}) => ({
 ...listener(), sku: undefined, billingOrigin: undefined, agencyId: account,
 campaignId: '507f1f77bcf86cd799439010', quoteId: '507f1f77bcf86cd799439013',
 activeLockKey: '507f1f77bcf86cd799439010', lockKey: undefined,
 amountCents: 20000, ...overrides});
function fixture(row, opts = {}) {
 const counters = {update: 0, quote: 0, providerGet: 0, post: 0};
 const provider = opts.provider || {payment_id: payment, order_id: gatewayOrder, status: 'failed'};
 const Gateway = {
   configured: () => true,
   async paymentByRequestKey(){counters.providerGet++; if(opts.error) throw {code: opts.error}; return provider;},
   async broadcasterPaymentByRequestKey(){counters.providerGet++; if(opts.error) throw {code: opts.error}; return provider;},
   async advertisingPaymentByRequestKey(){counters.providerGet++; if(opts.error) throw {code: opts.error}; return provider;},
   async broadcasterCheckout(){counters.post++; throw Error('MUST NOT POST');},
   async checkout(){counters.post++; throw Error('MUST NOT POST');}
 };
 const Model = {
   async updateOne(filter, patch){
     counters.update++;
     if (opts.race) return {modifiedCount: 0};
     assert.equal(filter._id, row._id);
     assert.equal(filter.requestKey, row.requestKey);
     assert.equal(filter.status, row.status);
     for (const [k,v] of Object.entries(patch.$set || {})) row[k] = v;
     for (const k of Object.keys(patch.$unset || {})) delete row[k];
     return {modifiedCount: 1};
   },
   find() { return {sort(){return this;}, limit(){return this;}, async lean(){return [row];}};}
 };
 const models = {listener: Model, broadcaster: Model, advertising: Model,
   FundingLot: {async exists(){return Boolean(opts.funded);}},
   Quote: {async updateOne(filter){assert.deepEqual(filter.status, {$in: ['quoted','checkout']}); counters.quote++;}}
 };
 return {row, counters, models, gateway: Gateway, environment,
   inspect: (family, apply = true) => inspectOne(family, row, {models, gateway: Gateway, environment, apply, now: NOW})};
}
test('staging gate blocks production configuration before any lookup', async() => {
 const f = fixture(listener()); process.env.APP_ENV = 'production';
 await assert.rejects(f.inspect('listener'), /STAGING_BILLING_REPAIR_GUARD/);
 process.env.APP_ENV = 'staging'; process.env.IRADIOS_GATEWAY_ENV = 'production';
 assert.throws(() => stagingOnly(environment, f.gateway), /STAGING_BILLING_REPAIR_GUARD/);
 process.env.IRADIOS_GATEWAY_ENV = 'staging'; assert.equal(f.counters.providerGet, 0);
});
test('signed 404 with no provider references releases unpaid listener checkout', async() => {
 const f = fixture(listener(), {error: 'GATEWAY_HTTP_404'});
 const preview = await f.inspect('listener', false);
 assert.equal(preview.state, 'READY'); assert.equal(f.counters.update, 0);
 const done = await f.inspect('listener');
 assert.equal(done.state, 'REPAIRED'); assert.equal(f.row.status, 'failed');
 assert.equal(f.row.lockKey, undefined); assert.equal(f.counters.post, 0);
});
test('never unlock known Gateway order on 404 even after 10 minutes', async() => {
 const f = fixture(broadcaster({gatewayOrderId: gatewayOrder}), {error: 'GATEWAY_HTTP_404'});
 assert.equal((await f.inspect('broadcaster')).reason, 'GATEWAY_MISSING_WITH_STORED_PROVIDER_REFERENCE');
 assert.equal(f.counters.update, 0); assert.ok(f.row.lockKey);
});
test('failed/canceled Gateway order releases only scoped unpaid Broadcaster lock', async() => {
 for (const status of ['failed','canceled']) {
   const f = fixture(broadcaster({gatewayPaymentId: payment, gatewayOrderId: gatewayOrder}),
     {provider: {payment_id: payment, order_id: gatewayOrder, status}});
   assert.equal((await f.inspect('broadcaster')).state, 'REPAIRED');
   assert.equal(f.row.status, status); assert.equal(f.row.lockKey, undefined);
   assert.equal(f.counters.post, 0);
 }
});
test('paid, redirect, pending and unknown provider never release lock', async() => {
 for (const status of ['paid','redirect','pending','unknown']) {
   const f = fixture(listener(), {provider: {payment_id: payment, order_id: gatewayOrder, status}});
   const out = await f.inspect('listener');
   assert.ok(['REVIEW','DEFERRED'].includes(out.state));
   assert.equal(f.counters.update, 0); assert.ok(f.row.lockKey);
 }
});
test('any signed event or paid evidence prevents release', async() => {
 for (const patch of [{eventIds: ['c'.repeat(32)]}, {paidAt: NOW},
    {periodEndsAt: NOW}, {providerStatus: 'paid'}]) {
   const f = fixture(broadcaster(patch), {error: 'GATEWAY_HTTP_404'});
   assert.equal((await f.inspect('broadcaster')).state, 'REVIEW');
   assert.equal(f.counters.update, 0);
 }
});
test('Nexi timeout and Gateway HTTP 503 defer without unlock', async() => {
 for (const code of ['GATEWAY_TIMEOUT','GATEWAY_HTTP_503']) {
   const f = fixture(listener(), {error: code});
   assert.equal((await f.inspect('listener')).state, 'DEFERRED');
   assert.ok(f.row.lockKey);
 }
});
test('Gateway payment ID mismatch and concurrent webhook protect locked state', async() => {
 const mismatch = fixture(broadcaster({gatewayPaymentId:'c'.repeat(32)}));
 assert.equal((await mismatch.inspect('broadcaster')).state, 'REVIEW');
 assert.equal(mismatch.counters.update, 0);
 const race = fixture(listener(), {race: true});
 assert.equal((await race.inspect('listener')).reason, 'CONCURRENT_CHANGE');
 assert.ok(race.row.lockKey);
});
test('advertising releases failed checkout, cancels its quote, never creates funding', async() => {
 const f = fixture(advertising());
 const out = await f.inspect('advertising');
 assert.equal(out.state, 'REPAIRED'); assert.equal(f.row.status, 'failed');
 assert.equal(f.row.activeLockKey, undefined); assert.equal(f.counters.quote, 1);
 assert.equal(f.counters.post, 0);
});
test('advertising funding lot always blocks cleanup', async() => {
 const f = fixture(advertising(), {funded: true});
 assert.equal((await f.inspect('advertising')).reason, 'FUNDING_LOT_EXISTS');
 assert.equal(f.counters.update, 0);
});
test('terminal abandoned lock is idempotent; paid ad requires audit', async() => {
 const l = fixture(listener({status:'failed'}));
 assert.equal((await l.inspect('listener')).state,'REPAIRED');
 assert.equal((await l.inspect('listener')).state,'CLEAN');
 const a = fixture(advertising({status:'paid'}));
 assert.equal((await a.inspect('advertising')).state,'REVIEW');
});
test('batch default dry run inspects all three families without writes', async() => {
 const f = fixture(listener(), {error: 'GATEWAY_HTTP_404'});
 const report = await runRepair({models:f.models,gateway:f.gateway,environment,apply:false,now:NOW});
 assert.equal(report.inspected,3); assert.equal(report.mode,'DRY_RUN');
 assert.equal(f.counters.update,0);
});

test('three-minute minimum age blocks early 404 release', async() => {
 const f = fixture(listener({createdAt: new Date(+NOW - 170000)}), {error: 'GATEWAY_HTTP_404'});
 assert.equal((await f.inspect('listener')).reason, 'CHECKOUT_STILL_RECENT');
 assert.equal(f.counters.providerGet, 0);
});
test('cursor batch reports a resumable per-ledger scan position', async() => {
 const f = fixture(listener(), {error: 'GATEWAY_HTTP_404'});
 const scan = await runRepair({models: f.models, gateway: f.gateway, environment,
  now: NOW, after: {listener: {createdAt:'2026-11-19T00:00:00.000Z',id:account}}});
 assert.equal(scan.cursors.listener.id, f.row._id);
 assert.equal(scan.cursors.advertising.id, f.row._id);
});
