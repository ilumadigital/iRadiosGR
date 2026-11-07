'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const readFile = name => fs.readFileSync(path.join(root, name),'utf8');
const script = path.join(root, 'ops/check-stage-backend-env.sh');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iradios-stage-env-test-'));
const target = path.join(tmp, 'backend.env');
const safe = [
  'APP_ENV=staging',
  'STRIPE_SECRET_KEY=sk_test_disabled_no_payments',
  'STRIPE_WEBHOOK_SECRET=whsec_disabled',
  'SMTP_HOST=mailpit',
  'SMTP_PORT=1025',
  'STAGE_ENABLE_ACRCLOUD=0'
].join('\n') + '\n';
function verify(content, success, label) {
  fs.writeFileSync(target,content,{mode:0o600});
  const run = spawnSync('bash',[script,target],{encoding:'utf8',timeout:5000});
  assert.equal(run.status, success?0:1,label+': '+String(run.stderr).slice(0,120));
  assert.ok(!run.stdout.includes('sk_test_')&&!run.stdout.includes('whsec_'),label+': do not print credentials');
}
try {
  verify(safe,true,'safe staging backend env');
  // Existing production-style values are acceptable in the isolated staging env:
  // runtime billing is disabled and must not initialize the Stripe SDK.
  verify(safe.replace('sk_test_disabled_no_payments','sk_live_fictitious_value_for_test'),true,'live-prefixed Stripe config is accepted');
  verify(safe.replace('STRIPE_WEBHOOK_SECRET=whsec_disabled','STRIPE_WEBHOOK_SECRET=whsec_fictitious_value'),true,'existing webhook secret accepted');
  verify(safe.replace('SMTP_HOST=mailpit','SMTP_HOST=smtp.hostinger.com').replace('SMTP_PORT=1025','SMTP_PORT=587')+'SMTP_USER=test@example.invalid\nSMTP_PASS=fake-only\n',true,'existing real-style SMTP settings allowed but Mailpit enforced in app');
  verify(safe.replace('STRIPE_SECRET_KEY=sk_test_disabled_no_payments','STRIPE_SECRET_KEY=invalid-format'),false,'malformed Stripe secret rejected');
  verify(safe.replace('STRIPE_WEBHOOK_SECRET=whsec_disabled','STRIPE_WEBHOOK_SECRET='),false,'empty webhook secret rejected');
  verify(safe+'STRIPE_SECRET_KEY=sk_test_disabled_no_payments\n',false,'duplicate Stripe setting');
  verify(safe.replace('APP_ENV=staging','APP_ENV=production'),false,'wrong app environment');
  verify(safe.replace('STAGE_ENABLE_ACRCLOUD=0','STAGE_ENABLE_ACRCLOUD=maybe'),false,'invalid ACRCloud enablement');
  verify(safe.replace('STAGE_ENABLE_ACRCLOUD=0','STAGE_ENABLE_ACRCLOUD=1'),true,'intentional staging ACRCloud enablement');
  // Prevent regression: SDK initialization must be conditional on not staging.
  const controller=readFile('backend/controllers/paymentController.js');
  assert.match(controller,/process\.env\.APP_ENV\s*===\s*'staging'\s*\?\s*null\s*:\s*require\('stripe'\)/);
  const server=readFile('backend/server.js');
  assert.ok(server.includes('/^\\/api\\/payments(?:\\/|$)/'), 'payment endpoints must be disabled in staging');
  const mailer=readFile('backend/utils/myMailer.js');
  assert.ok(mailer.includes("if (process.env.APP_ENV === 'staging')"));
  assert.ok(mailer.includes("host: 'mailpit', port: 1025"));
  console.log('Staging backend env guard tests passed.');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
