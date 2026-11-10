'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {maskStationPaidControls}=require('../services/stationBillingProjectionRules');
const now=new Date('2026-11-15T12:00:00Z');
const owner={_id:'owner-1',role:'broadcaster',
 broadcasterProfile:{tier:'free',features:{dspEngine:false,adControl:false,analytics:false}}};
const station={_id:'507f1f77bcf86cd799439011',broadcasterId:'owner-1',dspPreset:'OMNIA',disableNetworkAds:true};
const grant=(sku,options={})=>({
 accountId:'owner-1',sku,
 scopeType:sku==='B-PREM'?'account':'station',
 resourceId:sku==='B-PREM'?null:'507f1f77bcf86cd799439011',
 source:'admin_complimentary',
 startsAt:new Date('2026-11-10T00:00:00Z'),expiresAt:null,revokedAt:null,
 ...options
});
test('Legacy manually assigned station preset survives without grant history',()=>{
 const copy={...station};
 const output=maskStationPaidControls(station,owner,[],now);
 assert.equal(output.dspPreset,'OMNIA');
 assert.equal(output.disableNetworkAds,true);
 assert.deepEqual(station,copy);
});
test('Active station-scoped gifts permit only the included features',()=>{
 const output=maskStationPaidControls(station,owner,[grant('ADD-DSP')],now);
 assert.equal(output.dspPreset,'OMNIA');
 assert.equal(output.disableNetworkAds,false);
});
test('Expired gifted WebDSP is disabled in public playback, preset saved in database',()=>{
 const output=maskStationPaidControls(station,owner,[grant('ADD-DSP',
  {expiresAt:new Date('2026-11-14T00:00:00Z')})],now);
 assert.equal(output.dspPreset,'OFF');
 assert.equal(station.dspPreset,'OMNIA');
 assert.equal(output.disableNetworkAds,false);
});
test('Revoked Ad Control enables network ads again without destroying stored settings',()=>{
 const result=maskStationPaidControls(station,owner,[grant('ADD-ADS',
  {revokedAt:new Date('2026-11-14T00:00:00Z')})],now);
 assert.equal(result.disableNetworkAds,false);
 assert.equal(station.disableNetworkAds,true);
});
test('Expired broadcaster account Premium masks both paid station controls',()=>{
 const result=maskStationPaidControls(station,owner,[grant('B-PREM',
  {expiresAt:new Date('2026-11-14T00:00:00Z')})],now);
 assert.equal(result.dspPreset,'OFF');
 assert.equal(result.disableNetworkAds,false);
});
test('Legacy manual Premium continues despite an expired gift',()=>{
 const manual={...owner,broadcasterProfile:{tier:'premium',features:{}}};
 const result=maskStationPaidControls(station,manual,[grant('B-PREM',
  {expiresAt:new Date('2026-11-14T00:00:00Z')})],now);
 assert.equal(result.dspPreset,'OMNIA');
 assert.equal(result.disableNetworkAds,true);
});
test('Unrelated station grant cannot mask another stations settings',()=>{
 const otherGrant=grant('ADD-DSP',{resourceId:'507f191e810c19729de860ea'});
 const result=maskStationPaidControls(station,owner,[otherGrant],now);
 assert.equal(result.dspPreset,'OMNIA');
 assert.equal(result.disableNetworkAds,true);
});

const paidOrder=(sku,id='507f1f77bcf86cd799439011',extra={})=>({
 accountId:'owner-1',sku,resourceId:sku==='B-PREM'?null:id,
 scopeType:sku==='B-PREM'?'account':'station',environment:'staging',
 status:'paid',periodStartsAt:new Date('2026-11-10T00:00:00Z'),
 periodEndsAt:new Date('2026-12-10T00:00:00Z'),...extra
});
test('One-off Boost must not disable unrelated legacy DSP and Ad Control presets',()=>{
 const actual=maskStationPaidControls(station,owner,[],now,[paidOrder('BOOST-G-DAY')]);
 assert.equal(actual.dspPreset,'OMNIA');
 assert.equal(actual.disableNetworkAds,true);
 assert.equal(actual.commercialBoost.priority,200);
});
test('Purchased add-on for station A never disables legacy presets for station B',()=>{
 const other={...station,_id:'507f191e810c19729de860ea'};
 const actual=maskStationPaidControls(other,owner,[],now,[paidOrder('ADD-DSP')]);
 assert.equal(actual.dspPreset,'OMNIA');
 assert.equal(actual.disableNetworkAds,true);
});
test('Expired DSP paid order masks its original station without deleting the preset',()=>{
 const actual=maskStationPaidControls(station,owner,[],now,[
  paidOrder('ADD-DSP','507f1f77bcf86cd799439011',{periodEndsAt:new Date('2026-11-14T00:00:00Z')})
 ]);
 assert.equal(actual.dspPreset,'OFF');
 assert.equal(actual.disableNetworkAds,false);
 assert.equal(station.dspPreset,'OMNIA');
});
test('Premium boost requires explicit station selection',()=>{
 const premium={...owner,broadcasterProfile:{tier:'premium',
  premiumBoostStationIds:['507f1f77bcf86cd799439011'],features:{}}};
 const current=maskStationPaidControls(station,premium,[],now,[]);
 assert.equal(current.commercialBoost.priority,100);
 const other=maskStationPaidControls({...station,_id:'507f191e810c19729de860ea'},premium,[],now,[]);
 assert.equal(other.commercialBoost.priority,0);
});
