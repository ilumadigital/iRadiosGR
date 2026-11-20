'use strict';
// Read-only status projection for Admin. All writes continue through the
// existing idempotent, authenticated complimentary-grant endpoints; no status
// calculation may create, cancel or infer a paid order. Historical flags are excluded.
const {effectiveRights}=require('./billingEntitlementRules');
const {ENTITLEMENTS,isActiveGrant}=require('./billingPolicy');
const {paidRights,orderRights}=require('./broadcasterPurchaseRules');

const ADDONS=Object.freeze([
  Object.freeze({sku:'ADD-DSP',right:'broadcaster.webdsp',name:'WebDSP Audio Engine'}),
  Object.freeze({sku:'ADD-AN',right:'broadcaster.analytics',name:'Analytics'}),
  Object.freeze({sku:'ADD-ADS',right:'broadcaster.ad_control',name:'iRadios Ad Control'})
]);
const same=(a,b)=>String(a||'')===String(b||'');
function describeStationAddons(user,station,grants=[],orders=[],now=new Date()){
  const id=String(station._id);
  const ownGrants=grants.filter(g=>same(g.accountId,user._id)&&isActiveGrant(g,now));
  const applicable=ownGrants.filter(g=>g.scopeType==='account' ||
    g.scopeType==='station'&&same(g.resourceId,id));
  const rights=new Set([
    ...effectiveRights(user,ownGrants,{stationId:id,now}),
    ...paidRights(orders,id,now)
  ]);
  const addons={};
  for(const item of ADDONS){
    const sources=[];
    for(const order of orders){
      if(!orderRights(order,id,now).includes(item.right))continue;
      sources.push({
        type:order.sku==='B-PREM'?'paid_premium':'paid_addon',
        label:order.sku==='B-PREM'?'Πληρωμένο Broadcaster Premium':'Πληρωμένο Addon',
        expiresAt:order.periodEndsAt||null
      });
    }
    for(const grant of applicable){
      if(!(ENTITLEMENTS[grant.sku]||[]).includes(item.right))continue;
      sources.push({
        type:grant.sku==='B-PREM'?'complimentary_premium':'complimentary_addon',
        label:grant.sku==='B-PREM'?'Δωρεάν Broadcaster Premium':'Δωρεάν Addon',
        expiresAt:grant.expiresAt||null,grantId:String(grant._id)
      });
    }
    addons[item.sku]={
      sku:item.sku,right:item.right,name:item.name,
      enabled:rights.has(item.right),
      sources
    };
  }
  return {id,name:station.name,status:station.status,addons};
}
module.exports={ADDONS,describeStationAddons};
