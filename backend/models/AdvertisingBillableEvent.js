'use strict';
const mongoose=require('mongoose');
// Durable, unique claim for a server-qualified advertising event. An event is
// permanently assigned to ONE funding lot; retries must never switch lots.
const schema=new mongoose.Schema({
 _id:{type:String,required:true,match:/^[a-f0-9]{32}$/},
 campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingCampaign',required:true,index:true},
 creativeId:{type:mongoose.Schema.Types.ObjectId,required:true},
 kind:{type:String,enum:['visual','audio'],required:true},
 tier:{type:String,enum:['standard','hero','audio'],required:true},
 fundingLotId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingFundingLot',required:true},
 rateMicros:{type:Number,required:true,min:1000},
 costNanos:{type:Number,required:true,min:1000},
 qualifiedAt:{type:Date,required:true},
 status:{type:String,enum:['pending','charged'],default:'pending',required:true},
 settledAt:{type:Date,default:null}
},{timestamps:true,versionKey:false});
schema.index({campaignId:1,createdAt:-1});
schema.index({status:1,updatedAt:1});
module.exports=mongoose.model('AdvertisingBillableEvent',schema);
