'use strict';
const mongoose=require('mongoose');
const pricingSchema=new mongoose.Schema({
 _id:{type:String,default:'iradios-advertising-v2'},
 version:{type:Number,default:1,min:1},
 enabled:{type:Boolean,default:false},
 // Microunits of EUR per thousand verified events: 4 EUR CPM = 4,000,000.
 cpmMicros:{standard:{type:Number,required:true},hero:{type:Number,required:true},
  audio:{type:Number,required:true}},
 minBudgetCents:{type:Number,default:2000},
 maxBudgetCents:{type:Number,default:100000000},
 minTopupCents:{type:Number,default:1000},
 // Explicit financial configuration is required before paid checkout is allowed.
 taxMode:{type:String,enum:['unconfigured','budget_net_plus_vat'],default:'unconfigured'},
 taxBps:{type:Number,default:null},
 durationDays:{type:[Number],default:[7,10,14,30]},
 history:{type:[mongoose.Schema.Types.Mixed],default:[]},
 changedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null}
},{timestamps:true});
module.exports=mongoose.model('AdvertisingPricing',pricingSchema);
