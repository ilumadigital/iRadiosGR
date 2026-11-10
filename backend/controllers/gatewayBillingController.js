'use strict';
const BillingOrder=require('../models/BillingOrder');
const GatewayWebhookNonce=require('../models/GatewayWebhookNonce');
const BillingRenewalSnooze=require('../models/BillingRenewalSnooze');
const {DAY_MS,paidRenewalState,paidRenewalPeriod}=require('../services/billingRenewalRules');
const gateway=require('../services/ilumaGatewayClient');
const {ensureBillingIndexes}=require('../services/billingIndexReadiness');
const {hasAccountRight}=require('../services/billingEntitlements');
const {verifyWebhookHeaders,validateGatewayPayment,nextMonthlyPeriod,safeOrderStatus,
 validatePaymentEvent,localStatusFromGatewayLookup,nextGracePeriod}=require('../services/gatewayBillingProtocol');

const safe=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const CLIENT_KEY=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const permitted=()=>process.env.APP_ENV==='staging'&&gateway.configured();
const accountId=req=>String(req.user?._id||'');
const display=row=>safeOrderStatus(row);

// The latest VERIFIED paid period is the only authority for a manual renewal
// prompt. An unresolved checkout is never bypassed with another payment.
async function currentRenewal(user,now=new Date()){
 if(!user||user.role!=='user')return null;
 const prior=await BillingOrder.findOne({
  accountId:user._id,sku:'L-PREM',environment:'staging',status:'paid'
 }).sort({paidAt:-1,createdAt:-1}).lean();
 const notice=paidRenewalState(prior,now);
 if(!notice)return null;
 const inFlight=await BillingOrder.exists({
  accountId:user._id,sku:'L-PREM',lockKey:String(user._id)+':L-PREM'
 });
 if(inFlight)return null;
 // Don't request a renewal after expiry if complimentary/manual rights or a
 // separate paid period are still active for this same listener.
 if(notice.kind==='expired' && await hasAccountRight(user,'listener.premium'))
  return null;
 return notice;
}
async function renewalNotice(req,res){
 if(req.user?.role!=='user')return res.json({notice:null,renewal:null});
 const renewal=await currentRenewal(req.user);
 if(!renewal)return res.json({notice:null,renewal:null});
 const snoozed=await BillingRenewalSnooze.findOne({
  accountId:req.user._id,orderId:renewal.cycleId,
  snoozedUntil:{$gt:new Date()}
 }).lean();
 return res.json({notice:snoozed?null:renewal,renewal});
}
async function snoozeRenewalNotice(req,res){
 if(req.user?.role!=='user')return res.status(403).json({error:'Listener account required'});
 if(req.body&&Object.keys(req.body).length>0)
  return res.status(400).json({error:'No input is required'});
 const renewal=await currentRenewal(req.user);
 if(!renewal)return res.status(409).json({error:'No renewal reminder is due'});
 await BillingRenewalSnooze.init();
 const until=new Date(Date.now()+DAY_MS);
 await BillingRenewalSnooze.findOneAndUpdate({
  accountId:req.user._id,orderId:renewal.cycleId
 },{$set:{snoozedUntil:until}},{new:true,upsert:true});
 return res.json({snoozedUntil:until.toISOString(),cycleId:renewal.cycleId});
}

