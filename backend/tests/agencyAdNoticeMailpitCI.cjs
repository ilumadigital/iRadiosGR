'use strict';
// INTEGRATION CI ONLY. Must run inside GitHub Actions with fresh Docker
// services "mongo" and "mailpit". No payment system / public listener paths.
// NEVER point this test at real staging/prod data or external SMTP.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const mongoose=require('mongoose');
const User=require('../models/User');
const Revision=require('../models/AgencyAdRevision');
const Notice=require('../models/AgencyAdNotice');
const outbox=require('../services/agencyAdNoticeOutbox');
const uri=process.env.AD_AGENCY_NOTICE_DISPOSABLE_MONGODB_URI||'';
if(process.env.APP_ENV!=='staging'||process.env.NODE_ENV!=='test'||
 process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||
 process.env.AD_AGENCY_NOTICE_DISPOSABLE_APPROVAL!=='I_CONFIRMED_TEST_ONLY_DATABASE'||
 process.env.AD_AGENCY_NOTICE_MAILPIT_CI!=='1'||
 !/^mongodb:\/\/mongo:27017\/ad_notice_disposable_ci_[a-z0-9]{8,}$/.test(uri)||
 process.env.SMTP_HOST||process.env.SMTP_USER||process.env.SMTP_PASS||
 process.env.APP_PUBLIC_URL!=='https://stage.iradios.gr')
 throw Error('Refusing Agency notice integration outside isolated CI Docker services');

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function api(relative){
 const response=await fetch('http://mailpit:8025'+relative,{
  signal:AbortSignal.timeout(3500)});
 if(!response.ok)throw Error('Mailpit API failed: '+response.status);
 return response.json();
}
async function setMailpitChaos(enabled){
 const response=await fetch('http://mailpit:8025/api/v1/chaos',{
  method:'PUT',
  headers:{'content-type':'application/json'},
  body:JSON.stringify(enabled?{Sender:{ErrorCode:451,Probability:100}}:{}),
  signal:AbortSignal.timeout(3500)
 });
 if(!response.ok)throw Error('Mailpit chaos configuration failed: '+response.status);
}
async function awaitCondition(check,description){
 for(let i=0;i<75;i++){
  await outbox.run();
  if(await check())return;
  await sleep(150);
 }
 throw Error('Timed out waiting for '+description);
}
(async()=>{
 await mongoose.connect(uri,{serverSelectionTimeoutMS:15000});
 const db=mongoose.connection.db.databaseName;
 if(!/^ad_notice_disposable_ci_[a-z0-9]{8,}$/.test(db))
  throw Error('MongoDB connection escaped CI disposable DB');
 const tag=crypto.randomBytes(6).toString('hex');
 const adminIds=[],revisionIds=[];
 let agencyId=null;
 try{
  await Promise.all([User.createIndexes(),Revision.createIndexes(),Notice.createIndexes()]);
  const newUser=async(role,username)=>{
   const doc=await User.create({
    username:'ad-mail-ci-'+tag+'-'+username,
    password:'DISPOSABLE-NOT-A-REAL-ACCOUNT',
    email:'ad-mail-ci-'+tag+'-'+username+'@example.invalid',
    role
   });
   return doc.toObject();
  };
  const adminA=await newUser('admin','admin-a');
  const adminB=await newUser('admin','admin-b');
  const agency=await newUser('agency','agency');
  adminIds.push(adminA._id,adminB._id);
  agencyId=agency._id;
  const creativeId=new mongoose.Types.ObjectId();
  const revision=await Revision.create({
   agencyId:agency._id,creativeId,creativeType:'banner',
   patch:{title:'New <svg onload=alert(1)>'},
   before:{title:'Previously approved'},
   baseUpdatedAt:new Date(),status:'pending',
   noticeVersion:1,creativeTitleAtSubmission:'CI banner '+tag,
   submittedBy:agency._id
  });
  revisionIds.push(revision._id);
  await outbox.queueRevision(revision.toObject());
  await outbox.queueRevision(revision.toObject()); // same source replay
  await awaitCondition(async()=>await Notice.countDocuments({
    revisionId:revision._id,kind:'revision_submitted',status:'sent'
  })===2,'two Admin SMTP accepted notices');
  const notices=await Notice.find({revisionId:revision._id,kind:'revision_submitted'})
   .lean();
  assert.equal(notices.length,2,'per-Admin keys must remain unique');
  assert.equal(new Set(notices.map(n=>n.recipientUserId.toString())).size,2);
  assert.ok(notices.every(n=>n.providerMessageId&&n.attempts===1));
  const firstMessages=await api('/api/v1/messages');
  assert.equal(firstMessages.total,2,'two emails physically received in Mailpit');
  for(const item of firstMessages.messages){
   const message=await api('/api/v1/message/'+encodeURIComponent(item.ID));
   assert.match(message.Subject,/Αλλαγές δημιουργικού προς έγκριση/);
   assert.match(message.HTML,/data-iradios-email="v2"/);
   assert.match(message.HTML,/Previously approved/);
   assert.match(message.HTML,/&lt;svg onload=alert\(1\)&gt;/);
   assert.doesNotMatch(message.HTML,/<svg onload/);
   assert.ok(message.To.some(to=>[
    adminA.email,adminB.email].includes(to.Address)));
  }
  // Simulate an Admin approval that has already committed. Outbox only:
  // financial settlement and creative updates are NOT used in this test.
  await Revision.updateOne({_id:revision._id,status:'pending'},{$set:{
    status:'approved',reviewedBy:adminA._id,reviewedAt:new Date()
  }});
  const approved=await Revision.findById(revision._id).lean();
  await outbox.queueRevision(approved);
  await awaitCondition(async()=>await Notice.countDocuments({
   revisionId:revision._id,kind:'revision_approved',status:'sent'
  })===1,'approved Agency decision');
  const afterApproval=await api('/api/v1/messages');
  assert.equal(afterApproval.total,3);
  const approvalMessages=[];
  for(const item of afterApproval.messages){
   const message=await api('/api/v1/message/'+encodeURIComponent(item.ID));
   if(message.Subject.includes('Οι αλλαγές εγκρίθηκαν'))approvalMessages.push(message);
  }
  assert.equal(approvalMessages.length,1);
  assert.equal(approvalMessages[0].To[0].Address,agency.email);
  assert.match(approvalMessages[0].HTML,/data-iradios-email="v2"/);
  // Restart/recovery-like repeated reconciliation never re-sends sent rows.
  await outbox.queueRevision(approved);
  for(let i=0;i<3;i++)await outbox.run();
  assert.equal((await api('/api/v1/messages')).total,3);
  // Crash between final decision commit and original review-notice seeding:
  // recovery must send final rejection only, never stale Admin CTA.
  const rejected=await Revision.create({
   agencyId:agency._id,creativeId,creativeType:'banner',
   patch:{title:'Rejected request'},
   before:{title:'Previously approved'},
   baseUpdatedAt:new Date(),status:'rejected',
   rejectionReason:'CI reject <script>unsafe</script>',
   noticeVersion:1,creativeTitleAtSubmission:'Rejected CI banner '+tag,
   submittedBy:agency._id,reviewedBy:adminB._id,reviewedAt:new Date()
  });
  revisionIds.push(rejected._id);
  await outbox.reconcileSources();
  await awaitCondition(async()=>await Notice.countDocuments({
   revisionId:rejected._id,kind:'revision_rejected',status:'sent'
  })===1,'final rejected Agency decision from recovery');
  assert.equal(await Notice.countDocuments({
   revisionId:rejected._id,kind:'revision_submitted'}),0);
  const finalMessages=await api('/api/v1/messages');
  assert.equal(finalMessages.total,4);
  const rejectedMessages=[];
  for(const item of finalMessages.messages){
   const message=await api('/api/v1/message/'+encodeURIComponent(item.ID));
   if(message.Subject.includes('Οι αλλαγές απορρίφθηκαν'))rejectedMessages.push(message);
  }
  assert.equal(rejectedMessages.length,1);
  assert.equal(rejectedMessages[0].To[0].Address,agency.email);
  assert.match(rejectedMessages[0].HTML,/&lt;script&gt;unsafe&lt;\/script&gt;/);
  // Real SMTP failure injection: Mailpit replies 451 before accepting mail,
  // Mongo retains both recipient attempts for retry without extra inbox mail.
  await setMailpitChaos(true);
  const retryRevision=await Revision.create({
   agencyId:agency._id,creativeId,creativeType:'banner',
   patch:{title:'Transient SMTP failure'},
   before:{title:'Previously approved'},
   baseUpdatedAt:new Date(),status:'pending',
   noticeVersion:1,creativeTitleAtSubmission:'SMTP chaos CI '+tag,
   submittedBy:agency._id
  });
  revisionIds.push(retryRevision._id);
  try{
   await outbox.queueRevision(retryRevision.toObject());
   await awaitCondition(async()=>await Notice.countDocuments({
    revisionId:retryRevision._id,kind:'revision_submitted',
    status:'pending',attempts:{$gte:1}
   })===2,'two failed SMTP 451 attempts recorded for retry');
   assert.equal((await api('/api/v1/messages')).total,4,
    'SMTP 451 must never be mistaken for a delivered email');
   const failed=await Notice.find({revisionId:retryRevision._id}).lean();
   assert.equal(failed.length,2);
   assert.ok(failed.every(row=>row.lastError.includes('451')),
    'SMTP temporary error must be visible in outbox diagnostics');
  }finally{
   await setMailpitChaos(false);
  }
  // Do NOT wait for a real thirty-second backoff during CI; move the
  // nextAttemptAt clock forward ONLY in this isolated disposable database.
  await Notice.updateMany({revisionId:retryRevision._id,status:'pending'},
   {$set:{nextAttemptAt:new Date(0)}});
  await awaitCondition(async()=>await Notice.countDocuments({
   revisionId:retryRevision._id,kind:'revision_submitted',status:'sent'
  })===2,'two recovered Admin notices after restoring SMTP');
  assert.equal((await api('/api/v1/messages')).total,6);
  const recovered=await Notice.find({revisionId:retryRevision._id}).lean();
  assert.ok(recovered.every(row=>row.attempts===2&&row.lastError===''));
  console.log('PASS: real Mailpit 451 temporary SMTP outage, Mongo backoff and exactly one accepted recovery per recipient.');
  console.log('PASS: real disposable Mongo/Mailpit 2 Admin notices, approval, rejection, recovery, branded HTML, deduplication.');
 }finally{
  await setMailpitChaos(false).catch(()=>{});
  await Notice.deleteMany({revisionId:{$in:revisionIds}});
  await Revision.deleteMany({_id:{$in:revisionIds}});
  await User.deleteMany({_id:{$in:[...adminIds,agencyId].filter(Boolean)}});
  await mongoose.disconnect();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
