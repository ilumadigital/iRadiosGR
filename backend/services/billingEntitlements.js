'use strict';
// Central entitlement resolver. No payment is inferred from an admin grant.
// Phase 3 will integrate verified PAID subscription rows without touching
// legacy manual benefits until a separate audited migration.
const BillingGrant=require('../models/BillingGrant');
const {legacyRights,effectiveRights,projectUserEntitlements}=require('./billingEntitlementRules');

async function activeGrantsFor(user,now=new Date()){
 if(!user?._id)return [];
 return BillingGrant.find({
   accountId:user._id,source:'admin_complimentary',revokedAt:null,
   startsAt:{$lte:now},$or:[{expiresAt:null},{expiresAt:{$gt:now}}]
 }).lean();
}

async function accountRights(user,now=new Date()){
 return effectiveRights(user,await activeGrantsFor(user,now),{now});
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
 return effectiveRights(user,await activeGrantsFor(user,now),
  {stationId:station._id,now}).includes(entitlement);
}

async function projectAccountUser(user){
 if(!user)return user;
 return projectUserEntitlements(user,await accountRights(user));
}

module.exports={legacyRights,effectiveRights,activeGrantsFor,accountRights,
  hasAccountRight,hasStationRight,projectAccountUser};
