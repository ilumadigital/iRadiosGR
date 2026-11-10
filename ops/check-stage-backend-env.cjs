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
  'SMTP_HOST=mailpit',
  'SMTP_PORT=1025',
  'STAGE_ENABLE_SONOVAULT=0'
].join('\n') + '\n';
function verify(content, success, label) {
  fs.writeFileSync(target,content,{mode:0o600});
  const run = spawnSync('bash',[script,target],{encoding:'utf8',timeout:5000});
  assert.equal(run.status, success?0:1,label+': '+String(run.stderr).slice(0,120));
  assert.ok(!run.stdout.includes('ILUMA_GATEWAY_STAGING_SECRET') && !run.stdout.includes('ILUMA_GATEWAY_STAGING_KEY'),label+': no credential output');
}
try {
  verify(safe,true,'safe staging backend env');
  verify(safe.replace('SMTP_HOST=mailpit','SMTP_HOST=smtp.hostinger.com').replace('SMTP_PORT=1025','SMTP_PORT=587')+'SMTP_USER=test@example.invalid\nSMTP_PASS=fake-only\n',true,'staging SMTP environment accepted; Mailpit enforced in app');
  verify(safe.replace('APP_ENV=staging','APP_ENV=production'),false,'wrong app environment');
  verify(safe.replace('STAGE_ENABLE_SONOVAULT=0','STAGE_ENABLE_SONOVAULT=maybe'),false,'invalid SonoVault enablement');
  verify(safe.replace('STAGE_ENABLE_SONOVAULT=0','STAGE_ENABLE_SONOVAULT=1'),true,'intentional staging SonoVault enablement');
  const sandbox=safe+'IRADIOS_BILLING_SANDBOX_ENABLED=1\n'+
    'ILUMA_GATEWAY_STAGING_KEY=ilg_'+('a'.repeat(48))+'\n'+
    'ILUMA_GATEWAY_STAGING_SECRET='+('b'.repeat(64))+'\n';
  verify(sandbox,true,'staging-only Nexi Sandbox credential pair');
  verify(safe+'IRADIOS_BILLING_SANDBOX_ENABLED=1\n',false,'cannot enable Gateway without keys');
  verify(sandbox.replace('ILUMA_GATEWAY_STAGING_SECRET='+('b'.repeat(64)),
    'ILUMA_GATEWAY_STAGING_SECRET=invalid'),false,'bad Gateway HMAC key rejected');
  verify(sandbox+'ILUMA_GATEWAY_PRODUCTION_KEY=ilg_'+('c'.repeat(48))+'\n',
    false,'production Gateway credentials forbidden on staging');
  verify(safe+'IRADIOS_BILLING_SANDBOX_ENABLED=maybe\n',false,'invalid Sandbox flag rejected');
  verify(sandbox+'IRADIOS_BILLING_SANDBOX_ENABLED=0\n',false,'duplicate Sandbox mode rejected');
  // Legacy checkout routes were removed; only the signed Gateway billing path remains.
  const server=readFile('backend/server.js');
  assert.ok(!server.includes("require('./controllers/paymentController')"));
  assert.ok(!server.includes("require('./routes/paymentRoutes')"));
  assert.ok(server.includes('/api/gateway/webhook'));
  assert.ok(!fs.existsSync(path.join(root,'backend/controllers/paymentController.js')));
  assert.ok(!fs.existsSync(path.join(root,'backend/routes/paymentRoutes.js')));
  const mailer=readFile('backend/utils/myMailer.js');
  assert.ok(mailer.includes("if (process.env.APP_ENV === 'staging')"));
  assert.ok(mailer.includes("host: 'mailpit', port: 1025"));
  console.log('Staging backend env guard tests passed.');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
