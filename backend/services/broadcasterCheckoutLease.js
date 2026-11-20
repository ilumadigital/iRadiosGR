'use strict';
const Lease=require('../models/BroadcasterCheckoutLease');
const MINUTE=60000;
async function acquire(accountId,ownerKey,now=new Date()){
 if(!/^[a-f0-9]{24}$/i.test(String(accountId||''))||
   !/^iradios-bstage-[a-f0-9]{24}-[a-f0-9-]{36}$/i.test(String(ownerKey||'')))
  throw Error('Invalid Broadcaster checkout lease identity');
 await Lease.createIndexes();
 const expiresAt=new Date(+now+5*MINUTE);
 try{
  const result=await Lease.findOneAndUpdate({
   _id:accountId,$or:[{expiresAt:{$lte:now}},{ownerKey}]
  },{$set:{ownerKey,expiresAt}},{upsert:true,new:true});
  return Boolean(result&&result.ownerKey===ownerKey);
 }catch(e){
  if(e.code===11000)return false;
  throw e;
 }
}
async function release(accountId,ownerKey){
 // A previous request must NEVER release another newer owner's lease.
 return Lease.deleteOne({_id:accountId,ownerKey});
}
module.exports={acquire,release};
