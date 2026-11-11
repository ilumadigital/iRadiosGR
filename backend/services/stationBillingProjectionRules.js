'use strict';
const {effectiveRights}=require('./billingEntitlementRules');
const {paidRights,boostForStation,isBoost}=require('./broadcasterPurchaseRules');

// Admin DSP configurations are always stored, but public output is processed
// ONLY while a matching, active *new* WebDSP entitlement exists. Neither a
// legacy broadcaster flag nor an unassigned station can unlock processing.
function maskStationPaidControls(station,owner,grantHistory,now=new Date(),paidHistory=[]){
 const data=typeof station.toObject==='function'?station.toObject():{...station};
 const zeroPaidFx=()=>{
   data.dspPreset='OFF';
   data.dspSettings={bass:0,mid:0,treble:0,output:0,stereoWidth:100};
   data.disableNetworkAds=false;
   return data;
 };
 // Stations without a verified Broadcaster owner cannot have paid rights.
 if(!owner||owner.role!=='broadcaster')return zeroPaidFx();
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
 // Unsubscribed stations must never process custom DSP in public playback,
 // regardless of when an Admin authored the stored configuration.
 if(!rights.has('broadcaster.webdsp')){
   data.dspPreset='OFF';
   // Never leak or apply paid tone/width processing once access expires.
   data.dspSettings={bass:0,mid:0,treble:0,output:0,stereoWidth:100};
 }
 if(!rights.has('broadcaster.ad_control'))data.disableNetworkAds=false;
 return data;
}
module.exports={maskStationPaidControls};
