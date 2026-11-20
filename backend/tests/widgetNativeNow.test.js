'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
// This CI job intentionally has no backend node_modules. Stub only the
// persistence-facing imports so real native expiry and AI filtering logic runs.
const Module=require('node:module');
const originalLoad=Module._load;
let publicWidgetNativeSnapshot,publicWidgetPlaylistSnapshot;
try{
  Module._load=function(request,parent,isMain){
    if(parent?.filename?.endsWith('/stageNativeNow.js')&&
      request==='../models/StationPlaylist')return {};
    if(parent?.filename?.endsWith('/stageNativeNow.js')&&
      request==='./recordStationTrack')return {
        parseTrack(raw){
          if(typeof raw!=='string')return null;
          const match=raw.match(/^(.+?) - (.+)$/);
          return match?{raw,artist:match[1],title:match[2]}:null;
        }
      };
    return originalLoad.apply(this,arguments);
  };
  ({publicWidgetNativeSnapshot,publicWidgetPlaylistSnapshot}=require('../services/widgetNativeNow'));
}finally{Module._load=originalLoad;}
const now=Date.parse('2026-11-12T11:00:00Z');
const doc={
  nativeNow:{raw:'Native Artist - Native Track',
    confirmedAt:new Date(now-1000),changedAt:new Date(now-3000)},
  nativeShow:{raw:'Live DJ Show',confirmedAt:new Date(now-2000)},
  currentAI:{kind:'manual',raw:'PRIVATE ARTIST - PRIVATE SONG',
    recognizedAt:new Date(now-1000),expiresAt:new Date(now+120000)}
};
test('station widget displays native RDS but never exposes Premium ACR data',()=>{
  const data=publicWidgetNativeSnapshot(doc,now);
  assert.equal(data.title,'Native Artist - Native Track');
  assert.equal(data.source,'station');
  assert.equal(data.foundWithAI,false);
  assert.equal(data.broadcastHint,'Live DJ Show');
  assert.equal(JSON.stringify(data).includes('PRIVATE'),false);
});
test('unconfirmed and expired station tracks do not leak stale songs',()=>{
  const data=publicWidgetNativeSnapshot({...doc,nativeNow:{
    ...doc.nativeNow,confirmedAt:new Date(now-9*60000)
  }},now);
  assert.equal(data.title,'');
  assert.equal(data.source,'none');
});
test('AI-only snapshot never exposes AI metadata',()=>{
  assert.deepEqual(publicWidgetNativeSnapshot({currentAI:doc.currentAI},now),
    {title:'',source:'none',foundWithAI:false});
});

test('public widget Playlist includes only fresh native tracks, never Premium AI',()=>{
  const playlist={tracks:[
    {source:'station',artist:'Native Artist',title:'Native Song',playedAt:new Date(now-10000)},
    {source:'acrcloud',artist:'PRIVATE ARTIST',title:'PRIVATE SONG',playedAt:new Date(now-10000)},
    {source:'station',artist:'Old Artist',title:'Old Track',playedAt:new Date(now-31*60000)}
  ],currentAI:doc.currentAI};
  const result=publicWidgetPlaylistSnapshot(playlist,now);
  assert.equal(result.tracks.length,1);
  assert.equal(result.tracks[0].raw,'Native Artist - Native Song');
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  assert.deepEqual(publicWidgetPlaylistSnapshot(null,now),{tracks:[]});
});
