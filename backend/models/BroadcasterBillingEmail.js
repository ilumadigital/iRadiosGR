'use strict';
const mongoose=require('mongoose');
// Separate from Listener BillingEmailDispatch: no accidental Listener mail
// claiming a Broadcaster payment. Durable unique keys prevent duplicates.
const schema=new mongoose.Schema({
 _id:{type:String,required:true},
 accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 orderId:{type:mongoose.Schema.Types.ObjectId,ref:'BroadcasterBillingOrder',default:null},
 sku:{type:String,required:true},
 resourceId:{type:mongoose.Schema.Types.ObjectId,default:null},
 kind:{type:String,enum:['welcome','renewed','cancelled','soon','expired'],required:true},
 status:{type:String,enum:['pending','sending','sent','skipped'],default:'pending',index:true},
 dueAt:{type:Date,default:Date.now,index:true},
 attempts:{type:Number,default:0},
 startedAt:{type:Date,default:null},
 sentAt:{type:Date,default:null},
 skipReason:{type:String,default:null}
},{timestamps:true,versionKey:false});
schema.index({status:1,dueAt:1});
module.exports=mongoose.model('BroadcasterBillingEmail',schema);
