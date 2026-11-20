'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'../../frontend/src',p),'utf8');

test('Premium shows actual renewal execution state, not an unconditional sandbox banner',()=>{
 const src=read('pages/SandboxPremium.jsx');
 assert.doesNotMatch(src,/Δοκιμαστικό περιβάλλον:/);
 assert.doesNotMatch(src,/δοκιμαστική αναμονή/);
 assert.match(src,/recurring\.state==='active'&&!recurring\.execution_enabled/);
});

test('Admin billing uses common history endpoint and environment-aware labels',()=>{
 const src=read('pages/AdminSandboxPayments.jsx');
 assert.match(src,/\/admin\/billing\/orders\?limit=100/);
 assert.doesNotMatch(src,/\/admin\/billing\/sandbox-orders\?/);
 assert.doesNotMatch(src,/Δεν υπάρχουν δοκιμαστικές συναλλαγές με αυτά τα φίλτρα/);
 assert.match(src,/gatewayEnv==='production'/);
 const route=fs.readFileSync(path.join(__dirname,'../routes/billingCheckoutRoutes.js'),'utf8');
 assert.match(route,/router\.use\('\/admin\/billing\/orders',stageBillingOnly\)/);
 assert.match(route,/router\.get\('\/admin\/billing\/orders',protect,authorizeRoles\('admin'\),controller\.listAdminOrders\)/);
});

test('Advertising Wizard uses checkoutReady with legacy alias only for compatibility',()=>{
 const src=read('pages/AdvertisingCampaignWizard.jsx');
 assert.match(src,/pricing\?\.checkoutReady\?\?pricing\?\.sandboxCheckoutReady/);
 assert.doesNotMatch(src,/ILUMA Gateway staging/);
});
