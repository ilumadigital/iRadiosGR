'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 agencyId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingCampaign',required:true,index:true},
 budgetCents:{type:Number,required:true,min:1},
 taxCents:{type:Number,required:true,min:0},
 paymentCents:{type:Number,required:true,min:1},
 currency:{type:String,enum:['EUR'],default:'EUR'},
 taxMode:{type:String,required:true},
 taxBps:{type:Number,required:true},
 priceVersion:{type:Number,required:true},
 ratesMicros:{type:mongoose.Schema.Types.Mixed,required:true},
 kind:{type:String,enum:['initial','topup'],required:true},
 status:{type:String,enum:['quoted','checkout','paid','canceled'],default:'quoted'},
 expiresAt:{type:Date,required:true},
 isStageQuote:{type:Boolean,default:true}
},{timestamps:true});
schema.index({agencyId:1,campaignId:1,createdAt:-1});
module.exports=mongoose.model('AdvertisingQuote',schema);
