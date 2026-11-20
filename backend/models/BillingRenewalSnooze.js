'use strict';
const mongoose=require('mongoose');
// Notification snooze only. Does not modify a BillingOrder, payment, grace,
// entitlement, or Nexi credentials. Persists across a listener's devices.
const schema=new mongoose.Schema({
 accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 orderId:{type:mongoose.Schema.Types.ObjectId,ref:'BillingOrder',required:true},
 snoozedUntil:{type:Date,required:true}
},{timestamps:true});
schema.index({accountId:1,orderId:1},{unique:true});
schema.index({snoozedUntil:1},{expireAfterSeconds:0});
module.exports=mongoose.model('BillingRenewalSnooze',schema);
