'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true},
  deviceId:{type:String,required:true},
  socketId:{type:String,required:true},
  token:{type:String,required:true},
  stationId:{type:mongoose.Schema.Types.ObjectId,ref:'Station',required:true},
  state:{type:String,enum:['pending','playing','paused'],default:'pending'},
  expiresAt:{type:Date,required:true}
},{timestamps:true});
schema.index({accountId:1},{unique:true});
module.exports=mongoose.model('PlaybackLease',schema);
