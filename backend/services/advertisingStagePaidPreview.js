'use strict';
// Staging listener-placement QA only. This NEVER debits a funding lot,
// creates a qualified event, or enables the paid CPM settlement engine.
const {evaluateBudgetAffordability}=require('./advertisingBudgetAffordability');
function paidPlacementPreviewEnabled(env=process.env){
 return env.APP_ENV==='staging' &&
  env.AD_STAGE_PAID_PLACEMENT_PREVIEW==='1' &&
  env.AD_DELIVERY_BILLING_ENABLED!=='1';
}
function creativeTiers(creative){
 if(creative?.audioUrl)return ['audio'];
 if(!Array.isArray(creative?.placement))return [];
 const tiers=new Set();
 for(const placement of creative.placement){
  if(placement==='hero')tiers.add('hero');
  else if(['home','radio_feed','news_feed','station_profile'].includes(placement))
   tiers.add('standard');
 }
 return [...tiers];
}
function affordablePaidPreview(lots,creative){
 const tiers=creativeTiers(creative);
 if(!tiers.length)return false;
 // Every placement of a multi-placement banner must be affordable.
 return tiers.every(tier=>evaluateBudgetAffordability(lots,[tier]).canDeliver);
}
module.exports={paidPlacementPreviewEnabled,creativeTiers,affordablePaidPreview};
