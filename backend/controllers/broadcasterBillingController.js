'use strict';
const crypto=require('node:crypto');
const BroadcasterBillingOrder=require('../models/BroadcasterBillingOrder');
const User=require('../models/User');
const Station=require('../models/Station');
const gateway=require('../services/ilumaGatewayClient');
const {getProduct}=require('../config/billingCatalog');
const {validatePurchase,purchasePeriod,isSubscription,isBoost,SUBSCRIPTION_SKUS}=require('../services/broadcasterPurchaseRules');
const {safeBroadcasterOrder}=require('../services/broadcasterPaymentProtocol');
const {paidRenewalPeriod}=require('../services/billingRenewalRules');
const {localStatusFromGatewayLookup}=require('../services/gatewayBillingProtocol');
const {hasAccountRight,hasStationRight}=require('../services/billingEntitlements');
const KEY=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ID=/^[a-f0-9]{24}$/i;
const statusSet=new Set(['creating','pending','redirect','unknown']);
const ready=()=>process.env.APP_ENV==='staging'&&gateway.configured();
const safe=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function requiresBroadcaster(req,res,next){
 res.set('Cache-Control','private, no-store');
 if(!ready())return res.status(503).json({code:'STAGING_ONLY',error:'Οι αγορές Broadcaster δεν είναι διαθέσιμες.'});
 if(req.user?.role!=='broadcaster'||req.user.isVerified!==true)
  return res.status(403).json({error:'Απαιτείται επιβεβαιωμένος Broadcaster.'});
 next();
}
async function ownedApprovedStation(user,stationId){
 if(!ID.test(String(stationId||'')))return null;
 return Station.findOne({_id:stationId,broadcasterId:user._id,status:'approved'})
  .select('_id name status').lean();
}
function display(row){return safeBroadcasterOrder(row);}
async function checkout(req,res){
 const payload=req.body||{};
 if(!payload||Array.isArray(payload)||typeof payload!=='object'||
  Object.keys(payload).some(k=>!['sku','stationId','autoRenew'].includes(k)))
  return res.status(400).json({code:'INVALID_CHECKOUT',error:'Μη έγκυρα στοιχεία αγοράς.'});
 const {sku,stationId=null,autoRenew}=payload;
 const product=getProduct(sku);
 const problem=validatePurchase({sku,stationId,autoRenew});
 if(problem)return res.status(400).json({code:problem,error:
   problem==='SUBSCRIPTION_CONSENT_REQUIRED'?'Απαιτείται ρητή αποδοχή επαναλαμβανόμενης μηνιαίας συνδρομής.':
   problem==='BOOST_CANNOT_RECUR'?'Το Boost είναι εφάπαξ αγορά με επιλεγμένη διάρκεια.':
   'Μη έγκυρο προϊόν ή σταθμός.'});
 if(product.scopeType==='station'&&!await ownedApprovedStation(req.user,stationId))
  return res.status(403).json({code:'STATION_NOT_OWNED',error:'Ο εγκεκριμένος σταθμός πρέπει να σου ανήκει.'});
 const key=req.get('Idempotency-Key')||'';
 if(!KEY.test(key))return res.status(400).json({error:'Έγκυρο Idempotency-Key UUID απαιτείται.'});
 const account=String(req.user._id);
 const scopeId=product.scopeType==='station'?String(stationId):'account';
 const requestKey='iradios-bstage-'+account+'-'+key;
 const lockKey=account+':'+sku+':'+scopeId;
 let existing=await BroadcasterBillingOrder.findOne({requestKey}).lean();
 if(existing){
  if(String(existing.accountId)!==account||existing.sku!==sku||
    String(existing.resourceId||'account')!==scopeId||
    Boolean(existing.autoRenewRequested)!==Boolean(autoRenew))
   return res.status(409).json({error:'Idempotency conflict'});
  return res.json({order:display(existing),alreadyProcessed:true});
 }
 existing=await BroadcasterBillingOrder.findOne({lockKey}).lean();
 if(existing)return res.json({order:display(existing),alreadyProcessed:true});
 if(isSubscription(sku)){
  if(sku==='B-PREM'?
    await hasAccountRight(req.user,'broadcaster.unlimited_stations'):
    await hasStationRight(req.user,{_id:stationId,broadcasterId:req.user._id},
      {'ADD-DSP':'broadcaster.webdsp','ADD-AN':'broadcaster.analytics',
       'ADD-ADS':'broadcaster.ad_control'}[sku]))
   return res.status(409).json({code:'ALREADY_ENTITLED',
     error:'Αυτό το Pro Feature είναι ήδη ενεργό. Δεν δημιουργήθηκε χρέωση.'});
  const current=await gateway.broadcasterRecurringStatus(req.user,sku,
   product.scopeType==='station'?stationId:null);
  if(current.state==='unavailable')
   return res.status(503).json({code:'GATEWAY_RECURRING_UNAVAILABLE',
     error:'Η μηνιαία συνδρομή δεν είναι ακόμη διαθέσιμη στο Gateway.'});
  if(['pending','active','verification_pending','past_due'].includes(current.state))
   return res.status(409).json({code:'RECURRING_ALREADY_ENROLLED',
     error:'Υπάρχει ενεργή ή εκκρεμής συνδρομή για αυτό το προϊόν.'});
 }
 await BroadcasterBillingOrder.init();
 try{
  existing=await BroadcasterBillingOrder.create({
   accountId:req.user._id,resourceId:product.scopeType==='station'?stationId:null,
   scopeType:product.scopeType,sku,amountCents:product.priceCents,
   requestKey,lockKey,status:'creating',autoRenewRequested:isSubscription(sku)
  });
 }catch(error){
  if(error.code!==11000)throw error;
  const found=await BroadcasterBillingOrder.findOne({$or:[{requestKey},{lockKey}]}).lean();
  return found?res.json({order:display(found),alreadyProcessed:true}):
   res.status(503).json({error:'Το αίτημα αγοράς δεν είναι διαθέσιμο.'});
 }
 try{
  const provider=await gateway.broadcasterCheckout({
   user:req.user,requestKey,sku,stationId:scopeId==='account'?null:stationId,
   autoRenew:isSubscription(sku)
  });
  // Never treat a checkout response as proof of paid entitlement.
  const status=['failed','canceled','redirect','unknown'].includes(provider.status)?
   provider.status:'pending';
  const change={$set:{status,providerStatus:provider.status,
   gatewayPaymentId:provider.payment_id,gatewayOrderId:provider.order_id,
   checkoutUrl:provider.checkout_url,gatewayLastCheckedAt:new Date()}};
  if(['failed','canceled'].includes(status))change.$unset={lockKey:''};
  const updated=await BroadcasterBillingOrder.findOneAndUpdate({_id:existing._id,status:'creating'},
   change,{new:true});
  return res.status(201).json({order:display(updated||existing)});
 }catch(error){
  // Gateway 422 is a deterministic preflight error BEFORE creating Nexi HPP.
  if(error.code==='GATEWAY_HTTP_422'){
   const failed=await BroadcasterBillingOrder.findOneAndUpdate({_id:existing._id,status:'creating'},{
    $set:{status:'failed',lastErrorCode:'GATEWAY_CATALOG_OR_MIT_NOT_READY'},
    $unset:{lockKey:''}
   },{new:true});
   return res.status(503).json({code:'GATEWAY_BROADCASTER_NOT_READY',
    error:'Το Gateway δεν είναι έτοιμο για αυτή τη συναλλαγή. Δεν έγινε χρέωση.',
    order:display(failed||existing)});
  }
  const uncertain=await BroadcasterBillingOrder.findOneAndUpdate({_id:existing._id,status:'creating'},{
   $set:{status:'unknown',lastErrorCode:'GATEWAY_CHECKOUT_UNCONFIRMED'}
  },{new:true});
  console.warn('[BROADCASTER BILLING] Checkout requires signed read-only reconciliation',
   error.code||'network');
  return res.status(202).json({order:display(uncertain||existing),
   note:'Άγνωστη κατάσταση. Δεν έγινε δεύτερη προσπάθεια χρέωσης.'});
 }
}
async function listOrders(req,res){
 const orders=await BroadcasterBillingOrder.find({
  accountId:req.user._id,environment:'staging'
 }).sort({createdAt:-1}).limit(60).lean();
 return res.json({orders:orders.map(display),environment:'staging'});
}
async function readOrder(req,res){
 if(!ID.test(req.params.id))return res.status(400).json({error:'Invalid order ID'});
 let order=await BroadcasterBillingOrder.findOne({
  _id:req.params.id,accountId:req.user._id,environment:'staging'
 }).lean();
 if(!order)return res.status(404).json({error:'Η συναλλαγή δεν βρέθηκε.'});
 if(req.query.refresh==='1'&&statusSet.has(order.status)&&
    (!order.gatewayLastCheckedAt||
     Date.now()-new Date(order.gatewayLastCheckedAt).getTime()>20000)){
  try{
   const provider=order.gatewayPaymentId?
    await gateway.broadcasterPaymentStatus(order.gatewayPaymentId,order.gatewayOrderId,order.sku):
    await gateway.broadcasterPaymentByRequestKey(order.requestKey,order.sku);
   const status=localStatusFromGatewayLookup(provider.status);
   const patch={$set:{status,providerStatus:provider.status,
    gatewayPaymentId:provider.payment_id,gatewayOrderId:provider.order_id,
    checkoutUrl:provider.checkout_url,gatewayLastCheckedAt:new Date()}};
   if(['failed','canceled'].includes(status))patch.$unset={lockKey:''};
   const updated=await BroadcasterBillingOrder.findOneAndUpdate({
    _id:order._id,status:{$in:[...statusSet]}
   },patch,{new:true});if(updated)order=updated;
  }catch(error){
   const age=Date.now()-new Date(order.createdAt).getTime();
   // Only a known signed 404 for an intent with NO Gateway IDs can
   // conclude that HPP was never created. All other outcomes stay locked.
   if(error.code==='GATEWAY_HTTP_404'&&age>120000&&
       !order.gatewayOrderId&&!order.gatewayPaymentId){
    const failed=await BroadcasterBillingOrder.findOneAndUpdate({
     _id:order._id,status:{$in:['creating','unknown','pending']},
     gatewayOrderId:{$exists:false},gatewayPaymentId:{$exists:false}
    },{$set:{status:'failed',lastErrorCode:'GATEWAY_PAYMENT_NOT_CREATED'},
     $unset:{lockKey:''}},{new:true});if(failed)order=failed;
   }else if(order.status==='creating'&&age>60000){
    const unknown=await BroadcasterBillingOrder.findOneAndUpdate({
     _id:order._id,status:'creating'
    },{$set:{status:'unknown',lastErrorCode:'GATEWAY_CHECKOUT_UNCONFIRMED'}},{new:true});
    if(unknown)order=unknown;
   }
  }
 }
 return res.json({order:display(order)});
}
async function recurringStatus(req,res){
 const {sku,stationId=null}=req.query;
 if(!SUBSCRIPTION_SKUS.includes(sku))
  return res.status(400).json({error:'Invalid subscription SKU'});
 const p=getProduct(sku);
 if(p.scopeType==='station'&&!await ownedApprovedStation(req.user,stationId))
  return res.status(403).json({error:'Station not owned'});
 if(p.scopeType==='account'&&stationId!==null)
  return res.status(400).json({error:'Account plan has no station'});
 const recurring=await gateway.broadcasterRecurringStatus(req.user,sku,stationId);
 return res.json({recurring});
}
async function cancel(req,res){
 const {sku,stationId=null}=req.body||{};
 if(Object.keys(req.body||{}).some(k=>!['sku','stationId'].includes(k))||
    !SUBSCRIPTION_SKUS.includes(sku))
  return res.status(400).json({error:'Invalid cancellation input'});
 const p=getProduct(sku);
 if(p.scopeType==='station'&&!await ownedApprovedStation(req.user,stationId))
  return res.status(403).json({error:'Station not owned'});
 if(p.scopeType==='account'&&stationId!==null)
  return res.status(400).json({error:'Account plan has no station'});
 const recurring=await gateway.cancelBroadcasterRecurring(req.user,sku,stationId);
 // Cancellation stops future MIT. Already-paid period remains until expiry.
 return res.json({recurring,paidPeriodContinuesUntilExpiry:true});
}
async function premiumBoostSelection(req,res){
 const user=await User.findById(req.user._id)
  .select('broadcasterProfile.premiumBoostStationIds').lean();
 const owned=await Station.find({broadcasterId:req.user._id,status:'approved'})
  .select('_id name').lean();
 const ids=new Set(owned.map(s=>String(s._id)));
 const selected=(user?.broadcasterProfile?.premiumBoostStationIds||[])
  .map(String).filter(id=>ids.has(id));
 return res.json({selected,stations:owned.map(s=>({id:String(s._id),name:s.name})),
  active:await hasAccountRight(req.user,'broadcaster.premium_boost')});
}
async function savePremiumBoostSelection(req,res){
 if(!await hasAccountRight(req.user,'broadcaster.premium_boost'))
  return res.status(403).json({code:'PREMIUM_REQUIRED',
   error:'Απαιτείται ενεργό Broadcaster Premium.'});
 const body=req.body||{},stationIds=body.stationIds;
 if(Object.keys(body).some(k=>k!=='stationIds')||
  !Array.isArray(stationIds)||stationIds.length>1000||
  stationIds.some(id=>typeof id!=='string'||!ID.test(id)))
  return res.status(400).json({error:'Invalid Premium Boost selection'});
 const selected=[...new Set(stationIds.map(x=>x.toLowerCase()))];
 const count=await Station.countDocuments({_id:{$in:selected},
  broadcasterId:req.user._id,status:'approved'});
 if(count!==selected.length)
  return res.status(403).json({error:'A selected station is not an approved owned station'});
 await User.updateOne({_id:req.user._id,role:'broadcaster'},
  {$set:{'broadcasterProfile.premiumBoostStationIds':selected}});
 return res.json({selected,active:true});
}
async function handleVerifiedEvent(event,res){
 const sku=event.product_sku,product=getProduct(sku);
 const onRenewal=event.billing_origin==='automatic_renewal';
 const now=new Date();
 if(onRenewal){
  const userId=event.external_user_id.slice('iradios-stage-'.length);
  const user=await User.findById(userId).select('_id role isVerified').lean();
  if(!user||user.role!=='broadcaster'||user.isVerified!==true)
   return res.status(422).json({error:'Broadcaster account missing'});
  const resourceId=product.scopeType==='station'?event.resource_id:null;
  if(resourceId&&!await ownedApprovedStation(user,resourceId))
   return res.status(422).json({error:'Station ownership mismatch'});
  const prior=await BroadcasterBillingOrder.findOne({
   accountId:user._id,sku,resourceId,scopeType:product.scopeType,
   status:'paid',environment:'staging',
   $or:[{autoRenewRequested:true},{billingOrigin:'automatic_renewal'}]
  }).sort({periodEndsAt:-1}).lean();
  if(!prior)return res.status(503).json({error:'Recurring enrollment pending'});
  if(event.event_type!=='payment.paid')
   return res.json({received:true,activated:false,reason:'unsuccessful_renewal'});
  const confirmedAt=new Date(Math.min(Date.parse(event.occurred_at),now.getTime()));
  const periodStart=paidRenewalPeriod(confirmedAt,prior.periodEndsAt);
  const {end}=purchasePeriod(sku,periodStart);
  const updated=await BroadcasterBillingOrder.findOneAndUpdate({
   gatewayPaymentId:event.payment_id
  },{$setOnInsert:{
   accountId:user._id,resourceId,scopeType:product.scopeType,sku,
   environment:'staging',amountCents:product.priceCents,currency:'EUR',
   requestKey:'iradios-bstage-'+userId+'-mit-'+event.payment_id,
   billingOrigin:'automatic_renewal',autoRenewRequested:true,
   renewalOfOrderId:prior._id,gatewayPaymentId:event.payment_id,
   gatewayOrderId:event.order_id,status:'paid',providerStatus:'paid',
   paidAt:confirmedAt,periodStartsAt:periodStart,periodEndsAt:end,
   eventIds:[event.event_id],
   eventLog:[{id:event.event_id,type:event.event_type,at:now}]
  }},{upsert:true,new:true,setDefaultsOnInsert:true});
  if(String(updated.accountId)!==String(user._id)||updated.sku!==sku||
    String(updated.resourceId||'')!==String(resourceId||'')||
    updated.gatewayOrderId!==event.order_id)
   return res.status(409).json({error:'MIT correlation conflict'});
  return res.json({received:true,activated:true});
 }
 const query={gatewayPaymentId:event.payment_id,gatewayOrderId:event.order_id,
  environment:'staging',sku,amountCents:event.amount_cents,
  resourceId:product.scopeType==='account'?null:undefined};
 // Boost webhooks have no signed station resource; correlate by both immutable
 // provider IDs AND immutable SKU/amount to the pre-created local order.
 if(product.scopeType==='station')delete query.resourceId;
 const order=await BroadcasterBillingOrder.findOne(query).lean();
 if(!order)return res.status(503).json({error:'Broadcaster checkout correlation pending'});
 if(product.kind==='subscription'&&
    String(order.resourceId||'')!==String(event.resource_id||''))
  return res.status(422).json({error:'Signed resource mismatch'});
 if((order.eventIds||[]).includes(event.event_id))
  return res.json({received:true,duplicate:true});
 const isPaid=event.event_type==='payment.paid';
 const confirmedAt=new Date(Math.min(Date.parse(event.occurred_at),now.getTime()));
 let periodStart=confirmedAt;
 if(isPaid&&order.renewalOfOrderId){
  const previous=await BroadcasterBillingOrder.findOne({
   _id:order.renewalOfOrderId,accountId:order.accountId,
   sku,status:'paid',environment:'staging'
  }).select('periodEndsAt').lean();
  periodStart=paidRenewalPeriod(confirmedAt,previous?.periodEndsAt);
 }
 const {end}=purchasePeriod(sku,periodStart);
 const filter={_id:order._id,gatewayPaymentId:event.payment_id,
  gatewayOrderId:event.order_id,eventIds:{$ne:event.event_id}};
 const marker={id:event.event_id,type:event.event_type,at:now};
 if(isPaid){
  const updated=await BroadcasterBillingOrder.findOneAndUpdate({
   ...filter,status:{$ne:'paid'}
  },{$set:{status:'paid',providerStatus:'paid',paidAt:confirmedAt,
     periodStartsAt:periodStart,periodEndsAt:end},
     $unset:{lockKey:''},$addToSet:{eventIds:event.event_id},
     $push:{eventLog:marker}},{new:true});
  if(updated)return res.json({received:true,activated:true});
 }else{
  const next=event.event_type.slice('payment.'.length);
  const updated=await BroadcasterBillingOrder.findOneAndUpdate({
   ...filter,status:{$nin:['paid','failed','canceled']}
  },{$set:{status:next,providerStatus:next},$unset:{lockKey:''},
    $addToSet:{eventIds:event.event_id},$push:{eventLog:marker}},{new:true});
  if(updated)return res.json({received:true,activated:false});
 }
 await BroadcasterBillingOrder.findOneAndUpdate(filter,{
  $addToSet:{eventIds:event.event_id},$push:{eventLog:marker}
 });
 return res.json({received:true,activated:false});
}
module.exports={requiresBroadcaster,checkout:safe(checkout),
 listOrders:safe(listOrders),readOrder:safe(readOrder),
 recurringStatus:safe(recurringStatus),cancel:safe(cancel),
 premiumBoostSelection:safe(premiumBoostSelection),
 savePremiumBoostSelection:safe(savePremiumBoostSelection),handleVerifiedEvent};
