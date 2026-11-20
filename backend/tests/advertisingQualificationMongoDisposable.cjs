'use strict';
// MANUAL ONLY: isolated Mongo DB to exercise actual concurrent CAS and indexes.
// Must NEVER target the application MongoDB database, staging data or prod.
// APP_ENV=staging AD_QUALIFICATION_DISPOSABLE_APPROVAL=I_CONFIRMED_TEST_ONLY_DATABASE
// AD_QUALIFICATION_DISPOSABLE_MONGODB_URI=mongodb://.../ad_qualification_disposable_<unique>
// node backend/tests/advertisingQualificationMongoDisposable.cjs
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const crypto=require('node:crypto');
const Ticket=require('../models/AdvertisingDeliveryTicket');
const Qualified=require('../models/AdvertisingQualifiedEvent');
const Counter=require('../models/AdvertisingDeliveryCounter');
const {issueTicket,observation}=require('../services/advertisingQualifiedDelivery');
const uri=process.env.AD_QUALIFICATION_DISPOSABLE_MONGODB_URI||'';
const pathname=uri.split('?')[0];
if(process.env.APP_ENV!=='staging'||process.env.NODE_ENV==='production'||
   process.env.AD_QUALIFICATION_DISPOSABLE_APPROVAL!=='I_CONFIRMED_TEST_ONLY_DATABASE'||
   !/^(mongodb|mongodb\+srv):\/\//.test(uri)||
   !/\/ad_qualification_disposable_[a-zA-Z0-9_-]{8,}$/.test(pathname))
 throw Error('Refusing unapproved or non-disposable qualification test target');
(async()=>{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
 const campaign=new mongoose.Types.ObjectId();
 const creative=new mongoose.Types.ObjectId();
 const id=crypto.randomBytes(16).toString('hex');
 const key=crypto.randomBytes(32).toString('hex');
 const now=Date.now();
 const hour='pace:disposable:'+id;
 try{
  await Promise.all([Ticket.createIndexes(),Qualified.createIndexes(),
   Counter.createIndexes()]);
  const doc=issueTicket({campaignId:String(campaign),creativeId:String(creative),
   kind:'visual',tier:'standard',placement:'home',clientKey:key,now,id});
  await Ticket.create({...doc,cleanupAt:new Date(now+86400000)});
  const first=observation(doc,{seq:1,ratio:.8,foreground:true},now+50).state;
  const writes=await Promise.all(Array.from({length:80},
   ()=>Ticket.findOneAndUpdate({_id:id,seq:0,status:'issued'},
    {$set:{seq:1,lastAt:first.lastAt,lastActive:true,continuousMs:0}},
    {new:true})));
  assert.equal(writes.filter(Boolean).length,1);
  const actual=await Ticket.findById(id).lean();
  assert.equal(actual.seq,1);
  const second=observation(actual,{seq:2,ratio:.9,foreground:true},now+1300).state;
  assert.equal(second.status,'qualified');
  const success=await Ticket.findOneAndUpdate({_id:id,seq:1,status:'issued'},
   {$set:{seq:2,lastAt:second.lastAt,lastActive:true,
    continuousMs:second.continuousMs,status:'qualified',
    qualifiedAt:second.qualifiedAt}},{new:true});
  assert.equal(success.status,'qualified');
  const payload={_id:id,campaignId:campaign,creativeId:creative,
   kind:'visual',tier:'standard',placement:'home',
   qualifiedAt:second.qualifiedAt,observedMs:second.continuousMs,
   status:'shadow_qualified',billable:false};
  await Promise.all(Array.from({length:80},async()=>{
   try{await Qualified.updateOne({_id:id},{$setOnInsert:payload},{upsert:true});}
   catch(error){if(error.code!==11000)throw error;}
  }));
  assert.equal(await Qualified.countDocuments({_id:id}),1);
  assert.equal((await Qualified.findById(id).lean()).billable,false);
  await Promise.all(Array.from({length:80},async()=>{
   try{
    await Counter.findOneAndUpdate({_id:hour,count:{$lt:3}},
     {$inc:{count:1},$setOnInsert:{expiresAt:new Date(now+7200000)}},
     {upsert:true});
   }catch(error){
    if(error.code!==11000)throw error;
    await Counter.findOneAndUpdate({_id:hour,count:{$lt:3}},
     {$inc:{count:1}});
   }
  }));
  assert.equal((await Counter.findById(hour).lean()).count,3);
  console.log('PASS: disposable Mongo CAS, unique shadow events and 3-ticket cap');
 }finally{
  await Promise.all([Ticket.deleteOne({_id:id}),
   Qualified.deleteOne({_id:id}),Counter.deleteOne({_id:hour})]);
  await mongoose.disconnect();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
