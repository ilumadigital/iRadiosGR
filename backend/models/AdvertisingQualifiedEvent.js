'use strict';
const mongoose=require('mongoose');
// Immutable NON-BILLABLE shadow audit of a state-machine qualification.
// Independent of AdvertisingBillableEvent and all funding lots.
const schema=new mongoose.Schema({
 _id:{type:String,required:true,match:/^[a-f0-9]{32}$/},
 campaignId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 creativeId:{type:mongoose.Schema.Types.ObjectId,required:true},
 kind:{type:String,enum:['visual','audio'],required:true},
 tier:{type:String,enum:['standard','hero','audio'],required:true},
 placement:{type:String,required:true},
 qualifiedAt:{type:Date,required:true},
 observedMs:{type:Number,required:true,min:0},
 status:{type:String,enum:['shadow_qualified'],default:'shadow_qualified'},
 billable:{type:Boolean,default:false,immutable:true}
},{timestamps:true,versionKey:false});
schema.index({campaignId:1,createdAt:-1});
module.exports=mongoose.model('AdvertisingQualifiedEvent',schema);
