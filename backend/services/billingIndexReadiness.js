'use strict';
// Explicit index creation avoids accepting payment attempts on a MongoDB
// connection whose autoIndex has been disabled for NODE_ENV=production.
// Only new billing collections are touched; no imported station/user data.
const BillingOrder=require('../models/BillingOrder');
const GatewayWebhookNonce=require('../models/GatewayWebhookNonce');
let promise=null;
function ensureBillingIndexes(){
 if(process.env.APP_ENV!=='staging')
  return Promise.reject(new Error('Sandbox billing indexes require staging'));
 if(!promise){
  promise=Promise.all([
    BillingOrder.createIndexes(),
    GatewayWebhookNonce.createIndexes()
  ]).catch(e=>{promise=null;throw e;});
 }
 return promise;
}
module.exports={ensureBillingIndexes};
