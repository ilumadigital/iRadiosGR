'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {maskStationPaidControls}=require('../services/stationBillingProjectionRules');

const SID='507f1f77bcf86cd799439011';
const OTHER='507f191e810c19729de860ea';
const now=new Date('2026-11-11T12:00:00Z');
const owner={_id:'owner-1',role:'broadcaster',broadcasterProfile:{tier:'free',premiumBoostStationIds:[SID],features:{}}};
const station={_id:SID,broadcasterId:'owner-1',position:50,rankings:[]};
const paid=(sku,extra={})=>({
  accountId:'owner-1',sku,resourceId:sku==='B-PREM'?null:SID,
  scopeType:sku==='B-PREM'?'account':'station',
  status:'paid',environment:'staging',
  periodStartsAt:new Date('2026-10-01T12:00:00Z'),
  periodEndsAt:new Date('2026-11-10T12:00:00Z'),...extra
});
const project=(orders=[],grants=[],radio=station,user=owner)=>
  maskStationPaidControls(radio,user,grants,now,orders);
test('Expired purchased targeted/global Boost leaves only a deterministic organic 1-4 slot reward',()=>{
  const targeted=project([paid('BOOST-T-WEEK')]);
  const repeated=project([paid('BOOST-T-WEEK')]);
  assert.equal(targeted.commercialBoost.tier,'organic');
  assert.equal(targeted.commercialBoost.priority,0);
  assert.equal(targeted.commercialBoost.postBoost.placement,'targeted');
  assert.ok(targeted.commercialBoost.postBoost.positions>=1&&
    targeted.commercialBoost.postBoost.positions<=4);
  assert.deepEqual(targeted.commercialBoost.postBoost,repeated.commercialBoost.postBoost);
  assert.equal(station.position,50,'editorial position must never change');
  assert.deepEqual(station.rankings,[]);
  assert.equal(project([paid('BOOST-G-MONTH')]).commercialBoost.postBoost.placement,'global');
  assert.equal(project([paid('BOOST-T-DAY'),paid('BOOST-G-WEEK')]).commercialBoost.postBoost.placement,'global');
});
test('No residual advantage for pending, canceled, wrong station/account or future period',()=>{
  assert.equal(project([paid('BOOST-G-DAY',{status:'pending'})]).commercialBoost.postBoost,undefined);
  assert.equal(project([paid('BOOST-G-DAY',{status:'canceled'})]).commercialBoost.postBoost,undefined);
  assert.equal(project([paid('BOOST-G-DAY',{resourceId:OTHER})]).commercialBoost.postBoost,undefined);
  assert.equal(project([paid('BOOST-G-DAY',{accountId:'intruder'})]).commercialBoost.postBoost,undefined);
  assert.equal(project([paid('BOOST-G-DAY',{environment:'production'})]).commercialBoost.postBoost,undefined);
  assert.equal(project([paid('BOOST-G-DAY',{periodStartsAt:new Date('2026-12-01'),periodEndsAt:new Date('2026-12-02')})]).commercialBoost.postBoost,undefined);
  assert.equal(project([]).commercialBoost.postBoost,undefined);
});
test('Expired paid Premium Boost rewards only explicitly selected station',()=>{
  const current=project([paid('B-PREM')]);
  assert.equal(current.commercialBoost.tier,'organic');
  assert.equal(current.commercialBoost.postBoost.placement,'global');
  assert.equal(project([paid('B-PREM')],[],{...station,_id:OTHER}).commercialBoost.postBoost,undefined);
  assert.equal(project([paid('B-PREM')],[],station,{...owner,broadcasterProfile:{tier:'free',premiumBoostStationIds:[]}}).commercialBoost.postBoost,undefined);
});
test('Expired nonrevoked complimentary Premium and active paid access are independent',()=>{
  const gift={accountId:'owner-1',sku:'B-PREM',scopeType:'account',resourceId:null,
    startsAt:new Date('2026-10-01'),expiresAt:new Date('2026-11-10'),revokedAt:null};
  assert.equal(project([], [gift]).commercialBoost.postBoost.placement,'global');
  assert.equal(project([], [{...gift,revokedAt:new Date('2026-11-09')}]).commercialBoost.postBoost,undefined);
  const current=project([paid('BOOST-G-DAY',{periodEndsAt:new Date('2026-12-01')})]);
  assert.equal(current.commercialBoost.priority,200);
  assert.equal(current.commercialBoost.postBoost,undefined);
  const concurrent=project([paid('BOOST-T-DAY'),
    paid('BOOST-G-MONTH',{periodEndsAt:new Date('2026-12-01')})]);
  assert.equal(concurrent.commercialBoost.priority,200);
  assert.equal(concurrent.commercialBoost.postBoost.placement,'targeted');
});
