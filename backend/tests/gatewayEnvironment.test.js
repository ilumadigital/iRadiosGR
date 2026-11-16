'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const gateway=require('../services/gatewayEnvironment');
function withEnv(vars,fn){
 const old={...process.env};
 try{for(const key of ['APP_ENV','IRADIOS_BILLING_ENABLED','IRADIOS_BILLING_SANDBOX_ENABLED',
   'IRADIOS_GATEWAY_ENV','ILUMA_GATEWAY_STAGING_KEY','ILUMA_GATEWAY_STAGING_SECRET',
   'ILUMA_GATEWAY_PROD_KEY','ILUMA_GATEWAY_PROD_SECRET'])delete process.env[key];
 Object.assign(process.env,vars);fn();}
 finally {for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];
 Object.assign(process.env,old);}
}
const prod={ILUMA_GATEWAY_PROD_KEY:'ilg_'+'a'.repeat(48),ILUMA_GATEWAY_PROD_SECRET:'b'.repeat(64)};
const stage={ILUMA_GATEWAY_STAGING_KEY:'ilg_'+'c'.repeat(48),ILUMA_GATEWAY_STAGING_SECRET:'d'.repeat(64)};
test('payment tenant is independent from stage app',()=>{
 withEnv({APP_ENV:'staging',IRADIOS_BILLING_ENABLED:'1',IRADIOS_GATEWAY_ENV:'production',...prod,...stage},()=>{
 assert.equal(gateway.credentials().environment,'production');
 assert.equal(gateway.credentials().key,prod.ILUMA_GATEWAY_PROD_KEY);
 });
});
test('production keys without explicit activation cannot charge',()=>{
 withEnv({APP_ENV:'staging',IRADIOS_GATEWAY_ENV:'production',...prod},()=>assert.equal(gateway.configured(),false));
 withEnv({APP_ENV:'production',IRADIOS_BILLING_ENABLED:'1',IRADIOS_GATEWAY_ENV:'production',...prod},()=>assert.equal(gateway.configured(),false));
 withEnv({APP_ENV:'staging',IRADIOS_BILLING_ENABLED:'1',IRADIOS_GATEWAY_ENV:'production',...stage},()=>assert.equal(gateway.configured(),false));
});
test('existing sandbox installs and selected staging credentials still work',()=>{
 withEnv({APP_ENV:'staging',IRADIOS_BILLING_SANDBOX_ENABLED:'1',...stage},()=>assert.equal(gateway.credentials().environment,'staging'));
 withEnv({APP_ENV:'staging',IRADIOS_BILLING_ENABLED:'1',IRADIOS_GATEWAY_ENV:'staging',...stage,...prod},()=>assert.equal(gateway.credentials().environment,'staging'));
 withEnv({APP_ENV:'staging',IRADIOS_BILLING_ENABLED:'1',IRADIOS_GATEWAY_ENV:'oops',...prod},()=>assert.equal(gateway.configured(),false));
});
