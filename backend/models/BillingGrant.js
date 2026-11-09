'use strict';
const mongoose=require('mongoose');
const {getProduct}=require('../config/billingCatalog');
const schema=new mongoose.Schema({
  accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  sku:{type:String,required:true,validate:{validator:sku=>Boolean(getProduct(sku)?.complimentaryEligible),message:'Invalid complimentary SKU'}},
  scopeType:{type:String,enum:['account','station','campaign'],required:true},
  resourceId:{type:mongoose.Schema.Types.ObjectId,default:null},
  source:{type:String,enum:['admin_complimentary'],default:'admin_complimentary',immutable:true},
  reason:{type:String,required:true,maxlength:500},
  grantedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,immutable:true},
  startsAt:{type:Date,required:true,default:Date.now},
  expiresAt:{type:Date,default:null},
  revokedAt:{type:Date,default:null},
  revokedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
  revokeReason:{type:String,default:'',maxlength:500},
  requestId:{type:String,required:true,unique:true,immutable:true}
},{timestamps:true,strict:true});
schema.index({accountId:1,sku:1,scopeType:1,resourceId:1,revokedAt:1});
module.exports=mongoose.model('BillingGrant',schema);
