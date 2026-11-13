'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {beforeMatches,timestampMatches,markedApplied,reviewAgencyRevision}=
 require('../services/agencyRevisionApprovalCore');
const id='a'.repeat(24),creativeId='b'.repeat(24),reviewer='c'.repeat(24);
const at=new Date('2026-11-13T10:00:00.000Z');
function fakeStore(options={}){
 let revision={
  _id:id,status:'pending',processing:false,processingDecision:null,
  agencyId:'d'.repeat(24),creativeId,creativeType:'banner',
  patch:{title:'Approved title',targetUrl:'https://example.com/approved'},
  before:{title:'Original',targetUrl:'https://example.com/old'},
  baseUpdatedAt:at,reviewedAt:null
 };
 let creative={_id:creativeId,agencyId:revision.agencyId,
  title:'Original',targetUrl:'https://example.com/old',
  updatedAt:at,lastApprovedRevisionId:null};
 const copy=v=>structuredClone(v);
 const calls={applies:0,claims:0,rejections:0,finalizations:0};
 const store={
  getRevision:async()=>copy(revision),
  getCreative:async()=>copy(creative),
  claimApproval:async(r,by)=>{
   calls.claims++;
   if(revision.status!=='pending'||revision.processing)return null;
   revision.processing=true;revision.processingDecision='approve';
   revision.processingBy=by;revision.processingStartedAt=new Date();
   return copy(revision);
  },
  applyApproval:async r=>{
   if(options.throwBeforeApplyOnce&&!options.didThrowBefore){
    options.didThrowBefore=true;throw Error('Controlled crash BEFORE creative write');
   }
   if(+new Date(creative.updatedAt)!==+new Date(r.baseUpdatedAt)||
      creative.lastApprovedRevisionId===r._id)return null;
   calls.applies++;
   creative={...creative,...r.patch,
    lastApprovedRevisionId:r._id,updatedAt:new Date(+at+1000)};
   if(options.throwAfterApplyOnce&&!options.didThrowAfter){
    options.didThrowAfter=true;throw Error('Controlled crash AFTER creative write');
   }
   return copy(creative);
  },
  finalizeApproval:async(r,by)=>{
   calls.finalizations++;
   if(revision.status!=='pending'||!revision.processing)return null;
   if(options.throwAfterFinalizeOnce&&!options.didThrowFinalize){
    revision.status='approved';revision.processing=false;
    revision.reviewedBy=by;revision.reviewedAt=new Date();
    options.didThrowFinalize=true;throw Error('Controlled crash AFTER finalization');
   }
   revision.status='approved';revision.processing=false;
   revision.reviewedBy=by;revision.reviewedAt=new Date();
   return copy(revision);
  },
  reject:async(r,by,reason)=>{
   if(revision.status!=='pending'||revision.processing)return null;
   calls.rejections++;
   revision.status='rejected';revision.reviewedBy=by;
   revision.rejectionReason=reason;
   return copy(revision);
  }
 };
 return {store,calls,revision:()=>revision,creative:()=>creative,
  changeCreative:p=>Object.assign(creative,p)};
}
const decide=(store,decision='approve',reason='')=>
 reviewAgencyRevision({revisionId:id,reviewerId:reviewer,decision,reason},store);
