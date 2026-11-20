'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const path=require('node:path');
const target=path.resolve(__dirname,'../services/broadcasterCheckoutLease.js');
const beforeLoad=Module._load;
const account='507f1f77bcf86cd799439011';
const key1='iradios-bstage-'+account+'-00000000-0000-4000-8000-000000000001';
const key2='iradios-bstage-'+account+'-00000000-0000-4000-8000-000000000002';
const leases=new Map();
let indexes=0;
const Model={
 async createIndexes(){indexes++;},
 async findOneAndUpdate(query,change){
  const now=query.$or[0].expiresAt.$lte;
  const old=leases.get(query._id);
  const sameOwner=old?.ownerKey===change.$set.ownerKey;
  if(old&&+old.expiresAt>+now&&!sameOwner)
   throw Object.assign(new Error('Duplicate account lease'),{code:11000});
  const value={_id:query._id,...change.$set};
  leases.set(query._id,value);
  return {...value};
 },
 async deleteOne(query){
  const old=leases.get(query._id);
  if(old&&query.ownerKey===old.ownerKey){
   leases.delete(query._id);return {deletedCount:1};
  }
  return {deletedCount:0};
 }
};
Module._load=function(request,parent,isMain){
 if(request==='../models/BroadcasterCheckoutLease'&&parent?.filename===target)return Model;
 return beforeLoad.apply(this,arguments);
};
const guard=require(target);
test.after(()=>{Module._load=beforeLoad});
const stage={environment:'staging'};
const prod={environment:'production'};
const time=new Date('2026-11-11T12:00:00Z');
test('a monthly checkout serializes its own tenant/account but not the other tenant',async()=>{
 leases.clear();
 assert.equal(await guard.acquire(account,key1,{...stage,now:time}),true);
 assert.equal(await guard.acquire(account,key2,{...stage,now:time}),false);
 assert.equal(await guard.acquire(account,key2,{...prod,now:time}),true);
 assert.equal(leases.size,2);
 assert.ok(leases.has('staging:'+account));
 assert.ok(leases.has('production:'+account));
 assert.ok(indexes>=3);
});
test('staging release can never release a production lease',async()=>{
 leases.clear();
 assert.equal(await guard.acquire(account,key1,{...stage,now:time}),true);
 assert.equal(await guard.acquire(account,key1,{...prod,now:time}),true);
 assert.deepEqual(await guard.release(account,key1,stage),{deletedCount:1});
 assert.ok(leases.has('production:'+account));
 assert.deepEqual(await guard.release(account,key1,prod),{deletedCount:1});
 assert.equal(leases.size,0);
});
test('stale request cannot release the next owner after TTL expiry',async()=>{
 leases.clear();
 const t2=new Date(+time+6*60000);
 assert.equal(await guard.acquire(account,key1,{...prod,now:time}),true);
 assert.equal(await guard.acquire(account,key2,{...prod,now:t2}),true);
 assert.deepEqual(await guard.release(account,key1,prod),{deletedCount:0});
 assert.equal(leases.get('production:'+account).ownerKey,key2);
 assert.deepEqual(await guard.release(account,key2,prod),{deletedCount:1});
});
test('legacy ObjectId leases remain isolated and may expire naturally',async()=>{
 leases.clear();
 leases.set(account,{_id:account,ownerKey:key1,expiresAt:new Date(+time+120000)});
 assert.equal(await guard.acquire(account,key2,{...prod,now:time}),true);
 assert.equal(await guard.acquire(account,key1,{...stage,now:time}),true);
 assert.ok(leases.has(account));
 assert.ok(leases.has('production:'+account));
 assert.ok(leases.has('staging:'+account));
});
test('invalid environment, account, request ownership or missing scope fail closed',async()=>{
 for(const env of ['bad',undefined,null]){
  await assert.rejects(guard.acquire(account,key1,{environment:env}),/Invalid Broadcaster/);
 }
 await assert.rejects(guard.acquire('bad',key1,prod),/Invalid Broadcaster/);
 await assert.rejects(guard.acquire(account,'wrong-key',prod),/Invalid Broadcaster/);
 await assert.rejects(guard.acquire(account,
   'iradios-bstage-507f1f77bcf86cd799439022-00000000-0000-4000-8000-000000000001',
   prod),/Invalid Broadcaster/);
 assert.throws(()=>guard.scopedLeaseId(account,key1,'other'),/Invalid Broadcaster/);
});
