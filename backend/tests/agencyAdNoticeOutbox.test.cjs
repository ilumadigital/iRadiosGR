'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {eventKey,makeNotice}=require('../services/agencyAdNoticePolicy');
const {retryAfter,deliverOne}=require('../services/agencyAdNoticeWorkerCore');
const admin1={_id:'a'.repeat(24),email:'admin-one@example.test'};
const admin2={_id:'b'.repeat(24),email:'admin-two@example.test'};
const agency={_id:'c'.repeat(24),email:'agency@example.test'};
const source={
 creativeId:'d'.repeat(24),revisionId:'e'.repeat(24),agencyId:agency._id,
 creativeType:'banner',title:'Original <script>bad</script>',
 before:{title:'Old',targetUrl:'https://example.test'},
 patch:{title:'New <img src=x onerror=alert(1)>'},
 reason:'<svg onload=alert(1)>'
};
const notice=(kind,recipient=admin1)=>makeNotice({kind,source,recipient,
 agencyName:'ILUMA <unsafe>'});
function fakeQueue(rows=[]){
 const data=rows.map(x=>({...x})),mail=[],clock=()=>500000;
 return {
  data,mail,clock,
  claim:async()=>{
   const row=data.find(x=>(x.status==='pending'&&x.nextAttemptAt<=clock())||
    (x.status==='sending'&&x.leaseUntil<=clock()));
   if(!row)return null;
   row.status='sending';row.leaseToken='lease-'+row.attempts;
   row.leaseUntil=clock()+600000;row.attempts++;
   return {...row};
  },
  markSent:async(row,id)=>{
   const entry=data.find(x=>x.eventKey===row.eventKey&&x.status==='sending'&&
    x.leaseToken===row.leaseToken);
   if(!entry)return false;
   entry.status='sent';entry.messageId=id;return true;
  },
  markFailed:async(row,reason,next)=>{
   const entry=data.find(x=>x.eventKey===row.eventKey&&x.status==='sending'&&
    x.leaseToken===row.leaseToken);
   if(!entry)return false;
   entry.status='pending';entry.nextAttemptAt=+next;
   entry.lastError=reason;return true;
  },
  markSuperseded:async row=>{
   const entry=data.find(x=>x.eventKey===row.eventKey&&x.status==='sending'&&
    x.leaseToken===row.leaseToken);
   if(!entry)return false;
   entry.status='superseded';return true;
  },
  isSuperseded:async row=>row.superseded===true,
  send:async row=>{mail.push(row.eventKey);return {success:true,messageId:'mailpit-'+mail.length};}
 };
}
const record=(kind='revision_submitted',recipient=admin1)=>({
 eventKey:eventKey({kind,sourceId:kind==='draft_submitted'?source.creativeId:source.revisionId,
  recipientUserId:recipient._id}),
 kind,recipientEmail:recipient.email,
 status:'pending',nextAttemptAt:0,attempts:0
});
test('unique immutable key per revision / decision / recipient',()=>{
 const first=notice('revision_submitted',admin1);
 const duplicate=notice('revision_submitted',admin1);
 assert.equal(first.eventKey,duplicate.eventKey);
 assert.notEqual(first.eventKey,notice('revision_submitted',admin2).eventKey);
 assert.notEqual(first.eventKey,notice('revision_approved',agency).eventKey);
 assert.notEqual(notice('revision_rejected',agency).eventKey,
  notice('revision_approved',agency).eventKey);
 assert.notEqual(notice('draft_submitted',admin1).eventKey,first.eventKey);
 assert.throws(()=>eventKey({kind:'unknown',sourceId:source.revisionId,
  recipientUserId:agency._id}),/Invalid/);
 assert.throws(()=>makeNotice({kind:'revision_submitted',source,
  recipient:{...agency,email:'\nspam@example.test'}}),/Invalid/);
});
test('revision emails are iRadios branded, bounded, escaped and contain before/after',()=>{
 const submitted=notice('revision_submitted');
 assert.match(submitted.subject,/iRadios GR/);
 assert.match(submitted.html,/Αλλαγές δημιουργικού προς έγκριση/);
 assert.match(submitted.html,/Πριν|Old|New/);
 assert.match(submitted.html,/&lt;script&gt;/);
 assert.doesNotMatch(submitted.html,/<script>|<img src=x onerror=/);
 assert.match(submitted.html,/ILUMA &lt;unsafe&gt;/);
 const rejected=notice('revision_rejected',agency);
 assert.match(rejected.html,/Αιτιολογία/);
 assert.match(rejected.html,/&lt;svg onload=/);
 assert.doesNotMatch(rejected.html,/<svg /);
 const approved=notice('revision_approved',agency);
 assert.match(approved.html,/εγκρίθηκαν/);
 assert.equal(approved.recipientEmail,agency.email);
 const large=makeNotice({kind:'revision_submitted',source:{
  ...source,patch:Object.fromEntries(Array.from({length:70},(_,i)=>
   ['field'+i,'<img>'+('x'.repeat(8000))]))},recipient:admin1});
 assert.ok(large.html.length<50000);
});
test('successful SMTP acknowledgement marks exactly this recipient sent',async()=>{
 const row=record(),store=fakeQueue([row]);
 const result=await deliverOne(store);
 assert.equal(result.status,'sent');
 assert.equal(store.data[0].status,'sent');
 assert.equal(store.data[0].attempts,1);
 assert.deepEqual(store.mail,[row.eventKey]);
 assert.equal((await deliverOne(store)).status,'idle');
});
test('transient SMTP failure schedules exponential retry without marking sent',async()=>{
 const store=fakeQueue([record()]);
 store.send=async()=>({success:false,error:'Mailpit offline'});
 const result=await deliverOne(store);
 assert.equal(result.status,'retry_pending');
 assert.equal(store.data[0].status,'pending');
 assert.equal(store.data[0].lastError,'Mailpit offline');
 assert.equal(+result.retryAt,500000+30000);
 store.send=async row=>({success:true,messageId:row.eventKey});
 assert.equal((await deliverOne(store)).status,'idle'); // backoff not yet due
 store.data[0].nextAttemptAt=500000;
 assert.equal((await deliverOne(store)).status,'sent');
 assert.equal(store.data[0].attempts,2);
 assert.equal(retryAfter(1),30000);
 assert.equal(retryAfter(2),60000);
 assert.equal(retryAfter(12),3600000);
});
test('superseded Admin review email is skipped after approval',async()=>{
 const row={...record(),superseded:true},store=fakeQueue([row]);
 const result=await deliverOne(store);
 assert.equal(result.status,'superseded');
 assert.equal(store.data[0].status,'superseded');
 assert.equal(store.mail.length,0);
});
test('atomic claim prevents parallel workers from sending same pending notice',async()=>{
 const store=fakeQueue([record()]);
 const outcomes=await Promise.all(Array.from({length:60},()=>deliverOne(store)));
 assert.equal(outcomes.filter(x=>x.status==='sent').length,1);
 assert.equal(store.mail.length,1);
});
test('expired lease is retried and stale worker cannot change newer lease',async()=>{
 const store=fakeQueue([{...record(),status:'sending',attempts:1,
  leaseToken:'expired',leaseUntil:0}]);
 const newRow=await store.claim();
 assert.equal(newRow.attempts,2);
 assert.equal(await store.markSent({...newRow,leaseToken:'expired'},'bad'),false);
 assert.equal(store.data[0].status,'sending');
 assert.equal(await store.markSent(newRow,'good'),true);
 assert.equal(store.data[0].status,'sent');
});
test('core remains at-least-once: acknowledged-but-uncommitted mail may retry',async()=>{
 const store=fakeQueue([record()]);
 let acknowledged=false;
 store.send=async row=>{store.mail.push(row.eventKey);acknowledged=true;
  return {success:true};};
 store.markSent=async()=>{throw Error('Simulated Mongo unavailable after SMTP ACK')};
 const ambiguous=await deliverOne(store);
 assert.equal(acknowledged,true);
 assert.equal(ambiguous.status,'retry_pending');
 assert.equal(store.data[0].status,'pending');
 // The transport ACKed, but durable completion did not: a later retry could
 // duplicate the email. Per-recipient idempotency is not SMTP exactly-once.
 store.data[0].nextAttemptAt=500000;
 const recovered=await store.claim();
 assert.equal(recovered.attempts,2);
});
test('all Agency writes use durable notice outbox; production mail disabled',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const agencyRoutes=read('routes/agencyRoutes.js');
 const adminRoutes=read('routes/adminRoutes.js');
 const worker=read('services/agencyAdNoticeOutbox.js');
 const revision=read('models/AgencyAdRevision.js');
 const noticeModel=read('models/AgencyAdNotice.js');
 assert.match(agencyRoutes,/agencyDraftNoticeVersion:1/);
 assert.match(agencyRoutes,/noticeVersion:1,creativeTitleAtSubmission:creative.title/);
 assert.match(agencyRoutes,/noticeOutbox\.start\(\)/);
 assert.doesNotMatch(agencyRoutes,/mailAdmins\(/);
 assert.doesNotMatch(adminRoutes,/mailAgency\(/);
 assert.match(adminRoutes,/agencyNoticeOutbox\.queueRevision\(outcome.revision\)/);
 assert.match(adminRoutes,/\/admin\/agency-ad-notices',\.\.\.admin/);
 assert.match(worker,/process\.env\.APP_ENV==='staging'/);
 assert.match(worker,/Notice\.createIndexes\(\)/);
 assert.match(worker,/leaseToken=crypto\.randomBytes/);
 assert.match(worker,/Notice\.updateOne\(\{eventKey:plan.eventKey\}/);
 assert.match(worker,/submissionOutboxSeededAt:null/);
 assert.match(worker,/decisionOutboxSeededAt:null/);
 assert.match(worker,/draftOutboxSeededAt:null/);
 assert.match(revision,/noticeVersion:\{type:Number,default:0\}/);
 assert.match(noticeModel,/eventKey:\{type:String,required:true,unique:true/);
 assert.match(read('services/advertisingDeliveryEligibility.js'),
  /const ATOMIC_SETTLEMENT_IMPLEMENTED=false/);
 assert.doesNotMatch(worker,/settleQualifiedEvent|atomicDebitWithReceipt|transactionalDebit/);
});
