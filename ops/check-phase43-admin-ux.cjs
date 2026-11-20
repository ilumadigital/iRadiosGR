'use strict';
// Offline contract test: does not call external services or modify real data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const backoffice=read('frontend/src/pages/Backoffice.jsx');
const css=read('frontend/src/styles/backoffice-admin.css');
const modules=['AdminDashboard','AdminUsers','AdminAds','AdminBanners',
  'AdminHomeSlides','AdminEmails','AdminPaid','AdminRadioSet',
  'AdminAdControl','Boost','NewPush'];
assert.equal(modules.length,11);
assert.ok(backoffice.includes("import '../styles/backoffice-admin.css'"),
  'private admin stylesheet must be imported only by Backoffice shell');
assert.ok(backoffice.includes('className="ir-admin-workspace"'),
  'admin tools must be isolated from public listener UI');
assert.ok(backoffice.includes("if(data.user.role!=='admin')"),
  'admin tools remain role protected');
assert.ok(backoffice.includes("function AdminGuide({section})"),
  'all admin modules have a contextual getting-started guide');
assert.ok(backoffice.includes("const ADMIN_GUIDES={"),'guide catalog exists');
assert.ok(!backoffice.includes('<audio'),'backoffice must remain player-free');
assert.ok(css.includes('.ir-admin-workspace .admin-legacy-page'),
  'admin CSS must be scoped');
for(const term of ['focus-visible','@media(max-width:768px)','prefers-reduced-motion',
  'overflow-x:auto','max-height:calc(100dvh - 2rem)'])
  assert.ok(css.includes(term),'missing accessible admin stylesheet token '+term);
const paths=modules.map(name=>'frontend/src/pages/'+name+'.jsx');
for(let i=0;i<modules.length;i++){
  const source=read(paths[i]);
  assert.ok(source.includes('admin-legacy-page'),'module not integrated: '+modules[i]);
  assert.ok(backoffice.includes("id:'"+[
    'analytics','users','ads','banners','slides','emails','billing',
    'radioset','adcontrol','boost','push'][i]+"'"),
    'module missing from searchable Admin tool list: '+modules[i]);
}
const analytics=read(paths[0]);
assert.ok(analytics.includes('Όλο το iRadios σε μία εικόνα.'),
  'network analytics must use the rebuilt dashboard');
for(const token of ['admin/dashboard-stats','stats/network','loading','refreshing',
  'role="alert"','Κορυφαίοι σταθμοί','Απόδοση διαφημίσεων','Ενεργές συνεδρίες player']){
  assert.ok(analytics.includes(token),'missing analytics feature '+token);
}
assert.ok(!analytics.includes('Control Center</h2>'),
  'do not ship the duplicate old page header');
const users=read(paths[1]);
assert.ok(users.includes('Καθαρισμός φίλτρων')&&users.includes('bo-legacy-scroll'),
  'users must support clearing and mobile scrolling');
const ads=read(paths[2]);
assert.ok(ads.includes('setLoadError')&&ads.includes('Δεν βρέθηκαν σποτ'),
  'ads must show load errors and empty states');
const banners=read(paths[3]);
assert.ok(banners.includes('Δεν υπάρχουν banners για αυτή την τοποθέτηση'),
  'banners must show empty filtered states');
const billing=read(paths[6]);
assert.ok(billing.includes('Καθαρισμός αναζήτησης'),
  'billing must allow easy reset of search');
const boost=read(paths[9]);
assert.ok(boost.includes('const reorder = (id, toIndex)')&&
  boost.includes('commitPosition')&&boost.includes('chooseScope')&&
  boost.includes('role="switch"'),
  'boost supports scoped position editing, accessible ordering and boost toggles');
const push=read(paths[10]);
assert.ok(push.includes('Προεπισκόπηση ειδοποίησης')&&
  push.includes('window.confirm(')&&push.includes('maxLength={300}'),
  'send preview/confirmation and length checks required');
const workflow=read('.github/workflows/staging-validation.yml');
assert.ok(workflow.includes('node ops/check-phase43-admin-ux.cjs'),
  'run admin UX regression in staging CI');
console.log('Phase 4.3: 11 admin views, scoped responsive design, operational safeguards passed.');
