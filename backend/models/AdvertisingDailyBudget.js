'use strict';
const mongoose=require('mongoose');
// One document per campaign and Athens calendar day. Nano-EUR integers only.
const schema=new mongoose.Schema({
 campaignId:{type:mongoose.Schema.Types.ObjectId,ref:'AdvertisingCampaign',required:true},
 day:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},
 limitNanos:{type:Number,required:true,min:1},
 reservedNanos:{type:Number,default:0,min:0},
 spentNanos:{type:Number,default:0,min:0}
},{timestamps:true});
schema.index({campaignId:1,day:1},{unique:true});
module.exports=mongoose.model('AdvertisingDailyBudget',schema);
