'use strict';
const User=require('../models/User');
const BillingGrant=require('../models/BillingGrant');
const {maskStationPaidControls}=require('./stationBillingProjectionRules');

// Bulk project public station state. Expiry masks happen at read time, so a
// billing cancellation never deletes DSP presets or historical station data.
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
   const id=String(grant.accountId);
   if(!byAccount.has(id))byAccount.set(id,[]);
   byAccount.get(id).push(grant);
 }
 return stations.map(s=>maskStationPaidControls(s,users.get(String(s.broadcasterId)),
    byAccount.get(String(s.broadcasterId))||[],now));
}
module.exports={maskStationPaidControls,projectPublicStations};
