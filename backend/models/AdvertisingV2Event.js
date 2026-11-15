'use strict';
const mongoose=require('mongoose');
// Permanent exact-money event receipt. Unique reservation+event prevents replay.
const schema=new mongoose.Schema({
 reservationId:{type:String,required:true},
 campaignId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 creativeId:{type:mongoose.Schema.Types.ObjectId,required:true},
 lotId:{type:mongoose.Schema.Types.ObjectId,required:true},
 kind:{type:String,enum:['audio','visual'],required:true},
 placement:{type:String,required:true},
 name:{type:String,enum:['listen10','cta','complete','impression','click'],required:true},
 day:{type:String,required:true},
 costNanos:{type:Number,required:true,min:0},
 createdAt:{type:Date,default:Date.now}
},{versionKey:false});
schema.index({reservationId:1,name:1},{unique:true});
schema.index({campaignId:1,day:1,createdAt:-1});
module.exports=mongoose.model('AdvertisingV2Event',schema);
