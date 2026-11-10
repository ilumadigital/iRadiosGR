'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const originalLoad=Module._load;
const {DAY_MS}=require('../backend/services/billingRenewalRules');

const user={_id:'a'.repeat(24),role:'user',isVerified:true};
const prevId='b'.repeat(24);
const uuid='c8b0b7b9-7777-4777-8777-777777777777';
let previous,created,hasRight,snoozed,providerCalls;
function reset(){
 previous={_id:prevId,accountId:user._id,sku:'L-PREM',
  environment:'staging',status:'paid',paidAt:new Date(Date.now()-DAY_MS*10),
  periodStartsAt:new Date(Date.now()-DAY_MS*30),
  periodEndsAt:new Date(Date.now()+3600000),
  graceEndsAt:new Date(Date.now()+3600000)};
 created=null;hasRight=true;snoozed=null;providerCalls=0;
}
reset();
const BillingOrder={
 findOne(q){
  const result=()=>{
   if(q.requestKey)return created?.requestKey===q.requestKey?created:null;
   if(q.lockKey)return created?.lockKey===q.lockKey?created:null;
   if(q.gatewayPaymentId)return null;
   if(q._id&&q.accountId)return created&&String(created._id)===String(q._id)?created:null;
   if(q.status==='paid')return previous;
   return null;
  };
  const fetch={lean:async()=>result(),select:()=>fetch,sort:()=>fetch};
  return fetch;
 },
 exists:async q=>{
  if(q.lockKey)return created?.lockKey===q.lockKey?{_id:created._id}:null;
  return null;
 },
 create:async doc=>{created={...doc,_id:'d'.repeat(24),createdAt:new Date()};return created;},
 findOneAndUpdate:async(q,update)=>{
  if(created&&String(q._id)===String(created._id)){
   Object.assign(created,update.$set||{});
   for(const key of Object.keys(update.$unset||{}))delete created[key];
   return created;
  }
  return null;
 }
};
const Snooze={
 init:async()=>{},
 findOne:()=>({lean:async()=>snoozed&&snoozed.snoozedUntil>new Date()?snoozed:null}),
 findOneAndUpdate:async(q,update)=>{
  snoozed={accountId:q.accountId,orderId:q.orderId,...update.$set};return snoozed;
 }
};
let lastCardChoice=null;
let cardState='none';
const gateway={
 configured:()=>true,
 paymentByRequestKey:async()=>{throw Object.assign(new Error('not found'),{code:'GATEWAY_HTTP_404'});},
 paymentStatus:async()=>{throw Object.assign(new Error('lookup unavailable'),{code:'GATEWAY_HTTP_404'});},
 savedCardStatus:async()=>({state:cardState,automaticRenewal:false}),
 revokeSavedCard:async()=>({state:cardState='revocation_pending',automaticRenewal:false}),
 checkout:async({cardChoice}={})=>{lastCardChoice=cardChoice;providerCalls++;
  return {payment_id:'0'.repeat(32),order_id:'IL'+'E'.repeat(24),
    status:'redirect',checkout_url:'https://pay.nexigroup.com/demo'};
 }
};
Module._load=function(name,parent,isMain){
 if(String(parent?.filename||'').endsWith('/backend/controllers/gatewayBillingController.js')){
  if(name==='../models/BillingOrder')return BillingOrder;
  if(name==='../models/User')return {findById:async()=>null};
  if(name==='../models/BillingRenewalSnooze')return Snooze;
  if(name==='../models/GatewayWebhookNonce')return {create:async()=>{}};
  if(name==='../services/ilumaGatewayClient')return gateway;
  if(name==='../services/billingEntitlements')return {hasAccountRight:async()=>hasRight};
  if(name==='../services/billingIndexReadiness')return {ensureBillingIndexes:async()=>{}};
 }
 return originalLoad.call(this,name,parent,isMain);
};
let controller;
try{controller=require('../backend/controllers/gatewayBillingController');}
finally{Module._load=originalLoad;}
function response(){
 return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},
  json(data){this.body=data;return this;}};
}
async function call(handler,req){
 const res=response();await handler({user,...req},res,e=>{throw e;});return res;
}
const checkoutReq=(key=uuid)=>({body:{},get:header=>header==='Idempotency-Key'?key:''});