test('normal Agency approval preserves one atomic creative change and marker',async()=>{
 const db=fakeStore();
 const result=await decide(db.store);
 assert.equal(result.state,'approved');assert.equal(result.notify,true);
 assert.equal(db.creative().title,'Approved title');
 assert.equal(db.creative().lastApprovedRevisionId,id);
 assert.equal(db.revision().status,'approved');
 assert.equal(db.calls.applies,1);
 const duplicate=await decide(db.store);
 assert.equal(duplicate.state,'conflict');
 assert.equal(db.calls.applies,1);
});
test('rejection updates only revision, never rewrites an active creative',async()=>{
 const db=fakeStore();
 const result=await decide(db.store,'reject','Wrong creative');
 assert.equal(result.state,'rejected');assert.equal(result.notify,true);
 assert.equal(db.creative().title,'Original');
 assert.equal(db.revision().rejectionReason,'Wrong creative');
 assert.equal(db.calls.applies,0);
});
test('crash BEFORE applying is recoverable by same approval without changing status early',async()=>{
 const db=fakeStore({throwBeforeApplyOnce:true});
 await assert.rejects(()=>decide(db.store),/BEFORE creative/);
 assert.equal(db.revision().status,'pending');
 assert.equal(db.revision().processing,true);
 assert.equal(db.creative().title,'Original');
 const recovered=await decide(db.store);
 assert.equal(recovered.state,'approved');
 assert.equal(db.calls.applies,1);
});
test('crash AFTER creative commit recovers by immutable marker without second write',async()=>{
 const db=fakeStore({throwAfterApplyOnce:true});
 await assert.rejects(()=>decide(db.store),/AFTER creative/);
 assert.equal(db.revision().status,'pending');
 assert.equal(db.revision().processing,true);
 assert.equal(db.creative().lastApprovedRevisionId,id);
 const recovered=await decide(db.store);
 assert.equal(recovered.state,'approved');
 assert.equal(recovered.notify,true);
 assert.equal(db.calls.applies,1);
});
test('crash AFTER revision finalized does not send a second approval or rewrite creative',async()=>{
 const db=fakeStore({throwAfterFinalizeOnce:true});
 await assert.rejects(()=>decide(db.store),/AFTER finalization/);
 assert.equal(db.revision().status,'approved');
 const recovered=await decide(db.store);
 assert.equal(recovered.state,'conflict');
 assert.equal(db.calls.applies,1);
});
test('stale creative blocks approval without marking it approved',async()=>{
 const db=fakeStore();
 db.changeCreative({title:'Changed by Admin',updatedAt:new Date(+at+500)});
 const result=await decide(db.store);
 assert.deepEqual(result,{state:'conflict',code:'creative_changed',notify:false});
 assert.equal(db.revision().status,'pending');
 assert.equal(db.revision().processing,false);
});
test('direct Admin mutation AFTER claim yields manual-review lock, not stale creative overwrite',async()=>{
 const db=fakeStore({throwBeforeApplyOnce:true});
 await assert.rejects(()=>decide(db.store),/BEFORE creative/);
 db.changeCreative({title:'New Admin revision',updatedAt:new Date(+at+500)});
 const outcome=await decide(db.store);
 assert.equal(outcome.state,'needs_manual_review');
 assert.equal(db.creative().title,'New Admin revision');
 assert.equal(db.revision().status,'pending');
 assert.equal(db.revision().processing,true);
 assert.equal((await decide(db.store,'reject','Cancel')).code,'approval_in_progress');
});
test('two simultaneous Admin approvals commit one creative and only one success notification',async()=>{
 const db=fakeStore();
 const results=await Promise.all([decide(db.store),decide(db.store)]);
 assert.equal(db.calls.applies,1);
 assert.equal(results.filter(r=>r.state==='approved'&&r.notify).length,1);
 assert.equal(db.revision().status,'approved');
});
test('compare-before and base timestamp both guard against missing and changed fields',()=>{
 const db=fakeStore();
 const r=db.revision(),c=db.creative();
 assert.equal(beforeMatches(r,c),true);
 assert.equal(timestampMatches(r,c),true);
 assert.equal(markedApplied(r,c),false);
 assert.equal(beforeMatches(r,{...c,title:'Tampered'}),false);
 assert.equal(timestampMatches(r,{...c,updatedAt:null}),false);
 assert.equal(markedApplied(r,{...c,lastApprovedRevisionId:r._id}),true);
});
test('Mongo adapter uses pending CAS, revision marker and unique Agency pending index',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const route=read('routes/adminRoutes.js');
 const agency=read('routes/agencyRoutes.js');
 const model=read('models/AgencyAdRevision.js');
 assert.match(route,/reviewAgencyRevision/);
 assert.match(route,/status:'pending',processing:\{\$ne:true\}/);
 assert.match(route,/lastApprovedRevisionId:revision\._id/);
 assert.match(route,/status:'pending',processing:true,processingDecision:'approve'/);
 assert.match(agency,/await ensureAgencyRevisionIndexes\(\)/);
 assert.match(agency,/AgencyAdRevision\.createIndexes\(\)/);
 assert.match(model,/partialFilterExpression:\{status:'pending'\}/);
 assert.doesNotMatch(route,/status:'approved'.*\n\s*try\{\n\s*if\(decision==='approve'\)/);
});
