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
 // Exact single-event CPM arithmetic; canonical after settlement is nanos.
 // Legacy micros are a rounded read-model and never authorize a debit.
 budgetNanos:{type:Number,min:0},
 remainingNanos:{type:Number,min:0},
 settledEvents:{type:[new mongoose.Schema({
  eventId:{type:String,required:true},
  creativeId:{type:mongoose.Schema.Types.ObjectId,required:true},
  tier:{type:String,enum:['standard','hero','audio'],required:true},
  costNanos:{type:Number,required:true,min:1},
  settledAt:{type:Date,required:true}
 },{_id:false})],default:[]},
 priceVersion:{type:Number,required:true},
 ratesMicros:{type:mongoose.Schema.Types.Mixed,required:true},
 currency:{type:String,enum:['EUR'],default:'EUR'},
 source:{type:String,enum:['nexi_verified','admin_complimentary'],default:'nexi_verified'},
 paidAt:{type:Date,required:true}
},{timestamps:true});
schema.index({campaignId:1,paidAt:1,_id:1});
module.exports=mongoose.model('AdvertisingFundingLot',schema);
