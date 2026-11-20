'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const policy=require('../services/advertisingV2Policy');
const {DEFAULTS,validatePricing}=require('../services/advertisingPricingRules');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('v2 rate card has exactly 8 Audio placements and 5 Banner positions',()=>{
 const card=policy.defaultRateCard();
 assert.equal(Object.keys(card.audio).length,8);
 assert.equal(Object.keys(card.visual).length,5);
 assert.equal(policy.matchesRateCardSnapshot(card),true);
 assert.equal(policy.eventReserveNanos('audio','entry',card),1_810_000_000);
 assert.equal(policy.feeNanos('visual','hero','impression',card),8_000_000);
});

test('Admin price changes are validated without changing a prior purchase',()=>{
 const previous=policy.defaultRateCard(),next=policy.defaultRateCard();
 next.audio.entry.listen10=420_000_000;
 next.visual.hero=12_000_000;
 assert.equal(validatePricing({...DEFAULTS,rateCard:next}),true);
 assert.equal(policy.feeNanos('audio','entry','listen10',previous),360_000_000);
 assert.equal(policy.feeNanos('audio','entry','listen10',next),420_000_000);
 assert.equal(policy.eventReserveNanos('audio','entry',previous),1_810_000_000);
 assert.equal(policy.eventReserveNanos('audio','entry',next),1_870_000_000);
 assert.equal(policy.feeNanos('visual','hero','impression',previous),8_000_000);
 assert.equal(policy.feeNanos('visual','hero','impression',next),12_000_000);
});

test('incomplete, floating, negative or unexpected rate cards fail closed',()=>{
 const valid=policy.defaultRateCard();
 assert.equal(policy.matchesRateCardSnapshot({...valid,visual:{hero:1}}),false);
 assert.equal(policy.matchesRateCardSnapshot({...valid,visual:{...valid.visual,bonus:1}}),false);
 for(const bad of [-1,0,1.1,Number.MAX_SAFE_INTEGER+1]){
  const card=policy.defaultRateCard();
  card.audio.entry.listen10=bad;
  assert.equal(policy.matchesRateCardSnapshot(card),false);
  assert.throws(()=>validatePricing({...DEFAULTS,rateCard:card}));
 }
});

test('quoted and settled events use the correct historical lot snapshot',()=>{
 const quote=source('routes/advertisingCampaignRoutes.js');
 const ledger=source('services/advertisingV2Ledger.js');
 assert.match(quote,/V2_RATE_CARD\.rateCardForPricing\(current\)/);
 assert.match(ledger,/eventReserveNanos\(kind,placement,l\.rateCardSnapshot\)/);
 assert.match(ledger,/eventReserveNanos\(kind,placement,lot\.rateCardSnapshot\)/);
 assert.match(ledger,/feeNanos\(ticket\.kind,ticket\.placement,name,lot\.rateCardSnapshot\)/);
});

test('billable audio must have verified server transition and release stalled reservations',()=>{
 const player=fs.readFileSync(path.join(__dirname,'../../frontend/src/App.jsx'),'utf8');
 assert.match(player,/const count=verified\?\.count\|\|stationSwitches\.current\+1/);
 assert.match(player,/\.filter\(ad=>ad\.paidDeliveryRequired!==true\|\|\(verified&&canReceivePaidAds\(\)\)\)/);
 assert.match(player,/releasePaidAudio\(activeAdRef\.current,'failed'\)/);
 assert.match(player,/if\(isDesktopDSPDevice\(\)\)resumeDSP\(\)/);
});
