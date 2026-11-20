'use strict';
const mongoose = require('mongoose');
const revisionSchema = new mongoose.Schema({
  agencyId: {type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  creativeType: {type:String,enum:['banner','audio'],required:true},
  creativeId: {type:mongoose.Schema.Types.ObjectId,required:true,index:true},
  patch: {type:mongoose.Schema.Types.Mixed,required:true},
  before: {type:mongoose.Schema.Types.Mixed,default:{}},
  baseUpdatedAt:{type:Date,default:null},
  status: {type:String,enum:['pending','approved','rejected'],default:'pending',index:true},
  // Remain pending during a two-phase Admin approval. The unique pending
  // index blocks overlapping Agency submissions until finalization.
  processing:{type:Boolean,default:false},
  processingDecision:{type:String,enum:['approve'],default:null},
  processingBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
  processingStartedAt:{type:Date,default:null},
  submittedBy: {type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  reviewedBy: {type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
  reviewedAt: {type:Date,default:null},
  rejectionReason: {type:String,default:''},
  notificationState: {type:String,enum:['pending','sent','failed'],default:'pending'},
  // Only version-1 revisions participate in the new durable outbox scanner.
  // Imported historic revisions are deliberately not replayed.
  noticeVersion:{type:Number,default:0},
  creativeTitleAtSubmission:{type:String,default:''},
  submissionOutboxSeededAt:{type:Date,default:null},
  decisionOutboxSeededAt:{type:Date,default:null}
},{timestamps:true});
revisionSchema.index({creativeType:1,creativeId:1,status:1});
revisionSchema.index({creativeType:1,creativeId:1},{unique:true,
  partialFilterExpression:{status:'pending'}});
module.exports = mongoose.model('AgencyAdRevision',revisionSchema);
