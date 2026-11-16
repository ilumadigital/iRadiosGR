'use strict';
// Production Nexi connection is available ONLY for one intentional, isolated,
// allowlisted, real-card staging QA checkout. Never use these keys for normal
// Listener, Broadcaster or Agency requests.
const https=require('node:https');
const {headersForRequest,validateGatewayPayment,GATEWAY_CHECKOUT_PATH}=
 require('./gatewayBillingProtocol');
const HOST='gateway.iluma.gr';
const MODE='iradios-production-qa-v1';
const PRICE_CENTS=399;
function configured(){
 return process.env.APP_ENV==='staging' &&
   process.env.IRADIOS_PROD_QA_ENABLED==='1' &&
   /^[a-f0-9]{24}$/.test(process.env.IRADIOS_PROD_QA_LISTENER_ID||'') &&
   /^ilg_[a-f0-9]{48}$/.test(process.env.ILUMA_GATEWAY_PROD_KEY||'') &&
   /^[a-f0-9]{64}$/.test(process.env.ILUMA_GATEWAY_PROD_SECRET||'');
}
function allowedUser(user){
 return configured() && user?.role==='user' && user.isVerified===true &&
   String(user._id)===process.env.IRADIOS_PROD_QA_LISTENER_ID;
}
async function request(method,path,data=null,idempotencyKey=null){
 if(!configured())throw Object.assign(new Error('Production QA disabled'),{code:'PRODUCTION_QA_DISABLED'});
 const raw=data===null?'':JSON.stringify(data);
 const auth=headersForRequest({key:process.env.ILUMA_GATEWAY_PROD_KEY,
  secret:process.env.ILUMA_GATEWAY_PROD_SECRET,method,path,rawBody:raw});
 const headers={...auth,Accept:'application/json','Content-Type':'application/json',
  'Content-Length':Buffer.byteLength(raw)};
 if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 return new Promise((resolve,reject)=>{
  let finished=false;
  const req=https.request({hostname:HOST,port:443,path,method,headers,
   timeout:12000,agent:false,rejectUnauthorized:true},res=>{
   const chunks=[];let length=0;
   res.on('data',part=>{
    length+=part.length;
    if(length>65536){req.destroy(new Error('Gateway response too large'));return;}
    chunks.push(part);
   });
   res.on('end',()=>{
    if(finished)return;finished=true;
    const status=res.statusCode||0;
    if(status<200||status>=300)
     return reject(Object.assign(new Error('gateway_http_'+status),
      {code:'GATEWAY_HTTP_'+status}));
    try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}
    catch{reject(new Error('Invalid Gateway JSON'));}
   });
  });
  req.on('timeout',()=>req.destroy(new Error('Gateway request timeout')));
  req.on('error',e=>{if(!finished){finished=true;reject(e);}});
  req.end(raw);
 });
}
async function checkout(user,requestKey){
 if(!allowedUser(user))throw new Error('Production QA listener is not authorized');
 const id=String(user._id);
 if(!new RegExp('^iradios-qa-'+id+'-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$','i').test(requestKey))
  throw Error('Invalid QA idempotency request key');
 const name=([user.fname,user.lname].filter(Boolean).join(' ')||user.username||'QA Listener').slice(0,250);
 const response=await request('POST',GATEWAY_CHECKOUT_PATH,{
  qa_mode:MODE,customer_id:'iradios-qa-'+id,product_sku:'L-PREM',
  amount_cents:PRICE_CENTS,currency:'EUR',email:String(user.email||'').trim(),name
 },requestKey);
 return validateGatewayPayment(response,{expectedAmountCents:PRICE_CENTS});
}
async function byRequestKey(requestKey){
 if(!/^iradios-qa-[a-f0-9]{24}-[a-f0-9-]{36}$/i.test(requestKey))
  throw Error('Invalid QA recovery key');
 const response=await request('GET','/api/v1/payments/by-request-key/'+requestKey);
 return validateGatewayPayment(response,{expectedAmountCents:PRICE_CENTS});
}
module.exports={configured,allowedUser,checkout,byRequestKey,PRICE_CENTS,MODE};
