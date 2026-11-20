'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {lockScope,scopedLockQuery,findExistingLocked,findIdempotent,
 safeToReleaseTerminal,releaseOrphanTerminalLock}=
 require('../services/broadcasterCheckoutLockScope');
const account='507f1f77bcf86cd799439011';
const other='507f1f77bcf86cd799439012';
const stage=lockScope({environment:'staging',accountId:account,sku:'B-PREM',scopeId:'account'});
const prod=lockScope({environment:'production',accountId:account,sku:'B-PREM',scopeId:'account'});
const reqKey='iradios-bstage-'+account+'-00000000-0000-4000-8000-000000000001';
function fixture(rows) {
 const writes=[],reads=[];
 const Model={
  findOne(query){
   reads.push(query);
   return {async lean(){
    return rows.find(row=>
      row.environment===query.environment&&
      String(row.accountId)===query.accountId&&row.sku===query.sku&&
      (query.requestKey ? row.requestKey===query.requestKey :
       query.lockKey.$in.includes(row.lockKey)))||null;
   }};
  },
  async updateOne(query,patch){
   writes.push({query,patch});
   const match=rows.find(x=>String(x._id)===String(query._id)&&
     x.environment===query.environment&&String(x.accountId)===query.accountId&&
     x.sku===query.sku&&x.lockKey===query.lockKey&&
     ['failed','canceled'].includes(x.status)&&
     x.paidAt==null&&x.periodStartsAt==null&&x.periodEndsAt==null&&
     x.graceEndsAt==null&&x.providerStatus!=='paid'&&
     !(x.eventIds||[]).length&&!(x.eventLog||[]).length);
   if(!match)return {modifiedCount:0};
   delete match.lockKey;
   return {modifiedCount:1};
  }
 };
 return {Model,writes,reads};
}
function order(overrides={}) {
 return {_id:other,environment:'staging',accountId:account,sku:'B-PREM',
  status:'unknown',requestKey:reqKey,lockKey:stage.legacy,
  paidAt:null,periodStartsAt:null,periodEndsAt:null,graceEndsAt:null,
  eventIds:[],eventLog:[],providerStatus:'unknown',...overrides};
}
test('new production and staging locks have different globally unique values',()=>{
 assert.equal(stage.legacy,prod.legacy);
 assert.equal(prod.scoped,'production:'+prod.legacy);
 assert.equal(stage.scoped,'staging:'+stage.legacy);
 assert.notEqual(stage.scoped,prod.scoped);
 assert.deepEqual(prod.candidates,[prod.scoped,prod.legacy]);
 assert.equal(scopedLockQuery(prod).environment,'production');
});
test('a production checkout ignores imported staging unknown, paid and canceled locks',async()=>{
 for(const status of ['unknown','paid','canceled']){
  const f=fixture([order({status})]);
  assert.equal(await findExistingLocked(f.Model,prod),null);
  assert.equal(await findIdempotent(f.Model,prod,reqKey),null);
  assert.equal(f.writes.length,0);
  for(const q of f.reads){
   assert.equal(q.environment,'production');
   assert.equal(q.accountId,account);
   assert.equal(q.sku,'B-PREM');
  }
 }
});
test('new production checkout can coexist with an imported staging legacy lock',async()=>{
 const imported=order();
 const live=order({_id:'507f1f77bcf86cd799439055',environment:'production',
  lockKey:prod.scoped,requestKey:'iradios-bstage-'+account+'-00000000-0000-4000-8000-000000000002'});
 const f=fixture([imported,live]);
 assert.equal((await findExistingLocked(f.Model,prod))._id,live._id);
 assert.equal((await findExistingLocked(f.Model,stage))._id,imported._id);
 assert.equal(f.writes.length,0);
});
test('legacy production open locks still block a second live checkout',async()=>{
 for(const status of ['creating','pending','redirect','unknown']){
  const old=order({environment:'production',status,lockKey:prod.legacy});
  const f=fixture([old]);
  const existing=await findExistingLocked(f.Model,prod);
  assert.equal(existing._id,old._id);
  assert.equal(safeToReleaseTerminal(existing,prod),false);
  assert.equal(await releaseOrphanTerminalLock(f.Model,existing,prod),false);
  assert.equal(f.writes.length,0);
 }
});
test('matching environment only: staging cannot release a production checkout',async()=>{
 const f=fixture([order({environment:'production',status:'canceled',lockKey:prod.scoped})]);
 const target=await findExistingLocked(f.Model,prod);
 assert.equal(await releaseOrphanTerminalLock(f.Model,target,stage),false);
 assert.equal(f.writes.length,0);
});
test('unpaid terminal lock can be cleaned with a strict environment CAS',async()=>{
 const older=order({environment:'production',status:'canceled',lockKey:prod.legacy});
 const f=fixture([older]);
 assert.equal(await releaseOrphanTerminalLock(f.Model,older,prod),true);
 assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].query.environment,'production');
 assert.equal(f.writes[0].query.accountId,account);
 assert.equal(f.writes[0].query.sku,'B-PREM');
 assert.equal(f.writes[0].query.lockKey,prod.legacy);
 assert.deepEqual(f.writes[0].query['eventIds.0'],{$exists:false});
 assert.equal(older.lockKey,undefined);
});
test('terminal with paid/signed evidence is never unlocked even if status is failed',async()=>{
 const scenarios=[
  {paidAt:new Date()}, {periodStartsAt:new Date()}, {periodEndsAt:new Date()},
  {graceEndsAt:new Date()}, {providerStatus:'paid'}, {eventIds:['signed']},
  {eventLog:[{type:'payment.failed',id:'signed'}]}
 ];
 for(const patch of scenarios){
  const f=fixture([order({environment:'production',status:'failed',lockKey:prod.legacy,...patch})]);
  const existing=await findExistingLocked(f.Model,prod);
  assert.equal(safeToReleaseTerminal(existing,prod),false);
  assert.equal(await releaseOrphanTerminalLock(f.Model,existing,prod),false);
  assert.equal(f.writes.length,0);
 }
});
test('invalid environment/sku/station/account cannot form a lock',()=>{
 const input={environment:'production',accountId:account,sku:'B-PREM',scopeId:'account'};
 for(const patch of [
  {environment:'dev'}, {accountId:'bad'}, {sku:'B:PREM'},
  {scopeId:'bad'}, {environment:null}
 ])assert.throws(()=>lockScope({...input,...patch}),/INVALID_BROADCASTER_LOCK_SCOPE/);
});
test('checkout controller really scopes idempotency, legacy reads, new writes and duplicate fallback',()=>{
 const controller=fs.readFileSync(path.resolve(__dirname,'../controllers/broadcasterBillingController.js'),'utf8');
 assert.ok(controller.includes('findIdempotent(BroadcasterBillingOrder,scope,requestKey)'));
 assert.ok(controller.includes('findExistingLocked(BroadcasterBillingOrder,scope)'));
 assert.ok(controller.includes('releaseOrphanTerminalLock(BroadcasterBillingOrder,existing,scope)'));
 assert.ok(controller.includes('environment:scope.environment,'));
 assert.ok(controller.includes('requestKey,lockKey,status:'));
 assert.ok(controller.includes("scope=lockScope({environment:billingEnv()"));
 assert.ok(controller.includes("findIdempotent(BroadcasterBillingOrder,scope,requestKey)||"));
 assert.ok(!controller.includes("findOne({lockKey}).lean()"));
 assert.ok(!controller.includes("findOne({requestKey}).lean()"));
 assert.ok(!controller.includes("findOne({$or:[{requestKey},{lockKey}]}).lean()"));
});
test('existing Mongo global unique lock index stays unchanged; no production DB migration',()=>{
 const model=fs.readFileSync(path.resolve(__dirname,'../models/BroadcasterBillingOrder.js'),'utf8');
 const lease=fs.readFileSync(path.resolve(__dirname,'../models/BroadcasterCheckoutLease.js'),'utf8');
 assert.ok(model.includes('schema.index({lockKey:1},{unique:true'));
 assert.ok(lease.includes('_id:{type:String,required:true}'));
 assert.ok(lease.includes('schema.index({expiresAt:1},{expireAfterSeconds:0})'));
});
