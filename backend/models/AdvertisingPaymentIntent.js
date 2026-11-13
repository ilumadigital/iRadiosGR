'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 agencyId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingCampaign',required:true,index:true},
 quoteId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingQuote',required:true,unique:true},
 requestKey:{type:String,required:true,unique:true},
 // A sparse UNIQUE index serializes checkout attempts across different quotes.
 // Keep the lock while the Gateway outcome is unknown; release only on signed terminal events.
 activeLockKey:{type:String,unique:true,sparse:true},
 gatewayPaymentId:{type:String,unique:true,sparse:true},
 gatewayOrderId:{type:String,unique:true,sparse:true},
 amountCents:{type:Number,required:true},
 currency:{type:String,enum:['EUR'],default:'EUR'},
 status:{type:String,enum:['creating','redirect','unknown','paid','failed','canceled'],default:'creating'},
 lastError:{type:String,default:''},
 paidAt:{type:Date,default:null},
 eventIds:{type:[String],default:[]}
},{timestamps:true});
schema.index({agencyId:1,campaignId:1,createdAt:-1});
module.exports=mongoose.model('AdvertisingPaymentIntent',schema);
