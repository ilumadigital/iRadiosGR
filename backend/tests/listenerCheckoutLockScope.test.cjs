'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {listenerLockScope,lockedQuery,findLocked,findIdempotent,
 safeTerminal,releaseTerminalLock}=
 require('../services/listenerCheckoutLockScope');
const account='507f1f77bcf86cd799439011';
const reqKey='iradios-stage-'+account+'-00000000-0000-4000-8000-000000000001';
const stage=listenerLockScope({environment:'staging',accountId:account});
const prod=listenerLockScope({environment:'production',accountId:account});
function row(patch={}) {return {_id:'507f1f77bcf86cd799439012',
 accountId:account,environment:'staging',status:'unknown',lockKey:stage.legacy,
 requestKey:reqKey,sku:'L-PREM',eventIds:[],eventLog:[],
 paidAt:null,periodStartsAt:null,periodEndsAt:null,graceEndsAt:null,...patch};}
function fixture(rows){
 const reads=[],writes=[];
 const Model={
  findOne(query){
   reads.push(query);
   return {async lean(){return rows.find(r=>r.environment===query.environment&&
    String(r.accountId)===query.accountId&&(query.requestKey?
     r.requestKey===query.requestKey:query.lockKey.$in.includes(r.lockKey)))||null;}};
  },
  async updateOne(query,changes){
   writes.push({query,changes});
   const target=rows.find(r=>String(r._id)===String(query._id)&&
    r.environment===query.environment&&String(r.accountId)===query.accountId&&
    r.lockKey===query.lockKey&&['canceled','failed'].includes(r.status)&&
    !r.paidAt&&!r.periodStartsAt&&!r.periodEndsAt&&!r.graceEndsAt&&
    r.providerStatus!=='paid'&&!(r.eventIds||[]).length&&!(r.eventLog||[]).length);
   if(!target)return {modifiedCount:0};
   delete target.lockKey;
   return {modifiedCount:1};
  }
 };
 return {Model,reads,writes};
}
test('listener L-PREM + winback share tenant-local lock and retain original index',()=>{
 assert.equal(stage.legacy,account+':L-PREM');
 assert.equal(prod.scoped,'production:'+account+':L-PREM');
 assert.notEqual(stage.scoped,prod.scoped);
 assert.deepEqual(lockedQuery(prod),{environment:'production',accountId:account,
  lockKey:{$in:[prod.scoped,prod.legacy]}});
});
test('production never sees an imported staging pending, unknown or paid listener lock',async()=>{
 for(const status of ['pending','unknown','paid']){
  const f=fixture([row({status})]);
  assert.equal(await findLocked(f.Model,prod),null);
  assert.equal(await findIdempotent(f.Model,prod,reqKey),null);
  assert.equal(f.writes.length,0);
  assert.ok(f.reads.every(q=>q.environment==='production'&&q.accountId===account));
 }
});
test('old production unknown locks continue to block fresh production checkout',async()=>{
 const existing=row({environment:'production',status:'unknown',lockKey:prod.legacy});
 const f=fixture([existing]);
 assert.equal((await findLocked(f.Model,prod))._id,existing._id);
 assert.equal(await releaseTerminalLock(f.Model,existing,prod),false);
 assert.equal(f.writes.length,0);
});
test('staging legacy unknown remains protected in its own tenant',async()=>{
 const existing=row();
 const f=fixture([existing]);
 assert.equal((await findLocked(f.Model,stage))._id,existing._id);
 assert.equal(await releaseTerminalLock(f.Model,existing,stage),false);
});
test('unpaid production failed can release with CAS but not an imported staging row',async()=>{
 const existing=row({environment:'production',status:'failed',lockKey:prod.legacy});
 const f=fixture([existing]);
 assert.equal(await releaseTerminalLock(f.Model,existing,stage),false);
 assert.equal(await releaseTerminalLock(f.Model,existing,prod),true);
 assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].query.environment,'production');
 assert.deepEqual(f.writes[0].query['eventIds.0'],{$exists:false});
});
test('paid, webhook evidence and unexpected tenant identity are never released',async()=>{
 for(const patch of [
  {status:'paid'},{paidAt:new Date()},{periodStartsAt:new Date()},
  {periodEndsAt:new Date()},{graceEndsAt:new Date()}, {providerStatus:'paid'},
  {eventIds:['signed']},{eventLog:[{type:'payment.paid'}]},
  {accountId:'507f1f77bcf86cd799439099'}
 ]){
  const x=row({status:'canceled',environment:'production',
    lockKey:prod.scoped,...patch});
  const f=fixture([x]);
  assert.equal(safeTerminal(x,prod),false);
  assert.equal(await releaseTerminalLock(f.Model,x,prod),false);
  assert.equal(f.writes.length,0);
 }
});
test('listener checkout source only allows environment-scoped lock and order endpoints',()=>{
 const code=fs.readFileSync(path.resolve(__dirname,'../controllers/gatewayBillingController.js'),'utf8');
 assert.ok(code.includes('findListenerIdempotent(BillingOrder,scope,requestKey)'));
 assert.ok(code.includes('findListenerLocked(BillingOrder,scope)'));
 assert.ok(code.includes('releaseListenerTerminalLock(BillingOrder,order,scope)'));
 assert.ok(code.includes('environment:scope.environment,'));
 assert.ok(code.includes('environment:billingEnv(),sku:{$in:PREMIUM_SKUS}'));
 assert.ok(code.includes('listenerLockedQuery('));
 assert.ok(!code.includes('BillingOrder.findOne({lockKey})'));
 assert.ok(!code.includes('BillingOrder.findOne({requestKey})'));
 assert.ok(!code.includes("lockKey:String(user._id)+':L-PREM'"));
 const model=fs.readFileSync(path.resolve(__dirname,'../models/BillingOrder.js'),'utf8');
 assert.ok(model.includes('schema.index({lockKey:1},{unique:true'));
});
test('invalid account and foreign environment are rejected before query',()=>{
 for(const x of [{environment:'other',accountId:account},
  {environment:'production',accountId:'bad'}])
  assert.throws(()=>listenerLockScope(x),/INVALID_LISTENER_LOCK_SCOPE/);
});
