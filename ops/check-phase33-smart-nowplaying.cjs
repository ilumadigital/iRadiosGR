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
    if(/(?:recordStationTrack|stageSmartTracks|stageNativeNow)\.js$/.test(parent?.filename||'')&&name==='../models/StationPlaylist'){
      return {updateOne:async()=>{writes++;return {modifiedCount:1,matchedCount:1};},
        findOne:()=>({select:()=>({lean:async()=>null})})};
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
    // ACRCloud is MANUAL-ONLY (per the approved staging behavior). The old
    // regression expected automatic vendor recognition, which is no longer
    // allowed and caused a TypeError on null.expiresAt in CI.
    const auto=await smart.publishAI(station,ai,'auto',now+4*60*1000);
    assert.equal(auto,null,'automatic ACR calls must not publish metadata');
    assert.equal(smart.resolvedNowPlaying('LIVE SHOW',station,now+4*60*1000).foundWithAI,false,
      'after four minutes the manual result has expired');
    assert.equal(smart.resolvedNowPlaying('Native Artist - Native Song',station,now+4*60*1000).source,'station',
      'valid native music works without automatic ACR');
    assert.equal(smart.getSharedAI(station._id),null,
      'an expired manual result must not be resurrected');

    const parser=read('frontend/src/utils/musicMetadata.js')
      .replaceAll('export const ','const ');
    const source=read('frontend/src/hooks/useMediaSession.js')
      .replace("import {useEffect,useRef} from 'react';",'')
      .replace("import {parseMusicMetadata} from '../utils/musicMetadata';",'')
      .replace('export function mediaFields','function mediaFields')
      .replace('export default function useMediaSession','function useMediaSession');
    const media=vm.runInNewContext(parser+'\n'+source+'\nmediaFields;', {});
    const guest=media({currentStation:station,currentUser:null,nowPlaying:'Soul Artist - Hit Song'});
    assert.equal(guest.title,'Login στο iRadios για NowPlaying');
    assert.equal(guest.artist,'Deseo Radio');
    const signed={currentStation:station,currentUser:{_id:'user'},
      nowPlaying:'Soul Artist - Hit Song',nowPlayingInfo:{source:'acrcloud',foundWithAI:true}};
    const recognized=media(signed);
    assert.equal(recognized.title,'Hit Song');
    assert.equal(recognized.artist,'Soul Artist');
    assert.equal(recognized.album,'Deseo Radio - iRadios AI');
    const native=media({...signed,nowPlayingInfo:{source:'station',foundWithAI:false}});
    assert.equal(native.title,'Hit Song');
    assert.equal(native.artist,'Soul Artist');
    assert.equal(native.album,'Deseo Radio - iRadios');
    for(const invalid of ['', 'LIVE SHOW', 'DJ Zone - Deseo Radio',
      'Deseo Radio - LIVE NOW', 'Βρίσκουμε το τραγούδι…']){
      const fallback=media({...signed,nowPlaying:invalid});
      assert.equal(fallback.title,'Τώρα Ακούς','missing/invalid metadata is not a song');
      assert.equal(fallback.artist,'Deseo Radio','station name stays in artist');
      assert.equal(fallback.album,'iRadios','fallback is not labeled AI');
    }
    const ad=media({...signed,isPlayingAd:true,currentAdInfo:{title:'Ad Break',client:'Advertiser'}});
    assert.equal(ad.title,'Ad Break','ad media fields remain unchanged');
    assert.equal(ad.artist,'Advertiser');
    const mediaHook=read('frontend/src/hooks/useMediaSession.js');
    assert.ok(mediaHook.includes('FIVE_MINUTES=5*60*1000'));
    assert.ok(mediaHook.includes('navigator.mediaSession.metadata=new window.MediaMetadata'));
    assert.ok(mediaHook.includes("playbackState=data.isPlaying?'playing':'paused'"));
    assert.ok(mediaHook.includes('trackChanged'),'confirmed song replaces lock-screen fallback immediately');
    assert.ok(mediaHook.includes('artworkChanged'),'album artwork refreshes without waiting five minutes');
    assert.ok(mediaHook.includes('sourceChanged'),'AI album provenance refreshes immediately');
    for(const file of ['frontend/src/pages/PlayingNow.jsx','frontend/src/pages/StationProfile.jsx',
      'frontend/src/components/StationPlaylistPanel.jsx','frontend/src/components/Footer.jsx',
      'frontend/src/components/MobileMiniPlayer.jsx','frontend/src/components/DesktopFullPlayer.jsx']){
      assert.ok(read(file).includes('FoundWithAI')||read(file).includes('Found with AI'),
        file+' should visibly mark an ACRCloud-sourced result');
    }
    assert.ok(read('frontend/src/App.jsx').includes('nowPlayingInfo={nowPlayingInfo}'),
      'the shared source is passed from the central player');
    assert.ok(read('backend/utils/stageMetadata.js').includes('snapshotSong(snapshot)'),
      'API metadata uses the pre-fetched shared MongoDB snapshot');
    assert.equal(media({...signed,nowPlaying:'LIVE SHOW'}).artist,'Deseo Radio',
      'logged-in iPhone fallback artist is always the station name');
    // Exercise the real hook's update gates without opening audio, network or iOS APIs.
    // The previous 5-minute gate kept "Τώρα Ακούς" despite a real player song.
    const refs=[];
    let refIndex=0;
    const mediaWrites=[];
    const nav={mediaSession:{metadata:null,playbackState:'none',setActionHandler(){}}};
    const env={
      navigator:nav,
      window:{
        location:{origin:'https://stage.iradios.gr',protocol:'https:'},
        MediaMetadata:class {
          constructor(fields){Object.assign(this,fields);mediaWrites.push(fields);}
        }
      },
      URL,setInterval:()=>1,clearInterval:()=>{},
      useRef(initial){
        const i=refIndex++;
        if(!refs[i])refs[i]={current:initial};
        return refs[i];
      },
      useEffect(callback){callback();}
    };
    const hook=vm.runInNewContext(parser+'\n'+source+'\nuseMediaSession;',env);
    const render=(props)=>{
      refIndex=0;
      hook({currentStation:station,currentUser:{_id:'user'},isPlaying:true,
        isPlayingAd:false,currentAdInfo:null,globalCoverArt:null,
        nowPlayingInfo:{source:'none',foundWithAI:false},
        ...props});
    };
    render({nowPlaying:''});
    assert.equal(mediaWrites.at(-1).title,'Τώρα Ακούς');
    const countBeforeTrack=mediaWrites.length;
    render({nowPlaying:'Paul Anthonee - Inertia',
      nowPlayingInfo:{source:'station',foundWithAI:false}});
    assert.equal(mediaWrites.length,countBeforeTrack+1,'new native metadata updates immediately');
    assert.equal(mediaWrites.at(-1).title,'Inertia');
    assert.equal(mediaWrites.at(-1).artist,'Paul Anthonee');
    assert.equal(mediaWrites.at(-1).album,'Deseo Radio - iRadios');
    const cover='https://cdn.example.com/inertia.jpg';
    render({nowPlaying:'Paul Anthonee - Inertia',globalCoverArt:cover,
      nowPlayingInfo:{source:'station',foundWithAI:false}});
    assert.equal(mediaWrites.at(-1).artwork[0].src,cover,'cover arrival updates lock screen');
    render({nowPlaying:'Paul Anthonee - Inertia',globalCoverArt:cover,
      nowPlayingInfo:{source:'acrcloud',foundWithAI:true}});
    assert.equal(mediaWrites.at(-1).album,'Deseo Radio - iRadios AI',
      'AI recognition supersedes native provenance');
    render({nowPlaying:'New Artist - New Track',
      nowPlayingInfo:{source:'station',foundWithAI:false}});
    assert.equal(mediaWrites.at(-1).title,'New Track','next real song replaces previous title');
    assert.equal(mediaWrites.at(-1).artwork.length,0,
      'old song cover is never kept when a new track arrives');
    render({nowPlaying:''});
    assert.equal(mediaWrites.at(-1).title,'Τώρα Ακούς',
      'missing metadata resets the lock-screen title');

    assert.ok(read('backend/models/StationPlaylist.js').includes('source:'),
      'playlist entries persist their source');
    assert.ok(writes>0,'successful recognition saves playlist history');
    console.log('Smart NowPlaying song priority, 4-minute manual override, AI provenance and device media fields passed.');
  })().catch(error=>{console.error(error);process.exitCode=1;});
}finally{Module._load=orig;}
