'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('one render engine offers independent native placements with untracked previews',()=>{
  const src=read('frontend/src/components/DynamicAdCreative.jsx');
  const css=read('frontend/src/styles/dynamic-ad-creative.css');
  for(const kind of ['card','list','hero','strip','news','profile'])
    assert.match(css,new RegExp('ir-dynamic-ad--'+kind));
  assert.match(src,/const Wrapper = preview \? 'div' : AdPlacementLink/);
  assert.match(src,/banner\.squareImageUrl \|\| banner\.imageUrl/);
  assert.match(src,/banner\.ctaLabel/);
  assert.match(read('frontend/src/components/AdPlacementLink.jsx'),/aria-label/);
});
test('Home sections and all catalog surfaces inject independently keyed responsive banners',()=>{
  const home=read('frontend/src/pages/Home.jsx');
  const explore=read('frontend/src/components/HomeExplore.jsx');
  const genre=read('frontend/src/pages/Genre.jsx');
  const region=read('frontend/src/pages/Region.jsx');
  const news=read('frontend/src/pages/NewsFeed.jsx');
  const profile=read('frontend/src/pages/StationProfile.jsx');
  assert.match(home,/homeBanners\.slice\(0,1\)/);
  assert.match(home,/homeBanners\.slice\(1,2\)/);
  assert.match(home,/bannerAds=\{isFreeOrGuest/);
  assert.match(explore,/DynamicAdCreative/);
  for(const source of [genre,region]){
    assert.match(source,/DynamicAdCreative/);
    assert.match(source,/variant=\{viewMode==='grid'\?'card':'list'\}/);
  }
  assert.match(news,/DynamicAdCreative/);
  assert.match(profile,/DynamicAdCreative/);
});
test('Admin and Agency edit campaigns on pages; previews are not real ads',()=>{
  const backoffice=read('frontend/src/pages/Backoffice.jsx');
  const app=read('frontend/src/App.jsx');
  const editor=read('frontend/src/pages/CampaignEditor.jsx');
  assert.match(backoffice,/CampaignEditor/);
  assert.match(backoffice,/\/backoffice\/admin\/.*:id\/edit/);
  assert.match(app,/\/agency\/campaigns\//);
  assert.match(editor,/slotKey="editor-preview" preview/);
  assert.match(editor,/clone-stage/);
  for(const filename of ['AdminAds.jsx','AdminBanners.jsx']){
    const list=read('frontend/src/pages/'+filename);
    assert.doesNotMatch(list,/\{showAddModal && \(|\{isModalOpen && \(/);
  }
  assert.doesNotMatch(read('frontend/src/pages/AgencyDashboard.jsx'),/\{showCreationModal && \(/);
});
test('all structured banner creative fields are accepted by the server and persisted',()=>{
  const model=read('backend/models/BannerAd.js');
  const banner=read('backend/controllers/bannerController.js');
  const agency=read('backend/routes/agencyRoutes.js');
  const ad=read('backend/models/Ad.js');
  for(const field of ['logoUrl','ctaLabel','brandColor','focalX','focalY','targetCountry','targetRegion']){
    assert.ok(model.includes(field),'Banner schema missing '+field);
    assert.ok(banner.includes(field),'Admin banner controller missing '+field);
    assert.ok(agency.includes(field),'Agency payload missing '+field);
  }
  assert.match(ad,/targetCountry/);
  assert.match(ad,/targetRegion/);
  assert.match(banner,/isStageCreative:isStage\(\)/);
});
test('audio player honors latest selection and only logs actually playing spots',()=>{
  const app=read('frontend/src/App.jsx');
  assert.match(app,/selectStationBreak\(ads,clicks,station/);
  assert.match(app,/pendingStation\.current = station; return;/);
  assert.match(app,/onPlaying=\{\(\) => \{/);
  assert.match(app,/ad\.started = true/);
  assert.match(app,/playNextAdOrStation\(\)/);
});
