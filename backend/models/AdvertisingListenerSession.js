'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 _id:{type:String,required:true},
 visitorKey:{type:String,required:true,index:true},
 stationId:{type:mongoose.Schema.Types.ObjectId,ref:'Station',required:true},
 switchCount:{type:Number,required:true,min:1},
 changedAt:{type:Date,required:true},
 expiresAt:{type:Date,required:true}
},{versionKey:false,timestamps:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=mongoose.model('AdvertisingListenerSession',schema);
