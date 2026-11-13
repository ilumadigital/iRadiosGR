'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 agencyId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 title:{type:String,required:true,trim:true,maxlength:180},
 brand:{type:String,required:true,trim:true,maxlength:150},
 description:{type:String,default:'',maxlength:3000},
 country:{type:String,default:'Ελλάδα'},
 region:{type:String,default:'All'},
 prefecture:{type:String,default:'All'},
 startsAt:{type:Date,required:true},
 endsAt:{type:Date,required:true},
 agencyEnabled:{type:Boolean,default:true},
 adminSuspended:{type:Boolean,default:false},
 approvalStatus:{type:String,enum:['draft','pending','approved','rejected'],default:'draft'},
 approvedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
 approvedAt:{type:Date,default:null},
 rejectedReason:{type:String,default:''},
 deletedAt:{type:Date,default:null},
 isStageCampaign:{type:Boolean,default:true}
},{timestamps:true});
schema.index({agencyId:1,createdAt:-1});
module.exports=mongoose.model('AdvertisingCampaign',schema);
