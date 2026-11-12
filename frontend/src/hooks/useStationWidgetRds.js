import {useEffect,useMemo,useRef,useState} from 'react';
import {getAthensClock} from '../utils/schedule';
import {parseMusicMetadata} from '../utils/musicMetadata';
import {resolveLiveShowArtwork} from '../utils/liveBroadcast';
import {showProducerNow,RDS_INTERVAL_MS} from '../utils/rdsPresentation';
import {mediaFields} from './useMediaSession';

// Widget data is server-verified *native* station metadata. AI recognition
// must never be inferred from, or fetched via, the public widget endpoint.
export function useStationWidgetRds(station){
  const [snapshot,setSnapshot]=useState(null);
  const [slot,setSlot]=useState(()=>Math.floor(Date.now()/RDS_INTERVAL_MS));
  const [clock,setClock]=useState(()=>getAthensClock());
  useEffect(()=>{
    if(!station?._id){setSnapshot(null);return;}
    let active=true;
    const controller=new AbortController();
    const update=async()=>{
      try{
        const response=await fetch('/api/catalog/widget-native/'+encodeURIComponent(station._id),{
          signal:controller.signal,cache:'no-store'
        });
        if(!response.ok)throw new Error('Native metadata unavailable');
        const data=await response.json();
        if(active)setSnapshot(data?.source==='station'||data?.broadcastHint?data:null);
      }catch{
        if(active&&!controller.signal.aborted)setSnapshot(null);
      }
    };
    setSnapshot(null);update();
    const timer=setInterval(update,20000);
    const onVisible=()=>{if(!document.hidden){update();setClock(getAthensClock());}};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{active=false;controller.abort();clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisible);};
  },[station?._id]);
  useEffect(()=>{
    const tick=()=>{
      setSlot(Math.floor(Date.now()/RDS_INTERVAL_MS));
      setClock(getAthensClock());
    };
    const timer=setInterval(tick,1000);
    window.addEventListener('pageshow',tick);
    document.addEventListener('visibilitychange',tick);
    return()=>{clearInterval(timer);window.removeEventListener('pageshow',tick);
      document.removeEventListener('visibilitychange',tick);};
  },[]);
  const song=useMemo(()=>parseMusicMetadata(snapshot?.title||'',station?.name),[snapshot?.title,station?.name]);
  const broadcast=useMemo(()=>resolveLiveShowArtwork({
    station,nowPlaying:song?.raw||'',
    nowPlayingInfo:{source:song?'station':'none',broadcastHint:snapshot?.broadcastHint||''},
    clock
  }),[station,song?.raw,snapshot?.broadcastHint,clock.day,clock.minute]);
  const showProducer=showProducerNow({
    currentUser:{role:'public-widget'},stationName:station?.name,
    nowPlaying:song?.raw||'',liveBroadcast:broadcast,at:slot*RDS_INTERVAL_MS
  });
  return {song,broadcast,showProducer};
}
function absoluteLogo(logo){
  try{
    const url=new URL(logo||'/iradios-logo.png',window.location.origin);
    if(url.protocol!=='https:'&&window.location.protocol==='https:')return null;
    return ['https:','http:'].includes(url.protocol)?url.href:null;
  }catch{return null;}
}
export function useStationWidgetMediaSession({station,rds,audio,enabled=true}){
  const latest=useRef(null);
  latest.current={audio};
  const song=rds?.song;
  const broadcast=rds?.broadcast;
  const showProducer=rds?.showProducer;
  useEffect(()=>{
    if(!enabled||!station||!('mediaSession' in navigator)||typeof window.MediaMetadata!=='function')return;
    // The same metadata presentation fields as iRadios, sourced from the
    // public native-only widget API. A symbolic viewer only enables formatting:
    // all entitlement filtering was performed on the server.
    const fields=mediaFields({
      currentStation:station,nowPlaying:song?.raw||'',currentUser:{role:'public-widget'},
      nowPlayingInfo:{source:'station',foundWithAI:false},
      isPlayingAd:false,globalCoverArt:null,
      liveBroadcast:broadcast,rdsShowProducer:showProducer
    });
    const logo=absoluteLogo(station.logo);
    const type=/\.png(?:[?#]|$)/i.test(logo||'')?'image/png':
      /\.webp(?:[?#]|$)/i.test(logo||'')?'image/webp':
      /\.jpe?g(?:[?#]|$)/i.test(logo||'')?'image/jpeg':undefined;
    try{
      navigator.mediaSession.metadata=new window.MediaMetadata({
        title:fields.title,artist:fields.artist,album:fields.album,
        // Station identity remains the logo even as songs or DJs rotate.
        artwork:logo?[96,128,256,512].map(size=>({
          src:logo,sizes:size+'x'+size,...(type?{type}:{})
        })):[]
      });
      navigator.mediaSession.playbackState=audio.playing?'playing':'paused';
    }catch{ /* Some embedded browsers do not support lock-screen APIs. */ }
  },[enabled,station?._id,station?.name,station?.logo,song?.raw,broadcast?.title,
    broadcast?.artist,broadcast?.imageUrl,showProducer,audio.playing]);
  useEffect(()=>{
    if(!enabled||!('mediaSession' in navigator))return;
    const handlers={
      play:()=>{if(!latest.current?.audio.playing)latest.current?.audio.toggle();},
      pause:()=>{if(latest.current?.audio.playing)latest.current?.audio.toggle();},
      stop:()=>{if(latest.current?.audio.playing)latest.current?.audio.toggle();}
    };
    for(const [action,handler] of Object.entries(handlers)){
      try{navigator.mediaSession.setActionHandler(action,handler);}catch{}
    }
    return()=>{
      for(const action of Object.keys(handlers)){
        try{navigator.mediaSession.setActionHandler(action,null);}catch{}
      }
      try{navigator.mediaSession.playbackState='none';}catch{}
    };
  },[enabled]);
}
