'use strict';
const mongoose=require('mongoose');
// One durable, atomic local payment + first-cycle record.
// No payment card data and no fake Stripe records.
const schema=new mongoose.Schema({
 accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
 sku:{type:String,enum:['L-PREM'],required:true},
 environment:{type:String,enum:['staging'],required:true,default:'staging',immutable:true},
 amountCents:{type:Number,required:true,enum:[399],immutable:true},
 currency:{type:String,enum:['EUR'],default:'EUR',immutable:true},
 requestKey:{type:String,required:true,unique:true,immutable:true},
 // Only OPEN checkout intents own this unique lock. Always $unset on terminal state.
 lockKey:{type:String,default:undefined},
 gatewayPaymentId:{type:String,default:undefined},
 gatewayOrderId:{type:String,default:undefined},
 checkoutUrl:{type:String,default:null},
 status:{type:String,enum:['creating','pending','redirect','unknown','paid','failed','canceled'],
   default:'creating',index:true},
 providerStatus:{type:String,default:null},
 gatewayLastCheckedAt:{type:Date,default:null},
 paidAt:{type:Date,default:null},
 periodStartsAt:{type:Date,default:null},
 periodEndsAt:{type:Date,default:null},
 eventIds:{type:[String],default:[]},
 eventLog:{type:[new mongoose.Schema({
   id:{type:String,required:true},type:{type:String,required:true},
   at:{type:Date,required:true}
 },{_id:false})],default:[]},
 lastErrorCode:{type:String,default:null}
},{timestamps:true,strict:true});
schema.index({lockKey:1},{unique:true,partialFilterExpression:{lockKey:{$type:'string'}}});
schema.index({gatewayPaymentId:1},{unique:true,partialFilterExpression:{gatewayPaymentId:{$type:'string'}}});
schema.index({gatewayOrderId:1},{unique:true,partialFilterExpression:{gatewayOrderId:{$type:'string'}}});
schema.index({accountId:1,sku:1,paidAt:-1});
module.exports=mongoose.model('BillingOrder',schema);
