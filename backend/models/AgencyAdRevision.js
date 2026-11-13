'use strict';
const mongoose = require('mongoose');
const revisionSchema = new mongoose.Schema({
  agencyId: {type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  creativeType: {type:String,enum:['banner','audio'],required:true},
  creativeId: {type:mongoose.Schema.Types.ObjectId,required:true,index:true},
  patch: {type:mongoose.Schema.Types.Mixed,required:true},
  before: {type:mongoose.Schema.Types.Mixed,default:{}},
  status: {type:String,enum:['pending','approved','rejected'],default:'pending',index:true},
  submittedBy: {type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  reviewedBy: {type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
  reviewedAt: {type:Date,default:null},
  rejectionReason: {type:String,default:''},
  notificationState: {type:String,enum:['pending','sent','failed'],default:'pending'}
},{timestamps:true});
revisionSchema.index({creativeType:1,creativeId:1,status:1});
revisionSchema.index({creativeType:1,creativeId:1},{unique:true,
  partialFilterExpression:{status:'pending'}});
module.exports = mongoose.model('AgencyAdRevision',revisionSchema);
