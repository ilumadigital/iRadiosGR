'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const https=require('node:https');
const {gatewayRoute}=require('../services/gatewayRoute');
const gateway=require('../services/ilumaGatewayClient');

function response(){return {statusCode:200,headersSent:false,
 status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
test('upstream outage returns payment-specific 503 without raw provider errors',async()=>{
 for(const code of ['GATEWAY_HTTP_503','GATEWAY_HTTP_401','GATEWAY_NETWORK_ERROR','GATEWAY_TIMEOUT','GATEWAY_BAD_RESPONSE']){
  const res=response();
  await gatewayRoute(async()=>{throw Object.assign(new Error('secret/provider details'),{code});})
   ({},res,()=>assert.fail('unexpected Express error'));
  assert.equal(res.statusCode,503);
  assert.equal(res.body.code,'PAYMENT_SERVICE_UNAVAILABLE');
  assert.ok(!JSON.stringify(res.body).includes('secret'));
 }
});
test('application errors continue to Express and successful uncertain orders remain 202',async()=>{
 const expected=new Error('database');let forwarded;
 await gatewayRoute(()=>{throw expected;})({},response(),e=>{forwarded=e;});
 assert.equal(forwarded,expected);
 const res=response();
 await gatewayRoute((_req,r)=>r.status(202).json({order:{status:'unknown'}}))({},res,assert.fail);
 assert.equal(res.statusCode,202);assert.equal(res.body.order.status,'unknown');
});
test('Gateway transport has one request per operation and never retries uncertain POST',async()=>{
 const previous=https.request,old={};
 for(const name of ['APP_ENV','IRADIOS_GATEWAY_ENV','IRADIOS_BILLING_ENABLED','IRADIOS_PRODUCTION_CUTOVER_APPROVED','ILUMA_GATEWAY_PROD_KEY','ILUMA_GATEWAY_PROD_SECRET'])old[name]=process.env[name];
 Object.assign(process.env,{APP_ENV:'production',IRADIOS_GATEWAY_ENV:'production',
  IRADIOS_BILLING_ENABLED:'1',IRADIOS_PRODUCTION_CUTOVER_APPROVED:'1',
  ILUMA_GATEWAY_PROD_KEY:'ilg_'+'a'.repeat(48),
  ILUMA_GATEWAY_PROD_SECRET:'b'.repeat(64)});
 try{
  for(const scenario of ['http','timeout','aborted','json']){
   let attempts=0;
   https.request=(options,callback)=>{
    attempts++;
    assert.equal(options.hostname,'gateway.iluma.gr');
    assert.equal(options.rejectUnauthorized,true);
    assert.ok(options.headers['X-Iluma-Signature']);
    const req=new EventEmitter();
    req.destroy=error=>queueMicrotask(()=>req.emit('error',error));
    req.end=()=>queueMicrotask(()=>{
     if(scenario==='timeout'){req.emit('timeout');return;}
     const res=new EventEmitter();res.statusCode=scenario==='http'?503:200;
     callback(res);
     if(scenario==='aborted'){res.emit('aborted');return;}
     res.emit('data',Buffer.from('not json; private upstream details'));
     res.emit('end');
    });
    return req;
   };
   const code={http:'GATEWAY_HTTP_503',timeout:'GATEWAY_TIMEOUT',
    aborted:'GATEWAY_BAD_RESPONSE',json:'GATEWAY_BAD_RESPONSE'}[scenario];
   await assert.rejects(gateway.signedRequest('POST','/api/v1/payments/checkout',{},
    'original-request-key'),e=>e.code===code&&!e.message.includes('private'));
   assert.equal(attempts,1);
  }
 }finally{
  https.request=previous;
  for(const [key,value] of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
