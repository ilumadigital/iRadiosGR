'use strict';
const mongoose=require('mongoose');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const schema=new mongoose.Schema({
  accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  deviceId:{type:String,required:true,match:UUID},
  deviceType:{type:String,enum:['mobile','tablet','desktop','tv','console','unknown'],default:'unknown'},
  brand:{type:String,default:'',maxlength:48},
  model:{type:String,default:'',maxlength:90},
  os:{type:String,default:'',maxlength:64},
  browser:{type:String,default:'',maxlength:64},
  clientType:{type:String,enum:['app','browser'],default:'browser'},
  displayName:{type:String,required:true,maxlength:120},
  firstSeenAt:{type:Date,default:Date.now},
  lastSeenAt:{type:Date,default:Date.now},
  revokedAt:{type:Date,default:null}
},{timestamps:true});
schema.index({accountId:1,deviceId:1},{unique:true});
schema.index({accountId:1,lastSeenAt:-1});
module.exports=mongoose.model('UserDevice',schema);
