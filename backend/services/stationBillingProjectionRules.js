'use strict';
const {effectiveRights}=require('./billingEntitlementRules');
const {paidRights,boostForStation,isBoost}=require('./broadcasterPurchaseRules');

// Old manual presets survive unchanged. NEW billing-managed presets become
// effectively OFF when their entitlement has expired or been revoked.
function maskStationPaidControls(station,owner,grantHistory,now=new Date(),paidHistory=[]){
 const data=typeof station.toObject==='function'?station.toObject():{...station};
 if(!owner||owner.role==='admin')return data;
 const relevant=(grantHistory||[]).some(g=>
   String(g.accountId)===String(owner._id)&&
   (g.sku==='B-PREM'&&g.scopeType==='account'||
    g.scopeType==='station'&&String(g.resourceId)===String(station._id)&&
      ['ADD-DSP','ADD-ADS'].includes(g.sku)));
 // Purchased Boost and the included Premium boost are projected at read time.
 // Manual editorial ordering stays untouched and is not overwritten by billing.
 const paid=paidHistory||[];
 const rights=new Set(effectiveRights(owner,grantHistory,{stationId:station._id,now}));
 for(const right of paidRights(paid,station._id,now))rights.add(right);
 const selected=(owner.broadcasterProfile?.premiumBoostStationIds||[])
   .some(id=>String(id)===String(station._id));
 data.commercialBoost=boostForStation(paid,station._id,now,
   rights.has('broadcaster.premium_boost')&&selected);
 // Retain a small, deterministic ORGANIC position lift after a verified
 // purchased or Premium Boost ends. This never extends a paid entitlement,
 // changes editorial positions, or grants a Promoted placement.
 const endTime=new Date(now).getTime();
 const finishedPeriod=row=>{
   const start=new Date(row?.periodStartsAt).getTime();
   const end=new Date(row?.periodEndsAt).getTime();
   return Number.isFinite(start)&&Number.isFinite(end)&&
     start<end&&start<=endTime&&end<=endTime;
 };
 const postPlacements=new Set();
 for(const order of paid){
   if(String(order.accountId)!==String(owner._id)||
      order.status!=='paid'||order.environment!=='staging'||
      !finishedPeriod(order))continue;
   if(isBoost(order.sku)&&order.scopeType==='station'&&
      String(order.resourceId)===String(station._id)){
     postPlacements.add(order.sku.startsWith('BOOST-G-')?'global':'targeted');
   }
   if(selected&&order.sku==='B-PREM'&&order.scopeType==='account'&&
      order.resourceId==null)postPlacements.add('global');
 }
 if(selected&&(grantHistory||[]).some(grant=>
   String(grant.accountId)===String(owner._id)&&grant.sku==='B-PREM'&&
   grant.scopeType==='account'&&grant.resourceId==null&&
   grant.revokedAt==null&&Number.isFinite(new Date(grant.expiresAt).getTime())&&
   grant.expiresAt!=null&&new Date(grant.expiresAt).getTime()<=endTime&&
   new Date(grant.startsAt).getTime()<=endTime)){
   postPlacements.add('global');
 }
 if(postPlacements.size){
   // A stable station-ID hash selects 1, 2, 3 or 4 slots, never a random
   // per-request value. Store only the projection, not a billing mutation.
   let hash=0;
   for(const char of String(station._id))hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
   data.commercialBoost.postBoost={
     positions:1+(hash%4),
     placement:postPlacements.has('global')?'global':'targeted'
   };
 }
 // A purchased Boost or an unrelated station add-on MUST NOT disable
 // legacy manually configured DSP / ad controls on this station.
 const relevantPaid=paid.some(p=>String(p.accountId)===String(owner._id) &&
  (p.sku==='B-PREM'&&p.scopeType==='account' ||
   p.scopeType==='station'&&String(p.resourceId)===String(station._id) &&
     ['ADD-DSP','ADD-ADS'].includes(p.sku)));
 if(!relevant && !relevantPaid)return data;
 if(!rights.has('broadcaster.webdsp'))data.dspPreset='OFF';
 if(!rights.has('broadcaster.ad_control'))data.disableNetworkAds=false;
 return data;
}
module.exports={maskStationPaidControls};
