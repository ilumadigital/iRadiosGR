'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {effectiveRights,listenerCompatibilityRights,projectUserEntitlements}=
 require('../services/billingEntitlementRules');
const now=new Date('2026-11-11T16:00:00Z');
const ownerId='507f1f77bcf86cd799438001';
const stationId='507f1f77bcf86cd799439011';
const otherStationId='507f1f77bcf86cd799439012';
const legacy={_id:ownerId,role:'broadcaster',isPremium:true,
 broadcasterProfile:{tier:'premium',maxStations:999,
  features:{dspEngine:true,analytics:true,adControl:true}}};
const grant=(sku,resourceId=stationId,extra={})=>({
 accountId:ownerId,sku,scopeType:sku==='B-PREM'?'account':'station',
 resourceId:sku==='B-PREM'?null:resourceId,
 source:'admin_complimentary',startsAt:new Date('2026-11-01'),
 expiresAt:null,revokedAt:null,...extra
});
test('All historical Broadcaster flags/tier/isPremium are ignored by billing resolver',()=>{
 assert.deepEqual(effectiveRights(legacy,[],{stationId,now}),[]);
 assert.deepEqual(listenerCompatibilityRights(legacy),[]);
 assert.deepEqual(effectiveRights(legacy,[grant('ADD-DSP',otherStationId)],{stationId,now}),[]);
});
test('New station-scoped grants work only for owning station while old flags remain ignored',()=>{
 const clean={...legacy,broadcasterProfile:{tier:'free',features:{}}};
 assert.deepEqual(effectiveRights(clean,[grant('ADD-DSP')],{stationId,now}),
  ['broadcaster.webdsp']);
 assert.deepEqual(effectiveRights(clean,[grant('ADD-DSP')],{stationId:otherStationId,now}),[]);
 assert.deepEqual(effectiveRights(clean,[grant('ADD-DSP',{expiresAt:new Date('2026-11-01')})],
  {stationId,now}),[]);
 assert.deepEqual(effectiveRights(legacy,[grant('ADD-AN')],{stationId,now}),
  ['broadcaster.analytics']);
});
test('Only new account Premium grants unlock Broadcaster-wide capabilities',()=>{
 const rights=effectiveRights(legacy,[grant('B-PREM')],{now});
 assert.ok(rights.includes('broadcaster.webdsp'));
 assert.ok(rights.includes('broadcaster.analytics'));
 assert.ok(rights.includes('broadcaster.ad_control'));
 assert.ok(rights.includes('broadcaster.unlimited_stations'));
});
test('The broadcaster self API must never project legacy Premium or features as active',()=>{
 const projected=projectUserEntitlements(legacy,[]);
 assert.equal(projected.isPremium,false);
 assert.equal(projected.broadcasterProfile.tier,'free');
 assert.equal(projected.broadcasterProfile.maxStations,3);
 assert.equal(projected.broadcasterProfile.features.dspEngine,false);
 assert.equal(projected.broadcasterProfile.features.analytics,false);
 assert.equal(projected.broadcasterProfile.features.adControl,false);
});
test('New paid entitlement projection overrides historical flag state without changing saved user',()=>{
 const orig=JSON.stringify(legacy);
 const p=projectUserEntitlements(legacy,['broadcaster.webdsp','broadcaster.unlimited_stations']);
 assert.equal(p.broadcasterProfile.tier,'premium');
 assert.equal(p.broadcasterProfile.features.dspEngine,true);
 assert.equal(p.broadcasterProfile.features.analytics,false);
 assert.equal(JSON.stringify(legacy),orig);
});
test('Unrelated Listener migration remains separate from Broadcaster migration',()=>{
 const listener={_id:ownerId,role:'user',isPremium:true};
 assert.deepEqual(listenerCompatibilityRights(listener),['listener.premium']);
 assert.deepEqual(effectiveRights(listener,[],{now}),['listener.premium']);
});
