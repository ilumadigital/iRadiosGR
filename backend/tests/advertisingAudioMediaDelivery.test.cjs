'use strict';
// Offline controller checks: no payment, network, database or media writes.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {validPaidAudioMedia}=require('../services/advertisingPaidAudioMedia');
const AD='a'.repeat(24),CAMPAIGN='b'.repeat(24),OWNER='c'.repeat(24);
const SIGNED='f'.repeat(32)+'.valid';
const today=()=>new Date();
function fixture(){
 const ad={_id:AD,agencyId:OWNER,campaignId:CAMPAIGN,
  status:'active',isStageCreative:true,audioUrl:'/media/audio/owner/spot.mp3'};
 const campaign={_id:CAMPAIGN,agencyId:OWNER,createdByRole:'agency',
  workflowVersion:2,isStageCampaign:true,approvalStatus:'approved',
  agencyEnabled:true,adminSuspended:false,deletedAt:null,
  startsAt:new Date(Date.now()-3600000),endsAt:new Date(Date.now()+3600000)};
 const ticket={_id:'f'.repeat(32),creativeId:AD,campaignId:CAMPAIGN,
  kind:'audio',status:'active'};
 return {ad,campaign,ticket};
}
function controllerScenario({ad,campaign,ticket,authorized=true,geography=true,
 funding=false,send=true}={}){
 const calls={funding:0,media:0};
 const res={statusCode:200,body:null,status(value){this.statusCode=value;return this;},
  json(value){this.body=value;return this;}};
 const mocks={
  '../services/agencyAdGeoMatch':{matchesDeliveryGeo:()=>geography},
  '../services/advertisingDeliveryEligibility':{
   filterFundedCreatives:async a=>a,
   isFundedCreative:async()=>{calls.funding++;return funding;}
  },
  '../services/advertisingArchiveVisibility':{},
  '../models/Ad':{findById:()=>({select:()=>({then:null,
   // controller uses .select(...), without lean(), on this query.
   ...ad})})},
  '../models/User':{},'../models/Station':{},
  '../services/billingEntitlements':{},
  'mongoose':{isValidObjectId:v=>v===AD},
  '../models/AdvertisingCampaign':{findById:()=>({select:()=>({
   lean:async()=>campaign})})},
  '../models/AdvertisingV2Reservation':{findById:()=>({lean:async()=>ticket})},
  '../services/advertisingV2Ledger':{
   enabled:()=>true,clientKey:()=> 'bound-visitor',
   verifyCapability:(cap,value,key)=>authorized&&cap===SIGNED&&value===ticket&&key==='bound-visitor'
  },
  '../services/adAudioDelivery':{
   sendAdAudio:async(response)=>{calls.media++;if(!send)
    response.status(404).json({error:'Audio unavailable'});return send;},
   localAudioFile:async()=>true
  },
  '../services/advertisingPaidAudioMedia':{validPaidAudioMedia},
  '../services/adDeliveryRules':{isStage:()=>true,live:doc=>doc?.status==='active'&&doc.isStageCreative===true,
   activeCampaignQuery:()=>({}),publicAd:doc=>doc,fields:()=>({}),permitMetric:()=>true}
 };
 const exports={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../controllers/adController.js'),'utf8'),
  {exports,require:id=>mocks[id]||require(id),process,console});
 const req={params:{id:AD},query:{ticket:SIGNED}};
 return {run:()=>exports.streamPublicAudio(req,res),req,res,calls};
}
test('fully reserved paid ticket serves media without a second free-wallet test',async()=>{
 const x=controllerScenario({...fixture(),funding:false});
 await x.run();
 assert.equal(x.res.statusCode,200);
 assert.equal(x.calls.media,1);
 assert.equal(x.calls.funding,0);
});
test('missing, forged, mismatched, and closed tickets never stream paid media',async()=>{
 for(const override of [
  {query:{ticket:''}},
  {authorized:false},
  {ticket:{...fixture().ticket,creativeId:'d'.repeat(24)}},
  {ticket:{...fixture().ticket,campaignId:'e'.repeat(24)}},
  {ticket:{...fixture().ticket,status:'closed'}}
 ]){
  const x=controllerScenario({...fixture(),...override});
  if(override.query)x.req.query=override.query;
  await x.run();
  assert.equal(x.res.statusCode,403);
  assert.equal(x.calls.media,0);
  assert.equal(x.calls.funding,0);
 }
});
test('paused, expired, deleted and cross-owner paid campaigns cannot stream',async()=>{
 for(const update of [
  {adminSuspended:true},{approvalStatus:'rejected'}, {deletedAt:new Date()},
  {agencyId:'d'.repeat(24)}, {endsAt:new Date(Date.now()-1000)}
 ]){
  const prior=fixture();
  const x=controllerScenario({...prior,campaign:{...prior.campaign,...update}});
  await x.run();
  assert.equal(x.res.statusCode,403);
  assert.equal(x.calls.media,0);
 }
});
test('creative geography fails closed even with a previously valid ticket',async()=>{
 const x=controllerScenario({...fixture(),geography:false});
 await x.run();assert.equal(x.res.statusCode,404);assert.equal(x.calls.media,0);
});
test('Admin/nonbillable spots retain their separate campaign eligibility gate',async()=>{
 const f=fixture();f.campaign.createdByRole='admin';
 const rejected=controllerScenario({...f,funding:false});
 await rejected.run();assert.equal(rejected.res.statusCode,404);
 assert.equal(rejected.calls.funding,1);assert.equal(rejected.calls.media,0);
 const allowed=controllerScenario({...f,funding:true});
 await allowed.run();assert.equal(allowed.res.statusCode,200);
 assert.equal(allowed.calls.funding,1);assert.equal(allowed.calls.media,1);
});
test('missing local media is still a 404 and never becomes a free fallback',async()=>{
 const x=controllerScenario({...fixture(),send:false});
 await x.run();
 assert.equal(x.res.statusCode,404);
 assert.equal(x.res.body.error,'Audio unavailable');
});
