'use strict';
const mongoose=require('mongoose');
// Exactly-once HMAC nonce use across all stage backend processes.
const schema=new mongoose.Schema({
 nonce:{type:String,required:true,unique:true},
 createdAt:{type:Date,required:true,default:Date.now,expires:600}
},{versionKey:false});
module.exports=mongoose.model('GatewayWebhookNonce',schema);
