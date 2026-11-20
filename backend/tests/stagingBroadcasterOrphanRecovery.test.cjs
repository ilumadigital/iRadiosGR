'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {reviewOrphan}=require('../services/stagingBroadcasterOrphanRecovery');
const saved={APP_ENV:process.env.APP_ENV,IRADIOS_GATEWAY_ENV:process.env.IRADIOS_GATEWAY_ENV};
process.env.APP_ENV='staging';
process.env.IRADIOS_GATEWAY_ENV='staging';
after(()=>{
 for(const [k,v] of Object.entries(saved)){
  if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
const ORDER_ID='6afca3ccf4de99d0a882472e';
const GATEWAY_ORDER='IL585389CBC55D3C23887B0FE8';
const ACCOUNT='507f1f77bcf86cd799439012';
const REQ='iradios-bstage-'+ACCOUNT+'-00000000-0000-4000-8000-000000000000';
const NOW=new Date('2026-11-20T21:00:00Z');
const origin={mode:()=> 'staging',configured:()=>true};
const args=(patch={})=>({
 orderId:ORDER_ID,expectedGatewayOrderId:GATEWAY_ORDER,
 sandbox404For:GATEWAY_ORDER,confirmStagingOrigin:true,now:NOW,...patch
});
const base=(patch={})=>({
 _id:ORDER_ID,accountId:ACCOUNT,requestKey:REQ,lockKey:ACCOUNT+':B-PREM:account',
 environment:'staging',sku:'B-PREM',scopeType:'account',resourceId:null,
 status:'unknown',billingOrigin:'checkout',amountCents:9900,currency:'EUR',
 gatewayOrderId:GATEWAY_ORDER,gatewayPaymentId:undefined,
 checkoutUrl:null,providerStatus:'unknown',
 createdAt:new Date(+NOW-300000),paidAt:null,periodStartsAt:null,periodEndsAt:null,
 graceEndsAt:null,eventIds:[],eventLog:[],...patch
});
function fixture(patch={},gatewayPatch={}){
 let row=base(patch),updates=0,postCalls=0,lookups=[];
 const g={
  async broadcasterPaymentByRequestKey(key,sku){
   lookups.push(['key',key,sku]);
   if(gatewayPatch.key==='found')return {status:'paid'};
   if(gatewayPatch.key==='503')throw {code:'GATEWAY_HTTP_503'};
   throw {code:'GATEWAY_HTTP_404'};
  },
  async broadcasterPaymentStatus(paymentId,orderId,sku){
   lookups.push(['payment',paymentId,orderId,sku]);
   if(gatewayPatch.payment==='found')return {status:'paid'};
   if(gatewayPatch.payment==='503')throw {code:'GATEWAY_HTTP_503'};
   throw {code:'GATEWAY_HTTP_404'};
  },
  async broadcasterRecurringStatus(user,sku){
   lookups.push(['status',String(user._id),sku]);
   return {state:gatewayPatch.mandate||'none'};
  },
  async broadcasterCheckout(){postCalls++;throw Error('checkout POST must never happen');}
 };
 const Model={
  findOne(filter){
   assert.equal(filter.environment,'staging');
   assert.equal(filter.sku,'B-PREM');
   return {lean:async()=>row};
  },
  async updateOne(filter,change){
   updates++;
   assert.equal(filter.gatewayOrderId,GATEWAY_ORDER);
   assert.equal(filter.environment,'staging');
   assert.equal(filter.status,'unknown');
   assert.equal(filter['eventIds.0'].$exists,false);
   if(gatewayPatch.race)return {modifiedCount:0};
   Object.assign(row,change.$set);
   for(const key of Object.keys(change.$unset))delete row[key];
   return {modifiedCount:1};
  }
 };
 const review=(p={})=>reviewOrphan(args(p),{Model,gateway:g,environment:origin});
 return {review,get row(){return row},get updates(){return updates},
  get postCalls(){return postCalls},get lookups(){return lookups}};
}
test('Staging dry-run requires both original Gateway request and mandate absence',async()=>{
 const x=fixture();
 const out=await x.review();
 assert.equal(out.state,'READY_FOR_OPERATOR_RELEASE');
 assert.equal(out.gatewayRequestKey,'404');
 assert.equal(out.gatewayPremiumMandate,'none');
 assert.equal(out.sandboxOrder,'operator_confirmed_404');
 assert.equal(x.row.status,'unknown');
 assert.equal(x.row.lockKey,ACCOUNT+':B-PREM:account');
 assert.equal(x.updates,0);
 assert.deepEqual(x.lookups.map(v=>v[0]),['key','status']);
 assert.equal(x.postCalls,0);
});
test('Operator apply releases only this unpaid unknown staging intent with atomic CAS',async()=>{
 const x=fixture();
 const out=await x.review({apply:true});
 assert.equal(out.state,'RELEASED');
 assert.equal(x.row.status,'failed');
 assert.equal(x.row.lockKey,undefined);
 assert.equal(x.row.lastErrorCode,'STAGING_SANDBOX_ORDER_ABSENT_CONFIRMED');
 assert.equal(x.row.paidAt,null);
 assert.equal(x.row.periodEndsAt,null);
 assert.equal(x.updates,1);
 assert.equal(x.postCalls,0);
});
test('Payment ID requires an independent second HMAC GET 404',async()=>{
 const id='a'.repeat(32);
 const x=fixture({gatewayPaymentId:id});
 await x.review();
 assert.deepEqual(x.lookups.map(v=>v[0]),['key','payment','status']);
 const y=fixture({gatewayPaymentId:id},{payment:'found'});
 await assert.rejects(y.review({apply:true}),e=>e.code==='GATEWAY_PAYMENT_ID_STILL_EXISTS');
 assert.equal(y.updates,0);
});
test('Missing Sandbox or original staging-routing confirmation never releases',async()=>{
 for(const p of [{sandbox404For:''},{sandbox404For:'IL'+'A'.repeat(24)},
  {confirmStagingOrigin:false},{expectedGatewayOrderId:'IL'+'A'.repeat(24)}]){
  const x=fixture();
  await assert.rejects(x.review({...p,apply:true}));
  assert.equal(x.updates,0);
 }
});
test('Global environment must be staging with matching configured Gateway tenant',async()=>{
 const x=fixture();
 process.env.APP_ENV='production';
 await assert.rejects(x.review({apply:true}),e=>e.code==='STAGING_ENVIRONMENT_NOT_VERIFIED');
 process.env.APP_ENV='staging';
 process.env.IRADIOS_GATEWAY_ENV='production';
 await assert.rejects(x.review({apply:true}),e=>e.code==='STAGING_ENVIRONMENT_NOT_VERIFIED');
 process.env.IRADIOS_GATEWAY_ENV='staging';
 assert.equal(x.updates,0);
});
test('Gateway 200, 503, or any current/pending Premium mandate fails closed',async()=>{
 for(const config of [{key:'found'},{key:'503'},{mandate:'active'},
  {mandate:'pending'},{mandate:'verification_pending'},
  {mandate:'cancelled'},{mandate:'unavailable'}]){
  const x=fixture({},config);
  await assert.rejects(x.review({apply:true}));
  assert.equal(x.row.status,'unknown');
  assert.equal(x.row.lockKey,ACCOUNT+':B-PREM:account');
  assert.equal(x.updates,0);
  assert.equal(x.postCalls,0);
 }
});
test('Paid, redirected, missing lock, mismatched price or signed events cannot release',async()=>{
 for(const patch of [{status:'paid'},{status:'redirect'},{eventIds:['a'.repeat(32)]},
  {eventLog:[{id:'a'}]},{paidAt:NOW},{periodEndsAt:NOW},{checkoutUrl:'https://safe.example/'},
  {lockKey:'different'},{amountCents:11900},{sku:'ADD-DSP'},
  {environment:'production'},{gatewayOrderId:'IL'+'F'.repeat(24)},
  {billingOrigin:'automatic_renewal'}, {providerStatus:'paid'}]){
  const x=fixture(patch);
  await assert.rejects(x.review({apply:true}));
  assert.equal(x.updates,0);
 }
});
test('Very recent attempt, or concurrent webhook, never releases',async()=>{
 const recent=fixture({createdAt:new Date(+NOW-30000)});
 await assert.rejects(recent.review({apply:true}),e=>e.code==='ORDER_NOT_OLD_ENOUGH');
 assert.equal(recent.updates,0);
 const race=fixture({},{race:true});
 await assert.rejects(race.review({apply:true}),e=>e.code==='CONCURRENT_CHANGE_NO_RELEASE');
 assert.equal(race.row.status,'unknown');
 assert.equal(race.row.lockKey,ACCOUNT+':B-PREM:account');
});
test('The CLI cannot be used without exact operator arguments',()=>{
 const {options}=require('../scripts/recoverStagingBroadcasterOrphan');
 assert.deepEqual(options(['--apply','--confirm-staging-origin','--order-id',ORDER_ID]),{
  '--apply':true,'--confirm-staging-origin':true,'--order-id':ORDER_ID
 });
 assert.throws(()=>options(['--force']),/INVALID_OPTIONS/);
 assert.throws(()=>options(['--apply','--apply']),/INVALID_OPTIONS/);
 assert.throws(()=>options(['--order-id']),/MISSING_OPTION_VALUE/);
});
