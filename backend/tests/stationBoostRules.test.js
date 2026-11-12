'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {effectiveStationBoost}=require('../services/stationBoostRules');
const {maskStationPaidControls}=require('../services/stationBillingProjectionRules');

const now=new Date('2026-11-12T12:00:00.000Z');
const organic={tier:'organic',placement:null,endsAt:null,priority:0};
const active={_id:'a',boostStatus:true,boostExpiresAt:new Date('2026-11-13T12:00:00.000Z')};
const expired={...active,boostExpiresAt:new Date('2026-11-11T12:00:00.000Z')};

test('valid explicit 24h Admin Boost authorizes a distinct manual global placement',()=>{
  const result=effectiveStationBoost(organic,active,now);
  assert.equal(result.tier,'manual');
  assert.equal(result.placement,'global');
  assert.equal(result.endsAt,'2026-11-13T12:00:00.000Z');
  assert.equal(result.manualActive,true);
});

test('expired, unbounded, and disabled legacy flags do not unlock Sponsored',()=>{
  for(const station of [expired,{...active,boostExpiresAt:null},
    {...active,boostExpiresAt:'not-a-date'},{...active,boostStatus:false}]){
    const result=effectiveStationBoost(organic,station,now);
    assert.equal(result.tier,'organic');
    assert.equal(result.manualActive,false);
  }
});

test('verified paid Boost wins over simultaneous Admin manual flag and remains immutable',()=>{
  const paid={tier:'purchased',placement:'targeted',priority:200,
    endsAt:'2026-11-13T16:00:00Z'};
  const input=structuredClone(paid);
  const result=effectiveStationBoost(paid,active,now);
  assert.equal(result.tier,'purchased');
  assert.equal(result.placement,'targeted');
  assert.equal(result.manualActive,true);
  assert.equal(result.manualEndsAt,'2026-11-13T12:00:00.000Z');
  assert.deepEqual(paid,input,'Never overwrite paid order projection');
});

test('manual boost is still valid after purchased period ends, without extending payment',()=>{
  const paid={tier:'organic',placement:null,endsAt:null,priority:0};
  assert.equal(effectiveStationBoost(paid,active,now).tier,'manual');
  assert.equal(effectiveStationBoost(paid,expired,now).tier,'organic');
});

test('Premium and manual remain distinguishable without inventing paid purchases',()=>{
  const premium={tier:'premium',placement:'eligible',endsAt:null,priority:100};
  const result=effectiveStationBoost(premium,active,now);
  assert.equal(result.tier,'manual');
  assert.equal(result.premiumIncluded,true);
  assert.equal(effectiveStationBoost(premium,expired,now).tier,'premium');
});

test('manual boost is visible even without Broadcaster owner, but never unlocks paid DSP',()=>{
  const result=maskStationPaidControls(active,null,[],now,[]);
  assert.equal(result.commercialBoost.tier,'manual');
  assert.equal(result.dspPreset,'OFF');
  assert.equal(result.widgetMusicLinksEnabled,false);
  assert.equal(result.disableNetworkAds,false);
});
