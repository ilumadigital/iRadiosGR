'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {allowUnfundedReview}=require('../services/advertisingStageQa');
test('QA approval needs explicit staging-only flag and both paid switches OFF',()=>{
 assert.equal(allowUnfundedReview({APP_ENV:'staging',
  AD_STAGE_QA_APPROVAL_ENABLED:'1',AD_DELIVERY_BILLING_ENABLED:'0',
  AD_PAYMENTS_SANDBOX_ENABLED:'0'}),true);
 for(const override of [
  {APP_ENV:'production'},{APP_ENV:'development'},
  {AD_STAGE_QA_APPROVAL_ENABLED:'0'},
  {AD_DELIVERY_BILLING_ENABLED:'1'},{AD_PAYMENTS_SANDBOX_ENABLED:'1'}
 ]){
  const config={APP_ENV:'staging',AD_STAGE_QA_APPROVAL_ENABLED:'1',
   AD_DELIVERY_BILLING_ENABLED:'0',AD_PAYMENTS_SANDBOX_ENABLED:'0',
   ...override};
  assert.equal(allowUnfundedReview(config),false,JSON.stringify(override));
 }
 assert.equal(allowUnfundedReview({}),false);
});
test('staging compose enables only QA approval while disabling Nexi and CPM billing',()=>{
 const root=path.join(__dirname,'../..');
 const compose=fs.readFileSync(path.join(root,'compose.stage.yml'),'utf8');
 const routes=fs.readFileSync(path.join(root,'backend/routes/advertisingCampaignRoutes.js'),'utf8');
 const eligibility=fs.readFileSync(path.join(root,'backend/services/advertisingDeliveryEligibility.js'),'utf8');
 assert.match(compose,/AD_STAGE_QA_APPROVAL_ENABLED: '1'/);
 assert.match(compose,/AD_DELIVERY_BILLING_ENABLED: '0'/);
 // The private backend.env controls the separately gated Nexi sandbox; Docker
 // Compose must not silently override an authorized 1 back to 0.
 assert.doesNotMatch(compose,/^\\s*AD_PAYMENTS_SANDBOX_ENABLED\\s*:/m);
 const envExample=fs.readFileSync(path.join(root,'backend/.env.example'),'utf8');
 assert.match(envExample,/^AD_PAYMENTS_SANDBOX_ENABLED=0$/m);
 assert.match(eligibility,/const ATOMIC_SETTLEMENT_IMPLEMENTED=false/);
 assert.match(routes,/router\.use\(protect,stage\)/);
 assert.match(routes,/if\(!funded&&!allowUnfundedReview\(\)\)/);
 assert.match(routes,/Approve at least one Agency creative first/);
 assert.match(routes,/process\.env\.AD_PAYMENTS_SANDBOX_ENABLED!=='1'/);
});
