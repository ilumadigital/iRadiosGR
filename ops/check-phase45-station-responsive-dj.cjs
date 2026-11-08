'use strict';
// Regression contract for responsive station profiles + non-song DJ artwork.
// No browser network, database, ACR vendor, or production data required.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

async function main(){
  const {resolveLiveShowArtwork,activeStationShow,isBroadcastMetadata,validShowImage}=
    await import(pathToFileURL(path.join(root,'frontend/src/utils/liveBroadcast.js')).href);
  const {parseMusicMetadata}=await import(pathToFileURL(
    path.join(root,'frontend/src/utils/musicMetadata.js')).href);
  const {showProducerNow,TEN_MINUTES}=await import(pathToFileURL(
    path.join(root,'frontend/src/utils/rdsPresentation.js')).href);

  const schedule=[{day:7,startTime:'03:00',endTime:'05:00',
    title:'Afterhours',host:'DJ Maria',imageUrl:'https://radio.example.com/maria.jpg'}];
  const station={name:'Deseo Radio',scheduleDayBase:1,schedule,logo:'/media/deseo.jpg'};
  const clock={day:7,minute:4*60+34};
  const show=activeStationShow(station,clock);
  assert.equal(show.title,'Afterhours');
  for(const marker of ['DJZONE','LIVE','DJ','RadioShow','Live DJ Set','Στον αέρα']){
    const actual=resolveLiveShowArtwork({station,nowPlaying:'',
      nowPlayingInfo:{broadcastHint:marker},clock});
    assert.equal(actual.recognizedShow,true,marker+' is a broadcast when a matching show exists');
    assert.equal(actual.imageUrl,schedule[0].imageUrl);
    assert.equal(actual.title,'Afterhours');
    assert.equal(actual.artist,'DJ Maria');
  }
  const otherDay=resolveLiveShowArtwork({station,nowPlaying:'',
    nowPlayingInfo:{broadcastHint:'DJZONE'},clock:{day:1,minute:240}});
  assert.equal(otherDay.imageUrl,null,'never show a producer outside the schedule');
  assert.equal(resolveLiveShowArtwork({station,nowPlaying:'',
    nowPlayingInfo:{},clock}).imageUrl,null,'never guess an on-air producer from schedule alone');
  const missingImage=resolveLiveShowArtwork({
    station:{...station,schedule:[{...schedule[0],imageUrl:''}]},
    nowPlayingInfo:{broadcastHint:'LIVE'},clock});
  assert.equal(missingImage.imageUrl,null,'no image keeps the old station logo');
  const song=resolveLiveShowArtwork({station,nowPlaying:'Ajna, Samm - Attract',
    nowPlayingInfo:{broadcastHint:'DJZONE'},clock});
  assert.equal(song.imageUrl,schedule[0].imageUrl,
    'song and live DJ photo must both be available for RDS rotation');
  assert.equal(TEN_MINUTES,600000);
  const rds={currentUser:{_id:'u'},stationName:station.name,
    nowPlaying:'Ajna - Attract',liveBroadcast:song};
  assert.equal(showProducerNow({...rds,at:0}),false,'first 10-minute slot is song');
  assert.equal(showProducerNow({...rds,at:TEN_MINUTES}),true,'next slot is DJ');
  assert.equal(showProducerNow({...rds,at:2*TEN_MINUTES}),false,'third slot returns to song');
  assert.equal(showProducerNow({...rds,at:TEN_MINUTES-1}),false,'switches only at boundary');
  assert.equal(showProducerNow({...rds,nowPlaying:'',at:0}),true,
    'DJ-only metadata always shows the producer photo');
  assert.equal(showProducerNow({...rds,currentUser:null,at:TEN_MINUTES}),false,
    'guests keep the existing private-metadata behavior');
  assert.equal(showProducerNow({...rds,liveBroadcast:missingImage,at:TEN_MINUTES}),false,
    'without a DJ photo never hide verified AI/song');
  assert.equal(isBroadcastMetadata('DJ Snake - Let Me Love You',station.name,show),false);
  assert.ok(parseMusicMetadata('DJ Snake - Let Me Love You',station.name));
  for(const bad of ['DJZONE - Deseo Radio','DJ SET - Afterhours','RadioShow - Evening'])
    assert.equal(parseMusicMetadata(bad,station.name),null,bad+' cannot be claimed as a song');
  assert.equal(validShowImage('https://radio.example.com/show.jpg'),true);
  assert.equal(validShowImage('http://localhost/test.jpg'),false);

  // Legacy station days 0=Monday are interpreted and supported.
  const legacy={...station,scheduleDayBase:0,
    schedule:[{...schedule[0],day:0,startTime:'00:00',endTime:'24:00'}]};
  assert.equal(activeStationShow(legacy,{day:1,minute:1439})?.title,'Afterhours');
  assert.equal(activeStationShow(legacy,{day:2,minute:0}),null);

  // No backend DB is required for the timestamp-based cached on-air hint.
  const script=read('backend/utils/stageNativeNow.js');
  const module={exports:{}};
  const build=vm.runInNewContext('(function(require,module){'+script+'\n})',{Date});
  const parseTrack=raw=>/^[^-]+ - [^-]+$/.test(raw)&&!/(DJZONE|RadioShow)/i.test(raw)?{raw}:null;
  build(key=>{
    if(key==='../models/StationPlaylist')return {};
    if(key==='./recordStationTrack')return {parseTrack};
    throw Error('Unexpected dependency '+key);
  },module);
  const native=module.exports,now=Date.now();
  const broadcastDoc={nativeShow:{raw:'DJZONE',confirmedAt:new Date(now)}};
  assert.equal(native.snapshotSong(broadcastDoc,now).broadcastHint,'DJZONE');
  assert.equal(native.snapshotSong(broadcastDoc,now+7*60*1000),null,'outdated hints expire');
  const confirmed={
    ...broadcastDoc,currentAI:{raw:'Real Artist - Real Track',kind:'manual',
      expiresAt:new Date(now+240000),recognizedAt:new Date(now-30000)}
  };
  assert.equal(native.snapshotSong(confirmed,now).source,'acrcloud',
    'manual ACR track retains priority over DJ hint');
  const combined={...broadcastDoc,nativeNow:{raw:'Real Artist - Real Track',
    confirmedAt:new Date(now),changedAt:new Date(now)}};
  assert.equal(native.snapshotSong(combined,now).broadcastHint,'DJZONE',
    'concurrent native song must preserve the on-air DJ marker');

  // Lock screen now reflects the show only when a real show image is available.
  const mediaSource=read('frontend/src/hooks/useMediaSession.js');
  const a=mediaSource.indexOf('export function mediaFields(');
  const b=mediaSource.indexOf('// Browser/iOS Media Session',a);
  assert.ok(a>=0&&b>a);
  const media=vm.runInNewContext(mediaSource.slice(a,b)
    .replace('export function mediaFields','function mediaFields')+'\nmediaFields;',
    {parseMusicMetadata,LOADING:/^(?:Βρίσκουμε το τραγούδι|Ακούμε τον σταθμό|ΠΑΙΖΕΙ ΤΩΡΑ)/i});
  const result=media({currentStation:station,currentUser:{_id:'u'},
    nowPlaying:'',nowPlayingInfo:{broadcastHint:'DJZONE'},
    liveBroadcast:resolveLiveShowArtwork({station,nowPlaying:'',
      nowPlayingInfo:{broadcastHint:'DJZONE'},clock})});
  assert.equal(result.title,'Afterhours');
  assert.equal(result.artist,'DJ Maria');
  assert.equal(result.album,'Deseo Radio - iRadios');
  assert.equal(result.image,schedule[0].imageUrl);
  assert.equal(media({currentStation:station,currentUser:null,liveBroadcast:{imageUrl:'x'}}).artist,
    'Deseo Radio','guest metadata remains private');
  assert.equal(media({currentStation:station,currentUser:{_id:'u'},
    liveBroadcast:missingImage}).title,'Τώρα Ακούς','missing show image retains station fallback');
  const real=media({currentStation:station,currentUser:{_id:'u'},
    nowPlaying:'Ajna - Attract',globalCoverArt:'https://images.example.com/track.jpg',
    nowPlayingInfo:{source:'station',foundWithAI:false},liveBroadcast:{imageUrl:schedule[0].imageUrl}});
  assert.equal(real.title,'Attract');
  assert.equal(real.image,'https://images.example.com/track.jpg');
  const djSlot=media({currentStation:station,currentUser:{_id:'u'},
    nowPlaying:'Ajna - Attract',globalCoverArt:'https://images.example.com/track.jpg',
    nowPlayingInfo:{source:'acrcloud',foundWithAI:true},
    liveBroadcast:song,rdsShowProducer:true});
  assert.equal(djSlot.title,'Afterhours');
  assert.equal(djSlot.artist,'DJ Maria');
  assert.equal(djSlot.image,schedule[0].imageUrl);
  const songSlot=media({currentStation:station,currentUser:{_id:'u'},
    nowPlaying:'Ajna - Attract',nowPlayingInfo:{source:'acrcloud',foundWithAI:true},
    liveBroadcast:song,rdsShowProducer:false});
  assert.equal(songSlot.title,'Attract');
  assert.equal(songSlot.album,'Deseo Radio - iRadios AI');

  const css=read('frontend/src/styles/station-profile.css');
  const profile=read('frontend/src/pages/StationProfile.jsx');
  const panel=read('frontend/src/components/StationPlaylistPanel.jsx');
  assert.match(css,/container-name:station-layout/);
  assert.match(css,/@container station-layout \(min-width:1160px\)/);
  assert.match(css,/@container station-layout \(max-width:530px\)/);
  assert.match(profile,/ir-station-responsive-shell/);
  assert.match(panel,/sidebar\?/);
  assert.match(read('frontend/src/App.jsx'),/liveBroadcast=\{liveBroadcast\}/);
  assert.match(read('frontend/src/components/DesktopFullPlayer.jsx'),/showProducerArt/);
  assert.match(read('frontend/src/components/MobileMiniPlayer.jsx'),/showProducerArt/);
  assert.match(read('backend/utils/stageMetadata.js'),/nativeShow/);
  console.info('PASS: responsive station layout, ten-minute song/DJ RDS, Greek show time, DJ artwork and iOS media fields.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
