'use strict';
// Destructive database operations allowed ONLY against the isolated CI database.
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const crypto=require('node:crypto');
const Campaign=require('../models/AdvertisingCampaign');
const FundingLot=require('../models/AdvertisingFundingLot');
const Daily=require('../models/AdvertisingDailyBudget');
const Ticket=require('../models/AdvertisingV2Reservation');
const Event=require('../models/AdvertisingV2Event');
const ledger=require('../services/advertisingV2Ledger');
const policy=require('../services/advertisingV2Policy');
const uri=process.env.AD_V2_DISPOSABLE_MONGODB_URI;
if(process.env.APP_ENV!=='staging'||process.env.CI!=='true'||
   process.env.AD_V2_DISPOSABLE_APPROVAL!=='I_CONFIRMED_TEST_ONLY_DATABASE'||
   !uri||!uri.includes('ad_v2_disposable_ci_20261115')||
   process.env.ADVERTISING_V2_FINANCIAL_DELIVERY_ENABLED!=='1')
 throw Error('Disposable database approval missing, no test DB operations allowed');
const h=crypto.randomBytes(12).toString('hex');
const key=crypto.randomBytes(32).toString('hex');
const now=Date.now();
const snapshot={audio:policy.AUDIO_RATE_CARD,visual:policy.VISUAL_IMPRESSION_NANOS};
async function createFixture(dailyBudgetCents=2000){
 const id=new mongoose.Types.ObjectId();
 const campaign=await Campaign.create({
  _id:id,agencyId:new mongoose.Types.ObjectId(),title:'Disposable campaign',
  brand:'Test brand',startsAt:new Date(now-86400000),endsAt:new Date(now+86400000),
  plannedBudgetCents:100000,dailyBudgetCents,workflowVersion:2,
  createdByRole:'agency',approvalStatus:'approved',isStageCampaign:true
 });
 await FundingLot.create({
  agencyId:campaign.agencyId,campaignId:campaign._id,
  quoteId:new mongoose.Types.ObjectId(),gatewayPaymentId:'test-paid-'+h+'-'+id,
  gatewayOrderId:'test-order-'+id,
  budgetMicros:1_000_000_000,remainingMicros:1_000_000_000,
  budgetNanos:1_000_000_000_000,remainingNanos:1_000_000_000_000,
  rateModel:'v2_event',rateCardSnapshot:snapshot,
  priceVersion:2,ratesMicros:{standard:4_000_000,hero:8_000_000,audio:12_000_000},
  settlementMode:'mongo_transaction_v2',currency:'EUR',
  source:'nexi_verified',paidAt:new Date()
 });
 return {campaign,creative:{_id:new mongoose.Types.ObjectId()}};
}
async function ticket(f,kind='audio',placement='entry',durationMs=46000){
 return ledger.reserve({...f,kind,placement,durationMs:kind==='audio'?durationMs:0,clientKey:key});
}
async function observe(capability,report){
 return ledger.observe({value:capability,key,report});
}
async function main(){
 await mongoose.connect(uri,{serverSelectionTimeoutMS:5000});
 try{
  assert.equal(ledger.enabled(),true);
  const f=await createFixture(2000);
  const first=await ticket(f);
  let lot=await FundingLot.findOne({campaignId:f.campaign._id}).lean();
  assert.equal(lot.reservedNanos,1_810_000_000);
  assert.equal(lot.remainingNanos,1_000_000_000_000);
  const access=await Ticket.findById(first.id);
  access.lastHeartbeatAt=new Date(Date.now()-11000);
  access.positionMs=0;
  await access.save();
  const ten=await observe(first.capability,{positionMs:11000,
   playing:true,foreground:true,seeking:false,muted:false});
  assert.equal(ten.qualified,true);
  const duplicate=await observe(first.capability,{positionMs:11000,
   playing:true,foreground:true,seeking:false,muted:false});
  assert.equal(duplicate.charged,false);
  const cta=await ledger.click({value:first.capability,key});
  assert.equal(cta.charged,true);
  const ctaDuplicate=await ledger.click({value:first.capability,key});
  assert.equal(ctaDuplicate.duplicate,true);
  await Ticket.updateOne({_id:first.id},{$set:{
   lastHeartbeatAt:new Date(Date.now()-36000)}});
  const complete=await observe(first.capability,{positionMs:46000,
   playing:true,foreground:true,seeking:false,muted:false});
  assert.equal(complete.completed,true);
  await ledger.release({value:first.capability,key});
  await ledger.release({value:first.capability,key}).catch(()=>{});
  const daily=await Daily.findOne({campaignId:f.campaign._id});
  assert.equal(daily.spentNanos,1_810_000_000);
  assert.equal(daily.reservedNanos,0);
  const events=await Event.find({campaignId:f.campaign._id}).lean();
  assert.deepEqual(events.map(x=>x.name).sort(),['complete','cta','listen10']);
  lot=await FundingLot.findOne({campaignId:f.campaign._id}).lean();
  assert.equal(lot.remainingNanos,1_000_000_000_000-1_810_000_000);
  assert.equal(lot.reservedNanos,0);
  // Concurrent tickets for a EUR 2 daily cap cannot overspend even if the
  // wallet has EUR 1,000: only one EUR 1.81 worst-case hold is possible.
  const f2=await createFixture(200);
  const competing=await Promise.allSettled(Array.from({length:8},()=>
   ticket(f2)));
  const admitted=competing.filter(x=>x.status==='fulfilled').map(x=>x.value);
  assert.equal(admitted.length,1,'No overbooking of daily cap');
  let d2=await Daily.findOne({campaignId:f2.campaign._id});
  assert.ok(d2.spentNanos+d2.reservedNanos<=2_000_000_000);
  await ledger.release({value:admitted[0].capability,key,reason:'skipped'});
  d2=await Daily.findOne({campaignId:f2.campaign._id});
  assert.equal(d2.spentNanos,0);
  assert.equal(d2.reservedNanos,0);
  const again=await ticket(f2);
  await ledger.closeTicket(again.id,'expired');
  assert.equal((await Daily.findOne({campaignId:f2.campaign._id})).reservedNanos,0);
  const v=await createFixture(200);
  const visual=await ticket(v,'visual','hero');
  let result=await observe(visual.capability,{ratio:0.7,foreground:true});
  assert.equal(result.qualified,false);
  await new Promise(resolve=>setTimeout(resolve,350));
  result=await observe(visual.capability,{ratio:0.7,foreground:true});
  assert.equal(result.qualified,true);
  assert.equal((await ledger.click({value:visual.capability,key})).charged,false);
  await ledger.release({value:visual.capability,key});
  const visualEvents=await Event.find({campaignId:v.campaign._id}).lean();
  assert.equal(visualEvents.find(x=>x.name==='impression').costNanos,8_000_000);
  assert.equal(visualEvents.find(x=>x.name==='click').costNanos,0);
  console.log('V2 disposable Mongo: signed unique events, concurrency, 300ms, prepaid/daily caps, release passed');
 }finally{
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
