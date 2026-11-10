'use strict';
// Side-effect-free rules: easy to test without MongoDB or a payment provider.
const {resolveComplimentaryEntitlements,ENTITLEMENTS}=require('./billingPolicy');
const {withBroadcasterTermsStatus}=require('../utils/broadcasterTerms');

const LEGACY_FEATURES=Object.freeze({
  dspEngine:'broadcaster.webdsp',
  analytics:'broadcaster.analytics',
  adControl:'broadcaster.ad_control'
});

function legacyRights(user){
 const rights=new Set();
 if(!user)return [];
 if(user.isPremium===true)rights.add('listener.premium');
 if(user.role==='broadcaster'){
  if(user.broadcasterProfile?.tier==='premium')
   for(const right of ENTITLEMENTS['B-PREM'])rights.add(right);
  for(const [flag,right] of Object.entries(LEGACY_FEATURES))
   if(user.broadcasterProfile?.features?.[flag]===true)rights.add(right);
 }
 return [...rights].sort();
}

function effectiveRights(user,grants,{stationId=null,campaignId=null,now=new Date()}={}){
 if(!user)return [];
 const ownGrants=(grants||[]).filter(g=>String(g.accountId)===String(user._id));
 const rights=new Set([
   ...legacyRights(user),
   ...resolveComplimentaryEntitlements(ownGrants,{stationId,campaignId,now})
 ]);
 return [...rights].sort();
}

function projectUserEntitlements(user,rights){
 const data=withBroadcasterTermsStatus(user);
 if(!data)return data;
 const set=new Set(rights||[]);
 if(set.has('listener.premium'))data.isPremium=true;
 if(data.role==='broadcaster'){
  const p={...(data.broadcasterProfile||{})};
  if(set.has('broadcaster.unlimited_stations'))p.tier='premium';
  // Account-level included features only. Per-STATION add-ons must never
  // be written to this account-wide compatibility structure.
  const features={...(p.features||{})};
  if(set.has('broadcaster.unlimited_stations')){
   features.adControl=true;features.analytics=true;features.dspEngine=true;
  }
  p.features=features;
  data.broadcasterProfile=p;
 }
 data.billingEntitlements=[...set].sort();
 data.billingAutomaticRenewalsAvailable=false;
 return data;
}

module.exports={legacyRights,effectiveRights,projectUserEntitlements};
