'use strict';
const QaOrder=require('../models/ProductionQaOrder');
const GatewayWebhookNonce=require('../models/GatewayWebhookNonce');
const {nextMonthlyPeriod,verifyWebhookHeaders}=require('../services/gatewayBillingProtocol');
const qa=require('../services/productionQaGateway');
const CLIENT_UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const WEBHOOK_PATH='/api/gateway/production-qa/webhook';
const safe=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const publicOrder=row=>({
 id:String(row._id),status:row.status,sku:'L-PREM',amountCents:399,
 currency:'EUR',productionCharge:true,
 checkoutUrl:row.status==='redirect'?row.checkoutUrl:null,
 gatewayOrderId:row.gatewayOrderId||null,
 paidAt:row.paidAt||null,periodEndsAt:row.periodEndsAt||null
});
function authorized(req,res){
 if(!qa.allowedUser(req.user)){
  res.status(403).json({code:'PRODUCTION_QA_FORBIDDEN',error:'This real-card QA checkout is not enabled for this staging listener.'});
  return false;
 }
 return true;
}

async function checkout(req,res){
 res.set('Cache-Control','no-store');
 if(!authorized(req,res))return;
 const body=req.body||{};
 const fields=Object.keys(body).sort();
 if(fields.length!==3 || fields.join(',')!=='amountCents,confirmedLiveCharge,productSku' ||
  body.amountCents!==399 || body.productSku!=='L-PREM' || body.confirmedLiveCharge!==true)
  return res.status(400).json({code:'LIVE_CHARGE_CONSENT_REQUIRED',
   error:'Απαιτείται ρητή επιβεβαίωση πραγματικής χρέωσης 3,99 € για L-PREM.'});
 const uuid=req.get('Idempotency-Key')||'';
 if(!CLIENT_UUID.test(uuid))
  return res.status(400).json({error:'Provide an Idempotency-Key UUID v4.'});
 const requestKey='iradios-qa-'+String(req.user._id)+'-'+uuid;
 await QaOrder.createIndexes();
 await GatewayWebhookNonce.createIndexes();
 // A single checkout for this entire staging release. A new browser UUID,
 // repeated request or uncertain network result can NEVER initiate a second
 // production Nexi payment. Financial disputes need manual reconciliation.
 const existing=await QaOrder.findOne({qaRunKey:'iradios-production-qa-single'}).lean();
 if(existing){
  if(String(existing.accountId)===String(req.user._id)&&existing.requestKey===requestKey)
   return res.json({order:publicOrder(existing),alreadyProcessed:true});
  return res.status(409).json({code:'PRODUCTION_QA_ATTEMPT_ALREADY_EXISTS',
   error:'Υπάρχει ήδη μία πραγματική δοκιμαστική πληρωμή. Δεν επιτρέπεται νέα χρέωση.'});
 }
 let order;
 try{
  order=await QaOrder.create({accountId:req.user._id,
   qaRunKey:'iradios-production-qa-single',requestKey,status:'creating'});
 }catch(e){
  if(e.code!==11000)throw e;
  return res.status(409).json({code:'PRODUCTION_QA_ALREADY_RESERVED',
   error:'Η δοκιμή έχει ήδη δεσμευθεί. Καμία δεύτερη χρέωση.'});
 }
 try{
  const payment=await qa.checkout(req.user,requestKey);
  const next=['redirect','pending','unknown','failed','canceled'].includes(payment.status)
   ?payment.status:'pending'; // Browser and GET never grant Premium.
  const updated=await QaOrder.findOneAndUpdate({_id:order._id,status:'creating'},{
   $set:{status:next,gatewayPaymentId:payment.payment_id,
    gatewayOrderId:payment.order_id,checkoutUrl:payment.checkout_url}
  },{new:true});
  return res.status(201).json({order:publicOrder(updated||order)});
 }catch(e){
  // Even HTTP errors are not sufficient proof that Nexi did not create
  // an order. Retain the unique run key; never blindly retry real charges.
  console.warn('[PRODUCTION QA] Checkout unresolved',e.code||e.name||'gateway');
  const updated=await QaOrder.findOneAndUpdate({_id:order._id,status:'creating'},{
   $set:{status:'unknown',lastErrorCode:'PRODUCTION_QA_CHECKOUT_UNCERTAIN'}
  },{new:true});
  return res.status(202).json({order:publicOrder(updated||order),
   note:'Δεν είναι επιβεβαιωμένο εάν δημιουργήθηκε χρέωση. Χρειάζεται έλεγχος της αρχικής συναλλαγής.'});
 }
}
async function status(req,res){
 res.set('Cache-Control','no-store');
 if(!authorized(req,res))return;
 const order=await QaOrder.findOne({qaRunKey:'iradios-production-qa-single',accountId:req.user._id}).lean();
 if(!order)return res.json({order:null});
 // Signed read-only recovery is safe, and deliberately NEVER grants paid
 // rights or creates a second checkout. The verified webhook is authoritative.
 if(req.query.refresh==='1'&&['creating','unknown','pending','redirect'].includes(order.status)){
  try{
   const payment=await qa.byRequestKey(order.requestKey);
   const provider=['pending','redirect','unknown','failed','canceled'].includes(payment.status)
    ?payment.status:'pending';
   const updated=await QaOrder.findOneAndUpdate({_id:order._id,
     status:{$in:['creating','unknown','pending','redirect']}},{
     $set:{status:provider,gatewayPaymentId:payment.payment_id,
      gatewayOrderId:payment.order_id,checkoutUrl:payment.checkout_url}
    },{new:true});
   return res.json({order:publicOrder(updated||order),verifiedPaidByWebhook:false});
  }catch(e){console.warn('[PRODUCTION QA] read-only lookup deferred',e.code||e.name);}
 }
 return res.json({order:publicOrder(order)});
}

