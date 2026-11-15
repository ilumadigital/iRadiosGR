'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 _id:{type:String,required:true,match:/^[a-f0-9]{32}$/},
 campaignId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 creativeId:{type:mongoose.Schema.Types.ObjectId,required:true},
 lotId:{type:mongoose.Schema.Types.ObjectId,required:true},
 clientKey:{type:String,required:true,match:/^[a-f0-9]{64}$/},
 kind:{type:String,enum:['audio','visual'],required:true},
 placement:{type:String,required:true},
 day:{type:String,required:true},
 reservedNanos:{type:Number,required:true,min:1},
 spentNanos:{type:Number,default:0,min:0},
 durationMs:{type:Number,default:0,min:0,max:46000},
 issuedAt:{type:Date,required:true},
 expiresAt:{type:Date,required:true},
 playedMs:{type:Number,default:0,min:0},
 positionMs:{type:Number,default:0,min:0},
 lastHeartbeatAt:{type:Date,default:null},
 continuousVisualMs:{type:Number,default:0,min:0},
 visibleSince:{type:Date,default:null},
 eventNames:{type:[String],default:[]},
 status:{type:String,enum:['active','closed'],default:'active'},
 closedAt:{type:Date,default:null},
 closeReason:{type:String,default:''},
 cleanupAt:{type:Date,required:true}
},{timestamps:true});
schema.index({status:1,expiresAt:1});
schema.index({cleanupAt:1},{expireAfterSeconds:0});
schema.index({campaignId:1,day:1,issuedAt:-1});
module.exports=mongoose.model('AdvertisingV2Reservation',schema);
