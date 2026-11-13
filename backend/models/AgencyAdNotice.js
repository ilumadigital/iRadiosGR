'use strict';
const mongoose=require('mongoose');
// Staging-only Agency change notices. One immutable row PER (event, recipient).
// SMTP/Mailpit is at-least-once: an acknowledged send followed by a crash
// before marking "sent" can result in a duplicate. Never claim exactly-once.
const schema=new mongoose.Schema({
 eventKey:{type:String,required:true,unique:true,maxlength:200},
 kind:{type:String,required:true,enum:[
  'draft_submitted','revision_submitted','revision_approved','revision_rejected'
 ]},
 creativeType:{type:String,required:true,enum:['banner','audio']},
 creativeId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 revisionId:{type:mongoose.Schema.Types.ObjectId,default:null,index:true},
 agencyId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 recipientUserId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 recipientEmail:{type:String,required:true,maxlength:254},
 subject:{type:String,required:true,maxlength:400},
 html:{type:String,required:true,maxlength:50000},
 status:{type:String,enum:['pending','sending','sent','superseded'],default:'pending',index:true},
 attempts:{type:Number,default:0,min:0},
 nextAttemptAt:{type:Date,default:Date.now},
 leaseToken:{type:String,default:null},
 leaseUntil:{type:Date,default:null},
 sentAt:{type:Date,default:null},
 providerMessageId:{type:String,default:''},
 lastError:{type:String,default:'',maxlength:250}
},{timestamps:true,versionKey:false});
schema.index({status:1,nextAttemptAt:1,createdAt:1});
schema.index({status:1,leaseUntil:1});
schema.index({agencyId:1,createdAt:-1});
module.exports=mongoose.model('AgencyAdNotice',schema);
