'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {broadcasterBillingEmail,BENEFITS}=
 require('../utils/broadcasterBillingEmailTemplates');
const common={name:'Γιάννης & <test>',stationName:'Radio <Station> & Friends',
 amountCents:4990,periodEndsAt:'2026-12-11T10:30:00Z'};
test('Premium onboarding contains every actual Pro feature and billing management',()=>{
 const email=broadcasterBillingEmail({...common,sku:'B-PREM',amountCents:11900,kind:'welcome'});
 assert.match(email.subject,/Broadcaster Pro/);
 for(const [feature] of BENEFITS)assert.ok(email.html.includes(feature),feature);
 assert.match(email.html,/data-iradios-email="v2"/);
 assert.match(email.html,/backoffice\/billing/);
 assert.match(email.html,/backoffice\/pro-features/);
 assert.match(email.html,/119,00/);
 assert.match(email.html,/μέχρι ακύρωσης/);
 assert.doesNotMatch(email.html,/Γιάννης & <test>/);
 assert.match(email.html,/Γιάννης &amp; &lt;test&gt;/);
});
test('Individual station addon email scopes its recipient and uses recurring terms',()=>{
 const email=broadcasterBillingEmail({...common,sku:'ADD-DSP',kind:'welcome'});
 assert.match(email.html,/Radio &lt;Station&gt; &amp; Friends/);
 assert.match(email.html,/49,90/);
 assert.match(email.html,/Επαναλαμβανόμενη μηνιαία/);
 assert.doesNotMatch(email.html,/ΤΑ PRO ΠΡΟΝΟΜΙΑ ΣΟΥ/);
});
test('Boost confirmation explicitly forbids renewal and describes fixed expiry',()=>{
 const email=broadcasterBillingEmail({...common,sku:'BOOST-G-WEEK',kind:'welcome',amountCents:17900});
 assert.match(email.subject,/Boost/);
 assert.match(email.html,/Εφάπαξ αγορά/);
 assert.match(email.html,/δεν πραγματοποιούνται αυτόματες ανανεώσεις/);
 assert.match(email.html,/179,00/);
 assert.throws(()=>broadcasterBillingEmail({...common,sku:'BOOST-G-WEEK',kind:'renewed'}),/One-off Boost/);
 assert.throws(()=>broadcasterBillingEmail({...common,sku:'BOOST-G-WEEK',kind:'cancelled'}),/One-off Boost/);
});
test('Renewal receipt and cancellation must identify product, amount and paid-through date',()=>{
 const renewal=broadcasterBillingEmail({...common,sku:'ADD-AN',amountCents:790,kind:'renewed'});
 const cancelled=broadcasterBillingEmail({...common,sku:'ADD-ADS',kind:'cancelled',
  cancelledAt:'2026-11-20T12:00:00Z'});
 assert.match(renewal.subject,/μηνιαία ανανέωση/);
 assert.match(renewal.html,/7,90/);
 assert.match(renewal.html,/Πληρωμένη περίοδος έως/);
 assert.match(cancelled.subject,/ακύρωσης/);
 assert.match(cancelled.html,/Δεν θα πραγματοποιηθούν νέες αυτόματες χρεώσεις/);
 assert.match(cancelled.html,/11 Δεκεμβρίου/);
});
test('A declined Nexi MIT charge sends a payment issue notice, never a paid receipt',()=>{
 const email=broadcasterBillingEmail({...common,sku:'ADD-ADS',
  amountCents:2990,kind:'failed'});
 assert.match(email.subject,/αποτυχημένη ανανέωση/);
 assert.match(email.html,/δεν ολοκληρώθηκε/);
 assert.match(email.html,/Δεν ενεργοποιήθηκε νέα πληρωμένη περίοδος/);
 assert.match(email.html,/backoffice\/billing/);
 assert.doesNotMatch(email.html,/Η συνδρομή σου ανανεώθηκε/);
 assert.throws(()=>broadcasterBillingEmail({...common,sku:'BOOST-G-WEEK',kind:'failed'}),
  /One-off Boost/);
});
test('Expiry notifications do not promise loss of manually granted station rights',()=>{
 const expired=broadcasterBillingEmail({...common,sku:'ADD-AN',kind:'expired',amountCents:790});
 assert.match(expired.html,/άλλο ενεργό add-on/);
 assert.match(expired.html,/δωρεάν παραχώρηση/);
 assert.match(expired.html,/Δεν αποτελεί φορολογικό παραστατικό/);
});
