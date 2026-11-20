'use strict';
const mongoose=require('mongoose');
const target=new mongoose.Schema({
 sku:{type:String,enum:['ADD-DSP','ADD-AN','ADD-ADS'],required:true},
 stationId:{type:mongoose.Schema.Types.ObjectId,required:true},
 state:{type:String,enum:['pending','complete'],default:'pending'},
 checkedAt:{type:Date,default:null},
 lastErrorCode:{type:String,default:null}
},{_id:false});
const schema=new mongoose.Schema({
 premiumOrderId:{type:mongoose.Schema.Types.ObjectId,ref:'BroadcasterBillingOrder',
  required:true,unique:true,immutable:true},
 accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,immutable:true},
 environment:{type:String,enum:['staging','production'],required:true,immutable:true},
 status:{type:String,enum:['pending','complete'],default:'pending'},
 items:{type:[target],default:[]},
 leaseUntil:{type:Date,default:()=>new Date(0)},
 lastAttemptAt:{type:Date,default:null},
 completedAt:{type:Date,default:null}
},{timestamps:true,strict:true});
schema.index({environment:1,status:1,leaseUntil:1});
module.exports=mongoose.model('BroadcasterPremiumUpgrade',schema);
