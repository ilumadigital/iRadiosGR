'use strict';
const mongoose=require('mongoose');
// Short-lived serialization ONLY around creation of a new monthly subscription.
// Different subscription products still receive independent Nexi mandates;
// this lease prevents a simultaneous upgrade and station add-on checkout.
const schema=new mongoose.Schema({
 _id:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 ownerKey:{type:String,required:true},
 expiresAt:{type:Date,required:true}
},{timestamps:true,versionKey:false});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=mongoose.model('BroadcasterCheckoutLease',schema);
