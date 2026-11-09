'use strict';
// Render all email types without SMTP, MongoDB, network or live recipients.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  BRAND_MARKER, actionButton, infoPanel, ensureBrandedEmail,
  renderBrandedEmail, verifiedHref
} = require('../backend/utils/emailDesign');
const templates = require('../backend/utils/mailTemp');
const {
  broadcasterInvitationEmail, producerInvitationEmail
} = require('../backend/utils/invitationEmailTemplates');
const { notificationEmailTemplate } = require('../backend/utils/notificationEmailTemplate');

const site = process.env.FRONTEND_URL || 'https://iradios.gr';
const cases = [
  ['otp', templates.otpVerificationEmail('Μαρία', '123456')],
  ['welcome', templates.welcomeEmail('Μαρία',false)],
  ['password reset', templates.passwordResetEmail('Μαρία',site+'/login')],
  ['agency payment', templates.adPaymentSuccessEmail('Μαρία','Ad Package','99.00')],
  ['admin payment alert', templates.adminTransactionAlertEmail('Demo Company','99.00','Boost','demo@example.com','agency')],
  ['station approved', templates.stationApprovedEmail('Μαρία','Demo FM','demo-fm')],
  ['station rejected', templates.stationRejectedEmail('Μαρία','Demo FM')],
  ['broadcaster premium', templates.broadcasterPremiumSuccessEmail('Μαρία','full_premium','19.00')],
  ['listener premium', templates.listenerPremiumSuccessEmail('Μαρία','4.99')],
  ['broadcaster invite', broadcasterInvitationEmail({name:'Demo Radio'},site+'/broadcaster-invite?token=demo')],
  ['producer invite', producerInvitationEmail({firstName:'Μαρία',stationName:'Demo Radio',link:site+'/accept-invite?token=demo'})],
  ['notification', {
    subject:'Νέα εκπομπή',
    html:notificationEmailTemplate({topic:'shows',title:'Νέα εκπομπή',body:'Παίζει τώρα',
      link:site+'/station/demo-fm',profileLink:site+'/profile'})
  }],
  ['promotion with unsubscribe', {
    subject:'Προσφορά',
    html:notificationEmailTemplate({topic:'promotions',title:'Προσφορά',body:'Δες την ενημέρωση',
      link:site,profileLink:site+'/profile',
      unsubscribeLink:site+'/api/notifications/unsubscribe?token=example'})
  }],
  ['custom admin', {subject:'Test',html:templates.customAdminEmail('<h3>Message</h3><p>Hello</p>')}]
];
for (const [name, output] of cases) {
  assert.ok(output.html.startsWith('<!doctype html>'),name+' must be complete email HTML');
  assert.equal(output.html.split(BRAND_MARKER).length-1,1,name+' must be branded exactly once');
  assert.ok(output.html.includes('/iradios-app-logo.png'),name+' needs platform logo');
  assert.ok(output.html.includes('width="100%"'),name+' must have responsive table shell');
  assert.ok(output.html.includes('font-family:'),name+' must style type');
  assert.ok(output.html.includes('max-width:600px'),name+' must be mobile friendly');
  assert.ok(output.html.includes('CCFF00'),name+' must reflect brand accent');
  assert.ok(!output.html.includes('@import'),name+' must not depend on external font CSS');
  assert.ok(output.html.includes('DISCOVER · LISTEN · CONNECT'),name+' must include footer brand');
}
assert.ok(cases.find(x=>x[0]==='otp')[1].html.includes('123456'),'OTP must remain visible');
assert.ok(cases.find(x=>x[0]==='password reset')[1].html.includes('/login'),'password reset CTA retained');
assert.ok(cases.find(x=>x[0]==='promotion with unsubscribe')[1].html.includes('Διακοπή προωθητικών email'),'email opt-out retained');
assert.ok(cases.find(x=>x[0]==='broadcaster invite')[1].html.includes('Αποδοχή πρόσκλησης'),'invitation CTA visible');

