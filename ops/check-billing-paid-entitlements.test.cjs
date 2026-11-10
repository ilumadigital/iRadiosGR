'use strict';
const test=require('node:test');
// This suite tests the staging-only first-period entitlement projection.
process.env.APP_ENV='staging';
const assert=require('node:assert/strict');
const Module=require('node:module');
const original=Module._load;
let paidFound=false,requestedFilter=null,grants=[];
const rows={exists:async filter=>{requestedFilter=filter;return paidFound?{_id:'some-payment'}:null;}};
const gift={find:()=>({lean:async()=>grants})};
Module._load=function(name,parent,isMain){
 if(String(parent?.filename||'').endsWith('/backend/services/billingEntitlements.js')){
  if(name==='../models/BillingOrder')return rows;
  if(name==='../models/BillingGrant')return gift;
 }
 return original.call(this,name,parent,isMain);
};
let service;
try{service=require('../backend/services/billingEntitlements');}
finally{Module._load=original;}
const NOW=new Date('2026-11-10T13:00:00Z');
const listener={_id:'l1',role:'user',isPremium:false,activeSubscriptions:[]};
test('Verified paid L-PREM grants Listener Premium only during the purchased or explicit grace period',async()=>{
 paidFound=true;grants=[];requestedFilter=null;
 const rights=await service.accountRights(listener,NOW);
 assert.ok(rights.includes('listener.premium'));
 assert.equal(requestedFilter.accountId,'l1');
 assert.equal(requestedFilter.sku,'L-PREM');
 assert.equal(requestedFilter.status,'paid');
 assert.deepEqual(requestedFilter.$or,[{periodEndsAt:{$gt:NOW}},{graceEndsAt:{$gt:NOW}}],
  'Paid benefits are available until the purchased period or explicit stored grace deadline');
 assert.equal(requestedFilter.environment,'staging');
 const projected=await service.projectAccountUser(listener);
 assert.equal(projected.isPremium,true);
 assert.equal(listener.isPremium,false);
 assert.equal(projected.billingAutomaticRenewalsAvailable,false);
});
test('Absent/expired paid cycle does not grant Premium; existing manual Premium is preserved',async()=>{
 paidFound=false;grants=[];
 assert.deepEqual(await service.accountRights(listener,NOW),[]);
 assert.equal((await service.projectAccountUser(listener)).isPremium,false);
 const manual={...listener,isPremium:true};
 assert.ok((await service.accountRights(manual,NOW)).includes('listener.premium'));
});
test('Complimentary grants remain separate from payment records',async()=>{
 paidFound=false;
 grants=[{accountId:'l1',sku:'L-PREM',scopeType:'account',
  source:'admin_complimentary',startsAt:new Date('2026-11-01T00:00:00Z'),
  expiresAt:new Date('2026-12-01T00:00:00Z'),revokedAt:null}];
 assert.ok((await service.accountRights(listener,NOW)).includes('listener.premium'));
 grants=[];
});

test('Production never projects a paid staging order even if records were copied',async()=>{
 const priorEnv=process.env.APP_ENV;
 process.env.APP_ENV='production';paidFound=true;grants=[];requestedFilter=null;
 try{
  assert.deepEqual(await service.accountRights(listener,NOW),[]);
  assert.equal(requestedFilter,null,'No staging payment lookup is permitted outside staging');
 }finally{
  process.env.APP_ENV=priorEnv;paidFound=false;
 }
});
