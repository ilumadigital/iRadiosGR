'use strict';
// Durable, per-recipient, staging-only Agency approval notices. This service
// NEVER imports an advertising settlement or payment module.
const crypto=require('node:crypto');
const Notice=require('../models/AgencyAdNotice');
const Revision=require('../models/AgencyAdRevision');
const Banner=require('../models/BannerAd');
const Audio=require('../models/Ad');
const User=require('../models/User');
const {makeNotice,validEmail}=require('./agencyAdNoticePolicy');
const {deliverOne}=require('./agencyAdNoticeWorkerCore');
const {sendEmail}=require('../utils/myMailer');
const stage=()=>process.env.APP_ENV==='staging';
let ready=null,timer=null,working=false;
const cursors={revision:null,banner:null,audio:null};
function ensureIndexes(){
 if(!ready)ready=Notice.createIndexes().then(()=>true)
  .catch(error=>{ready=null;throw error;});
 return ready;
}
function sourceFromRevision(revision){
 return {
  creativeId:revision.creativeId,revisionId:revision._id,
  creativeType:revision.creativeType,agencyId:revision.agencyId,
  title:revision.creativeTitleAtSubmission||revision.patch?.title||
   revision.before?.title||'Δημιουργικό Agency',
  patch:revision.patch||{},before:revision.before||{},
  reason:revision.rejectionReason||''
 };
}
function sourceFromCreative(creative,kind){
 return {creativeId:creative._id,creativeType:kind,
  agencyId:creative.agencyId,title:creative.title};
}
async function persistForRecipients(kind,source,recipients,agencyName=''){
 await ensureIndexes();
 const valid=(recipients||[]).filter(u=>u?._id&&validEmail(u.email));
 if(!valid.length)throw Error('No valid Agency notice recipients');
 for(const recipient of valid){
  const plan=makeNotice({kind,source,recipient,agencyName});
  try{
   await Notice.updateOne({eventKey:plan.eventKey},
    {$setOnInsert:{...plan,status:'pending',attempts:0,
     nextAttemptAt:new Date()}},{upsert:true});
  }catch(error){
   if(error.code!==11000||!await Notice.exists({eventKey:plan.eventKey}))
    throw error;
  }
 }
 // The caller marks the source "seeded" only AFTER every recipient is durable.
 // A crash between inserts replays safe unique eventKeys.
 return valid.length;
}
async function adminRecipients(){
 return User.find({role:'admin',email:{$exists:true,$ne:''}})
  .select('_id email').lean();
}
async function queueDraft(kind,creative){
 if(!stage())return {status:'disabled'};
 if(creative?.agencyDraftNoticeVersion!==1||creative.draftOutboxSeededAt)
  return {status:'not_required'};
 const source=sourceFromCreative(creative,kind);
 const agency=await User.findById(source.agencyId).select('username email').lean();
 await persistForRecipients('draft_submitted',source,
  await adminRecipients(),agency?.username||agency?.email||'Agency');
 const model=kind==='banner'?Banner:Audio;
 await model.updateOne({_id:creative._id,agencyDraftNoticeVersion:1,
  draftOutboxSeededAt:null},{$set:{draftOutboxSeededAt:new Date()}});
 kick();
 return {status:'queued'};
}
async function queueRevision(revision){
 if(!stage())return {status:'disabled'};
 if(revision?.noticeVersion!==1)return {status:'not_required'};
 const source=sourceFromRevision(revision);
 let count=0;
 if(!revision.submissionOutboxSeededAt){
  const agency=await User.findById(revision.agencyId).select('username email').lean();
  count+=await persistForRecipients('revision_submitted',source,
   await adminRecipients(),agency?.username||agency?.email||'Agency');
  await Revision.updateOne({_id:revision._id,noticeVersion:1,
   submissionOutboxSeededAt:null},{$set:{submissionOutboxSeededAt:new Date()}});
 }
 if(['approved','rejected'].includes(revision.status)&&!revision.decisionOutboxSeededAt){
  const user=await User.findById(revision.agencyId).select('_id email').lean();
  count+=await persistForRecipients(
   revision.status==='approved'?'revision_approved':'revision_rejected',
   source,[user]);
  await Revision.updateOne({_id:revision._id,noticeVersion:1,
   status:revision.status,decisionOutboxSeededAt:null},
   {$set:{decisionOutboxSeededAt:new Date()}});
 }
 if(count)kick();
 return {status:'queued',count};
}
async function page(Model,filter,key,processRow){
 const conditions=[filter];
 if(cursors[key])conditions.push({_id:{$gt:cursors[key]}});
 const rows=await Model.find({$and:conditions}).sort({_id:1}).limit(35).lean();
 if(!rows.length){cursors[key]=null;return 0;}
 for(const row of rows){
  cursors[key]=row._id;
  try{await processRow(row);}
  catch(error){console.warn('[AGENCY NOTICE] Reconciliation '+key+':',
   String(error.message||error).slice(0,160));}
 }
 return rows.length;
}
async function reconcileSources(){
 if(!stage())return;
 // Only new v1 sources participate; historic direct emails will NOT replay.
 await page(Revision,{noticeVersion:1,$or:[
  {submissionOutboxSeededAt:null},
  {status:{$in:['approved','rejected']},decisionOutboxSeededAt:null}
 ]},'revision',queueRevision);
 for(const [kind,Model] of [['banner',Banner],['audio',Audio]]){
  await page(Model,{isStageCreative:true,agencyDraftNoticeVersion:1,
   draftOutboxSeededAt:null},kind,row=>queueDraft(kind,row));
 }
}
async function isSuperseded(notice){
 if(notice.kind==='revision_submitted'){
  const r=await Revision.findById(notice.revisionId)
   .select('status processing').lean();
  return !r||r.status!=='pending'||r.processing===true;
 }
 if(notice.kind==='draft_submitted'){
  const Model=notice.creativeType==='banner'?Banner:Audio;
  const creative=await Model.findById(notice.creativeId).select('status').lean();
  return !creative||creative.status!=='pending';
 }
 // Never deliver a superseded decision if the stored source was amended
 // after the outbox record was created (should not happen under normal CAS).
 const revision=await Revision.findById(notice.revisionId).select('status').lean();
 return !revision||revision.status!==
  (notice.kind==='revision_approved'?'approved':'rejected');
}
async function claim(){
 const now=new Date(),leaseToken=crypto.randomBytes(16).toString('hex');
 return Notice.findOneAndUpdate({$or:[
  {status:'pending',nextAttemptAt:{$lte:now}},
  {status:'sending',leaseUntil:{$lte:now}}
 ]},{$set:{status:'sending',leaseToken,
  leaseUntil:new Date(now.getTime()+600000)},$inc:{attempts:1}},
 {new:true,sort:{createdAt:1}}).lean();
}
const leaseFilter=row=>({_id:row._id,status:'sending',leaseToken:row.leaseToken});
async function markSent(row,messageId){
 const r=await Notice.updateOne(leaseFilter(row),{$set:{
  status:'sent',sentAt:new Date(),providerMessageId:String(messageId).slice(0,250),
  lastError:'',leaseToken:null,leaseUntil:null}});
 return r.modifiedCount===1;
}
async function markFailed(row,reason,retryAt){
 const r=await Notice.updateOne(leaseFilter(row),{$set:{
  status:'pending',nextAttemptAt:retryAt,lastError:reason,
  leaseToken:null,leaseUntil:null}});
 return r.modifiedCount===1;
}
async function markSuperseded(row){
 const r=await Notice.updateOne(leaseFilter(row),{$set:{
  status:'superseded',lastError:'Source decision no longer needs review',
  leaseToken:null,leaseUntil:null}});
 return r.modifiedCount===1;
}
async function run(){
 if(working||!stage())return;
 working=true;
 try{
  await ensureIndexes();
  try{await reconcileSources();}
  catch(error){console.warn('[AGENCY NOTICE] Recovery scan failed:',error.message);}
  for(let i=0;i<20;i++){
   const result=await deliverOne({
    claim,send:row=>sendEmail({to:row.recipientEmail,
     subject:row.subject,html:row.html}),
    markSent,markFailed,markSuperseded,isSuperseded
   });
   if(result.status==='idle')break;
  }
 }finally{working=false;}
}
function kick(){
 if(!stage())return;
 run().catch(error=>console.error('[AGENCY NOTICE] Worker failed:',
  String(error.message||error).slice(0,200)));
}
function start(){
 if(timer||!stage())return;
 timer=setInterval(kick,60000);
 timer.unref?.();
 kick();
}
async function recentAdminNotices(limit=80){
 if(!stage())return [];
 return Notice.find({}).sort({createdAt:-1}).limit(Math.min(100,limit))
  .select('-html').lean();
}
module.exports={queueDraft,queueRevision,reconcileSources,run,start,kick,
 recentAdminNotices,ensureIndexes};
