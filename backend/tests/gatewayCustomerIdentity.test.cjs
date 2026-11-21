'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {accountIdFromExternal,isAllowedExternal}=require('../services/gatewayCustomerIdentity');
const ID='a'.repeat(24);
function inMode(mode,fn){
 const previous={APP_ENV:process.env.APP_ENV,IRADIOS_GATEWAY_ENV:process.env.IRADIOS_GATEWAY_ENV};
 try{
  process.env.APP_ENV=mode;
  process.env.IRADIOS_GATEWAY_ENV=mode;
  fn();
 }finally{
  for(const [key,value] of Object.entries(previous)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
}
test('Sandbox tenant accepts only stage IDs',()=>{
 inMode('staging',()=>{
  assert.equal(accountIdFromExternal('iradios-stage-'+ID),ID);
  assert.equal(accountIdFromExternal('iradios-play-'+ID),null);
  assert.equal(isAllowedExternal('iradios-play-'+ID),false);
  assert.equal(accountIdFromExternal('iradios-stage-'+ID+';production'),null);
  assert.equal(accountIdFromExternal('iradios-stage-'+ID.toUpperCase()),null);
 });
});
test('Live tenant accepts historical stage and new play refs but no arbitrary ref',()=>{
 inMode('production',()=>{
  assert.equal(accountIdFromExternal('iradios-stage-'+ID),ID);
  assert.equal(accountIdFromExternal('iradios-play-'+ID),ID);
  assert.equal(accountIdFromExternal('iradios-prod-'+ID),null);
  assert.equal(accountIdFromExternal('iradios-play-'+ID+'a'),null);
 });
});
test('Misconfigured application/Gateway tenant refuses external IDs',()=>{
 const saved=process.env.APP_ENV,prev=process.env.IRADIOS_GATEWAY_ENV;
 try{
  process.env.APP_ENV='staging';
  process.env.IRADIOS_GATEWAY_ENV='production';
  assert.equal(accountIdFromExternal('iradios-stage-'+ID),null);
 }finally{
  if(saved===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=saved;
  if(prev===undefined)delete process.env.IRADIOS_GATEWAY_ENV;else process.env.IRADIOS_GATEWAY_ENV=prev;
 }
});
