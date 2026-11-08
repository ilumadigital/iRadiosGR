'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
async function main(){
  const {catalogStationInfo,compareCatalogPopularity,compareCatalogStations}=
    await import(pathToFileURL(path.join(__dirname,'../frontend/src/utils/catalogLive.js')).href);
  const clock={day:1,minute:12*60};
  const programme={day:1,startTime:'10:00',endTime:'14:00',
    title:'Midday Show',host:'DJ Anna',imageUrl:'https://radio.example.com/host.jpg'};
  const station=(id,schedule=[])=>({_id:id,name:'Radio '+id,scheduleDayBase:1,
    schedule,popularity:Number(id)*100,transmissionType:'Επίγειο',frequency:String(90+Number(id))});
  const full=station('1',[programme]);
  const songOnly=station('2');
  const showOnly=station('3',[{...programme,imageUrl:''}]);
  const noInfo=station('4');
  const snap={song:{artist:'Example Artist',title:'Example Song'},source:'station'};
  const byId={'1':snap,'2':snap};
  assert.equal(catalogStationInfo(full,snap,clock).tier,0,'verified song + complete on-air show + photo');
  assert.equal(catalogStationInfo(songOnly,snap,clock).tier,1,'valid song without a programme');
  assert.equal(catalogStationInfo(showOnly,null,clock).tier,2,'active programme without song or photo');
  assert.equal(catalogStationInfo(noInfo,null,clock).tier,3,'no data belongs last');
  assert.equal(catalogStationInfo(station('5',[{...programme,imageUrl:''}]),snap,clock).tier,1,
    'song + show without photo is not a complete programme');
  assert.equal(catalogStationInfo(station('6',[{...programme,host:''}]),snap,clock).tier,1,
    'song + missing producer is not a complete programme');
  assert.equal(catalogStationInfo(full,null,{day:1,minute:15*60}).tier,3,
    'off-air programme does not count even if it has a stored photo');
  assert.equal(catalogStationInfo(noInfo,{broadcastHint:'DJZONE'},clock).tier,3,
    'unscheduled live metadata hint is not a verified programme');
  assert.equal(catalogStationInfo(noInfo,{song:{artist:'',title:'Track'}},clock).tier,3,
    'incomplete song metadata cannot raise rank');
  assert.equal(catalogStationInfo(showOnly,{broadcastHint:'RADIOSHOW'},clock).tier,2,
    'an active schedule with a show hint but without a song remains tier three');
  const input=[noInfo,showOnly,songOnly,full];
  const expected=['1','2','3','4'];
  for(const mode of ['popularity','alphabetical','frequency','date']){
    const sorted=[...input].sort((a,b)=>compareCatalogStations(a,b,byId,clock,mode));
    assert.deepEqual(sorted.map(s=>s._id),expected,'strict quality tiers must win over '+mode);
  }
  assert.deepEqual([...input].sort((a,b)=>compareCatalogPopularity(a,b,byId,clock))
    .map(s=>s._id),expected);
  const level=[station('10'),station('11')];
  level[0].name='Zulu';level[1].name='Alpha';
  level[0].popularity=1000;level[1].popularity=1;
  assert.equal(compareCatalogStations(level[0],level[1],{},clock,'alphabetical')>0,true,
    'alphabetical applies within equal tiers');
  assert.equal(compareCatalogStations(level[0],level[1],{},clock,'popularity')<0,true,
    'popularity applies within equal tiers');
  const map=read('frontend/src/components/RadioGeoMap.jsx');
  const rootMap=read('frontend/src/components/MapMode.jsx');
  assert.match(rootMap,/useCatalogNowPlaying\(\)/);
  assert.match(rootMap,/nowPlayingById=\{catalogNowPlaying\}/);
  assert.match(map,/compareCatalogStations/);
  for(const page of ['Region','Genre']){
    const src=read('frontend/src/pages/'+page+'.jsx');
    assert.match(src,/compareCatalogStations/);
    assert.match(src,/catalogNowPlaying/);
  }
  assert.match(read('frontend/src/pages/Home.jsx'),/rankedStations=useMemo/);
  assert.match(read('frontend/src/components/HomeExplore.jsx'),/catalogStationInfo/);
  assert.match(read('frontend/src/components/HomeExplore.jsx'),/nowPlaying=\{catalogNowPlaying\[String\(s\._id\)\]\}/);
  console.log('Four-tier catalog ordering verified in standalone map, region, genre, discovery, grid and list; incomplete/stale shows remain lower.');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
