'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const original=Module._load;
const {canonicalSignature}=require('../backend/services/gatewayBillingProtocol');
const secret='a'.repeat(64);
const id='aaaaaaaaaaaaaaaaaaaaaaaa';
const payment='0'.repeat(32),orderId='IL'+'F'.repeat(24);
const paidEventId='11111111111111111111111111111111';
let state;
let nonces;
let updateCount;
function reset(){
 state={_id:id,accountId:'bbbbbbbbbbbbbbbbbbbbbbbb',sku:'L-PREM',
  gatewayPaymentId:payment,gatewayOrderId:orderId,status:'redirect',
  amountCents:399,currency:'EUR',environment:'staging',
  eventIds:[],eventLog:[],lockKey:'account:L-PREM',
  periodEndsAt:null,providerStatus:'redirect'};
 nonces=new Set();
 updateCount=0;
}
reset();
const model={
 findOne:query=>({
  select:()=>({lean:async()=>{
   if(query.gatewayPaymentId!==state.gatewayPaymentId||
     query.gatewayOrderId!==state.gatewayOrderId||
     query.amountCents!==state.amountCents||
     query.currency!==state.currency||
     query.environment!==state.environment)return null;
   return {...state,eventIds:[...state.eventIds]};
  }})
 }),
 findOneAndUpdate:async(query,update)=>{
  updateCount++;
  if(query._id!==state._id||query.gatewayPaymentId!==state.gatewayPaymentId||
     query.gatewayOrderId!==state.gatewayOrderId)return null;
  if(query.eventIds?.$ne&&state.eventIds.includes(query.eventIds.$ne))return null;
  if(query.status?.$ne&&state.status===query.status.$ne)return null;
  if(query.status?.$nin&&query.status.$nin.includes(state.status))return null;
  if(update.$set)Object.assign(state,update.$set);
  if(update.$unset)for(const name of Object.keys(update.$unset))delete state[name];
  if(update.$addToSet?.eventIds && !state.eventIds.includes(update.$addToSet.eventIds))
   state.eventIds.push(update.$addToSet.eventIds);
  if(update.$push?.eventLog)state.eventLog.push(update.$push.eventLog);
  return {...state};
 }
};
const nonceModel={
 create:async({nonce})=>{
  if(nonces.has(nonce))throw Object.assign(new Error('duplicate'),{code:11000});
  nonces.add(nonce);
 }
};
Module._load=function(name,parent,isMain){
 if(String(parent?.filename||'').endsWith('/backend/controllers/gatewayBillingController.js')){
  if(name==='../models/BillingOrder')return model;
  if(name==='../models/GatewayWebhookNonce')return nonceModel;
  if(name==='../services/ilumaGatewayClient')return {configured:()=>true};
  if(name==='../services/billingEntitlements')return {hasAccountRight:async()=>false};
  if(name==='../services/billingIndexReadiness')return {ensureBillingIndexes:async()=>{}};
 }
 return original.call(this,name,parent,isMain);
};
let controller;
try{controller=require('../backend/controllers/gatewayBillingController');}
finally{Module._load=original;}
function signedEvent(event,nonce='1234567890abcdef1234567890abcdef'){
 const raw=Buffer.from(JSON.stringify(event));
 const timestamp=String(Math.floor(Date.now()/1000));
 return {req:{body:raw,headers:{
  'x-iluma-timestamp':timestamp,'x-iluma-nonce':nonce,'x-iluma-event-id':event.event_id,
  'x-iluma-signature':canonicalSignature(secret,'POST','/api/gateway/webhook',timestamp,nonce,raw)
 }},raw};
}
function response(){
 return {statusCode:200,body:null,status(v){this.statusCode=v;return this;},
  json(v){this.body=v;return this;}};
}
async function run(req){
 const res=response();
 await controller.webhook(req,res,error=>{throw error;});
 return res;
}
function payload(eventId=paidEventId,eventType='payment.paid'){
 return {event_id:eventId,event_type:eventType,payment_id:payment,
  order_id:orderId,customer_id:'gateway-customer-internal-not-iradios',
  amount_cents:399,currency:'EUR',environment:'staging',
  occurred_at:new Date().toISOString()};
}
test('Paid event only grants one cycle after signed Gateway HMAC; duplicates never extend it',async()=>{
 reset();
 const prev=process.env.APP_ENV,ps=process.env.ILUMA_GATEWAY_STAGING_SECRET;
 process.env.APP_ENV='staging';process.env.ILUMA_GATEWAY_STAGING_SECRET=secret;
 try{
  const originalEvent=payload();
  const request=signedEvent(originalEvent);
  const first=await run(request.req);
  assert.equal(first.statusCode,200);
  assert.deepEqual(first.body,{received:true,activated:true});
  assert.equal(state.status,'paid');
  assert.ok(new Date(state.periodEndsAt)>new Date(state.paidAt));
  assert.equal(state.eventIds.length,1);
  assert.equal('lockKey' in state,false);
  const end=new Date(state.periodEndsAt).getTime();
  const second=await run(signedEvent(originalEvent,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').req);
  assert.equal(second.statusCode,200);
  assert.equal(second.body.duplicate,true);
  assert.equal(new Date(state.periodEndsAt).getTime(),end);
  assert.equal(state.eventIds.length,1);
  const failed=await run(signedEvent(payload('22222222222222222222222222222222',
    'payment.failed'),'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb').req);
  assert.equal(failed.statusCode,200);
  assert.equal(state.status,'paid','out-of-order failure does not revoke a captured payment');
  assert.equal(state.eventIds.length,2);
  assert.equal(new Date(state.periodEndsAt).getTime(),end);
  assert.equal(state.eventLog.length,2);
 }finally{process.env.APP_ENV=prev;process.env.ILUMA_GATEWAY_STAGING_SECRET=ps;}
});
test('Signature tampering, invalid amount, replay and wrong order never activate Premium',async()=>{
 reset();
 const prev=process.env.APP_ENV,ps=process.env.ILUMA_GATEWAY_STAGING_SECRET;
 process.env.APP_ENV='staging';process.env.ILUMA_GATEWAY_STAGING_SECRET=secret;
 try{
  const signed=signedEvent(payload());
  const tampered={...signed.req,body:Buffer.from(signed.raw.toString().replace('"amount_cents":399','"amount_cents":499'))};
  assert.equal((await run(tampered)).statusCode,401);
  assert.equal(state.status,'redirect');
  const wrongAmount=payload();wrongAmount.amount_cents=499;
  assert.equal((await run(signedEvent(wrongAmount).req)).statusCode,422);
  assert.equal(state.status,'redirect');
  const noMatch=payload();noMatch.payment_id='3'.repeat(32);
  assert.equal((await run(signedEvent(noMatch,'cccccccccccccccccccccccccccccccc').req)).statusCode,503);
  assert.equal(state.status,'redirect');
  const valid=signedEvent(payload(),'dddddddddddddddddddddddddddddddd');
  assert.equal((await run(valid.req)).statusCode,200);
  const replay=await run(valid.req);
  assert.equal(replay.statusCode,409);
  assert.equal(state.eventIds.length,1);
 }finally{process.env.APP_ENV=prev;process.env.ILUMA_GATEWAY_STAGING_SECRET=ps;}
});
