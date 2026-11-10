'use strict';
const User=require('../models/User');
const BillingGrant=require('../models/BillingGrant');
const {effectiveRights}=require('./billingEntitlementRules');

// Existing station settings stay untouched in MongoDB. In API payloads, only
// NEW billing-managed benefits are masked after expiry/revocation. Legacy
// hand-managed stations with no grant history continue to behave as before.
function maskStationPaidControls(station,owner,grantHistory,now=new Date()){
  const data=typeof station.toObject==='function'?station.toObject():{...station};
  if(!owner||owner.role==='admin')return data;
  const history=grantHistory||[];
  const relevant=history.some(g=>
    String(g.accountId)===String(owner._id) &&
    (g.sku==='B-PREM'&&g.scopeType==='account' ||
     g.scopeType==='station'&&String(g.resourceId)===String(station._id) &&
       ['ADD-DSP','ADD-ADS'].includes(g.sku)));
  if(!relevant)return data;
  const rights=new Set(effectiveRights(owner,history,{stationId:station._id,now}));
  if(!rights.has('broadcaster.webdsp'))data.dspPreset='OFF';
  if(!rights.has('broadcaster.ad_control'))data.disableNetworkAds=false;
  return data;
}

// One owner lookup and one grant-history lookup per station CATALOG request,
// not one database query per station.
async function projectPublicStations(stations,now=new Date()){
  const ids=[...new Set(stations.map(s=>String(s.broadcasterId||'')).filter(Boolean))];
  if(!ids.length)return stations.map(s=>s.toObject?s.toObject():s);
  const [owners,history]=await Promise.all([
    User.find({_id:{$in:ids}}).select('_id role isPremium broadcasterProfile').lean(),
    BillingGrant.find({accountId:{$in:ids},
      sku:{$in:['B-PREM','ADD-DSP','ADD-ADS']}}).lean()
  ]);
  const users=new Map(owners.map(u=>[String(u._id),u]));
  const byAccount=new Map();
  for(const grant of history){
    const accountId=String(grant.accountId);
    if(!byAccount.has(accountId))byAccount.set(accountId,[]);
    byAccount.get(accountId).push(grant);
  }
  return stations.map(s=>maskStationPaidControls(s,users.get(String(s.broadcasterId)),
    byAccount.get(String(s.broadcasterId))||[],now));
}
module.exports={maskStationPaidControls,projectPublicStations};
