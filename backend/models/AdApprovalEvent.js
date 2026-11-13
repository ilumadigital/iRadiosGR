'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  eventKey:{type:String,required:true,unique:true},
  adType:{type:String,enum:['banner','audio'],required:true},
  adId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
  agencyId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  actorId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  kind:{type:String,enum:['submitted','approved','rejected'],required:true},
  revisionId:{type:String,required:true},
  isRevision:{type:Boolean,default:false},
  title:{type:String,required:true},
  changes:{type:[mongoose.Schema.Types.Mixed],default:[]},
  reason:{type:String,default:''},
  reviewState:{type:String,enum:['pending','approved','rejected','superseded'],default:'pending'},
  mailState:{type:String,enum:['queued','sending','sent','failed'],default:'queued',index:true},
  attempts:{type:Number,default:0},
  dueAt:{type:Date,default:Date.now,index:true},
  lockedUntil:{type:Date,default:null},
  sentAt:{type:Date,default:null},
  lastError:{type:String,default:''}
},{timestamps:true});
schema.index({adType:1,adId:1,createdAt:-1});
module.exports=mongoose.model('AdApprovalEvent',schema);
