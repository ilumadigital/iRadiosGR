'use strict';
const Event=require('../models/AdvertisingBillableEvent');
const {store}=require('./advertisingSettlementStore');
const {settleQualifiedEvent}=require('./advertisingSettlementCore');
const {ensureAdvertisingFinancialIndexes}=require('./advertisingFinancialIndexes');
// Run explicitly under a controlled staging maintenance task. NOT attached to
// a public API, cron, or paid-delivery switch until qualifying events are
// authenticated and Mongo staging recovery has passed an end-to-end trial.
async function recoverPendingSettlements({limit=50,olderThanMs=30000}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>100||
    !Number.isSafeInteger(olderThanMs)||olderThanMs<1000)
  throw Error('Invalid settlement recovery range');
 await ensureAdvertisingFinancialIndexes();
 const rows=await Event.find({
  status:'pending',updatedAt:{$lt:new Date(Date.now()-olderThanMs)}
 }).sort({updatedAt:1}).limit(limit).lean();
 const summary={examined:rows.length,charged:0,deferred:0,errors:0};
 for(const row of rows){
  try{
   const result=await settleQualifiedEvent({
    eventId:row._id,campaignId:String(row.campaignId),
    creativeId:String(row.creativeId),kind:row.kind,tier:row.tier,
    qualifiedAt:row.qualifiedAt
   },store);
   if(result.status==='charged')summary.charged++;
   else summary.deferred++;
  }catch(error){
   summary.errors++;
   console.error('[AD CPM] Pending ledger recovery deferred',row._id,
    String(error.message||error).slice(0,160));
  }
 }
 return summary;
}
module.exports={recoverPendingSettlements};