async function checkout(req,res){
 if(!permitted())return res.status(503).json({code:'SANDBOX_DISABLED',error:'Το Nexi Sandbox δεν έχει ενεργοποιηθεί.'});
 if(!req.user||req.user.role!=='user'||req.user.isVerified!==true)
  return res.status(403).json({error:'Απαιτείται επιβεβαιωμένος λογαριασμός ακροατή.'});
 const clientKey=req.get('Idempotency-Key')||'';
 if(!CLIENT_KEY.test(clientKey))
  return res.status(400).json({error:'Απαιτείται έγκυρο Idempotency-Key UUID.'});
 const options=req.body||{};
 const fields=Object.keys(options);
 if(fields.some(k=>!['saveCard','useSavedCard'].includes(k))||
    (options.saveCard!==undefined&&typeof options.saveCard!=='boolean')||
    (options.useSavedCard!==undefined&&typeof options.useSavedCard!=='boolean')||
    (options.saveCard===true&&options.useSavedCard===true))
  return res.status(400).json({error:'Μη έγκυρες επιλογές αποθήκευσης κάρτας.'});
 // No opt-in is the default. The user controls each OneClick choice and
 // cannot trigger a MIT or automatic renewal via this endpoint.
 const cardChoice={saveCard:options.saveCard===true,useSavedCard:options.useSavedCard===true};
 const requestKey='iradios-stage-'+accountId(req)+'-'+clientKey;
 let order=await BillingOrder.findOne({requestKey}).lean();
 if(order){
  if(String(order.accountId)!==accountId(req))return res.status(409).json({error:'Idempotency conflict'});
  return res.status(200).json({order:display(order),alreadyProcessed:true});
 }
 const lockKey=accountId(req)+':L-PREM';
 order=await BillingOrder.findOne({lockKey}).lean();
 if(order)return res.status(200).json({order:display(order),alreadyProcessed:true});
 // Active premium cannot buy arbitrary overlapping periods. Exception: the
 // last 24 hours of the verified paid cycle (or its explicit grace period).
 const renewal=await currentRenewal(req.user);
 if(await hasAccountRight(req.user,'listener.premium') &&
    !['soon','grace'].includes(renewal?.kind))
  return res.status(409).json({code:'ALREADY_PREMIUM',
   error:'Το Premium είναι ενεργό. Μπορείς να ανανεώσεις μέσα στις τελευταίες 24 ώρες πριν τη λήξη.'});
 const previousPaid=await BillingOrder.findOne({
  accountId:req.user._id,sku:'L-PREM',environment:'staging',status:'paid'
 }).sort({paidAt:-1,createdAt:-1}).select('_id').lean();
 // Require unique indexes before any outbound checkout call.
 await ensureBillingIndexes();
 try{
  order=await BillingOrder.create({accountId:req.user._id,sku:'L-PREM',
    requestKey,lockKey,amountCents:399,currency:'EUR',status:'creating',
    renewalOfOrderId:previousPaid?._id});
 }catch(error){
  if(error.code!==11000)throw error;
  const found=await BillingOrder.findOne({$or:[{requestKey},{lockKey}]}).lean();
  if(!found)return res.status(503).json({error:'Η συναλλαγή δεν είναι διαθέσιμη.'});
  return res.status(200).json({order:display(found),alreadyProcessed:true});
 }

 // Exactly ONE outgoing checkout for this local intent. A timeout is UNKNOWN.
 // Never create a different provider order or reuse a new idempotency key.
 try{
  const returned=await gateway.checkout({user:req.user,requestKey,cardChoice});
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
   // Gateway 422 is emitted only during deterministic validation/preflight
   // BEFORE any Nexi HPP request. No provider payment exists for this key.
   const oneClick=cardChoice.saveCard||cardChoice.useSavedCard;
   const code=oneClick?'GATEWAY_ONECLICK_NOT_READY':'GATEWAY_CATALOG_NOT_READY';
   await BillingOrder.findOneAndUpdate({_id:order._id,status:'creating'},{
     $set:{status:'failed',lastErrorCode:code},
     $unset:{lockKey:''}
   });
   return res.status(503).json({code,error:oneClick
     ?'Η αποθήκευση κάρτας OneClick δεν είναι έτοιμη στο Gateway. Δεν δημιουργήθηκε checkout Nexi. Ελέγξτε τη migration και την κατάσταση της κάρτας πριν ξαναδοκιμάσετε.'
     :'Το προϊόν L-PREM πρέπει να ενεργοποιηθεί στο Nexi Sandbox Gateway με τιμή 3,99 €.'});
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

async function savedCardStatus(req,res){
 if(!permitted())return res.status(503).json({error:'Nexi Sandbox unavailable'});
 if(req.user?.role!=='user')return res.status(403).json({error:'Listener required'});
 const result=await gateway.savedCardStatus(req.user);
 return res.json({paymentMethod:result});
}

async function revokeSavedCard(req,res){
 if(!permitted())return res.status(503).json({error:'Nexi Sandbox unavailable'});
 if(req.user?.role!=='user')return res.status(403).json({error:'Listener required'});
 if(req.body&&Object.keys(req.body).length>0)
  return res.status(400).json({error:'Δεν απαιτούνται στοιχεία κάρτας.'});
 const result=await gateway.revokeSavedCard(req.user);
 return res.json({paymentMethod:result});
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
 // A server-signed, read-only Gateway lookup can recover a lost checkout
 // response using the ORIGINAL idempotency key. It never creates new charges.
 // Even a confirmed GET status=paid cannot grant Premium: only the webhook can.
 if(req.query.refresh==='1' &&
    ['creating','pending','redirect','unknown'].includes(row.status) &&
    (!row.gatewayLastCheckedAt ||
    Date.now()-new Date(row.gatewayLastCheckedAt).getTime()>20000) && permitted()){
  try{
   const provider=row.gatewayPaymentId
    ?await gateway.paymentStatus(row.gatewayPaymentId,row.gatewayOrderId)
    :await gateway.paymentByRequestKey(row.requestKey);
   const localStatus=localStatusFromGatewayLookup(provider.status);
   const change={$set:{
    gatewayPaymentId:provider.payment_id,gatewayOrderId:provider.order_id,
    providerStatus:provider.status,status:localStatus,
    checkoutUrl:provider.status==='redirect'?provider.checkout_url:null,
    gatewayLastCheckedAt:new Date()
   }};
   if(['failed','canceled'].includes(localStatus))change.$unset={lockKey:''};
   const updated=await BillingOrder.findOneAndUpdate({
    _id:row._id,accountId:req.user._id,
    status:{$in:['creating','pending','redirect','unknown']}
   },change,{new:true});
   if(updated)row=updated;
  }catch(error){
   console.warn('[BILLING] Read-only reconciliation unavailable',error.code||error.name||'network');
   const ageMs=Date.now()-new Date(row.createdAt).getTime();
   // Exact, signed Gateway 404 by original request key is conclusive ONLY
   // when we never received any Gateway reference. Gateway commits its
   // payment ledger BEFORE calling Nexi, so absence after 2 minutes proves
   // checkout never reached the provider. Any other HTTP/network error, or
   // a known Gateway order ID, remains locked for financial reconciliation.
   if(error.code==='GATEWAY_HTTP_404' && ageMs>120000 &&
      !row.gatewayPaymentId && !row.gatewayOrderId){
    const failed=await BillingOrder.findOneAndUpdate({
     _id:row._id,accountId:req.user._id,environment:'staging',
     status:{$in:['creating','pending','unknown']},
     gatewayPaymentId:{$exists:false},gatewayOrderId:{$exists:false}
    },{$set:{status:'failed',lastErrorCode:'GATEWAY_PAYMENT_NOT_CREATED'},
       $unset:{lockKey:''}},{new:true});
    if(failed)row=failed;
   }else if(row.status==='creating'&&ageMs>60000){
    const unknown=await BillingOrder.findOneAndUpdate({
     _id:row._id,accountId:req.user._id,status:'creating'
    },{$set:{status:'unknown',lastErrorCode:'CHECKOUT_UNCONFIRMED'}},{new:true});
    if(unknown)row=unknown;
   }
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
 await ensureBillingIndexes();
 try{await GatewayWebhookNonce.create({nonce:verified.nonce});}
 catch(error){if(error.code===11000)return res.status(409).json({error:'Webhook nonce replay'});throw error;}
 const lookup={gatewayPaymentId:event.payment_id,gatewayOrderId:event.order_id,
  amountCents:399,currency:'EUR',sku:'L-PREM',environment:'staging'};
 const order=await BillingOrder.findOne(lookup).select('_id accountId renewalOfOrderId status eventIds').lean();
 if(!order){
  // A webhook can race the initial gateway response. Retry with a NEW signed
  // nonce after checkout has written the external IDs.
  return res.status(503).json({error:'Payment correlation pending'});
 }
 if((order.eventIds||[]).includes(event.event_id))
  return res.json({received:true,duplicate:true});
 const now=new Date();
 // A delayed Gateway worker delivery must NOT extend the purchased period.
 // The event's occurred_at is signed by Gateway. Clamp small clock skew to now.
 const confirmedAt=new Date(Math.min(Date.parse(event.occurred_at),now.getTime()));
 let periodStart=confirmedAt;
 if(event.event_type==='payment.paid'&&order.renewalOfOrderId){
  const previous=await BillingOrder.findOne({
   _id:order.renewalOfOrderId,accountId:order.accountId,
   environment:'staging',sku:'L-PREM',status:'paid'
  }).select('periodEndsAt').lean();
  periodStart=paidRenewalPeriod(confirmedAt,previous?.periodEndsAt);
 }
 const periodEnd=nextMonthlyPeriod(periodStart);
 const marker={id:event.event_id,type:event.event_type,at:now};
 const isPaid=event.event_type==='payment.paid';
 const nextStatus=event.event_type.substring('payment.'.length);
 const filter={...lookup,_id:order._id,eventIds:{$ne:event.event_id}};
 // Apply initial activation and event id to ONE document in ONE atomic write.
 // This avoids any MongoDB replica-set transaction requirement.
 if(isPaid){
  const updated=await BillingOrder.findOneAndUpdate({...filter,status:{$ne:'paid'}},{
   $set:{status:'paid',providerStatus:'paid',paidAt:confirmedAt,periodStartsAt:periodStart,
    periodEndsAt:periodEnd,graceEndsAt:nextGracePeriod(periodEnd)},
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

module.exports={checkout:safe(checkout),savedCardStatus:safe(savedCardStatus),
 revokeSavedCard:safe(revokeSavedCard),renewalNotice:safe(renewalNotice),
 snoozeRenewalNotice:safe(snoozeRenewalNotice),listOwnOrders:safe(listOwnOrders),
 listAdminOrders:safe(listAdminOrders),
 readOrder:safe(readOrder),webhook:safe(webhook)};
