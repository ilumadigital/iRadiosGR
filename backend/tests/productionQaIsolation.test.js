'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {canonicalSignature,verifyWebhookHeaders}=require('../services/gatewayBillingProtocol');
const qa=require('../services/productionQaGateway');
const source=(p)=>fs.readFileSync(path.join(__dirname,p),'utf8');

test('production QA remains disabled when merely given real Gateway keys',()=>{
 const backup={...process.env};
 try{
  process.env.APP_ENV='staging';
  process.env.ILUMA_GATEWAY_PROD_KEY='ilg_'+'a'.repeat(48);
  process.env.ILUMA_GATEWAY_PROD_SECRET='b'.repeat(64);
  process.env.IRADIOS_PROD_QA_LISTENER_ID='c'.repeat(24);
  process.env.IRADIOS_PROD_QA_ENABLED='0';
  assert.equal(qa.configured(),false);
  assert.equal(qa.allowedUser({_id:'c'.repeat(24),role:'user',isVerified:true}),false);
  process.env.IRADIOS_PROD_QA_ENABLED='1';
  assert.equal(qa.configured(),true);
  assert.equal(qa.allowedUser({_id:'c'.repeat(24),role:'user',isVerified:true}),true);
  assert.equal(qa.allowedUser({_id:'c'.repeat(24),role:'admin',isVerified:true}),false);
  assert.equal(qa.allowedUser({_id:'d'.repeat(24),role:'user',isVerified:true}),false);
  assert.equal(qa.allowedUser({_id:'c'.repeat(24),role:'user',isVerified:false}),false);
  process.env.APP_ENV='production';
  assert.equal(qa.configured(),false);
 }finally{
  for(const k of Object.keys(process.env))if(!(k in backup))delete process.env[k];
  Object.assign(process.env,backup);
 }
});
test('QA production webhook is signed for a different exact path',()=>{
 const secret='a'.repeat(64);
 const body=Buffer.from('{"event_id":"'+('b'.repeat(32))+'"}','utf8');
 const timestamp=String(Math.floor(Date.now()/1000)),nonce='c'.repeat(32);
 const path='/api/gateway/production-qa/webhook';
 const headers={
  'x-iluma-timestamp':timestamp,
  'x-iluma-nonce':nonce,
  'x-iluma-event-id':'b'.repeat(32),
  'x-iluma-signature':canonicalSignature(secret,'POST',path,timestamp,nonce,body)
 };
 assert.equal(verifyWebhookHeaders({secret,headers,rawBody:body,path}).valid,true);
 assert.equal(verifyWebhookHeaders({secret,headers,rawBody:body}).valid,false);
 assert.equal(verifyWebhookHeaders({secret,headers,rawBody:body,
  path:'/api/gateway/production-qa/fake'}).valid,false);
});
test('QA checkout cannot run through ordinary billing; one-run persisted and only signed events activate',()=>{
 const sourceCode=source('../controllers/productionQaController.js');
 const ledger=source('../models/ProductionQaOrder.js');
 const server=source('../server.js');
 const stageGuard=source('../utils/stagePublicAccess.js');
 const entitlement=source('../services/billingEntitlements.js');
 assert.match(sourceCode,/confirmedLiveCharge!==true/);
 assert.match(sourceCode,/amountCents!==399/);
 assert.match(sourceCode,/qaRunKey:'iradios-production-qa-single'/);
 assert.match(sourceCode,/QaOrder\.createIndexes\(\)/);
 assert.match(sourceCode,/event\.environment!=='production'/);
 assert.match(sourceCode,/event\.qa_mode!==qa\.MODE/);
 assert.match(sourceCode,/if\(paid\)/);
 assert.match(sourceCode,/verifyWebhookHeaders\(/);
 assert.match(sourceCode,/await QaOrder\.findOne\(filter\)/);
 assert.match(ledger,/qaRunKey:\{type:String,required:true,unique:true/);
 assert.match(server,/app\.post\('\/api\/gateway\/production-qa\/webhook',express\.raw/);
 assert.match(stageGuard,/\/api\/billing\/production-qa\/checkout/);
 assert.match(entitlement,/ProductionQaOrder/);
 assert.doesNotMatch(source('../services/ilumaGatewayClient.js'),/ILUMA_GATEWAY_PROD_KEY/,
  'All ordinary billing retains separate sandbox credentials');
});
