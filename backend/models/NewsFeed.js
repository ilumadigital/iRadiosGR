'use strict';
const mongoose=require('mongoose');
const article=new mongoose.Schema({
  id:{type:String,required:true},title:{type:String,required:true},summary:String,
  imageUrl:String,url:{type:String,required:true},publishedAt:Date,source:String,category:{type:String,default:''},
  sourceId:{type:String,default:''}
},{_id:false});
const source=new mongoose.Schema({
  id:{type:String,required:true},url:{type:String,required:true},
  type:{type:String,enum:['rss_app','google_publisher','google_rss','rssnews_preset','direct_rss'],required:true},
  domain:{type:String,default:''},category:{type:String,default:''},enabled:{type:Boolean,default:true},
  label:{type:String,default:''},feedTitle:{type:String,default:''},
  lastSyncedAt:{type:Date,default:null},lastAttemptAt:{type:Date,default:null},
  lastError:{type:String,default:''},fetchedCount:{type:Number,default:0,min:0},
  retrievalMode:{type:String,default:''}
},{_id:false});
const schema=new mongoose.Schema({
  _id:{type:String,default:'primary'},
  feedUrl:{type:String,default:'https://rss.app/feeds/k4AEhunSwl50WyaC.xml'},
  enabled:{type:Boolean,default:true},feedTitle:{type:String,default:''},
  sources:{type:[source],default:[]},configRevision:{type:Number,default:0},
  bootstrapVersion:{type:String,default:''},
  articles:{type:[article],default:[]},lastSyncedAt:{type:Date,default:null},
  lastAttemptAt:{type:Date,default:null},lastError:{type:String,default:''}
},{timestamps:true});
module.exports=mongoose.model('NewsFeed',schema);
