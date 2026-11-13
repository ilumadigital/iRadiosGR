'use strict';
const mongoose=require('mongoose');
// Atomic frequency and pacing shadow ticket reservations; no financial debits.
const schema=new mongoose.Schema({
 _id:{type:String,required:true},
 count:{type:Number,default:0,min:0},
 expiresAt:{type:Date,required:true}
},{versionKey:false});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=mongoose.model('AdvertisingDeliveryCounter',schema);
