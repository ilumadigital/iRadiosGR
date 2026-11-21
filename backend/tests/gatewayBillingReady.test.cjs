'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const exe=path.join(__dirname,'../scripts/checkGatewayBillingReady.cjs');
const controlled=['APP_ENV','IRADIOS_GATEWAY_ENV','IRADIOS_BILLING_ENABLED',
 'IRADIOS_BILLING_SANDBOX_ENABLED','IRADIOS_PRODUCTION_CUTOVER_APPROVED',
 'ILUMA_GATEWAY_STAGING_KEY','ILUMA_GATEWAY_STAGING_SECRET',
 'ILUMA_GATEWAY_PROD_KEY','ILUMA_GATEWAY_PROD_SECRET'];
const input=Object.fromEntries(Object.entries(process.env).filter(([k])=>!controlled.includes(k)));
const staging={APP_ENV:'staging',IRADIOS_GATEWAY_ENV:'staging',
 IRADIOS_BILLING_ENABLED:'1',ILUMA_GATEWAY_STAGING_KEY:'ilg_'+'a'.repeat(48),
 ILUMA_GATEWAY_STAGING_SECRET:'b'.repeat(64)};
const production={APP_ENV:'production',IRADIOS_GATEWAY_ENV:'production',
 IRADIOS_BILLING_ENABLED:'1',IRADIOS_PRODUCTION_CUTOVER_APPROVED:'1',
 ILUMA_GATEWAY_PROD_KEY:'ilg_'+'c'.repeat(48),
 ILUMA_GATEWAY_PROD_SECRET:'d'.repeat(64)};
function run(values){return spawnSync(process.execPath,[exe],
 {env:{...input,...values},encoding:'utf8'});}
test('Sandbox billing readiness reports enabled route without secrets',()=>{
 const r=run(staging);
 assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/GATEWAY_KEYS_CONFIGURED: PASS/);
 assert.doesNotMatch(r.stdout,/ilg_|b{64}|[A-Fa-f0-9]{64}/);
});
test('Production reports disabled billing even if basic ENV syntax is valid',()=>{
 const r=run({...production,IRADIOS_BILLING_ENABLED:'0'});
 assert.equal(r.status,1);
 assert.match(r.stdout,/BILLING_ENABLED: NOT_READY/);
});
test('Production cannot charge without explicit cutover approval',()=>{
 assert.equal(run({...production,IRADIOS_PRODUCTION_CUTOVER_APPROVED:'0'}).status,1);
 assert.equal(run(production).status,0);
});
test('Mixed tenant keys fail closed',()=>{
 assert.equal(run({...staging,...production,APP_ENV:'staging'}).status,1);
});
