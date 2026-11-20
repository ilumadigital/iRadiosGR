'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deleteStationRecord}=require('../services/stationDeletion');
const ID='a'.repeat(24),OWNER='b'.repeat(24),OLD='c'.repeat(24);
function fixture({otherStations=0,history=[],pending=false,failSku=null,
 unavailableSku=null,userMissing=false,broadcasterId=OWNER,oldLock=false,latePending=false}={}){
 const events=[];let record={_id:ID,name:'Test FM',broadcasterId};
 let lock=oldLock?'already-locked':null;
 const Station={
  findById:async()=>record,
  findOneAndUpdate:async(_q,update)=>{
   if(lock)return null;
   lock=update.$set.deletionLockToken;record={...record,...update.$set};
   events.push('lease');return record;
  },
  deleteOne:async query=>{
   assert.equal(query.deletionLockToken,lock);events.push('station:delete');
   record=null;return {deletedCount:1};
  },
  updateOne:async()=>{events.push('lease:release');lock=null;},
  countDocuments:async()=>otherStations
 };
 let checks=0;
 const Order={
  find:()=>({select:()=>({limit:()=>({lean:async()=>history.map(accountId=>({accountId}))})})}),
  exists:async()=>pending||(latePending&&++checks===2)
 };
 const Account={find:()=>({select:()=>({lean:async()=>[OWNER,OLD].filter(id=>!userMissing||id!==OLD)
  .map(_id=>({_id,role:'broadcaster'}))})})};
 const gateway={
  cancelBroadcasterRecurring:async(user,sku,id)=>{
   events.push('cancel:'+user._id+':'+sku+':'+(id||'account'));
   if(sku===failSku)throw Error('network');
   if(sku===unavailableSku)return {state:'unavailable'};
   return {state:'cancelled'};
  },
  broadcasterRecurringStatus:async(user,sku)=>{
   events.push('verify:'+user._id+':'+sku);
   return {state:sku===unavailableSku?'active':'cancelled'};
  }
 };
 return {events,request:{Station,Order,Account,gateway,stationId:ID,confirmationName:'Test FM'}};
}
test('Last station cancels station add-ons and account Premium before delete',async()=>{
 const f=fixture();const result=await deleteStationRecord(f.request);
 assert.equal(result.billing.cancelled.length,4);
 assert.equal(f.events.filter(e=>e.startsWith('cancel:')).length,4);
 assert.equal(f.events.at(-1),'station:delete');
});
test('Additional stations preserve account Premium',async()=>{
 const f=fixture({otherStations:2});const result=await deleteStationRecord(f.request);
 assert.equal(result.billing.accountPremiumPreserved,true);
 assert.equal(result.billing.cancelled.length,3);
 assert.ok(!f.events.some(e=>e.includes(':B-PREM:')));
});
test('Former payer of transferred station is also cancelled',async()=>{
 const f=fixture({history:[OLD],otherStations:1});
 assert.equal((await deleteStationRecord(f.request)).billing.cancelled.length,6);
 assert.equal(f.events.filter(e=>e.startsWith('cancel:'+OLD)).length,3);
});
test('Gateway failure or unavailable status prevents deletion',async()=>{
 for(const params of [{failSku:'ADD-AN'},{unavailableSku:'ADD-DSP'}]){
  const f=fixture(params);
  await assert.rejects(()=>deleteStationRecord(f.request),{code:'STATION_BILLING_NOT_CONFIRMED'});
  assert.ok(!f.events.includes('station:delete'));
  assert.equal(f.events.at(-1),'lease:release');
 }
});
test('Unresolved checkout prevents deletion without contacting Gateway',async()=>{
 const f=fixture({pending:true});
 await assert.rejects(()=>deleteStationRecord(f.request),{code:'STATION_BILLING_IN_FLIGHT'});
 assert.deepEqual(f.events,['lease','lease:release']);
});
test('A payment starting during Gateway cancellation prevents station removal',async()=>{
 const f=fixture({latePending:true});
 await assert.rejects(()=>deleteStationRecord(f.request),{code:'STATION_BILLING_IN_FLIGHT'});
 assert.ok(!f.events.includes('station:delete'));
 assert.equal(f.events.at(-1),'lease:release');
});
test('Missing past payer blocks deletion',async()=>{
 const f=fixture({history:[OLD],userMissing:true});
 await assert.rejects(()=>deleteStationRecord(f.request),{code:'STATION_BILLING_NOT_CONFIRMED'});
 assert.ok(!f.events.some(e=>e.startsWith('cancel:')));
});
test('Parallel delete and wrong confirmation do not cancel',async()=>{
 const f=fixture({oldLock:true});
 await assert.rejects(()=>deleteStationRecord(f.request),{status:409});
 assert.deepEqual(f.events,[]);
 const g=fixture();
 await assert.rejects(()=>deleteStationRecord({...g.request,confirmationName:'No'}),{status:409});
 await assert.rejects(()=>deleteStationRecord({...g.request,stationId:'invalid'}),{status:400});
 assert.deepEqual(g.events,[]);
});
test('Free station with no registered owner or mandate may be deleted',async()=>{
 const f=fixture({broadcasterId:null});
 const r=await deleteStationRecord(f.request);
 assert.deepEqual(r.billing.cancelled,[]);
 assert.deepEqual(f.events,['lease','station:delete']);
});
