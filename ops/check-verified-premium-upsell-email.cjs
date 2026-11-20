'use strict';
// No SMTP, Mongo, private credentials or network calls.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {verifiedListenerWelcomeEmail,welcomeEmail}=require('../backend/utils/mailTemp');
const {BRAND_MARKER,escapeHtml}=require('../backend/utils/emailDesign');
const {PREMIUM_BENEFITS}=require('../backend/utils/premiumBillingEmailTemplates');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const promo=verifiedListenerWelcomeEmail('Δοκιμή <script>alert(1)</script>',{
 promotePremium:true,
 unsubscribeLink:'https://stage.iradios.gr/api/notifications/unsubscribe?token=preview-only'
});
const basic=verifiedListenerWelcomeEmail('Δοκιμή',{promotePremium:false});
for(const [name,mail] of [['promo',promo],['basic',basic]]){
 assert.ok(mail.html.startsWith('<!doctype html>'),name+' must be complete email');
 assert.equal(mail.html.split(BRAND_MARKER).length-1,1,name+' branded once');
 assert.ok(mail.html.includes('/iradios-app-logo.png'),name+' uses current iRadios logo');
 assert.ok(mail.html.includes('max-width:600px'),name+' uses responsive email template');
 assert.ok(mail.html.includes('#CCFF00'),name+' uses neon iRadios color');
 assert.match(mail.subject,/email σου επιβεβαιώθηκε/);
 assert.ok(mail.html.includes('Ο λογαριασμός σου επιβεβαιώθηκε με επιτυχία!'));
 assert.ok(mail.html.includes('playlists των σταθμών'),'Confirmed Free listener playlist feature');
 assert.ok(mail.html.includes('ΜΠΕΣ ΣΤΟ IRADIOS'),'Free account access CTA must always be visible');
 assert.ok(mail.text.includes('Ο λογαριασμός σου επιβεβαιώθηκε'));
 assert.ok(!mail.html.includes('<script>'),'No HTML injection');
}
assert.ok(promo.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert.ok(promo.html.includes('Το Free είναι μόνο η αρχή'),'Strong but factual upgrade positioning');
assert.ok(promo.html.includes('ΑΝΑΒΑΘΜΙΣΗ ΣΕ PREMIUM'),'Prominent conversion CTA');
assert.ok(promo.html.includes('3,99 €'),'Exact regular Premium monthly price');
assert.ok(promo.html.includes('ΦΠΑ 24%'),'VAT disclosed');
assert.ok(promo.html.includes('Η συνδρομή ανανεώνεται αυτόματα'),'Recurring payment consent disclosed');
assert.ok(promo.html.includes('Ακύρωση όποτε θέλεις'),'Cancellation disclosed');
assert.ok(promo.html.includes('/premium'),'Upgrade CTA points to Premium page');
assert.ok(promo.html.includes('Διακοπή προωθητικών emails'),'Marketing unsubscribe link');
assert.ok(promo.html.indexOf('Ο λογαριασμός σου επιβεβαιώθηκε')<
 promo.html.indexOf('ΑΝΑΒΑΘΜΙΣΗ ΣΕ PREMIUM'),'Verification is presented before upgrade');
assert.ok(!basic.html.includes('ΑΝΑΒΑΘΜΙΣΗ ΣΕ PREMIUM'),'No purchase CTA without opt-in');
assert.ok(!basic.html.includes('3,99 €'),'No commercial price without opt-in');
assert.ok(!basic.html.includes('Διακοπή προωθητικών emails'),'No unsubscribe needed for basic confirmation');
for(const {title,description} of PREMIUM_BENEFITS){
 const compare=read('frontend/src/components/PremiumCompare.jsx');
 assert.ok(compare.includes("label:'"+title+"'"),'Benefit must come from /premium: '+title);
 assert.ok(promo.html.includes(escapeHtml(title)),'Premium CTA must list feature: '+title);
 assert.ok(promo.html.includes(escapeHtml(description)),'Upsell must detail feature: '+title);
}
assert.ok(promo.html.includes('1Click to Spotify Search'));
assert.ok(promo.html.includes('1Click to Apple Music Search'));
assert.ok(!promo.html.includes('1,99 €'),'Only normal new Premium purchase, never the winback deal');
assert.ok(welcomeEmail('Δοκιμή',true).html.includes('καταχωρήσεις τον σταθμό'),
 'Legacy Broadcaster OTP welcome remains unchanged');

const controller=read('backend/controllers/authController.js');
const preview=read('backend/routes/emailPreviewRoutes.js');
const admin=read('frontend/src/pages/AdminEmails.jsx');
assert.ok(controller.includes("canNotify(user,'email','promotions')"),'Explicit marketing preference controls upsell');
assert.ok(controller.includes("user.isPremium!==true"),'Already Premium user must not get upgrade CTA');
assert.ok(controller.includes("verifiedListenerEmailForUser(user)"),'Email-link verification sends updated welcome');
assert.ok(controller.includes("user.role==='user'")&&controller.includes("verifiedListenerEmailForUser(user)"),
 'Listener OTP verification uses same welcome, others unchanged');
assert.ok(controller.includes("role:'user',isVerified:false"),'Only unverified listener can consume token');
assert.ok(controller.includes('verificationTokenHash:hashEmailVerificationToken(token)'),
 'Verified mail never sent twice on token replay');
for(const type of ['verifiedListenerPremium','verifiedListenerBasic']){
 assert.ok(preview.includes("case '"+type+"':"),'Admin-only preview route: '+type);
 assert.ok(admin.includes("id:'"+type+"'"),'Admin UI preview: '+type);
}
assert.ok(preview.includes("protect, authorizeRoles('admin')"),'Preview requires admin auth');
console.log('Verified-account welcome and full opt-in Premium upsell passed: features, CTA, pricing, consent, escaping and previews.');
