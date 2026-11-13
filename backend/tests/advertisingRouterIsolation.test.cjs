'use strict';
// Regression for 2026-11-13 stage outage: the Advertising v2 routers are mounted
// with app.use('/api', router), BEFORE the anonymous streaming endpoint.
// Any global router.use(protect) on either router returns 401 for all radio.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('Agency and Admin routes are protected without hijacking other /api requests',()=>{
 const routes=source('routes/advertisingCampaignRoutes.js');
 const server=source('server.js');
 assert.match(server,/app\.use\('\/api', require\('\.\/routes\/advertisingCampaignRoutes'\)\)/);
 assert.match(routes,/router\.use\(\['\/advertising','\/admin\/advertising'\],protect,stage\)/);
 assert.doesNotMatch(routes,/router\.use\(\s*protect\b/);
 const declared=[...routes.matchAll(/router\.(?:get|post|patch|put|delete)\('([^']+)'/g)]
  .map(x=>x[1]);
 assert.ok(declared.length>=10,'expected real Agency/Admin routes');
 for(const route of declared)
  assert.ok(route.startsWith('/advertising/')||route.startsWith('/admin/advertising/'),
   'Unprotected advertising route: '+route);
});

test('Shadow/Admin feature gate cannot block public radio and static APIs',()=>{
 const shadow=source('routes/advertisingQualificationRoutes.js');
 const server=source('server.js');
 assert.match(server,/app\.use\('\/api', require\('\.\/routes\/advertisingQualificationRoutes'\)\)/);
 assert.match(shadow,/router\.use\('\/admin\/advertising\/shadow',protect,/);
 assert.match(shadow,/router\.use\('\/admin\/advertising\/shadow',\(req,res,next\)=>/);
 assert.doesNotMatch(shadow,/router\.use\(\s*protect\b/);
 const declared=[...shadow.matchAll(/router\.(?:get|post|patch|put|delete)\('([^']+)'/g)]
  .map(x=>x[1]);
 assert.ok(declared.length>=3);
 assert.ok(declared.every(p=>p.startsWith('/admin/advertising/shadow/')));
 const publicAccess=source('utils/stagePublicAccess.js');
 assert.match(publicAccess,/'\/api\/proxy-stream'/);
 assert.match(server,/app\.get\('\/api\/proxy-stream'/);
});
