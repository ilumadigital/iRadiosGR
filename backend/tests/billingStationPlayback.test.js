'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {maskStationPaidControls}=require('../services/stationBillingProjectionRules');
const now=new Date('2026-11-15T12:00:00Z');
const owner={_id:'owner-1',role:'broadcaster',
 broadcasterProfile:{tier:'free',features:{dspEngine:false,adControl:false,analytics:false}}};
const station={_id:'station-1',broadcasterId:'owner-1',dspPreset:'OMNIA',disableNetworkAds:true};
const grant=(sku,options={})=>({
 accountId:'owner-1',sku,
 scopeType:sku==='B-PREM'?'account':'station',
 resourceId:sku==='B-PREM'?null:'station-1',
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
 const otherGrant=grant('ADD-DSP',{resourceId:'station-2'});
 const result=maskStationPaidControls(station,owner,[otherGrant],now);
 assert.equal(result.dspPreset,'OMNIA');
 assert.equal(result.disableNetworkAds,true);
});
