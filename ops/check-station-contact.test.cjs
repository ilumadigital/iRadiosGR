'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildStationContactEmail } = require('../backend/utils/stationContactEmail');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('station contact email uses unified branding, sender details and reply instructions', () => {
  const mail = buildStationContactEmail({
    stationName:'Deseo Radio', senderName:'Γιώργος Παπαδόπουλος',
    senderEmail:'user@example.com', message:'Καλησπέρα!\nΩραία μουσική.'
  });
  assert.match(mail.html,/data-iradios-email="v2"/);
  assert.match(mail.html,/Γιώργος Παπαδόπουλος/);
  assert.match(mail.html,/user@example.com/);
  assert.match(mail.html,/Καλησπέρα!<br>Ωραία μουσική/);
  assert.match(mail.subject,/Deseo Radio/);
  assert.match(mail.text,/user@example.com/);
});
test('station name, sender name and message are HTML-escaped', () => {
  const mail = buildStationContactEmail({
    stationName:'<img src=x>', senderName:'<script>x</script>',
    senderEmail:'user@example.com', message:'Γεια <script>alert(1)</script>'
  });
  assert.doesNotMatch(mail.html,/<script>|<img src=x>/);
  assert.match(mail.html,/&lt;script&gt;/);
  assert.match(mail.html,/&lt;img/);
});
test('server authenticates, resolves destination from Station and sets Reply-To', () => {
  const routes=read('backend/routes/stationContactRoutes.js');
  const mailer=read('backend/utils/myMailer.js');
  const stage=read('backend/utils/stagePublicAccess.js');
  assert.match(routes,/router\.post\('\/stations\/:id\/contact', protect/);
  assert.match(routes,/Station\.findOne\(/);
  assert.match(routes,/to:station\.email\.trim\(\),replyTo:senderEmail/);
  assert.match(routes,/reserveQuota/);
  assert.match(mailer,/replyTo,/);
  assert.match(stage,/contact/);
});
test('station profile has no mailto link and login returns to station contact', () => {
  const page=read('frontend/src/pages/StationProfile.jsx');
  const login=read('frontend/src/pages/Login.jsx');
  const modal=read('frontend/src/components/StationContactModal.jsx');
  const styles=read('frontend/src/styles/station-profile.css');
  assert.doesNotMatch(page,/mailto:/);
  assert.match(page,/StationContactModal/);
  assert.match(page,/setContactOpen\(true\)/);
  assert.match(login,/stationReturn/);
  assert.match(modal,/\?contact=1/);
  assert.match(styles,/@media \(min-width:1100px\) and \(max-height:960px\)/);
});
