import {useEffect,useRef} from 'react';

const FIVE_MINUTES=5*60*1000;
const LOADING=/^(?:Βρίσκουμε το τραγούδι|Ακούμε τον σταθμό|Ψάχνουμε το τραγούδι|Λίγο ακόμη|Σχεδόν έτοιμο|ΠΑΙΖΕΙ ΤΩΡΑ)/i;
function musicParts(value){
  if(typeof value!=='string'||LOADING.test(value))return null;
  const match=value.trim().match(/^(.{1,150}?)\s+[-–—]\s+(.{1,150})$/);
  if(!match)return null;
  return {artist:match[1].trim(),title:match[2].trim()};
}
function artworkType(url){
  if(/\.png(?:[?#]|$)/i.test(url))return 'image/png';
  if(/\.webp(?:[?#]|$)/i.test(url))return 'image/webp';
  if(/\.jpe?g(?:[?#]|$)/i.test(url))return 'image/jpeg';
  return undefined;
}
export function mediaFields({currentStation,nowPlaying,nowPlayingInfo,currentUser,
  isPlayingAd,currentAdInfo,globalCoverArt}){
  const name=currentStation?.name||'iRadios';
  if(!currentUser)return {
    title:'Login στο iRadios για NowPlaying',
    artist:name,album:'iRadios',image:currentStation?.logo
  };
  if(isPlayingAd)return {
    title:currentAdInfo?.title||'Διαφήμιση',
    artist:currentAdInfo?.client||'iRadios',
    album:'iRadios',
    image:currentAdInfo?.logoUrl||currentStation?.logo
  };
  const parts=musicParts(nowPlaying);
  const ai=Boolean(parts&&nowPlayingInfo?.source==='acrcloud'&&nowPlayingInfo?.foundWithAI);
  if(parts)return {
    title:parts.title,artist:parts.artist,
    album:ai?`${name} - iRadios AI`:`${name} - iRadios`,
    image:globalCoverArt||currentStation?.logo,
    foundWithAI:ai
  };
  return {title:name,artist:'Ζωντανό ραδιόφωνο',album:'iRadios',image:currentStation?.logo};
}
// Browser/iOS Media Session controls are one shared audio session; the source
// audio element is owned by App.jsx. Native song changes are batched at 5 minutes.
// Station change, guest/login, ads and the first AI match update immediately.
export default function useMediaSession({
  currentStation,nowPlaying,nowPlayingInfo,isPlaying,isPlayingAd,currentAdInfo,
  togglePlayPause,handleNextStation,handlePrevStation,globalCoverArt,currentUser
}){
  const latest=useRef({});
  latest.current={currentStation,nowPlaying,nowPlayingInfo,isPlaying,isPlayingAd,currentAdInfo,
    togglePlayPause,handleNextStation,handlePrevStation,globalCoverArt,currentUser};
  const last=useRef({key:null,at:0,ai:false,image:null});
  const write=()=>{
    if(typeof navigator==='undefined'||!('mediaSession' in navigator)||
       typeof window.MediaMetadata!=='function')return;
    const data=latest.current;
    if(!data.currentStation)return;
    const fields=mediaFields(data);
    // Radio logos may be /uploads/... paths; Media Session artwork needs an absolute URL.
    // Prefer album art, then fall back to the station logo when media cannot be loaded.
    let image=null;
    for(const src of [fields.image,data.currentStation.logo]){
      if(typeof src!=='string'||!src.trim())continue;
      try{
        const url=new URL(src,window.location.origin);
        if(!['https:','http:'].includes(url.protocol))continue;
        if(window.location.protocol==='https:'&&url.protocol!=='https:')continue;
        image=url.href;break;
      }catch{ /* malformed artwork URL; try the station logo */ }
    }
    const metadata={
      title:fields.title,artist:fields.artist,album:fields.album,
      artwork:image?[96,128,256,512].map(size=>({
        src:image,sizes:`${size}x${size}`,...(artworkType(image)?{type:artworkType(image)}:{})
      })):[]
    };
    try{
      navigator.mediaSession.metadata=new window.MediaMetadata(metadata);
      navigator.mediaSession.playbackState=data.isPlaying?'playing':'paused';
      last.current={key:[data.currentStation?._id,Boolean(data.currentUser),
        Boolean(data.isPlayingAd),data.currentAdInfo?._id].join(':'),
        at:Date.now(),ai:Boolean(fields.foundWithAI),image};
    }catch{ /* mediaSession may be unavailable on some WebViews; radio still plays */ }
  };
  useEffect(()=>{
    if(!currentStation || (!isPlaying && last.current.key===null))return;
    const key=[currentStation._id,Boolean(currentUser),Boolean(isPlayingAd),currentAdInfo?._id].join(':');
    const fields=mediaFields(latest.current);
    const firstAI=Boolean(fields.foundWithAI)&&!last.current.ai;
    const coverArrival=Boolean(fields.foundWithAI&&globalCoverArt&&last.current.image!==globalCoverArt);
    if(last.current.key!==key||firstAI||coverArrival||Date.now()-last.current.at>=FIVE_MINUTES){
      write();
    }else if('mediaSession' in navigator){
      navigator.mediaSession.playbackState=isPlaying?'playing':'paused';
    }
  },[currentStation?._id,currentUser?._id,isPlaying,isPlayingAd,currentAdInfo?._id,
    nowPlaying,nowPlayingInfo?.foundWithAI,nowPlayingInfo?.source,globalCoverArt]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      if(latest.current.currentStation&&latest.current.isPlaying)write();
    },FIVE_MINUTES);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    if(typeof navigator==='undefined'||!('mediaSession' in navigator))return;
    const handlers={
      play:()=>latest.current.togglePlayPause?.(),
      pause:()=>latest.current.togglePlayPause?.(),
      nexttrack:()=>latest.current.handleNextStation?.(),
      previoustrack:()=>latest.current.handlePrevStation?.(),
      stop:()=>{if(latest.current.isPlaying)latest.current.togglePlayPause?.();}
    };
    for(const [action,handler] of Object.entries(handlers)){
      try{navigator.mediaSession.setActionHandler(action,handler);}catch{}
    }
    return ()=>{
      for(const action of Object.keys(handlers)){
        try{navigator.mediaSession.setActionHandler(action,null);}catch{}
      }
    };
  },[]);
}
