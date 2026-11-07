'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Module=require('node:module');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const orig=Module._load;
let writes=0;
try{
  Module._load=function(name,parent,isMain){
    if(parent?.filename?.endsWith('recordStationTrack.js')&&name==='../models/StationPlaylist'){
      return {updateOne:async()=>{writes++;return {modifiedCount:1};}};
    }
    return orig.call(this,name,parent,isMain);
  };
  const track=require('../backend/utils/recordStationTrack');
  const smart=require('../backend/utils/stageSmartTracks');
  const station={_id:'aaaaaaaaaaaaaaaaaaaaaaaa',name:'Deseo Radio'};
  assert.equal(track.parseTrack('LIVE SHOW',station.name),null);
  assert.equal(track.parseTrack('07.26 - εκπομπή',station.name),null);
  assert.equal(track.parseTrack('DJ Zone - Deseo Radio',station.name),null);
  assert.equal(track.parseTrack('Deseo Radio',station.name),null);
  assert.equal(track.parseTrack('LIVE SHOW - Deseo Radio',station.name),null);
  assert.equal(track.parseTrack('Artist - Song',station.name).artist,'Artist');
  assert.equal(smart.statusFromNative('',station.name),'missing');
  assert.equal(smart.statusFromNative('LIVE SHOW',station.name),'invalid');
  assert.equal(smart.statusFromNative('07.26 εκπομπή',station.name),'invalid');
  assert.equal(smart.statusFromNative('Artist - Song',station.name),'valid');

  const ai={status:{code:0},metadata:{music:[{title:'Hit Song',artists:[{name:'Soul Artist'}]}]}};
  assert.equal(smart.validTrackFromAcr({status:{code:1001}}),null);
  assert.equal(smart.validTrackFromAcr(ai).raw,'Soul Artist - Hit Song');
  const now=Date.now();
  (async()=>{
    const manual=await smart.publishAI(station,ai,'manual',now);
    assert.equal(manual.foundWithAI,true);
    assert.equal(manual.expiresAt-now,4*60*1000);
    assert.equal(smart.resolvedNowPlaying('LIVE SHOW',station,now+1000).title,manual.raw);
    assert.equal(smart.resolvedNowPlaying('Another - Song',station,now+1000).foundWithAI,true,
      'manual recognition overrides native titles for four minutes');
    assert.equal(smart.getSharedAI(station._id,now+4*60*1000),null,
      'manual result expires at exactly four minutes');
    const auto=await smart.publishAI(station,ai,'auto',now+4*60*1000);
    assert.equal(auto.expiresAt-(now+4*60*1000),5*60*1000);
    assert.equal(smart.resolvedNowPlaying('LIVE SHOW',station,now+4*60*1000).foundWithAI,true);
    assert.equal(smart.resolvedNowPlaying('Native Artist - Native Song',station,now+4*60*1000).source,'station',
      'valid native music always beats automatic ACR');
    assert.equal(smart.getSharedAI(station._id),null,
      'automatic result is removed on valid native metadata');

    const source=read('frontend/src/hooks/useMediaSession.js')
      .replace("import {useEffect,useRef} from 'react';",'')
      .replace('export function mediaFields','function mediaFields')
      .replace('export default function useMediaSession','function useMediaSession');
    const media=vm.runInNewContext(source+'\nmediaFields;', {});
    const guest=media({currentStation:station,currentUser:null,nowPlaying:'Soul Artist - Hit Song'});
    assert.equal(guest.title,'Login στο iRadios για NowPlaying');
    assert.equal(guest.artist,'Deseo Radio');
    const signed={currentStation:station,currentUser:{_id:'user'},
      nowPlaying:'Soul Artist - Hit Song',nowPlayingInfo:{source:'acrcloud',foundWithAI:true}};
    const recognized=media(signed);
    assert.equal(recognized.title,'Hit Song');
    assert.equal(recognized.artist,'Soul Artist');
    assert.equal(recognized.album,'Deseo Radio - iRadios AI');
    assert.equal(media({...signed,nowPlayingInfo:{source:'station',foundWithAI:false}}).album,
      'Deseo Radio - iRadios');
    assert.equal(media({...signed,nowPlaying:'LIVE SHOW'}).title,'Deseo Radio');
    const mediaHook=read('frontend/src/hooks/useMediaSession.js');
    assert.ok(mediaHook.includes('FIVE_MINUTES=5*60*1000'));
    assert.ok(mediaHook.includes('navigator.mediaSession.metadata=new window.MediaMetadata'));
    assert.ok(mediaHook.includes("playbackState=data.isPlaying?'playing':'paused'"));
    assert.ok(mediaHook.includes('firstAI'),'first recognized song updates device before it expires');
    for(const file of ['frontend/src/pages/PlayingNow.jsx','frontend/src/pages/StationProfile.jsx',
      'frontend/src/components/StationPlaylistPanel.jsx','frontend/src/components/Footer.jsx',
      'frontend/src/components/MobileMiniPlayer.jsx','frontend/src/components/DesktopFullPlayer.jsx']){
      assert.ok(read(file).includes('FoundWithAI')||read(file).includes('Found with AI'),
        file+' should visibly mark an ACRCloud-sourced result');
    }
    assert.ok(read('frontend/src/App.jsx').includes('nowPlayingInfo={nowPlayingInfo}'),
      'the shared source is passed from the central player');
    assert.ok(read('backend/utils/stageMetadata.js').includes('resolvedNowPlaying(native,station)'),
      'API metadata uses the shared music resolver');
    assert.ok(read('backend/models/StationPlaylist.js').includes('source:'),
      'playlist entries persist their source');
    assert.ok(writes>0,'successful recognition saves playlist history');
    console.log('Smart NowPlaying song priority, 4-minute manual override, AI provenance and device media fields passed.');
  })().catch(error=>{console.error(error);process.exitCode=1;});
}finally{Module._load=orig;}
