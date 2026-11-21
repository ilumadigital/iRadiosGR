'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const gateway=require('../services/gatewayEnvironment');
const vars=['APP_ENV','IRADIOS_BILLING_ENABLED','IRADIOS_BILLING_SANDBOX_ENABLED',
 'IRADIOS_GATEWAY_ENV','IRADIOS_PRODUCTION_CUTOVER_APPROVED',
 'ILUMA_GATEWAY_STAGING_KEY','ILUMA_GATEWAY_STAGING_SECRET',
 'ILUMA_GATEWAY_PROD_KEY','ILUMA_GATEWAY_PROD_SECRET'];
const stage={ILUMA_GATEWAY_STAGING_KEY:'ilg_'+'c'.repeat(48),
 ILUMA_GATEWAY_STAGING_SECRET:'d'.repeat(64)};
const prod={ILUMA_GATEWAY_PROD_KEY:'ilg_'+'a'.repeat(48),
 ILUMA_GATEWAY_PROD_SECRET:'b'.repeat(64)};
function withEnv(values,fn){
 const before=new Map(vars.map(k=>[k,process.env[k]]));
 try{
  for(const k of vars)delete process.env[k];
  Object.assign(process.env,values);
  fn();
 }finally{
  for(const [k,value] of before){
   if(value===undefined)delete process.env[k];else process.env[k]=value;
  }
 }
}
test('Sandbox never selects the live Gateway tenant even with live credentials',()=>{
 withEnv({APP_ENV:'staging',IRADIOS_GATEWAY_ENV:'production',
  IRADIOS_BILLING_ENABLED:'1',...stage,...prod},()=>{
  assert.equal(gateway.mode(),null);
  assert.equal(gateway.credentials(),null);
 });
});
test('Staging only permits selected staging credentials and no production pair',()=>{
 withEnv({APP_ENV:'staging',IRADIOS_GATEWAY_ENV:'staging',
  IRADIOS_BILLING_ENABLED:'1',...stage},()=>{
  assert.equal(gateway.credentials()?.environment,'staging');
 });
 withEnv({APP_ENV:'staging',IRADIOS_GATEWAY_ENV:'staging',
  IRADIOS_BILLING_ENABLED:'1',...stage,...prod},()=>{
  assert.equal(gateway.credentials(),null);
 });
 withEnv({APP_ENV:'staging',IRADIOS_BILLING_SANDBOX_ENABLED:'1',
  ...stage},()=>assert.equal(gateway.credentials()?.environment,'staging'));
});
test('Live credentials require production APP_ENV and independent cutover approval',()=>{
 withEnv({APP_ENV:'production',IRADIOS_GATEWAY_ENV:'production',
  IRADIOS_BILLING_ENABLED:'1',...prod},()=>assert.equal(gateway.credentials(),null));
 withEnv({APP_ENV:'production',IRADIOS_GATEWAY_ENV:'production',
  IRADIOS_BILLING_ENABLED:'1',IRADIOS_PRODUCTION_CUTOVER_APPROVED:'1',
  ...prod},()=>assert.equal(gateway.credentials()?.environment,'production'));
 withEnv({APP_ENV:'production',IRADIOS_GATEWAY_ENV:'production',
  IRADIOS_BILLING_ENABLED:'1',IRADIOS_PRODUCTION_CUTOVER_APPROVED:'1',
  ...prod,...stage},()=>assert.equal(gateway.credentials(),null));
 withEnv({APP_ENV:'production',IRADIOS_GATEWAY_ENV:'staging',
  IRADIOS_BILLING_ENABLED:'1',...stage},()=>assert.equal(gateway.credentials(),null));
});
