'use strict';
// ACTUAL MongoDB transaction UAT, destructive only on the explicit disposable CI DB.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const mongoose=require('mongoose');
const Campaign=require('../models/AdvertisingCampaign');
const Lot=require('../models/AdvertisingFundingLot');
const Daily=require('../models/AdvertisingDailyBudget');
const Change=require('../models/AdvertisingDailyBudgetChange');
const ledger=require('../services/advertisingV2Ledger');
const {changeDailyBudget,getDailyBudget}=require('../services/advertisingDailyBudgetManager');
const policy=require('../services/advertisingV2Policy');
const uri=process.env.AD_V2_DISPOSABLE_MONGODB_URI;
if(process.env.APP_ENV!=='staging'||process.env.CI!=='true'||
 process.env.AD_V2_DISPOSABLE_APPROVAL!=='I_CONFIRMED_TEST_ONLY_DATABASE'||
 !uri||!uri.includes('ad_v2_disposable_ci_20261115')||
 process.env.ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED!=='1'||
 process.env.IRADIOS_BILLING_SANDBOX_ENABLED!=='1')
 throw Error('Disposable database guard missing');
async function makeFixture(){
 const agencyId=new mongoose.Types.ObjectId();
 const campaign=await Campaign.create({agencyId,title:'Agency daily limit CI',
  brand:'Test brand',startsAt:new Date(Date.now()-86400000),
  endsAt:new Date(Date.now()+86400000),workflowVersion:2,
  createdByRole:'agency',approvalStatus:'approved',isStageCampaign:true,
  plannedBudgetCents:2000,dailyBudgetCents:200});
 await Lot.create({agencyId,campaignId:campaign._id,
  quoteId:new mongoose.Types.ObjectId(),
  gatewayPaymentId:'test-'+crypto.randomBytes(16).toString('hex'),
  gatewayOrderId:'test-'+crypto.randomBytes(16).toString('hex'),
  budgetMicros:20000000,remainingMicros:20000000,
  budgetNanos:20_000_000_000,remainingNanos:20_000_000_000,
  rateModel:'v2_event',settlementMode:'mongo_transaction_v2',
  rateCardSnapshot:{audio:policy.AUDIO_RATE_CARD,visual:policy.VISUAL_IMPRESSION_NANOS},
  priceVersion:2,ratesMicros:{standard:4000000,hero:8000000,audio:12000000},
  currency:'EUR',source:'nexi_verified',paidAt:new Date()});
 return {campaignId:campaign._id,agencyId};
}
async function edit(f,newCents,expected){
 return changeDailyBudget({...f,dailyBudgetCents:newCents,
  expectedDailyBudgetCents:expected});
}
async function main(){
 await mongoose.connect(uri,{serverSelectionTimeoutMS:8000});
 try{
  const f=await makeFixture(), key=crypto.randomBytes(32).toString('hex');
  await assert.rejects(edit({...f,agencyId:new mongoose.Types.ObjectId()},500,200),
   e=>e.status===404);
  let got=await getDailyBudget(f);
  assert.equal(got.dailyBudgetCents,200);
  const first=await edit(f,500,200);
  assert.equal(first.changed,true);
  got=await getDailyBudget(f);
  assert.equal(got.dailyBudgetCents,500);
  assert.equal(got.limitNanos,5_000_000_000);
  assert.equal(got.history.length,1);
  let day=await Daily.findOne({campaignId:f.campaignId}).lean();
  assert.equal(day.limitNanos,5_000_000_000);
  await assert.rejects(edit(f,500,200),e=>e.status===409);
  // Real reservation creates an indivisible EUR 1.81 hold.
  const ticket=await ledger.reserve({
   campaign:{_id:f.campaignId,dailyBudgetCents:500,plannedBudgetCents:2000},
   creative:{_id:new mongoose.Types.ObjectId()},kind:'audio',
   placement:'entry',durationMs:20000,clientKey:key});
  day=await Daily.findOne({campaignId:f.campaignId}).lean();
  assert.equal(day.reservedNanos,1_810_000_000);
  await assert.rejects(edit(f,100,500),e=>e.status===409);
  assert.equal((await Campaign.findById(f.campaignId)).dailyBudgetCents,500);
  await ledger.release({value:ticket.capability,key});
  await edit(f,200,500);
  // Stage-only synthetic spend simulates a previously qualified EUR 0.36
  // settlement; no financial record is created outside the disposable DB.
  await Daily.updateOne({campaignId:f.campaignId},
   {$set:{spentNanos:360_000_000,reservedNanos:0}});
  const low=await Daily.findOne({campaignId:f.campaignId}).lean();
  assert.equal(low.limitNanos-low.spentNanos,1_640_000_000);
  await assert.rejects(ledger.reserve({
   campaign:{_id:f.campaignId,dailyBudgetCents:200,plannedBudgetCents:2000},
   creative:{_id:new mongoose.Types.ObjectId()},kind:'audio',
   placement:'entry',durationMs:20000,clientKey:key
  }),()=>true);
  await edit(f,500,200);
  const fresh=await ledger.reserve({
   campaign:{_id:f.campaignId,dailyBudgetCents:500,plannedBudgetCents:2000},
   creative:{_id:new mongoose.Types.ObjectId()},kind:'audio',
   placement:'entry',durationMs:20000,clientKey:key});
  await ledger.release({value:fresh.capability,key});
  assert.equal((await Daily.findOne({campaignId:f.campaignId})).limitNanos,5_000_000_000);
  assert.equal((await Change.countDocuments({campaignId:f.campaignId})),3);
  const noChange=await edit(f,500,500);
  assert.equal(noChange.changed,false);
  assert.equal((await Change.countDocuments({campaignId:f.campaignId})),3);
  // Campaign + daily cap + audit commit as one unit (no financing mutation).
  const lot=await Lot.findOne({campaignId:f.campaignId});
  assert.equal(lot.budgetNanos,20_000_000_000);
  console.log('PASS: agency daily cap edits, spent/hold protection, replay CAS and real v2 reservation readiness');
 }finally{
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
