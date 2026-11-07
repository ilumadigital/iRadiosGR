'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
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
  verify(safe.replace('sk_test_disabled_no_payments','sk_live_should_never_be_in_staging'),false,'live Stripe credentials');
  verify(safe.replace('STRIPE_WEBHOOK_SECRET=whsec_disabled','STRIPE_WEBHOOK_SECRET=whsec_live_secret'),false,'live Stripe webhook credentials');
  verify(safe+'STRIPE_SECRET_KEY=sk_test_disabled_no_payments\n',false,'duplicate Stripe setting');
  verify(safe.replace('SMTP_HOST=mailpit','SMTP_HOST=smtp.hostinger.com'),false,'external SMTP service');
  verify(safe+'SMTP_USER=real@example.invalid\n',false,'production SMTP credentials');
  verify(safe.replace('APP_ENV=staging','APP_ENV=production'),false,'wrong app environment');
  verify(safe.replace('STAGE_ENABLE_ACRCLOUD=0','STAGE_ENABLE_ACRCLOUD=maybe'),false,'invalid ACRCloud enablement');
  verify(safe.replace('STAGE_ENABLE_ACRCLOUD=0','STAGE_ENABLE_ACRCLOUD=1'),true,'intentional staging ACRCloud enablement');
  console.log('Staging backend env guard tests passed.');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
