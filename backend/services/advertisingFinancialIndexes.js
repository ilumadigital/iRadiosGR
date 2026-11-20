'use strict';
// Fail closed if unique payment, quote, and unresolved-checkout indexes are
// missing. Mongoose model.init() does NOT build indexes with autoIndex=false.
const Intent=require('../models/AdvertisingPaymentIntent');
const FundingLot=require('../models/AdvertisingFundingLot');
const Event=require('../models/AdvertisingBillableEvent');
let readiness=null;
function ensureAdvertisingFinancialIndexes(){
 if(!readiness){
  readiness=Promise.all([Intent.createIndexes(),FundingLot.createIndexes(),
   Event.createIndexes()])
   .then(()=>true)
   .catch(error=>{readiness=null;throw error;});
 }
 return readiness;
}
module.exports={ensureAdvertisingFinancialIndexes};
