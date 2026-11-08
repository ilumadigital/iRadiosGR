import React, {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {AudioLines, ArrowUpRight, Radio, Sparkles, UserRound} from 'lucide-react';
import StationListenButton from './StationListenButton';
import {activeStationShow,validShowImage} from '../utils/liveBroadcast';
import {getAthensClock} from '../utils/schedule';
import {parseMusicMetadata} from '../utils/musicMetadata';

// Purely editorial: one approved station per page, selected in admin.
// Now Playing is a server-side DB snapshot, never a request to the radio stream.
export default function PromotedStationCard({
  placement,value,stations=[],currentStation,isPlaying,onPlayStation,onPlayPause,
  onAvailabilityChange
}){
  const [feature,setFeature]=useState(null);
  const [clock,setClock]=useState(()=>getAthensClock());
  useEffect(()=>{
    if(!value || !['genre','region'].includes(placement)){setFeature(null);return;}
    let live=true,inFlight=false;
    const controller=new AbortController();
    setFeature(null);
    const load=async()=>{
      if(!live||inFlight)return;
      inFlight=true;
      try{
        const query=new URLSearchParams({placement,value});
        const response=await fetch('/api/promoted-station?'+query.toString(),{signal:controller.signal});
        if(!response.ok)throw new Error('Promoted station unavailable');
        const data=await response.json();
        if(live)setFeature(data?.stationId?data:null);
      }catch{
        if(live)setFeature(null);
      }finally{inFlight=false;}
    };
    load();
    const timer=setInterval(load,30000);
    return()=>{live=false;controller.abort();clearInterval(timer);};
  },[placement,value]);
  useEffect(()=>{
    const timer=setInterval(()=>setClock(getAthensClock()),60000);
    return()=>clearInterval(timer);
  },[]);
  const station=useMemo(()=>stations.find(s=>
    String(s._id)===String(feature?.stationId) && (s.status==='approved'||!s.status)),[stations,feature?.stationId]);
  const show=useMemo(()=>activeStationShow(station,clock),[station,clock]);
  useEffect(()=>{onAvailabilityChange?.(Boolean(station));},[station,onAvailabilityChange]);
  if(!station)return null;
  const song=parseMusicMetadata(feature?.nowPlaying?.title,station.name);
  const producerPhoto=show&&validShowImage(show.imageUrl)?show.imageUrl:null;
  const artwork=producerPhoto||station.cover||station.logo||'/iradios-wall.png';
  const href='/station/'+encodeURIComponent(station.slug||station._id);
  return (
    <aside aria-label={'Promoted Station: '+station.name}
      className="ir-promoted-station group relative isolate flex h-full min-h-[240px] min-w-0 flex-col justify-between overflow-hidden rounded-[24px] border border-[#ccff00]/25 bg-[#101619] p-4 shadow-[0_15px_50px_rgba(0,0,0,.25)] sm:rounded-[28px] sm:p-6 xl:min-h-0">
      <img src={artwork} alt="" loading="lazy" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 transition-transform duration-700 group-hover:scale-105"
        onError={e=>{if(e.currentTarget.dataset.fallback!=='1'){e.currentTarget.dataset.fallback='1';e.currentTarget.src='/iradios-wall.png';}}}/>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#080e12]/65 via-[#080e12]/60 to-[#080e12]/95"/>
      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ccff00]/30 bg-black/50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[#ccff00] backdrop-blur-md">
          <Sparkles size={13}/> Promoted Station
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#ccff00]/15 px-2 py-1.5 text-[10px] font-bold text-[#ccff00]">
          <span className="size-1.5 rounded-full bg-[#ccff00]"/> LIVE
        </span>
      </div>
      <div className="relative z-10 mt-4 min-w-0">
        <Link to={href} className="flex min-w-0 items-center gap-3 hover:text-[#ccff00]">
          <img src={station.logo} alt="" className="size-14 shrink-0 rounded-xl border border-white/20 bg-white p-1.5 object-contain sm:size-16"/>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-lg font-black leading-tight text-white sm:text-xl">{station.name}</h3>
            <p className="mt-1 line-clamp-1 text-[11px] text-zinc-300">{station.slogan||station.genre||'Ζωντανό ραδιόφωνο'}</p>
          </div>
        </Link>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-3 backdrop-blur-md">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#ccff00]">
            <AudioLines size={13}/> Παίζει τώρα {song&&feature?.nowPlaying?.foundWithAI?'· iRadios AI':''}
          </p>
          <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-white sm:text-base">
            {song?.title||show?.title||'Ζωντανό ραδιόφωνο'}
          </p>
          <p className="mt-1 truncate text-xs text-zinc-300">{song?.artist||(!show?'Συντονίσου στον σταθμό':show.host||station.name)}</p>
          {show&&(show.host||show.title)&&<p className="mt-2 flex items-center gap-1.5 truncate border-t border-white/10 pt-2 text-xs text-[#e5f2c9]">
            <UserRound size={13} className="shrink-0"/>{show.host||show.title} · Στον αέρα
          </p>}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <StationListenButton station={station} currentStation={currentStation} isPlaying={isPlaying}
            onPlayStation={onPlayStation} onPlayPause={onPlayPause} className="min-h-10 px-4"/>
          <Link to={href} aria-label={'Προφίλ '+station.name} className="inline-flex size-10 items-center justify-center rounded-xl border border-white/20 bg-black/35 text-white hover:border-[#ccff00]/60 hover:text-[#ccff00]">
            <ArrowUpRight size={17}/>
          </Link>
        </div>
      </div>
    </aside>
  );
}
