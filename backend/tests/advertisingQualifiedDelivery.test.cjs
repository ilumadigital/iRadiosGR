'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {issueTicket,sealTicket,verifyTicket,clientFingerprint,
 observation,audioRequiredMs,LIMITS}=require('../services/advertisingQualifiedDelivery');
const {hourlyQuota,fairOrder,tenMinuteBucket}=require('../services/advertisingPacing');
const secret='shadow-qa-secret-with-at-least-thirty-two-characters';
const A='a'.repeat(24),B='b'.repeat(24),visitor='c'.repeat(64);
const t0=1763031000000;
function ticket(kind='visual',tier='standard',durationMs=0){
 return issueTicket({campaignId:A,creativeId:B,kind,tier,
  placement:kind==='audio'?'audio':tier==='hero'?'hero':'home',
  durationMs,clientKey:visitor,now:t0,id:'d'.repeat(32)});
}
function view(state,seq,now,ratio=0.8,foreground=true){
 return observation(state,{seq,ratio,foreground},now);
}
function sound(state,seq,now,positionMs,extra={}){
 return observation(state,{seq,positionMs,foreground:true,playing:true,
  muted:false,volume:1,error:false,streamChanged:false,...extra},now);
}
test('short-lived signed scope cannot be changed, guessed or replayed from another visitor',()=>{
 const t=ticket(),token=sealTicket(t,secret);
 assert.equal(verifyTicket(token,t,visitor,secret,t0+1000),true);
 assert.equal(verifyTicket(token,t,'e'.repeat(64),secret,t0+1000),false);
 assert.equal(verifyTicket(token.replace(/.$/,'0'),t,visitor,secret,t0+1000),false);
 assert.equal(verifyTicket(token,t,visitor,secret,t0+LIMITS.ticketMs+1),false);
 assert.equal(clientFingerprint(secret,'1.2.3.4','ua'),clientFingerprint(secret,'1.2.3.4','ua'));
 assert.notEqual(clientFingerprint(secret,'1.2.3.4','ua'),clientFingerprint(secret,'1.2.3.5','ua'));
 assert.throws(()=>sealTicket(t,'short'),/secret/);
});
test('visual viewable at 50% continuously for one server-timed second; not on fetch',()=>{
 let state=ticket();
 let event=view(state,1,t0+10);
 assert.equal(event.qualified,false);state=event.state;
 event=view(state,2,t0+410);state=event.state;
 assert.equal(state.continuousMs,400);
 event=view(state,3,t0+1110);
 assert.equal(event.qualified,true);
 assert.equal(event.state.status,'qualified');
 assert.equal(event.state._id,state._id);
 assert.equal(observation(event.state,{seq:3,ratio:1,foreground:true},t0+1120).duplicate,true);
});
test('background tab, sub-threshold visibility and heartbeat gaps reset continuity',()=>{
 let s=ticket();
 s=view(s,1,t0+10).state;
 s=view(s,2,t0+710).state;
 assert.equal(s.continuousMs,700);
 s=view(s,3,t0+900,0.49).state;
 assert.equal(s.continuousMs,0);
 s=view(s,4,t0+1000).state;
 s=view(s,5,t0+1500).state;
 assert.equal(s.continuousMs,500);
 s=view(s,6,t0+5000).state;
 assert.equal(s.continuousMs,0);
 s=view(s,7,t0+5500,false).state;
 assert.equal(s.continuousMs,0);
 s=view(s,8,t0+6000,0.75,false).state;
 assert.equal(s.continuousMs,0);
});
test('homepage hero requires two seconds of continuous 50% foreground visibility',()=>{
 let s=ticket('visual','hero');
 s=view(s,1,t0+100).state;
 s=view(s,2,t0+1100).state;
 assert.equal(s.status,'issued');
 s=view(s,3,t0+2100).state;
 assert.equal(s.status,'qualified');
});
test('short audio qualifies from real-time progress at 90%, not from initial media request',()=>{
 assert.equal(audioRequiredMs(20000),18000);
 assert.equal(audioRequiredMs(60000),30000);
 let s=ticket('audio','audio',10000);
 s=sound(s,1,t0,0).state;
 for(let i=1;i<=9;i++)s=sound(s,i+1,t0+i*1000,i*1000).state;
 assert.equal(s.status,'qualified');
 assert.equal(s.continuousMs,9000);
});
test('audio mute, hidden tabs, stream switch and playback errors are not qualified',()=>{
 let s=ticket('audio','audio',40000);
 s=sound(s,1,t0,0).state;
 s=sound(s,2,t0+1000,1000).state;
 s=sound(s,3,t0+2000,2000,{muted:true}).state;
 assert.equal(s.continuousMs,0);
 s=sound(s,4,t0+3000,3000).state;
 s=sound(s,5,t0+4000,4000,{foreground:false}).state;
 assert.equal(s.continuousMs,0);
 s=sound(s,6,t0+5000,5000,{streamChanged:true}).state;
 assert.equal(s.status,'invalid');
 assert.throws(()=>sound(s,7,t0+6000,6000),/unavailable/);
});
test('reject progress fast-forward, impossible initial starts, invalid ratios and out-of-order sequence',()=>{
 let s=ticket('audio','audio',60000);
 assert.throws(()=>sound(s,1,t0+100,1800),/initial/);
 s=sound(s,1,t0,0).state;
 assert.throws(()=>sound(s,2,t0+100,3500),/Impossible audio progress/);
 assert.throws(()=>sound(s,3,t0+100,100),/Out-of-order/);
 assert.throws(()=>view(ticket(),1,t0+500,2),/Invalid visual/);
 assert.throws(()=>view(ticket(),2,t0+500),/Out-of-order/);
});
test('shadow pacing obeys available event budget and keeps fair deterministic rotation',()=>{
 assert.equal(hourlyQuota(0,4000000,new Date(t0+7200000),t0),0);
 assert.equal(hourlyQuota(4000000,4000000,new Date(t0+7200000),t0),1);
 assert.equal(hourlyQuota(40000000,4000000,new Date(t0+7200000),t0),7);
 const pool=[{campaignId:A,used:10,quota:10},
  {campaignId:B,used:0,quota:10},
  {campaignId:'e'.repeat(24),used:1,quota:10}];
 const ranked=fairOrder(pool,visitor,t0);
 assert.equal(ranked.length,2);
 assert.equal(ranked[0].campaignId,B);
 assert.deepEqual(ranked,fairOrder(pool,visitor,t0));
 assert.notEqual(tenMinuteBucket(t0),tenMinuteBucket(t0+600000));
});
test('shadow never changes the financial hard-disable, and endpoint stays Admin-only',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 assert.match(read('services/advertisingDeliveryEligibility.js'),
  /const ATOMIC_SETTLEMENT_IMPLEMENTED=false/);
 const engine=read('services/advertisingQualificationEngine.js');
 assert.match(engine,/AD_QUALIFICATION_SHADOW_ENABLED==='1'/);
 assert.doesNotMatch(engine,/settleQualifiedEvent|atomicDebitWithReceipt|transactionalDebit/);
 const route=read('routes/advertisingQualificationRoutes.js');
 assert.match(route,/req\.user\?\.role==='admin'/);
 assert.match(route,/engine\.enabled\(\)\?next\(\):res\.status\(404\)/);
 const publicGate=read('utils/stagePublicAccess.js');
 assert.doesNotMatch(publicGate,/publicReads.*advertising\/shadow/);
 const model=read('models/AdvertisingQualifiedEvent.js');
 assert.match(model,/billable:\{type:Boolean,default:false,immutable:true\}/);
});
