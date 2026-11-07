'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Module=require('node:module');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

let lastFilter=null,lastLimit=0;
const mockedSlides={
  find(filter){lastFilter=filter;return {
    select(){return this;},
    sort(){return this;},
    limit(n){lastLimit=n;return this;},
    async lean(){return [];}
  }; }
};
const originalLoad=Module._load;
let controller;
try{
  Module._load=function(name,parent,isMain){
    if(parent?.filename?.endsWith('homeSlideController.js')){
      if(name==='mongoose')return {isValidObjectId:id=>/^[0-9a-f]{24}$/i.test(id)};
      if(name==='../models/HomeSlide')return mockedSlides;
      if(name==='../models/Station')return {exists:async()=>true};
    }
    return originalLoad.call(this,name,parent,isMain);
  };
  controller=require('../backend/controllers/homeSlideController.js');
}finally{Module._load=originalLoad;}

const valid={
  title:'Επιλογή για σένα',imageUrl:'https://example.com/editorial.webp',
  targetType:'none',audience:'all',status:'published',priority:100
};
assert.equal(controller.normalize(valid).placement,'home');
assert.equal(controller.normalize({...valid,placement:'home',placementValue:''}).placementValue,'');
assert.equal(controller.normalize({...valid,placement:'genre',placementValue:'House'}).placementValue,'House');
assert.equal(controller.normalize({...valid,placement:'region',placementValue:'Αττική'}).placement,'region');
for(const invalid of [
  {...valid,placement:'unknown'}, {...valid,placement:'genre',placementValue:''},
  {...valid,placement:'region',placementValue:''}, {...valid,placementValue:'x'.repeat(121),placement:'region'},
  {...valid,imageUrl:'javascript:alert(1)'}
])assert.throws(()=>controller.normalize(invalid),'invalid editorial placement must be rejected');

async function request(query){
 const response={statusCode:200,headers:{},body:null,
    setHeader(k,v){this.headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;},
    json(obj){this.body=obj;return this;}};
 await controller.publicSlides({query},response);
 return response;
}
(async()=>{
 let res=await request({});
 assert.equal(res.statusCode,200);
 assert.ok(lastFilter.$or,'legacy slides should remain in default home carousel');
 assert.equal(lastLimit,16);
 res=await request({placement:'genre',value:'House'});
 assert.equal(res.statusCode,200);
 assert.equal(lastFilter.placement,'genre');
 assert.equal(lastFilter.placementValue,'House');
 res=await request({placement:'region',value:'Αττική'});
 assert.equal(lastFilter.placement,'region');
 assert.equal(lastFilter.placementValue,'Αττική');
 res=await request({placement:'genre',tiles:'1'});
 assert.equal(res.statusCode,200);
 assert.equal(lastFilter.placement,'genre');
 assert.ok(!Object.hasOwn(lastFilter,'placementValue'),'batch tiles are scoped to placement');
 assert.equal(lastLimit,80);
 for(const q of [{placement:'genre'},{placement:'region'},{placement:'home',tiles:'1'},{placement:'random'}]){
   res=await request(q);assert.equal(res.statusCode,400,'invalid scope should reject');
 }
 const home=read('frontend/src/components/HomeHeroSlider.jsx');
 assert.ok(home.includes('useStationAmbient(displayLogo)'),'logo-driven ambient colors');
 assert.ok(home.includes('ir-hero-station-logo'),'station logo must be visible beside title');
 assert.ok(home.includes('<StationListenButton'),'hero uses real playing status CTA');
 assert.ok(read('frontend/src/hooks/useStationAmbient.js').includes("getImageData"),'actual logo sampling');
 const listen=read('frontend/src/components/StationListenButton.jsx');
 assert.ok(listen.includes("'Παίζει τώρα'")&&listen.includes("'Άκου τώρα'"));
 assert.ok(listen.includes('onPlayPause'),'resume paused selected station without changing API');
 for(const file of ['frontend/src/pages/Genre.jsx','frontend/src/pages/Region.jsx']){
   const src=read(file);
   assert.ok(src.includes('<EditorialPlacement'),file+' must show CMS editorial slide');
   assert.ok(src.includes('<StationCatalogCard'),file+' must share premium radio cards');
   assert.ok(src.includes('<CatalogFilterPopover'),file+' must use searchable filters');
   assert.ok(!src.includes('<select'),'native dropdown found in '+file);
 }
 const explorer=read('frontend/src/components/HomeExplore.jsx');
 assert.ok(!explorer.includes('<select'),'home must remain dropdown-free');
 assert.ok(explorer.includes('tiles:'),'home requests batched editorial category/region images');
 assert.ok(explorer.includes('slide.imageUrl'),'published editorial backgrounds in discovery');
 const admin=read('frontend/src/pages/AdminHomeSlides.jsx');
 assert.ok(admin.includes("placement:'home'")&&admin.includes("placement:'region'")==false);
 assert.ok(admin.includes("['home','Αρχική']"));
 assert.ok(admin.includes("['genre','Μουσικό είδος']"));
 assert.ok(admin.includes("['region','Περιοχή']"));
 assert.ok(admin.includes("placementValue:draft.placement==='home'?'':draft.placementValue"));
 for(const file of ['frontend/src/pages/Home.jsx','frontend/src/pages/StationProfile.jsx',
   'frontend/src/components/StationPlaylistPanel.jsx','frontend/src/components/DesktopFullPlayer.jsx',
   'frontend/src/components/MobileMiniPlayer.jsx','frontend/src/components/Footer.jsx']){
   assert.ok(read(file).includes('Συνδέσου στο iRadios για NowPlaying'),file+' guest metadata message');
 }
 assert.ok(read('frontend/src/components/StationPlaylistPanel.jsx').includes("Τα τελευταία Tracks του {chosen?.name"), 'playlist caption follows chosen hero station name');
 assert.ok(read('frontend/src/App.jsx').includes('ref={audioRef}'),'no change to central audio element');
 assert.ok(read('backend/routes/homeSlideRoutes.js').includes("authorizeRoles('admin')"),'CMS protected');
 console.log('Phase 3.1 editorial placement, shared playback state, guest metadata and catalog contracts passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
