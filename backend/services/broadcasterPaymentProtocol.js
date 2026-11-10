'use strict';
const {getProduct}=require('../config/billingCatalog');
const {BILLING_SKUS,isSubscription,validatedAnchoredCycle}=require('./broadcasterPurchaseRules');
const {hostedCheckoutUrl}=require('./gatewayBillingProtocol');
const {PAYMENT_ID,ORDER_ID,EVENT_ID}=require('./gatewayBillingProtocol');
const HEX24=/^[a-f0-9]{24}$/;
function gatewayPurchase(payment,{sku,paymentId=null,orderId=null}){
 const expected=getProduct(sku);
 if(!BILLING_SKUS.includes(sku)||!expected)throw Error('invalid_product');
 if(!payment||typeof payment!=='object'||Array.isArray(payment)||
   !PAYMENT_ID.test(payment.payment_id||'')||!ORDER_ID.test(payment.order_id||''))
  throw Error('invalid_gateway_purchase');
 if(paymentId&&payment.payment_id!==paymentId)throw Error('payment_reference_mismatch');
 if(orderId&&payment.order_id!==orderId)throw Error('order_reference_mismatch');
 if(payment.amount_cents!==expected.priceCents||payment.currency!=='EUR')
  throw Error('gateway_catalog_price_mismatch');
 if(!['pending','redirect','unknown','paid','failed','canceled'].includes(payment.status))
  throw Error('gateway_purchase_status_invalid');
 const url=payment.status==='redirect'?hostedCheckoutUrl(payment.checkout_url):null;
 if(payment.status==='redirect'&&!url)throw Error('gateway_checkout_url_invalid');
 return {...payment,checkout_url:url};
}
function broadcasterEventValid(event,eventId,now=new Date()){
 if(!event||typeof event!=='object'||Array.isArray(event)||
  !EVENT_ID.test(eventId||'')||event.event_id!==eventId||
  !PAYMENT_ID.test(event.payment_id||'')||!ORDER_ID.test(event.order_id||'')||
  !['payment.paid','payment.failed','payment.canceled'].includes(event.event_type)||
  event.environment!=='staging'||event.currency!=='EUR'||
  typeof event.customer_id!=='string'||event.customer_id.length<1||event.customer_id.length>190)
  return false;
 const p=getProduct(event.product_sku);
 if(!p||!BILLING_SKUS.includes(event.product_sku)||p.priceCents!==event.amount_cents)
  return false;
 if(isSubscription(event.product_sku)){
  if(event.product_sku==='B-PREM'){
   if(event.resource_id!==null)return false;
  }else if(typeof event.resource_id!=='string'||!HEX24.test(event.resource_id))return false;
 }else if(typeof event.resource_id!=='string'||!HEX24.test(event.resource_id))return false;
 if(event.billing_origin!==undefined){
  if(event.billing_origin!=='automatic_renewal'||!isSubscription(event.product_sku)||
   !/^iradios-stage-[a-f0-9]{24}$/.test(event.external_user_id||''))
    return false;
  try{validatedAnchoredCycle(event,now);}catch{return false;}
 }
 const occurred=Date.parse(event.occurred_at);
 return Number.isFinite(occurred)&&occurred>Date.UTC(2020,0,1)
  &&occurred<=now.getTime()+300000;
}
function safeBroadcasterOrder(order,now=new Date()){
 const s=order.periodStartsAt&&new Date(order.periodStartsAt)>now?'scheduled':
  order.status==='paid'&&order.periodEndsAt&&new Date(order.periodEndsAt)>now?'active':
  order.status==='paid'?'expired':order.status;
 return {id:String(order._id),sku:order.sku,stationId:order.resourceId||null,
  scopeType:order.scopeType,status:s,currency:'EUR',amountCents:order.amountCents,
  environment:'staging',gatewayOrderId:order.gatewayOrderId||null,
  checkoutUrl:s==='redirect'?hostedCheckoutUrl(order.checkoutUrl):null,
  autoRenewRequested:order.autoRenewRequested===true,
  paidAt:order.paidAt||null,periodStartsAt:order.periodStartsAt||null,
  periodEndsAt:order.periodEndsAt||null,billingOrigin:order.billingOrigin||'checkout',
  lastErrorCode:order.lastErrorCode||null};
}
module.exports={gatewayPurchase,broadcasterEventValid,safeBroadcasterOrder};
