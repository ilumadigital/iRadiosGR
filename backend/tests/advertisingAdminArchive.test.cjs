'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');

function testEnvironment(){
 const routes=new Map();
 const history={deleted:false,canceled:0,mutations:0,unresolved:false};
 const campaign={_id:'a'.repeat(24),title:'Test Agency Campaign',
  agencyId:'b'.repeat(24),deletedAt:null,adminSuspended:false,agencyEnabled:true,
  isStageCampaign:true,approvalStatus:'approved'};
 const Campaign={
  async findOne(q){return q._id===campaign._id?campaign:null;},
  async findOneAndUpdate(q,update){
   if(q._id!==campaign._id||campaign.deletedAt!==null)return null;
   Object.assign(campaign,update.$set);history.mutations++;
   return campaign;
  },
  find(q){
   history.listFilter=q;
   return {sort(){return this;},limit(){return this;},async lean(){
    const deleted=q.deletedAt?.$ne===null;
    return (deleted?Boolean(campaign.deletedAt):!campaign.deletedAt)?[campaign]:[];
   }};
  }
 };
 const Intent={async exists(){return history.unresolved;}};
 const Quote={async updateMany(query,patch){
  if(query.campaignId===campaign._id&&patch.$set.status==='canceled')history.canceled++;
 }};
 const FundingLot={find(){return {select(){return this;},async lean(){return [];}}}};
 const express={Router:()=>{const router={};for(const verb of ['get','post','put','patch','delete']){
  router[verb]=(url,handler)=>routes.set(verb.toUpperCase()+' '+url,handler);
 }
 router.use=()=>{};return router;}};
 const mocks={
  express, mongoose:{isValidObjectId:x=>/^[a-f0-9]{24}$/.test(String(x))},
  '../models/AdvertisingCampaign':Campaign,
  '../models/AdvertisingPricing':{},
  '../models/AdvertisingQuote':Quote,
  '../models/AdvertisingPaymentIntent':Intent,
  '../models/AdvertisingFundingLot':FundingLot,
  '../models/BannerAd':{},'../models/Ad':{},'../models/User':{},
  '../services/agencyAdGeoMatch':{},
  '../services/advertisingDeliveryEligibility':{},
  '../services/advertisingStagePaidPreview':{},
  '../services/adAudioDelivery':{},
  '../services/advertisingAutoSubmission':{start(){}},
  '../utils/authMiddleware':{protect(){}},
  '../services/advertisingPricingRules':{DEFAULTS:{},validatePricing(){},quotedAmounts(){}},
  '../services/advertisingPricingStore':{getAdvertisingPricing:async()=>({})},
  '../services/agencyAdGeo':{},'../services/ilumaGatewayClient':{},
  '../services/advertisingFinancialIndexes':{},
  '../services/advertisingBalances':{aggregateBalances:()=>({fundedMicros:0,remainingMicros:0})},
  '../services/advertisingBudgetAffordability':{},
  '../services/advertisingStageQa':{},
  '../services/advertisingCampaignMailScheduler':{start(){}}
 };
 const module={exports:{}};
 vm.runInNewContext(source('backend/routes/advertisingCampaignRoutes.js'),{
  module,exports:module.exports,require:id=>{
   if(id==='node:crypto')return require(id);
   if(!Object.hasOwn(mocks,id))throw Error('Unmocked dependency '+id);
   return mocks[id];
  },
  process:{env:{APP_ENV:'staging'}},Date,String,Number,Set,Map,JSON,console
 },{filename:'advertisingCampaignRoutes.js'});
 function response(){
  return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},
   json(payload){this.body=payload;return this;}};
 }
 async function call(verb,url,user,params={},body={},query={}){
  const h=routes.get(verb+' '+url);
  assert.equal(typeof h,'function','route registered: '+url);
  const res=response();
  await h({user,params,body,query},res);
  return res;
 }
 return {campaign,history,call};
}
const admin={role:'admin',_id:'c'.repeat(24)};
const agency={role:'agency',_id:'b'.repeat(24)};
const route='/admin/advertising/campaigns/:id';

test('Agency cannot delete any campaign, even its own',async()=>{
 const env=testEnvironment();
 const res=await env.call('DELETE',route,agency,{id:env.campaign._id},{
  reason:'Agency delete',confirmTitle:env.campaign.title});
 assert.equal(res.statusCode,403);
 assert.equal(env.campaign.deletedAt,null);
});

test('Admin must confirm exact campaign title and provide an audit reason',async()=>{
 const env=testEnvironment();
 for(const body of [{reason:'',confirmTitle:env.campaign.title},
  {reason:'reason',confirmTitle:'Other Campaign'},
  {reason:'x',confirmTitle:env.campaign.title}]){
  const res=await env.call('DELETE',route,admin,{id:env.campaign._id},body);
  assert.equal(res.statusCode,400);
 }
 assert.equal(env.history.mutations,0);
});

