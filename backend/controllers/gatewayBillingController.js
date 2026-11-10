'use strict';
const BillingOrder=require('../models/BillingOrder');
const GatewayWebhookNonce=require('../models/GatewayWebhookNonce');
const gateway=require('../services/ilumaGatewayClient');
const {hasAccountRight}=require('../services/billingEntitlements');
const {verifyWebhookHeaders,validateGatewayPayment,nextMonthlyPeriod,safeOrderStatus,
 validatePaymentEvent}=require('../services/gatewayBillingProtocol');

const safe=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const CLIENT_KEY=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const permitted=()=>process.env.APP_ENV==='staging'&&gateway.configured();
const accountId=req=>String(req.user?._id||'');
const display=row=>safeOrderStatus(row);

async function checkout(req,res){
 if(!permitted())return res.status(503).json({code:'SANDBOX_DISABLED',error:'Το Nexi Sandbox δεν έχει ενεργοποιηθεί.'});
 if(!req.user||req.user.role!=='user'||req.user.isVerified!==true)
  return res.status(403).json({error:'Απαιτείται επιβεβαιωμένος λογαριασμός ακροατή.'});
 const clientKey=req.get('Idempotency-Key')||'';
 if(!CLIENT_KEY.test(clientKey))
  return res.status(400).json({error:'Απαιτείται έγκυρο Idempotency-Key UUID.'});
 if(req.body && Object.keys(req.body).length>0)
  return res.status(400).json({error:'Το ποσό και το προϊόν ορίζονται από τον server.'});
 if(await hasAccountRight(req.user,'listener.premium'))
  return res.status(409).json({code:'ALREADY_PREMIUM',error:'Έχεις ήδη ενεργό Listener Premium.'});
 const requestKey='iradios-stage-'+accountId(req)+'-'+clientKey;
 let order=await BillingOrder.findOne({requestKey}).lean();
 if(order){
  if(String(order.accountId)!==accountId(req))return res.status(409).json({error:'Idempotency conflict'});
  return res.status(200).json({order:display(order),alreadyProcessed:true});
 }
 const lockKey=accountId(req)+':L-PREM';
 order=await BillingOrder.findOne({lockKey}).lean();
 if(order)return res.status(200).json({order:display(order),alreadyProcessed:true});
 // Wait for unique indexes before accepting any financial intent.
 await BillingOrder.init();
 try{
  order=await BillingOrder.create({accountId:req.user._id,sku:'L-PREM',
    requestKey,lockKey,amountCents:399,currency:'EUR',status:'creating'});
 }catch(error){
  if(error.code!==11000)throw error;
  const found=await BillingOrder.findOne({$or:[{requestKey},{lockKey}]}).lean();
  if(!found)return res.status(503).json({error:'Η συναλλαγή δεν είναι διαθέσιμη.'});
  return res.status(200).json({order:display(found),alreadyProcessed:true});
 }

 // Exactly ONE outgoing checkout for this local intent. A timeout is UNKNOWN.
 // Never create a different provider order or reuse a new idempotency key.
 try{
  const returned=await gateway.checkout({user:req.user,requestKey});
  const status=['failed','canceled','redirect','unknown'].includes(returned.status)?
    returned.status:'pending'; // Never credit a "paid" checkout response.
  const update={$set:{
    gatewayPaymentId:returned.payment_id,gatewayOrderId:returned.order_id,
    checkoutUrl:returned.checkout_url,status,providerStatus:returned.status,
    gatewayLastCheckedAt:new Date()
  }};
  if(['failed','canceled'].includes(status))update.$unset={lockKey:''};
  const updated=await BillingOrder.findOneAndUpdate({_id:order._id,status:'creating'},
    update,{new:true});
  return res.status(201).json({order:display(updated||order)});
 }catch(error){
  if(error.code==='GATEWAY_HTTP_422'){
   await BillingOrder.findOneAndUpdate({_id:order._id,status:'creating'},{
     $set:{status:'failed',lastErrorCode:'GATEWAY_CATALOG_NOT_READY'},
     $unset:{lockKey:''}
   });
   return res.status(503).json({code:'GATEWAY_CATALOG_NOT_READY',
     error:'Το προϊόν L-PREM πρέπει να ενεργοποιηθεί στο Nexi Sandbox Gateway με τιμή 3,99 €.'});
  }
  // Gateway or network uncertainty does not mean the customer was NOT charged.
  // Keep the lock and the original Idempotency-Key. Do not retry automatically.
  console.warn('[BILLING] Sandbox checkout requires reconciliation',error.code||error.name||'network');
  const updated=await BillingOrder.findOneAndUpdate({_id:order._id,status:'creating'},
    {$set:{status:'unknown',lastErrorCode:'CHECKOUT_UNCONFIRMED'}},{new:true});
  return res.status(202).json({order:display(updated||order),
    note:'Η κατάσταση είναι άγνωστη. Δεν επιχειρήθηκε δεύτερη χρέωση.'});
 }
}

async function listOwnOrders(req,res){
 const rows=await BillingOrder.find({accountId:req.user._id,sku:'L-PREM'})
  .sort({createdAt:-1}).limit(20).lean();
 return res.json({orders:rows.map(display),renewalEnabled:false});
}

