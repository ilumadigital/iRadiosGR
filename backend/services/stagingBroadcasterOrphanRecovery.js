'use strict';
// Manual, single-order recovery for a staging HPP intent whose original Gateway
// payment row AND Nexi Sandbox order were independently confirmed absent.
// Never run in production, and never call provider checkout/MIT/cancellation.
const ID=/^[a-f0-9]{24}$/i;
const ORDER=/^IL[A-F0-9]{24}$/;
const PAYMENT=/^[a-f0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function reject(code){
 const error=new Error(code);
 error.code=code;
 throw error;
}

async function signedAbsent(lookup,label){
 try {
  await lookup();
 }catch(error){
  if(error?.code==='GATEWAY_HTTP_404')return;
  reject(label+'_NOT_CONFIRMED');
 }
 reject(label+'_STILL_EXISTS');
}

/**
 * Operator-only command; it is NOT an HTTP route or an automatic scheduler.
 * A separate operator-verified Nexi Sandbox GET 404 is mandatory because the
 * Gateway's signed GET can only establish absence from its own staging ledger.
 * This function itself uses ONLY signed GET/status calls, never provider writes.
 */
async function reviewOrphan({
 orderId,expectedGatewayOrderId,sandbox404For,confirmStagingOrigin=false,
 apply=false,now=new Date()
}, {Model,gateway,environment}){
 if(process.env.APP_ENV!=='staging'||process.env.IRADIOS_GATEWAY_ENV!=='staging'||
   environment.mode()!=='staging'||!environment.configured())
  reject('STAGING_ENVIRONMENT_NOT_VERIFIED');
 if(confirmStagingOrigin!==true)reject('STAGING_ORIGIN_CONFIRMATION_REQUIRED');
 if(!ID.test(orderId||'')||!ORDER.test(expectedGatewayOrderId||'')||
   sandbox404For!==expectedGatewayOrderId)
  reject('EXACT_SANDBOX_404_ORDER_CONFIRMATION_REQUIRED');
 if(!Number.isFinite(+now))reject('INVALID_CLOCK');

 const row=await Model.findOne({
  _id:orderId,environment:'staging',sku:'B-PREM'
 }).lean();
 if(!row)reject('STAGING_PREMIUM_ORDER_NOT_FOUND');
 const account=String(row.accountId||'');
 const expectedKey='iradios-bstage-'+account+'-';
 if(row.status!=='unknown'||row.billingOrigin!=='checkout'||
   row.environment!=='staging'||row.sku!=='B-PREM'||
   String(row.gatewayOrderId)!==expectedGatewayOrderId||
   !ID.test(account)||typeof row.requestKey!=='string'||
   !row.requestKey.startsWith(expectedKey)||
   !UUID.test(row.requestKey.slice(expectedKey.length))||
   row.scopeType!=='account'||row.resourceId!=null||
   row.amountCents!==9900||row.currency!=='EUR'||
   row.lockKey!==account+':B-PREM:account'||
   row.gatewayPaymentId!=null&&!PAYMENT.test(row.gatewayPaymentId)||
   row.checkoutUrl!=null||
   row.paidAt!=null||row.periodStartsAt!=null||
   row.periodEndsAt!=null||row.graceEndsAt!=null||
   (row.eventIds||[]).length!==0||(row.eventLog||[]).length!==0||
   ['paid','redirect'].includes(row.providerStatus))
  reject('ORDER_NOT_ELIGIBLE_FOR_STAGING_RECOVERY');

 const age=+now-new Date(row.createdAt).getTime();
 if(!Number.isFinite(age)||age<120000)reject('ORDER_NOT_OLD_ENOUGH');

 // Both HMAC lookups must be missing for the same staging tenant.
 await signedAbsent(
  ()=>gateway.broadcasterPaymentByRequestKey(row.requestKey,'B-PREM'),
  'GATEWAY_REQUEST_KEY');
 if(row.gatewayPaymentId){
  await signedAbsent(
   ()=>gateway.broadcasterPaymentStatus(
    row.gatewayPaymentId,expectedGatewayOrderId,'B-PREM'),
   'GATEWAY_PAYMENT_ID');
 }
 const recurring=await gateway.broadcasterRecurringStatus({_id:row.accountId},'B-PREM');
 // Any registered/pending contract is grounds to STOP, not a reason to
 // mark a payment failed or to alter its mandate.
 if(recurring?.state!=='none')reject('GATEWAY_PREMIUM_MANDATE_NOT_ABSENT');

 const result={
  orderId, gatewayOrderId:expectedGatewayOrderId,
  environment:'staging',sku:'B-PREM',amountCents:9900,
  gatewayRequestKey:'404', gatewayPaymentId:row.gatewayPaymentId?'404':'not_recorded',
  gatewayPremiumMandate:'none',sandboxOrder:'operator_confirmed_404',
  state:apply?'RELEASED':'READY_FOR_OPERATOR_RELEASE'
 };
 if(!apply)return result;

 // Atomic CAS: a concurrent webhook, payment recovery or paid period wins,
 // preserving the lock. No DELETE, no Gateway or Nexi mutation.
 const filter={
  _id:row._id,accountId:row.accountId,environment:'staging',
  sku:'B-PREM',status:'unknown',billingOrigin:'checkout',
  requestKey:row.requestKey,lockKey:row.lockKey,
  gatewayOrderId:expectedGatewayOrderId,
  gatewayPaymentId:row.gatewayPaymentId??null,
  paidAt:null,periodStartsAt:null,periodEndsAt:null,
  'eventIds.0':{$exists:false},'eventLog.0':{$exists:false}
 };
 const change={
  $set:{
   status:'failed',providerStatus:'not_created',checkoutUrl:null,
   lastErrorCode:'STAGING_SANDBOX_ORDER_ABSENT_CONFIRMED',
   gatewayLastCheckedAt:now
  },
  $unset:{lockKey:''}
 };
 const updated=await Model.updateOne(filter,change);
 if(updated.modifiedCount!==1)reject('CONCURRENT_CHANGE_NO_RELEASE');
 return result;
}

module.exports={reviewOrphan};
