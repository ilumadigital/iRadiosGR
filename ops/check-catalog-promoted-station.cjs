'use strict';
// Offline checks: unique scoped promotion, snapshot-only Now Playing and compact 70/30 layout.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const id='0123456789abcdef01234567';
let config={stationId:id,enabled:true},approved=true,query;
const Promotion={
  findOne(scope){query=scope;return {select(){return this;},async lean(){return config;}};},
  find(){return {sort(){return this;},async lean(){return [];}};},
  async findOneAndUpdate(){return config;},
  async findByIdAndDelete(){return config;}
};
const Station={
  findOne(){return {select(){return this;},async lean(){return approved?{_id:id}:null;}};},
  async exists(){return approved;}
};
const Playlist={
  findOne(){return {select(){return this;},async lean(){return {id};}};}
};
const original=Module._load;
let controller;
try{
  Module._load=function(name,parent,isMain){
    if(parent?.filename?.endsWith('promotedStationController.js')){
      if(name==='mongoose')return {isValidObjectId:v=>/^[0-9a-f]{24}$/i.test(v)};
      if(name==='../models/PromotedStation')return Promotion;
      if(name==='../models/Station')return Station;
      if(name==='../models/StationPlaylist')return Playlist;
      if(name==='../utils/stageNativeNow')return {snapshotSong:()=>({
        title:'Artist - Song',source:'acrcloud',foundWithAI:true
      })};
    }
    return original.call(this,name,parent,isMain);
  };
  controller=require('../backend/controllers/promotedStationController');
}finally{Module._load=original;}
assert.deepEqual(controller.normalize({placement:'region',placementValue:'Αττική',stationId:id,enabled:true}),{
  placement:'region',placementValue:'Αττική',stationId:id,enabled:true
});
for(const bad of [
  {placement:'home',placementValue:'Αττική',stationId:id,enabled:true},
  {placement:'region',placementValue:'',stationId:id,enabled:true},
  {placement:'genre',placementValue:'A'.repeat(121),stationId:id,enabled:true},
  {placement:'genre',placementValue:'House',stationId:'invalid',enabled:true},
  {placement:'genre',placementValue:'House',stationId:id,enabled:'yes'}
])assert.throws(()=>controller.normalize(bad));

const response=()=>({statusCode:200,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;},
  status(n){this.statusCode=n;return this;},
  json(v){this.body=v;return this;}
});
(async()=>{
  let res=response();
  await controller.publicPromoted({query:{placement:'region',value:'Αττική'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(query.placementValue,'Αττική');
  assert.deepEqual(res.body,{stationId:id},'guest response must be free of native and AI track metadata');
  approved=false;
  res=response();
  await controller.publicPromoted({query:{placement:'region',value:'Αττική'}},res);
  assert.equal(res.body,null,'unapproved radio cannot be publicly promoted');
  approved=true;config=null;
  res=response();
  await controller.publicPromoted({query:{placement:'region',value:'Αττική'}},res);
  assert.equal(res.body,null,'no promotion is not auto-created');
  res=response();
  await controller.publicPromoted({query:{placement:'home',value:'wrong'}},res);
  assert.equal(res.statusCode,400);

  const stage=read('backend/utils/stagePublicAccess.js');
  assert.ok(stage.includes("'/api/promoted-station'"));
  assert.ok(!stage.includes("'/api/admin/promoted-stations'"));
  const route=read('backend/routes/promotedStationRoutes.js');
  assert.ok(route.includes("authorizeRoles('admin')"));
  const hero=read('frontend/src/components/HomeHeroSlider.jsx');
  assert.ok(hero.includes('h-[355px]'),'hero must be height-capped instead of stretched by image ratio');
  assert.ok(!hero.includes('aspect-[40/21]'),'image aspect is independent of the visible slide viewport');
  assert.ok(!hero.includes('max-w-[1200px]'),'hero must fill its 70% grid track');
  assert.ok(hero.includes("new URLSearchParams({placement,value})"));
  const cms=read('frontend/src/pages/AdminHomeSlides.jsx');
  assert.ok(cms.includes('normalizeSlideUpload'));
  assert.ok(cms.includes('canvas.width=1200;canvas.height=630'));
  const editorial=read('frontend/src/components/EditorialPlacement.jsx');
  assert.ok(editorial.includes('<HomeHeroSlider')&&editorial.includes('<PromotedStationCard'));
  assert.ok(editorial.includes('xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]'),
    'desktop genre/region grid must reserve 70 percent for the slider');
  const home=read('frontend/src/pages/Home.jsx');
  assert.ok(home.includes('xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]'),
    'home hero/playlist must share the same 70/30 desktop balance');
  const css=read('frontend/src/styles/design-system.css');
  assert.match(css,/\.ir-home-feature-grid\s*\{\s*height:\s*355px;/,
    'home hero/playlist row must be height-capped at desktop');
  assert.match(css,/\.ir-home-feature-grid \.ir-playlist-panel--compact\s*\{\s*height:\s*100%;\s*max-height:\s*100%;/,
    'compact playlist must never stretch the home grid row');
  const playlist=read('frontend/src/components/StationPlaylistPanel.jsx');
  assert.ok(playlist.includes("min-h-0 divide-y divide-white/5 overflow-y-auto"),
    'playlist entries must scroll inside the capped card');
  const backoffice=read('frontend/src/pages/Backoffice.jsx');
  assert.ok(backoffice.includes("id:'promoted'"),'dedicated Promoted Stations admin tool');
  assert.ok(backoffice.includes("path={'/backoffice/admin/'+section}"),'admin route mapping exists');
  assert.ok(backoffice.includes('promoted:<AdminPromotedStations'),'promoted editor is mounted in admin');
  assert.ok(backoffice.includes("'/backoffice/admin/promoted?station='"),
    'station rows must link directly into their Promoted editor');
  const promotedAdmin=read('frontend/src/components/AdminPromotedStations.jsx');
  assert.ok(promotedAdmin.includes("new URLSearchParams(location.search).get('station')"),
    'station deep links must preselect the correct radio');
  for(const name of ['Region','Genre']){
    const source=read('frontend/src/pages/'+name+'.jsx');
    assert.ok(source.includes('viewMode={viewMode}')&&source.includes('fallbackStation={baseStations[0]}'));
  }
  assert.ok(read('frontend/src/components/PromotedStationCard.jsx').includes('activeStationShow'));
  console.log('Compact 70/30 catalog hero, 1200x630 assets, promoted station backoffice contracts passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
