'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {settleQualifiedEventTransactional}=require('../services/advertisingTransactionalCore');
const {auditFundingSet}=require('../services/advertisingFinancialAudit');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const campaign='a'.repeat(24),creative='b'.repeat(24),lotId='c'.repeat(24);
const when='2026-11-13T12:00:00.000Z',charge=4000000;
const input=(id,patch={})=>({
 eventId:id.toString(16).padStart(32,'0'),
 campaignId:campaign,creativeId:creative,kind:'visual',tier:'standard',
 qualifiedAt:when,...patch
});
function fakeTransactionalStore(balance=20000000,opts={}){
 const events=new Map();
 let remaining=balance,charges=0,commitCalls=0;
 const clone=o=>o&&structuredClone(o);
 const store={
  ensureIndexes:async()=>true,
  getEvent:async id=>clone(events.get(id)||null),
  claimEvent:async request=>{
   if(!events.has(request.eventId)&&remaining>=charge)events.set(request.eventId,{
    _id:request.eventId,campaignId:request.campaignId,creativeId:request.creativeId,
    kind:request.kind,tier:request.tier,qualifiedAt:request.qualifiedAt,
    fundingLotId:lotId,rateMicros:charge,costNanos:charge,
    status:'pending',settledAt:null
   });
   return clone(events.get(request.eventId)||null);
  },
  transactionalDebit:async event=>{
   commitCalls++;
   await Promise.resolve();
   const saved=events.get(event._id);
   if(saved.status==='charged')return 'already_charged';
   if(opts.failBeforeCommit&&commitCalls===1)
    throw Error('Replica set transaction aborted; no commit');
   if(remaining<event.costNanos)return 'unfunded';
   // This is ONE simulated atomic transaction: balance and ledger marker
   // commit simultaneously; there is no split mutable state.
   remaining-=event.costNanos;
   charges++;
   saved.status='charged';
   saved.settledAt=new Date();
   if(opts.unknownAfterCommit&&charges===1)
    throw Error('UnknownTransactionCommitResult');
   return 'charged';
  }
 };
 return {store,events,getBalance:()=>remaining,getCharges:()=>charges};
}
test('100 duplicate claims under simulated transaction commit only once',async()=>{
 const f=fakeTransactionalStore(20000000);
 const results=await Promise.all(Array.from({length:100},
  ()=>settleQualifiedEventTransactional(input(1),f.store)));
 assert.ok(results.every(r=>r.status==='charged'));
 assert.equal(f.getCharges(),1);
 assert.equal(f.getBalance(),16000000);
 assert.equal(f.events.size,1);
});
test('80 independent CPM events cannot overdraw 5-event transactional wallet',async()=>{
 const f=fakeTransactionalStore(20000000);
 const results=await Promise.all(Array.from({length:80},
  (_,i)=>settleQualifiedEventTransactional(input(100+i),f.store)));
 assert.equal(results.filter(r=>r.status==='charged').length,5);
 assert.equal(f.getCharges(),5);
 assert.equal(f.getBalance(),0);
 assert.ok(results.every(r=>['charged','pending','unfunded'].includes(r.status)));
});
test('unknown commit result is recovered from durable charged marker',async()=>{
 const f=fakeTransactionalStore(20000000,{unknownAfterCommit:true});
 const first=await settleQualifiedEventTransactional(input(2),f.store);
 assert.equal(first.status,'charged');
 assert.equal(first.duplicate,true);
 const replay=await settleQualifiedEventTransactional(input(2),f.store);
 assert.equal(replay.duplicate,true);
 assert.equal(f.getCharges(),1);
});
test('transactional failure BEFORE commit fails closed and recovers on replay',async()=>{
 const f=fakeTransactionalStore(20000000,{failBeforeCommit:true});
 await assert.rejects(
  ()=>settleQualifiedEventTransactional(input(3),f.store),/aborted/);
 assert.equal(f.getBalance(),20000000);
 assert.equal(f.events.get(input(3).eventId).status,'pending');
 const next=await settleQualifiedEventTransactional(input(3),f.store);
 assert.equal(next.status,'charged');
 assert.equal(f.getCharges(),1);
});
test('same event ID with different creative or qualification is a collision',async()=>{
 const f=fakeTransactionalStore();
 await settleQualifiedEventTransactional(input(4),f.store);
 for(const patch of [{creativeId:'d'.repeat(24)},{tier:'hero'},
  {qualifiedAt:'2026-11-13T13:00:00.000Z'},
  {campaignId:'f'.repeat(24)}])
  await assert.rejects(
   ()=>settleQualifiedEventTransactional(input(4,patch),f.store),/collision/);
 assert.equal(f.getCharges(),1);
});
test('transactional balance reconciliation uses charged ledger, NOT embedded receipts',()=>{
 const id=input(5).eventId;
 const lot={_id:lotId,campaignId:campaign,
  settlementMode:'mongo_transaction_v2',
  budgetNanos:8000000,remainingNanos:4000000,remainingMicros:4000,
  ratesMicros:{standard:charge},settledEvents:[]};
 const event={_id:id,campaignId:campaign,creativeId:creative,
  tier:'standard',fundingLotId:lotId,costNanos:charge,
  rateMicros:charge,status:'charged',settledAt:new Date()};
 const healthy=auditFundingSet([lot],[event]);
 assert.equal(healthy.safe,true);
 assert.equal(healthy.reports[0].receiptCount,1);
 assert.equal(healthy.reports[0].settlementMode,'mongo_transaction_v2');
 const noEvent=auditFundingSet([lot],[]);
 assert.equal(noEvent.safe,false);
 assert.ok(noEvent.issues.some(x=>x.includes('balance_receipt_mismatch')));
 const stale=auditFundingSet([lot],[{...event,status:'pending',settledAt:null}]);
 assert.equal(stale.safe,false);
 const mixed=auditFundingSet([{...lot,settledEvents:[{eventId:id}]}],[event]);
 assert.equal(mixed.safe,false);
 assert.ok(mixed.issues.some(x=>x.includes('mixed')));
});
test('embedded recovery cannot charge v2 transactional lot; protocol is permanently scoped',()=>{
 const legacy=read('services/advertisingSettlementStore.js');
 assert.match(legacy,/settlementMode:\{\$ne:'mongo_transaction_v2'\}/);
 const recovery=read('services/advertisingSettlementRecovery.js');
 assert.match(recovery,/settlementMode==='mongo_transaction_v2'/);
 assert.match(recovery,/AD_CPM_RECOVERY_MANUAL_APPROVAL/);
 assert.match(read('services/advertisingDeliveryEligibility.js'),
  /const ATOMIC_SETTLEMENT_IMPLEMENTED=false/);
});
test('Mongo implementation commits wallet and receipt in ONE majority transaction',()=>{
 const source=read('services/advertisingTransactionalSettlement.js');
 assert.match(source,/session\.withTransaction\(/);
 assert.match(source,/writeConcern:\{w:'majority'\}/);
 assert.match(source,/readConcern:\{level:'snapshot'\}/);
 assert.match(source,/FundingLot\.updateOne\(/);
 assert.match(source,/Event\.updateOne\(/);
 assert.match(source,/\{session\}/);
 assert.match(source,/status:'charged',settledAt:new Date\(\)/);
 assert.match(source,/settlementMode:'mongo_transaction_v2'/);
 assert.doesNotMatch(source,/MAX_RECEIPTS_PER_LOT/);
});
