'use strict';
const {getProduct}=require('../config/billingCatalog');

const ENTITLEMENTS=Object.freeze({
  'L-PREM':['listener.premium'],
  'B-PREM':['broadcaster.unlimited_stations','broadcaster.webdsp','broadcaster.analytics','broadcaster.ad_control','broadcaster.premium_boost'],
  'ADD-DSP':['broadcaster.webdsp'],
  'ADD-AN':['broadcaster.analytics'],
  'ADD-ADS':['broadcaster.ad_control'],
  'AG-AUDIO':['agency.campaign.audio'],
  'AG-RADIO':['agency.campaign.radio_grid'],
  'AG-HERO':['agency.campaign.hero'],
  'AG-NEWS':['agency.campaign.news_grid']
});

function validateComplimentaryScope(sku,scopeType,resourceId) {
  const product=getProduct(sku);
  if(!product || !product.complimentaryEligible) return 'Το SKU δεν είναι διαθέσιμη δωρεάν συνδρομή.';
  if(scopeType!==product.scopeType) return 'Λανθασμένο scope για το προϊόν.';
  if(scopeType==='account' && resourceId) return 'Το account plan δεν επιτρέπεται να δεθεί σε resource.';
  if(scopeType!=='account' && !resourceId) return 'Απαιτείται station ή campaign ID.';
  return null;
}
function isActiveGrant(grant,now=new Date()) {
  const at=now instanceof Date ? now.getTime() : new Date(now).getTime();
  return Boolean(grant && grant.source==='admin_complimentary' &&
    !grant.revokedAt && new Date(grant.startsAt).getTime()<=at &&
    (!grant.expiresAt || new Date(grant.expiresAt).getTime()>at));
}
function resolveComplimentaryEntitlements(grants,{stationId=null,campaignId=null,now=new Date()}={}) {
  const rights=new Set();
  for(const grant of grants) {
    if(!isActiveGrant(grant,now))continue;
    if(grant.scopeType==='station' && String(grant.resourceId)!==String(stationId))continue;
    if(grant.scopeType==='campaign' && String(grant.resourceId)!==String(campaignId))continue;
    for(const e of ENTITLEMENTS[grant.sku]||[])rights.add(e);
  }
  return [...rights].sort();
}
// Within the same applicable placement a purchased boost MUST outrank premium.
// Paid boost ranking within its own tier is handled by the next commercial phase.
const BOOST_PRIORITY=Object.freeze({organic:0,premium:100,purchased:200});
function compareBoostPriority(a,b) {
  return (BOOST_PRIORITY[b]??0)-(BOOST_PRIORITY[a]??0);
}
module.exports={ENTITLEMENTS,validateComplimentaryScope,isActiveGrant,resolveComplimentaryEntitlements,BOOST_PRIORITY,compareBoostPriority};
