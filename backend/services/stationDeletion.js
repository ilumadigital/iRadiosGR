'use strict';
const crypto=require('node:crypto');
const ADDONS=Object.freeze(['ADD-DSP','ADD-AN','ADD-ADS']);
const INFLIGHT=Object.freeze(['creating','pending','redirect','unknown']);
class StationDeletionError extends Error{
 constructor(status,message,code){super(message);this.status=status;if(code)this.code=code;}
}
const billingFailure=()=>new StationDeletionError(503,
 'Ο σταθμός δεν διαγράφηκε: το Gateway δεν επιβεβαίωσε τη διακοπή των μελλοντικών χρεώσεων. Έλεγξε τις συνδρομές και δοκίμασε ξανά.',
 'STATION_BILLING_NOT_CONFIRMED');
async function cancelAndVerify(gateway,user,sku,stationId){
 const cancelled=await gateway.cancelBroadcasterRecurring(user,sku,stationId);
 if(!['none','cancelled'].includes(cancelled?.state))throw billingFailure();
 const current=await gateway.broadcasterRecurringStatus(user,sku,stationId);
 if(!['none','cancelled'].includes(current?.state))throw billingFailure();
}
async function stopStationRenewals({Station,Order,Account,gateway,station}){
 const stationId=String(station._id);
 const ownerId=station.broadcasterId?String(station.broadcasterId):null;
 // Previous payers must not retain MIT contracts after an ownership transfer.
 const history=await Order.find({resourceId:station._id,scopeType:'station',
  environment:'staging',sku:{$in:ADDONS},autoRenewRequested:true})
  .select('accountId').limit(201).lean();
 if(history.length>200)throw billingFailure();
 const payerIds=[...new Set([ownerId,...history.map(row=>String(row.accountId||''))].filter(Boolean))];
 const otherStations=ownerId?await Station.countDocuments({
  broadcasterId:station.broadcasterId,_id:{$ne:station._id}
 }):0;
 const cancelPremium=Boolean(ownerId&&otherStations===0);
 // Unresolved checkouts may activate AFTER cancellation: fail closed.
 const pending=await Order.exists({environment:'staging',autoRenewRequested:true,
  status:{$in:INFLIGHT},$or:[
   {resourceId:station._id,scopeType:'station',sku:{$in:ADDONS}},
   ...(cancelPremium?[{accountId:station.broadcasterId,sku:'B-PREM'}]:[])
  ]});
 if(pending)throw new StationDeletionError(409,
  'Υπάρχει εκκρεμής συνδρομή ή πληρωμή για τον σταθμό. Πρέπει πρώτα να επιλυθεί στο Gateway.',
  'STATION_BILLING_IN_FLIGHT');
 if(!payerIds.length)return {cancelled:[],accountPremiumPreserved:false};
 const users=await Account.find({_id:{$in:payerIds}}).select('_id role').lean();
 const byId=new Map(users.map(user=>[String(user._id),user]));
 if(payerIds.some(id=>!byId.has(id)))throw billingFailure();
 const cancelled=[];
 try{
  // Verify remote status for every possible SKU: absence of a local order
  // does not prove that Gateway has no renewal mandate.
  for(const payerId of payerIds){
   for(const sku of ADDONS){
    await cancelAndVerify(gateway,byId.get(payerId),sku,stationId);
    cancelled.push({payerId,sku,stationId});
   }
  }
  // B-PREM belongs to the ACCOUNT. Retain it for remaining stations.
  if(cancelPremium){
   await cancelAndVerify(gateway,byId.get(ownerId),'B-PREM',null);
   cancelled.push({payerId:ownerId,sku:'B-PREM',stationId:null});
  }
  // Recheck after remote calls: a checkout racing with the deletion lease
  // must not activate a future mandate after station removal.
  const lateCheckout=await Order.exists({environment:'staging',autoRenewRequested:true,
   status:{$in:INFLIGHT},$or:[
    {resourceId:station._id,scopeType:'station',sku:{$in:ADDONS}},
    ...(cancelPremium?[{accountId:station.broadcasterId,sku:'B-PREM'}]:[])
   ]});
  if(lateCheckout)throw new StationDeletionError(409,
   'Εντοπίστηκε νέα εκκρεμής πληρωμή κατά τη διαγραφή. Δεν διαγράφηκε ο σταθμός.',
   'STATION_BILLING_IN_FLIGHT');
 }catch(error){
  if(error instanceof StationDeletionError)throw error;
  throw billingFailure();
 }
 return {cancelled,accountPremiumPreserved:Boolean(ownerId&&!cancelPremium)};
}
async function deleteStationRecord({Station,stationId,confirmationName,Order,Account,gateway}){
 if(!/^[0-9a-f]{24}$/i.test(String(stationId||'')))
  throw new StationDeletionError(400,'Μη έγκυρο αναγνωριστικό σταθμού.');
 if(typeof confirmationName!=='string'||!confirmationName||confirmationName.length>200)
  throw new StationDeletionError(400,'Πληκτρολόγησε το ακριβές όνομα του σταθμού για επιβεβαίωση.');
 const station=await Station.findById(stationId);
 if(!station)throw new StationDeletionError(404,'Ο σταθμός δεν βρέθηκε.');
 if(station.name!==confirmationName)
  throw new StationDeletionError(409,'Το όνομα επιβεβαίωσης δεν ταιριάζει με τον σταθμό.');
 const token=crypto.randomUUID(),now=new Date();
 const locked=await Station.findOneAndUpdate({
  _id:stationId,name:confirmationName,$or:[
   {deletionLockUntil:{$exists:false}},{deletionLockUntil:null},
   {deletionLockUntil:{$lte:now}}
  ]
 },{$set:{deletionLockToken:token,deletionLockUntil:new Date(now.getTime()+300000)}},{new:true});
 if(!locked)throw new StationDeletionError(409,
  'Ο σταθμός έχει αλλάξει ή βρίσκεται ήδη σε διαδικασία διαγραφής.');
 let deleted=false;
 try{
  const billing=await stopStationRenewals({Station,station:locked,
   Order:Order||require('../models/BroadcasterBillingOrder'),
   Account:Account||require('../models/User'),
   gateway:gateway||require('./ilumaGatewayClient')});
  const result=await Station.deleteOne({_id:stationId,name:confirmationName,deletionLockToken:token});
  if(result.deletedCount!==1)throw new StationDeletionError(409,
   'Ο σταθμός άλλαξε πριν από τη διαγραφή. Έλεγξε τις συνδρομές και δοκίμασε ξανά.');
  deleted=true;
  return {_id:String(locked._id),name:locked.name,billing};
 }finally{
  if(!deleted){
   try{await Station.updateOne({_id:stationId,deletionLockToken:token},
    {$unset:{deletionLockToken:'',deletionLockUntil:''}});}
   catch(error){console.error('[STATION DELETE] Lease release failed:',error?.code||error?.message);}
  }
 }
}
module.exports={deleteStationRecord,StationDeletionError,stopStationRenewals};
