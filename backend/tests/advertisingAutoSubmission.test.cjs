'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../services/advertisingAutoSubmission.js'),'utf8');

function harness({paid=false,env='staging',status='draft'}={}){
 const campaign={_id:'c1',agencyId:'u1',workflowVersion:2,createdByRole:'agency',
  plannedBudgetCents:5000,isStageCampaign:true,deletedAt:null,approvalStatus:status};
 const banners=[{_id:'b1',status:'draft',isActive:false}];
 const audios=[{_id:'a1',status:'draft'}];
 const mails=[];
 let kicks=0;
 const matches=row=>['draft','pending','active'].includes(row.status);
 const collection=rows=>({
  countDocuments:async()=>rows.filter(matches).length,
  updateMany:async(filter,update)=>{
   for(const row of rows)if(row.status===filter.status)Object.assign(row,update.$set);
  }
 });
 const Campaign={
  findOne:async()=>['draft','pending'].includes(campaign.approvalStatus)?campaign:null,
  findOneAndUpdate:async(filter,update)=>{
   if(campaign.approvalStatus!=='draft')return null;
   Object.assign(campaign,update.$set);return {...campaign};
  },
  find:()=>({select:()=>({lean:async()=>[]})})
 };
 const FundingLot={find:()=>({select:()=>({
  lean:async()=>paid?[{source:'nexi_verified',budgetNanos:50000000000}]:[]
 })})};
 const module={exports:{}};
 vm.runInNewContext(source,{
  module,exports:module.exports,process:{env:{APP_ENV:env}},
  require(id){
   const deps={
    '../models/AdvertisingCampaign':Campaign,
    '../models/AdvertisingFundingLot':FundingLot,
    '../models/BannerAd':collection(banners),
    '../models/Ad':collection(audios),
    './advertisingCampaignMailScheduler':{enqueue:async row=>{mails.push(row);}},
    './agencyAdNoticeOutbox':{kick:()=>{kicks++;}},
    './advertisingCpmMath':{budgetCentsToNanos:cents=>cents*10000000}
   };
   if(!(id in deps))throw Error('Unexpected dependency '+id);
   return deps[id];
  },setInterval:()=>({unref(){}}),console
 },{filename:'advertisingAutoSubmission.js'});
 return {service:module.exports,campaign,banners,audios,mails,get kicks(){return kicks;}};
}
test('an unpaid Agency draft cannot enter Admin review',async()=>{
 const h=harness();
 assert.equal((await h.service.submitPaidCampaign('c1')).status,'awaiting_verified_payment');
 assert.equal(h.campaign.approvalStatus,'draft');
 assert.equal(h.banners[0].status,'draft');
 assert.equal(h.mails.length,0);
});
test('verified EUR 50 net funding automatically submits creatives and campaign',async()=>{
 const h=harness({paid:true});
 assert.equal((await h.service.submitPaidCampaign('c1')).status,'submitted');
 assert.equal(h.campaign.approvalStatus,'pending');
 assert.ok(h.campaign.submittedAt);
 assert.equal(h.banners[0].status,'pending');
 assert.equal(h.banners[0].isActive,false);
 assert.equal(h.audios[0].status,'pending');
 assert.equal(h.banners[0].agencyDraftNoticeVersion,1);
 assert.equal(h.mails[0].kind,'paid_pending_review');
 assert.equal(h.mails[0].eventKey,'wizard-paid-submit:c1');
 assert.equal(h.mails[0].amountCents,5000);
 assert.equal(h.kicks,1);
});
test('repeated webhook reconciliation does not reopen approved campaigns',async()=>{
 const h=harness({paid:true});
 await h.service.submitPaidCampaign('c1');
 h.campaign.approvalStatus='approved';
 h.banners[0].status='active';h.banners[0].isActive=true;
 assert.equal((await h.service.submitPaidCampaign('c1')).status,'not_applicable');
 assert.equal(h.campaign.approvalStatus,'approved');
 assert.equal(h.banners[0].status,'active');
 assert.equal(h.mails.length,1);
});
test('auto-submit is not available outside staging',async()=>{
 const h=harness({paid:true,env:'production'});
 assert.equal((await h.service.submitPaidCampaign('c1')).status,'disabled');
 assert.equal(h.campaign.approvalStatus,'draft');
 assert.equal(h.mails.length,0);
});
test('Agency wizard has no separate post-payment submit step',()=>{
 const wizard=fs.readFileSync(path.join(__dirname,'../../frontend/src/pages/AdvertisingCampaignWizard.jsx'),'utf8');
 const webhook=fs.readFileSync(path.join(__dirname,'../services/advertisingPaymentEvents.js'),'utf8');
 assert.doesNotMatch(wizard,/Αποστολή στον Admin για έγκριση/);
 assert.doesNotMatch(wizard,/setStep\(5\)/);
 assert.match(webhook,/await submitPaidCampaign\(campaign\._id\)/);
});
