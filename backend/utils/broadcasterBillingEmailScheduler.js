'use strict';
const cron=require('node-cron');
const mongoose=require('mongoose');
const User=require('../models/User');
const Station=require('../models/Station');
const Order=require('../models/BroadcasterBillingOrder');
const Outbox=require('../models/BroadcasterBillingEmail');
const gateway=require('../services/ilumaGatewayClient');
const {broadcasterBillingEmail}=require('./broadcasterBillingEmailTemplates');
const {sendEmail}=require('./myMailer');
const {isSubscription,isBoost}=require('../services/broadcasterPurchaseRules');
const staging=()=>process.env.APP_ENV==='staging';
const DAY=86400000;
let started=false,running=false,readyIndexes=null;
function ready(){
 if(!staging())return Promise.resolve(false);
 if(!readyIndexes)readyIndexes=Outbox.createIndexes().then(()=>true)
   .catch(e=>{readyIndexes=null;throw e;});
 return readyIndexes;
}
function dispatchKey(kind,orderId,suffix=''){
 if(!['welcome','renewed','failed','cancelled','soon','expired'].includes(kind)||
    !/^[a-f0-9]{24}$/i.test(String(orderId||''))||
    (suffix&&(!/^[a-f0-9TZ.:-]{10,35}$/.test(suffix))))
  throw Error('Invalid Broadcaster mail identity');
 return 'broadcaster-mail:'+kind+':'+String(orderId)+(suffix?':'+suffix.replace(/[:.]/g,'-'):'');
}
async function enqueue(kind,order,suffix=''){
 if(!staging()||!order||order.environment!=='staging'||
   order.status!=='paid'||!order.accountId)return false;
 if(kind==='renewed'&&order.billingOrigin!=='automatic_renewal')return false;
 if(kind==='welcome'&&order.billingOrigin==='automatic_renewal')return false;
 if((kind==='renewed'||kind==='failed'||kind==='cancelled')&&!isSubscription(order.sku))return false;
 await ready();
 try{
  await Outbox.create({_id:dispatchKey(kind,order._id,suffix),
   accountId:order.accountId,orderId:order._id,sku:order.sku,
   resourceId:order.resourceId||null,kind,dueAt:new Date()});
  return true;
 }catch(e){if(e.code===11000)return false;throw e;}
}
async function enqueuePaid(order){
 if(!staging()||!order||order.status!=='paid')return false;
 return enqueue(order.billingOrigin==='automatic_renewal'?'renewed':'welcome',order);
}
async function enqueueFailedRenewal(order,paymentId){
 if(!staging()||!order||order.status!=='paid'||
   !isSubscription(order.sku)||
   !/^[a-f0-9]{32}$/.test(paymentId||''))return false;
 // One service notification per actual provider-declined MIT payment.
 // It never triggers a retry of that payment.
 return enqueue('failed',order,paymentId);
}
async function enqueueCancellation(user,{sku,stationId=null,recurring}){
 if(!staging()||!user||recurring?.state!=='cancelled'||!recurring.cancelled_at)return false;
 const cancelled=new Date(recurring.cancelled_at);
 if(!Number.isFinite(+cancelled))return false;
 const latest=await Order.findOne({
  accountId:user._id,sku,resourceId:stationId||null,
  environment:'staging',status:'paid'
 }).sort({periodEndsAt:-1}).lean();
 if(!latest)return false;
 return enqueue('cancelled',latest,cancelled.toISOString());
}
async function latestCycle(order){
 return Order.findOne({accountId:order.accountId,sku:order.sku,
  resourceId:order.resourceId||null,environment:'staging',status:'paid'
 }).sort({periodEndsAt:-1,paidAt:-1}).lean();
}
async function scan(now=new Date()){
 if(!staging()||mongoose.connection.readyState!==1)return 0;
 const rows=await Order.find({environment:'staging',status:'paid',
  periodEndsAt:{$gte:new Date(+now-2*DAY),$lte:new Date(+now+DAY)}})
  .sort({periodEndsAt:-1}).limit(350).lean();
 let count=0;
 for(const row of rows){
  const latest=await latestCycle(row);
  if(!latest||String(latest._id)!==String(row._id))continue;
  // No speculative reminder for an older already superseded period.
  const end=+new Date(row.periodEndsAt);
  const user=await User.findById(row.accountId).select('_id role isVerified').lean();
  if(!user||user.role!=='broadcaster'||user.isVerified!==true)continue;
  if(end>+now && end<=+now+DAY){
   if(isSubscription(row.sku)){
    // Active AND executable Nexi MIT should normally renew without user
    // intervention. Do not mislead or double-alert them.
    try{
     const state=await gateway.broadcasterRecurringStatus(user,row.sku,row.resourceId||null);
     if(state.state==='active'&&state.execution_enabled===true)continue;
    }catch{continue;}
   }
   if(await enqueue('soon',row))count++;
  }else if(end<=+now && +now-end<=DAY){
   // Do not claim expiry if a newer paid period exists for the same scope.
   if(await enqueue('expired',row))count++;
  }
 }
 return count;
}
async function template(row,user,now){
 const order=row.orderId?await Order.findById(row.orderId).lean():null;
 if(!order||order.status!=='paid'||order.environment!=='staging'||
   String(order.accountId)!==String(user._id)||order.sku!==row.sku||
   String(order.resourceId||'')!==String(row.resourceId||''))return null;
 if(row.kind==='renewed'&&order.billingOrigin!=='automatic_renewal')return null;
 if(row.kind==='welcome'&&order.billingOrigin==='automatic_renewal')return null;
 let cancelledAt=null;
 if(row.kind==='cancelled'){
  const state=await gateway.broadcasterRecurringStatus(user,order.sku,order.resourceId||null);
  const date=new Date(state.cancelled_at);
  if(state.state!=='cancelled'||!Number.isFinite(+date)||
    row._id!==dispatchKey('cancelled',order._id,date.toISOString()))return null;
  cancelledAt=date;
 }
 if(row.kind==='failed'){
  // A delayed decline must not override a newer successful renewal.
  const latest=await latestCycle(order);
  if(!latest||String(latest._id)!==String(order._id))return null;
  const state=await gateway.broadcasterRecurringStatus(user,order.sku,order.resourceId||null);
  if(state.state!=='past_due')return null;
 }
 if(row.kind==='soon'||row.kind==='expired'){
  const latest=await latestCycle(order);
  if(!latest||String(latest._id)!==String(order._id))return null;
  const end=+new Date(order.periodEndsAt);
  if(row.kind==='soon'){
   if(end<=+now||end>+now+DAY)return null;
   if(isSubscription(order.sku)){
    const state=await gateway.broadcasterRecurringStatus(user,order.sku,order.resourceId||null);
    if(state.state==='active'&&state.execution_enabled===true)return null;
   }
  }
  if(row.kind==='expired'&&(end>+now||+now-end>DAY))return null;
 }
 const station=order.resourceId?await Station.findById(order.resourceId).select('name').lean():null;
 return broadcasterBillingEmail({kind:row.kind,sku:order.sku,
  name:user.fname||user.username||'',stationName:station?.name||null,
  amountCents:order.amountCents,periodEndsAt:order.periodEndsAt,cancelledAt});
}
async function deliver(now=new Date(),max=20){
 if(!staging()||mongoose.connection.readyState!==1)return 0;
 await ready();let sent=0;
 const rows=await Outbox.find({status:'pending',dueAt:{$lte:now},attempts:{$lt:5}})
  .sort({createdAt:1}).limit(Math.max(1,Math.min(40,max))).lean();
 for(const row of rows){
  const claim=await Outbox.findOneAndUpdate({
   _id:row._id,status:'pending',dueAt:{$lte:now}},
   {$set:{status:'sending',startedAt:now},$inc:{attempts:1}},{new:true});
  if(!claim)continue;
  try{
   const user=await User.findById(claim.accountId)
    .select('_id email username fname role isVerified').lean();
   if(!user||user.role!=='broadcaster'||user.isVerified!==true||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user.email||'')){
    await Outbox.updateOne({_id:claim._id,status:'sending'},{
     $set:{status:'skipped',skipReason:'recipient_unavailable'}});continue;
   }
   const mail=await template(claim,user,now);
   if(!mail){
    await Outbox.updateOne({_id:claim._id,status:'sending'},{
     $set:{status:'skipped',skipReason:'no_longer_eligible'}});continue;
   }
   // Catching errors after SMTP ACK must never retry blindly.
   const response=await sendEmail({to:user.email,...mail});
   if(!response?.success)throw Error('SMTP rejected message');
   sent++;
   try{
    await Outbox.updateOne({_id:claim._id,status:'sending'},
     {$set:{status:'sent',sentAt:new Date()}});
   }catch(e){console.error('[BROADCASTER MAIL] SMTP accepted; ledger needs operator review',
    e.code||'state_write_failed');}
  }catch(e){
   console.warn('[BROADCASTER MAIL] Attempt deferred',claim.kind,e.code||e.message);
   // This retry is valid ONLY on explicit transport failure, not after ACK.
   await Outbox.updateOne({_id:claim._id,status:'sending'},{
    $set:{status:'pending',dueAt:new Date(+now+Math.min(60,2**claim.attempts)*60000)}});
  }
 }
 return sent;
}
async function run(now=new Date()){
 if(running||!staging()||mongoose.connection.readyState!==1)return;
 running=true;
 try{
  await ready();
  // Recover paid hooks if the server died after the MongoDB paid update.
  const recent=await Order.find({environment:'staging',status:'paid',
   paidAt:{$gte:new Date(+now-3*DAY),$lte:now}})
   .sort({paidAt:-1}).limit(200).lean();
  for(const order of recent)await enqueuePaid(order);
  await scan(now);await deliver(now);
 }catch(e){console.error('[BROADCASTER MAIL] Scheduler deferred',e.code||e.message);}
 finally{running=false;}
}
function start(){
 if(started||!staging())return;
 started=true;
 cron.schedule('*/5 * * * *',()=>void run());
 mongoose.connection.once('connected',()=>void run());
 if(mongoose.connection.readyState===1)void run();
}
function kick(){
 if(!staging())return;
 void deliver().catch(e=>console.warn('[BROADCASTER MAIL] Kick deferred',e.code||e.message));
}
module.exports={start,run,enqueue,enqueuePaid,enqueueFailedRenewal,enqueueCancellation,scan,deliver,kick,template,
 dispatchKey};
