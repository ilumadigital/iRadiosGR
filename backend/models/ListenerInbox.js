'use strict';
const mongoose=require('mongoose');

// One durable, user-owned inbox entry per event. No external transport or browser
// permission is needed to view it. A 90-day TTL prevents unbounded growth.
const schema=new mongoose.Schema({
  recipient:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  topic:{type:String,enum:['newStations','favoriteSchedule','shows','news','promotions','system'],required:true},
  title:{type:String,required:true,maxlength:180},
  body:{type:String,default:'',maxlength:1000},
  path:{type:String,required:true,maxlength:400},
  eventKey:{type:String,required:true,maxlength:170},
  readAt:{type:Date,default:null},
  createdAt:{type:Date,default:Date.now,expires:90*24*60*60}
},{versionKey:false});
schema.index({recipient:1,createdAt:-1});
schema.index({recipient:1,readAt:1});
schema.index({recipient:1,eventKey:1},{unique:true});
module.exports=mongoose.model('ListenerInbox',schema);
