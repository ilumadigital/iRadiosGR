'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {effectiveRights,projectUserEntitlements}=require('../services/billingEntitlementRules');
const NOW=new Date('2026-11-15T12:00:00Z');
const account={_id:'account-1',role:'broadcaster',
 broadcasterProfile:{tier:'free',maxStations:3,features:{dspEngine:false,analytics:false,adControl:false}}};
const grant=(sku,scopeType='account',resourceId=null)=>({
  accountId:'account-1',sku,scopeType,resourceId,source:'admin_complimentary',
  startsAt:new Date('2026-11-10T00:00:00Z'),expiresAt:null,revokedAt:null
});
test('Active gifted Broadcaster Premium includes all account-level rights, no user mutation',()=>{
  const orig=JSON.parse(JSON.stringify(account));
  const rights=effectiveRights(account,[grant('B-PREM')],{now:NOW});
  for(const key of ['broadcaster.unlimited_stations','broadcaster.webdsp','broadcaster.analytics','broadcaster.ad_control','broadcaster.premium_boost'])
    assert.ok(rights.includes(key));
  const projected=projectUserEntitlements(account,rights);
  assert.equal(projected.broadcasterProfile.tier,'premium');
  assert.equal(projected.broadcasterProfile.features.dspEngine,true);
  assert.equal(projected.billingAutomaticRenewalsAvailable,false);
  assert.deepEqual(account,orig);
});
test('Station-specific gift does not expand account tier or leak into other stations',()=>{
  const grants=[grant('ADD-DSP','station','station-1')];
  const stationOne=effectiveRights(account,grants,{stationId:'station-1',now:NOW});
  const stationTwo=effectiveRights(account,grants,{stationId:'station-2',now:NOW});
  const accountRights=effectiveRights(account,grants,{now:NOW});
  assert.ok(stationOne.includes('broadcaster.webdsp'));
  assert.ok(!stationTwo.includes('broadcaster.webdsp'));
  assert.ok(!accountRights.includes('broadcaster.webdsp'));
  const view=projectUserEntitlements(account,accountRights);
  assert.equal(view.broadcasterProfile.features.dspEngine,false);
  assert.equal(view.broadcasterProfile.tier,'free');
});
test('Complimentary benefits are isolated between accounts',()=>{
  const a=grant('B-PREM');
  const stranger={...account,_id:'account-2'};
  assert.deepEqual(effectiveRights(stranger,[a],{now:NOW}),[]);
});
test('Expiry and revocation remove gifted rights and never re-enable legacy Broadcaster Premium',()=>{
  const legacy={...account,broadcasterProfile:{tier:'premium',features:{dspEngine:false,analytics:false,adControl:false}}};
  assert.deepEqual(effectiveRights(legacy,[],{now:NOW}),[]);
  const expired={...grant('ADD-DSP','station','station-1'),expiresAt:new Date('2026-11-14T00:00:00Z')};
  const revoked={...grant('ADD-ADS','station','station-1'),revokedAt:new Date('2026-11-13T00:00:00Z')};
  assert.deepEqual(effectiveRights(account,[expired,revoked],{stationId:'station-1',now:NOW}),[]);
  assert.deepEqual(effectiveRights(legacy,[expired,revoked],{now:NOW}),[]);
});
test('Listener grant projects premium to response only, no synthetic payment subscription',()=>{
  const listener={_id:'u-1',role:'user',isPremium:false,activeSubscriptions:[],subscriptionStatus:null};
  const g={...grant('L-PREM'),accountId:'u-1'};
  const rights=effectiveRights(listener,[g],{now:NOW});
  const view=projectUserEntitlements(listener,rights);
  assert.equal(view.isPremium,true);
  assert.deepEqual(view.activeSubscriptions,[]);
  assert.equal(listener.isPremium,false);
  assert.equal(view.billingAutomaticRenewalsAvailable,false);
});
test('Old manual station flags have no entitlement authority after migration',()=>{
  const user={...account,broadcasterProfile:{tier:'free',features:{analytics:true}}};
  assert.deepEqual(effectiveRights(user,[],{now:NOW}),[]);
  assert.equal(projectUserEntitlements(user,[]).broadcasterProfile.features.analytics,false);
});
test('Agency gifts are scoped to one campaign only',()=>{
  const agency={_id:'agency-1',role:'agency'};
  const g={...grant('AG-NEWS','campaign','campaign-1'),accountId:'agency-1'};
  assert.ok(effectiveRights(agency,[g],{campaignId:'campaign-1',now:NOW}).includes('agency.campaign.news_grid'));
  assert.ok(!effectiveRights(agency,[g],{campaignId:'campaign-2',now:NOW}).includes('agency.campaign.news_grid'));
});
