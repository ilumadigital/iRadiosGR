'use strict';
// Pure budget affordability for already server-approved creative placements.
// Do NOT infer an empty budget from stale micros or from a receipt-cap block.
const {qualifiedEventDebitNanos}=require('./advertisingCpmMath');
const TIERS=['standard','hero','audio'];
function activeCreativeTiers(banners,ads){
 const tiers=new Set();
 for(const banner of banners||[]){
  if(banner?.status!=='active'||banner?.isActive===false)continue;
  const placements=banner.placement||[];
  for(const place of placements)
   if(place==='hero')tiers.add('hero');
   else if(['home','radio_feed','news_feed','station_profile'].includes(place))
    tiers.add('standard');
 }
 if((ads||[]).some(ad=>ad?.status==='active'))tiers.add('audio');
 return TIERS.filter(tier=>tiers.has(tier));
}
function evaluateBudgetAffordability(lots,requestedTiers){
 if(!Array.isArray(lots)||!Array.isArray(requestedTiers)||
    requestedTiers.some(t=>!TIERS.includes(t)))
  throw Error('Invalid advertising funding audit scope');
 const tiers=[...new Set(requestedTiers)];
 if(!tiers.length)return {status:'no_active_creatives',canDeliver:false,
  remainingNanos:null};
 if(!lots.length)return {status:'not_funded',canDeliver:false,
  remainingNanos:0};
 let total=0n,canDeliver=false,blockedByCap=false;
 for(const lot of lots){
  if(lot.source!=='nexi_verified'||
     !Number.isSafeInteger(lot.budgetNanos)||
     !Number.isSafeInteger(lot.remainingNanos)||
     lot.budgetNanos<1||lot.remainingNanos<0||
     lot.remainingNanos>lot.budgetNanos)
   return {status:'needs_financial_review',canDeliver:false,
    remainingNanos:null};
  if(lot.settlementMode&&
     !['embedded_receipts','mongo_transaction_v2'].includes(lot.settlementMode))
   return {status:'needs_financial_review',canDeliver:false,
    remainingNanos:null};
  total+=BigInt(lot.remainingNanos);
  if(total>BigInt(Number.MAX_SAFE_INTEGER))
   return {status:'needs_financial_review',canDeliver:false,
    remainingNanos:null};
  const capped=lot.settlementMode!=='mongo_transaction_v2'&&
   (lot.settledEvents||[]).length>=6000;
  for(const tier of tiers){
   let cost;
   try{cost=qualifiedEventDebitNanos(lot.ratesMicros?.[tier]);}
   catch{return {status:'needs_financial_review',canDeliver:false,
    remainingNanos:null};}
   if(lot.remainingNanos>=cost){
    if(capped)blockedByCap=true;
    else canDeliver=true;
   }
  }
 }
 const remainingNanos=Number(total);
 if(canDeliver)return {status:'funded',canDeliver:true,remainingNanos};
 if(blockedByCap)return {status:'receipt_capacity_blocked',
  canDeliver:false,remainingNanos};
 if(remainingNanos===0)return {status:'exhausted',
  canDeliver:false,remainingNanos};
 return {status:'below_minimum_event_cost',
  canDeliver:false,remainingNanos};
}
function shouldNotifyBudgetExhausted(status){
 return ['exhausted','below_minimum_event_cost'].includes(status);
}
module.exports={activeCreativeTiers,evaluateBudgetAffordability,
 shouldNotifyBudgetExhausted};
