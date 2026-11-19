'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const gateway=require('../backend/services/gatewayEnvironment');

const keys=['APP_ENV','IRADIOS_GATEWAY_ENV','IRADIOS_BILLING_ENABLED',
 'IRADIOS_BILLING_SANDBOX_ENABLED','IRADIOS_PRODUCTION_CUTOVER_APPROVED',
 'ILUMA_GATEWAY_STAGING_KEY','ILUMA_GATEWAY_STAGING_SECRET',
 'ILUMA_GATEWAY_PROD_KEY','ILUMA_GATEWAY_PROD_SECRET'];
const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
function fixture(values){
 for(const key of keys)delete process.env[key];
 Object.assign(process.env,values);
}
try{
 const stage={APP_ENV:'staging',IRADIOS_GATEWAY_ENV:'staging',
  IRADIOS_BILLING_SANDBOX_ENABLED:'1',ILUMA_GATEWAY_STAGING_KEY:'ilg_'+'a'.repeat(48),
  ILUMA_GATEWAY_STAGING_SECRET:'b'.repeat(64)};
 const prod={APP_ENV:'production',IRADIOS_GATEWAY_ENV:'production',
  IRADIOS_BILLING_ENABLED:'1',IRADIOS_PRODUCTION_CUTOVER_APPROVED:'1',
  ILUMA_GATEWAY_PROD_KEY:'ilg_'+'c'.repeat(48),
  ILUMA_GATEWAY_PROD_SECRET:'d'.repeat(64)};
 fixture(stage);
 assert.equal(gateway.mode(),'staging');
 assert.equal(gateway.credentials()?.environment,'staging');
 fixture({...stage,IRADIOS_GATEWAY_ENV:'production'});
 assert.equal(gateway.mode(),null,'stage can never select production Gateway');
 assert.equal(gateway.credentials(),null);
 fixture({...stage,ILUMA_GATEWAY_PROD_KEY:prod.ILUMA_GATEWAY_PROD_KEY});
 assert.equal(gateway.credentials(),null,'stage must not hold live credentials');
 fixture(prod);
 assert.equal(gateway.credentials()?.environment,'production');
 fixture({...prod,IRADIOS_PRODUCTION_CUTOVER_APPROVED:'0'});
 assert.equal(gateway.credentials(),null,'live checkout must not start before cutover');
 fixture({...prod,IRADIOS_GATEWAY_ENV:'staging'});
 assert.equal(gateway.mode(),null);
 fixture({...prod,ILUMA_GATEWAY_STAGING_SECRET:stage.ILUMA_GATEWAY_STAGING_SECRET});
 assert.equal(gateway.credentials(),null,'production must not hold sandbox credentials');
 fixture({APP_ENV:'production',IRADIOS_GATEWAY_ENV:'production'});
 assert.equal(gateway.configured(),false,'production billing is disabled by default');
} finally {
 for(const key of keys){
  if(previous[key]===undefined)delete process.env[key];
  else process.env[key]=previous[key];
 }
}
const compose=read('compose.prod.yml');
assert.match(compose,/name: iradios_prod/);
assert.match(compose,/iradios_prod_mongo_data/);
assert.match(compose,/127\.0\.0\.1:5611:5011/);
assert.match(compose,/127\.0\.0\.1:5610:80/);
assert.doesNotMatch(compose,/mailpit/i);
assert.match(read('compose.stage.yml'),/mailpit:/);
assert.match(read('ops/deploy-prod.sh'),/data-verified/);
assert.match(read('ops/deploy-prod.sh'),/expected main/);
assert.doesNotMatch(read('ops/deploy-prod.sh'),/down -v|volume prune|docker system prune/);
assert.match(read('backend/services/billingEntitlements.js'),/environment:process\.env\.APP_ENV/);
assert.match(read('backend/models/BillingOrder.js'),/enum:\['staging','production'\]/);
assert.match(read('backend/models/BroadcasterBillingOrder.js'),/enum:\['staging','production'\]/);
assert.match(read('frontend/src/pages/Backoffice.jsx'),/VITE_APP_ENV==='production'/);
assert.match(read('frontend/src/App.jsx'),/path="\/premium" element=\{<SandboxPremium/);
assert.match(read('backend/utils/myMailer.js'),/Production SMTP missing: refusing test-mail fallback/);
assert.match(read('backend/server.js'),/\\['staging','production'\\]\\.includes\\(process\\.env\\.APP_ENV\\)/);
assert.match(read('backend/server.js'),/PRODUCTION_CUTOVER_PENDING/);
assert.match(read('backend/server.js'),/if\\(productionActivated\\(\\)\\)require\\('\\.\\/utils\\/listenerNotificationScheduler'\\)\\.start\\(\\)/);
assert.match(read('backend/server.js'),/if\\(productionActivated\\(\\)\\)await cleanupExpiredItems\\(\\)/);

// Validate private-env boundary without any real credentials.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iradios-prod-test-'));
try{
 const b=path.join(dir,'backend.env'),c=path.join(dir,'compose.env');
 const base=['APP_ENV=production','FRONTEND_URL=https://play.iradios.gr',
  'IRADIOS_GATEWAY_ENV=production','IRADIOS_BILLING_ENABLED=0',
  'IRADIOS_PRODUCTION_CUTOVER_APPROVED=0','PRODUCTION_BILLING_EMAILS_ENABLED=0',
  'SMTP_HOST=smtp.test.invalid','SMTP_USER=app','SMTP_PASS=fake',
  'MAIL_FROM=no-reply@test.invalid'].join('\n')+'\n';
 fs.writeFileSync(c,'PROD_MONGO_PASSWORD=fake-root\nPROD_MONGO_APP_PASSWORD=fake-app\n');
 const run=content=>{
  fs.writeFileSync(b,content,{mode:0o600});
  return spawnSync('python3',[path.join(root,'ops/check-prod-env.py'),b,c],{encoding:'utf8'});
 };
 assert.equal(run(base).status,0,'production preflight should accept a disabled-billing app');
 assert.notEqual(run(base.replace('SMTP_HOST=smtp.test.invalid','SMTP_HOST=mailpit')).status,0);
 assert.notEqual(run(base.replace('FRONTEND_URL=https://play.iradios.gr','FRONTEND_URL=https://stage.iradios.gr')).status,0);
 assert.notEqual(run(base.replace('IRADIOS_GATEWAY_ENV=production','IRADIOS_GATEWAY_ENV=staging')).status,0);
 assert.notEqual(run(base.replace('IRADIOS_BILLING_ENABLED=0','IRADIOS_BILLING_ENABLED=1')).status,0,'prod billing requires approval');
 const approved=base.replace('IRADIOS_BILLING_ENABLED=0','IRADIOS_BILLING_ENABLED=1')
  .replace('IRADIOS_PRODUCTION_CUTOVER_APPROVED=0','IRADIOS_PRODUCTION_CUTOVER_APPROVED=1')
  +'ILUMA_GATEWAY_PROD_KEY=ilg_'+('f'.repeat(48))+'\n'
  +'ILUMA_GATEWAY_PROD_SECRET='+('e'.repeat(64))+'\n';
 assert.equal(run(approved).status,0,'explicit production Gateway credentials should pass');
 assert.notEqual(run(approved+'ILUMA_GATEWAY_STAGING_SECRET='+('a'.repeat(64))+'\n').status,0);
}finally{fs.rmSync(dir,{force:true,recursive:true});}
console.log('Production branch/environment, Mailpit, payments, data gate and UI boundaries: PASS');
