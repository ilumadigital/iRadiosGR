'use strict';
const Lease=require('../models/BroadcasterCheckoutLease');
const MINUTE=60000;
function scopedLeaseId(accountId,ownerKey,environment){
 const account=String(accountId||'').toLowerCase();
 if(!['staging','production'].includes(environment)||
    !/^[a-f0-9]{24}$/i.test(account)||
    !/^iradios-bstage-[a-f0-9]{24}-[a-f0-9-]{36}$/i.test(String(ownerKey||''))||
    !ownerKey.toLowerCase().startsWith('iradios-bstage-'+account+'-'))
  throw Error('Invalid Broadcaster checkout lease identity');
 return environment+':'+account;
}
async function acquire(accountId,ownerKey,{environment,now=new Date()}={}){
 const leaseId=scopedLeaseId(accountId,ownerKey,environment);
 await Lease.createIndexes();
 const expiresAt=new Date(+now+5*MINUTE);
 try{
  const result=await Lease.findOneAndUpdate({
   _id:leaseId,$or:[{expiresAt:{$lte:now}},{ownerKey}]
  },{$set:{ownerKey,expiresAt}},{upsert:true,new:true});
  return Boolean(result&&result.ownerKey===ownerKey);
 }catch(e){
  if(e.code===11000)return false;
  throw e;
 }
}
async function release(accountId,ownerKey,{environment}={}){
 // An older staging checkout cannot release an active production lease.
 const leaseId=scopedLeaseId(accountId,ownerKey,environment);
 return Lease.deleteOne({_id:leaseId,ownerKey});
}
module.exports={acquire,release,scopedLeaseId};
