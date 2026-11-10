'use strict';
const cron=require('node-cron');
const mongoose=require('mongoose');
const User=require('../models/User');
const BillingOrder=require('../models/BillingOrder');
const BillingEmailDispatch=require('../models/BillingEmailDispatch');
const {paidRenewalState,DAY_MS}=require('../services/billingRenewalRules');
const {evaluate:winbackPolicy}=require('../services/winbackEligibility');
const {hasAccountRight}=require('../services/billingEntitlements');
const gateway=require('../services/ilumaGatewayClient');
const {canNotify}=require('./notificationPreferences');
const {tokenFor}=require('./notificationUnsubscribe');
const {siteOrigin}=require('./emailDesign');
const {premiumBillingEmail}=require('./premiumBillingEmailTemplates');
const {sendEmail}=require('./myMailer');

const PREMIUM_SKUS=['L-PREM','L-WINBACK-199'];
const KINDS=['welcome','soon','grace','cancelled','expired','winback'];
const staging=()=>process.env.APP_ENV==='staging';
const safeId=v=>String(v||'');
const validKey=s=>/^[a-zA-Z0-9:._-]{1,190}$/.test(s);
let running=false,started=false,indexPromise=null;
function ready(){
 if(!staging())return Promise.resolve(false);
 if(!indexPromise)indexPromise=BillingEmailDispatch.createIndexes()
  .then(()=>true).catch(e=>{indexPromise=null;throw e;});
 return indexPromise;
}
async function enqueue(kind,userId,orderId,event=null){
 if(!staging()||!KINDS.includes(kind)||!userId)return false;
 const key=['premium-email',kind,safeId(userId),event?String(event):safeId(orderId)].join(':');
 if(!validKey(key))throw Error('Invalid billing email idempotency key');
 await ready();
 try{
  await BillingEmailDispatch.create({_id:key,kind,accountId:userId,orderId:orderId||null,dueAt:new Date()});
  return true;
 }catch(e){
  if(e.code===11000)return false;
  throw e;
 }
}
async function enqueuePaidWelcome(order){
 if(!staging()||!order||order.status!=='paid'||order.billingOrigin==='automatic_renewal')return false;
 return enqueue('welcome',order.accountId,order._id);
}
async function enqueueCancellation(user,recurring){
 if(!staging()||!user||recurring?.state!=='cancelled'||!recurring.cancelled_at)return false;
 // One message per provider cancellation event, not per button click.
 const event=new Date(recurring.cancelled_at);
 if(!Number.isFinite(+event))return false;
 const latest=await BillingOrder.findOne({accountId:user._id,status:'paid',environment:'staging',
  sku:{$in:PREMIUM_SKUS}}).sort({periodEndsAt:-1,paidAt:-1}).lean();
 if(!latest)return false;
 return enqueue('cancelled',user._id,latest._id,event.toISOString().replace(/[:.]/g,'-'));
}
async function latestPaid(userId){
 return BillingOrder.findOne({accountId:userId,status:'paid',environment:'staging',
  sku:{$in:PREMIUM_SKUS}}).sort({periodEndsAt:-1,paidAt:-1}).lean();
}
async function winbackAllowed(user,paid,now){
 if(!canNotify(user,'email','promotions'))return null;
 if(await hasAccountRight(user,'listener.premium'))return null;
 const evaluated=winbackPolicy({lastPaid:paid,hasPremium:false,now});
 if(!evaluated.eligible)return null;
 const [claim,recurring]=await Promise.all([
  gateway.winbackStatus(user),gateway.recurringStatus(user)
 ]);
 if(!claim||claim.state==='unavailable'||claim.used||claim.state==='pending')return null;
 if(['active','pending','verification_pending','past_due'].includes(recurring.state))return null;
 return evaluated;
}
async function scanBillingWindows(now=new Date()){
 if(!staging()||mongoose.connection.readyState!==1)return 0;
 // Only genuine, signed, staging Premium paid orders. Never bulk-email
 // imported Free users, admin grants, unverified accounts or legacy orders.
 const rows=await BillingOrder.find({environment:'staging',status:'paid',
  sku:{$in:PREMIUM_SKUS},
  periodEndsAt:{$gte:new Date(+now-42*DAY_MS),$lte:new Date(+now+DAY_MS)}
 }).sort({periodEndsAt:-1,paidAt:-1}).limit(500).lean();
 const seen=new Set();let queued=0;
 for(const row of rows){
  const id=safeId(row.accountId);
  if(seen.has(id))continue;
  seen.add(id);
  const order=await latestPaid(row.accountId);
  if(!order||safeId(order._id)!==safeId(row._id))continue;
  const user=await User.findById(row.accountId).select(
   '_id email fname role isVerified notificationPreferences').lean();
  if(!user||user.role!=='user'||user.isVerified!==true||!user.email)continue;
  const state=paidRenewalState(order,now);
  if(!state)continue;
  if(state.kind==='soon'){
   // Suppress early-warning mail when a live and enabled recurring worker
   // would also suppress the corresponding modal.
   try{
    const recurring=await gateway.recurringStatus(user);
    if(recurring.state==='active'&&recurring.execution_enabled===true)continue;
   }catch{continue;}
   if(await enqueue('soon',user._id,order._id))queued++;
  }else if(state.kind==='grace'){
   if(await enqueue('grace',user._id,order._id))queued++;
  }else if(state.kind==='expired'){
   if(await hasAccountRight(user,'listener.premium'))continue;
   // Expiry announcement only once around real expiry (including grace).
   const expiry=+new Date(state.graceEndsAt);
   if(+now-expiry<DAY_MS && await enqueue('expired',user._id,order._id))queued++;
   // Don't deliver two emails at the same instant the Premium expires.
   // The offer ticker starts immediately; marketing email follows at least
   // 24 hours later, only with explicit marketing consent and verified
   // Gateway one-time entitlement. This is not a billing reminder.
   if(+now-expiry>=DAY_MS){
    try{
     if(await winbackAllowed(user,order,now) &&
        await enqueue('winback',user._id,order._id))queued++;
    }catch(e){console.warn('[PREMIUM MAIL] Winback eligibility deferred',e.code||e.message);}
   }
  }
 }
 return queued;
}
async function resolveTemplate(row,user,now){
 const order=row.orderId?await BillingOrder.findById(row.orderId).lean():null;
 const kind=row.kind;
 if(!order||order.environment!=='staging'||safeId(order.accountId)!==safeId(user._id)||
    order.status!=='paid'||!PREMIUM_SKUS.includes(order.sku))return null;
 const options={kind,name:user.fname||user.username||'φίλε ακροατή',
  amountCents:order.amountCents,periodEndsAt:order.periodEndsAt,graceEndsAt:order.graceEndsAt};
 if(kind==='welcome'){
  if(order.billingOrigin==='automatic_renewal')return null;
  return premiumBillingEmail(options);
 }
 if(kind==='cancelled'){
  const contract=await gateway.recurringStatus(user);
  if(contract.state!=='cancelled')return null;
  // A new contract must not re-trigger the prior cancelled notification.
  if(!contract.cancelled_at||!row._id.endsWith(
   new Date(contract.cancelled_at).toISOString().replace(/[:.]/g,'-')))return null;
  return premiumBillingEmail(options);
 }
 const latest=await latestPaid(user._id);
 if(safeId(latest?._id)!==safeId(order._id))return null;
 const status=paidRenewalState(order,now);
 if(!status)return null;
 if(kind==='soon'||kind==='grace'){
  if(status.kind!==kind)return null;
  if(kind==='soon'){
   const recurring=await gateway.recurringStatus(user);
   if(recurring.state==='active'&&recurring.execution_enabled===true)return null;
  }
  return premiumBillingEmail(options);
 }
 if(kind==='expired'){
  if(status.kind!=='expired'||await hasAccountRight(user,'listener.premium'))return null;
  return premiumBillingEmail(options);
 }
 if(kind==='winback'){
  const offer=await winbackAllowed(user,order,now);
  if(!offer)return null;
  const token=tokenFor(user);
  const unsubscribeLink=token?siteOrigin()+'/api/notifications/unsubscribe?token='+encodeURIComponent(token):null;
  return premiumBillingEmail({...options,offerEndsAt:offer.offerEndsAt,unsubscribeLink});
 }
 return null;
}
async function deliverPending(now=new Date(),max=25){
 if(!staging()||mongoose.connection.readyState!==1)return 0;
 await ready();
 const rows=await BillingEmailDispatch.find({status:'pending',dueAt:{$lte:now},
  attempts:{$lt:5}}).sort({createdAt:1}).limit(Math.max(1,Math.min(50,max))).lean();
 let sent=0;
 for(const row of rows){
  const claimed=await BillingEmailDispatch.findOneAndUpdate(
   {_id:row._id,status:'pending',dueAt:{$lte:now}},
   {$set:{status:'sending',startedAt:now},$inc:{attempts:1}},{new:true});
  if(!claimed)continue;
  try{
   const user=await User.findById(claimed.accountId).select(
    '_id email username fname role isVerified notificationPreferences').lean();
   if(!user||user.role!=='user'||user.isVerified!==true||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(user.email||''))){
    await BillingEmailDispatch.updateOne({_id:row._id,status:'sending'},
     {$set:{status:'skipped',skipReason:'recipient_unavailable'}});
    continue;
   }
   const template=await resolveTemplate(claimed,user,now);
   if(!template){
    await BillingEmailDispatch.updateOne({_id:row._id,status:'sending'},
     {$set:{status:'skipped',skipReason:'no_longer_eligible'}});
    continue;
   }
   const result=await sendEmail({to:user.email,...template});
   if(!result?.success)throw Error('Mail transport rejected message');
   await BillingEmailDispatch.updateOne({_id:row._id,status:'sending'},
    {$set:{status:'sent',sentAt:new Date()}});
   sent++;
  }catch(e){
   console.warn('[PREMIUM MAIL] Delivery error',claimed.kind,e.code||e.message);
   // SMTP may have accepted the message when a process crashes. A row stuck
   // in "sending" is deliberately NOT retried automatically (no duplicates).
   // Explicit rejected responses can safely retry with bounded backoff.
   await BillingEmailDispatch.updateOne({_id:row._id,status:'sending'},
    {$set:{status:'pending',dueAt:new Date(Date.now()+Math.min(60,2**claimed.attempts)*60000)}});
  }
 }
 return sent;
}
async function run(now=new Date()){
 if(running||!staging()||mongoose.connection.readyState!==1)return;
 running=true;
 try{
  await ready();
  await scanBillingWindows(now);
  await deliverPending(now);
  // If the process was killed just after a payment webhook was persisted,
  // recover welcome events on the following scheduler tick.
  const since=new Date(+now-2*DAY_MS);
  const fresh=await BillingOrder.find({environment:'staging',status:'paid',
   billingOrigin:'checkout',paidAt:{$gte:since,$lte:now},
   sku:{$in:PREMIUM_SKUS}}).sort({paidAt:-1}).limit(100).lean();
  for(const row of fresh)await enqueuePaidWelcome(row);
  await deliverPending(now);
 }catch(e){console.error('[PREMIUM MAIL] Scheduler failed',e.code||e.message);}
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
 // Never block a signed Gateway webhook on SMTP/Mailpit.
 void deliverPending().catch(e=>console.warn('[PREMIUM MAIL] Kick deferred',e.code||e.message));
}
module.exports={start,run,enqueue,enqueuePaidWelcome,enqueueCancellation,
 scanBillingWindows,deliverPending,kick,resolveTemplate,winbackAllowed};
