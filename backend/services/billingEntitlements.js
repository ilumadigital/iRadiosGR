'use strict';
// Staging Billing Phase 2: merge inherited legacy manually assigned rights with
// explicit, expiring complimentary grants. Neither source is a financial payment.
// A later phase will add verified PAID entitlement rows to this same resolver.
const BillingGrant=require('../models/BillingGrant');
const {resolveComplimentaryEntitlements,ENTITLEMENTS}=require('./billingPolicy');
const {withBroadcasterTermsStatus}=require('../utils/broadcasterTerms');
const legacyIncludes=new Set(ENTITLEMENTS['B-PREM']);

const LEGACY_FEATURES=Object.freeze({
  dspEngine:'broadcaster.webdsp',
  analytics:'broadcaster.analytics',
  adControl:'broadcaster.ad_control'
});

function legacyRights(user) {
  const rights=new Set();
  if(!user)return [];
  if(user.isPremium===true)rights.add('listener.premium');
  if(user.role==='broadcaster'){
    if(user.broadcasterProfile?.tier==='premium')
      for(const right of legacyIncludes)rights.add(right);
    for(const [flag,right] of Object.entries(LEGACY_FEATURES))
      if(user.broadcasterProfile?.features?.[flag]===true)rights.add(right);
  }
  return [...rights].sort();
}

function effectiveRights(user,grants,{stationId=null,campaignId=null,now=new Date()}={}) {
  if(!user)return [];
  const valid=(grants||[]).filter(g=>String(g.accountId)===String(user._id));
  const complimentary=resolveComplimentaryEntitlements(valid,{stationId,campaignId,now});
  return [...new Set([...legacyRights(user),...complimentary])].sort();
}

async function activeGrantsFor(user,now=new Date()){
  if(!user?._id)return [];
  return BillingGrant.find({
    accountId:user._id,source:'admin_complimentary',revokedAt:null,
    startsAt:{$lte:now},$or:[{expiresAt:null},{expiresAt:{$gt:now}}]
  }).lean();
}

async function accountRights(user,now=new Date()){
  const grants=await activeGrantsFor(user,now);
  return effectiveRights(user,grants,{now});
}

async function hasAccountRight(user,entitlement){
  if(!user)return false;
  if(user.role==='admin')return true; // Admin controls are separately role-protected.
  return (await accountRights(user)).includes(entitlement);
}

async function hasStationRight(user,station,entitlement){
  if(!user||!station)return false;
  if(user.role==='admin')return true;
  if(user.role!=='broadcaster' ||
    String(station.broadcasterId||'')!==String(user._id))return false;
  const now=new Date(),grants=await activeGrantsFor(user,now);
  return effectiveRights(user,grants,{stationId:station._id,now}).includes(entitlement);
}

async function projectAccountUser(user){
  if(!user)return user;
  const data=withBroadcasterTermsStatus(user);
  const all=await accountRights(user);
  const rights=new Set(all);
  // These are computed for BACKWARD COMPATIBILITY with existing React pages.
  // No mutation to the User document or its Stripe history.
  if(rights.has('listener.premium')) data.isPremium=true;
  if(data.role==='broadcaster'){
    const p={...(data.broadcasterProfile||{})};
    if(rights.has('broadcaster.unlimited_stations')) p.tier='premium';
    const features={...(p.features||{})};
    if(rights.has('broadcaster.unlimited_stations')){
      features.adControl=true;
      features.dspEngine=true;
      features.analytics=true;
    }
    p.features=features;
    data.broadcasterProfile=p;
  }
  data.billingEntitlements=all;
  data.billingAutomaticRenewalsAvailable=false;
  return data;
}

module.exports={legacyRights,effectiveRights,activeGrantsFor,accountRights,
  hasAccountRight,hasStationRight,projectAccountUser};
