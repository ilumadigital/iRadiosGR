'use strict';
// Keep the current globally unique BillingOrder.lockKey index. New lock keys
// are environment-prefixed; old unprefixed keys still protect in-flight
// checkouts in THEIR OWN tenant (including winback -> L-PREM lock sharing).
const ENV=new Set(['staging','production']);
const ID=/^[a-f0-9]{24}$/i;
function listenerLockScope({environment,accountId}={}){
 const account=String(accountId||'').toLowerCase();
 if(!ENV.has(environment)||!ID.test(account))
  throw Error('INVALID_LISTENER_LOCK_SCOPE');
 const legacy=account+':L-PREM';
 const scoped=environment+':'+legacy;
 return Object.freeze({environment,accountId:account,legacy,scoped,
  candidates:Object.freeze([scoped,legacy])});
}
function lockedQuery(scope){
 if(!scope||!ENV.has(scope.environment)||!ID.test(scope.accountId)||
    !Array.isArray(scope.candidates)||scope.candidates.length!==2)
  throw Error('INVALID_LISTENER_LOCK_SCOPE');
 return {environment:scope.environment,accountId:scope.accountId,
  lockKey:{$in:[...scope.candidates]}};
}
async function findLocked(Model,scope){
 return Model.findOne(lockedQuery(scope)).lean();
}
async function findIdempotent(Model,scope,requestKey){
 if(!/^iradios-stage-[a-f0-9]{24}-[a-f0-9-]{36}$/i.test(String(requestKey||'')))
  throw Error('INVALID_LISTENER_REQUEST_KEY');
 return Model.findOne({environment:scope.environment,
  accountId:scope.accountId,requestKey}).lean();
}
function safeTerminal(order,scope){
 return Boolean(order&&order.environment===scope.environment&&
  String(order.accountId)===scope.accountId&&
  scope.candidates.includes(order.lockKey)&&
  ['failed','canceled'].includes(order.status)&&
  order.paidAt==null&&order.periodStartsAt==null&&
  order.periodEndsAt==null&&order.graceEndsAt==null&&
  order.providerStatus!=='paid'&&
  !(order.eventIds||[]).length&&!(order.eventLog||[]).length);
}
async function releaseTerminalLock(Model,order,scope){
 if(!safeTerminal(order,scope))return false;
 const result=await Model.updateOne({
  _id:order._id,environment:scope.environment,accountId:scope.accountId,
  lockKey:order.lockKey,status:{$in:['failed','canceled']},
  paidAt:null,periodStartsAt:null,periodEndsAt:null,graceEndsAt:null,
  providerStatus:{$ne:'paid'},
  'eventIds.0':{$exists:false},'eventLog.0':{$exists:false}
 },{$unset:{lockKey:''}});
 return result.modifiedCount===1;
}
module.exports={listenerLockScope,lockedQuery,findLocked,findIdempotent,
 safeTerminal,releaseTerminalLock};
