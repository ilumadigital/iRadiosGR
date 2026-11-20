'use strict';
// Mongo's existing globally unique lockKey index must NOT be dropped.
// Prefix NEW checkout lock values by the real iRadios app environment so
// imported staging locks cannot collide with new production orders.
// Legacy unprefixed locks remain eligible blockers in THEIR OWN environment.
const ID=/^[a-f0-9]{24}$/i;
const SKU=/^[A-Z0-9-]{2,40}$/;
const ENV=new Set(['staging','production']);
function lockScope({environment,accountId,sku,scopeId}) {
  const account=String(accountId||'').toLowerCase();
  const resource=String(scopeId||'');
  if(!ENV.has(environment)||!ID.test(account)||!SKU.test(String(sku||''))||
    (resource!=='account'&&!ID.test(resource)))
    throw Error('INVALID_BROADCASTER_LOCK_SCOPE');
  const legacy=account+':'+sku+':'+resource;
  const scoped=environment+':'+legacy;
  return Object.freeze({environment,legacy,scoped,
    candidates:Object.freeze([scoped,legacy])});
}
function scopedLockQuery(scope){
  if(!scope||!ENV.has(scope.environment)||
    !Array.isArray(scope.candidates)||scope.candidates.length!==2)
    throw Error('INVALID_BROADCASTER_LOCK_SCOPE');
  return {environment:scope.environment,lockKey:{$in:[...scope.candidates]}};
}
async function findExistingLocked(Model,scope){
  // Require an environment match even if the legacy lock string is identical.
  return Model.findOne(scopedLockQuery(scope)).lean();
}
async function findIdempotent(Model,scope,requestKey){
  if(typeof requestKey!=='string'||!requestKey.startsWith('iradios-bstage-'))
    throw Error('INVALID_BROADCASTER_REQUEST_KEY');
  return Model.findOne({environment:scope.environment,requestKey}).lean();
}
function safeToReleaseTerminal(order,scope){
  return Boolean(order&&order.environment===scope.environment&&
    scope.candidates.includes(order.lockKey)&&
    ['failed','canceled'].includes(order.status)&&
    order.paidAt==null&&order.periodStartsAt==null&&
    order.periodEndsAt==null&&order.graceEndsAt==null&&
    order.providerStatus!=='paid'&&
    !(order.eventIds||[]).length&&!(order.eventLog||[]).length);
}
async function releaseOrphanTerminalLock(Model,order,scope){
  if(!safeToReleaseTerminal(order,scope))return false;
  const result=await Model.updateOne({
    _id:order._id,environment:scope.environment,lockKey:order.lockKey,
    status:{$in:['failed','canceled']},paidAt:null,periodStartsAt:null,
    periodEndsAt:null,graceEndsAt:null,providerStatus:{$ne:'paid'},
    'eventIds.0':{$exists:false},'eventLog.0':{$exists:false}
  },{$unset:{lockKey:''}});
  return result.modifiedCount===1;
}
module.exports={lockScope,scopedLockQuery,findExistingLocked,findIdempotent,
  safeToReleaseTerminal,releaseOrphanTerminalLock};
