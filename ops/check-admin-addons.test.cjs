'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=rel=>fs.readFileSync(path.join(__dirname,'..',rel),'utf8');

test('Admin addon route and all navigation links exist while preserving grants',()=>{
 const backoffice=read('frontend/src/pages/Backoffice.jsx');
 const users=read('frontend/src/pages/AdminUsers.jsx');
 const addon=read('frontend/src/pages/AdminAddons.jsx');
 const oldGrants=read('frontend/src/pages/AdminBillingGrants.jsx');
 assert.match(backoffice,/id:'addons',name:'Διαχείριση Addons'/);
 assert.match(backoffice,/to:'\/backoffice\/admin\/addons',label:'Διαχείριση Addons'/);
 assert.match(backoffice,/path="\/backoffice\/admin\/addons" element=\{admin\?/);
 assert.match(backoffice,/AdminAddons API_URL="\/api"/);
 assert.match(backoffice,/\/backoffice\/admin\/addons\?stationId=/);
 assert.match(users,/\/backoffice\/admin\/addons\?accountId=/);
 assert.match(addon,/\/admin\/billing\/addons\/resolve-station\?stationId=/);
 assert.match(addon,/\/admin\/billing\/addons\/overview\?accountId=/);
 assert.match(addon,/\/admin\/billing\/grants\/.*\/revoke/);
 assert.match(oldGrants,/function AdminBillingGrants|export default function AdminBillingGrants/);
});
test('Admin overview endpoints are authenticated, read-only and do not change paid orders',()=>{
 const routes=read('backend/routes/billingPhase1Routes.js');
 const start=routes.indexOf("router.get('/admin/billing/addons/overview'");
 const end=routes.indexOf("router.get('/admin/billing/resources",start);
 assert.ok(start>0&&end>start);
 const section=routes.slice(start,end);
 assert.match(section,/\.\.\.admin,safe\(async/);
 assert.match(section,/activeGrantsFor\(user,now\)/);
 assert.match(section,/activeBroadcasterOrders\(user,now\)/);
 assert.match(section,/Station\.find\(\{broadcasterId:accountId\}\)/);
 assert.match(section,/describeStationAddons\(user,station,grants,orders,now\)/);
 assert.match(section,/routeNotPresent|return res\.json\(\{accountId/);
 assert.doesNotMatch(section,/findOneAndUpdate|updateMany|\.create\(|\.deleteOne\(|checkout|Gateway/i);
});
test('Admin grants share the original idempotent billing write and cannot mutate paid access',()=>{
 const ui=read('frontend/src/pages/AdminAddons.jsx');
 const routes=read('backend/routes/billingPhase1Routes.js');
 assert.match(ui,/Idempotency-Key/);
 assert.match(ui,/\/admin\/billing\/grants/);
 assert.match(ui,/resourceId:stationId/);
 assert.match(ui,/selected\.status!=='approved'/);
 assert.match(routes,/router\.post\('\/admin\/billing\/grants',\.\.\.admin/);
 assert.match(routes,/validateComplimentaryScope\(sku,product.scopeType,resourceId\)/);
 assert.match(routes,/Station\.exists\(\{_id:resourceId,broadcasterId:accountId,status:'approved'\}\)/);
 assert.match(routes,/router\.post\('\/admin\/billing\/grants\/:id\/revoke',\.\.\.admin/);
});
