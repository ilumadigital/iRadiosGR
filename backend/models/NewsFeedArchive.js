'use strict';
const mongoose=require('mongoose');
// Only evicted article previews are saved, not the full text of publisher sites.
// Mongo TTL removes them after 14 days to keep shared links useful for a while.
const schema=new mongoose.Schema({
  _id:{type:String,required:true},
  title:{type:String,required:true},summary:{type:String,default:''},
  previewParagraphs:{type:[String],default:[]},
  url:{type:String,required:true},imageUrl:{type:String,default:''},
  source:{type:String,default:''},category:{type:String,default:''},
  sourceId:{type:String,default:''},publishedAt:{type:Date,default:null},
  expiresAt:{type:Date,required:true}
},{timestamps:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=mongoose.model('NewsFeedArchive',schema);
