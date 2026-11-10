'use strict';
const cron=require('node-cron');
const mongoose=require('mongoose');
const gateway=require('../services/ilumaGatewayClient');
const {localStatusFromGatewayLookup}=require('../services/gatewayBillingProtocol');
const OPEN=Object.freeze(['creating','pending','redirect','unknown']);
const STAGE=()=>process.env.APP_ENV==='staging'&&gateway.configured();
let started=false,running=false;

/**
 * Read-only recovery for checkout intents whose POST response may have been lost.
 * Never POST a second /checkout, never infer an entitlement from a Gateway GET.
 * The signed payment.paid outbox webhook remains the ONLY activation authority.
 */
async function reconcileOne(row,now=new Date()){
 const Model=require('../models/BroadcasterBillingOrder');
 const cutoff=new Date(+now-60000);
 const claim=await Model.findOneAndUpdate({
  _id:row._id,environment:'staging',status:{$in:OPEN},
  $or:[{gatewayLastCheckedAt:null},{gatewayLastCheckedAt:{$lte:cutoff}}]
 },{$set:{gatewayLastCheckedAt:now}},{new:true}).lean();
 if(!claim)return 'busy';
 try{
  const provider=claim.gatewayPaymentId?
   await gateway.broadcasterPaymentStatus(claim.gatewayPaymentId,claim.gatewayOrderId,claim.sku):
   await gateway.broadcasterPaymentByRequestKey(claim.requestKey,claim.sku);
  // Even provider=paid is locally 'pending' until the authenticated webhook.
  const next=localStatusFromGatewayLookup(provider.status);
  const change={$set:{
   gatewayPaymentId:provider.payment_id,gatewayOrderId:provider.order_id,
   checkoutUrl:provider.checkout_url||null,status:next,providerStatus:provider.status,
   lastErrorCode:null
  }};
  if(next==='failed'||next==='canceled')change.$unset={lockKey:''};
  await Model.updateOne({_id:claim._id,environment:'staging',
    status:{$in:OPEN},gatewayLastCheckedAt:now},change);
  return next;
 }catch(error){
  const confirmedAbsent=error.code==='GATEWAY_HTTP_404' &&
   !claim.gatewayPaymentId&&!claim.gatewayOrderId&&
   +new Date(claim.createdAt)<=+now-120000;
  if(confirmedAbsent){
   // An authenticated read-only Gateway 404 may release a stale intent.
   // Unknown/timeout/5xx outcomes NEVER release the lock.
   await Model.updateOne({_id:claim._id,environment:'staging',
    status:{$in:['creating','pending','unknown']},
    gatewayPaymentId:{$exists:false},gatewayOrderId:{$exists:false},
    gatewayLastCheckedAt:now},{
     $set:{status:'failed',lastErrorCode:'GATEWAY_PAYMENT_NOT_CREATED'},
     $unset:{lockKey:''}
    });
   return 'not_created';
  }
  console.warn('[BROADCASTER BILLING] Read-only recovery deferred',
   typeof error.code==='string'?error.code:'gateway_unavailable');
  return 'deferred';
 }
}
async function runOnce(now=new Date()){
 if(!STAGE()||mongoose.connection.readyState!==1||running)return 0;
 running=true;
 try{
  const Model=require('../models/BroadcasterBillingOrder');
  const rows=await Model.find({
   environment:'staging',status:{$in:OPEN},
   createdAt:{$gte:new Date(+now-14*86400000),$lte:new Date(+now-30000)},
   $or:[{gatewayLastCheckedAt:null},
    {gatewayLastCheckedAt:{$lte:new Date(+now-60000)}}]
  }).sort({gatewayLastCheckedAt:1,createdAt:1}).limit(8).lean();
  let done=0;
  for(const row of rows){
   await reconcileOne(row,now);
   done++;
  }
  return done;
 }finally{running=false;}
}
function start(){
 if(started||!STAGE())return;
 started=true;
 cron.schedule('* * * * *',()=>{
  runOnce().catch(error=>console.warn('[BROADCASTER BILLING] Recovery scan deferred',
   error.code||error.name||'error'));
 });
}
module.exports={start,runOnce,reconcileOne};
