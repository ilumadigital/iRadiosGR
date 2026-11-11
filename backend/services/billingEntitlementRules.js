'use strict';
// Account and station rights must originate from verified paid periods or
// unexpired, admin-issued complimentary grants. Broadcaster legacy flags and
// tier are historical only and must never unlock a new billing right.
const {resolveComplimentaryEntitlements}=require('./billingPolicy');
const {withBroadcasterTermsStatus}=require('../utils/broadcasterTerms');

// Listener migration is deliberately separate: existing manually granted
// Listener Premium accounts retain their old rights until the Listener billing
// migration. This compatibility NEVER applies to a Broadcaster.
const listenerCompatibilityRights=user=>user?.role==='user'&&user.isPremium===true?
 ['listener.premium']:[];

function effectiveRights(user,grants,{stationId=null,campaignId=null,now=new Date()}={}){
 if(!user)return [];
 const ownGrants=(grants||[]).filter(g=>String(g.accountId)===String(user._id));
 const rights=new Set([
   ...listenerCompatibilityRights(user),
   ...resolveComplimentaryEntitlements(ownGrants,{stationId,campaignId,now})
 ]);
 return [...rights].sort();
}

function projectUserEntitlements(user,rights){
 const data=withBroadcasterTermsStatus(user);
 if(!data)return data;
 const set=new Set(rights||[]);
 if(data.role==='broadcaster'){
  // Legacy Premium and feature flags can remain in historical documents but
  // cannot be re-surfaced as active entitlements in any API response.
  data.isPremium=false;
  const p={...(data.broadcasterProfile||{})};
  const premium=set.has('broadcaster.unlimited_stations');
  p.tier=premium?'premium':'free';
  p.maxStations=premium?Math.max(3,Number(p.maxStations)||3):3;
  p.features={
   ...(p.features||{}),
   dspEngine:set.has('broadcaster.webdsp'),
   analytics:set.has('broadcaster.analytics'),
   adControl:set.has('broadcaster.ad_control')
  };
  // No station-scoped addon is promoted to a global profile feature.
  data.broadcasterProfile=p;
 }else{
  data.isPremium=set.has('listener.premium');
 }
 data.billingEntitlements=[...set].sort();
 data.billingAutomaticRenewalsAvailable=false;
 return data;
}
module.exports={effectiveRights,listenerCompatibilityRights,projectUserEntitlements};
