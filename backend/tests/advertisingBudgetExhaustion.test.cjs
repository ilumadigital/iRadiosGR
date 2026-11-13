'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {activeCreativeTiers,evaluateBudgetAffordability,
 shouldNotifyBudgetExhausted}=require('../services/advertisingBudgetAffordability');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const lot=(remainingNanos,rate=4000000,patch={})=>({
 source:'nexi_verified',settlementMode:'mongo_transaction_v2',
 budgetNanos:100000000,remainingNanos,
 ratesMicros:{standard:rate,hero:8000000,audio:12000000},
 settledEvents:[],...patch
});
test('only approved active creative placements produce billable CPM tiers',()=>{
 assert.deepEqual(activeCreativeTiers([
  {status:'active',isActive:true,placement:['hero','home']},
  {status:'pending',isActive:true,placement:['radio_feed']},
  {status:'active',isActive:false,placement:['news_feed']}
 ],[{status:'active'}]),['standard','hero','audio']);
 assert.deepEqual(activeCreativeTiers([
  {status:'active',isActive:true,placement:['hero']}
 ],[]),['hero']);
 assert.deepEqual(activeCreativeTiers([],[]),[]);
});
test('one lot barely below CPM cannot buy an impression; email can request top-up',()=>{
 const status=evaluateBudgetAffordability([lot(3999999)],['standard']);
 assert.equal(status.status,'below_minimum_event_cost');
 assert.equal(status.canDeliver,false);
 assert.equal(shouldNotifyBudgetExhausted(status.status),true);
});
test('budget exhaustion means zero canonical nano-EUR available',()=>{
 const status=evaluateBudgetAffordability([lot(0)],['standard','audio']);
 assert.equal(status.status,'exhausted');
 assert.equal(status.remainingNanos,0);
 assert.equal(shouldNotifyBudgetExhausted(status.status),true);
});
test('historical CPM per funding lot is preserved after Admin price changes',()=>{
 const result=evaluateBudgetAffordability([
  lot(5000000,8000000),lot(4500000,4000000)
 ],['standard']);
 assert.equal(result.canDeliver,true);
 assert.equal(result.status,'funded');
 assert.equal(result.remainingNanos,9500000);
});
test('two insufficient funding lots do not combine into a phantom paid impression',()=>{
 const status=evaluateBudgetAffordability([
  lot(2000000),lot(3000000)
 ],['standard']);
 assert.equal(status.status,'below_minimum_event_cost');
 assert.equal(status.remainingNanos,5000000);
});
test('embedded receipt-cap block is NOT reported as depleted budget',()=>{
 const capped=lot(10000000,4000000,{
  settlementMode:'embedded_receipts',
  settledEvents:Array.from({length:6000},(_,i)=>({eventId:String(i)}))
 });
 const x=evaluateBudgetAffordability([capped],['standard']);
 assert.equal(x.status,'receipt_capacity_blocked');
 assert.equal(shouldNotifyBudgetExhausted(x.status),false);
 const withSecond=evaluateBudgetAffordability([capped,lot(5000000)],['standard']);
 assert.equal(withSecond.status,'funded');
});
test('legacy micros-only or financially corrupt lots never trigger exhaustion mail',()=>{
 for(const broken of [
  {source:'nexi_verified',budgetMicros:1000000,remainingMicros:0,
   ratesMicros:{standard:4000000}},
  lot(-1),lot(101000000),lot(0,4000000,{settlementMode:'unsupported'}),
  lot(5000000,4000000,{ratesMicros:{}}),
  lot(0,4000000,{source:'admin_complimentary'})
 ]){
  const x=evaluateBudgetAffordability([broken],['standard']);
  assert.equal(x.status,'needs_financial_review');
  assert.equal(shouldNotifyBudgetExhausted(x.status),false);
 }
});
test('unapproved or unfunded campaigns do not receive synthetic exhaustion mail',()=>{
 assert.equal(evaluateBudgetAffordability([],['standard']).status,'not_funded');
 assert.equal(evaluateBudgetAffordability([lot(0)],[]).status,'no_active_creatives');
 const source=read('services/advertisingBudgetExhaustionNotifier.js');
 assert.match(source,/approvalStatus:'approved'/);
 assert.match(source,/status:'charged'/);
 assert.match(source,/budget-exhausted:/);
 assert.match(source,/\.at\(-1\)/);
 assert.match(source,/mailer\.enqueue\(\{eventKey,kind:'budget_exhausted'/);
 const scheduler=read('services/advertisingCampaignMailScheduler.js');
 assert.match(scheduler,/eventKey,kind,campaignId:campaign\._id/);
 assert.match(scheduler,/error\.code!==11000/);
});
