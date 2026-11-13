'use strict';
// One-time staging-only sandbox pricing bootstrap. Existing Admin-customized
// policies (including an explicit disabled state) always take precedence.
const Pricing=require('../models/AdvertisingPricing');
const {DEFAULTS}=require('./advertisingPricingRules');
const PRICING_ID='iradios-advertising-v2';
const STAGING_SANDBOX_DEFAULTS=Object.freeze({
 ...DEFAULTS,enabled:true,taxMode:'budget_net_plus_vat',taxBps:2400
});
const untouched=row=>row.version===1&&row.enabled===false&&
 row.taxMode==='unconfigured'&&row.taxBps==null&&
 !row.changedBy&&(!row.history||row.history.length===0);

async function getAdvertisingPricing(){
 const row=await Pricing.findById(PRICING_ID).lean();
 if(process.env.APP_ENV!=='staging')
  return row||{_id:PRICING_ID,...DEFAULTS};
 if(!row){
  // Immutable, auditable first configuration; no real Nexi charges here.
  try{
   return await Pricing.findOneAndUpdate({_id:PRICING_ID},
    {$setOnInsert:STAGING_SANDBOX_DEFAULTS},
    {upsert:true,new:true,runValidators:true}).lean();
  }catch(error){
   if(error.code!==11000)throw error;
   return Pricing.findById(PRICING_ID).lean();
  }
 }
 if(!untouched(row))return row;
 // Upgrade only a pristine, never-configured staging placeholder. A row
 // intentionally edited by Admin is NOT silently re-enabled.
 const updated=await Pricing.findOneAndUpdate({
  _id:PRICING_ID,version:1,enabled:false,taxMode:'unconfigured',
  taxBps:null,changedBy:null,'history.0':{$exists:false}
 },{$set:{enabled:true,taxMode:'budget_net_plus_vat',taxBps:2400},
   $inc:{version:1}},{new:true,runValidators:true}).lean();
 return updated||Pricing.findById(PRICING_ID).lean();
}
module.exports={getAdvertisingPricing,PRICING_ID,STAGING_SANDBOX_DEFAULTS};