async function webhook(req,res){
 res.set('Cache-Control','no-store');
 if(process.env.APP_ENV!=='staging')return res.status(404).json({error:'Not found'});
 const verified=verifyWebhookHeaders({secret:process.env.ILUMA_GATEWAY_PROD_SECRET,
  headers:req.headers,rawBody:req.body,path:WEBHOOK_PATH});
 if(!verified.valid)return res.status(401).json({error:'Invalid production QA signature'});
 let event;
 try{event=JSON.parse(req.body.toString('utf8'));}catch{return res.status(400).json({error:'Invalid JSON'});}
 if(!event||event.qa_mode!==qa.MODE||event.environment!=='production'||
  event.product_sku!=='L-PREM'||event.amount_cents!==399||event.currency!=='EUR'||
  event.event_id!==verified.eventId||!/^[a-f0-9]{32}$/.test(event.event_id||'')||
  !/^[a-f0-9]{32}$/.test(event.payment_id||'')||
  !/^IL[A-F0-9]{24}$/.test(event.order_id||'')||
  !['payment.paid','payment.failed','payment.canceled'].includes(event.event_type)||
  event.external_user_id!=='iradios-qa-'+(process.env.IRADIOS_PROD_QA_LISTENER_ID||'')||
  !/^[a-f0-9]{24}$/.test(process.env.IRADIOS_PROD_QA_LISTENER_ID||'')||
  !Number.isFinite(Date.parse(event.occurred_at))||
  Date.parse(event.occurred_at)>Date.now()+300000||
  Date.parse(event.occurred_at)<Date.UTC(2020,0,1))
  return res.status(422).json({error:'Production QA event scope mismatch'});
 await QaOrder.createIndexes();
 await GatewayWebhookNonce.createIndexes();
 const filter={qaRunKey:'iradios-production-qa-single',
  accountId:process.env.IRADIOS_PROD_QA_LISTENER_ID,
  gatewayPaymentId:event.payment_id,gatewayOrderId:event.order_id};
 const order=await QaOrder.findOne(filter).lean();
 if(!order)return res.status(503).json({error:'Original production QA payment correlation pending'});
 if(order.eventIds?.includes(event.event_id))return res.json({received:true,duplicate:true});
 try{await GatewayWebhookNonce.create({nonce:verified.nonce});}
 catch(e){if(e.code===11000)return res.status(409).json({error:'Webhook nonce replay'});throw e;}
 const now=new Date(),paid=event.event_type==='payment.paid';
 const at=new Date(Math.min(Date.parse(event.occurred_at),now.getTime()));
 const marker={id:event.event_id,type:event.event_type,at:now};
 let update;
 if(paid){
  update=await QaOrder.findOneAndUpdate({...filter,status:{$ne:'paid'},eventIds:{$ne:event.event_id}},{
   $set:{status:'paid',paidAt:at,periodStartsAt:at,periodEndsAt:nextMonthlyPeriod(at)},
   $addToSet:{eventIds:event.event_id},$push:{eventLog:marker}
  },{new:true});
 }else{
  const status=event.event_type.slice('payment.'.length);
  update=await QaOrder.findOneAndUpdate({...filter,
   status:{$nin:['paid','failed','canceled']},eventIds:{$ne:event.event_id}},{
    $set:{status},$addToSet:{eventIds:event.event_id},$push:{eventLog:marker}
   },{new:true});
 }
 if(!update)await QaOrder.updateOne({...filter,eventIds:{$ne:event.event_id}},{
  $addToSet:{eventIds:event.event_id},$push:{eventLog:marker}
 });
 return res.json({received:true,activated:Boolean(update&&paid)});
}
module.exports={checkout:safe(checkout),status:safe(status),webhook:safe(webhook),WEBHOOK_PATH};
