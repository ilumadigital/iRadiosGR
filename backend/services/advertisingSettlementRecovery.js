'use strict';
const Event=require('../models/AdvertisingBillableEvent');
const FundingLot=require('../models/AdvertisingFundingLot');
const {store}=require('./advertisingSettlementStore');
const {settleQualifiedEvent}=require('./advertisingSettlementCore');
const {settleQualifiedEventTransactional}=require('./advertisingTransactionalSettlement');
const {ensureAdvertisingFinancialIndexes}=require('./advertisingFinancialIndexes');
// Manually invoked only; never wired to requests or cron. The selected
// protocol is permanently determined by the original funding lot, so a
// transaction receipt can NEVER be replayed as an embedded debit.
async function recoverPendingSettlements({limit=50,olderThanMs=30000,manual=false}={}){
 if(process.env.APP_ENV!=='staging'||manual!==true||
    process.env.AD_CPM_RECOVERY_MANUAL_APPROVAL!=='CONFIRMED_DISPOSABLE_TESTS')
  throw Error('Manual settlement recovery disabled until staging financial UAT');
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
   const lot=await FundingLot.findOne({
    _id:row.fundingLotId,campaignId:row.campaignId
   }).select('settlementMode').lean();
   if(!lot)throw Error('Missing original funding lot');
   const event={
    eventId:row._id,campaignId:String(row.campaignId),
    creativeId:String(row.creativeId),kind:row.kind,tier:row.tier,
    qualifiedAt:row.qualifiedAt
   };
   const result=lot.settlementMode==='mongo_transaction_v2'?
    await settleQualifiedEventTransactional(event):
    await settleQualifiedEvent(event,store);
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
