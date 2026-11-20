'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validatePurchase,purchasePeriod,paidRights,boostForStation,anchoredMonthlyEnd,validatedAnchoredCycle}=
 require('../services/broadcasterPurchaseRules');
const SID='507f1f77bcf86cd799439011';
const OTHER='507f191e810c19729de860ea';
const now=new Date('2026-11-11T12:00:00Z');
const paid=(sku,resourceId=SID,opts={})=>({
 sku,resourceId,scopeType:sku==='B-PREM'?'account':'station',environment:'staging',
 status:'paid',periodStartsAt:new Date('2026-11-01T00:00:00Z'),
 periodEndsAt:new Date('2026-12-01T00:00:00Z'),...opts
});
test('monthly recurring is required for B-PREM and every ADD-*',()=>{
 for(const sku of ['B-PREM','ADD-DSP','ADD-AN','ADD-ADS']){
  const stationId=sku==='B-PREM'?null:SID;
  assert.equal(validatePurchase({sku,stationId,autoRenew:false}),'SUBSCRIPTION_CONSENT_REQUIRED');
  assert.equal(validatePurchase({sku,stationId,autoRenew:true}),null);
 }
});
test('one-off Boost must never have recurring authorization',()=>{
 for(const sku of ['BOOST-T-DAY','BOOST-G-YEAR']){
  assert.equal(validatePurchase({sku,stationId:SID,autoRenew:true}),'BOOST_CANNOT_RECUR');
  assert.equal(validatePurchase({sku,stationId:SID,autoRenew:false}),null);
 }
});
test('scoped station IDs and account plan are isolated',()=>{
 assert.equal(validatePurchase({sku:'ADD-DSP',stationId:null,autoRenew:true}),'INVALID_RESOURCE_SCOPE');
 assert.equal(validatePurchase({sku:'B-PREM',stationId:SID,autoRenew:true}),'INVALID_RESOURCE_SCOPE');
 assert.equal(validatePurchase({sku:'ADD-DSP',stationId:SID,autoRenew:true}),null);
});
test('duration arithmetic is UTC-safe, not recurring for Boost',()=>{
 const leap='2028-02-29T10:00:00Z';
 assert.equal(purchasePeriod('BOOST-T-DAY',leap).end.toISOString(),'2028-03-01T10:00:00.000Z');
 assert.equal(purchasePeriod('BOOST-T-2W',leap).end.toISOString(),'2028-03-14T10:00:00.000Z');
 assert.equal(purchasePeriod('BOOST-T-MONTH','2027-01-31T10:00:00Z').end.toISOString(),'2027-02-28T10:00:00.000Z');
 assert.equal(purchasePeriod('BOOST-G-YEAR',leap).end.toISOString(),'2029-02-28T10:00:00.000Z');
 assert.equal(purchasePeriod('B-PREM',leap).end.toISOString(),'2028-03-29T10:00:00.000Z');
});
test('station addon cannot unlock a different station',()=>{
 assert.deepEqual(paidRights([paid('ADD-DSP')],OTHER,now),[]);
 assert.deepEqual(paidRights([paid('ADD-DSP')],SID,now),['broadcaster.webdsp']);
});
test('full broadcaster Premium grants all included rights across stations',()=>{
 const rights=paidRights([paid('B-PREM',null)],OTHER,now);
 for(const right of ['broadcaster.unlimited_stations','broadcaster.webdsp',
  'broadcaster.analytics','broadcaster.ad_control','broadcaster.premium_boost'])
  assert.ok(rights.includes(right));
});
test('expired, failed, production or future orders have no rights',()=>{
 for(const row of [
  paid('ADD-ADS',SID,{status:'failed'}),
  paid('ADD-ADS',SID,{environment:'production'}),
  paid('ADD-ADS',SID,{periodEndsAt:new Date('2026-11-10T10:00:00Z')}),
  paid('ADD-ADS',SID,{periodStartsAt:new Date('2026-11-12T10:00:00Z')})
 ])assert.deepEqual(paidRights([row],SID,now),[]);
});
test('purchased Boost wins over Premium; expired Boost falls back',()=>{
 const row=paid('BOOST-G-DAY',SID);
 assert.equal(boostForStation([row],SID,now,true).tier,'purchased');
 assert.equal(boostForStation([row],SID,now,true).priority,200);
 assert.equal(boostForStation([row],OTHER,now,true).priority,100);
 assert.equal(boostForStation([paid('BOOST-G-DAY',SID,{periodEndsAt:new Date('2026-11-10')})],SID,now,true).priority,100);
 assert.equal(boostForStation([],SID,now,false).priority,0);
});

