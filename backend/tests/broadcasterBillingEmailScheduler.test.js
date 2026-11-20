'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const target=path.resolve(__dirname,'../utils/broadcasterBillingEmailScheduler.js');
const previousLoad=Module._load;
const beforeEnv=process.env.APP_ENV;
process.env.APP_ENV='staging';
const accountId='507f1f77bcf86cd799439011',orderId='507f1f77bcf86cd799439012';
const paymentId='b'.repeat(32),now=new Date('2026-11-11T12:00:00.000Z');
let rows=new Map(),attempts=0,sent=[],renewalState='past_due';
const order={_id:orderId,accountId,resourceId:null,sku:'B-PREM',
 environment:'staging',status:'paid',amountCents:11900,billingOrigin:'checkout',
 paidAt:now,periodEndsAt:new Date('2026-12-11T12:00:00Z')};
const Outbox={
 createIndexes:async()=>{},
 async create(obj){
  if(rows.has(obj._id))throw Object.assign(new Error('unique duplicate'),{code:11000});
  rows.set(obj._id,{...obj,status:'pending',attempts:0,createdAt:now});
 },
 find(){return {sort(){return this;},limit(){return this;},lean:async()=>[...rows.values()].filter(x=>x.status==='pending')};},
 async findOneAndUpdate(filter,change){
  const row=rows.get(filter._id);
  if(!row||row.status!=='pending')return null;
  const next={...row,...change.$set,attempts:row.attempts+1};
  rows.set(filter._id,next);return next;
 },
 async updateOne(filter,change){
  const row=rows.get(filter._id);if(!row||row.status!==filter.status)return {modifiedCount:0};
  rows.set(filter._id,{...row,...change.$set});return {modifiedCount:1};
 }
};
const User={
 findById(){return {select(){return this;},lean:async()=>({
  _id:accountId,email:'broadcaster@example.com',role:'broadcaster',isVerified:true,fname:'Μαρία'
 })};}
};
const Order={
 findById(){return {lean:async()=>order};},
 findOne(){return {sort(){return this;},lean:async()=>order};},
 find(){return {sort(){return this;},limit(){return this;},lean:async()=>[]};}
};
const Station={findById(){return {select(){return this;},lean:async()=>null};}};
const Gateway={async broadcasterRecurringStatus(){return {state:renewalState};}};
const Mongoose={connection:{readyState:1,once(){}}};
Module._load=function(request,parent,isMain){
 if(parent?.filename===target){
  const table={
   'node-cron':{schedule(){}},'mongoose':Mongoose,
   '../models/User':User,'../models/Station':Station,
   '../models/BroadcasterBillingOrder':Order,
   '../models/BroadcasterBillingEmail':Outbox,
   '../services/ilumaGatewayClient':Gateway,
   './myMailer':{async sendEmail(message){attempts++;sent.push(message);return {success:true};}}
  };
  if(Object.prototype.hasOwnProperty.call(table,request))return table[request];
 }
 return previousLoad.apply(this,arguments);
};
const mail=require(target);
test.after(()=>{
 Module._load=previousLoad;
 if(beforeEnv===undefined)delete process.env.APP_ENV;
 else process.env.APP_ENV=beforeEnv;
});
test('First paid signed cycle queues exactly one branded Broadcaster onboarding mail',async()=>{
 rows=new Map();attempts=0;sent=[];
 assert.equal(await mail.enqueuePaid(order),true);
 assert.equal(await mail.enqueuePaid(order),false);
 assert.equal(rows.size,1);
 assert.equal(await mail.deliver(now),1);
 assert.equal(attempts,1);
 assert.match(sent[0].html,/data-iradios-email="v2"/);
 assert.match(sent[0].subject,/Broadcaster/);
 assert.equal(await mail.deliver(now),0);
 assert.equal(attempts,1);
});
test('Provider-declined MIT payment emits once; duplicate signed event cannot resend',async()=>{
 rows=new Map();attempts=0;sent=[];
 assert.equal(await mail.enqueueFailedRenewal(order,paymentId),true);
 assert.equal(await mail.enqueueFailedRenewal(order,paymentId),false);
 assert.equal(rows.size,1);
 assert.equal(await mail.deliver(now),1);
 assert.match(sent[0].subject,/αποτυχημένη ανανέωση/);
 assert.doesNotMatch(sent[0].subject,/επιτυχής/i);
 assert.equal(await mail.deliver(now),0);
});
test('Declined MIT mail is skipped if the contract is no longer past-due',async()=>{
 rows=new Map();attempts=0;sent=[];renewalState='active';
 await mail.enqueueFailedRenewal(order,'c'.repeat(32));
 assert.equal(await mail.deliver(now),0);
 assert.equal(attempts,0);
 const item=[...rows.values()][0];
 assert.equal(item.status,'skipped');
 renewalState='past_due';
});
test('One-off Boost cannot be enrolled in monthly renewal or declined MIT emails',async()=>{
 const boost={...order,sku:'BOOST-G-WEEK',resourceId:'507f191e810c19729de860ea'};
 rows=new Map();attempts=0;sent=[];
 assert.equal(await mail.enqueueFailedRenewal(boost,paymentId),false);
 assert.equal(await mail.enqueue('renewed',boost),false);
 assert.equal(rows.size,0);
});
test('Distinct provider failed payments use distinct deterministic idempotency keys',()=>{
 const key1=mail.dispatchKey('failed',orderId,paymentId);
 const key2=mail.dispatchKey('failed',orderId,'c'.repeat(32));
 assert.notEqual(key1,key2);
 assert.equal(key1,mail.dispatchKey('failed',orderId,paymentId));
});
