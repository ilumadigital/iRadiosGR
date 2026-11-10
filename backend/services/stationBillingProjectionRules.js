'use strict';
const {effectiveRights}=require('./billingEntitlementRules');

// Old manual presets survive unchanged. NEW billing-managed presets become
// effectively OFF when their entitlement has expired or been revoked.
function maskStationPaidControls(station,owner,grantHistory,now=new Date()){
 const data=typeof station.toObject==='function'?station.toObject():{...station};
 if(!owner||owner.role==='admin')return data;
 const relevant=(grantHistory||[]).some(g=>
   String(g.accountId)===String(owner._id)&&
   (g.sku==='B-PREM'&&g.scopeType==='account'||
    g.scopeType==='station'&&String(g.resourceId)===String(station._id)&&
      ['ADD-DSP','ADD-ADS'].includes(g.sku)));
 if(!relevant)return data;
 const rights=new Set(effectiveRights(owner,grantHistory,{stationId:station._id,now}));
 if(!rights.has('broadcaster.webdsp'))data.dspPreset='OFF';
 if(!rights.has('broadcaster.ad_control'))data.disableNetworkAds=false;
 return data;
}
module.exports={maskStationPaidControls};
