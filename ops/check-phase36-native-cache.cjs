'use strict';
// Offline Phase 3.6 regression: no streams, MongoDB, paid ACRCloud, or browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Module=require('node:module');
const orig=Module._load;
const id='aaaaaaaaaaaaaaaaaaaaaaaa';
const station={_id:id,name:'Deseo Radio',status:'approved',
  stream:'https://radio.example/live',metadata:'https://radio.example/metadata'};
const doc={stationId:id,nativeNow:null,currentAI:null,tracks:[]};
const deep=x=>structuredClone(x);
let nativeChanges=0,confirmations=0,invalidClears=0,externalCalls=0,upstreamInApi=0;
const Playlist={
  updateOne:async(filter,change,options)=>{
    if(change.$setOnInsert)return {matchedCount:1,modifiedCount:0};
    if(change.$set?.nativeNow){
      const next=change.$set.nativeNow;
      if(doc.nativeNow?.raw===next.raw)return {matchedCount:0,modifiedCount:0};
      if(doc.nativeNow&&new Date(doc.nativeNow.confirmedAt)>new Date(next.confirmedAt))
        return {matchedCount:0,modifiedCount:0};
      doc.nativeNow=deep(next);nativeChanges++;
      return {matchedCount:1,modifiedCount:1};
    }
    if(change.$set?.['nativeNow.confirmedAt']){
      if(doc.nativeNow?.raw!==filter['nativeNow.raw'])
        return {matchedCount:0,modifiedCount:0};
      doc.nativeNow.confirmedAt=change.$set['nativeNow.confirmedAt'];
      confirmations++;
      return {matchedCount:1,modifiedCount:1};
    }
    if(change.$unset?.nativeNow!==undefined){
      doc.nativeNow=null;invalidClears++;
      return {matchedCount:1,modifiedCount:1};
    }
    if(change.$push){doc.tracks.unshift(deep(change.$push.tracks.$each[0]));return {modifiedCount:1,matchedCount:1};}
    if(change.$unset?.currentAI!==undefined){doc.currentAI=null;return {modifiedCount:1,matchedCount:1};}
    return {modifiedCount:0,matchedCount:0};
  },
  findOne:()=>({select:()=>({lean:async()=>deep(doc)})}),
  find:()=>({select:()=>({limit:()=>({lean:async()=>[deep(doc)]})})})
};
const Station={findOne:()=>({select:()=>({lean:async()=>station})})};
Module._load=function(name,parent,isMain){
  const from=String(parent?.filename||'');
  if(name==='../models/StationPlaylist'&&[
    'recordStationTrack.js','stageSmartTracks.js','stageNativeNow.js','stageMetadata.js'
  ].some(file=>from.endsWith(file)))return Playlist;
  if(from.endsWith('stageMetadata.js')){
    if(name==='../models/Station')return Station;
    if(name==='./stageSafeRadioFetch')return {readPublicUrl:async()=>{upstreamInApi++;throw Error('no upstream');}};
  }
  return orig.call(this,name,parent,isMain);
};
let track,native,smart,stage;
try{
  track=require('../backend/utils/recordStationTrack');
  native=require('../backend/utils/stageNativeNow');
  smart=require('../backend/utils/stageSmartTracks');
  stage=require('../backend/utils/stageMetadata');
}finally{Module._load=orig;}
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},
  code:200,status(n){this.code=n;return this;},json(value){this.body=value;return this;}});
