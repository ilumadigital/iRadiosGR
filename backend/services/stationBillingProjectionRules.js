'use strict';
const {effectiveRights}=require('./billingEntitlementRules');
const {paidRights,boostForStation}=require('./broadcasterPurchaseRules');

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
