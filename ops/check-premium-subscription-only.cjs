'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const premium=fs.readFileSync(path.join(root,'frontend/src/pages/SandboxPremium.jsx'),'utf8');
const billing=fs.readFileSync(path.join(root,'backend/controllers/gatewayBillingController.js'),'utf8');
const ticker=fs.readFileSync(path.join(root,'frontend/src/components/WinbackTicker.jsx'),'utf8');
test('Premium checkout is an explicit affirmative recurring consent action, never a silent page effect',()=>{
 assert.match(premium,/const cardChoice=\{autoRenew:true,/);
 assert.match(premium,/onClick=\{beginCheckout\}/);
 assert.match(premium,/Με το πάτημα «Έναρξη συνδρομής» συμφωνείς/);
 assert.match(premium,/αυτόματη χρέωση/);
 assert.match(premium,/3,99 € κάθε μήνα/);
 assert.match(premium,/Μπορείς να ακυρώσεις οποτεδήποτε/);
 assert.match(premium,/\/profile\?tab=billing/);
 assert.doesNotMatch(premium,/\bsetSaveCard\b|\bsetUseSavedCard\b|\bsetAutoRenew\b/);
 assert.doesNotMatch(premium,/<input[^>]+type="checkbox"/);
});
test('Backend refuses one-off checkout, old CIT options, and missing explicit consent',()=>{
 assert.match(billing,/options\.autoRenew!==true/);
 assert.match(billing,/SUBSCRIPTION_CONSENT_REQUIRED/);
 assert.match(billing,/fields\.some\(k=>!\['autoRenew','winback'\]/);
 assert.match(billing,/const cardChoice=\{saveCard:false,useSavedCard:false,autoRenew:true\}/);
});
test('Wide responsive layout, active subscription state, price and visual-only winback preview',()=>{
 assert.match(premium,/max-w-\[1700px\]/);
 assert.match(premium,/lg:grid-cols-/);
 assert.match(premium,/sm:px-6/);
 assert.match(premium,/Έχεις Premium συνδρομή/);
 assert.match(premium,/winbackPreviewRequested/);
 assert.match(premium,/!previewOnly&&/);
 assert.match(premium,/!canCheckout\|\|busy\|\|!catalogOk/);
 assert.match(premium,/1,99 €/);
 assert.match(premium,/3,99 €/);
 assert.match(ticker,/3,99 €\/μήνα μετά τον πρώτο μήνα, μέχρι να ακυρώσεις/);
});
test('No payment provider brand or OneClick product is displayed in Premium marketing and consent',()=>{
 const display=premium.slice(premium.indexOf('return <main'));
 assert.ok(display.length>2500);
 assert.doesNotMatch(display,/Nexi|OneClick|CIT|εφάπαξ|μεμονωμένη αγορά/);
});
