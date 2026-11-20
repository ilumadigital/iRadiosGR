'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {wizardEnabled}=require('../services/advertisingWizardAccess');

const approved={
 APP_ENV:'production',
 IRADIOS_PRODUCTION_CUTOVER_APPROVED:'1',
 IRADIOS_BILLING_ENABLED:'1',
 ADVERTISING_V2_PRODUCTION_APPROVED:'1',
 ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED:'1'
};

test('staging wizard remains available without touching the payment ledger',()=>{
 assert.equal(wizardEnabled({APP_ENV:'staging'},()=>{throw Error('must not run')}),true);
});

test('production wizard never bypasses cutover, billing or paid-ad approval',()=>{
 for(const key of Object.keys(approved).filter(k=>k!=='APP_ENV')){
  const env={...approved,[key]:'0'};
  assert.equal(wizardEnabled(env,()=>{throw Error('must not run')}),false,key);
 }
 assert.equal(wizardEnabled({APP_ENV:'development',...approved,APP_ENV:'development'},()=>true),false);
 assert.equal(wizardEnabled(approved,()=>false),false);
 assert.equal(wizardEnabled(approved,()=>true),true);
});

test('both Agency and Admin wizard route trees use the same production guard',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../routes/advertisingWizardRoutes.js'),'utf8');
 const campaigns=fs.readFileSync(path.join(__dirname,'../routes/advertisingCampaignRoutes.js'),'utf8');
 assert.equal((route.match(/if\(!wizardEnabled\(\)\)/g)||[]).length,3);
 assert.match(route,/router\.use\(prefix,protect/);
 assert.match(route,/req\.user\?\.role!==role/);
 assert.match(campaigns,/const stage=\(req,res,next\)=>wizardEnabled\(\)/);
 assert.doesNotMatch(campaigns,/router\.use\(\s*protect\b/);
});
