'use strict';
const {getProduct}=require('../config/billingCatalog');
const {nextMonthlyPeriod}=require('./gatewayBillingProtocol');
const {ENTITLEMENTS,BOOST_PRIORITY}=require('./billingPolicy');
const SUBSCRIPTION_SKUS=Object.freeze(['B-PREM','ADD-DSP','ADD-AN','ADD-ADS']);
const BOOST_SKUS=Object.freeze([
 'BOOST-T-DAY','BOOST-T-WEEK','BOOST-T-2W','BOOST-T-MONTH','BOOST-T-YEAR',
 'BOOST-G-DAY','BOOST-G-WEEK','BOOST-G-2W','BOOST-G-MONTH','BOOST-G-YEAR']);
const BILLING_SKUS=Object.freeze([...SUBSCRIPTION_SKUS,...BOOST_SKUS]);
const isSubscription=sku=>SUBSCRIPTION_SKUS.includes(sku);
const isBoost=sku=>BOOST_SKUS.includes(sku);
function validatePurchase({sku,stationId,autoRenew}){
 if(!BILLING_SKUS.includes(sku))return 'INVALID_SKU';
 const product=getProduct(sku);
 if(!product||product.scopeType!=='account'&&product.scopeType!=='station')
  return 'INVALID_PRODUCT_SCOPE';
 if(sku==='B-PREM'?stationId!==null && stationId!==undefined:
     !/^[a-f0-9]{24}$/i.test(stationId||''))return 'INVALID_RESOURCE_SCOPE';
 if(isSubscription(sku)&&autoRenew!==true)return 'SUBSCRIPTION_CONSENT_REQUIRED';
 if(isBoost(sku)&&autoRenew!==false)return 'BOOST_CANNOT_RECUR';
 return null;
}
function purchasePeriod(sku,paidAt){
 if(!BILLING_SKUS.includes(sku))throw Error('Unknown broadcaster SKU');
 const start=new Date(paidAt);
 if(!Number.isFinite(start.getTime()))throw Error('Invalid signed paid date');
 if(isSubscription(sku)||sku.endsWith('-MONTH'))
  return {start,end:nextMonthlyPeriod(start)};
 let end;
 if(sku.endsWith('-DAY'))end=new Date(start.getTime()+86400000);
 else if(sku.endsWith('-WEEK'))end=new Date(start.getTime()+7*86400000);
 else if(sku.endsWith('-2W'))end=new Date(start.getTime()+14*86400000);
 else if(sku.endsWith('-YEAR')){
  const y=start.getUTCFullYear()+1,month=start.getUTCMonth();
  const max=new Date(Date.UTC(y,month+1,0)).getUTCDate();
  end=new Date(Date.UTC(y,month,Math.min(start.getUTCDate(),max),
   start.getUTCHours(),start.getUTCMinutes(),start.getUTCSeconds(),start.getUTCMilliseconds()));
 }else throw Error('Invalid Boost duration');
 return {start,end};
}
function isPaidInPeriod(row,now=new Date()){
 return row?.status==='paid'&&row.environment==='staging'&&
  new Date(row.periodStartsAt)<=now&&new Date(row.periodEndsAt)>now;
}
function orderRights(order,stationId,now=new Date()){
 if(!isPaidInPeriod(order,now)||!isSubscription(order.sku))return [];
 if(order.scopeType==='station'&&String(order.resourceId)!==String(stationId))return [];
 return ENTITLEMENTS[order.sku]||[];
}
function paidRights(orders,stationId,now=new Date()){
 const result=new Set();
 for(const order of orders||[]){
  for(const entitlement of orderRights(order,stationId,now))result.add(entitlement);
 }
 return [...result].sort();
}
function boostForStation(orders,stationId,now=new Date(),premium=false){
 const eligible=(orders||[]).filter(order=>isBoost(order.sku)&&
  String(order.resourceId)===String(stationId)&&isPaidInPeriod(order,now));
 if(eligible.length){
  eligible.sort((a,b)=>(a.sku.startsWith('BOOST-G-')?0:1)-(b.sku.startsWith('BOOST-G-')?0:1)
   ||new Date(b.periodEndsAt)-new Date(a.periodEndsAt));
  const row=eligible[0];
  return {tier:'purchased',placement:row.sku.startsWith('BOOST-G-')?'global':'targeted',
   endsAt:row.periodEndsAt,priority:BOOST_PRIORITY.purchased,
   premiumIncluded:Boolean(premium)};
 }
 return premium?{tier:'premium',placement:'eligible',endsAt:null,
  priority:BOOST_PRIORITY.premium}:
  {tier:'organic',placement:null,endsAt:null,priority:BOOST_PRIORITY.organic};
}
module.exports={SUBSCRIPTION_SKUS,BOOST_SKUS,BILLING_SKUS,isSubscription,isBoost,
 validatePurchase,purchasePeriod,isPaidInPeriod,orderRights,paidRights,boostForStation};