test('MIT follows the ORIGINAL day of month across February and leap years',()=>{
 const due='2027-02-28T15:04:05Z';
 assert.equal(anchoredMonthlyEnd(due,31).toISOString(),'2027-03-31T15:04:05.000Z');
 assert.equal(anchoredMonthlyEnd('2028-02-29T00:00:00Z',31).toISOString(),'2028-03-31T00:00:00.000Z');
 assert.equal(anchoredMonthlyEnd('2027-04-30T12:00:00Z',31).toISOString(),'2027-05-31T12:00:00.000Z');
 assert.equal(anchoredMonthlyEnd('2027-01-31T00:00:00Z',31).toISOString(),'2027-02-28T00:00:00.000Z');
 assert.throws(()=>anchoredMonthlyEnd(due,0),/Invalid MIT anchor/);
});
test('signed MIT calendar due and end are deterministic, not arrival-order dependent',()=>{
 const event={cycle_due_at:'2027-02-28T15:04:05+00:00',
  period_ends_at:'2027-03-31T15:04:05+00:00',anchor_day:31};
 const now=new Date('2027-03-01T00:00:00Z');
 const {start,end}=validatedAnchoredCycle(event,now);
 assert.equal(start.toISOString(),'2027-02-28T15:04:05.000Z');
 assert.equal(end.toISOString(),'2027-03-31T15:04:05.000Z');
 assert.throws(()=>validatedAnchoredCycle({...event,period_ends_at:'2027-03-28T15:04:05Z'},now),
  /Invalid signed MIT cycle end/);
 assert.throws(()=>validatedAnchoredCycle({...event,cycle_due_at:'2027-04-30T15:04:05Z'},now),
  /Invalid signed MIT cycle start/);
});

test('a malformed/null station-scoped add-on never grants account-wide access',()=>{
 assert.deepEqual(paidRights([paid('ADD-DSP',null)],null,now),[]);
 assert.deepEqual(paidRights([paid('ADD-ADS',null)],null,now),[]);
 assert.deepEqual(paidRights([paid('ADD-AN',SID,{scopeType:'account'})],SID,now),[]);
 assert.deepEqual(paidRights([paid('B-PREM',SID)],SID,now),[]);
 assert.deepEqual(paidRights([paid('B-PREM',null,{scopeType:'station'})],SID,now),[]);
 assert.equal(boostForStation([paid('BOOST-G-DAY',SID,{scopeType:'account'})],SID,now,false).priority,0);
});

const {ADDONS,isConflict,candidateAddons}=require('../services/broadcasterSubscriptionOverlap');
test('existing station addon MIT must not renew in parallel with newly purchased account Premium',()=>{
 for(const sku of ADDONS){
  for(const state of ['active','pending','verification_pending','past_due']){
   assert.equal(isConflict('B-PREM',sku,state),true);
   assert.equal(isConflict(sku,'B-PREM',state),true);
  }
  for(const state of ['none','cancelled','failed','unavailable']){
   assert.equal(isConflict('B-PREM',sku,state),false);
  }
 }
 assert.equal(isConflict('B-PREM','BOOST-G-DAY','active'),false);
});
test('dedupe addon mandate lookup per owned station and SKU',()=>{
 const rows=[{sku:'ADD-DSP',resourceId:SID},{sku:'ADD-DSP',resourceId:SID},
  {sku:'ADD-AN',resourceId:SID},{sku:'B-PREM',resourceId:null},
  {sku:'ADD-DSP',resourceId:'garbage'}];
 assert.deepEqual(candidateAddons(rows),[
  {sku:'ADD-DSP',stationId:SID},{sku:'ADD-AN',stationId:SID}
 ]);
});
