'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {settleQualifiedEvent}=require('../services/advertisingSettlementCore');
const {aggregateBalances,fromLot}=require('../services/advertisingBalances');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
const campaign='a'.repeat(24),creative='b'.repeat(24),lotId='c'.repeat(24);
const at='2026-11-13T12:00:00.000Z';
const ad=(n=1,patch={})=>({
 eventId:n.toString(16).padStart(32,'0'),campaignId:campaign,
 creativeId:creative,kind:'visual',tier:'standard',qualifiedAt:at,...patch
});
function fakeStore(startNanos=20000000,opts={}){
 const events=new Map(),receipts=new Map();
 const lot={_id:lotId,remainingNanos:startNanos,ratesMicros:{
  standard:4000000,hero:8000000,audio:12000000
 }};
 const calls={debits:0,claims:0,marked:0};
 const copy=v=>v&&structuredClone(v);
 const store={
  getEvent:async id=>copy(events.get(id)||null),
  chooseFundedLot:async(_,tier)=>{
   if(receipts.size>=6000||lot.remainingNanos<lot.ratesMicros[tier])return null;
   return copy(lot);
  },
  claimEvent:async record=>{
   calls.claims++;
   if(!events.has(record._id))events.set(record._id,copy(record));
   return copy(events.get(record._id));
  },
  findReceipt:async record=>copy(receipts.get(record._id)||null),
  atomicDebitWithReceipt:async record=>{
   // One synchronous JS section models a Mongo atomic conditional update:
   // filter includes remaining >= cost AND absent permanent event marker.
   const existed=receipts.has(record._id);
   if(existed||lot.remainingNanos<record.costNanos||
      receipts.size>=6000)return false;
   lot.remainingNanos-=record.costNanos;calls.debits++;
   receipts.set(record._id,{eventId:record._id,costNanos:record.costNanos,
    tier:record.tier,creativeId:record.creativeId});
   if(opts.throwAfterDebit&&calls.debits===1)
    throw Error('Simulated network timeout AFTER confirmed Mongo write');
   return true;
  },
  markCharged:async id=>{
   calls.marked++;
   if(opts.failFirstLedgerFinalize&&calls.marked===1)
    throw Error('Simulated process crash between debit and ledger finalization');
   const row=events.get(id);
   row.status='charged';
   return copy(row);
  }
 };
 return {store,lot,events,receipts,calls};
}
test('one qualified CPM event debits exactly 4,000,000 nanos; replay cannot charge again',async()=>{
 const {store,lot,calls}=fakeStore();
 const first=await settleQualifiedEvent(ad(1),store);
 assert.equal(first.status,'charged');
 assert.equal(first.costNanos,4000000);
 assert.equal(lot.remainingNanos,16000000);
 const replay=await settleQualifiedEvent(ad(1),store);
 assert.equal(replay.duplicate,true);
 assert.equal(calls.debits,1);
 assert.equal(lot.remainingNanos,16000000);
});
test('100 concurrent retries sharing an event ID cost exactly ONE impression',async()=>{
 const {store,lot,calls}=fakeStore(1000000000);
 const responses=await Promise.all(Array.from({length:100},()=>settleQualifiedEvent(ad(2),store)));
 assert.ok(responses.every(r=>r.status==='charged'));
 assert.equal(calls.debits,1);
 assert.equal(lot.remainingNanos,996000000);
});
test('concurrent distinct events cannot overdraw the funding lot',async()=>{
 const {store,lot,calls,receipts}=fakeStore(20000000);
 const responses=await Promise.all(Array.from({length:80},(_,i)=>settleQualifiedEvent(ad(i+10),store)));
 assert.equal(responses.filter(r=>r.status==='charged').length,5);
 assert.equal(calls.debits,5);
 assert.equal(receipts.size,5);
 assert.equal(lot.remainingNanos,0);
 assert.ok(responses.every(r=>['charged','unfunded','pending'].includes(r.status)));
});
test('outcome unknown AFTER atomic debit: replay finds receipt and does not debit twice',async()=>{
 const {store,lot,calls}=fakeStore(20000000,{throwAfterDebit:true});
 const first=await settleQualifiedEvent(ad(3),store);
 assert.equal(first.status,'charged');
 assert.equal(lot.remainingNanos,16000000);
 assert.equal((await settleQualifiedEvent(ad(3),store)).duplicate,true);
 assert.equal(calls.debits,1);
});
test('process crashes before central ledger update; same event reconciles without charging',async()=>{
 const {store,lot,calls,events}=fakeStore(20000000,{failFirstLedgerFinalize:true});
 await assert.rejects(()=>settleQualifiedEvent(ad(4),store),/process crash/);
 assert.equal(events.get(ad(4).eventId).status,'pending');
 assert.equal(lot.remainingNanos,16000000);
 const recovered=await settleQualifiedEvent(ad(4),store);
 assert.equal(recovered.status,'charged');
 assert.equal(recovered.duplicate,true);
 assert.equal(calls.debits,1);
});
test('event ID cannot be reused across campaigns, creatives or different qualifications',async()=>{
 const {store,lot}=fakeStore();
 await settleQualifiedEvent(ad(5),store);
 for(const update of [{creativeId:'d'.repeat(24)},{campaignId:'e'.repeat(24)},
  {qualifiedAt:'2026-11-13T13:00:00.000Z'},{tier:'hero'}]){
  await assert.rejects(()=>settleQualifiedEvent(ad(5,update),store),/collision/);
 }
 assert.equal(lot.remainingNanos,16000000);
});
test('funding sum stays exact across nanos and older micros-only lots',()=>{
 const lots=[
  {budgetNanos:1000000000,remainingNanos:999999999,
   budgetMicros:1000000,remainingMicros:1000000},
  {budgetMicros:500000,remainingMicros:250000}
 ];
 assert.deepEqual(aggregateBalances(lots),{
  fundedNanos:1500000000,remainingNanos:1249999999,spentNanos:250000001,
  fundedMicros:1500000,remainingMicros:1249999,spentMicros:250000
 });
 assert.equal(fromLot(lots[0]).remainingNanos,999999999);
 assert.throws(()=>aggregateBalances([{budgetNanos:100,remainingNanos:101}]),/Invalid/);
});
test('settlement adapter persists debit+receipt in a single guarded Mongo update',()=>{
 const src=read('services/advertisingSettlementStore.js');
 assert.match(src,/\[capPath\]:\{\$exists:false\}/);
 assert.match(src,/remainingNanos:\{\$gte:amount\}/);
 assert.match(src,/'settledEvents\.eventId':\{\$ne:event\._id\}/);
 assert.match(src,/\$subtract:\['\$remainingNanos',amount\]/);
 assert.match(src,/\$concatArrays:/);
 assert.match(src,/const MAX_RECEIPTS_PER_LOT=6000/);
 assert.match(read('models/AdvertisingBillableEvent.js'),/status:\{type:String,enum:\['pending','charged'\]/);
 assert.match(read('services/advertisingFinancialIndexes.js'),/Event\.createIndexes\(\)/);
 assert.match(read('services/advertisingDeliveryEligibility.js'),/const ATOMIC_SETTLEMENT_IMPLEMENTED=false/);
});
