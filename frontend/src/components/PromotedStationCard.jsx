import React, {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {AudioLines, ArrowUpRight, Sparkles} from 'lucide-react';
import StationListenButton from './StationListenButton';
import {activeStationShow,validShowImage} from '../utils/liveBroadcast';
import {getAthensClock} from '../utils/schedule';
import {useStationAmbient} from '../hooks/useStationAmbient';

// A distinct Admin-controlled Promoted placement. The public endpoint returns
// no song metadata: guest listings may show only the scheduled programme.
export default function PromotedStationCard({
  placement,value,stations=[],currentStation,isPlaying,onPlayStation,onPlayPause,
  onAvailabilityChange
}){
  const [feature,setFeature]=useState(null);
  const [clock,setClock]=useState(()=>getAthensClock());
  useEffect(()=>{
    if(!['genre','region','news'].includes(placement) || (placement!=='news'&&!value)){setFeature(null);return;}
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
        if(live)setFeature(data?.stationId?{...data,placement,value}:null);
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
  const station=useMemo(()=>feature?.placement===placement&&feature?.value===value
    ? stations.find(s=>String(s._id)===String(feature.stationId) &&
        (s.status==='approved'||!s.status) && s.isOffline!==true)
    : null,[stations,feature,placement,value]);
  const show=useMemo(()=>activeStationShow(station,clock),[station,clock]);
  useEffect(()=>{onAvailabilityChange?.(station?._id||null);},[station?._id,onAvailabilityChange]);
  // Brand from the station logo (with neutral fallback), never cover artwork.
  const brandRgb=useStationAmbient(station?.logo);
  if(!station)return null;
  const producerPhoto=show&&validShowImage(show.imageUrl)?show.imageUrl:null;
  const href='/station/'+encodeURIComponent(station.slug||station._id);
  return (
    <aside aria-label={'Promoted Station: '+station.name}
      style={{backgroundImage:`radial-gradient(ellipse at 85% 15%, rgb(${brandRgb} / .52), transparent 62%), linear-gradient(130deg, rgb(${brandRgb} / .22), #0d1417 74%)`}}
      className="ir-promoted-station group relative isolate flex h-full min-h-[260px] min-w-0 flex-col justify-between overflow-hidden rounded-[26px] border border-[#ccff00]/30 p-5 text-white shadow-[0_22px_65px_rgba(0,0,0,.3)] transition-colors hover:border-[#ccff00]/60 sm:rounded-[30px] sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 size-64 rounded-full opacity-30 blur-[65px]"
        style={{background:`rgb(${brandRgb})`}}/>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.055]"
        style={{backgroundImage:'linear-gradient(90deg, white 1px, transparent 1px), linear-gradient(0deg, white 1px, transparent 1px)',backgroundSize:'30px 30px'}}/>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 right-0 h-0.5"
        style={{background:`linear-gradient(90deg, transparent, rgb(${brandRgb}), #ccff00, transparent)`}}/>

      <div className="relative z-10 flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/40 bg-black/50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#ccff00] backdrop-blur">
          <Sparkles size={14}/> Promoted Station
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#ccff00]/20 bg-black/35 px-2.5 py-1.5 text-[10px] font-bold text-[#d9ff7e]">
          <span className="size-1.5 animate-pulse rounded-full bg-[#ccff00] shadow-[0_0_12px_#ccff00]"/> LIVE
        </span>
      </div>

      <div className="relative z-10 mt-5 flex min-w-0 items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-[#e0f3a5]">{station.genre||'iRadiosGR'}</p>
          <Link to={href} className="block min-w-0 hover:text-[#ccff00]">
            <h3 className="line-clamp-2 break-words text-xl font-black leading-tight tracking-tight sm:text-2xl">{station.name}</h3>
          </Link>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-200">{station.slogan||'Ο ήχος σου, ζωντανά.'}</p>
        </div>
        <Link to={href} aria-label={'Προφίλ '+station.name}
          className="flex size-[76px] shrink-0 items-center justify-center rounded-[20px] border border-white/30 bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,.35)] sm:size-[92px]">
          <img src={station.logo||'/icon-tr.svg'} alt={'Λογότυπο '+station.name}
            className="h-full w-full object-contain"/>
        </Link>
      </div>

      <div className="relative z-10 mt-5 rounded-[18px] border border-white/15 bg-[#080d11]/60 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl">
        <p className="mb-2.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-[#ccff00]">
          <AudioLines size={14}/> Στον αέρα τώρα
        </p>
        <div className="flex min-w-0 items-center gap-3">
          {producerPhoto&&<img src={producerPhoto} alt={show?.host||'Παραγωγός στον αέρα'}
            className="size-12 shrink-0 rounded-xl border border-[#ccff00]/20 object-cover"
            onError={e=>{e.currentTarget.style.display='none';}}/>}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-black leading-tight sm:text-base">{show?.title||'Ζωντανό ραδιόφωνο'}</p>
            <p className="mt-1 truncate text-[11px] text-zinc-300">{show?.host||'Συντονίσου στον σταθμό'}</p>
          </div>
          <span aria-hidden="true" className="flex shrink-0 items-center gap-[3px]">
            {[10,18,13,22,12].map((height,index)=><span key={index} className="w-[3px] rounded-full bg-[#ccff00]/75" style={{height}}/>)}
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2">
        <StationListenButton station={station} currentStation={currentStation} isPlaying={isPlaying}
          onPlayStation={onPlayStation} onPlayPause={onPlayPause} className="min-h-11 rounded-full px-5"/>
        <Link to={href} aria-label={'Πληροφορίες '+station.name}
          className="inline-flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white transition-colors hover:border-[#ccff00]/70 hover:text-[#ccff00]">
          <ArrowUpRight size={19}/>
        </Link>
      </div>
    </aside>
  );
}
