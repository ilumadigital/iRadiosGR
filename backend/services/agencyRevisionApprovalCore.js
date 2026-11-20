'use strict';
// Pure crash-recoverable Agency revision decision protocol. The creative and
// its applied-revision marker commit in ONE Mongo document; the revision
// stays "pending" (and therefore uniquely locked) until that commit is proven.
// On crash it is safe to retry the SAME Admin approval request. A conflict
// remains locked for operator review rather than silently approving stale ads.
const same=(a,b)=>String(a??'')===String(b??'');
const field=(creative,key)=>typeof creative?.get==='function'?
 creative.get(key):creative?.[key];
function beforeMatches(revision,creative){
 if(!revision||!creative)return false;
 return Object.entries(revision.before||{}).every(([key,previous])=>
  JSON.stringify(field(creative,key)??null)===JSON.stringify(previous??null));
}
function timestampMatches(revision,creative){
 const prev=revision?.baseUpdatedAt;
 const current=field(creative,'updatedAt');
 if(!prev||!current)return !prev&&!current;
 const a=new Date(prev).getTime(),b=new Date(current).getTime();
 return Number.isFinite(a)&&Number.isFinite(b)&&a===b;
}
function markedApplied(revision,creative){
 return Boolean(creative)&&same(field(creative,'lastApprovedRevisionId'),revision._id);
}
const conflict=(code='already_decided')=>({state:'conflict',code,notify:false});
async function reviewAgencyRevision({revisionId,decision,reviewerId,reason=''},store){
 if(!revisionId||!reviewerId||!['approve','reject'].includes(decision)||
    !store||['getRevision','getCreative','claimApproval','applyApproval',
      'finalizeApproval','reject'].some(key=>typeof store[key]!=='function'))
  throw Error('Invalid Agency approval request');
 let revision=await store.getRevision(revisionId);
 if(!revision||revision.status!=='pending')return conflict();
 const creative=await store.getCreative(revision);
 if(!creative)return {state:'not_found',notify:false};
 if(decision==='reject'){
  if(revision.processing)return conflict('approval_in_progress');
  const rejected=await store.reject(revision,reviewerId,reason);
  if(!rejected)return conflict('concurrent_decision');
  return {state:'rejected',notify:true,creative,revision:rejected};
 }
 if(revision.processing){
  if(revision.processingDecision!=='approve')
   return conflict('incompatible_processing_state');
 }else{
  if(!beforeMatches(revision,creative)||!timestampMatches(revision,creative))
   return conflict('creative_changed');
  const claimed=await store.claimApproval(revision,reviewerId);
  if(claimed)revision=claimed;
  else{
   // Another Admin may have won the claim. Only the same in-progress
   // approval can be resumed, never a concurrent reject/other decision.
   revision=await store.getRevision(revisionId);
   if(!revision||revision.status!=='pending'||
      revision.processing!==true||revision.processingDecision!=='approve')
    return conflict('concurrent_decision');
  }
 }
 // Re-read latest creative. If a crash happened after the atomic creative
 // mutation but before finalizing the revision, the marker proves success.
 let latest=await store.getCreative(revision);
 if(!latest)return {state:'not_found',notify:false};
 if(!markedApplied(revision,latest)){
  const written=await store.applyApproval(revision);
  if(!written){
   latest=await store.getCreative(revision);
   if(!markedApplied(revision,latest))
    return {state:'needs_manual_review',code:'stale_or_failed_apply',
     notify:false};
  }else latest=written;
 }
 const finalized=await store.finalizeApproval(revision,reviewerId);
 if(!finalized){
  const after=await store.getRevision(revisionId);
  return after?.status==='approved'?
   {state:'approved',notify:false,duplicate:true,creative:latest,revision:after}:
   {state:'needs_manual_review',code:'finalization_unknown',notify:false};
 }
 return {state:'approved',notify:true,creative:latest,revision:finalized};
}
module.exports={beforeMatches,timestampMatches,markedApplied,reviewAgencyRevision};
