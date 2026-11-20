'use strict';
// Immutable audit for changes to the per-day spending ceiling. No payment,
// wallet top-up or rate-card mutation is represented by this document.
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingCampaign',required:true,index:true},
 agencyId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 changedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 day:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},
 oldDailyBudgetCents:{type:Number,required:true,min:1},
 newDailyBudgetCents:{type:Number,required:true,min:1},
 spentNanos:{type:Number,required:true,min:0},
 reservedNanos:{type:Number,required:true,min:0}
},{timestamps:true});
schema.index({campaignId:1,createdAt:-1});
module.exports=mongoose.model('AdvertisingDailyBudgetChange',schema);
