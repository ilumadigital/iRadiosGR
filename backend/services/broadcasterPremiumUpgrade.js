'use strict';
// A paid B-PREM supersedes future ADD-* renewals only after a signed
// payment.paid event. Persistent, idempotent cancellation jobs prevent the
// Gateway callback from depending on synchronous provider availability.
const ADDONS=new Set(['ADD-DSP','ADD-AN','ADD-ADS']);
const PENDING=new Set(['creating','pending','redirect','unknown']);
const ACTIVE_MANDATE=new Set(['active','pending','verification_pending','past_due']);
const HEX24=/^[a-f0-9]{24}$/i;

function targetsFromOrders(orders){
 const seen=new Set(),targets=[];
 for(const row of orders||[]){
  if(!ADDONS.has(row.sku)||row.autoRenewRequested!==true||
     !['paid',...PENDING].includes(row.status)||
     !HEX24.test(String(row.resourceId||'')))continue;
  const station=String(row.resourceId),key=row.sku+':'+station;
  if(seen.has(key))continue;
  seen.add(key);
  targets.push({sku:row.sku,stationId:station,state:'pending'});
 }
 return targets;
}

// No new payment, no MIT execution: this calls only Gateway contract status
// and cancellation. A missing mandate is NOT definitive while its original
// local checkout remains unresolved.
async function cancelTarget(item,user,environment,{gateway,Order}){
 const stationId=String(item.stationId);
 if(!ADDONS.has(item.sku)||!HEX24.test(stationId))
  throw Error('Invalid cancellation target');
 const status=await gateway.broadcasterRecurringStatus(user,item.sku,stationId);
 if(!status||status.state==='unavailable')
  throw Object.assign(Error('Mandate state unavailable'),{code:'MANDATE_UNAVAILABLE'});
 if(status.state==='cancelled')return true;
 if(status.state==='none'){
  const open=await Order.exists({
   accountId:user._id,environment,sku:item.sku,resourceId:item.stationId,
   autoRenewRequested:true,status:{$in:[...PENDING]}
  });
  return !open;
 }
 if(!ACTIVE_MANDATE.has(status.state))
  throw Object.assign(Error('Unexpected mandate status'),{code:'MANDATE_STATUS_INVALID'});
 const cancelled=await gateway.cancelBroadcasterRecurring(user,item.sku,stationId);
 if(!cancelled||!['cancelled','none'].includes(cancelled.state))
  throw Object.assign(Error('Mandate cancellation unconfirmed'),{code:'MANDATE_CANCEL_UNCONFIRMED'});
 return true;
}

async function ensurePaidUpgrade(order){
 const environment=require('./gatewayEnvironment').mode();
 if(!order||order.sku!=='B-PREM'||order.status!=='paid'||
    !['staging','production'].includes(environment)||
    order.environment!==environment||order.scopeType!=='account'||
    order.resourceId!=null||!order.accountId||!order._id)
  throw Error('Only verified paid account Premium can schedule addon cancellation');
 const Order=require('../models/BroadcasterBillingOrder');
 const Job=require('../models/BroadcasterPremiumUpgrade');
 // The unique premiumOrderId index must exist before a concurrent webhook retry.
 await Job.init();
 // Include in-flight add-on intents: an existing HPP may settle after Premium.
 const rows=await Order.find({
  accountId:order.accountId,environment,
  sku:{$in:[...ADDONS]},autoRenewRequested:true,
  status:{$in:['paid',...PENDING]}
 }).select('sku resourceId status autoRenewRequested').limit(501).lean();
 if(rows.length>500)throw Error('Too many addon agreements; manual review required');
 const items=targetsFromOrders(rows);
 try{
  const job=await Job.findOneAndUpdate({premiumOrderId:order._id},{
   $setOnInsert:{
    premiumOrderId:order._id,accountId:order.accountId,environment,
    status:items.length?'pending':'complete',items,
    leaseUntil:new Date(0),
    ...(items.length?{}:{completedAt:new Date()})
   }
  },{upsert:true,new:true,setDefaultsOnInsert:true}).lean();
  if(String(job.accountId)!==String(order.accountId)||job.environment!==environment)
   throw Error('Premium upgrade job provenance mismatch');
  return job;
 }catch(e){
  // A simultaneous duplicate webhook can race on the unique premiumOrderId.
  if(e.code!==11000)throw e;
  const job=await Job.findOne({premiumOrderId:order._id}).lean();
  if(!job||String(job.accountId)!==String(order.accountId)||
     job.environment!==environment)throw Error('Premium upgrade job conflict');
  return job;
 }
}

async function processJob(job,now=new Date()){
 const environment=require('./gatewayEnvironment').mode();
 if(!job||job.status!=='pending'||job.environment!==environment)return 0;
 const Order=require('../models/BroadcasterBillingOrder');
 const Job=require('../models/BroadcasterPremiumUpgrade');
 const User=require('../models/User');
 const gateway=require('./ilumaGatewayClient');
 const premium=await Order.findOne({
  _id:job.premiumOrderId,accountId:job.accountId,environment,
  sku:'B-PREM',status:'paid',scopeType:'account',resourceId:null
 }).select('_id').lean();
 if(!premium)throw Error('Premium payment provenance unavailable');
 const user=await User.findOne({_id:job.accountId,role:'broadcaster'}).select('_id role').lean();
 if(!user)throw Error('Paid broadcaster account unavailable');
 let complete=0,attempted=0;
 // Bound each lease to at most six provider cancellation attempts.
 for(let i=0;i<job.items.length&&attempted<6;i++){
  const item=job.items[i];
  if(item.state!=='pending')continue;
  attempted++;
  let done=false,lastErrorCode=null;
  try{
   done=await cancelTarget(item,user,environment,{gateway,Order});
  }catch(e){
   lastErrorCode=/^[A-Z0-9_]{3,64}$/.test(e.code||'')?e.code:'GATEWAY_UNAVAILABLE';
   console.warn('[BROADCASTER UPGRADE] Addon cancellation deferred',lastErrorCode);
  }
  const selector={_id:job._id,environment,status:'pending',leaseUntil:job.leaseUntil,
   ['items.'+i+'.state']:'pending'};
  const changes={$set:{
   ['items.'+i+'.checkedAt']:new Date(),
   ['items.'+i+'.lastErrorCode']:done?null:lastErrorCode
  }};
  if(done){changes.$set['items.'+i+'.state']='complete';complete++;}
  await Job.updateOne(selector,changes);
 }
 const remaining=await Job.exists({_id:job._id,environment,'items.state':'pending'});
 await Job.updateOne({_id:job._id,environment,status:'pending',leaseUntil:job.leaseUntil},
  {$set:remaining?{leaseUntil:new Date(+now+60000)}:
    {status:'complete',completedAt:new Date(),leaseUntil:new Date(0)}});
 return complete;
}

module.exports={targetsFromOrders,cancelTarget,ensurePaidUpgrade,processJob};
