'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 agencyId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingCampaign',required:true,index:true},
 quoteId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingQuote',required:true,unique:true},
 gatewayPaymentId:{type:String,required:true,unique:true},
 gatewayOrderId:{type:String,required:true},
 budgetMicros:{type:Number,required:true,min:1},
 remainingMicros:{type:Number,required:true,min:0},
 priceVersion:{type:Number,required:true},
 ratesMicros:{type:mongoose.Schema.Types.Mixed,required:true},
 currency:{type:String,enum:['EUR'],default:'EUR'},
 source:{type:String,enum:['nexi_verified','admin_complimentary'],default:'nexi_verified'},
 paidAt:{type:Date,required:true}
},{timestamps:true});
schema.index({campaignId:1,paidAt:1,_id:1});
module.exports=mongoose.model('AdvertisingFundingLot',schema);
