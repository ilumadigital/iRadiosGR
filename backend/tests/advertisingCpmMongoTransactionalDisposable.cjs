'use strict';
// Manual E2E test: dedicated disposable MongoDB REPLICA SET only.
// APP_ENV=staging AD_CPM_DISPOSABLE_MONGODB_URI=mongodb://.../ad_cpm_disposable_<unique>
// node backend/tests/advertisingCpmMongoTransactionalDisposable.cjs
// NEVER pass the iRadios staging app URI, Gateway DB or production cluster.
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const Event=require('../models/AdvertisingBillableEvent');
const FundingLot=require('../models/AdvertisingFundingLot');
const {ensureAdvertisingFinancialIndexes}=require('../services/advertisingFinancialIndexes');
const {settleQualifiedEventTransactional}=
 require('../services/advertisingTransactionalSettlement');
const {auditFundingSet}=require('../services/advertisingFinancialAudit');
const uri=process.env.AD_CPM_DISPOSABLE_MONGODB_URI||'';
const pathname=uri.split('?')[0];
if(process.env.APP_ENV!=='staging'||process.env.NODE_ENV==='production'||
   !/\/ad_cpm_disposable_[a-zA-Z0-9_-]{8,}$/.test(pathname)||
   !/^(mongodb|mongodb\+srv):\/\//.test(uri)||
   process.env.AD_CPM_DISPOSABLE_APPROVAL!=='I_CONFIRMED_TEST_ONLY_DATABASE')
 throw Error('Refusing non-disposable/unapproved transactional MongoDB test target');
(async()=>{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000,
  retryWrites:true});
 let campaignId,lotId;
 try{
  const hello=await mongoose.connection.db.admin().command({hello:1});
  if(!hello.setName)
   throw Error('Replica set required; standalone MongoDB cannot test transactions');
  await ensureAdvertisingFinancialIndexes();
  campaignId=new mongoose.Types.ObjectId();
  const creativeId=new mongoose.Types.ObjectId();
  const lot=await FundingLot.create({
   agencyId:new mongoose.Types.ObjectId(),campaignId,
   quoteId:new mongoose.Types.ObjectId(),
   gatewayPaymentId:'tx-test-'+new mongoose.Types.ObjectId(),
   gatewayOrderId:'tx-test-'+new mongoose.Types.ObjectId(),
   budgetMicros:20000,remainingMicros:20000,
   budgetNanos:20000000,remainingNanos:20000000,
   settlementMode:'mongo_transaction_v2',
   priceVersion:1,ratesMicros:{
    standard:4000000,hero:8000000,audio:12000000
   },source:'nexi_verified',paidAt:new Date()
  });
  lotId=lot._id;
  const event={
   eventId:'c'+new mongoose.Types.ObjectId().toHexString()+'0000000',
   campaignId:String(campaignId),creativeId:String(creativeId),
   kind:'visual',tier:'standard',qualifiedAt:new Date().toISOString()
  };
  const duplicates=await Promise.all(Array.from({length:75},
   ()=>settleQualifiedEventTransactional(event)));
  assert.equal(duplicates.filter(x=>x.status==='charged').length,75);
  const independent=await Promise.all(Array.from({length:50},(_,i)=>
   settleQualifiedEventTransactional({
    ...event,eventId:(i+1).toString(16).padStart(32,'0')
   })));
  assert.equal(independent.filter(x=>x.status==='charged').length,4);
  const wallet=await FundingLot.findById(lotId).lean();
  assert.equal(wallet.remainingNanos,0);
  assert.equal(wallet.settledEvents.length,0);
  const ledger=await Event.find({campaignId}).lean();
  assert.equal(ledger.filter(x=>x.status==='charged').length,5);
  assert.equal(auditFundingSet([wallet],ledger).safe,true);
  // Verify an aborted transaction never persists half a wallet+receipt write.
  const rollbackCampaign=new mongoose.Types.ObjectId();
  const rollbackLot=await FundingLot.create({
   agencyId:new mongoose.Types.ObjectId(),campaignId:rollbackCampaign,
   quoteId:new mongoose.Types.ObjectId(),
   gatewayPaymentId:'tx-test-'+new mongoose.Types.ObjectId(),
   gatewayOrderId:'tx-test-'+new mongoose.Types.ObjectId(),
   budgetMicros:5000,remainingMicros:5000,
   budgetNanos:5000000,remainingNanos:5000000,
   settlementMode:'mongo_transaction_v2',
   priceVersion:1,ratesMicros:{standard:4000000,hero:8000000,audio:12000000},
   source:'nexi_verified',paidAt:new Date()
  });
  const rollbackId='b'+new mongoose.Types.ObjectId().toHexString()+'0000000';
  await Event.create({_id:rollbackId,campaignId:rollbackCampaign,
   creativeId,kind:'visual',tier:'standard',fundingLotId:rollbackLot._id,
   rateMicros:4000000,costNanos:4000000,qualifiedAt:new Date(),
   status:'pending'});
  const session=await mongoose.startSession();
  try{
   await assert.rejects(async()=>session.withTransaction(async()=>{
    await FundingLot.updateOne({_id:rollbackLot._id},
     {$inc:{remainingNanos:-4000000}},{session});
    await Event.updateOne({_id:rollbackId},
     {$set:{status:'charged',settledAt:new Date()}},{session});
    throw Error('Controlled abort before commit');
   }),/Controlled abort/);
  }finally{await session.endSession();}
  assert.equal((await FundingLot.findById(rollbackLot._id).lean()).remainingNanos,5000000);
  assert.equal((await Event.findById(rollbackId).lean()).status,'pending');
  await Event.deleteMany({campaignId:rollbackCampaign});
  await FundingLot.deleteOne({_id:rollbackLot._id,campaignId:rollbackCampaign});
  console.log('PASS disposable replica-set transaction races, ledger audit and rollback');
 }finally{
  // Only clean up records uniquely created inside this disposable test.
  if(campaignId){
   await Event.deleteMany({campaignId});
   if(lotId)await FundingLot.deleteOne({_id:lotId,campaignId});
  }
  await mongoose.disconnect();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
