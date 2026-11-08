'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');
async function main(){
  const {catalogStationInfo,compareCatalogPopularity,compareCatalogCompleteness,compareCatalogStations}=
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
  assert.equal(catalogStationInfo(full,{broadcastHint:'DJZONE'},clock).tier,0,
    'complete DJ programme with on-air broadcast metadata ranks first even without a song');
  assert.equal(catalogStationInfo(full,{broadcastHint:'RadioShow'},clock).tier,0,
    'RadioShow metadata and live producer photo are sufficient for the first tier');
  assert.equal(catalogStationInfo(noInfo,{broadcastHint:'DJZONE'},clock).tier,3,
    'unscheduled live metadata hint is not a verified programme');
  assert.equal(catalogStationInfo(station('7',[{...programme,imageUrl:''}]),
    {broadcastHint:'DJZONE'},clock).tier,2,
    'a radio-show hint without a DJ picture is not a full programme');
  assert.equal(catalogStationInfo(noInfo,{song:{artist:'',title:'Track'}},clock).tier,3,
    'incomplete song metadata cannot raise rank');
  assert.equal(catalogStationInfo(showOnly,{broadcastHint:'RADIOSHOW'},clock).tier,2,
    'an active schedule with a show hint but without a song remains tier three');
  const input=[noInfo,showOnly,songOnly,full];
  const expectedComplete=['1','2','3','4'];
  // Explicit position is independent of current metadata and overrides plays.
  full.position=10;
  songOnly.position=2;
  showOnly.position=5;
  noInfo.position=1;
  const expectedPosition=['4','2','3','1'];
  assert.deepEqual([...input].sort((a,b)=>compareCatalogPopularity(a,b,byId,clock))
    .map(s=>s._id),expectedPosition,'popularity must follow position');
  assert.deepEqual([...input].sort((a,b)=>compareCatalogStations(a,b,byId,clock,'popularity'))
    .map(s=>s._id),expectedPosition,'popularity dropdown uses position');
  assert.deepEqual([...input].sort((a,b)=>compareCatalogCompleteness(a,b,byId,clock))
    .map(s=>s._id),expectedComplete,'completeness uses current metadata and show');
  assert.deepEqual([...input].sort((a,b)=>compareCatalogStations(a,b,byId,clock,'completeness'))
    .map(s=>s._id),expectedComplete,'completeness dropdown uses live tiers');
  assert.deepEqual([...input].sort((a,b)=>compareCatalogStations(a,b,byId,clock,'alphabetical'))
    .map(s=>s._id),expectedComplete,'alphabetical ordering independent of tier');
  assert.deepEqual([...input].sort((a,b)=>compareCatalogStations(a,b,byId,clock,'frequency'))
    .map(s=>s._id),expectedComplete,'FM ordering independent of tier');
  const newer=station('20');
  newer.createdAt='2026-11-08T12:00:00Z';
  full.createdAt='2026-11-07T12:00:00Z';
  assert.equal(compareCatalogStations(newer,full,byId,clock,'date')<0,true,
    'newer station comes first regardless of metadata completeness');
  const level=[station('10'),station('11')];
  level[0].name='Zulu';level[1].name='Alpha';
  level[0].position=3;level[1].position=1;
  level[0].popularity=1000;level[1].popularity=1;
  assert.equal(compareCatalogStations(level[0],level[1],{},clock,'alphabetical')>0,true,
    'alphabetical applies independently of position');
  assert.equal(compareCatalogStations(level[0],level[1],{},clock,'popularity')>0,true,
    'saved position wins over higher play count');
  assert.equal(compareCatalogStations(level[0],level[1],{},clock,'completeness')>0,true,
    'position breaks ties inside the same completeness tier');
  level[0].position=999;level[1].position=999;
  assert.equal(compareCatalogPopularity(level[0],level[1])<0,true,
    'listener popularity breaks ties only at the same position');
  level[0].position=undefined;
  assert.equal(compareCatalogPopularity(level[0],level[1])<0,true,
    'missing position behaves as default 999');
  assert.equal(compareCatalogPopularity({_id:'null',position:null,popularity:0},
    {_id:'one',position:1,popularity:0})>0,true,'null position must not be ranked as zero');
  const map=read('frontend/src/components/RadioGeoMap.jsx');
  const rootMap=read('frontend/src/components/MapMode.jsx');
  assert.match(rootMap,/useCatalogNowPlaying\(\)/);
  assert.match(rootMap,/nowPlayingById=\{catalogNowPlaying\}/);
  assert.match(map,/compareCatalogStations/);
  assert.match(map,/<option value="completeness">Πληρότητα<\/option>/);
  assert.match(map,/effectiveSortBy=showFilters\?sortBy:\(sortMode\|\|sortBy\)/);
  for(const page of ['Region','Genre']){
    const src=read('frontend/src/pages/'+page+'.jsx');
    assert.match(src,/compareCatalogStations/);
    assert.match(src,/catalogNowPlaying/);
    assert.match(src,/value:'popularity',label:'Δημοτικότητα'/);
    assert.match(src,/value:'completeness',label:'Πληρότητα'/);
    assert.ok(src.indexOf("value:'popularity',label:'Δημοτικότητα'") <
      src.indexOf("value:'completeness',label:'Πληρότητα'"),
      page+' must show popularity before completeness');
  }
  assert.match(read('frontend/src/pages/Home.jsx'),/rankedStations=useMemo/);
  assert.match(read('frontend/src/components/HomeExplore.jsx'),/catalogStationInfo/);
  assert.match(read('frontend/src/components/HomeExplore.jsx'),/nowPlaying=\{catalogNowPlaying\[String\(s\._id\)\]\}/);
  console.log('Catalog ordering: popularity by position and independent completeness by live metadata, across map/region/genre/grid/list.');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
