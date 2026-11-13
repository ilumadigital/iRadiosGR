'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {reserveTicketQuotas}=require('../services/advertisingTicketReservation');
const quotas=[
 {key:'global',max:2,expiry:5000},
 {key:'quiet',max:1,expiry:5000},
 {key:'hour',max:3,expiry:5000}
];
function memory(initial={}){
 const counts=new Map(Object.entries(initial));
 const calls={reserves:0,releases:0,tickets:0};
 return {counts,calls,adapter:{
  reserve:async(key,max)=>{
   calls.reserves++;
   if((counts.get(key)||0)>=max)return false;
   counts.set(key,(counts.get(key)||0)+1);return true;
  },
  release:async key=>{
   calls.releases++;
   const n=counts.get(key)||0;
   if(n<1)throw Error('Counter underflow');
   counts.set(key,n-1);
  }
 }};
}
test('a confirmed ticket retains exactly its atomic quotas',async()=>{
 const db=memory();
 const result=await reserveTicketQuotas(quotas,db.adapter,async()=>{
  db.calls.tickets++;return {id:'ticket-1'};
 });
 assert.deepEqual(result,{status:'issued',value:{id:'ticket-1'}});
 assert.deepEqual([...db.counts.values()],[1,1,1]);
 assert.equal(db.calls.releases,0);
});
test('later quota rejection rolls back only reservations owned by the attempt',async()=>{
 const db=memory({quiet:1,global:1});
 const result=await reserveTicketQuotas(quotas,db.adapter,async()=>{db.calls.tickets++;});
 assert.deepEqual(result,{status:'blocked',key:'quiet'});
 assert.equal(db.counts.get('global'),1);
 assert.equal(db.counts.get('quiet'),1);
 assert.equal(db.calls.tickets,0);
 assert.equal(db.calls.releases,1);
});
test('Mongo ticket insert failure does not burn any granted quota',async()=>{
 const db=memory();
 await assert.rejects(()=>reserveTicketQuotas(quotas,db.adapter,async()=>{
  throw Error('Simulated Mongo failed ticket create');
 }),/Simulated Mongo/);
 assert.deepEqual([...db.counts.values()],[0,0,0]);
 assert.equal(db.calls.releases,3);
});
test('concurrent candidate issuance obeys a shared cap and every loser compensates',async()=>{
 const db=memory();
 const attempts=await Promise.all(Array.from({length:80},(_,i)=>
  reserveTicketQuotas(quotas,db.adapter,async()=>({id:i}))));
 assert.equal(attempts.filter(x=>x.status==='issued').length,1);
 assert.equal(db.counts.get('quiet'),1);
 assert.equal(db.counts.get('hour'),1);
 assert.equal(db.counts.get('global'),1);
});
test('null / unavailable ticket issuance also returns reservations',async()=>{
 const db=memory();
 const result=await reserveTicketQuotas(quotas,db.adapter,async()=>null);
 assert.equal(result.status,'unavailable');
 assert.deepEqual([...db.counts.values()],[0,0,0]);
});
test('finance and public qualification gates stay disconnected from reservations',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const engine=read('services/advertisingQualificationEngine.js');
 assert.match(engine,/reserveTicketQuotas\(quotas,adapter/);
 assert.match(engine,/await durationForAudio\(item\.creative\)/);
 assert.match(engine,/release:async key/);
 assert.doesNotMatch(engine,/settleQualifiedEvent|atomicDebitWithReceipt|transactionalDebit/);
 assert.match(read('services/advertisingDeliveryEligibility.js'),
  /const ATOMIC_SETTLEMENT_IMPLEMENTED=false/);
});
