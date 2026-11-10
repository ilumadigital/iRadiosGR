'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluate,WINDOW_MS,PROMO_SKU}=require('../services/winbackEligibility');
const {validateGatewayPayment,validatePaymentEvent}=require('../services/gatewayBillingProtocol');
const end=new Date('2026-11-10T18:20:07.000Z');
const paid={_id:'a'.repeat(24),status:'paid',sku:'L-PREM',periodEndsAt:end};
const now=new Date(+end+WINDOW_MS-1000);
test('One-time winback begins immediately after paid Premium expiry and lasts exactly 30 days',()=>{
 assert.equal(evaluate({lastPaid:paid,now:new Date(+end-1)}).eligible,false);
 const onExpiry=evaluate({lastPaid:paid,now:end});
 assert.equal(onExpiry.eligible,true);
 assert.equal(onExpiry.sku,PROMO_SKU);
 assert.equal(onExpiry.priceCents,199);
 assert.equal(onExpiry.regularPriceCents,399);
 assert.equal(onExpiry.expiredAt,end.toISOString());
 assert.equal(onExpiry.offerEndsAt,new Date(+end+WINDOW_MS).toISOString());
 assert.equal(evaluate({lastPaid:paid,now}).eligible,true);
 assert.equal(evaluate({lastPaid:paid,now:new Date(+end+WINDOW_MS)}).eligible,false);
 assert.equal(evaluate({lastPaid:paid,now:new Date(+end+WINDOW_MS)}).reason,'offer_expired');
});
test('Never offer to Free accounts, unpaid checkout, Premium, redeemed or pending accounts',()=>{
 assert.equal(evaluate({lastPaid:null,now}).eligible,false);
 assert.equal(evaluate({lastPaid:{...paid,status:'redirect'},now}).eligible,false);
 assert.equal(evaluate({lastPaid:paid,hasPremium:true,now}).eligible,false);
 assert.equal(evaluate({lastPaid:paid,used:true,now}).reason,'already_redeemed');
 assert.equal(evaluate({lastPaid:paid,pending:true,now}).reason,'payment_pending');
});
test('Gateway price validation correlates each signed order to its expected amount',()=>{
 const p={payment_id:'0'.repeat(32),order_id:'IL'+'F'.repeat(24),
  amount_cents:199,currency:'EUR',status:'paid'};
 assert.equal(validateGatewayPayment(p,{expectedAmountCents:199}).amount_cents,199);
 assert.throws(()=>validateGatewayPayment(p),'Old 399-cent checkout cannot mask a promo payment');
 assert.throws(()=>validateGatewayPayment({...p,amount_cents:399},{expectedAmountCents:199}),
  'No gateway- or client-side substitution of 399 cents on discounted intent');
});
test('Only signed initial 199-cent events can activate winback, not discounted auto renewals',()=>{
 const event={event_id:'1'.repeat(32),event_type:'payment.paid',
  payment_id:'0'.repeat(32),order_id:'IL'+'F'.repeat(24),
  customer_id:'gateway-opaque',amount_cents:199,currency:'EUR',
  product_sku:'L-WINBACK-199',environment:'staging',
  occurred_at:'2026-11-10T18:20:07.000Z'};
 const stamp=new Date('2026-11-10T18:20:07.000Z');
 assert.equal(validatePaymentEvent(event,event.event_id,stamp),true);
 assert.equal(validatePaymentEvent({...event,product_sku:'L-PREM'},event.event_id,stamp),false);
 assert.equal(validatePaymentEvent({...event,billing_origin:'automatic_renewal',
  external_user_id:'iradios-stage-'+'a'.repeat(24),
  cycle_due_at:stamp.toISOString()},event.event_id,stamp),false);
 assert.equal(validatePaymentEvent({...event,amount_cents:399,product_sku:'L-PREM'},event.event_id,stamp),true);
});
test('Preview and ticker are explicitly stage visual only, with financial code still server-owned',()=>{
 const fs=require('node:fs'),p=require('node:path');
 const root=p.resolve(__dirname,'../..');
 const ticker=fs.readFileSync(p.join(root,'frontend/src/components/WinbackTicker.jsx'),'utf8');
 const premium=fs.readFileSync(p.join(root,'frontend/src/pages/SandboxPremium.jsx'),'utf8');
 const billing=fs.readFileSync(p.join(root,'backend/controllers/gatewayBillingController.js'),'utf8');
 assert.match(ticker,/winback_preview/);
 assert.match(ticker,/\/billing\/me\/winback/);
 assert.match(premium,/winbackNoCharge/);
 assert.match(premium,/winbackNoCharge\|\|/);
 assert.match(billing,/winbackForUser\(req\.user\)/);
 assert.match(billing,/amountCents:winbackRequested\?199:399/);
 assert.match(billing,/winbackExpiredAt:winbackRequested\?winback\.expiredAt:null/);
});
