'use strict';
// Central entitlement resolver. No payment is inferred from an admin grant.
// Phase 3 will integrate verified PAID subscription rows without touching
// legacy manual benefits until a separate audited migration.
const BillingGrant=require('../models/BillingGrant');
const BillingOrder=require('../models/BillingOrder');
const {paidRights}=require('./broadcasterPurchaseRules');
const {effectiveRights,projectUserEntitlements}=require('./billingEntitlementRules');

async function activeGrantsFor(user,now=new Date()){
 if(!user?._id)return [];
 return BillingGrant.find({
   accountId:user._id,source:'admin_complimentary',revokedAt:null,
   startsAt:{$lte:now},$or:[{expiresAt:null},{expiresAt:{$gt:now}}]
 }).lean();
}

async function activeBroadcasterOrders(user,now=new Date()){
 if(process.env.APP_ENV!=='staging'||!user?._id||user.role!=='broadcaster')return [];
 return require('../models/BroadcasterBillingOrder').find({accountId:user._id,
  environment:'staging',status:'paid',
  sku:{$in:['B-PREM','ADD-DSP','ADD-AN','ADD-ADS']},
  periodStartsAt:{$lte:now},periodEndsAt:{$gt:now}}).lean();
}
async function accountRights(user,now=new Date()){
 const rights=new Set(effectiveRights(user,await activeGrantsFor(user,now),{now}));
 if(user?.role==='broadcaster'){
  const orders=await activeBroadcasterOrders(user,now);
  for(const right of paidRights(orders,null,now))rights.add(right);
 }
 // Sandbox paid orders must never unlock rights in production, even if staging
 // records are copied during a data migration.
 if(process.env.APP_ENV==='staging' && user?._id && user.role==='user'){
  const paid=await BillingOrder.exists({accountId:user._id,sku:{$in:['L-PREM','L-WINBACK-199']},
   status:'paid',environment:'staging',periodStartsAt:{$lte:now},
   $or:[{periodEndsAt:{$gt:now}},{graceEndsAt:{$gt:now}}]});
  if(paid)rights.add('listener.premium');
 }
 return [...rights].sort();
}

async function hasAccountRight(user,entitlement){
 if(!user)return false;
 if(user.role==='admin')return true;
 return (await accountRights(user)).includes(entitlement);
}

async function hasStationRight(user,station,entitlement){
 if(!user||!station)return false;
 if(user.role==='admin')return true;
 if(user.role!=='broadcaster' ||
   String(station.broadcasterId||'')!==String(user._id))return false;
 const now=new Date();
 const [grants,orders]=await Promise.all([
  activeGrantsFor(user,now),activeBroadcasterOrders(user,now)
 ]);
 const rights=new Set(effectiveRights(user,grants,{stationId:station._id,now}));
 for(const right of paidRights(orders,station._id,now))rights.add(right);
 return rights.has(entitlement);
}

async function projectAccountUser(user){
 if(!user)return user;
 return projectUserEntitlements(user,await accountRights(user));
}

module.exports={effectiveRights,activeGrantsFor,activeBroadcasterOrders,accountRights,
  hasAccountRight,hasStationRight,projectAccountUser};
