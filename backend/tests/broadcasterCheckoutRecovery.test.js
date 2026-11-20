'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const target=path.resolve(__dirname,'../utils/broadcasterCheckoutRecoveryScheduler.js');
const load=Module._load;
const currentEnv=process.env.APP_ENV;
process.env.APP_ENV='staging';
const now=new Date('2026-11-11T12:00:00.000Z');
const base=()=>({
 _id:'507f1f77bcf86cd799439011',environment:'staging',
 accountId:'507f1f77bcf86cd799439012',sku:'ADD-AN',
 requestKey:'iradios-bstage-507f1f77bcf86cd799439012-00000000-0000-4000-8000-000000000000',
 status:'unknown',lockKey:'my-lock',gatewayPaymentId:undefined,gatewayOrderId:undefined,
 createdAt:new Date(+now-180000),gatewayLastCheckedAt:null
});
let row=base(),outcome={},failure=null,posts=0,gets=0;
const Model={
 find(){return {sort(){return this},limit(){return this},lean:async()=>[row]};},
 findOneAndUpdate(_filter,change){
  row={...row,...change.$set};
  return {lean:async()=>({...row})};
 },
 async updateOne(filter,change){
  if(!['creating','pending','redirect','unknown'].includes(row.status)||
     +row.gatewayLastCheckedAt!==+filter.gatewayLastCheckedAt)return {modifiedCount:0};
  Object.assign(row,change.$set||{});
  for(const key of Object.keys(change.$unset||{}))delete row[key];
  return {modifiedCount:1};
 }
};
const gateway={
 configured:()=>true,
 async broadcasterPaymentByRequestKey(){
  gets++;if(failure)throw failure;return outcome;
 },
 async broadcasterPaymentStatus(){
  gets++;if(failure)throw failure;return outcome;
 },
 async broadcasterCheckout(){posts++;throw Error('should never be called');}
};
const mongoose={connection:{readyState:1}};
Module._load=function(request,parent,isMain){
 if(parent?.filename===target){
  if(request==='mongoose')return mongoose;
  if(request==='node-cron')return {schedule:()=>{}};
  if(request==='../services/ilumaGatewayClient')return gateway;
  if(request==='../models/BroadcasterBillingOrder')return Model;
 }
 return load.apply(this,arguments);
};
const recovery=require(target);
test.after(()=>{Module._load=load;
 if(currentEnv===undefined)delete process.env.APP_ENV;
 else process.env.APP_ENV=currentEnv;
});
test('A signed Gateway GET=paid NEVER activates a Broadcaster entitlement',async()=>{
 row=base();failure=null;posts=0;gets=0;
 outcome={payment_id:'b'.repeat(32),order_id:'IL'+'C'.repeat(24),
  status:'paid',amount_cents:790,currency:'EUR'};
 const code=await recovery.runOnce(now);
 assert.equal(code,1);
 assert.equal(gets,1);
 assert.equal(posts,0);
 assert.equal(row.status,'pending');
 assert.equal(row.gatewayPaymentId,outcome.payment_id);
 assert.equal(row.lockKey,'my-lock');
 assert.equal(row.periodEndsAt,undefined);
});
test('Provider timeout never unlocks or re-POSTs a checkout',async()=>{
 row=base();failure=Object.assign(new Error('Network timeout'),{code:'ETIMEDOUT'});posts=0;
 const code=await recovery.runOnce(now);
 assert.equal(code,1);
 assert.equal(posts,0);
 assert.equal(row.status,'unknown');
 assert.equal(row.lockKey,'my-lock');
});
test('Only an authenticated 404 on a sufficiently old uncreated intent releases the lock',async()=>{
 row=base();failure=Object.assign(new Error('Missing'),{code:'GATEWAY_HTTP_404'});
 const code=await recovery.runOnce(now);
 assert.equal(code,1);
 assert.equal(row.status,'failed');
 assert.equal(row.lastErrorCode,'GATEWAY_PAYMENT_NOT_CREATED');
 assert.equal(row.lockKey,undefined);
});
test('404 is NOT enough to release an intent with an existing payment reference',async()=>{
 row={...base(),gatewayPaymentId:'b'.repeat(32),gatewayOrderId:'IL'+'C'.repeat(24)};
 failure=Object.assign(new Error('Unknown'),{code:'GATEWAY_HTTP_404'});
 const code=await recovery.runOnce(now);
 assert.equal(code,1);
 assert.equal(row.status,'unknown');
 assert.equal(row.lockKey,'my-lock');
});
