'use strict';
// Pure expiry policy, independently testable without Gateway or Mongo.
// Promotion starts only AFTER the last verified paid period has ended.
const WINDOW_MS=30*86400000;
const PROMO_SKU='L-WINBACK-199';
function evaluate({lastPaid,hasPremium=false,used=false,pending=false,now=new Date()}={}){
 const end=lastPaid?.status==='paid'?new Date(lastPaid.periodEndsAt):null;
 const today=+new Date(now);
 if(!end||!Number.isFinite(+end)||!Number.isFinite(today))
  return {eligible:false,reason:'no_verified_expiry'};
 const expiresAt=new Date(+end+WINDOW_MS);
 if(today<+end||hasPremium)return {eligible:false,reason:'premium_still_active'};
 if(today>=+expiresAt)return {eligible:false,reason:'offer_expired'};
 if(used)return {eligible:false,reason:'already_redeemed'};
 if(pending)return {eligible:false,reason:'payment_pending'};
 return {eligible:true,sku:PROMO_SKU,priceCents:199,
  regularPriceCents:399,currency:'EUR',
  expiredAt:end.toISOString(),offerEndsAt:expiresAt.toISOString()};
}
module.exports={WINDOW_MS,PROMO_SKU,evaluate};