test('Account-specific warning can be snoozed 24h without changing entitlement',async()=>{
 reset();
 const before={...previous};
 let status=await call(controller.renewalNotice,{});
 assert.equal(status.statusCode,200);
 assert.equal(status.body.notice.kind,'soon');
 assert.equal(status.body.renewal.cycleId,prevId);
 const skipped=await call(controller.snoozeRenewalNotice,{body:{}});
 assert.equal(skipped.statusCode,200);
 assert.equal(skipped.body.cycleId,prevId);
 assert.ok(Date.parse(skipped.body.snoozedUntil)>Date.now()+DAY_MS-3000);
 status=await call(controller.renewalNotice,{});
 assert.equal(status.body.notice,null,'Snoozed popup is hidden');
 assert.equal(status.body.renewal.kind,'soon','Manual checkout remains eligible');
 assert.deepEqual(previous,before,'Snooze never mutates the paid cycle');
 assert.equal(providerCalls,0,'Popup never charges Nexi');
});
test('Paid subscriber may renew in last 24h, with one new locked Gateway order',async()=>{
 reset();hasRight=true;
 process.env.APP_ENV='staging';
 const first=await call(controller.checkout,checkoutReq());
 assert.equal(first.statusCode,201);
 assert.equal(first.body.order.status,'redirect');
 assert.equal(String(created.renewalOfOrderId),prevId);
 assert.equal(providerCalls,1);
 const repeat=await call(controller.checkout,checkoutReq());
 assert.equal(repeat.body.alreadyProcessed,true);
 const differentKey=await call(controller.checkout,checkoutReq('f8b0b7b9-7777-4777-8777-777777777777'));
 assert.equal(differentKey.body.alreadyProcessed,true);
 assert.equal(providerCalls,1,'Open-lock prevents duplicate Nexi checkout');
});
test('Active subscriber outside the final 24h cannot prepay repeatedly',async()=>{
 reset();hasRight=true;
 previous.periodEndsAt=new Date(Date.now()+DAY_MS*5);
 previous.graceEndsAt=previous.periodEndsAt;
 const denied=await call(controller.checkout,checkoutReq());
 assert.equal(denied.statusCode,409);
 assert.equal(denied.body.code,'ALREADY_PREMIUM');
 assert.equal(created,null);
 assert.equal(providerCalls,0);
});
test('Explicit grace supports manual renewal; no entitlement extension on snooze',async()=>{
 reset();hasRight=true;
 previous.periodEndsAt=new Date(Date.now()-3600000);
 previous.graceEndsAt=new Date(Date.now()+3600000);
 const notice=await call(controller.renewalNotice,{});
 assert.equal(notice.body.notice.kind,'grace');
 const renewed=await call(controller.checkout,checkoutReq());
 assert.equal(renewed.statusCode,201);
 assert.equal(providerCalls,1);
});
test('Expired paid period creates a new manual cycle only when no other Premium right exists',async()=>{
 reset();hasRight=false;
 previous.periodEndsAt=new Date(Date.now()-3600000);
 previous.graceEndsAt=previous.periodEndsAt;
 assert.equal((await call(controller.renewalNotice,{})).body.notice.kind,'expired');
 assert.equal((await call(controller.checkout,checkoutReq())).statusCode,201);
 assert.equal(providerCalls,1);
 reset();hasRight=true;
 previous.periodEndsAt=new Date(Date.now()-3600000);
 previous.graceEndsAt=previous.periodEndsAt;
 assert.equal((await call(controller.renewalNotice,{})).body.notice,null,
  'Complimentary/manual premium suppresses expired paid-cycle popup');
 assert.equal((await call(controller.checkout,checkoutReq())).statusCode,409);
});


