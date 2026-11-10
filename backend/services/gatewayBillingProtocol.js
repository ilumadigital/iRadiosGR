'use strict';
const crypto=require('node:crypto');
const PAYMENT_ID=/^[a-f0-9]{32}$/;
const ORDER_ID=/^IL[A-F0-9]{24}$/;
const EVENT_ID=/^[a-f0-9]{32}$/;
const NONCE=/^[a-f0-9]{32}$/;
const SIGNATURE=/^[a-f0-9]{64}$/;
const TIMESTAMP=/^[0-9]{10}$/;
const WEBHOOK_PATH='/api/gateway/webhook';
const GATEWAY_CHECKOUT_PATH='/api/v1/payments/checkout';

function canonicalSignature(secret,method,path,timestamp,nonce,rawBody){
 const raw=Buffer.isBuffer(rawBody)?rawBody:Buffer.from(rawBody||'', 'utf8');
 const digest=crypto.createHash('sha256').update(raw).digest('hex');
 const canonical=[method.toUpperCase(),path,timestamp,nonce,digest].join('\n');
 // ILUMA Gateway PHP uses the RAW hexadecimal credential secret as the HMAC key.
 return crypto.createHmac('sha256',secret).update(canonical,'utf8').digest('hex');
}
function headersForRequest({secret,key,method,path,rawBody,nonce,now=new Date()}){
 if(!(/^[a-f0-9]{64}$/.test(secret||''))||typeof key!=='string'||
    !/^ilg_[a-f0-9]{48}$/.test(key))throw Error('Gateway credential configuration invalid');
 const timestamp=String(Math.floor(now.getTime()/1000));
 const n=nonce||crypto.randomBytes(16).toString('hex');
 if(!NONCE.test(n))throw Error('Gateway nonce invalid');
 return {'X-Iluma-Key':key,'X-Iluma-Timestamp':timestamp,'X-Iluma-Nonce':n,
   'X-Iluma-Signature':canonicalSignature(secret,method,path,timestamp,n,rawBody)};
}
function verifyWebhookHeaders({secret,headers,rawBody,now=new Date()}){
 if(!/^[a-f0-9]{64}$/.test(secret||''))return {valid:false,reason:'unconfigured'};
 if(!Buffer.isBuffer(rawBody)||rawBody.length<2||rawBody.length>65536)
   return {valid:false,reason:'body'};
 const timestamp=headers['x-iluma-timestamp'];
 const nonce=headers['x-iluma-nonce'];
 const sig=headers['x-iluma-signature'];
 const eventId=headers['x-iluma-event-id'];
 if(typeof timestamp!=='string'||!TIMESTAMP.test(timestamp)||
    typeof nonce!=='string'||!NONCE.test(nonce)||
    typeof sig!=='string'||!SIGNATURE.test(sig)||
    typeof eventId!=='string'||!EVENT_ID.test(eventId))
   return {valid:false,reason:'headers'};
 const receivedAt=Number(timestamp)*1000;
 if(Math.abs(receivedAt-now.getTime())>300000)
   return {valid:false,reason:'timestamp'};
 const expected=canonicalSignature(secret,'POST',WEBHOOK_PATH,timestamp,nonce,rawBody);
 if(!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(sig,'hex')))
   return {valid:false,reason:'signature'};
 return {valid:true,nonce,eventId};
}
function hostedCheckoutUrl(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try {
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||
     !(u.hostname==='nexigroup.com'||u.hostname.endsWith('.nexigroup.com')))
    return null;
  return u.toString();
 }catch{return null;}
}
function validateGatewayPayment(payment,{expectedPaymentId=null,expectedOrderId=null}={}){
 if(!payment||typeof payment!=='object'||Array.isArray(payment))throw Error('gateway_bad_payment');
 if(!PAYMENT_ID.test(payment.payment_id||'')||!ORDER_ID.test(payment.order_id||''))
   throw Error('gateway_bad_reference');
 if(expectedPaymentId&&payment.payment_id!==expectedPaymentId)throw Error('gateway_payment_mismatch');
 if(expectedOrderId&&payment.order_id!==expectedOrderId)throw Error('gateway_order_mismatch');
 if(payment.amount_cents!==399||payment.currency!=='EUR')throw Error('gateway_price_mismatch');
 if(!['pending','redirect','unknown','paid','failed','canceled'].includes(payment.status))
   throw Error('gateway_bad_status');
 const checkoutUrl=payment.status==='redirect'?hostedCheckoutUrl(payment.checkout_url):null;
 if(payment.status==='redirect'&&!checkoutUrl)throw Error('gateway_bad_redirect');
 return {...payment,checkout_url:checkoutUrl};
}
function validatePaymentEvent(body,eventId,now=new Date()){
 if(!body||typeof body!=='object'||Array.isArray(body))return false;
 if(body.event_id!==eventId||!EVENT_ID.test(body.event_id||'')||
    !PAYMENT_ID.test(body.payment_id||'')||!ORDER_ID.test(body.order_id||''))
   return false;
 if(!['payment.paid','payment.failed','payment.canceled'].includes(body.event_type))
   return false;
 if(body.environment!=='staging'||body.amount_cents!==399||body.currency!=='EUR')
   return false;
 // Internal Gateway customer ID is not the iRadios account ID.
 if(typeof body.customer_id!=='string'||body.customer_id.length<1||
    body.customer_id.length>190)return false;
 const occurredAt=Date.parse(body.occurred_at);
 return Number.isFinite(occurredAt)&&occurredAt>Date.UTC(2020,0,1)&&
   occurredAt<=now.getTime()+300000;
}
// A signed Gateway GET can confirm provider status, but only the authenticated
// payment.paid WEBHOOK activates the local subscription.
function localStatusFromGatewayLookup(providerStatus){
 if(providerStatus==='paid')return 'pending';
 if(['pending','redirect','unknown','failed','canceled'].includes(providerStatus))
  return providerStatus;
 throw Error('gateway_bad_status');
}
function nextMonthlyPeriod(start){
 const d=new Date(start);
 if(!Number.isFinite(d.getTime()))throw Error('Invalid period start');
 const y=d.getUTCFullYear(),m=d.getUTCMonth(),day=d.getUTCDate();
 const last=new Date(Date.UTC(y,m+2,0)).getUTCDate();
 return new Date(Date.UTC(y,m+1,Math.min(day,last),
   d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds(),d.getUTCMilliseconds()));
}
// The iRadios backend owns entitlement terms, never Gateway or Nexi.
// Configured once per paid period. Zero is the safe default: no unapproved grace.
function configuredGraceDays(){
 const raw=process.env.IRADIOS_BILLING_GRACE_DAYS||'0';
 return /^(?:[0-9]|1[0-4])$/.test(raw)?Number(raw):0;
}
function nextGracePeriod(periodEnd,days=configuredGraceDays()){
 const end=new Date(periodEnd);
 if(!Number.isFinite(end.getTime())||!Number.isInteger(days)||days<0||days>14)
  throw Error('Invalid grace period');
 return new Date(end.getTime()+days*86400000);
}
function safeOrderStatus(row,now=new Date()){
 const start=row.periodStartsAt?new Date(row.periodStartsAt):null;
 const end=row.periodEndsAt?new Date(row.periodEndsAt):null;
 const graceEnd=row.graceEndsAt?new Date(row.graceEndsAt):null;
 const effective=row.status==='paid'&&start&&start>now?'scheduled':
   row.status==='paid'&&end&&end>now?'active':
   row.status==='paid'&&graceEnd&&graceEnd>now?'grace':
   row.status==='paid'?'expired':row.status;
 return {id:String(row._id),sku:row.sku,status:effective,
   providerStatus:row.providerStatus||null,amountCents:row.amountCents,
   currency:row.currency,checkoutUrl:effective==='redirect'?hostedCheckoutUrl(row.checkoutUrl):null,
   gatewayOrderId:row.gatewayOrderId||null,
   recoveryReason:row.lastErrorCode==='GATEWAY_PAYMENT_NOT_CREATED'?'not_created':null,
   paidAt:row.paidAt||null,periodStartsAt:row.periodStartsAt||null,
   periodEndsAt:row.periodEndsAt||null,
   graceEndsAt:row.graceEndsAt||null,
   autoRenew:false,environment:'staging'};
}
module.exports={canonicalSignature,headersForRequest,verifyWebhookHeaders,
  hostedCheckoutUrl,validateGatewayPayment,localStatusFromGatewayLookup,nextMonthlyPeriod,safeOrderStatus,
  PAYMENT_ID,ORDER_ID,EVENT_ID,WEBHOOK_PATH,GATEWAY_CHECKOUT_PATH,validatePaymentEvent,
  configuredGraceDays,nextGracePeriod};
