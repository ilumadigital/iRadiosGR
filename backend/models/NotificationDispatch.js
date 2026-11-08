'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  _id:{type:String,required:true},
  createdAt:{type:Date,default:Date.now,expires:30*86400}
},{versionKey:false});
module.exports=mongoose.model('NotificationDispatch',schema);
