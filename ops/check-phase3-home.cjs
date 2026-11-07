'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

// Run controller input validation and parsing without touching real DB or network.
const original=Module._load;
Module._load=function(name,parent,isMain){
  if(parent?.filename?.endsWith('homeSlideController.js')){
    if(name==='mongoose')return {isValidObjectId:value=>/^[a-f0-9]{24}$/i.test(value)};
    if(name==='../models/HomeSlide')return {};
    if(name==='../models/Station')return {};
  }
  if(parent?.filename?.endsWith('recordStationTrack.js')&&name==='../models/StationPlaylist')return {};
  return original.call(this,name,parent,isMain);
};
let normalize,parseTrack;
try {
  normalize=require('../backend/controllers/homeSlideController').normalize;
  parseTrack=require('../backend/utils/recordStationTrack').parseTrack;
} finally {Module._load=original;}

const slide={
  title:'Το ραδιόφωνο σου',subtitle:'Μουσική όλη μέρα',eyebrow:'LIVE',
  imageUrl:'https://example.com/hero.webp',ctaLabel:'Άκου τώρα',
  targetType:'station',stationId:'0123456789abcdef01234567',
  audience:'all',status:'published',priority:120
};
const good=normalize(slide);
assert.equal(good.title,slide.title);
assert.equal(good.priority,120);
assert.equal(good.targetType,'station');
for(const bad of [
  {...slide,imageUrl:'javascript:alert(1)'},
  {...slide,imageUrl:'http://localhost/admin'},
  {...slide,imageUrl:'https://u:pass@host.tld/a.jpg'},
  {...slide,imageUrl:''},
  {...slide,targetType:'external',externalUrl:'http://evil.tld/'},
  {...slide,targetType:'station',stationId:'wrong'},
  {...slide,priority:2000},
  {...slide,status:'live'},
  {...slide,startsAt:'2026-12-20',endsAt:'2026-12-19'},
  {...slide,title:'x'.repeat(101)}
])assert.throws(()=>normalize(bad),'unsafe/invalid slide should be rejected');
assert.equal(normalize({...slide,imageUrl:'/media/visuals/stage-user/hero.png'}).imageUrl,'/media/visuals/stage-user/hero.png');
assert.equal(normalize({...slide,targetType:'none'}).stationId,null);

assert.deepEqual(Object.keys(parseTrack('Daft Punk - One More Time','Radio')).sort(),['artist','playedAt','raw','title'].sort());
assert.equal(parseTrack('Daft Punk - One More Time','Radio').title,'One More Time');
for(const raw of ['','Radio','LIVE NOW','unknown','No song','Παίζει τώρα','song - ',' - song'])
  assert.equal(parseTrack(raw,'Radio'),null,'fake metadata history: '+raw);
const stage=read('backend/utils/stagePublicAccess.js');
assert.ok(stage.includes("'/api/home-slides'"),'public editorial slides must be readable');
assert.ok(stage.includes("playlist$"),'playlist must be JWT protected');
const route=read('backend/routes/homeSlideRoutes.js');
assert.ok(route.includes("router.use('/admin/home-slides', protect, authorizeRoles('admin'))"),'admin-only controls');
const backend=read('backend/server.js');
assert.ok(backend.includes("require('./routes/homeSlideRoutes')"));
assert.ok(backend.includes("require('./routes/stationPlaylistRoutes')"));
const meta=read('backend/utils/stageMetadata.js');
assert.ok(meta.includes('recordStationTrack(station, title)'), 'metadata history must be recorded from station reads');
const app=read('frontend/src/App.jsx');
assert.ok(app.includes('AdminHomeSlides'));
assert.ok(app.includes('ref={audioRef}'), 'single original audio element');
const home=read('frontend/src/pages/Home.jsx');
for(const name of ['HomeHeroSlider','HomeExplore','StationPlaylistPanel'])assert.ok(home.includes('<'+name),'home requires '+name);
const footer=read('frontend/src/components/Footer.jsx');
assert.ok(footer.includes('<DesktopFullPlayer'),'desktop full screen connected');
assert.ok(read('frontend/src/components/DesktopFullPlayer.jsx').includes('globalCoverArt'),'player uses actual cover URL');
assert.doesNotMatch(read('frontend/src/components/DesktopFullPlayer.jsx'), /<audio\s+[^>]*ref=/i, 'visual player cannot create an audio element');
assert.ok(read('frontend/src/pages/StationProfile.jsx').includes('<StationPlaylistPanel'),'station page has last-12 playlist');
console.log('Phase 3 slides, safety, playlist and desktop UI contracts passed.');
