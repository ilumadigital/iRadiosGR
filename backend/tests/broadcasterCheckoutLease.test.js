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
let lease=null,indexes=0;
const Model={
 async createIndexes(){indexes++;},
 async findOneAndUpdate(query,change){
  const now=query.$or[0].expiresAt.$lte;
  const sameOwner=lease?.ownerKey===change.$set.ownerKey;
  if(lease&&+lease.expiresAt>+now&&!sameOwner)
   throw Object.assign(new Error('Duplicate account lock'),{code:11000});
  lease={_id:query._id,...change.$set};
  return {...lease};
 },
 async deleteOne(query){
  if(lease&&String(query._id)===String(lease._id)&&
   query.ownerKey===lease.ownerKey){lease=null;return {deletedCount:1};}
  return {deletedCount:0};
 }
};
Module._load=function(request,parent,isMain){
 if(request==='../models/BroadcasterCheckoutLease'&&parent?.filename===target)return Model;
 return beforeLoad.apply(this,arguments);
};
const guard=require(target);
test.after(()=>{Module._load=beforeLoad});
test('Only one distinct monthly checkout may preflight an account at a time',async()=>{
 lease=null;
 assert.equal(await guard.acquire(account,key1,new Date('2026-11-11T12:00:00Z')),true);
 assert.equal(await guard.acquire(account,key2,new Date('2026-11-11T12:00:01Z')),false);
 assert.equal(await guard.release(account,key1),1>0?{deletedCount:1}:null);
 assert.equal(await guard.acquire(account,key2,new Date('2026-11-11T12:00:02Z')),true);
 assert.ok(indexes>=2);
});
test('A stale checkout cannot release the next owner’s lease',async()=>{
 lease=null;
 const t1=new Date('2026-11-11T12:00:00Z'),t2=new Date('2026-11-11T12:06:00Z');
 assert.equal(await guard.acquire(account,key1,t1),true);
 assert.equal(await guard.acquire(account,key2,t2),true);
 assert.deepEqual(await guard.release(account,key1),{deletedCount:0});
 assert.equal(lease.ownerKey,key2);
 assert.deepEqual(await guard.release(account,key2),{deletedCount:1});
});
test('Reject invalid account or idempotency ownership',async()=>{
 await assert.rejects(guard.acquire('bad',key1),/Invalid Broadcaster/);
 await assert.rejects(guard.acquire(account,'wrong-key'),/Invalid Broadcaster/);
});
