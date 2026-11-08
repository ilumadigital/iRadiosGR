'use strict';
// Offline checks: unique scoped promotion, snapshot-only Now Playing and 40:21 slides.
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
  assert.deepEqual(res.body,{stationId:id,nowPlaying:{
    title:'Artist - Song',source:'acrcloud',foundWithAI:true
  }});
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
  assert.ok(hero.includes('aspect-[40/21]'));
  assert.ok(hero.includes("new URLSearchParams({placement,value})"));
  const cms=read('frontend/src/pages/AdminHomeSlides.jsx');
  assert.ok(cms.includes('normalizeSlideUpload'));
  assert.ok(cms.includes('canvas.width=1200;canvas.height=630'));
  const editorial=read('frontend/src/components/EditorialPlacement.jsx');
  assert.ok(editorial.includes('<HomeHeroSlider')&&editorial.includes('<PromotedStationCard'));
  for(const name of ['Region','Genre']){
    const source=read('frontend/src/pages/'+name+'.jsx');
    assert.ok(source.includes('viewMode={viewMode}')&&source.includes('fallbackStation={baseStations[0]}'));
  }
  assert.ok(read('frontend/src/components/PromotedStationCard.jsx').includes('activeStationShow'));
  console.log('Catalog 1200x630 hero and curated promoted-station contracts passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
