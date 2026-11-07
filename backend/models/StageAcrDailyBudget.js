'use strict';
const mongoose=require('mongoose');
// Daily cap persists across container restarts, unlike an in-memory counter.
// TTL eventually deletes old counters; never stores credentials or audio.
const schema=new mongoose.Schema({
  _id:{type:String,required:true},
  used:{type:Number,default:0},
  expiresAt:{type:Date,required:true}
},{versionKey:false});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=mongoose.model('StageAcrDailyBudget',schema);
