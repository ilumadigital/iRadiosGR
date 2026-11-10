'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');

const priorEnv=process.env.APP_ENV;
process.env.APP_ENV='staging';
const user={_id:'a'.repeat(24),role:'user',isVerified:true,
 fname:'Δοκιμή',email:'listener@example.test',
 notificationPreferences:{email:true,topics:{promotions:false},marketingConsentAt:null}};
const paid={_id:'b'.repeat(24),accountId:user._id,sku:'L-PREM',environment:'staging',
 status:'paid',billingOrigin:'checkout',amountCents:399,currency:'EUR',
 paidAt:new Date('2026-10-10T12:00:00Z'),
 periodEndsAt:new Date('2026-11-11T12:00:00Z'),
 graceEndsAt:new Date('2026-11-11T12:00:00Z')};
const ledger=new Map(),emails=[];
let recurring={state:'none',execution_enabled:false};
let right=false,winbackClaim={state:'none',used:false},mailRejected=false;
const lean=value=>({lean:async()=>value});
const users={
 findById(id){
  const obj={select:()=>obj,lean:async()=>id===user._id?user:null};
  return obj;
 }
};
const orders={
 find(q){
  const rows=paid.status==='paid'&&paid.environment===q.environment&&
   +paid.periodEndsAt>=+q.periodEndsAt.$gte&&+paid.periodEndsAt<=+q.periodEndsAt.$lte?[{...paid}]:[];
  const chain={sort:()=>chain,limit:()=>chain,lean:async()=>rows};
  return chain;
 },
 findOne(q){
  const match=q.accountId===user._id&&q.status==='paid'?{...paid}:null;
  const chain={sort:()=>chain,lean:async()=>match};
  return chain;
 },
 findById(id){return lean(id===paid._id?{...paid}:null);}
};
const dispatch={
 async createIndexes(){},
 async create(document){
  if(ledger.has(document._id))throw Object.assign(new Error('duplicate'),{code:11000});
  ledger.set(document._id,{...document,status:'pending',attempts:0,createdAt:new Date()});
  return document;
 },
 find(q){
  const rows=[...ledger.values()].filter(x=>x.status===q.status&&
   +x.dueAt<=+q.dueAt.$lte&&x.attempts<q.attempts.$lt);
  const chain={sort:()=>chain,limit:(n)=>{chain.rows=rows.slice(0,n);return chain;},
   lean:async()=>chain.rows||rows};
  return chain;
 },
 async findOneAndUpdate(q,update){
  const row=ledger.get(q._id);
  if(!row||row.status!==q.status||+row.dueAt>+q.dueAt.$lte)return null;
  Object.assign(row,update.$set);
  row.attempts+=(update.$inc?.attempts||0);
  return {...row};
 },
 async updateOne(q,update){
  const row=ledger.get(q._id);
  if(!row||row.status!==q.status)return {modifiedCount:0};
  Object.assign(row,update.$set);
  return {modifiedCount:1};
 }
};
const gateway={
 recurringStatus:async()=>recurring,
 winbackStatus:async()=>winbackClaim
};
const original=Module._load;
Module._load=function(name,parent,isMain){
 if(String(parent?.filename||'').endsWith('/backend/utils/premiumBillingEmailScheduler.js')){
  if(name==='node-cron')return {schedule:()=>{}};
  if(name==='mongoose')return {connection:{readyState:1,once:()=>{}}};
  if(name==='../models/User')return users;
  if(name==='../models/BillingOrder')return orders;
  if(name==='../models/BillingEmailDispatch')return dispatch;
  if(name==='../services/billingEntitlements')return {hasAccountRight:async()=>right};
  if(name==='../services/ilumaGatewayClient')return gateway;
  if(name==='./notificationUnsubscribe')return {tokenFor:()=>user._id+'.'+('c'.repeat(64))};
  if(name==='./myMailer')return {sendEmail:async args=>{
   if(mailRejected)return {success:false};
   emails.push(args);return {success:true,messageId:'mailpit-accepted'};
  }};
 }
 return original.call(this,name,parent,isMain);
};
let scheduler;
try{scheduler=require('../utils/premiumBillingEmailScheduler');}
finally{Module._load=original;}
const monthEnd=new Date('2026-11-10T18:00:00Z');
const now=new Date('2026-11-10T20:00:00Z');
test('Signed paid checkout queues exactly one welcome, but MIT renewals never queue onboarding',async()=>{
 const first=await scheduler.enqueuePaidWelcome(paid);
 const duplicate=await scheduler.enqueuePaidWelcome(paid);
 const mit=await scheduler.enqueuePaidWelcome({...paid,billingOrigin:'automatic_renewal'});
 assert.equal(first,true);
 assert.equal(duplicate,false);
 assert.equal(mit,false);
 assert.equal(ledger.size,1);
 assert.equal(await scheduler.deliverPending(now),1);
 assert.equal(await scheduler.deliverPending(now),0);
 assert.equal(emails.length,1);
 assert.match(emails[0].html,/Καλωσόρισες στο iRadios GR Premium/);
});
test('Soon and grace windows enqueue only once per paid cycle, and use current paid order',async()=>{
 const soonTime=new Date('2026-11-11T00:00:00Z');
 assert.equal(await scheduler.scanBillingWindows(soonTime),1);
 assert.equal(await scheduler.scanBillingWindows(soonTime),0);
 assert.equal(await scheduler.deliverPending(soonTime),1);
 assert.ok(emails.some(x=>x.subject.includes('λήγει σύντομα')));
 paid.periodEndsAt=new Date('2026-11-10T18:00:00Z');
 paid.graceEndsAt=new Date('2026-11-10T22:00:00Z');
 assert.equal(await scheduler.scanBillingWindows(now),1);
 assert.equal(await scheduler.deliverPending(now),1);
 assert.ok(emails.some(x=>x.subject.includes('χάριτος')));
});
test('Actual expiry notifies once; winback waits 24 hours and requires marketing opt-in and unused Gateway claim',async()=>{
 paid.graceEndsAt=new Date('2026-11-10T18:00:00Z');
 assert.equal(await scheduler.scanBillingWindows(now),1,'expiry informational email only');
 assert.equal(await scheduler.deliverPending(now),1);
 assert.ok(emails.some(x=>x.subject.includes('έληξε')));
 const tomorrow=new Date('2026-11-11T20:01:00Z');
 assert.equal(await scheduler.scanBillingWindows(tomorrow),0,'marketing is forbidden by default');
 user.notificationPreferences.topics.promotions=true;
 user.notificationPreferences.marketingConsentAt=new Date('2026-11-01T00:00:00Z');
 winbackClaim={state:'redeemed',used:true};
 assert.equal(await scheduler.scanBillingWindows(tomorrow),0,'already used discount never reappears');
 winbackClaim={state:'none',used:false};
 recurring={state:'active',execution_enabled:false};
 assert.equal(await scheduler.scanBillingWindows(tomorrow),0,'existing MIT cannot overlap discounted offer');
 recurring={state:'cancelled',execution_enabled:false};
 assert.equal(await scheduler.scanBillingWindows(tomorrow),1);
 assert.equal(await scheduler.deliverPending(tomorrow),1);
 assert.ok(emails.some(x=>x.subject.includes('1,99')));
 assert.equal(await scheduler.scanBillingWindows(tomorrow),0,'no duplicate offer');
 right=true;
 const nextWeek=new Date('2026-11-17T20:01:00Z');
 assert.equal(await scheduler.scanBillingWindows(nextWeek),0,'active complimentary Premium hides expiry offer');
 right=false;
});
test('Cancellation email is one per actual provider transition, never per repeated click',async()=>{
 recurring={state:'cancelled',execution_enabled:false,
  cancelled_at:'2026-11-10T19:00:00Z'};
 const first=await scheduler.enqueueCancellation(user,recurring);
 const repeat=await scheduler.enqueueCancellation(user,recurring);
 assert.equal(first,true);assert.equal(repeat,false);
 assert.equal(await scheduler.deliverPending(new Date('2026-11-10T20:00:00Z')),1);
 assert.ok(emails.some(x=>x.subject.includes('ακύρωσης')));
 assert.equal(await scheduler.deliverPending(new Date('2026-11-10T20:00:00Z')),0);
});
test('A definite failed SMTP transport can retry but accepted email cannot be sent again',async()=>{
 mailRejected=true;
 paid._id='d'.repeat(24);
 const queued=await scheduler.enqueuePaidWelcome(paid);
 assert.equal(queued,true);
 assert.equal(await scheduler.deliverPending(now),0);
 assert.equal(ledger.get('premium-email:welcome:'+user._id+':'+paid._id).status,'pending');
 mailRejected=false;
 assert.equal(await scheduler.deliverPending(new Date(Date.now()+86400000)),1);
 assert.equal(ledger.get('premium-email:welcome:'+user._id+':'+paid._id).status,'sent');
 assert.equal(await scheduler.deliverPending(new Date(Date.now()+2*86400000)),0);
});
test.after(()=>{process.env.APP_ENV=priorEnv;});
