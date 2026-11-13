'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 eventKey:{type:String,required:true,unique:true},
 kind:{type:String,enum:['paid_pending_review','campaign_activated','campaign_approved','topup_success','budget_exhausted'],required:true},
 campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingCampaign',required:true},
 agencyId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 amountCents:{type:Number,default:0},
 status:{type:String,enum:['pending','sending','sent'],default:'pending'},
 attempts:{type:Number,default:0},
 nextAttemptAt:{type:Date,default:Date.now},
 sentAt:{type:Date,default:null},
 lastError:{type:String,default:''}
},{timestamps:true});
schema.index({status:1,nextAttemptAt:1});
module.exports=mongoose.model('AdvertisingCampaignMailEvent',schema);
