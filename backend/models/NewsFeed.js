'use strict';
const mongoose=require('mongoose');
const article=new mongoose.Schema({
  id:{type:String,required:true},title:{type:String,required:true},summary:String,
  imageUrl:String,url:{type:String,required:true},publishedAt:Date,source:String
},{_id:false});
const schema=new mongoose.Schema({
  _id:{type:String,default:'primary'},feedUrl:{type:String,required:true},
  enabled:{type:Boolean,default:true},feedTitle:{type:String,default:''},
  articles:{type:[article],default:[]},lastSyncedAt:{type:Date,default:null},
  lastAttemptAt:{type:Date,default:null},lastError:{type:String,default:''}
},{timestamps:true});
module.exports=mongoose.model('NewsFeed',schema);
