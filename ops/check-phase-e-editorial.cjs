'use strict';
// Phase E offline regression: no API, database, paid services or VPS dependency.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const id='0123456789abcdef01234567';
let rows=[],stationOnline=true,promo={stationId:id,enabled:true};
const Slide={find(){return {select(){return this;},sort(){return this;},
  limit(){return this;},async lean(){return rows;}};}};
const Promotion={findOne(){return {select(){return this;},async lean(){return promo;}};}};
const Station={findOne(){return {select(){return this;},
  async lean(){return stationOnline?{_id:id}:null;}};},exists:async()=>true};
const original=Module._load;
let slides,promoted;
try{
  Module._load=function(name,parent,isMain){
    if(parent?.filename?.endsWith('homeSlideController.js')){
      if(name==='mongoose')return {isValidObjectId:()=>true};
      if(name==='../models/HomeSlide')return Slide;
      if(name==='../models/Station')return Station;
    }
    if(parent?.filename?.endsWith('promotedStationController.js')){
      if(name==='mongoose')return {isValidObjectId:()=>true};
      if(name==='../models/PromotedStation')return Promotion;
      if(name==='../models/Station')return Station;
    }
    return original.call(this,name,parent,isMain);
  };
  slides=require('../backend/controllers/homeSlideController.js');
  promoted=require('../backend/controllers/promotedStationController.js');
}finally{Module._load=original;}
function response(){return {statusCode:200,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.statusCode=n;return this;},
  json(v){this.body=v;return this;}};}
async function publicSlides(query){
  const res=response();await slides.publicSlides({query},res);return res;
}
(async()=>{
  rows=[{_id:'creative1',placement:'genre',placementValue:'House',priority:100,
    placements:[{placement:'genre',placementValue:'House'},
      {placement:'genre',placementValue:'Rock'},
      {placement:'region',placementValue:'Αττική'}]},
    {_id:'legacy',placement:'genre',placementValue:'Jazz',priority:80}];
  let res=await publicSlides({placement:'genre',tiles:'1'});
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body.map(x=>x.placementValue),['House','Rock','Jazz'],
    'multi-scope creatives render all selected category tiles, then legacy tiles');
  assert.equal(res.body[0]._id,res.body[1]._id,'one creative can power multiple distinct tiles');
  res=await publicSlides({placement:'region',tiles:'1'});
  assert.deepEqual(res.body.map(x=>x.placementValue),['Αττική'],
    'category tiles never appear as unrelated region tiles');
  res=await publicSlides({placement:'home'});
  assert.equal(res.body.length,2,'normal carousel is not expanded into duplicate slides');
  res=await publicSlides({placement:'home',tiles:'1'});
  assert.equal(res.statusCode,400,'home tiles are not permitted');

  const promoResponse=response();
  await promoted.publicPromoted({query:{placement:'region',value:'Αττική'}},promoResponse);
  assert.deepEqual(promoResponse.body,{stationId:id},
    'public promotion exposes only the station id, even when playlist contains tracks');
  assert.equal(JSON.stringify(promoResponse.body).includes('nowPlaying'),false);
  stationOnline=false;
  res=response();await promoted.publicPromoted({query:{placement:'genre',value:'House'}},res);
  assert.equal(res.body,null,'offline station may not occupy a public promoted placement');
  stationOnline=true;promo=null;
  res=response();await promoted.publicPromoted({query:{placement:'genre',value:'House'}},res);
  assert.equal(res.body,null,'empty CMS placements never become random promotions');

  const {visibleEditorialSlides,homeFeaturedFallback,meetsEditorialAudience}=
    await import(pathToFileURL(path.join(root,'frontend/src/utils/editorialPresentation.js')).href);
  const stations=[{_id:'a',isFeatured:true,status:'approved'},
    {_id:'b',status:'approved'}, {_id:'offline',isFeatured:true,isOffline:true,status:'approved'},
    {_id:'pending',status:'pending'}];
  assert.equal(homeFeaturedFallback(stations,'genre'),null,'catalog header has no arbitrary station fallback');
  assert.equal(homeFeaturedFallback(stations,'home')._id,'a','admin featured is the home fallback');
  assert.equal(homeFeaturedFallback([{_id:'x',status:'approved'}],'home'),null,
    'generic hero must not masquerade as an editorially featured station');
  assert.equal(meetsEditorialAudience({audience:'premium'},null),false);
  assert.equal(meetsEditorialAudience({audience:'guest'},null),true);
  const cms=[{_id:'1',targetType:'station',stationId:'a',audience:'all'},
    {_id:'2',targetType:'station',stationId:'a',audience:'all'},
    {_id:'3',targetType:'station',stationId:'pending',audience:'all'},
    {_id:'4',targetType:'station',stationId:'offline',audience:'all'},
    {_id:'5',targetType:'station',stationId:'b',audience:'premium'},
    {_id:'6',targetType:'none',audience:'all'}];
  assert.deepEqual(visibleEditorialSlides(cms,null,stations).map(s=>s._id),['1','6'],
    'guest sees one approved live station only, no duplicate, pending or premium slide');
  assert.deepEqual(visibleEditorialSlides(cms,{isPremium:true},stations).map(s=>s._id),['1','5','6']);
  assert.deepEqual(visibleEditorialSlides(cms,null,stations,'a').map(s=>s._id),['6'],
    'promoted station takes its own slot instead of repeating in the editorial hero');

  const hero=read('frontend/src/components/HomeHeroSlider.jsx');
  const wrapper=read('frontend/src/components/EditorialPlacement.jsx');
  const promotedCard=read('frontend/src/components/PromotedStationCard.jsx');
  assert.ok(hero.includes("if(placement!=='home'&&!slide)return null"),'no random catalog hero');
  assert.ok(hero.includes('onAvailabilityChange?.(visible.length>0)'),'carousel availability is observable');
  assert.ok(wrapper.includes('hasEditorial&&hasPromoted'),'split layout requires both placements');
  assert.ok(wrapper.includes('empty:hidden'),'unconfigured catalog header collapses');
  assert.ok(!promotedCard.includes('parseMusicMetadata')&&!promotedCard.includes('feature?.nowPlaying'),
    'guest promoted card can display schedule but never a track');
  for(const name of ['Genre','Region']){
    const page=read('frontend/src/pages/'+name+'.jsx');
    assert.ok(page.includes("viewMode!=='map' && promotedStationId"),
      'catalog grid/list avoids repeated Promoted station while map retains markers');
  }
  console.log('Phase E editorial placements, multi-scope tiles, guest metadata and ranking isolation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
