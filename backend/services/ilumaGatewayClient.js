'use strict';
const https=require('node:https');
const {headersForRequest,validateGatewayPayment,GATEWAY_CHECKOUT_PATH,PAYMENT_ID}=
 require('./gatewayBillingProtocol');
const GATEWAY_HOST='gateway.iluma.gr';
function configured(){
 return process.env.APP_ENV==='staging' &&
   process.env.IRADIOS_BILLING_SANDBOX_ENABLED==='1' &&
   /^ilg_[a-f0-9]{48}$/.test(process.env.ILUMA_GATEWAY_STAGING_KEY||'') &&
   typeof process.env.ILUMA_GATEWAY_STAGING_SECRET==='string' &&
   process.env.ILUMA_GATEWAY_STAGING_SECRET.length>=32;
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
async function checkout({user,requestKey}){
 if(!configured())throw unavailable();
 const first=String(user.fname||'').trim(),last=String(user.lname||'').trim();
 const response=await signedRequest('POST',GATEWAY_CHECKOUT_PATH,{
   customer_id:'iradios-stage-'+String(user._id),
   product_sku:'L-PREM',name:([first,last].filter(Boolean).join(' ')||String(user.username||'Listener')).slice(0,250),
   email:String(user.email||'').trim()
 },requestKey);
 return validateGatewayPayment(response);
}
async function paymentStatus(paymentId,orderId){
 if(!PAYMENT_ID.test(paymentId||''))throw Error('Invalid gateway payment id');
 const data=await signedRequest('GET','/api/v1/payments/'+paymentId);
 return validateGatewayPayment(data,{expectedPaymentId:paymentId,expectedOrderId:orderId});
}
module.exports={configured,checkout,paymentStatus,signedRequest};
