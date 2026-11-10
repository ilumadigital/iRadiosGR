'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const {canonicalSignature}=require('../backend/services/gatewayBillingProtocol');

const secret='a'.repeat(64),account='b'.repeat(24),another='c'.repeat(24);
const paymentId='d'.repeat(32),orderId='IL'+'E'.repeat(24);
const paidBefore=new Date(Date.now()-5*24*60*60*1000);
const initial={
 _id:'f'.repeat(24),accountId:account,sku:'L-PREM',status:'paid',
 environment:'staging',autoRenewRequested:true,
 periodEndsAt:paidBefore
};
let renewed=null,nonces=new Set(),findUserId=null,upsertCount=0;
const BillingOrder={
 findOne(q){
  const row=q.autoRenewRequested===true||q.$or?initial:null;
  const obj={lean:async()=>row,select:()=>obj,sort:()=>obj};
  return obj;
 },
 async findOneAndUpdate(query,update,opts){
  assert.equal(opts.upsert,true);
  assert.equal(query.gatewayPaymentId,paymentId);
  if(!renewed){
   renewed={...update.$setOnInsert,_id:'a'.repeat(24)};
   upsertCount++;
  }
  return {...renewed};
 }
};
const User={
 findById(id){
  findUserId=id;
  const obj={select:()=>obj,lean:async()=>id===account
   ?{_id:account,role:'user',isVerified:true}:null};
  return obj;
 }
};
const Nonces={
 async create({nonce}){
  if(nonces.has(nonce))throw Object.assign(new Error('duplicate nonce'),{code:11000});
  nonces.add(nonce);
 }
};
const original=Module._load;
Module._load=function(name,parent,isMain){
 if(String(parent?.filename||'').endsWith('/backend/controllers/gatewayBillingController.js')){
  if(name==='../models/User')return User;
  if(name==='../models/BillingOrder')return BillingOrder;
  if(name==='../models/GatewayWebhookNonce')return Nonces;
  if(name==='../models/BillingRenewalSnooze')return {};
  if(name==='../services/ilumaGatewayClient')return {configured:()=>true};
  if(name==='../services/billingEntitlements')return {hasAccountRight:async()=>false};
  if(name==='../services/billingIndexReadiness')return {ensureBillingIndexes:async()=>{}};
 }
 return original.call(this,name,parent,isMain);
};
let controller;
try{controller=require('../backend/controllers/gatewayBillingController');}
finally{Module._load=original;}

function sign(event,nonce){
 const raw=Buffer.from(JSON.stringify(event));
 const at=String(Math.floor(Date.now()/1000));
 return {body:raw,headers:{
  'x-iluma-timestamp':at,'x-iluma-nonce':nonce,
  'x-iluma-event-id':event.event_id,
  'x-iluma-signature':canonicalSignature(secret,'POST','/api/gateway/webhook',at,nonce,raw)
 }};
}
function event(id='1'.repeat(32)){
 return {
  event_id:id,event_type:'payment.paid',payment_id:paymentId,
  order_id:orderId,amount_cents:399,currency:'EUR',
  customer_id:'internal-gateway-customer',environment:'staging',
  billing_origin:'automatic_renewal',external_user_id:'iradios-stage-'+account,
  cycle_due_at:paidBefore.toISOString(),occurred_at:new Date().toISOString()
 };
}
async function handle(req){
 const res={statusCode:200,body:null,status(code){this.statusCode=code;return this;},
  json(value){this.body=value;return this;}};
 await controller.webhook(req,res,err=>{throw err;});
 return res;
}
test('Authenticated MIT paid event creates only one paid month and never trusts a browser redirect',async()=>{
 const prevEnv=process.env.APP_ENV,prevSecret=process.env.ILUMA_GATEWAY_STAGING_SECRET;
 process.env.APP_ENV='staging';process.env.ILUMA_GATEWAY_STAGING_SECRET=secret;
 renewed=null;nonces=new Set();upsertCount=0;
 try{
  const first=await handle(sign(event(),'1'.repeat(32)));
  assert.equal(first.statusCode,200);
  assert.equal(first.body.activated,true);
  assert.equal(findUserId,account);
  assert.equal(upsertCount,1);
  assert.equal(renewed.billingOrigin,'automatic_renewal');
  assert.equal(renewed.renewalOfOrderId,initial._id);
  assert.equal(renewed.status,'paid');
  assert.equal(renewed.amountCents,399);
  assert.equal(renewed.gatewayPaymentId,paymentId);
  const end=+new Date(renewed.periodEndsAt);
  const repeat=await handle(sign(event('2'.repeat(32)),'2'.repeat(32)));
  assert.equal(repeat.statusCode,200);
  assert.equal(upsertCount,1,'Unique provider payment cannot create a second paid cycle');
  assert.equal(+new Date(renewed.periodEndsAt),end,'Same payment cannot extend entitlement twice');
  const replay=await handle(sign(event(),'1'.repeat(32)));
  assert.equal(replay.statusCode,409);
 }finally{
  process.env.APP_ENV=prevEnv;process.env.ILUMA_GATEWAY_STAGING_SECRET=prevSecret;
 }
});
test('Wrong account, invalid provider amount, and invalid HMAC never grant MIT Premium',async()=>{
 const env=process.env.APP_ENV,sec=process.env.ILUMA_GATEWAY_STAGING_SECRET;
 process.env.APP_ENV='staging';process.env.ILUMA_GATEWAY_STAGING_SECRET=secret;
 renewed=null;nonces=new Set();upsertCount=0;
 try{
  const wrong=event();wrong.external_user_id='iradios-stage-'+another;
  assert.equal((await handle(sign(wrong,'3'.repeat(32)))).statusCode,422);
  const wrongAmount=event('4'.repeat(32));wrongAmount.amount_cents=499;
  assert.equal((await handle(sign(wrongAmount,'4'.repeat(32)))).statusCode,422);
  const tampered=sign(event('5'.repeat(32)),'5'.repeat(32));
  tampered.body=Buffer.from(tampered.body.toString('utf8').replace('"amount_cents":399','"amount_cents":499'));
  assert.equal((await handle(tampered)).statusCode,401);
  assert.equal(upsertCount,0);
 }finally{process.env.APP_ENV=env;process.env.ILUMA_GATEWAY_STAGING_SECRET=sec;}
});
