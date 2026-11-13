'use strict';
const mongoose=require('mongoose');
// Ephemeral shadow qualification. NEVER a financial settlement receipt.
const schema=new mongoose.Schema({
 _id:{type:String,required:true,match:/^[a-f0-9]{32}$/},
 campaignId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 creativeId:{type:mongoose.Schema.Types.ObjectId,required:true},
 kind:{type:String,enum:['visual','audio'],required:true},
 tier:{type:String,enum:['standard','hero','audio'],required:true},
 placement:{type:String,required:true},
 durationMs:{type:Number,required:true,min:0,max:300000},
 clientKey:{type:String,required:true,match:/^[a-f0-9]{64}$/},
 issuedAt:{type:Date,required:true},
 expiresAt:{type:Date,required:true},
 seq:{type:Number,default:0,min:0,max:1000},
 lastAt:{type:Date,default:null},
 lastActive:{type:Boolean,default:false},
 lastPositionMs:{type:Number,default:null},
 continuousMs:{type:Number,default:0,min:0},
 status:{type:String,enum:['issued','qualified','invalid'],default:'issued'},
 qualifiedAt:{type:Date,default:null},
 cleanupAt:{type:Date,required:true}
},{versionKey:false});
schema.index({cleanupAt:1},{expireAfterSeconds:0});
schema.index({campaignId:1,status:1,qualifiedAt:-1});
module.exports=mongoose.model('AdvertisingDeliveryTicket',schema);
