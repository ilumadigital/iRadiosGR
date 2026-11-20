'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('B-PREM does not demand prior manual addon cancellation or call Gateway cancel before payment',()=>{
 const controller=read('controllers/broadcasterBillingController.js');
 const checkout=controller.slice(controller.indexOf('async function checkout(req,res)'),controller.indexOf('async function listOrders'));
 assert.match(checkout,/existingOverlappingMandate\(req\.user,sku\)/);
 assert.doesNotMatch(checkout,/gateway\.cancelBroadcasterRecurring/);
 assert.match(controller,/if\(sku==='B-PREM'\)\{[\s\S]*?return null;\s*\}else if\(ADDONS\.includes\(sku\)\)/);
 const page=fs.readFileSync(path.join(__dirname,'../../frontend/src/pages/BroadcasterCommerce.jsx'),'utf8');
 assert.doesNotMatch(page,/ακύρωσε πρώτα τις/);
 assert.match(page,/Μόνο μετά την επιβεβαίωση της πληρωμής/);
});
test('duplicate paid webhook repairs the same durable Premium cancellation job',()=>{
 const source=read('controllers/broadcasterBillingController.js');
 assert.match(source,/async function schedulePremiumAddonCancellation/);
 assert.match(source,/ensurePaidUpgrade\(order\)/);
 assert.match(source,/event\.event_type==='payment\.paid'\)\s*await schedulePremiumAddonCancellation\(order\)/);
 assert.match(source,/await schedulePremiumAddonCancellation\(updated\)/);
 const server=read('server.js');
 assert.match(server,/broadcasterPremiumUpgradeScheduler'\)\.start\(\)/);
});
test('paid period checks and public projection are production-aware, never trust stage copies',()=>{
 const paid=read('services/broadcasterPurchaseRules.js');
 const proj=read('services/stationBillingProjection.js');
 assert.match(paid,/row\.environment===environment/);
 assert.match(proj,/environment:process\.env\.APP_ENV/);
 assert.match(proj,/grantReadScope\(\)/);
 const recovery=read('utils/broadcasterCheckoutRecoveryScheduler.js');
 assert.match(recovery,/environment:process\.env\.APP_ENV/);
});
