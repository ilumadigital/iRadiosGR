'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fingerprintGrant}=require('../utils/billingGrantRequest');
test('Identical grant requests have identical canonical fingerprints',()=>{
 const input={accountId:'u1',sku:'L-PREM',resourceId:null,
  expiresAt:'2026-12-10T00:00:00.000Z',reason:' Manual gift '};
 const same={...input,reason:'Manual gift',expiresAt:new Date(input.expiresAt)};
 assert.equal(fingerprintGrant(input),fingerprintGrant(same));
 assert.match(fingerprintGrant(input),/^[a-f0-9]{64}$/);
});
test('Reusing an idempotency key for different terms is detectable',()=>{
 const base={accountId:'u1',sku:'L-PREM',reason:'Manual gift'};
 const fingerprint=fingerprintGrant(base);
 for(const change of [{sku:'B-PREM'},{accountId:'u2'},{reason:'Other gift'},
   {expiresAt:'2026-12-10T00:00:00Z'},{resourceId:'s2'}])
   assert.notEqual(fingerprint,fingerprintGrant({...base,...change}));
});