test('Card-on-file opt-in is never implicit and requires a boolean selection',async()=>{
 reset();hasRight=true;
 const normal=await call(controller.checkout,checkoutReq());
 assert.equal(normal.statusCode,201);
 assert.deepEqual(lastCardChoice,{saveCard:false,useSavedCard:false});
 reset();hasRight=true;
 const opted=await call(controller.checkout,{...checkoutReq(),body:{saveCard:true}});
 assert.equal(opted.statusCode,201);
 assert.deepEqual(lastCardChoice,{saveCard:true,useSavedCard:false});
 reset();hasRight=true;
 const conflict=await call(controller.checkout,{...checkoutReq(),body:{saveCard:true,useSavedCard:true}});
 assert.equal(conflict.statusCode,400);assert.equal(providerCalls,0);
 const invalid=await call(controller.checkout,{...checkoutReq(),body:{saveCard:'yes'}});
 assert.equal(invalid.statusCode,400);assert.equal(providerCalls,0);
});
test('Only own authenticated listener can inspect/revoke payment method, without contract ID input',async()=>{
 reset();
 cardState='active';
 const status=await call(controller.savedCardStatus,{});
 assert.equal(status.statusCode,200);
 assert.equal(status.body.paymentMethod.state,'active');
 assert.equal(status.body.paymentMethod.automaticRenewal,false);
 const wrong=await call(controller.revokeSavedCard,{body:{contractId:'FORGED'}});
 assert.equal(wrong.statusCode,400);assert.equal(cardState,'active');
 const removed=await call(controller.revokeSavedCard,{body:{}});
 assert.equal(removed.statusCode,200);
 assert.equal(removed.body.paymentMethod.state,'revocation_pending');
 cardState='none';
});


test('Deterministic OneClick Gateway 422 frees original lock without calling Nexi twice',async()=>{
 reset();hasRight=true;process.env.APP_ENV='staging';
 const originalCheckout=gateway.checkout;
 gateway.checkout=async()=>{throw Object.assign(new Error('preflight rejected'),{
  code:'GATEWAY_HTTP_422'
 });};
 try{
  const res=await call(controller.checkout,{...checkoutReq(),body:{saveCard:true}});
  assert.equal(res.statusCode,503);
  assert.equal(res.body.code,'GATEWAY_ONECLICK_NOT_READY');
  assert.equal(created.status,'failed');
  assert.equal(created.lastErrorCode,'GATEWAY_ONECLICK_NOT_READY');
  assert.equal(created.lockKey,undefined);
  assert.equal(created.gatewayPaymentId,undefined);
 }finally{gateway.checkout=originalCheckout;}
});
test('Signed Gateway 404 after 2 minutes safely closes local intent without a provider payment reference',async()=>{
 reset();hasRight=false;process.env.APP_ENV='staging';
 created={_id:'d'.repeat(24),accountId:user._id,sku:'L-PREM',
  status:'unknown',environment:'staging',amountCents:399,currency:'EUR',
  requestKey:'iradios-stage-'+user._id+'-'+uuid,
  lockKey:user._id+':L-PREM',
  createdAt:new Date(Date.now()-3*60000)};
 const response=await call(controller.readOrder,{params:{id:created._id},query:{refresh:'1'}});
 assert.equal(response.statusCode,200);
 assert.equal(response.body.order.status,'failed');
 assert.equal(response.body.order.recoveryReason,'not_created');
 assert.equal(created.lockKey,undefined);
 assert.equal(created.gatewayPaymentId,undefined);
});
test('Gateway 404 never releases a lock when a provider payment/order ID is known',async()=>{
 reset();hasRight=false;process.env.APP_ENV='staging';
 created={_id:'d'.repeat(24),accountId:user._id,sku:'L-PREM',
  status:'unknown',environment:'staging',amountCents:399,currency:'EUR',
  requestKey:'iradios-stage-'+user._id+'-'+uuid,
  lockKey:user._id+':L-PREM',
  gatewayPaymentId:'0'.repeat(32),gatewayOrderId:'IL'+'E'.repeat(24),
  createdAt:new Date(Date.now()-3*60000)};
 const response=await call(controller.readOrder,{params:{id:created._id},query:{refresh:'1'}});
 assert.equal(response.statusCode,200);
 assert.equal(response.body.order.status,'unknown');
 assert.equal(response.body.order.recoveryReason,null);
 assert.equal(created.lockKey,user._id+':L-PREM',
  'Any known provider payment reference demands financial reconciliation');
});