async function run(){
  for(const malformed of [
    'DJSET LIVE SHOW','DJSET - LIVE SHOW','DJ Zone - Live session',
    'DJ - DJ SET 20:00','Deseo Radio - Hit','LIVE SHOW - Song',
    'Artist - ON AIR','Artist - Radio Show','Artist - Playlist',
    'Artist - 07:26','Artist - Morning Εκπομπή'
  ])assert.equal(track.parseTrack(malformed,station.name),null,'never a valid song: '+malformed);
  assert.equal(track.parseTrack('Daft Punk - One More Time',station.name).title,'One More Time');

  const now=Date.now();
  assert.equal(await native.rememberNativeSong(station,'Daft Punk - One More Time',now),true);
  assert.equal(nativeChanges,1);
  const changedAt=new Date(doc.nativeNow.changedAt).getTime();
  assert.equal(await native.rememberNativeSong(station,'Daft Punk - One More Time',now+120000),false);
  assert.equal(nativeChanges,1,'unchanged radio song must not replace cache entry');
  assert.equal(confirmations,1,'only internal freshness advances');
  assert.equal(new Date(doc.nativeNow.changedAt).getTime(),changedAt,
    'song-changed timestamp remains stable');
  assert.equal(native.nativeSongFromSnapshot(doc,now+120000).raw,'Daft Punk - One More Time');

  const feed=response();
  await smart.stageLiveAI({},feed);
  assert.equal(feed.code,200);
  assert.equal(feed.body.tracks[0].source,'station','native songs are in the fast Home feed');
  assert.equal(feed.body.tracks[0].foundWithAI,false);
  assert.equal(feed.headers['Cache-Control'],'private, no-store');

  const live=response();
  await stage.stageMetadata({query:{stationId:id}},live);
  assert.equal(live.body.title,'Daft Punk - One More Time','profile gets last native song');
  assert.equal(upstreamInApi,0,'GET metadata MUST NOT fetch any remote metadata');
  assert.equal(live.body.source,'station');

  doc.currentAI={raw:'Other Artist - AI Song',artist:'Other Artist',title:'AI Song',
    kind:'auto',recognizedAt:new Date(now+150000),expiresAt:new Date(now+450000)};
  let song=native.snapshotSong(doc,now+180000);
  assert.equal(song.source,'acrcloud','newer AI can rescue an interrupted native stream');
  assert.equal(song.title,'Other Artist - AI Song');
  doc.currentAI.kind='manual';
  assert.equal(native.snapshotSong(doc,now+180000).source,'acrcloud','manual recognition always wins');

  doc.currentAI.kind='auto';
  doc.currentAI.recognizedAt=new Date(now+60000);
  assert.equal(native.snapshotSong(doc,now+180000).source,'station',
    'newer verified native song overrides older automatic recognition');
  const older=now+120000+native.VALID_FOR+1000;
  assert.equal(native.nativeSongFromSnapshot(doc,older),null,
    'unconfirmed native song expires; never advertise ancient track as live');
  assert.equal(native.snapshotSong({...doc,currentAI:null},older),null);

  assert.equal(await native.clearInvalidNativeSong(station,''),false,
    'temporary metadata outage never instantly destroys a cached song');
  assert.equal(invalidClears,0);
  assert.equal(await native.clearInvalidNativeSong(station,'DJSET LIVE SHOW'),true);
  assert.equal(invalidClears,1);
  assert.equal(doc.nativeNow,null);

  const nativeRead=response();
  await stage.stageMetadata({query:{stationId:id}},nativeRead);
  assert.equal(nativeRead.body.source,'acrcloud','AI fallback visible after invalid metadata');
  assert.equal(upstreamInApi,0);

  const source=fs.readFileSync('frontend/src/utils/musicMetadata.js','utf8')
    .replaceAll('export const ','const ');
  const parse=vm.runInNewContext(source+'\nparseMusicMetadata;', {});
  const link=vm.runInNewContext(source+'\nspotifySongLink;', {});
  for(const nonSong of [
    'DJSET LIVE SHOW','DJSet - Live Show','Artist - DJ SET',
    'Artist - On Air','DJ Zone - live show','Artist - Radio Show'
  ]){
    assert.equal(parse(nonSong,station.name),null);
    assert.equal(link(nonSong,station.name),null,'no Spotify link for '+nonSong);
  }
  assert.equal(parse('Daft Punk - One More Time',station.name).artist,'Daft Punk');
  assert.ok(link('Daft Punk - One More Time',station.name).startsWith(
    'https://open.spotify.com/search/'));
  const nowPage=fs.readFileSync('frontend/src/pages/PlayingNow.jsx','utf8');
  assert.ok(nowPage.includes('/metadata/live'));
  assert.ok(!nowPage.includes('PER_PASS = 36'));
  assert.ok(!nowPage.includes('/metadata?stationId='),
    'the browser must never rescan individual station URLs');
  const stageSource=fs.readFileSync('backend/utils/stageMetadata.js','utf8');
  assert.ok(!stageSource.includes('const native=await readCachedNativeMetadata(station);'));
  const server=fs.readFileSync('backend/server.js','utf8');
  assert.ok(server.includes("require('./utils/stageNativeScanner').start()"));
  const lock=fs.readFileSync('frontend/src/hooks/useMediaSession.js','utf8');
  assert.ok(lock.includes("artist:'iRadios GR'"),'fallback lock screen artist must be iRadios GR');
  console.log('Phase 3.6: native 2-minute prefetch, unchanged cache, fast Mongo feed, TTL, AI precedence, Spotify safeguards and Media Session fallback passed.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
