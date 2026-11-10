'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {gatewayPurchase,broadcasterEventValid,safeBroadcasterOrder}=
 require('../services/broadcasterPaymentProtocol');
const base={
 event_id:'a'.repeat(32),event_type:'payment.paid',payment_id:'b'.repeat(32),
 order_id:'IL'+'C'.repeat(24),customer_id:'d'.repeat(32),
 environment:'staging',product_sku:'ADD-DSP',amount_cents:4990,currency:'EUR',
 resource_id:'507f1f77bcf86cd799439011',occurred_at:'2026-11-11T12:00:00.000Z'
};
const now=new Date('2026-11-11T12:01:00Z');
test('signed station addon price and resource must match SKU',()=>{
 assert.equal(broadcasterEventValid(base,base.event_id,now),true);
 for(const patch of [
  {amount_cents:790},{currency:'USD'},{resource_id:'507f191e810c19729de860eaINVALID'},
  {environment:'production'},{product_sku:'ADD-ADS'},{event_id:'f'.repeat(32)},
  {occurred_at:'2030-01-01T00:00:00Z'}]){
  assert.equal(broadcasterEventValid({...base,...patch},base.event_id,now),false);
 }
});
test('account premium forbids station resource and boost forbids MIT origin',()=>{
 const premium={...base,product_sku:'B-PREM',amount_cents:11900,resource_id:null};
 assert.equal(broadcasterEventValid(premium,base.event_id,now),true);
 assert.equal(broadcasterEventValid({...premium,resource_id:base.resource_id},base.event_id,now),false);
 const boost={...base,product_sku:'BOOST-G-MONTH',amount_cents:79900};
 assert.equal(broadcasterEventValid(boost,base.event_id,now),true);
 assert.equal(broadcasterEventValid({...boost,resource_id:null},base.event_id,now),false);
 assert.equal(broadcasterEventValid({...boost,billing_origin:'automatic_renewal',
  external_user_id:'iradios-stage-'+base.resource_id,cycle_due_at:'2026-11-11T12:00:00Z'},
  base.event_id,now),false);
});
test('automated monthly event requires signed user reference and cycle due',()=>{
 const event={...base,billing_origin:'automatic_renewal',
  external_user_id:'iradios-stage-'+base.resource_id,cycle_due_at:'2026-11-11T12:00:00Z'};
 assert.equal(broadcasterEventValid(event,base.event_id,now),true);
 assert.equal(broadcasterEventValid({...event,external_user_id:'victim'},base.event_id,now),false);
 assert.equal(broadcasterEventValid({...event,cycle_due_at:'n/a'},base.event_id,now),false);
});
test('gateway response never activates paid entitlement, even if provider says paid',()=>{
 const payment={payment_id:base.payment_id,order_id:base.order_id,
  status:'paid',amount_cents:11900,currency:'EUR'};
 assert.equal(gatewayPurchase(payment,{sku:'B-PREM'}).status,'paid');
 assert.throws(()=>gatewayPurchase({...payment,amount_cents:399},{sku:'B-PREM'}),
  /gateway_catalog_price_mismatch/);
 assert.throws(()=>gatewayPurchase({...payment,order_id:'IL'+'F'.repeat(24)},
  {sku:'B-PREM',orderId:base.order_id}),/order_reference_mismatch/);
});
test('only Nexi hosted checkout domains can be redirected',()=>{
 const payment={payment_id:base.payment_id,order_id:base.order_id,
  status:'redirect',amount_cents:790,currency:'EUR',
  checkout_url:'https://not-nexi.example/pay'};
 assert.throws(()=>gatewayPurchase(payment,{sku:'ADD-AN'}),/checkout_url_invalid/);
});
test('UI status may be active only for locally paid signed periods',()=>{
 const row={_id:base.resource_id,sku:'B-PREM',scopeType:'account',
  status:'paid',amountCents:11900,periodStartsAt:'2026-11-01T00:00:00Z',
  periodEndsAt:'2026-12-01T00:00:00Z'};
 assert.equal(safeBroadcasterOrder(row,now).status,'active');
 assert.equal(safeBroadcasterOrder({...row,status:'redirect'},now).status,'redirect');
 assert.equal(safeBroadcasterOrder({...row,periodEndsAt:'2026-11-10T00:00:00Z'},now).status,'expired');
});
