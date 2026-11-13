'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {paidPlacementPreviewEnabled,creativeTiers,affordablePaidPreview}=
 require('../services/advertisingStagePaidPreview');
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const env={APP_ENV:'staging',AD_STAGE_PAID_PLACEMENT_PREVIEW:'1',
 AD_DELIVERY_BILLING_ENABLED:'0'};
const lot=({remainingNanos=8000000,source='nexi_verified',ratesMicros}={})=>({
 source, budgetNanos:10000000,remainingNanos,settledEvents:[],
 ratesMicros:ratesMicros||{standard:3000000,hero:5000000,audio:4000000}
});
test('staging paid preview is explicit and never enables billable delivery',()=>{
 assert.equal(paidPlacementPreviewEnabled(env),true);
 for(const override of [
  {APP_ENV:'production'},{APP_ENV:'development'},
  {AD_STAGE_PAID_PLACEMENT_PREVIEW:'0'},
  {AD_DELIVERY_BILLING_ENABLED:'1'}
 ])assert.equal(paidPlacementPreviewEnabled({...env,...override}),false);
 assert.equal(paidPlacementPreviewEnabled({}),false);
 const compose=fs.readFileSync(path.join(__dirname,'../../compose.stage.yml'),'utf8');
 assert.match(compose,/AD_STAGE_PAID_PLACEMENT_PREVIEW: '1'/);
 assert.match(compose,/AD_DELIVERY_BILLING_ENABLED: '0'/);
});
test('funded preview only accepts ledger-backed, affordable tiers',()=>{
 assert.deepEqual(creativeTiers({placement:['hero','home']}),['hero','standard']);
 assert.deepEqual(creativeTiers({audioUrl:'/media/audio/u/spot.mp3'}),['audio']);
 assert.equal(affordablePaidPreview([lot()],{placement:['hero','home']}),true);
 assert.equal(affordablePaidPreview([lot({remainingNanos:3500000})],{placement:['hero','home']}),false);
 assert.equal(affordablePaidPreview([lot({remainingNanos:3500000})],{placement:['home']}),true);
 assert.equal(affordablePaidPreview([lot({remainingNanos:0})],{placement:['home']}),false);
 assert.equal(affordablePaidPreview([],{placement:['home']}),false);
 assert.equal(affordablePaidPreview([lot({source:'admin_complimentary'})],{placement:['home']}),false);
 assert.equal(affordablePaidPreview([lot({ratesMicros:{standard:0,hero:0,audio:0}})],{placement:['home']}),false);
});
test('stage QA does not loosen production or create billable impressions',()=>{
 const eligibility=source('services/advertisingDeliveryEligibility.js');
 const ad=source('controllers/adController.js');
 const banner=source('controllers/bannerController.js');
 assert.match(eligibility,/ATOMIC_SETTLEMENT_IMPLEMENTED=false/);
 assert.match(eligibility,/paidPlacementPreviewEnabled\(\)/);
 assert.match(eligibility,/source:'nexi_verified'/);
 assert.match(eligibility,/approvalStatus:'approved'/);
 assert.match(ad,/if\(!live\(ad\)\|\|ad\.campaignId\)return res\.status\(404\)/);
 assert.match(banner,/if\(!live\(banner\)\|\|banner\.campaignId\)return res\.status\(404\)/);
});
