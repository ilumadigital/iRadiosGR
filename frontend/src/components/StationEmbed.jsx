import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useParams,useSearchParams} from 'react-router-dom';
import {Helmet} from 'react-helmet-async';
import {ArrowUpRight,CalendarDays,Loader2,Pause,Play,Volume2,VolumeX} from 'lucide-react';
import {SiSpotify,SiApplemusic} from 'react-icons/si';
import RdsCrossfade from './RdsCrossfade';
import {spotifySongLink,appleMusicSongLink} from '../utils/musicMetadata';
import {useStationWidgetRds,useStationWidgetMediaSession} from '../hooks/useStationWidgetRds';
import useAudioDSP from '../hooks/useAudioDSP';
import {getAthensClock,minutes,scheduleDayBase,toCanonical} from '../utils/schedule';
import '../styles/station-embeds.css';

const EMBED_TYPES=new Set(['player-square','player-mini','program-square','program-mini','hero']);
const classNames=(...parts)=>parts.filter(Boolean).join(' ');

function useStation(stationId){
  const [station,setStation]=useState(null);
  const [status,setStatus]=useState('loading');
  useEffect(()=>{
    let mounted=true;
    const fetchStation=async()=>{
      try{
        const res=await fetch('/api/stations',{cache:'no-store'});
        if(!res.ok)throw Error('Δεν ήταν δυνατή η φόρτωση του σταθμού.');
        const stations=await res.json();
        const found=Array.isArray(stations)?stations.find(s=>
          s.status==='approved'&&(String(s._id)===stationId||s.slug===stationId)):null;
        if(!mounted)return;
        setStation(found||null);
        setStatus(found?'ready':'missing');
      }catch{
        if(mounted)setStatus(prev=>prev==='ready'?prev:'error');
      }
    };
    setStation(null);setStatus('loading');fetchStation();
    const interval=setInterval(fetchStation,60000);
    return()=>{mounted=false;clearInterval(interval);};
  },[stationId]);
  return {station,status};
}
function useProgram(station){
  const [clock,setClock]=useState(()=>getAthensClock());
  useEffect(()=>{
    const id=setInterval(()=>setClock(getAthensClock()),30000);
    return()=>clearInterval(id);
  },[]);
  const shows=useMemo(()=>{
    const source=station?.schedule||[];
    return toCanonical(source,scheduleDayBase(source,station?.scheduleDayBase))
    .map((show,index)=>({...show,endTime:source[index]?.endTime==='24:00'?'24:00':show.endTime}))
    .filter(s=>Number.isFinite(minutes(s.startTime))&&
      Number.isFinite(minutes(s.endTime,true))&&Number(s.day)>=1&&Number(s.day)<=7)
    .sort((a,b)=>Number(a.day)-Number(b.day)||a.startTime.localeCompare(b.startTime));
  },[station]);
  const current=shows.find(s=>Number(s.day)===clock.day&&
    clock.minute>=minutes(s.startTime)&&clock.minute<minutes(s.endTime,true))||null;
  const indexNow=(clock.day-1)*1440+clock.minute;
  const upcoming=shows.map(s=>{
    let from=(Number(s.day)-1)*1440+minutes(s.startTime)-indexNow;
    if(from<=0)from+=10080;
    return {...s,minutesUntil:from};
  }).sort((a,b)=>a.minutesUntil-b.minutesUntil).slice(0,3);
  return {current,upcoming,shows};
}
function useLiveAudio(station){
  const dspRef=useRef(null),rawRef=useRef(null),requestId=useRef(0);
  const [playing,setPlaying]=useState(false);
  const [buffering,setBuffering]=useState(false);
  const [error,setError]=useState('');
  const [bypass,setBypass]=useState(false);
  const [volume,setVolume]=useState(0.75);
  const deviceRaw=typeof navigator!=='undefined'&&
    (/iPad|iPhone|iPod|SMART-TV|Tizen|Web0S|WebOS|TV/.test(navigator.userAgent)||
      (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
  // This is the entitlement-masked public station state, not a legacy account flag.
  const hasDSP=Boolean(station?.dspPreset&&station.dspPreset!=='OFF');
  const processing=hasDSP&&!bypass&&!deviceRaw;
  const {resumeDSP}=useAudioDSP(dspRef,station,null,false,deviceRaw,null,{});

  const stop=useCallback(()=>{
    requestId.current+=1;
    for(const audio of [dspRef.current,rawRef.current]){
      if(audio){audio.pause();audio.removeAttribute('src');}
    }
    setPlaying(false);setBuffering(false);
  },[]);
  const start=useCallback(async(forceBypass)=>{
    const stream=station?.streamUrl||station?.stream;
    if(!stream)return;
    const useDsp=hasDSP&&!deviceRaw&&!(forceBypass??bypass);
    const id=++requestId.current;
    setError('');setBuffering(true);
    for(const audio of [dspRef.current,rawRef.current]){
      if(audio){audio.pause();audio.removeAttribute('src');}
    }
    const audio=(useDsp?dspRef:rawRef).current;
    if(!audio)return;
    if(useDsp)resumeDSP();
    audio.volume=volume;
    audio.src=useDsp?'/api/proxy-stream?url='+encodeURIComponent(stream):stream;
    try{
      await audio.play();
      if(id!==requestId.current){audio.pause();return;}
      setPlaying(true);setBuffering(false);
    }catch{
      if(id===requestId.current){
        setPlaying(false);setBuffering(false);
        setError(useDsp?'Δεν ακούς ήχο; Δοκίμασε το No Sound? Click Here.':'Το stream δεν είναι διαθέσιμο.');
      }
    }
  },[station?.stream,station?.streamUrl,hasDSP,deviceRaw,bypass,resumeDSP,volume]);
  const toggle=()=>playing?stop():start();
  const switchProcessing=()=>{
    const next=!bypass;
    setBypass(next);
    if(playing)start(next);
  };
  useEffect(()=>{
    setBypass(false);stop();setError('');
    return()=>{requestId.current+=1;dspRef.current?.pause();rawRef.current?.pause();};
  },[station?._id,stop]);
  useEffect(()=>{
    if(dspRef.current)dspRef.current.volume=volume;
    if(rawRef.current)rawRef.current.volume=volume;
  },[volume]);
  return {dspRef,rawRef,playing,buffering,error,volume,setVolume,hasDSP,processing,
    bypass,toggle,switchProcessing};
}
function ProfileLink({station,compact=false,light=false}){
  return <a href={'/station/'+encodeURIComponent(station.slug||station._id)}
    target="_blank" rel="noopener noreferrer"
    className={classNames('inline-flex items-center gap-1.5 text-[11px] font-bold transition hover:underline',
      light?'text-zinc-600 hover:text-violet-700':'text-zinc-400 hover:text-white')}
    aria-label={'Δες το προφίλ του '+station.name+' στο iRadios'}>
    {compact?'Στο iRadios.gr':'Δείτε τον σταθμό στο iRadios.gr'}<ArrowUpRight size={13}/>
  </a>;
}
function HdControls({audio,compact=false,light=false}){
  if(!audio.hasDSP)return null;
  return <div className={classNames('flex flex-wrap items-center gap-2',compact?'text-[9px]':'text-[11px]')}>
    <span className={classNames('rounded-full border px-2 py-1 font-black tracking-wider',
      audio.processing?'border-lime-300/30 bg-lime-300/10 text-lime-300':
      light?'border-zinc-300 bg-zinc-100 text-zinc-600':'border-white/15 bg-white/5 text-zinc-400')}>
      {audio.processing?'HD+':'STREAM'}
    </span>
    {!audio.bypass&&!audio.processing?null:
      <button type="button" onClick={audio.switchProcessing}
        className={classNames('rounded-full border px-2.5 py-1 font-semibold transition',
          light?'border-zinc-200 text-zinc-600 hover:bg-zinc-100':
            'border-white/15 text-zinc-300 hover:border-lime-300/35 hover:text-lime-300')}>
        {audio.bypass?'Enable HD+':'No Sound? Click Here'}
      </button>}
  </div>;
}
function AudioElements({audio}){
  return <>
    <audio ref={audio.dspRef} crossOrigin="anonymous" preload="none"/>
    <audio ref={audio.rawRef} preload="none"/>
  </>;
}
function PlaybackButton({audio,large=false}){
  return <button type="button" onClick={audio.toggle}
    aria-label={audio.playing?'Παύση':'Άκου ζωντανά'}
    className={classNames('inline-flex shrink-0 items-center justify-center rounded-full bg-[#caff00] text-[#101509] shadow-[0_12px_30px_rgba(202,255,0,.17)] transition hover:scale-105 active:scale-95',
      large?'size-[76px]':'size-12')}>
    {audio.buffering?<Loader2 size={large?28:21} className="animate-spin"/>:
      audio.playing?<Pause size={large?29:22} fill="currentColor"/>:
      <Play size={large?29:22} className="ml-0.5" fill="currentColor"/>}
  </button>;
}
function VolumeSlider({audio,light=false}){
  return <div className="flex min-w-0 items-center gap-2">
    <button type="button" aria-label={audio.volume>0?'Σίγαση':'Επαναφορά έντασης'}
      className={light?'text-zinc-600':'text-zinc-300'}
      onClick={()=>audio.setVolume(v=>v===0?0.75:0)}>
      {audio.volume===0?<VolumeX size={17}/>:<Volume2 size={17}/>}
    </button>
    <input aria-label="Ένταση" type="range" min="0" max="1" step="0.01"
      value={audio.volume} onChange={e=>audio.setVolume(Number(e.target.value))}
      className="h-1 w-24 max-w-full accent-[#caff00]"/>
  </div>;
}
function useCoverArtwork(station,song){
  const stationId=String(station?._id||'');
  const track=song?.raw||'';
  const key=stationId+'|'+track;
  const [cover,setCover]=useState({key:'',url:null});
  useEffect(()=>{
    setCover({key:'',url:null});
    if(!stationId||!track)return;
    const controller=new AbortController();
    let active=true;
    (async()=>{
      try{
        const response=await fetch('/api/cover-art?term='+encodeURIComponent(track),{
          signal:controller.signal,cache:'no-store'
        });
        if(!response.ok)throw new Error('Cover unavailable');
        const data=await response.json();
        let url=null;
        if(typeof data?.artworkUrl==='string'){
          try{
            const found=new URL(data.artworkUrl);
            if(found.protocol==='https:')url=found.href;
          }catch{}
        }
        if(active)setCover({key,url});
      }catch{
        if(active&&!controller.signal.aborted)setCover({key,url:null});
      }
    })();
    return()=>{active=false;controller.abort();};
  },[stationId,track,key]);
  return cover.key===key?cover.url:null;
}
function ArtworkVisual({station,src,className='',alt=''}){
  const logo=station?.logo||'/iradios-logo.png';
  const [failed,setFailed]=useState(null);
  const photo=Boolean(src&&src!==logo&&failed!==src);
  return <img src={photo?src:logo} alt={alt}
    className={classNames(className,!photo&&'is-logo')}
    onError={event=>{
      if(photo){setFailed(src);return;}
      if(!event.currentTarget.src.endsWith('/iradios-logo.png'))
        event.currentTarget.src='/iradios-logo.png';
    }}/>;
}
function ArtworkBackground({station,src,showSrc,showSecondary=false}){
  return <div className="ir-embed__art" aria-hidden="true">
    <ArtworkVisual station={station} src={src}/>
    {showSrc&&<ArtworkVisual station={station} src={showSrc}
      className={classNames('ir-embed__overlay',showSecondary&&'is-active')}/>}
  </div>;
}
function ArtworkStack({station,rds,className='',alt=''}){
  const showSrc=rds.broadcast?.imageUrl;
  return <div className={classNames('relative overflow-hidden',className)}>
    <ArtworkVisual station={station} src={rds.artwork}
      className="absolute inset-0 size-full object-cover" alt={alt}/>
    {showSrc&&<ArtworkVisual station={station} src={showSrc}
      className={classNames('ir-embed__overlay absolute inset-0 size-full object-cover',
        rds.showProducer&&'is-active')} alt={alt}/>}
  </div>;
}
function RdsHeadline({station,rds,hero=false,mini=false}){
  const song=rds.song;
  const fallback=rds.display;
  const show=rds.broadcast?.recognizedShow&&rds.broadcast?.imageUrl&&song;
  const titleClass=hero?'ir-embed__hero-title line-clamp-3':
    mini?'line-clamp-2 text-[16px] font-black leading-tight':'ir-embed__song-title';
  const artistClass=hero?'mt-3 truncate text-xl font-semibold text-white/80 sm:text-[27px]':
    mini?'mt-1 truncate text-[11px] text-white/75':'ir-embed__artist mt-2';
  const pane=(title,artist,kind)=> <div className="min-w-0">
    {!mini&&<p className="ir-embed__eyebrow mb-3">
      {kind==='song'?'NOW PLAYING / TRACK':kind==='show'?'● ΣΤΟΝ ΑΕΡΑ ΤΩΡΑ':'● LIVE RADIO'}
    </p>}
    <h1 className={titleClass} title={title}>{title}</h1>
    <p className={artistClass}>{artist}</p>
  </div>;
  return <RdsCrossfade
    secondary={show?pane(rds.broadcast.title||station.name,
      rds.broadcast.artist||station.name,'show'):null}
    showSecondary={Boolean(show&&rds.showProducer)}>
    {pane(song?.title||fallback.title,song?.artist||fallback.artist,
      song?'song':fallback.kind)}
  </RdsCrossfade>;
}
function RdsTicker({station,rds}){
  const song=rds.song;
  const show=Boolean(song&&rds.broadcast?.recognizedShow&&rds.broadcast?.imageUrl);
  const format=(title,artist)=><span className="block min-w-0 truncate">
    {title}{artist?' · '+artist:''}
  </span>;
  return <RdsCrossfade secondary={show?format(
    rds.broadcast.title||station.name,rds.broadcast.artist||station.name):null}
    showSecondary={Boolean(show&&rds.showProducer)}>
    {format(song?.title||rds.display.title,song?.artist||rds.display.artist)}
  </RdsCrossfade>;
}
function StationIdentity({station,compact=false}){
  return <div className="flex min-w-0 items-center gap-2.5">
    <ArtworkVisual station={station} className="ir-embed__station-img"/>
    <div className="min-w-0">
      <p className={classNames('truncate font-black',compact?'text-[11px]':'text-[13px]')}>{station.name}</p>
      <p className="truncate text-[9px] font-bold uppercase tracking-widest text-white/65">● LIVE RADIO</p>
    </div>
  </div>;
}

function MusicSearchLinks({station,song}){
  if(!song)return null;
  const spotify=spotifySongLink(song.raw,station.name);
  const apple=appleMusicSongLink(song.raw,station.name);
  if(!spotify||!apple)return null;
  const shared='inline-flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1.5 font-bold transition hover:border-[#caff00]/40 hover:text-[#caff00]';
  return <div className="ir-embed__song-actions" aria-label="Αναζήτησε το τρέχον τραγούδι">
    <a href={spotify} target="_blank" rel="noopener noreferrer" className={shared}
      aria-label={'Βρες '+song.raw+' στο Spotify'} title="Αναζήτηση στο Spotify">
      <SiSpotify aria-hidden="true"/><span>Spotify</span>
    </a>
    <a href={apple} target="_blank" rel="noopener noreferrer" className={shared}
      aria-label={'Βρες '+song.raw+' στο Apple Music'} title="Αναζήτηση στο Apple Music">
      <SiApplemusic aria-hidden="true"/><span>Apple Music</span>
    </a>
  </div>;
}
function SquarePlayer({station,rds,audio,light}){
  const song=rds.song;
  return <main className="ir-embed flex flex-col" data-theme={light?'light':'dark'}>
    <AudioElements audio={audio}/>
    <ArtworkBackground station={station} src={rds.artwork}
      showSrc={rds.broadcast?.imageUrl} showSecondary={rds.showProducer}/>
    <div className="ir-embed__shade"/>
    <header className="relative z-10 flex shrink-0 items-start justify-between gap-2 px-5 pt-5">
      <StationIdentity station={station} compact/>
      <HdControls audio={audio} compact/>
    </header>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col justify-end px-5 pb-4 pt-3">
      <RdsHeadline station={station} rds={rds}/>
      {song&&!rds.showProducer&&<div className="mt-4">
        <MusicSearchLinks station={station} song={song}/>
      </div>}
    </section>
    <footer className="ir-embed__controls relative z-10 shrink-0 px-5 pb-3 pt-3">
      <div className="flex items-center justify-between gap-2">
        <PlaybackButton audio={audio} large/>
        <VolumeSlider audio={audio}/>
      </div>
      {audio.error&&<p role="status" className="mt-2 text-[10px] text-amber-300">{audio.error}</p>}
      <div className="mt-2 flex justify-end"><ProfileLink station={station} compact/></div>
    </footer>
  </main>;
}
function MiniPlayer({station,rds,audio,light}){
  const song=rds.song;
  return <main className="ir-embed flex flex-col justify-between" data-theme={light?'light':'dark'}>
    <AudioElements audio={audio}/>
    <ArtworkBackground station={station} src={rds.artwork}
      showSrc={rds.broadcast?.imageUrl} showSecondary={rds.showProducer}/>
    <div className="ir-embed__shade"/>
    <div className="relative z-10 flex min-h-0 items-start gap-3 p-4">
      <ArtworkStack station={station} rds={rds}
        className="size-[74px] shrink-0 rounded-2xl border border-white/20 bg-black/50"
        alt={rds.display.title}/>
      <div className="min-w-0 flex-1">
        <span className="ir-embed__eyebrow">● {station.name}</span>
        <RdsHeadline station={station} rds={rds} mini/>
      </div>
      <PlaybackButton audio={audio}/>
    </div>
    <div className="relative z-10 px-4 pb-2">
      {song&&!rds.showProducer&&<MusicSearchLinks station={station} song={song}/>}
    </div>
    <footer className="ir-embed__controls relative z-10 flex flex-col gap-2 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HdControls audio={audio} compact/>
        <VolumeSlider audio={audio}/>
      </div>
      {audio.error&&<p role="status" className="text-[10px] text-amber-300">{audio.error}</p>}
      <div className="flex justify-end"><ProfileLink station={station} compact/></div>
    </footer>
  </main>;
}


function ShowLine({show,live=false,station}){
  return <div className={classNames('ir-embed__program-card flex min-w-0 items-center gap-2.5 rounded-xl p-2',live&&'is-live')}>
    <ArtworkVisual station={station} src={show?.imageUrl}
      className="size-11 shrink-0 rounded-lg object-cover"/>
    <div className="min-w-0 flex-1">
      <p className={classNames('truncate text-[9px] font-black uppercase tracking-wider',
        live?'text-[#caff00]':'text-white/65')}>
        {live?'● ΣΤΟΝ ΑΕΡΑ ΤΩΡΑ':(show?.startTime||'—')+' – '+(show?.endTime||'—')}
      </p>
      <p className="ir-embed__program-title mt-1 text-[12px]">{show?.title||'Ζωντανό πρόγραμμα'}</p>
      {show?.host&&<p className="mt-0.5 truncate text-[10px] text-white/65">{show.host}</p>}
    </div>
  </div>;
}
function Program({station,current,upcoming,light,mini,rds,audio}){
  const active=current||{title:'Ζωντανό ραδιόφωνο',host:station.slogan||station.name};
  if(mini)return <main className="ir-embed flex flex-col" data-theme={light?'light':'dark'}>
    <AudioElements audio={audio}/>
    <ArtworkBackground station={station} src={active.imageUrl}/>
    <div className="ir-embed__shade ir-embed__shade--program"/>
    <header className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
      <span className="ir-embed__eyebrow">● ΠΡΟΓΡΑΜΜΑ / LIVE</span>
      <StationIdentity station={station} compact/>
    </header>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col justify-end gap-2 px-4 py-2">
      <h1 className="line-clamp-2 text-xl font-black leading-tight">{active.title}</h1>
      <p className="truncate text-xs font-semibold text-white/80">{active.host||station.name}</p>
      {rds.song&&<div className="min-w-0 text-[11px] font-semibold text-white/80">
        <RdsTicker station={station} rds={rds}/>
      </div>}
      {upcoming[0]&&<ShowLine station={station} show={upcoming[0]}/>
    </section>
    <footer className="ir-embed__controls relative z-10 shrink-0 px-4 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PlaybackButton audio={audio}/>
        <VolumeSlider audio={audio}/>
        <HdControls audio={audio} compact/>
      </div>
      {audio.error&&<p role="status" className="mt-1 text-[10px] text-amber-300">{audio.error}</p>}
      <div className="mt-1 flex justify-end"><ProfileLink station={station} compact/></div>
    </footer>
  </main>;
  return <main className="ir-embed flex flex-col" data-theme={light?'light':'dark'}>
    <AudioElements audio={audio}/>
    <ArtworkBackground station={station} src={active.imageUrl}/>
    <div className="ir-embed__shade ir-embed__shade--program"/>
    <header className="relative z-10 flex shrink-0 items-start justify-between gap-2 px-5 pt-5">
      <div className="min-w-0">
        <p className="ir-embed__eyebrow flex items-center gap-1.5">
          <CalendarDays size={14}/> ΠΡΟΓΡΑΜΜΑ ΣΤΑΘΜΟΥ
        </p>
        <p className="mt-1 truncate text-sm font-black">{station.name}</p>
      </div>
      <ArtworkVisual station={station} className="ir-embed__station-img"/>
    </header>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col justify-end gap-2 px-5 pb-3">
      <p className="ir-embed__eyebrow">● ΣΤΟΝ ΑΕΡΑ ΤΩΡΑ</p>
      <h1 className="line-clamp-2 text-[clamp(21px,6cqw,31px)] font-black leading-tight tracking-tight">
        {active.title}
      </h1>
      <p className="truncate text-sm font-semibold text-white/80">{active.host||station.name}</p>
      <div className="mt-2 grid min-h-0 gap-2">
        {upcoming.slice(0,2).map((show,i)=><ShowLine key={[show.day,show.startTime,i].join('-')}
          show={show} station={station}/>)}
        {!current&&!upcoming.length&&<p className="text-xs text-white/70">
          Το πρόγραμμα θα εμφανιστεί όταν ενημερωθεί από τον σταθμό.
        </p>}
      </div>
    </section>
    <footer className="ir-embed__controls relative z-10 shrink-0 px-5 pb-3 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PlaybackButton audio={audio}/>
        <VolumeSlider audio={audio}/>
        <HdControls audio={audio} compact/>
      </div>
      {audio.error&&<p className="mt-1 text-[10px] text-amber-300" role="status">{audio.error}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 text-[10px] font-semibold text-white/70">
          <RdsTicker station={station} rds={rds}/>
        </div>
        <ProfileLink station={station} compact/>
      </div>
    </footer>
  </main>;
}


function Hero({station,current,rds,audio}){
  const song=rds.song;
  return <main className="ir-embed ir-embed__hero-stage flex min-h-[480px] flex-col justify-center px-5 py-5 sm:px-8 lg:px-[5%]">
    <AudioElements audio={audio}/>
    <div className="ir-embed__hero-wave"/>
    <div className="relative z-10 mx-auto grid w-full max-w-[1550px] flex-1 content-center items-center gap-5 md:grid-cols-[1.16fr_1fr] md:gap-[5%]">
      <section className="order-2 flex min-w-0 flex-col justify-center md:order-1">
        <RdsHeadline station={station} rds={rds} hero/>
        <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-6">
          <StationIdentity station={station}/>
          {audio.processing&&<span className="ir-embed__chip border-lime-300/40 text-lime-300">HD+</span>}
        </div>
        {current&&<div className="mt-4 hidden items-center gap-2.5 text-xs text-white/75 md:flex">
          <ArtworkVisual station={station} src={current.imageUrl}
            className="size-10 rounded-xl object-cover"/>
          <div className="min-w-0">
            <p className="ir-embed__eyebrow text-[9px]">● ΣΤΟΝ ΑΕΡΑ ΤΩΡΑ</p>
            <p className="truncate font-bold">{current.title}{current.host?' · '+current.host:''}</p>
          </div>
        </div>}
        {song&&!rds.showProducer&&<div className="mt-4 sm:mt-6">
          <MusicSearchLinks station={station} song={song}/>
        </div>}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/25 pt-4 sm:mt-6 sm:pt-6">
          <PlaybackButton audio={audio} large/>
          <span className="text-[11px] font-black uppercase tracking-wider text-white/85">ON AIR / LIVE</span>
          <VolumeSlider audio={audio}/>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <HdControls audio={audio}/>
          <ProfileLink station={station} compact/>
        </div>
        {audio.error&&<p className="mt-2 text-xs text-amber-300" role="status">{audio.error}</p>}
      </section>
      <section className="order-1 relative mx-auto aspect-square w-[min(62vw,35dvh)] min-w-0 overflow-hidden rounded-3xl border border-white/15 bg-[#0e1115] shadow-[0_35px_100px_#0009] md:order-2 md:w-full md:max-w-[660px]">
        <ArtworkStack station={station} rds={rds}
          className="size-full" alt={rds.display.title}/>
        <div className="ir-embed__glass absolute right-3 top-3 max-w-[85%] truncate rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-widest">
          {station.name} / NOW ON AIR
        </div>
      </section>
    </div>
  </main>;
}

export default function StationEmbed(){
  const {stationId,variant}=useParams();
  const [params]=useSearchParams();
  const type=EMBED_TYPES.has(variant)?variant:'';
  const light=params.get('theme')==='light'&&type!=='hero';
  const {station,status}=useStation(stationId);
  const rds=useStationWidgetRds(station);
  const program=useProgram(station);
  const audio=useLiveAudio(station);
  const artwork=useCoverArtwork(station,rds.song);
  const visualRds={...rds,artwork};
  useStationWidgetMediaSession({station,rds,audio,artwork});
  if(!type)return <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">Άγνωστος τύπος widget.</div>;
  if(!station)return <div role="status" className="flex h-[100dvh] items-center justify-center bg-[#101315] p-6 text-center text-sm text-zinc-400">
    {status==='loading'?<Loader2 size={26} className="animate-spin text-[#caff00]"/>:
      status==='missing'?'Ο σταθμός δεν είναι διαθέσιμος.':'Προσωρινό σφάλμα φόρτωσης.'}
  </div>;
  return <>
    <Helmet><title>{station.name} · iRadios Station Widget</title><meta name="robots" content="noindex,nofollow"/></Helmet>
    {type==='player-square'&&<SquarePlayer station={station} rds={visualRds} audio={audio} light={light}/>}
    {type==='player-mini'&&<MiniPlayer station={station} rds={visualRds} audio={audio} light={light}/>}
    {type==='program-square'&&<Program station={station} {...program} rds={visualRds} audio={audio} light={light} mini={false}/>}
    {type==='program-mini'&&<Program station={station} {...program} rds={visualRds} audio={audio} light={light} mini/>}
    {type==='hero'&&<Hero station={station} {...program} rds={visualRds} audio={audio}/>}
  </>;
}
