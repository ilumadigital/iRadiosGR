'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('staging Node backend has Athens TZ while financial storage remains untouched',()=>{
 const compose=read('compose.stage.yml');
 const backend=compose.split('\n  backend:\n')[1]?.split('\n  frontend:\n')[0]||'';
 assert.match(backend,/^\s+TZ: Europe\/Athens$/m);
 assert.match(backend,/APP_ENV: staging/);
});
test('official date renderer explicitly pins Athens and unambiguous day-first order',()=>{
 const file=read('frontend/src/utils/dateTime.js');
 assert.match(file,/Europe\/Athens/);
 assert.match(file,/day: '2-digit', month: '2-digit', year: 'numeric'/);
 assert.match(file,/athensWallTimeToIso/);
 assert.match(read('backend/utils/athensDateTime.js'),/timeZone:tz,day:'2-digit'/);
});
test('scheduling, billing and registration UI use the shared Greek date components',()=>{
 for(const p of ['frontend/src/pages/AdvertisingCampaignWizard.jsx',
  'frontend/src/pages/AdminHomeSlides.jsx','frontend/src/pages/CampaignEditor.jsx',
  'frontend/src/pages/Register.jsx','frontend/src/pages/Profile.jsx',
  'frontend/src/pages/AdminBillingGrants.jsx','frontend/src/pages/AdminAddons.jsx']){
  assert.match(read(p),/GreekDateInput/,p);
 }
 const wizard=read('frontend/src/pages/AdvertisingCampaignWizard.jsx');
 assert.match(wizard,/athensWallTimeToIso\(draft.startsAt\)/);
 assert.match(wizard,/athensWallTimeToIso\(draft.endsAt\)/);
 assert.doesNotMatch(wizard,/new Date\(draft.startsAt\)\.toISOString\(\)/);
 assert.match(read('backend/services/scheduler.js'),/athensClock\.formatToParts/);
});
test('do not reintroduce browser-dependent date labels in key finance workflows',()=>{
 for(const p of ['frontend/src/components/ProfileBilling.jsx',
  'frontend/src/pages/BroadcasterBillingDashboard.jsx','frontend/src/pages/AdminAdvertisingV2.jsx',
  'frontend/src/pages/AdminPaid.jsx','frontend/src/pages/AdminSandboxPayments.jsx']){
   const src=read(p);
   assert.match(src,/formatDateTime/,p);
   assert.doesNotMatch(src,/\.toLocaleDateString\('el-GR'/,p);
 }
});
