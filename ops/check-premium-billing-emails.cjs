'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PREMIUM_BENEFITS,premiumBillingEmail}=require('../backend/utils/premiumBillingEmailTemplates');
const {BRAND_MARKER}=require('../backend/utils/emailDesign');
const root=path.resolve(__dirname,'..');
const read=path=>fs.readFileSync(require('node:path').join(root,path),'utf8');
const compare=read('frontend/src/components/PremiumCompare.jsx');
const premium=read('frontend/src/pages/SandboxPremium.jsx');
const api=read('backend/routes/emailPreviewRoutes.js');
const admin=read('frontend/src/pages/AdminEmails.jsx');
const scheduler=read('backend/utils/premiumBillingEmailScheduler.js');
const controller=read('backend/controllers/gatewayBillingController.js');
const model=read('backend/models/BillingEmailDispatch.js');
const server=read('backend/server.js');
const kinds=['welcome','soon','grace','cancelled','expired','winback'];
const base={name:'Δοκιμή <script>alert(1)</script>',amountCents:199,
 periodEndsAt:'2026-12-10T18:20:07.000Z',
 graceEndsAt:'2026-12-13T18:20:07.000Z',
 offerEndsAt:'2027-01-12T18:20:07.000Z',
 unsubscribeLink:'https://stage.iradios.gr/api/notifications/unsubscribe?token=demo'};
for(const kind of kinds){
 const mail=premiumBillingEmail({...base,kind});
 assert.ok(mail.html.startsWith('<!doctype html>'),kind+' must be complete HTML');
 assert.equal(mail.html.split(BRAND_MARKER).length-1,1,kind+' must use existing branded email shell once');
 assert.ok(mail.html.includes('/iradios-app-logo.png'),kind+' must show existing brand logo');
 assert.ok(mail.html.includes('#CCFF00'),kind+' must use iRadios accent');
 assert.ok(mail.html.includes('max-width:600px'),kind+' must be responsive in mobile mail clients');
 assert.ok(mail.html.includes('DISCOVER · LISTEN · CONNECT'),kind+' must include platform footer');
 assert.ok(mail.subject.trim(),kind+' must have subject');
 assert.ok(mail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),kind+' must escape names');
 assert.ok(!mail.html.includes('<script>'),kind+' must not inject HTML');
 assert.ok(mail.text.includes('Διαχείριση συνδρομής:'),kind+' must include plain text fallback');
 assert.ok(api.includes("case 'premium"+kind[0].toUpperCase()+kind.slice(1)+"':"),kind+' admin preview missing');
 assert.ok(admin.includes("id:'premium"+kind[0].toUpperCase()+kind.slice(1)+"'"),kind+' UI preview missing');
}
assert.ok(premiumBillingEmail({...base,kind:'welcome'}).html.includes('1,99'), 'Welcome must show first captured 1.99 amount');
assert.ok(premiumBillingEmail({...base,kind:'welcome',amountCents:399}).html.includes('3,99'),
 'Welcome must show regular first payment 3.99');
for(const {title} of PREMIUM_BENEFITS){
 assert.ok(compare.includes("label:'"+title+"'"), 'PremiumCompare missing email benefit '+title);
 const email=premiumBillingEmail({...base,kind:'welcome'});
 assert.ok(email.html.includes(title),'Welcome onboarding missing Premium benefit '+title);
}
for(const title of ['1Click to Spotify Search','1Click to Apple Music Search']){
 assert.ok(premium.includes(title),'Premium landing benefits missing '+title);
}
const winback=premiumBillingEmail({...base,kind:'winback'});
assert.ok(winback.html.includes('1,99')&&winback.html.includes('3,99'),
 'Promo must disclose both first and recurring monthly prices');
assert.ok(winback.html.includes('μία μόνο φορά')||winback.html.includes('Μία μόνο φορά'),
 'Promo must clearly state one use per account');
assert.ok(winback.html.includes('Διακοπή προωθητικών email'), 'Marketing email must have unsubscribe');
assert.ok(scheduler.includes("canNotify(user,'email','promotions')"),
 'Promotional email must require prior opt-in');
assert.ok(scheduler.includes("gateway.winbackStatus(user)"),
 'Winback must use signed Gateway once-only redemption authority');
assert.ok(scheduler.includes("gateway.recurringStatus(user)"),
 'Winback must avoid overlapping active MIT agreements');
assert.ok(scheduler.includes("status:'paid'")&&scheduler.includes("billingOrigin:'checkout'"),
 'Welcome catch-up must only inspect captured checkout orders');
assert.ok(scheduler.includes("kind==='welcome'")&&scheduler.includes("kind==='cancelled'"),
 'Welcome and cancellation must be validated against financial records');
assert.ok(scheduler.includes("status:'sending'")&&scheduler.includes("status:'sent'"),
 'Email dispatch must atomically claim and persist sent state');
assert.ok(model.includes("status:{type:String,enum:['pending','sending','sent','skipped']"),
 'Persistent billing email ledger required for dedupe');
assert.ok(!model.includes('expires:'),'Financial event idempotency keys must never expire');
assert.ok(controller.includes("premiumEmails.enqueuePaidWelcome(updated)"),
 'Welcome must be triggered only after signed paid webhook persists order');
assert.ok(controller.includes("premiumEmails.enqueueCancellation(req.user,recurring)"),
 'Cancel mail must be emitted only after Gateway confirms cancellation');
assert.ok(server.includes("premiumBillingEmailScheduler').start()"),
 'Staging backend must start independent Premium scheduler');
const stageGuard=scheduler.slice(0,scheduler.indexOf('async function scanBillingWindows'));
assert.ok(stageGuard.includes("process.env.APP_ENV==='staging'"),
 'Scheduler must be stage-only');
console.log('Premium benefits, six branded templates, admin previews, consent, dedupe, and billing hooks validated.');
