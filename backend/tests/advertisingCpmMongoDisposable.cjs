'use strict';
// MANUAL INTEGRATION TEST only. Never run against a staging or production app
// database. Use a separate disposable database with a dedicated credential:
// APP_ENV=staging AD_CPM_DISPOSABLE_MONGODB_URI=mongodb://.../ad_cpm_disposable_<unique>
// node backend/tests/advertisingCpmMongoDisposable.cjs
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const {settleQualifiedEvent}=require('../services/advertisingSettlementCore');
const {store}=require('../services/advertisingSettlementStore');
const {ensureAdvertisingFinancialIndexes}=require('../services/advertisingFinancialIndexes');
const Event=require('../models/AdvertisingBillableEvent');
const FundingLot=require('../models/AdvertisingFundingLot');
const {auditFundingSet}=require('../services/advertisingFinancialAudit');
const uri=process.env.AD_CPM_DISPOSABLE_MONGODB_URI||'';
const pathname=uri.split('?')[0];
const disposable=/\/ad_cpm_disposable_[a-zA-Z0-9_-]{8,}$/.test(pathname);
if(process.env.APP_ENV!=='staging'||process.env.NODE_ENV==='production'||
   !disposable||! /^(mongodb|mongodb\+srv):\/\//.test(uri)||
   process.env.AD_CPM_DISPOSABLE_APPROVAL!=='I_CONFIRMED_TEST_ONLY_DATABASE')
 throw Error('Refusing non-disposable/unapproved MongoDB integration test target');
(async()=>{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:7000});
 try{
  await ensureAdvertisingFinancialIndexes();
  const agencyId=new mongoose.Types.ObjectId();
  const campaignId=new mongoose.Types.ObjectId();
  const quoteId=new mongoose.Types.ObjectId();
  const creativeId=new mongoose.Types.ObjectId();
  const funding=await FundingLot.create({
   agencyId,campaignId,quoteId,
   gatewayPaymentId:'test-'+new mongoose.Types.ObjectId(),
   gatewayOrderId:'test-'+new mongoose.Types.ObjectId(),
   budgetMicros:20000,remainingMicros:20000,
   budgetNanos:20000000,remainingNanos:20000000,
   priceVersion:1,ratesMicros:{standard:4000000,hero:8000000,audio:12000000},
   currency:'EUR',source:'nexi_verified',paidAt:new Date()
  });
  const eventId='d'+new mongoose.Types.ObjectId().toHexString()+'0000000';
  const first={eventId,campaignId:String(campaignId),
   creativeId:String(creativeId),kind:'visual',tier:'standard',
   qualifiedAt:new Date().toISOString()};
  const same=await Promise.all(Array.from({length:75},
   ()=>settleQualifiedEvent(first,store)));
  assert.ok(same.every(x=>x.status==='charged'));
  const different=await Promise.all(Array.from({length:50},(_,i)=>
   settleQualifiedEvent({...first,
    eventId:(i+1).toString(16).padStart(32,'0')},store)));
  const refreshed=await FundingLot.findById(funding._id).lean();
  assert.equal(refreshed.remainingNanos,0);
  assert.equal(refreshed.settledEvents.length,5);
  assert.equal(different.filter(x=>x.status==='charged').length,4);
  const ledger=await Event.find({campaignId}).lean();
  assert.equal(auditFundingSet([refreshed],ledger).safe,true);
  console.log('PASS atomic Mongo dedupe, race-safe depletion and exact receipt audit');
  // Only delete records that belong to this uniquely generated test campaign.
  await Event.deleteMany({campaignId});
  await FundingLot.deleteOne({_id:funding._id,campaignId});
 }finally{await mongoose.disconnect();}
})().catch(error=>{console.error(error);process.exitCode=1;});
