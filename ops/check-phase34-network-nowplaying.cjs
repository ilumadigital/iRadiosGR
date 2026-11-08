'use strict';
// Offline regression coverage: no MongoDB, radio streams, APIs or paid calls.
const assert=require('node:assert/strict');
const Module=require('node:module');
const originalLoad=Module._load;
const station={_id:'aaaaaaaaaaaaaaaaaaaaaaaa',name:'Deseo Radio',status:'approved'};
const saved={stationId:station._id,tracks:[],currentAI:null};
const clone=value=>value==null?value:structuredClone(value);

const Playlist={
  updateOne:async(filter,update)=>{
    if(update.$setOnInsert)return {matchedCount:1,modifiedCount:0};
    if(update.$push){
      const first=saved.tracks[0];
      const duplicate=first?.raw===update.$push.tracks.$each[0].raw &&
        new Date(first.playedAt).getTime()>=Date.now()-30*60*1000;
      if(duplicate)return {matchedCount:0,modifiedCount:0};
      saved.tracks.unshift(clone(update.$push.tracks.$each[0]));
      saved.tracks=saved.tracks.slice(0,120);
      return {matchedCount:1,modifiedCount:1};
    }
    if(update.$set?.['tracks.0.source']){
      if(saved.tracks[0]?.raw===filter['tracks.0.raw'])
        saved.tracks[0].source=update.$set['tracks.0.source'];
      return {matchedCount:1,modifiedCount:1};
    }
    if(update.$set?.currentAI){
      if(filter.$or&&saved.currentAI?.kind==='manual'&&
         new Date(saved.currentAI.expiresAt).getTime()>Date.now())
        return {matchedCount:0,modifiedCount:0};
      saved.currentAI=clone(update.$set.currentAI);
      return {matchedCount:1,modifiedCount:1};
    }
    if(update.$unset&&filter['currentAI.kind']==='auto'&&saved.currentAI?.kind==='auto')
      saved.currentAI=null;
    return {matchedCount:1,modifiedCount:1};
  },
  findOne:()=>({select:()=>({lean:async()=>clone(saved)})}),
  find:()=>({select:()=>({limit:()=>({lean:async()=>saved.currentAI&&
    new Date(saved.currentAI.expiresAt)>new Date()?[clone(saved)]:[]})})})
};
let playlistHandler=null;
const route={get:(path,...handlers)=>{if(path.includes('/playlist'))playlistHandler=handlers.at(-1);}};
Module._load=function(name,parent,isMain){
  const from=String(parent?.filename||'');
  if(name==='../models/StationPlaylist'&&/recordStationTrack\.js$|stageSmartTracks\.js$|stageNativeNow\.js$|stationPlaylistRoutes\.js$/.test(from))
    return Playlist;
  if(from.endsWith('stationPlaylistRoutes.js')){
    if(name==='express')return {Router:()=>route};
    if(name==='mongoose')return {isValidObjectId:()=>true};
    if(name==='../models/Station')return {findOne:()=>({select:()=>({lean:async()=>station})})};
    if(name==='../utils/authMiddleware')return {protect:(req,res,next)=>next()};
  }
  return originalLoad.call(this,name,parent,isMain);
};
let track,smart;
try{
  track=require('../backend/utils/recordStationTrack');
  smart=require('../backend/utils/stageSmartTracks');
  require('../backend/routes/stationPlaylistRoutes');
}finally{Module._load=originalLoad;}

async function run(){
  const ai={status:{code:0},metadata:{music:[
    {title:'Hit Song',artists:[{name:'Soul Artist'}]}
  ]}};
  const at=Date.now();
  const published=await smart.publishAI(station,ai,'manual',at);
  assert.equal(published.raw,'Soul Artist - Hit Song');
  assert.equal(saved.tracks.length,1,'AI publication must save song in playlist');
  assert.equal(saved.tracks[0].source,'acrcloud');
  assert.equal(saved.currentAI.kind,'manual','network-wide current AI must be durable');
  assert.equal((await smart.hydrateSharedAI(station._id,at+1000)).raw,published.raw,
    'a fresh reader on another process can hydrate the shared song');

  const response={setHeader(){},status(n){this.code=n;return this;},json(data){this.body=data;return this;}};
  await smart.stageLiveAI({},response);
  assert.equal(response.body.tracks[0].title,published.raw,'home feed queries MongoDB');

  await track.recordStationTrack(station,published.raw,{source:'station'});
  assert.equal(saved.tracks.length,1,'same playing song must not duplicate the playlist');
  assert.equal(saved.tracks[0].source,'acrcloud','native re-observation must not erase AI provenance');
  await track.recordStationTrack(station,'Second Artist - Second Song',{source:'station'});
  assert.equal(saved.tracks[0].raw,'Second Artist - Second Song');
  assert.equal(saved.tracks.length,2,'a new song is inserted at the front');

  const old={...saved.tracks[0],raw:'Old Artist - Old Song',playedAt:new Date(at-31*60*1000)};
  saved.tracks.push(old);
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},
    status(n){this.code=n;return this;},json(data){this.body=data;return this;}};
  await playlistHandler({params:{id:station._id}},res);
  assert.equal(res.body.tracks.length,2,'playlist excludes songs older than 30 minutes');
  assert.equal(res.body.tracks[1].source,'acrcloud','playlist keeps the recognized track badge');
  assert.equal(res.headers['Cache-Control'],'private, no-store');

  const failed=await smart.publishAI(station,{status:{code:1001}},'auto',at);
  assert.equal(failed,null,'no match must never be saved as a song');
  assert.equal(saved.tracks.length,3,'no match does not mutate stored playlist');

  // Successful shared song remains the network answer for four minutes,
  // including when the station sends invalid metadata.
  assert.equal(smart.resolvedNowPlaying('LIVE SHOW',station,at+1000).title,published.raw);
  assert.equal(smart.resolvedNowPlaying('Other Artist - Native Song',station,at+1000).source,'acrcloud');
  assert.equal(smart.resolvedNowPlaying('',station,at+4*60*1000).source,'none');
  console.log('Phase 3.4: shared persistent now-playing, accurate playlist source, 30-minute window and no-result safety passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