const invitationLink = site + '/broadcaster-invite?token=test-invite-secret';
const richInvite = broadcasterInvitationEmail({name:'Test & Radio'},invitationLink);
assert.equal(richInvite.html.split(invitationLink).length - 1, 3,
  'broadcaster invite repeats the personal acceptance link in three HTML CTAs');
assert.equal(richInvite.text.split(invitationLink).length - 1, 3,
  'plain-text fallback repeats the personal acceptance link three times');
for (const feature of ['Εβδομαδιαίο πρόγραμμα', 'Boost', 'Audio Engine', 'Live Analytics',
                       'Web Player', 'παραγωγούς', '7 ημέρες']) {
  assert.ok(richInvite.html.includes(feature), 'invitation guide missing ' + feature);
}
assert.ok(richInvite.html.includes('Test &amp; Radio'), 'station name is HTML-escaped');

const logoInvite = broadcasterInvitationEmail({
  name: 'Demo <FM>', logo: '/media/radioassets/demo/logo.png'
}, invitationLink);
assert.ok(logoInvite.html.includes('src="' + site + '/media/radioassets/demo/logo.png"'),
  'broadcaster invite renders an absolute station logo in the assignment card');
assert.ok(logoInvite.html.includes('object-fit:contain'), 'logo must preserve its aspect ratio');
assert.ok(logoInvite.html.includes('Demo &lt;FM&gt;'), 'logo alt and name must be escaped');
assert.equal(logoInvite.html.split(invitationLink).length - 1, 3,
  'station artwork must not interfere with the three invite CTAs');
const unsafeLogoInvite = broadcasterInvitationEmail({
  name: 'Demo FM', logo: 'javascript:alert(1)'
}, invitationLink);
assert.ok(!unsafeLogoInvite.html.includes('javascript:alert(1)'),
  'unsafe station logo URL must be omitted from email HTML');


const once=renderBrandedEmail({content:'<p>hello</p>'});
assert.equal(ensureBrandedEmail(once, {category:'test'}),once,'never double-wrap an already branded email');
assert.ok(ensureBrandedEmail('<p>hello</p>').includes(BRAND_MARKER),'ad-hoc emails must become branded');
assert.equal(verifiedHref('javascript:alert(1)'),'#','block unsafe CTA URLs');
assert.equal(actionButton('Bad','javascript:alert(1)'),'','block unsafe CTA buttons');
assert.ok(infoPanel('STATION','Demo FM').includes('Demo FM'));
assert.ok(!broadcasterInvitationEmail({name:'<img src=x onerror=alert(1)>'},site).html.includes('<img src=x onerror'),
  'untrusted station names must be HTML-escaped');
assert.ok(producerInvitationEmail({
  firstName:'<b>bad</b>',stationName:'Demo',link:site
}).html.includes('&lt;b&gt;bad&lt;/b&gt;'),'untrusted names must be escaped');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const mailer=read('backend/utils/myMailer.js');
const api=read('backend/routes/emailPreviewRoutes.js');
const admin=read('frontend/src/pages/AdminEmails.jsx');
const broadcaster=read('backend/routes/broadcasterInvitationRoutes.js');
const producer=read('backend/routes/backofficeRoutes.js');
assert.ok(mailer.includes('ensureBrandedEmail(htmlSource'),'all outbound email must use same shell');
assert.ok(api.includes("protect, authorizeRoles('admin')"),'preview endpoint admin-only');
assert.ok(api.includes("case 'custom':"),'custom mail preview exists');
assert.ok(admin.includes('srcDoc={previewHtml}') && admin.includes('sandbox=""'),
 'real email HTML preview must be isolated in an iframe');
assert.ok(admin.includes('previewDevice') && admin.includes('Email Design Preview'),
 'preview must support responsive modes');
assert.ok(broadcaster.includes("require('../utils/invitationEmailTemplates')"),
 'broadcaster invites use the same previewable template');
assert.ok(producer.includes("producerInvitationEmail({"),
 'producer invites use the same previewable template');
console.log(cases.length+' branded email variants passed layout, links, logo and security checks.');
