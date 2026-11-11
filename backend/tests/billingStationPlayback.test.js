'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {maskStationPaidControls}=require('../services/stationBillingProjectionRules');
const now=new Date('2026-11-15T12:00:00Z');
const stationId='507f1f77bcf86cd799439011';
const otherId='507f191e810c19729de860ea';
const owner={_id:'owner-1',role:'broadcaster',
 broadcasterProfile:{tier:'free',features:{dspEngine:false,adControl:false,analytics:false}}};
const settings={bass:3,mid:2,treble:1,output:-1,stereoWidth:125};
const defaults={bass:0,mid:0,treble:0,output:0,stereoWidth:100};
const manualCompressor={mode:'manual',threshold:-21,ratio:2.6,attack:.04,release:.35,makeup:1.5};
const station={_id:stationId,broadcasterId:'owner-1',dspPreset:'OMNIA',
 dspSettings:settings,dspCompressor:manualCompressor,disableNetworkAds:true};
const grant=(sku,options={})=>({
 accountId:'owner-1',sku,scopeType:sku==='B-PREM'?'account':'station',
 resourceId:sku==='B-PREM'?null:stationId,
 source:'admin_complimentary',
 startsAt:new Date('2026-11-10T00:00:00Z'),expiresAt:null,revokedAt:null,
 ...options
});
const paidOrder=(sku,id=stationId,extra={})=>({
 accountId:'owner-1',sku,resourceId:sku==='B-PREM'?null:id,
 scopeType:sku==='B-PREM'?'account':'station',environment:'staging',
 status:'paid',periodStartsAt:new Date('2026-11-10T00:00:00Z'),
 periodEndsAt:new Date('2026-12-10T00:00:00Z'),...extra
});
const render=(grants=[],orders=[],user=owner,radio=station)=>
 maskStationPaidControls(radio,user,grants,now,orders);
test('Admin-authored DSP stays in DB but never applies publicly without new rights',()=>{
 const original=JSON.stringify(station);
 const output=render();
 assert.equal(output.dspPreset,'OFF');
 assert.deepEqual(output.dspSettings,defaults);
 assert.equal(output.dspCompressor.mode,'off');
 assert.equal(output.disableNetworkAds,false);
 assert.equal(JSON.stringify(station),original);
});
test('Revoked, expired, other-station grant or irrelevant paid boost never unlock saved DSP',()=>{
 for(const grants of [
  [grant('ADD-DSP',{revokedAt:now})],
  [grant('ADD-DSP',{expiresAt:new Date('2026-11-14T00:00:00Z')})],
  [grant('ADD-DSP',{resourceId:otherId})]
 ])assert.equal(render(grants).dspPreset,'OFF');
 assert.equal(render([],[paidOrder('BOOST-G-DAY')]).dspPreset,'OFF');
 assert.equal(render([],[paidOrder('ADD-DSP',otherId)]).dspPreset,'OFF');
});
test('New active DSP station grant unlocks saved sound but not Ad Control',()=>{
 const data=render([grant('ADD-DSP')]);
 assert.equal(data.dspPreset,'OMNIA');
 assert.deepEqual(data.dspSettings,settings);
 assert.deepEqual(data.dspCompressor,manualCompressor);
 assert.equal(data.disableNetworkAds,false);
});
test('New active Ad Control grants only opt-out, not DSP',()=>{
 const data=render([grant('ADD-ADS')]);
 assert.equal(data.dspPreset,'OFF');
 assert.equal(data.disableNetworkAds,true);
});
test('Revoked Ad Control restores ads without touching stored settings',()=>{
 const data=render([grant('ADD-ADS',{revokedAt:now})]);
 assert.equal(data.disableNetworkAds,false);
 assert.deepEqual(station.dspSettings,settings);
});
test('Account Broadcaster Premium grant unlocks both DSP and Ad Control',()=>{
 const data=render([grant('B-PREM')]);
 assert.equal(data.dspPreset,'OMNIA');
 assert.equal(data.disableNetworkAds,true);
});
test('Expired account Premium grant cannot unlock DSP or network ad controls',()=>{
 const data=render([grant('B-PREM',{expiresAt:new Date('2026-11-14T00:00:00Z')})]);
 assert.equal(data.dspPreset,'OFF');
 assert.equal(data.disableNetworkAds,false);
});
test('Historical manual Premium and feature flags never restore access',()=>{
 const legacy={...owner,broadcasterProfile:{tier:'premium',
  features:{dspEngine:true,adControl:true,analytics:true}}};
 const data=render([],[],legacy);
 assert.equal(data.dspPreset,'OFF');
 assert.equal(data.disableNetworkAds,false);
});
test('An active paid station DSP addon applies only to the purchased station',()=>{
 assert.equal(render([],[paidOrder('ADD-DSP')]).dspPreset,'OMNIA');
 assert.equal(render([],[paidOrder('ADD-DSP',stationId)],owner,
  {...station,_id:otherId}).dspPreset,'OFF');
});
test('Expired paid DSP order leaves saved controls in Mongo, masked in playback',()=>{
 const data=render([],[paidOrder('ADD-DSP',stationId,{
  periodEndsAt:new Date('2026-11-14T00:00:00Z')
 })]);
 assert.equal(data.dspPreset,'OFF');
 assert.equal(data.dspCompressor.mode,'off');
 assert.deepEqual(station.dspSettings,settings);
 assert.deepEqual(station.dspCompressor,manualCompressor);
});
test('Active paid Premium grants DSP, ad control and boost only on selected station',()=>{
 const premium={...owner,broadcasterProfile:{tier:'free',
  premiumBoostStationIds:[stationId],features:{}}};
 const data=render([],[paidOrder('B-PREM')],premium);
 assert.equal(data.dspPreset,'OMNIA');
 assert.equal(data.disableNetworkAds,true);
 assert.equal(data.commercialBoost.priority,100);
 assert.equal(render([],[paidOrder('B-PREM')],premium,{...station,_id:otherId})
  .commercialBoost.priority,0);
});
test('Unowned and Admin-owned stations have stored sound but cannot apply unbilled public DSP',()=>{
 for(const noOwner of [null,{_id:'admin-1',role:'admin'}]){
  const projected=render([],[],noOwner,{...station,broadcasterId:noOwner?noOwner._id:null});
  assert.equal(projected.dspPreset,'OFF');
  assert.deepEqual(projected.dspSettings,defaults);
  assert.equal(projected.disableNetworkAds,false);
 }
});
