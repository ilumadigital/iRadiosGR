'use strict';
const User=require('../models/User');
const BillingGrant=require('../models/BillingGrant');
const BroadcasterBillingOrder=require('../models/BroadcasterBillingOrder');
const {maskStationPaidControls}=require('./stationBillingProjectionRules');

// Bulk project public station state. Expiry masks happen at read time, so a
// billing cancellation never deletes DSP presets or historical station data.
async function projectPublicStations(stations,now=new Date()){
 const ids=[...new Set(stations.map(s=>String(s.broadcasterId||'')).filter(Boolean))];
 // Even when NO stations have owners, custom Admin DSP settings are stored
 // but must not become public processing without a new paid/granted entitlement.
 if(!ids.length)return stations.map(s=>maskStationPaidControls(s,null,[],now,[]));
 const [owners,history,paidOrders]=await Promise.all([
  User.find({_id:{$in:ids}}).select('_id role isPremium broadcasterProfile').lean(),
  BillingGrant.find({accountId:{$in:ids},
    sku:{$in:['B-PREM','ADD-DSP','ADD-AN','ADD-ADS']}}).lean(),
  process.env.APP_ENV==='staging'
   ?BroadcasterBillingOrder.find({accountId:{$in:ids},environment:'staging',
      status:'paid'}).select('accountId resourceId sku status environment periodStartsAt periodEndsAt')
      .sort({paidAt:-1}).limit(5000).lean()
   :Promise.resolve([])
 ]);
 const users=new Map(owners.map(u=>[String(u._id),u]));
 const byAccount=new Map();
 for(const grant of history){
   const id=String(grant.accountId);
   if(!byAccount.has(id))byAccount.set(id,[]);
   byAccount.get(id).push(grant);
 }
 const paidByAccount=new Map();
 for(const order of paidOrders){
  const id=String(order.accountId);
  if(!paidByAccount.has(id))paidByAccount.set(id,[]);
  paidByAccount.get(id).push(order);
 }
 return stations.map(s=>maskStationPaidControls(s,users.get(String(s.broadcasterId)),
    byAccount.get(String(s.broadcasterId))||[],now,
    paidByAccount.get(String(s.broadcasterId))||[]));
}
module.exports={maskStationPaidControls,projectPublicStations};
