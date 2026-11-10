'use strict';
const mongoose=require('mongoose');
const {getProduct}=require('../config/billingCatalog');
const PURCHASE_SKUS=Object.freeze(['B-PREM','ADD-DSP','ADD-AN','ADD-ADS',
 'BOOST-T-DAY','BOOST-T-WEEK','BOOST-T-2W','BOOST-T-MONTH','BOOST-T-YEAR',
 'BOOST-G-DAY','BOOST-G-WEEK','BOOST-G-2W','BOOST-G-MONTH','BOOST-G-YEAR']);
const schema=new mongoose.Schema({
 accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 resourceId:{type:mongoose.Schema.Types.ObjectId,default:null},
 sku:{type:String,enum:PURCHASE_SKUS,required:true},
 scopeType:{type:String,enum:['account','station'],required:true},
 environment:{type:String,enum:['staging'],default:'staging',immutable:true,required:true},
 amountCents:{type:Number,required:true,immutable:true,validate:{validator:function(value){
  return getProduct(this.sku)?.priceCents===value;
 },message:'Catalog price mismatch'}},
 currency:{type:String,enum:['EUR'],default:'EUR',immutable:true},
 requestKey:{type:String,required:true,unique:true,immutable:true},
 lockKey:{type:String,default:undefined},
 renewalOfOrderId:{type:mongoose.Schema.Types.ObjectId,ref:'BroadcasterBillingOrder',default:undefined,immutable:true},
 billingOrigin:{type:String,enum:['checkout','automatic_renewal'],default:'checkout',immutable:true},
 autoRenewRequested:{type:Boolean,default:false,immutable:true},
 gatewayPaymentId:{type:String,default:undefined},
 gatewayOrderId:{type:String,default:undefined},
 checkoutUrl:{type:String,default:null},
 status:{type:String,enum:['creating','pending','redirect','unknown','paid','failed','canceled'],default:'creating',index:true},
 providerStatus:{type:String,default:null},
 gatewayLastCheckedAt:{type:Date,default:null},
 paidAt:{type:Date,default:null},
 periodStartsAt:{type:Date,default:null},
 periodEndsAt:{type:Date,default:null},
 graceEndsAt:{type:Date,default:null},
 eventIds:{type:[String],default:[]},
 eventLog:{type:[new mongoose.Schema({
  id:{type:String,required:true},type:{type:String,required:true},at:{type:Date,required:true}
 },{_id:false})],default:[]},
 lastErrorCode:{type:String,default:null}
},{timestamps:true,strict:true});
schema.index({lockKey:1},{unique:true,partialFilterExpression:{lockKey:{$type:'string'}}});
schema.index({gatewayPaymentId:1},{unique:true,partialFilterExpression:{gatewayPaymentId:{$type:'string'}}});
schema.index({gatewayOrderId:1},{unique:true,partialFilterExpression:{gatewayOrderId:{$type:'string'}}});
schema.index({accountId:1,sku:1,resourceId:1,paidAt:-1});
 // Independent provider payment IDs remain globally unique. A second
 // paid MIT payment for the same merchant cycle cannot mint a second period.
 schema.index({accountId:1,sku:1,resourceId:1,periodStartsAt:1},{
  unique:true,partialFilterExpression:{billingOrigin:'automatic_renewal'}
 });
schema.index({resourceId:1,status:1,periodEndsAt:1});
module.exports=mongoose.model('BroadcasterBillingOrder',schema);
