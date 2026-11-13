'use strict';
const mongoose=require('mongoose');
const Campaign=require('../models/AdvertisingCampaign');
const Quote=require('../models/AdvertisingQuote');
const Intent=require('../models/AdvertisingPaymentIntent');
const FundingLot=require('../models/AdvertisingFundingLot');
const {budgetMicros}=require('./advertisingPricingRules');
const PAYMENT=/^[a-f0-9]{32}$/;
const ORDER=/^IL[A-F0-9]{24}$/;
const USER=/^iradios-stage-[a-f0-9]{24}$/;
function validAdvertisingEvent(e,headerEventId,now=new Date()){
 if(!e||typeof e!=='object'||Array.isArray(e))return false;
 if(e.event_id!==headerEventId||!PAYMENT.test(e.event_id||'')||
    !PAYMENT.test(e.payment_id||'')||!ORDER.test(e.order_id||'')||
    !USER.test(e.external_user_id||''))return false;
 if(e.product_sku!=='ADV-BUDGET'||e.environment!=='staging'||
    !['payment.paid','payment.failed','payment.canceled'].includes(e.event_type)||
    !Number.isSafeInteger(e.amount_cents)||e.amount_cents<100||
    e.amount_cents>100000000||e.currency!=='EUR')return false;
 if(!mongoose.isValidObjectId(e.campaign_id)||
    !mongoose.isValidObjectId(e.quote_id)||
    typeof e.customer_id!=='string'||e.customer_id.length<1||
    e.customer_id.length>190)return false;
 const at=Date.parse(e.occurred_at);
 return Number.isFinite(at)&&at>Date.UTC(2020,0,1)&&at<=now.getTime()+300000;
}
async function handleVerifiedAdvertisingEvent(event,res){
 await Promise.all([Intent.init(),FundingLot.init()]);
 const accountId=event.external_user_id.slice('iradios-stage-'.length);
 const intent=await Intent.findOne({
   agencyId:accountId,campaignId:event.campaign_id,quoteId:event.quote_id,
   gatewayPaymentId:event.payment_id,gatewayOrderId:event.order_id,
   amountCents:event.amount_cents,currency:'EUR'
 });
 if(!intent){
  // Gateway event may arrive before the checkout HTTP response. Returning 503
  // keeps the signed outbox retrying rather than issuing an unverified credit.
  return res.status(503).json({error:'Advertising payment correlation pending'});
 }
 const [quote,campaign]=await Promise.all([
  Quote.findOne({_id:intent.quoteId,agencyId:accountId,campaignId:intent.campaignId,
   paymentCents:event.amount_cents,currency:'EUR'}),
  Campaign.findOne({_id:intent.campaignId,agencyId:accountId,isStageCampaign:true,
   deletedAt:null})
 ]);
 if(!quote||!campaign)return res.status(409).json({error:'Quote/owner mismatch'});
 if(event.event_type!=='payment.paid'){
  if(intent.status==='paid')return res.json({received:true,paid:true,ignored:true});
  const next=event.event_type.split('.')[1];
  await Intent.updateOne({_id:intent._id,status:{$ne:'paid'}},
   {$set:{status:next},$addToSet:{eventIds:event.event_id}});
  await Quote.updateOne({_id:quote._id,status:{$ne:'paid'}},{$set:{status:'canceled'}});
  return res.json({received:true,paid:false});
 }
 // A financial credit is a UNIQUE funding lot, not an increment on a mutable
 // campaign budget counter. Duplicate paid events can never increase budget.
 const expected={
  agencyId:String(accountId),campaignId:String(campaign._id),quoteId:String(quote._id),
  gatewayPaymentId:event.payment_id,gatewayOrderId:event.order_id,
  budgetMicros:budgetMicros(quote.budgetCents),priceVersion:quote.priceVersion
 };
 const paidAt=new Date(Math.min(Date.parse(event.occurred_at),Date.now()));
 let lot=await FundingLot.findOne({gatewayPaymentId:event.payment_id});
 if(!lot){
  try{
   lot=await FundingLot.create({
    agencyId:accountId,campaignId:campaign._id,quoteId:quote._id,
    gatewayPaymentId:event.payment_id,gatewayOrderId:event.order_id,
    budgetMicros:expected.budgetMicros,remainingMicros:expected.budgetMicros,
    priceVersion:quote.priceVersion,ratesMicros:quote.ratesMicros,
    currency:'EUR',source:'nexi_verified',paidAt
   });
  }catch(error){
   if(error.code!==11000)throw error;
   lot=await FundingLot.findOne({$or:[
    {gatewayPaymentId:event.payment_id},{quoteId:quote._id}
   ]});
  }
 }
 if(!lot||String(lot.agencyId)!==expected.agencyId||
    String(lot.campaignId)!==expected.campaignId||
    String(lot.quoteId)!==expected.quoteId||
    lot.gatewayPaymentId!==expected.gatewayPaymentId||
    lot.gatewayOrderId!==expected.gatewayOrderId||
    lot.budgetMicros!==expected.budgetMicros||
    lot.priceVersion!==expected.priceVersion)
  return res.status(409).json({error:'Advertising funding collision'});
 await Intent.updateOne({_id:intent._id},{$set:{status:'paid',paidAt},
  $addToSet:{eventIds:event.event_id}});
 await Quote.updateOne({_id:quote._id},{$set:{status:'paid'}});
 // Only request approval. Creative and campaign delivery remain disabled until
 // an admin approves a fully configured campaign.
 await Campaign.updateOne({_id:campaign._id,approvalStatus:'draft'},
  {$set:{approvalStatus:'pending'}});
 return res.json({received:true,credited:true,duplicate:!!lot.createdAt&&
  String(lot._id)!==''});
}
module.exports={validAdvertisingEvent,handleVerifiedAdvertisingEvent};
