'use strict';
// MANUAL ONLY. Real MongoDB unique index, concurrent insertion, lease and CAS
// tests against an explicitly approved *disposable* database. NO EMAIL SENDS.
// APP_ENV=staging NODE_ENV=test
// AD_AGENCY_NOTICE_DISPOSABLE_APPROVAL=I_CONFIRMED_TEST_ONLY_DATABASE
// AD_AGENCY_NOTICE_DISPOSABLE_MONGODB_URI=mongodb://.../ad_notice_disposable_<unique>
// node backend/tests/agencyAdNoticeMongoDisposable.cjs
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const mongoose=require('mongoose');
const Notice=require('../models/AgencyAdNotice');
const uri=process.env.AD_AGENCY_NOTICE_DISPOSABLE_MONGODB_URI||'';
const base=uri.split('?')[0];
if(process.env.APP_ENV!=='staging'||process.env.NODE_ENV==='production'||
   process.env.AD_AGENCY_NOTICE_DISPOSABLE_APPROVAL!=='I_CONFIRMED_TEST_ONLY_DATABASE'||
   !/^(mongodb|mongodb\+srv):\/\//.test(uri)||
   !/\/ad_notice_disposable_[a-zA-Z0-9_-]{8,}$/.test(base))
 throw Error('Refusing unapproved or non-disposable Agency notice test MongoDB');
(async()=>{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000,retryWrites:true});
 const db=mongoose.connection.db.databaseName;
 if(!/^ad_notice_disposable_[a-zA-Z0-9_-]{8,}$/.test(db))
  throw Error('Unexpected Mongo database; refuse to write');
 const recipientA=new mongoose.Types.ObjectId(),recipientB=new mongoose.Types.ObjectId();
 const creativeId=new mongoose.Types.ObjectId(),revisionId=new mongoose.Types.ObjectId();
 const agencyId=new mongoose.Types.ObjectId();
 const keys=[recipientA,recipientB].map(r=>
  'agency-ad:v1:revision_submitted:'+revisionId.toHexString()+':'+r.toHexString());
 const noticeFor=(email,recipient,eventKey)=>({
  eventKey,kind:'revision_submitted',creativeType:'banner',
  creativeId,revisionId,agencyId,recipientUserId:recipient,
  recipientEmail:email,subject:'iRadios GR · QA outbox only',
  html:'<h2>Disposable database test only</h2>',status:'pending',
  nextAttemptAt:new Date(0)
 });
 let inserted=false;
 try{
  await Notice.createIndexes();
  if(await Notice.countDocuments({eventKey:{$in:keys}}))
   throw Error('Test notice event keys already exist; refuse reuse');
  const original=noticeFor('qa-a@example.invalid',recipientA,keys[0]);
  const attempts=await Promise.all(Array.from({length:80},async()=>{
   try{
    await Notice.updateOne({eventKey:keys[0]},{$setOnInsert:original},{upsert:true});
   }catch(error){if(error.code!==11000)throw error;}
  }));
  assert.equal(attempts.length,80);
  inserted=true;
  assert.equal(await Notice.countDocuments({eventKey:keys[0]}),1);
  await Notice.updateOne({eventKey:keys[1]},{$setOnInsert:
   noticeFor('qa-b@example.invalid',recipientB,keys[1])},{upsert:true});
  assert.equal(await Notice.countDocuments({eventKey:{$in:keys}}),2);
  const now=new Date(),leaseMillis=600000;
  const claims=await Promise.all(Array.from({length:70},async(_,i)=>
   Notice.findOneAndUpdate({eventKey:keys[0],status:'pending',
    nextAttemptAt:{$lte:now}},{$set:{status:'sending',
     leaseToken:'claim-'+i,leaseUntil:new Date(now.getTime()+leaseMillis)},
     $inc:{attempts:1}},{new:true}).lean()));
  const winners=claims.filter(Boolean);
  assert.equal(winners.length,1);
  assert.equal(winners[0].attempts,1);
  // Crash-after-claim: lease expires; a single new worker may recover.
  await Notice.updateOne({eventKey:keys[0],leaseToken:winners[0].leaseToken},
   {$set:{leaseUntil:new Date(0)}});
  const next=await Notice.findOneAndUpdate({eventKey:keys[0],status:'sending',
   leaseUntil:{$lte:new Date()}},{$set:{leaseToken:'recovered',
    leaseUntil:new Date(Date.now()+leaseMillis)},$inc:{attempts:1}},
   {new:true}).lean();
  assert.equal(next.attempts,2);
  // Old worker cannot mark new lease as sent.
  const stale=await Notice.updateOne({eventKey:keys[0],
   status:'sending',leaseToken:winners[0].leaseToken},
   {$set:{status:'sent'}});
  assert.equal(stale.modifiedCount,0);
  const recovered=await Notice.updateOne({eventKey:keys[0],
   status:'sending',leaseToken:'recovered'},
   {$set:{status:'sent',sentAt:new Date(),leaseToken:null,leaseUntil:null}});
  assert.equal(recovered.modifiedCount,1);
  assert.equal(await Notice.countDocuments({eventKey:{$in:keys}}),2);
  console.log('PASS: disposable Mongo unique recipient rows, 70-way claim and fenced lease recovery. NO SMTP SENT.');
 }finally{
  // Only delete this invocation's explicit random test keys. Never drop DB.
  if(inserted)await Notice.deleteMany({eventKey:{$in:keys}});
  await mongoose.disconnect();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