test('Unresolved Nexi checkout stops archival until financial reconciliation',async()=>{
 const env=testEnvironment();
 env.history.unresolved=true;
 const res=await env.call('DELETE',route,admin,{id:env.campaign._id},{
  reason:'Campaign cancelled after review',confirmTitle:env.campaign.title});
 assert.equal(res.statusCode,409);
 assert.match(res.body.error,/πληρωμή/);
 assert.equal(env.campaign.deletedAt,null);
 assert.equal(env.history.canceled,0);
});

test('Admin archival is atomic, repeat-safe, records actor and keeps ledger intact',async()=>{
 const env=testEnvironment();
 const body={reason:'Duplicate campaign created for testing',confirmTitle:env.campaign.title};
 const first=await env.call('DELETE',route,admin,{id:env.campaign._id},body);
 assert.equal(first.statusCode,200);
 assert.equal(first.body.deleted,true);
 assert.equal(first.body.financialHistoryPreserved,true);
 assert.equal(first.body.refundIssued,false);
 assert.ok(env.campaign.deletedAt instanceof Date);
 assert.equal(env.campaign.deletedBy,admin._id);
 assert.equal(env.campaign.deletionReason,body.reason);
 assert.equal(env.campaign.agencyEnabled,false);
 assert.equal(env.campaign.adminSuspended,true);
 assert.equal(env.history.canceled,1);
 assert.equal(env.history.mutations,1);
 const again=await env.call('DELETE',route,admin,{id:env.campaign._id},body);
 assert.equal(again.statusCode,409);
 assert.equal(env.history.mutations,1);
 assert.equal(env.history.canceled,1);
});

test('Admin archive and Agency campaign lists are separated by deletedAt state',async()=>{
 const env=testEnvironment();
 await env.call('DELETE',route,admin,{id:env.campaign._id},{
  reason:'Archive after testing',confirmTitle:env.campaign.title});
 const regular=await env.call('GET','/advertising/campaigns',admin);
 assert.equal(regular.statusCode,200);
 assert.equal(regular.body.length,0);
 assert.equal(env.history.listFilter.deletedAt,null);
 const archive=await env.call('GET','/advertising/campaigns',admin,{},{},{includeDeleted:'1'});
 assert.equal(archive.statusCode,200);
 assert.equal(archive.body.length,1);
 assert.equal(env.history.listFilter.deletedAt.$ne,null);
 const agencyAttempt=await env.call('GET','/advertising/campaigns',agency,{},{},{includeDeleted:'1'});
 assert.equal(agencyAttempt.statusCode,200);
 assert.equal(agencyAttempt.body.length,0);
 assert.equal(env.history.listFilter.agencyId,agency._id);
 assert.equal(env.history.listFilter.deletedAt,null);
});

test('Financial documents are never physically deleted or implicitly refunded',()=>{
 const routes=source('backend/routes/advertisingCampaignRoutes.js');
 const deletion=routes.slice(routes.indexOf("router.delete('/admin/advertising/campaigns/:id'"),
  routes.indexOf('// Read-only financial reconciliation for the Admin.'));
 for(const pattern of [/\.deleteMany\(/,/\.findByIdAndDelete\(/,/\.findOneAndDelete\(/,
  /FundingLot\.update/,/FundingLot\.delete/,/Intent\.delete/,/refundIssued:true/]){
  assert.doesNotMatch(deletion,pattern);
 }
 assert.match(deletion,/deletedAt:new Date\(\),deletedBy:req\.user\._id/);
 assert.match(routes,/router\.get\('\/admin\/advertising\/campaigns\/:id\/reconciliation'/);
 assert.match(source('backend/services/advertisingDeliveryEligibility.js'),/deletedAt:null/);
 const webhook=source('backend/services/advertisingPaymentEvents.js');
 assert.match(webhook,/if\(campaign\.deletedAt\)/);
 assert.match(webhook,/credited:false,duplicate:true,archived:true/);
 assert.match(webhook,/Campaign archived; financial reconciliation required/);
});

test('Archived campaign creatives are excluded from operational inventory',()=>{
 const file=source('backend/services/advertisingArchiveVisibility.js');
 assert.match(file,/deletedAt:\{\$ne:null\}/);
 for(const routeFile of ['backend/routes/agencyRoutes.js',
  'backend/controllers/bannerController.js','backend/controllers/adController.js']){
  assert.match(source(routeFile),/excludeArchivedCampaignCreatives/);
 }
 const ui=source('frontend/src/pages/AdminAdvertisingV2.jsx');
 assert.match(ui,/Αρχείο διαγραμμένων/);
 assert.match(ui,/method:'DELETE'/);
 assert.match(ui,/deleteTitle!==deleteTarget\.title/);
 assert.match(ui,/ΔΕΝ κάνει αυτόματα refund/);
});
