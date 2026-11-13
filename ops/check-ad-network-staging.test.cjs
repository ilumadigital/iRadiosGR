'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const rules=require('../backend/services/adDeliveryRules');
const now=new Date('2026-11-13T12:00:00Z');
test('staging delivery never exposes imported production campaigns',()=>{
  const previous=process.env.APP_ENV;
  try{
    process.env.APP_ENV='staging';
    assert.equal(rules.activeCampaignQuery(now).isStageCreative,true);
    assert.equal(rules.live({status:'active',expiresAt:null},now),false);
    assert.equal(rules.live({status:'active',isStageCreative:true,expiresAt:null},now),true);
    assert.equal(rules.live({status:'pending',isStageCreative:true},now),false);
    assert.equal(rules.live({status:'active',isStageCreative:true,expiresAt:'2026-11-12'},now),false);
    assert.equal(rules.live({status:'active',isStageCreative:true,expiresAt:'2026-11-14'},now),true);
    process.env.APP_ENV='production';
    assert.equal(rules.activeCampaignQuery(now).isStageCreative,undefined);
    assert.equal(rules.live({status:'active',expiresAt:null},now),true);
  }finally{if(previous===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=previous;}
});
test('old audio frequencies are rendered without database mutations',()=>{
  const legacy={_id:'old-id',title:'Imported',frequency:'every_4'};
  const data=rules.publicAd(legacy);
  assert.equal(data.frequency,'every_4_stations');
  assert.equal(legacy.frequency,'every_4');
  assert.equal(rules.publicAd({frequency:'first_station'}).frequency,'entry');
  assert.equal(rules.publicAd({frequency:'every_2'}).frequency,'every_2_stations');
});
test('metrics cannot be double-counted by multiple UI surfaces',()=>{
  const req={ip:'127.0.0.1',get:()=> 'test-user-agent'};
  assert.equal(rules.permitMetric(req,'play','test-ad-id'),true);
  assert.equal(rules.permitMetric(req,'play','test-ad-id'),false);
  assert.equal(rules.permitMetric(req,'click','test-ad-id'),true);
});
test('all five placements are independent and geo uses any matched area',async()=>{
  const {geoAllowsAd,bannerMatchesPlacement,BANNER_PLACEMENTS}=
    await import('../frontend/src/utils/adPlacements.js');
  assert.equal(Object.keys(BANNER_PLACEMENTS).length,5);
  assert.equal(geoAllowsAd(['Θεσσαλονίκη','Αθήνα'],'Αθήνα',(a,b)=>a===b),true);
  assert.equal(geoAllowsAd(['Θεσσαλονίκη'],'Αθήνα',(a,b)=>a===b),false);
  assert.equal(geoAllowsAd(['All'],null,null),true);
  // Only a backend-authorized stage campaign can opt out of browser-side
  // geo re-filtering. Unmarked production/legacy data behaves as before.
  assert.equal(geoAllowsAd(['Αττική'],null,null),false);
  assert.equal(geoAllowsAd(['Αττική'],null,null,true),true);
  assert.equal(geoAllowsAd(['Αττική'],null,null,false),false);
  const b={status:'active',placement:['hero','home'],targetLocations:['All']};
  assert.equal(bannerMatchesPlacement(b,'hero',null,null),true);
  assert.equal(bannerMatchesPlacement(b,'radio_feed',null,null),false);
  assert.equal(bannerMatchesPlacement({...b,status:'pending'},'hero',null,null),false);
});
test('admin authorization, stage-safe clone and history preservation stay wired',()=>{
  const adRoutes=read('backend/routes/adRoutes.js');
  const bannerRoutes=read('backend/routes/bannerRoutes.js');
  const adminRoutes=read('backend/routes/adminRoutes.js');
  const server=read('backend/server.js');
  const app=read('frontend/src/App.jsx');
  const footer=read('frontend/src/components/Footer.jsx');
  const mobile=read('frontend/src/components/MobileMiniPlayer.jsx');
  assert.match(adRoutes,/\/admin\/ads'.*\.\.\.admin/);
  assert.match(bannerRoutes,/\/admin'.*\.\.\.admin/);
  assert.match(adminRoutes,/\/admin\/ads\/:id\/approve'.*\.\.\.admin/);
  assert.match(adRoutes,/clone-stage/);
  assert.match(bannerRoutes,/clone-stage/);
  assert.doesNotMatch(server,/BannerAd\.deleteMany\(\s*\{ expiresAt/);
  assert.doesNotMatch(server,/Ad\.deleteMany\(\s*\{ expiresAt/);
  assert.match(app,/onPlaying=\{\(\) => \{/);
  assert.match(app,/activeAdRef\.current/);
  assert.doesNotMatch(footer,/\/ads\/\$\{currentAdInfo\._id\}\/impression/);
  assert.doesNotMatch(mobile,/\/ads\/\$\{currentAdInfo\._id\}\/impression/);
});
