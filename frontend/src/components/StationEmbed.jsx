import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useParams,useSearchParams} from 'react-router-dom';
import {Helmet} from 'react-helmet-async';
import {ArrowUpRight,CalendarDays,Loader2,Mic2,Music2,Pause,Play,Radio,Volume2,VolumeX} from 'lucide-react';
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
function StationArtwork({station,alt,className}){
  return <img src={station.logo||'/iradios-logo.png'} alt={alt||station.name}
    className={className} onError={e=>{if(!e.currentTarget.src.endsWith('/iradios-logo.png'))
      e.currentTarget.src='/iradios-logo.png';}}/>;
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
          signal:controller.signal,cache:'force-cache'
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
function ArtworkBackground({station,src}){
  return <div className="ir-embed__art" aria-hidden="true">
    <ArtworkVisual station={station} src={src}/>
  </div>;
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

function MusicSearchLinks({station,song,compact=false}){
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
function RdsDetails({station,rds,light=false,compact=false}){
  const {song,broadcast,showProducer}=rds;
  const muted=light?'text-zinc-500':'text-zinc-400';
  const producer=broadcast?.recognizedShow&&broadcast?.imageUrl?
    <div className="flex min-w-0 items-start gap-2">
      <Mic2 size={16} className="mt-0.5 shrink-0 text-[#a5cf00]"/>
      <div className="min-w-0">
        <p className={classNames('text-[10px] font-black uppercase tracking-widest',muted)}>
          ΣΤΟΝ ΑΕΡΑ ΤΩΡΑ
        </p>
        <p className={classNames('truncate font-black',compact?'text-xs':'text-sm')}>
          {broadcast.title||station.name}
        </p>
        {broadcast.artist&&<p className={classNames('truncate text-[11px]',muted)}>{broadcast.artist}</p>}
      </div>
    </div>:null;
  return <div className="min-w-0">
    <RdsCrossfade secondary={producer} showSecondary={Boolean(producer&&showProducer)}>
      <div className="flex min-w-0 items-start gap-2">
        <Music2 size={16} className="mt-0.5 shrink-0 text-[#a5cf00]"/>
        <div className="min-w-0">
          <p className={classNames('text-[10px] font-black uppercase tracking-widest',muted)}>
            ΤΩΡΑ ΠΑΙΖΕΙ
          </p>
          <p className={classNames('truncate font-black',compact?'text-xs':'text-sm')}
            title={song?.raw||''}>{song? song.title : 'Ζωντανό ραδιόφωνο'}</p>
          <p className={classNames('truncate text-[11px]',muted)}>
            {song?.artist||station.name}
          </p>
          <div className="mt-2"><MusicSearchLinks station={station} song={song} compact={compact}/></div>
        </div>
      </div>
    </RdsCrossfade>
  </div>;
}

function SquarePlayer({station,rds,audio,light}){
  const song=rds.song;
  return <main className="ir-embed flex flex-col" data-theme={light?'light':'dark'}>
    <AudioElements audio={audio}/>
    <ArtworkBackground station={station} src={rds.artwork}/>
    <div className="ir-embed__shade"/>
    <header className="relative z-10 flex shrink-0 items-start justify-between gap-2 px-5 pt-5">
      <StationIdentity station={station} compact/>
      <HdControls audio={audio} compact/>
    </header>
    <section className="relative z-10 flex min-h-0 flex-1 flex-col justify-end px-5 pb-4 pt-3">
      <p className="ir-embed__eyebrow mb-3">NOW PLAYING / TRACK</p>
      <h1 className="ir-embed__song-title" title={song?.title||''}>
        {song?.title||'Ζωντανό ραδιόφωνο'}
      </h1>
      <p className="ir-embed__artist mt-2">{song?.artist||station.name}</p>
      <div className="mt-4"><MusicSearchLinks station={station} song={song}/></div>
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
    <ArtworkBackground station={station} src={rds.artwork}/>
    <div className="ir-embed__shade"/>
    <div className="relative z-10 flex min-h-0 items-start gap-3 p-4">
      <ArtworkVisual station={station} src={rds.artwork}
        className="size-[74px] shrink-0 rounded-2xl border border-white/20 bg-black/50 object-cover"
        alt={song?.title||station.name}/>
      <div className="min-w-0 flex-1">
        <span className="ir-embed__eyebrow">● {station.name}</span>
        <h1 className="mt-1 line-clamp-2 text-[16px] font-black leading-tight">
          {song?.title||'Ζωντανό ραδιόφωνο'}
        </h1>
        <p className="mt-1 truncate text-[11px] text-white/75">{song?.artist||station.name}</p>
      </div>
      <PlaybackButton audio={audio}/>
    </div>
    <div className="relative z-10 px-4 pb-2">
      <MusicSearchLinks station={station} song={song} compact/>
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

function ShowLine({show,live=false,light=false}){
  return <div className={classNames('flex min-w-0 items-center gap-3 rounded-xl p-3',
    live?'border border-[#caff00]/25 bg-[#caff00]/[.07]':
      light?'bg-zinc-100':'bg-white/[.04]')}>
    <img src={show?.imageUrl||'/iradios-logo.png'} alt=""
      className="size-12 shrink-0 rounded-lg object-cover"/>
    <div className="min-w-0 flex-1">
      <div className={classNames('text-[10px] font-black tracking-wider',
        live?'text-[#a3ca00]':light?'text-zinc-500':'text-zinc-400')}>
        {live?'● ΣΤΟΝ ΑΕΡΑ ΤΩΡΑ':(show?.startTime||'—')+' – '+(show?.endTime||'—')}
      </div>
      <p className="mt-1 truncate text-sm font-black">{show?.title||'Ζωντανό πρόγραμμα'}</p>
      {show?.host&&<p className={classNames('mt-0.5 truncate text-[11px]',light?'text-zinc-500':'text-zinc-400')}>{show.host}</p>}
    </div>
  </div>;
}
function Program({station,current,upcoming,light,mini,rds}){
  return <main className={classNames('flex h-[100dvh] min-h-[155px] w-full flex-col overflow-hidden p-5',
    light?'bg-[#f8f8fa] text-zinc-900':'bg-[#111519] text-white')}>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.17em] text-[#a3c900]">
          <CalendarDays size={14}/> ΠΡΟΓΡΑΜΜΑ ΣΤΑΘΜΟΥ
        </p>
        <h1 className={classNames('mt-1 truncate font-black',mini?'text-lg':'text-2xl')}>{station.name}</h1>
      </div>
      <img src={station.logo||'/iradios-logo.png'} alt="" className="size-12 rounded-xl object-contain"/>
    </div>
    <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
      <ShowLine show={current||{title:'Ζωντανό ραδιόφωνο',host:station.slogan}} live light={light}/>
      {!mini&&upcoming.map((show,i)=><ShowLine show={show} key={[show.day,show.startTime,i].join('-')} light={light}/>)}
      {mini&&upcoming[0]&&<p className={classNames('truncate text-[11px]',light?'text-zinc-500':'text-zinc-400')}>
        Επόμενο: {upcoming[0].startTime} · {upcoming[0].title}
      </p>}
      {!current&&!upcoming.length&&<p className={classNames('text-xs',light?'text-zinc-500':'text-zinc-400')}>
        Το πρόγραμμα θα εμφανιστεί μόλις το ανανεώσει ο σταθμός.
      </p>}
    </div>
    <div className="mt-2"><RdsDetails station={station} rds={rds} light={light} compact/></div>
    <div className={classNames('mt-3 flex justify-center border-t pt-3',light?'border-zinc-200':'border-white/10')}>
      <ProfileLink station={station} compact={mini} light={light}/>
    </div>
  </main>;
}
function Hero({station,current,rds,audio}){
  const image=station.logo||'/iradios-logo.png';
  return <main className="relative flex h-[100dvh] min-h-[480px] w-full flex-col justify-center overflow-y-auto overflow-x-hidden bg-[#101315] px-6 py-8 font-sans text-white sm:px-10 lg:px-[8%]">
    <AudioElements audio={audio}/>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_40%_52%,rgba(160,194,60,.08),transparent_60%)]"/>
    <div className="relative z-10 mx-auto grid w-full max-w-[1500px] items-center gap-8 lg:grid-cols-[1.12fr_1fr] lg:gap-[6%]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.21em] text-[#caff00]">
            <Radio size={17}/> ΖΩΝΤΑΝΑ ΣΤΟΝ ΑΕΡΑ
          </span>
          {audio.processing&&<span className="rounded-full border border-[#caff00]/30 bg-[#caff00]/10 px-2.5 py-1 text-[10px] font-black text-[#caff00]">HD+</span>}
        </div>
        <h1 className="max-w-3xl text-4xl font-black leading-[1.06] tracking-tight sm:text-5xl xl:text-[clamp(3.4rem,5vw,6.3rem)]">
          {current?.host||current?.title||station.name}
        </h1>
        <p className="mt-3 text-xl font-semibold text-zinc-300 sm:text-2xl">{station.name}</p>
        <div className="mt-6 flex items-center gap-3">
          <img src={station.logo||'/iradios-logo.png'} alt="" className="size-12 shrink-0 rounded-xl bg-white object-contain p-1"/>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{station.name}</p>
            <p className="text-xs text-zinc-400">{station.frequency||station.genre||'LIVE RADIO'}</p>
          </div>
          <span className="rounded-full bg-[#caff00] px-3 py-1 text-[10px] font-black text-black">LIVE</span>
        </div>
        <div className="mt-5 inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.055] px-3 py-2.5">
          <img src={current?.imageUrl||station.logo||'/iradios-logo.png'} alt="" className="size-10 rounded-lg object-cover"/>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#caff00]">● ΣΤΟΝ ΑΕΡΑ ΤΩΡΑ</p>
            <p className="truncate text-xs font-bold">{current?.title||station.name}</p>
          </div>
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.035] p-4"><RdsDetails station={station} rds={rds}/></div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <PlaybackButton audio={audio} large/>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest">ON AIR / LIVE</p>
            <p className="mt-1 text-xs text-zinc-500">{audio.playing?'Ζωντανή αναπαραγωγή':'Έτοιμο για αναπαραγωγή'}</p>
          </div>
          <VolumeSlider audio={audio}/>
        </div>
        <div className="mt-5"><HdControls audio={audio}/></div>
        {audio.error&&<p role="status" className="mt-3 text-xs text-amber-400">{audio.error}</p>}
        <div className="mt-7"><ProfileLink station={station}/></div>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[660px] overflow-hidden rounded-[35px] border border-white/10 bg-gradient-to-br from-zinc-100 to-zinc-500 p-[10%] shadow-[0_35px_95px_rgba(0,0,0,.3)]">
        <img src={image} alt={'Εικόνα: '+station.name} className="h-full w-full object-contain"/>
        <div className="absolute bottom-4 left-4 size-[76px] overflow-hidden rounded-[22px] border-4 border-white/80 bg-white p-1 shadow-xl sm:size-[100px]">
          <img src={station.logo||'/iradios-logo.png'} alt={station.name} className="h-full w-full object-contain"/>
        </div>
      </div>
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
  useStationWidgetMediaSession({station,rds,audio,enabled:!type.startsWith('program')});
  if(!type)return <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400">Άγνωστος τύπος widget.</div>;
  if(!station)return <div role="status" className="flex h-[100dvh] items-center justify-center bg-[#101315] p-6 text-center text-sm text-zinc-400">
    {status==='loading'?<Loader2 size={26} className="animate-spin text-[#caff00]"/>:
      status==='missing'?'Ο σταθμός δεν είναι διαθέσιμος.':'Προσωρινό σφάλμα φόρτωσης.'}
  </div>;
  return <>
    <Helmet><title>{station.name} · iRadios Station Widget</title><meta name="robots" content="noindex,nofollow"/></Helmet>
    {type==='player-square'&&<SquarePlayer station={station} rds={rds} audio={audio} light={light}/>}
    {type==='player-mini'&&<MiniPlayer station={station} rds={rds} audio={audio} light={light}/>}
    {type==='program-square'&&<Program station={station} {...program} rds={rds} light={light} mini={false}/>}
    {type==='program-mini'&&<Program station={station} {...program} rds={rds} light={light} mini/>}
    {type==='hero'&&<Hero station={station} {...program} rds={rds} audio={audio}/>}
  </>;
}
