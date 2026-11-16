'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=filename=>fs.readFileSync(path.join(root,filename),'utf8');
const wizard=read('backend/routes/advertisingWizardRoutes.js');
const campaign=read('backend/routes/advertisingCampaignRoutes.js');
const player=read('frontend/src/App.jsx');
const agency=read('frontend/src/pages/AdvertisingCampaignWizard.jsx');
const admin=read('frontend/src/pages/AdminAdvertisingApprovalCenter.jsx');
const adminRoutes=read('backend/routes/adminRoutes.js');
const policy=read('backend/services/advertisingV2Policy.js');
const routes=read('backend/routes/advertisingV2Routes.js');
const ledger=read('backend/services/advertisingV2Ledger.js');

test('Agency and Admin campaign creation no longer blocks durations outside legacy preset array',()=>{
 assert.doesNotMatch(wizard,/if\(!pricing\.durationDays\.includes\(/);
 assert.doesNotMatch(wizard,/endsAt\.getTime\(\)>now\+366/);
 assert.doesNotMatch(campaign,/end\.getTime\(\)>Date\.now\(\)\+366/);
 assert.doesNotMatch(campaign,/durationDays\.includes\(days\)/);
 assert.match(wizard,/endsAt<=startsAt/);
 assert.match(campaign,/end<=start/);
 assert.match(agency,/datetime-local/);
});
test('Agency Spot Help generates a user-clicked encoded mailto, never transmits mail',()=>{
 assert.match(agency,/mailto:sales@iluma\.gr\?subject=/);
 assert.match(agency,/encodeURIComponent\(subject\)/);
 assert.match(agency,/encodeURIComponent\(message\)/);
 assert.match(agency,/Δεν έχετε έτοιμο ή συμβατό Audio Ad/);
 assert.match(agency,/Ρωτήστε μας/);
 assert.doesNotMatch(agency,/fetch\(['"]mailto:/);
});
test('Approval hub is admin-only with funding guard and rejection reasons',()=>{
 assert.match(adminRoutes,/router\.get\('\/admin\/advertising\/approval-center',\.\.\.admin/);
 assert.match(adminRoutes,/router\.put\('\/admin\/advertising\/creatives\/:kind\/:id\/reject',\.\.\.admin/);
 assert.match(adminRoutes,/reason\.length<3\|\|reason\.length>1000/);
 assert.match(wizard,/source:'nexi_verified'/);
 assert.match(admin,/agency-ad-revisions/);
 assert.match(admin,/creatives-review/);
 assert.match(admin,/Έγκριση/);
 assert.match(admin,/Ιστορικό/);
 assert.match(admin,/reason\.trim\(\)\.length<3/);
});
test('Signed browser-independent transition proof binds each paid switch placement',()=>{
 assert.match(routes,/listenerSessions\.verify\(/);
 assert.match(routes,/transitionProof/);
 assert.match(read('backend/utils/stagePublicAccess.js'),/tickets\|transition\|heartbeat/);
 assert.match(player,/registerStationTransition/);
 assert.match(player,/stationTransitionRef\.current/);
 assert.match(ledger,/paid-v2:break-campaign:/);
 assert.match(ledger,/paid-v2:daily-window:/);
 assert.match(policy,/MAX_BREAK_SPOTS=3/);
 assert.match(policy,/MAX_AUDIO_DURATION_SECONDS=46/);
});
test('Player no longer reinitializes the RDS ticker every advertising second',()=>{
 const mini=read('frontend/src/components/MobileMiniPlayer.jsx');
 const footer=read('frontend/src/components/Footer.jsx');
 assert.doesNotMatch(mini,/miniTickerDetail[\s\S]{0,220}adTimeRemaining/);
 assert.doesNotMatch(footer,/ADVERTISEMENT.*animate-pulse/);
 assert.match(player,/setAdTimeRemaining\(old=>/);
 assert.match(player,/recoverUnplayedSlot\(\)/);
});
