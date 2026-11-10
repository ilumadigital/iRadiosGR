'use strict';
const https=require('node:https');
const {headersForRequest,validateGatewayPayment,GATEWAY_CHECKOUT_PATH,PAYMENT_ID}=
 require('./gatewayBillingProtocol');
const GATEWAY_HOST='gateway.iluma.gr';
function configured(){
 return process.env.APP_ENV==='staging' &&
   process.env.IRADIOS_BILLING_SANDBOX_ENABLED==='1' &&
   /^ilg_[a-f0-9]{48}$/.test(process.env.ILUMA_GATEWAY_STAGING_KEY||'') &&
   /^[a-f0-9]{64}$/.test(process.env.ILUMA_GATEWAY_STAGING_SECRET||'');
}
function unavailable(){
 const err=new Error('Nexi Sandbox checkout is not configured');
 err.code='SANDBOX_UNAVAILABLE';return err;
}
function signedRequest(method,path,data=null,idempotencyKey=null){
 if(!configured())return Promise.reject(unavailable());
 const raw=data===null?'':JSON.stringify(data);
 const signed=headersForRequest({
   key:process.env.ILUMA_GATEWAY_STAGING_KEY,
   secret:process.env.ILUMA_GATEWAY_STAGING_SECRET,
   method,path,rawBody:raw
 });
 const headers={...signed,Accept:'application/json',
   'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)};
 if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 return new Promise((resolve,reject)=>{
  let settled=false;
  const req=https.request({
   hostname:GATEWAY_HOST,port:443,path,method,headers,
   timeout:12000,agent:false,rejectUnauthorized:true
  },res=>{
   const chunks=[];let count=0;
   res.on('data',part=>{
    count+=part.length;
    if(count>65536){req.destroy(new Error('gateway_response_too_large'));return;}
    chunks.push(part);
   });
   res.on('end',()=>{
    if(settled)return;settled=true;
    const code=res.statusCode||0;
    if(code<200||code>=300)
      return reject(Object.assign(new Error('gateway_http_'+code),{
        code:'GATEWAY_HTTP_'+code
      }));
    try {return resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
    catch{return reject(new Error('gateway_bad_json'));}
   });
  });
  req.on('timeout',()=>req.destroy(new Error('gateway_timeout')));
  req.on('error',err=>{if(!settled){settled=true;reject(err);}});
  req.end(raw);
 });
}
async function checkout({user,requestKey,cardChoice={},sku='L-PREM',winbackExpiredAt=null}){
 if(!configured())throw unavailable();
 const first=String(user.fname||'').trim(),last=String(user.lname||'').trim();
 const response=await signedRequest('POST',GATEWAY_CHECKOUT_PATH,{
   customer_id:'iradios-stage-'+String(user._id),
   product_sku:sku,name:([first,last].filter(Boolean).join(' ')||String(user.username||'Listener')).slice(0,250),
   email:String(user.email||'').trim(),
   ...(sku==='L-WINBACK-199'?{winback_expired_at:winbackExpiredAt}:{}),
   ...(cardChoice.autoRenew===true?{
      auto_renew:true,recurring_consent_version:'iradios-mit-monthly-v1'
   }:{ }),
   ...(cardChoice.saveCard===true?{
     save_card:true,card_consent_version:'iradios-stored-card-v1'
   }:cardChoice.useSavedCard===true?{use_saved_card:true}:{})
 },requestKey);
 return validateGatewayPayment(response,{expectedAmountCents:sku==='L-WINBACK-199'?199:399});
}
async function paymentStatus(paymentId,orderId,expectedAmountCents=399){
 if(!PAYMENT_ID.test(paymentId||''))throw Error('Invalid gateway payment id');
 const data=await signedRequest('GET','/api/v1/payments/'+paymentId);
 return validateGatewayPayment(data,{expectedPaymentId:paymentId,expectedOrderId:orderId,
  expectedAmountCents});
}
// Recovery after the response was lost: HMAC-protected lookup of an EXISTING
// gateway payment. Never replays checkout or creates a new Nexi order.
async function paymentByRequestKey(requestKey,expectedAmountCents=399){
 if(typeof requestKey!=='string'||!/^iradios-stage-[a-f0-9]{24}-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestKey))
  throw Error('Invalid original payment request key');
 const data=await signedRequest('GET','/api/v1/payments/by-request-key/'+requestKey);
 return validateGatewayPayment(data,{expectedAmountCents});
}
async function winbackStatus(user){
 if(!user?._id)throw Error('Authenticated user required');
 const data=await signedRequest('POST','/api/v1/winback/status',{
  customer_id:'iradios-stage-'+String(user._id)
 });
 if(!data||!['none','pending','redeemed','unavailable'].includes(data.state)||
   typeof data.used!=='boolean')throw Error('Invalid Gateway winback status');
 return data;
}
async function savedCardStatus(user){
 if(!user?._id)throw Error('Authenticated account required');
 const data=await signedRequest('POST','/api/v1/payment-methods/status',{
  customer_id:'iradios-stage-'+String(user._id)
 });
 if(!data||!['none','pending','active','revocation_pending','revoked'].includes(data.state)||
    data.automatic_renewal!==false)throw Error('Invalid Gateway stored-card status');
 return {state:data.state,type:data.type||null,automaticRenewal:false};
}
async function revokeSavedCard(user){
 if(!user?._id)throw Error('Authenticated account required');
 const data=await signedRequest('POST','/api/v1/payment-methods/revoke',{
  customer_id:'iradios-stage-'+String(user._id)
 });
 if(!data||!['none','revocation_pending','revoked'].includes(data.state))
  throw Error('Invalid Gateway card-revocation result');
 return {state:data.state,automaticRenewal:false};
}
async function recurringStatus(user){
 if(!user?._id)throw Error('Authenticated user required');
 const data=await signedRequest('POST','/api/v1/recurring/status',{
  customer_id:'iradios-stage-'+String(user._id)
 });
 if(!data||!['none','unavailable','pending','verification_pending','active','cancelled','past_due'].includes(data.state)||
    data.amount_cents!==399||data.currency!=='EUR')throw Error('Invalid recurring status');
 return data;
}
async function cancelRecurring(user){
 if(!user?._id)throw Error('Authenticated user required');
 const data=await signedRequest('POST','/api/v1/recurring/cancel',{
  customer_id:'iradios-stage-'+String(user._id)
 });
 if(!data||!['none','cancelled','unavailable'].includes(data.state))
  throw Error('Invalid cancellation response');
 return data;
}
async function paymentHistory(user){
 if(!user?._id)throw Error('Authenticated user required');
 const data=await signedRequest('POST','/api/v1/billing/history',{
  customer_id:'iradios-stage-'+String(user._id)
 });
 if(!Array.isArray(data?.payments)||data.payments.length>60)
  throw Error('Invalid billing history');
 return data.payments;
}

// Broadcaster checkout is separate from Listener Premium; amounts are validated
// from the immutable server catalog after a signed Gateway response.
const {gatewayPurchase}=require('./broadcasterPaymentProtocol');
const {getProduct}=require('../config/billingCatalog');
async function broadcasterCheckout({user,requestKey,sku,stationId=null,autoRenew=false}){
 const product=getProduct(sku);
 if(!product||!configured())throw unavailable();
 const first=String(user.fname||'').trim(),last=String(user.lname||'').trim();
 const response=await signedRequest('POST',GATEWAY_CHECKOUT_PATH,{
  customer_id:'iradios-stage-'+String(user._id),product_sku:sku,
  name:([first,last].filter(Boolean).join(' ')||String(user.username||'Broadcaster')).slice(0,250),
  email:String(user.email||'').trim(),
  ...(product.scopeType==='station'?{resource_id:String(stationId)}:{}),
  ...(autoRenew?{auto_renew:true,recurring_consent_version:'iradios-broadcaster-monthly-v1'}:{})
 },requestKey);
 return gatewayPurchase(response,{sku});
}
async function broadcasterPaymentStatus(paymentId,orderId,sku){
 if(!PAYMENT_ID.test(paymentId||''))throw Error('Invalid broadcaster Gateway payment ID');
 const data=await signedRequest('GET','/api/v1/payments/'+paymentId);
 return gatewayPurchase(data,{sku,paymentId,orderId});
}
async function broadcasterPaymentByRequestKey(requestKey,sku){
 if(!/^iradios-bstage-[a-f0-9]{24}-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestKey))
  throw Error('Invalid broadcaster checkout request key');
 const data=await signedRequest('GET','/api/v1/payments/by-request-key/'+requestKey);
 return gatewayPurchase(data,{sku});
}
async function broadcasterRecurringStatus(user,sku,stationId=null){
 const p=getProduct(sku);
 if(!p||p.kind!=='subscription')throw Error('Invalid broadcaster subscription');
 const data=await signedRequest('POST','/api/v1/broadcaster/recurring/status',{
  customer_id:'iradios-stage-'+String(user._id),product_sku:sku,
  ...(p.scopeType==='station'?{resource_id:String(stationId)}:{})
 });
 if(data.sku!==sku||data.amount_cents!==p.priceCents||data.currency!=='EUR'||
  !['none','unavailable','pending','verification_pending','active','cancelled','past_due'].includes(data.state))
  throw Error('Invalid broadcaster recurring status response');
 return data;
}
async function cancelBroadcasterRecurring(user,sku,stationId=null){
 const p=getProduct(sku);
 if(!p||p.kind!=='subscription')throw Error('Invalid broadcaster subscription');
 const data=await signedRequest('POST','/api/v1/broadcaster/recurring/cancel',{
  customer_id:'iradios-stage-'+String(user._id),product_sku:sku,
  ...(p.scopeType==='station'?{resource_id:String(stationId)}:{})
 });
 if(data.sku!==sku||data.amount_cents!==p.priceCents||data.currency!=='EUR'||
   !['none','cancelled','unavailable'].includes(data.state))
  throw Error('Invalid broadcaster cancellation response');
 return data;
}

module.exports={configured,checkout,paymentStatus,paymentByRequestKey,winbackStatus,signedRequest,
 savedCardStatus,revokeSavedCard,recurringStatus,cancelRecurring,paymentHistory,
 broadcasterCheckout,broadcasterPaymentStatus,broadcasterPaymentByRequestKey,
 broadcasterRecurringStatus,cancelBroadcasterRecurring};
