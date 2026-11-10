'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {
 canonicalSignature,headersForRequest,verifyWebhookHeaders,
 hostedCheckoutUrl,validateGatewayPayment,nextMonthlyPeriod,safeOrderStatus
}=require('../services/gatewayBillingProtocol');
const secret='a'.repeat(64);
const key='ilg_'+'b'.repeat(48);
const now=new Date('2026-11-10T00:00:00.000Z');
const nonce='00112233445566778899aabbccddeeff';
const eventId='abcdefabcdefabcdefabcdefabcdefab';
const payload=JSON.stringify({
 event_id:eventId,event_type:'payment.paid',
 payment_id:'0'.repeat(32),order_id:'IL'+'F'.repeat(24),
 customer_id:'gateway-internal-not-iradios-id',
 amount_cents:399,currency:'EUR',environment:'staging',occurred_at:now.toISOString()
});
function signed(raw=payload){
 const timestamp=String(Math.floor(now.getTime()/1000));
 return {'x-iluma-timestamp':timestamp,'x-iluma-nonce':nonce,
  'x-iluma-event-id':eventId,
  'x-iluma-signature':canonicalSignature(secret,'POST','/api/gateway/webhook',timestamp,nonce,raw)};
}
test('Gateway signature matches independent raw-body SHA256 canonical HMAC',()=>{
 const expected=crypto.createHmac('sha256',secret).update([
  'POST','/api/gateway/webhook',String(Math.floor(now.getTime()/1000)),nonce,
  crypto.createHash('sha256').update(Buffer.from(payload,'utf8')).digest('hex')
 ].join('\n'),'utf8').digest('hex');
 assert.equal(signed()['x-iluma-signature'],expected);
 assert.equal(verifyWebhookHeaders({secret,headers:signed(),rawBody:Buffer.from(payload),now}).valid,true);
});
test('Reject tampered body, altered URL path, wrong key, wrong event header and stale timestamps',()=>{
 const body=Buffer.from(payload,'utf8');
 assert.equal(verifyWebhookHeaders({secret,headers:signed(),rawBody:Buffer.from(payload+' '),now}).valid,false);
 assert.equal(verifyWebhookHeaders({secret:secret+'bad',headers:signed(),rawBody:body,now}).valid,false);
 assert.equal(verifyWebhookHeaders({secret,headers:{...signed(),'x-iluma-event-id':'f'.repeat(32)},rawBody:body,now}).valid,true,
  'The HMAC header is independent of the event ID; payload ID must be separately correlated.');
 assert.equal(verifyWebhookHeaders({secret,headers:signed(),rawBody:body,now:new Date(now.getTime()+301000)}).valid,false);
 const crossPath=canonicalSignature(secret,'POST','/api/gateway/other',
  signed()['x-iluma-timestamp'],nonce,payload);
 assert.equal(verifyWebhookHeaders({secret,headers:{...signed(),'x-iluma-signature':crossPath},rawBody:body,now}).valid,false);
});
test('Checkout signs exact raw body with fresh cryptographically shaped nonce',()=>{
 const headers=headersForRequest({secret,key,method:'POST',path:'/api/v1/payments/checkout',
   rawBody:'{"customer_id":"abc"}',nonce,now});
 assert.equal(headers['X-Iluma-Nonce'],nonce);
 assert.equal(headers['X-Iluma-Signature'],canonicalSignature(secret,'POST',
   '/api/v1/payments/checkout',headers['X-Iluma-Timestamp'],nonce,'{"customer_id":"abc"}'));
 assert.throws(()=>headersForRequest({secret,key:'bad',method:'GET',path:'/',rawBody:'',now}));
});
test('Reject non-Nexi redirects and invalid amount or environment-currency',()=>{
 const valid={payment_id:'0'.repeat(32),order_id:'IL'+'F'.repeat(24),status:'redirect',
  amount_cents:399,currency:'EUR',
  checkout_url:'https://pay.nexigroup.com/hosted/session'};
 assert.equal(validateGatewayPayment(valid).status,'redirect');
 assert.equal(hostedCheckoutUrl('https://pay.nexigroup.com/hosted/session'),
   'https://pay.nexigroup.com/hosted/session');
 for(const u of ['https://nexigroup.com.evil.test/','http://pay.nexigroup.com/',
   'https://user:password@pay.nexigroup.com/','https://pay.nexigroup.com:4430/']){
  assert.equal(hostedCheckoutUrl(u),null);
  assert.throws(()=>validateGatewayPayment({...valid,checkout_url:u}));
 }
 assert.throws(()=>validateGatewayPayment({...valid,amount_cents:398}));
 assert.throws(()=>validateGatewayPayment({...valid,currency:'USD'}));
 assert.throws(()=>validateGatewayPayment({...valid,payment_id:'1'.repeat(32)},{expectedPaymentId:valid.payment_id}));
});
test('Only verified local paid period reports active entitlement, never redirect or unknown',()=>{
 const row={_id:'a'.repeat(24),sku:'L-PREM',amountCents:399,currency:'EUR',
  status:'paid',periodEndsAt:new Date('2026-12-10T00:00:00Z')};
 assert.equal(safeOrderStatus(row,now).status,'active');
 assert.equal(safeOrderStatus(row,new Date('2026-12-11T00:00:00Z')).status,'expired');
 assert.equal(safeOrderStatus({...row,status:'redirect'},now).status,'redirect');
 assert.equal(safeOrderStatus({...row,status:'unknown'},now).autoRenew,false);
});
test('Calendar-month periods do not use a fixed 30-day shortcut',()=>{
 assert.equal(nextMonthlyPeriod('2026-01-31T13:12:30.000Z').toISOString(),'2026-02-28T13:12:30.000Z');
 assert.equal(nextMonthlyPeriod('2028-01-31T00:00:00Z').toISOString(),'2028-02-29T00:00:00.000Z');
 assert.equal(nextMonthlyPeriod('2026-11-10T00:00:00Z').toISOString(),'2026-12-10T00:00:00.000Z');
});