async function readOrder(req,res){
 if(!/^[a-f0-9]{24}$/i.test(req.params.id))
  return res.status(400).json({error:'Μη έγκυρο ID συναλλαγής.'});
 let row=await BillingOrder.findOne({_id:req.params.id,accountId:req.user._id}).lean();
 if(!row)return res.status(404).json({error:'Η συναλλαγή δεν βρέθηκε.'});
 // Refresh is READ-ONLY at Nexi. Never unlock Premium from a browser refresh.
 if(req.query.refresh==='1' && ['pending','redirect','unknown'].includes(row.status) &&
    row.gatewayPaymentId && (!row.gatewayLastCheckedAt||
    Date.now()-new Date(row.gatewayLastCheckedAt).getTime()>20000) && permitted()){
  try{
   const status=await gateway.paymentStatus(row.gatewayPaymentId,row.gatewayOrderId);
   const update=await BillingOrder.findOneAndUpdate({
    _id:row._id,accountId:req.user._id,status:{$in:['pending','redirect','unknown']}
   },{$set:{providerStatus:status.status,gatewayLastCheckedAt:new Date(),
    ...(status.status==='redirect'?{checkoutUrl:status.checkout_url}:{})}},{new:true});
   if(update)row=update;
  }catch(error){
   console.warn('[BILLING] Read-only reconciliation unavailable',error.code||error.name);
  }
 }
 return res.json({order:display(row),renewalEnabled:false});
}

async function listAdminOrders(req,res){
 const limit=Math.max(1,Math.min(100,Number.parseInt(req.query.limit,10)||50));
 const rows=await BillingOrder.find({environment:'staging'}).sort({createdAt:-1})
  .limit(limit).populate('accountId','email username').lean();
 return res.json({orders:rows.map(row=>({
  ...display(row),
  account:{id:String(row.accountId?._id||row.accountId||''),
    email:row.accountId?.email||'',username:row.accountId?.username||''},
  gatewayPaymentId:row.gatewayPaymentId||null,gatewayOrderId:row.gatewayOrderId||null,
  createdAt:row.createdAt,events:(row.eventLog||[]).map(e=>({
   id:e.id,type:e.type,at:e.at
  }))
 })),environment:'staging',autoRenew:false});
}

async function webhook(req,res){
 if(process.env.APP_ENV!=='staging')
  return res.status(503).json({error:'Staging webhook only'});
 const raw=req.body;
 const verified=verifyWebhookHeaders({
  secret:process.env.ILUMA_GATEWAY_STAGING_SECRET,headers:req.headers,rawBody:raw
 });
 if(!verified.valid)return res.status(401).json({error:'Invalid webhook signature'});
 let event;
 try{event=JSON.parse(raw.toString('utf8'));}catch{return res.status(400).json({error:'Invalid JSON'});}
 if(!validatePaymentEvent(event,verified.eventId))
  return res.status(422).json({error:'Invalid payment event'});
 await GatewayWebhookNonce.init();
 try{await GatewayWebhookNonce.create({nonce:verified.nonce});}
 catch(error){if(error.code===11000)return res.status(409).json({error:'Webhook nonce replay'});throw error;}
 const lookup={gatewayPaymentId:event.payment_id,gatewayOrderId:event.order_id,
  amountCents:399,currency:'EUR',sku:'L-PREM',environment:'staging'};
 const order=await BillingOrder.findOne(lookup).select('_id status eventIds').lean();
 if(!order){
  // A webhook can race the initial gateway response. Retry with a NEW signed
  // nonce after checkout has written the external IDs.
  return res.status(503).json({error:'Payment correlation pending'});
 }
 if((order.eventIds||[]).includes(event.event_id))
  return res.json({received:true,duplicate:true});
 const now=new Date();
 const marker={id:event.event_id,type:event.event_type,at:now};
 const isPaid=event.event_type==='payment.paid';
 const nextStatus=event.event_type.substring('payment.'.length);
 const filter={...lookup,_id:order._id,eventIds:{$ne:event.event_id}};
 // Apply initial activation and event id to ONE document in ONE atomic write.
 // This avoids any MongoDB replica-set transaction requirement.
 if(isPaid){
  const updated=await BillingOrder.findOneAndUpdate({...filter,status:{$ne:'paid'}},{
   $set:{status:'paid',providerStatus:'paid',paidAt:now,periodStartsAt:now,
    periodEndsAt:nextMonthlyPeriod(now)},
   $unset:{lockKey:''},
   $addToSet:{eventIds:event.event_id},
   $push:{eventLog:marker}
  },{new:true});
  if(updated)return res.json({received:true,activated:true});
 }else{
  const updated=await BillingOrder.findOneAndUpdate({...filter,
    status:{$nin:['paid','failed','canceled']}},{
    $set:{status:nextStatus,providerStatus:nextStatus},
    $unset:{lockKey:''},
    $addToSet:{eventIds:event.event_id},
    $push:{eventLog:marker}
  },{new:true});
  if(updated)return res.json({received:true,activated:false});
 }
 // Duplicates, reordered terminal events or a second paid event do not
 // reactivate/extend a subscription. Audit the authenticated event only.
 await BillingOrder.findOneAndUpdate(filter,{
   $addToSet:{eventIds:event.event_id},$push:{eventLog:marker}
 });
 return res.json({received:true,activated:false});
}

module.exports={checkout:safe(checkout),listOwnOrders:safe(listOwnOrders),
 listAdminOrders:safe(listAdminOrders),
 readOrder:safe(readOrder),webhook:safe(webhook)};
