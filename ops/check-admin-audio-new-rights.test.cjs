'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('Admin receives independent full-page audio navigation, not a subscription toggle',()=>{
 const bo=read('frontend/src/pages/Backoffice.jsx');
 const app=read('frontend/src/App.jsx');
 assert.match(bo,/id:'audio',name:'Ρύθμιση Ήχου'/);
 assert.match(bo,/to:'\/backoffice\/admin\/audio',label:'Ρύθμιση Ήχου'/);
 assert.match(bo,/path="\/backoffice\/admin\/audio" element=\{admin\?/);
 assert.match(bo,/<BroadcasterDSP API_URL="\/api" currentUser=\{data\.user\}/);
 assert.match(bo,/\/backoffice\/admin\/audio\?station=/);
 assert.match(app,/<Navigate to="\/backoffice\/admin\/audio" replace \/>/);
 assert.match(bo,/path="\/backoffice\/audio".*BroadcasterToolGate entitlement="broadcaster\.webdsp"/);
 const dsp=read('frontend/src/pages/DSP.jsx');
 assert.match(dsp,/currentUser\?\.role==='admin'/);
 assert.match(dsp,/stations\/dsp-access/);
 assert.ok(dsp.includes("API_URL+'/stations/'+station._id+'/dsp'"));
});
test('No legacy broadcaster rights or historical user permission switch is authoritative',()=>{
 const rules=read('backend/services/billingEntitlementRules.js');
 const billing=read('backend/services/billingEntitlements.js');
 const users=read('frontend/src/pages/AdminUsers.jsx');
 const controller=read('backend/controllers/adminController.js');
 const overview=read('backend/services/adminAddonOverview.js');
 assert.doesNotMatch(rules,/function legacyRights|LEGACY_FEATURES|broadcasterProfile\?\.tier==='premium'/);
 assert.match(rules,/listenerCompatibilityRights/);
 assert.doesNotMatch(billing,/legacyRights/);
 assert.doesNotMatch(overview,/legacy_manual|legacy_premium/);
 assert.doesNotMatch(users,/Station Pro Plan|Unlocked Modules/);
 assert.match(users,/Διαχείριση Addons ανά σταθμό/);
 assert.match(controller,/broadcasterProfile\.features\.dspEngine'\]:false|'broadcasterProfile\.features\.dspEngine':false/);
 assert.match(controller,/broadcasterProfile\.maxStations':3/);
});
test('Unassigned and unsubscribed stations have DSP muted in public output but not deleted',()=>{
 const rules=read('backend/services/stationBillingProjectionRules.js');
 const projector=read('backend/services/stationBillingProjection.js');
 assert.match(rules,/if\(!owner\|\|owner\.role!=='broadcaster'\)return zeroPaidFx\(\)/);
 assert.match(rules,/if\(!rights\.has\('broadcaster\.webdsp'\)\)/);
 assert.doesNotMatch(rules,/if\(!relevant && !relevantPaid\)return data/);
 assert.match(projector,/if\(!ids\.length\)return stations\.map\(s=>maskStationPaidControls/);
});
