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
 // Wizard budgeting is a PLAN until Nexi's signed webhook creates a funding lot.
 workflowVersion:{type:Number,default:1},
 createdByRole:{type:String,enum:['agency','admin'],default:'agency'},
 plannedBudgetCents:{type:Number,default:0,min:0,max:100000000},
 submittedAt:{type:Date,default:null},
 agencyEnabled:{type:Boolean,default:true},
 adminSuspended:{type:Boolean,default:false},
 approvalStatus:{type:String,enum:['draft','pending','approved','rejected'],default:'draft'},
 approvedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
 approvedAt:{type:Date,default:null},
 rejectedReason:{type:String,default:''},
 deletedAt:{type:Date,default:null},
 deletedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
 deletionReason:{type:String,default:'',maxlength:1000},
 isStageCampaign:{type:Boolean,default:true}
},{timestamps:true});
schema.index({agencyId:1,createdAt:-1});
module.exports=mongoose.model('AdvertisingCampaign',schema);
