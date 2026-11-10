'use strict';
const mongoose=require('mongoose');
// Durable per-event idempotency ledger. No TTL: a financial welcome,
// cancelled-subscription or expiry email must not repeat a month later.
// "sending" is not automatically retried after an ambiguous SMTP outcome,
// avoiding accidental duplicates if the process crashes after SMTP accepts.
const schema=new mongoose.Schema({
 _id:{type:String,required:true},
 accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 orderId:{type:mongoose.Schema.Types.ObjectId,ref:'BillingOrder',default:null},
 kind:{type:String,enum:['welcome','soon','grace','cancelled','expired','winback'],required:true},
 status:{type:String,enum:['pending','sending','sent','skipped'],default:'pending',index:true},
 dueAt:{type:Date,default:Date.now,index:true},
 attempts:{type:Number,default:0},
 startedAt:{type:Date,default:null},
 sentAt:{type:Date,default:null},
 skipReason:{type:String,default:null}
},{timestamps:true,versionKey:false});
schema.index({status:1,dueAt:1});
module.exports=mongoose.model('BillingEmailDispatch',schema);
