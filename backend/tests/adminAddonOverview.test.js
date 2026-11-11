'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {ADDONS,describeStationAddons}=require('../services/adminAddonOverview');
const now=new Date('2026-11-11T12:00:00Z');
const station={_id:'507f1f77bcf86cd799439011',name:'Station A',status:'approved'};
const otherStation={_id:'507f1f77bcf86cd799439012',name:'Station B',status:'approved'};
const user={_id:'507f1f77bcf86cd799438001',role:'broadcaster',
 broadcasterProfile:{tier:'free',features:{dspEngine:false,analytics:false,adControl:false}}};
const grant=(sku,resourceId=station._id,extra={})=>({
 _id:'507f1f77bcf86cd799436001',accountId:user._id,
 sku,scopeType:sku==='B-PREM'?'account':'station',
 resourceId:sku==='B-PREM'?null:resourceId,
 source:'admin_complimentary',
 startsAt:new Date('2026-11-01T00:00:00Z'),
 expiresAt:null,revokedAt:null,...extra
});
const order=(sku,resourceId=station._id,extra={})=>({
 sku,accountId:user._id,
 scopeType:sku==='B-PREM'?'account':'station',
 resourceId:sku==='B-PREM'?null:resourceId,
 environment:'staging',status:'paid',
 periodStartsAt:new Date('2026-11-01T00:00:00Z'),
 periodEndsAt:new Date('2026-12-01T00:00:00Z'),...extra
});
const overview=(s=station,grants=[],orders=[],who=user)=>describeStationAddons(who,s,grants,orders,now);
test('Admin addon overview uses the exact 3 scoped subscription SKUs',()=>{
 assert.deepEqual(ADDONS.map(x=>x.sku),['ADD-DSP','ADD-AN','ADD-ADS']);
 assert.deepEqual(ADDONS.map(x=>x.right),[
  'broadcaster.webdsp','broadcaster.analytics','broadcaster.ad_control'
 ]);
});
test('Active station grants unlock only their own resource and feature',()=>{
 const own=overview(station,[grant('ADD-DSP')]);
 assert.equal(own.addons['ADD-DSP'].enabled,true);
 assert.equal(own.addons['ADD-AN'].enabled,false);
 assert.deepEqual(own.addons['ADD-DSP'].sources.map(x=>x.type),['complimentary_addon']);
 assert.equal(overview(otherStation,[grant('ADD-DSP')]).addons['ADD-DSP'].enabled,false);
});
test('Revoked, expired and other-account gifts never show as active',()=>{
 for(const gift of [
  grant('ADD-DSP',station._id,{expiresAt:new Date('2026-11-10T00:00:00Z')}),
  grant('ADD-DSP',station._id,{revokedAt:new Date('2026-11-10T00:00:00Z')}),
  grant('ADD-DSP',station._id,{accountId:'507f1f77bcf86cd799438002'})
 ]){
  const selected=overview(station,[gift]).addons['ADD-DSP'];
  assert.equal(selected.enabled,false);
  assert.deepEqual(selected.sources,[]);
 }
});
test('Verified paid addon is scoped to its purchased station, never another station',()=>{
 const a=overview(station,[],[order('ADD-AN')]);
 assert.equal(a.addons['ADD-AN'].enabled,true);
 assert.equal(a.addons['ADD-DSP'].enabled,false);
 assert.deepEqual(a.addons['ADD-AN'].sources.map(x=>x.type),['paid_addon']);
 assert.equal(overview(otherStation,[],[order('ADD-AN')]).addons['ADD-AN'].enabled,false);
});
test('Failed, out-of-period or production-style paid rows cannot grant access',()=>{
 for(const paid of [
  order('ADD-ADS',station._id,{status:'pending'}),
  order('ADD-ADS',station._id,{environment:'production'}),
  order('ADD-ADS',station._id,{periodEndsAt:new Date('2026-11-10T00:00:00Z')}),
  order('ADD-ADS',station._id,{scopeType:'account',resourceId:null})
 ])assert.equal(overview(station,[],[paid]).addons['ADD-ADS'].enabled,false);
});
test('Paid Broadcaster Premium and gifted account Premium each apply to all owned stations',()=>{
 const paid=overview(otherStation,[],[order('B-PREM')]);
 assert.ok(Object.values(paid.addons).every(x=>x.enabled&&x.sources[0].type==='paid_premium'));
 const gift=overview(otherStation,[grant('B-PREM')]);
 assert.ok(Object.values(gift.addons).every(x=>x.enabled&&x.sources[0].type==='complimentary_premium'));
});
test('Historical broadcaster Premium and feature flags never grant or show paid Addons',()=>{
 const legacy={...user,broadcasterProfile:{
  tier:'premium',features:{dspEngine:true,analytics:true,adControl:true}
 }};
 const before=JSON.stringify(legacy);
 const status=overview(station,[],[],legacy);
 for(const item of Object.values(status.addons)){
  assert.equal(item.enabled,false);
  assert.deepEqual(item.sources,[]);
 }
 assert.equal(JSON.stringify(legacy),before);
});
test('Revoking a free grant cannot imply that a concurrently paid addon disappeared',()=>{
 const paid=order('ADD-DSP'),gift=grant('ADD-DSP');
 const both=overview(station,[gift],[paid]).addons['ADD-DSP'];
 assert.equal(both.enabled,true);
 assert.deepEqual(both.sources.map(x=>x.type),['paid_addon','complimentary_addon']);
 const revoked=overview(station,[{...gift,revokedAt:now}],[paid]).addons['ADD-DSP'];
 assert.equal(revoked.enabled,true);
 assert.deepEqual(revoked.sources.map(x=>x.type),['paid_addon']);
});
