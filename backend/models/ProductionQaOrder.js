'use strict';
const mongoose=require('mongoose');
// Isolated one-off REAL Nexi production charge for ONE allowlisted listener on
// stage.iradios.gr. Never a normal BillingOrder and never visible to live Mongo.
const schema=new mongoose.Schema({
 accountId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true,immutable:true},
 qaRunKey:{type:String,required:true,unique:true,immutable:true},
 requestKey:{type:String,required:true,unique:true,immutable:true},
 sku:{type:String,enum:['L-PREM'],default:'L-PREM',immutable:true},
 amountCents:{type:Number,enum:[399],default:399,immutable:true},
 currency:{type:String,enum:['EUR'],default:'EUR',immutable:true},
 gatewayPaymentId:{type:String,default:undefined},
 gatewayOrderId:{type:String,default:undefined},
 status:{type:String,enum:['creating','pending','redirect','unknown','paid','failed','canceled'],default:'creating'},
 checkoutUrl:{type:String,default:null},
 paidAt:{type:Date,default:null},
 periodStartsAt:{type:Date,default:null},
 periodEndsAt:{type:Date,default:null},
 eventIds:{type:[String],default:[]},
 eventLog:{type:[new mongoose.Schema({id:String,type:String,at:Date},{_id:false})],default:[]},
 lastErrorCode:{type:String,default:null}
},{timestamps:true,strict:true});
schema.index({gatewayPaymentId:1},{unique:true,partialFilterExpression:{gatewayPaymentId:{$type:'string'}}});
schema.index({gatewayOrderId:1},{unique:true,partialFilterExpression:{gatewayOrderId:{$type:'string'}}});
module.exports=mongoose.model('ProductionQaOrder',schema);
