import {useEffect,useMemo,useRef,useState} from 'react';
import {getAthensClock} from '../utils/schedule';
import {parseMusicMetadata} from '../utils/musicMetadata';
import {cleanMetadata} from '../utils/cleanMetadata';
import {resolveLiveShowArtwork,validShowImage} from '../utils/liveBroadcast';
import {RDS_INTERVAL_MS} from '../utils/rdsPresentation';
import {widgetSnapshot,widgetOnAirPresentation,widgetShowProducerNow} from '../utils/widgetRdsPresentation';
import {mediaFields} from './useMediaSession';

// Native RDS is safe for any public iframe. An App-equivalent snapshot is read
// only with the current listener's JWT; the server applies the same Premium gate
// as /api/metadata in App.jsx. A guest never gets somebody else's AI result.
function currentToken(){
  try{return window.localStorage.getItem('iluma_token')||'';}catch{return '';}
}
export function useStationWidgetRds(station){
  const id=String(station?._id||'');
  const [snapshot,setSnapshot]=useState({id:'',data:null,receivedAt:0,token:''});
  const [slot,setSlot]=useState(()=>Math.floor(Date.now()/RDS_INTERVAL_MS));
  const [clock,setClock]=useState(()=>getAthensClock());
  useEffect(()=>{
    if(!id){setSnapshot({id:'',data:null,receivedAt:0,token:''});return;}
    let active=true,inFlight=false,controller;
    setSnapshot({id:'',data:null,receivedAt:0,token:''});
    const update=async()=>{
      if(!active||inFlight)return;
      inFlight=true;
      controller=new AbortController();
      const token=currentToken();
      const headers=token?{Authorization:'Bearer '+token}:{};
      const read=async(url,options={})=>{
        const response=await fetch(url,{signal:controller.signal,cache:'no-store',...options});
        if(!response.ok)throw new Error('Metadata temporarily unavailable');
        return response.json();
      };
      try{
        const [publicResult,accountResult]=await Promise.allSettled([
          read('/api/catalog/widget-native/'+encodeURIComponent(id)),
          token?read('/api/metadata?stationId='+encodeURIComponent(id),{headers}):Promise.resolve(null)
        ]);
        if(!active||controller.signal.aborted)return;
        const native=publicResult.status==='fulfilled'?publicResult.value:null;
        const account=accountResult.status==='fulfilled'?accountResult.value:null;
        if(native||account){
          setSnapshot({id,data:widgetSnapshot(native,account),receivedAt:Date.now(),token});
        }else{
          // Do not keep a stale song when both metadata requests fail.
          setSnapshot({id,data:null,receivedAt:0,token});
        }
      }finally{inFlight=false;}
    };
    void update();
    const timer=setInterval(()=>void update(),15000);
    const onVisible=()=>{if(!document.hidden){setClock(getAthensClock());void update();}};
    const onStorage=event=>{if(event.key==='iluma_token')void update();};
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('pageshow',onVisible);
    window.addEventListener('storage',onStorage);
    return()=>{
      active=false;controller?.abort();clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('pageshow',onVisible);
      window.removeEventListener('storage',onStorage);
    };
  },[id]);
  useEffect(()=>{
    const tick=()=>{
      setSlot(Math.floor(Date.now()/RDS_INTERVAL_MS));
      setClock(getAthensClock());
    };
    const timer=setInterval(tick,1000);
    window.addEventListener('pageshow',tick);
    document.addEventListener('visibilitychange',tick);
    return()=>{
      clearInterval(timer);
      window.removeEventListener('pageshow',tick);
      document.removeEventListener('visibilitychange',tick);
    };
  },[]);
  // Credentials disappearing, a song expiring, or a server going offline must
  // never leave old metadata displayed indefinitely.
  const selected=snapshot.id===id&&snapshot.token===currentToken()&&
    Date.now()-snapshot.receivedAt<45000?snapshot.data:null;
  const current=selected?.source==='acrcloud'&&
    Date.parse(selected.expiresAt||'')<=Date.now()?null:selected;
  const song=useMemo(()=>parseMusicMetadata(
    cleanMetadata(current?.title||''),station?.name
  ),[current?.title,station?.name]);
  const broadcast=useMemo(()=>{
    const resolved=resolveLiveShowArtwork({
      station,nowPlaying:song?.raw||'',
      nowPlayingInfo:{source:song?current?.source||'station':'none',
        broadcastHint:current?.broadcastHint||''},clock
    });
    // A scheduled show is a real on-air source even when the station emits
    // no usable Artist - Title metadata; never invent a song.
    if(resolved.show&&!resolved.recognizedShow){
      const show=resolved.show;
      return {...resolved,recognizedShow:true,
        imageUrl:validShowImage(show.imageUrl)?show.imageUrl:null,
        title:show.title||show.host||station?.name||'Στον αέρα',
        artist:show.host||station?.name||''};
    }
    return resolved;
  },[station,song?.raw,current?.source,current?.broadcastHint,clock.day,clock.minute]);
  // Fixed 20-second alternation independent of whether a DJ photo exists.
  // With no real song, show the current scheduled program continuously.
  const showProducer=widgetShowProducerNow(song,broadcast?.show,slot*RDS_INTERVAL_MS,RDS_INTERVAL_MS);
  const display=widgetOnAirPresentation({song,broadcast,showProducer,station});
  return {song,broadcast,showProducer,display,source:current?.source||'none',
    foundWithAI:Boolean(current?.foundWithAI),activeShow:broadcast.show};
}
function absoluteArtwork(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{
    const u=new URL(value,window.location.origin);
    return ['http:','https:'].includes(u.protocol)&&
      (window.location.protocol!=='https:'||u.protocol==='https:')?u.href:null;
  }catch{return null;}
}
function artworkMimeType(url){
  if(/\.png(?:[?#]|$)/i.test(url))return 'image/png';
  if(/\.webp(?:[?#]|$)/i.test(url))return 'image/webp';
  if(/\.jpe?g(?:[?#]|$)/i.test(url))return 'image/jpeg';
  return undefined;
}
export function useStationWidgetMediaSession({station,rds,audio,artwork,enabled=true}){
  const latest=useRef(null);
  latest.current={audio};
  const song=rds?.song;
  const broadcast=rds?.broadcast;
  const showProducer=rds?.showProducer;
  const display=rds?.display;
  useEffect(()=>{
    if(!enabled||!station||!('mediaSession' in navigator)||typeof window.MediaMetadata!=='function')return;
    const fields=mediaFields({
      currentStation:station,nowPlaying:song?.raw||'',currentUser:{role:'public-widget'},
      nowPlayingInfo:{source:rds?.source||'none',foundWithAI:rds?.foundWithAI===true},
      isPlayingAd:false,globalCoverArt:artwork||null,
      liveBroadcast:broadcast,rdsShowProducer:showProducer
    });
    const logo=absoluteArtwork(station.logo||'/iradios-logo.png');
    // Consistent with App: the active song's cover or DJ photo goes to the
    // lockscreen; station branding remains the last, stable fallback.
    const image=absoluteArtwork(fields.image)||logo;
    const title=display?.kind==='station'||(display?.kind==='show'&&!broadcast?.imageUrl)
      ?display.title:fields.title;
    const artist=display?.kind==='station'||(display?.kind==='show'&&!broadcast?.imageUrl)
      ?display.artist:fields.artist;
    try{
      navigator.mediaSession.metadata=new window.MediaMetadata({
        title,artist,album:fields.album,
        artwork:image?[96,128,256,512].map(size=>({
          src:image,sizes:size+'x'+size,
          ...(artworkMimeType(image)?{type:artworkMimeType(image)}:{})
        })):[]
      });
      navigator.mediaSession.playbackState=audio.playing?'playing':'paused';
    }catch{}
  },[enabled,station?._id,station?.name,station?.logo,song?.raw,broadcast?.title,
    broadcast?.artist,broadcast?.imageUrl,display?.kind,display?.title,display?.artist,
    rds?.source,rds?.foundWithAI,showProducer,artwork,audio.playing]);
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
