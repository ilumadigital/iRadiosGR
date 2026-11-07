import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Radio, Sparkles, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StationListenButton from './StationListenButton';
import { useStationAmbient } from '../hooks/useStationAmbient';

const meetsAudience=(slide,user)=>{
  if(slide.audience==='guest')return !user;
  if(slide.audience==='member')return Boolean(user);
  if(slide.audience==='premium')return Boolean(user?.isPremium||user?.role==='admin'||user?.broadcasterProfile?.tier==='premium');
  return true;
};
export default function HomeHeroSlider({
  currentUser, currentStation, stations=[], isPlaying, onPlayPause,
  onPlayStation, onOpenDiscovery, onFeaturedStationChange
}) {
  const navigate=useNavigate();
  const [slides,setSlides]=useState([]);
  const [index,setIndex]=useState(0);
  const [hover,setHover]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/home-slides',{signal:controller.signal})
      .then(r=>r.ok?r.json():[])
      .then(data=>{if(!controller.signal.aborted)setSlides(Array.isArray(data)?data:[]);})
      .catch(()=>{if(!controller.signal.aborted)setSlides([]);});
    return ()=>controller.abort();
  },[]);
  const stationFallback=useMemo(()=>
    currentStation || stations.find(s=>s.isFeatured) || stations[0], [currentStation,stations]);
  const visible=useMemo(()=>{
    const approved=new Set(stations.map(s=>String(s._id)));
    return slides.filter(item=>meetsAudience(item,currentUser) &&
      (item.targetType!=='station'||approved.has(String(item.stationId))));
  },[slides,currentUser,stations]);
  const activeIndex=visible.length?index%visible.length:0;
  const slide=visible[activeIndex];
  // The playlist always follows the visible station, including changes of editorial slide.
  const featuredStation=slide?.targetType==='station'
    ? stations.find(s=>String(s._id)===String(slide.stationId)) || stationFallback
    : stationFallback;
  const displayLogo=(!slide||slide.targetType==='station')?featuredStation?.logo:null;
  const brandRgb=useStationAmbient(displayLogo);
  useEffect(()=>{onFeaturedStationChange?.(featuredStation?._id||null);},[featuredStation?._id,onFeaturedStationChange]);
  useEffect(()=>{
    if(visible.length<=1||hover)return;
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    const timer=setInterval(()=>{if(!document.hidden)setIndex(i=>(i+1)%visible.length);},8500);
    return ()=>clearInterval(timer);
  },[visible.length,hover]);
  const shift=dir=>setIndex(i=>(i+visible.length+dir)%visible.length);
  const activate=()=>{
    switch(slide?.targetType){
      case 'genre':navigate('/genre/'+encodeURIComponent(slide.genre));return;
      case 'external':
        if(/^https:\/\//.test(slide.externalUrl))window.open(slide.externalUrl,'_blank','noopener,noreferrer');
        return;
      case 'station':return;
      default:onOpenDiscovery?.();
    }
  };
  const image=slide?.imageUrl || stationFallback?.cover || stationFallback?.logo || '/iradios-wall.png';
  const title=slide?.title || stationFallback?.name || 'Ανακάλυψε τον ήχο σου';
  const description=slide?.subtitle || stationFallback?.slogan ||
    'Χιλιάδες σταθμοί. Μία εμπειρία που προσαρμόζεται στις επιλογές σου.';
  const stationAction=(!slide||slide.targetType==='station')&&featuredStation;

  return (
    <section aria-roledescription="carousel" aria-label="Επιλεγμένοι σταθμοί και editorial slides iRadios"
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      onFocusCapture={()=>setHover(true)}
      onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHover(false);}}
      style={{'--ir-ambient-rgb':brandRgb}}
      className="ir-home-hero ir-ambient-hero relative isolate flex min-h-[315px] overflow-hidden rounded-[30px] border border-white/10 bg-[#10161b] md:min-h-[345px] xl:min-h-[365px]">
      <img src={image} alt="" loading="eager"
        className={`pointer-events-none absolute inset-0 h-full w-full ${slide?'object-cover opacity-80':'object-cover opacity-20 blur-[2px]'}`}/>
      <div className="ir-ambient-hero-gradient pointer-events-none absolute inset-0"/>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#090b10]/95 via-[#090b10]/65 to-transparent"/>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"/>
      <div className="relative z-10 flex w-full flex-col justify-end gap-3 p-6 pb-12 sm:p-8 sm:pb-10 xl:p-10">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ccff00]/40 bg-black/60 px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#ccff00] backdrop-blur-xl">
          <Sparkles size={15}/>{slide?.eyebrow||'ΕΠΙΛΟΓΗ ΓΙΑ ΣΕΝΑ'}
        </span>
        <div className="flex min-w-0 items-center justify-between gap-4 sm:gap-8">
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 break-words text-3xl font-black leading-[1.07] tracking-tight text-white drop-shadow-lg sm:text-4xl xl:text-[clamp(2rem,3vw,3.15rem)]">
              {title}
            </h2>
            <p className="mt-3 line-clamp-2 max-w-xl text-xs font-medium leading-relaxed text-zinc-200 sm:text-sm">{description}</p>
          </div>
          {displayLogo&&<div className="ir-hero-station-logo relative flex h-24 w-24 shrink-0 items-center justify-center rounded-[22px] border border-white/25 bg-white/95 p-3 shadow-[0_18px_55px_rgba(0,0,0,.5)] sm:h-36 sm:w-36 xl:h-40 xl:w-40">
            <img src={displayLogo} alt={featuredStation?.name||'Λογότυπο σταθμού'} className="h-full w-full object-contain"/>
          </div>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {stationAction
            ?<StationListenButton station={featuredStation} currentStation={currentStation} isPlaying={isPlaying}
              onPlayStation={onPlayStation} onPlayPause={onPlayPause}
              className="min-h-11 px-6 sm:px-8"/>
            :<button type="button" onClick={activate} className="ir-action-primary px-6 sm:px-8">
              <ArrowUpRight size={18}/>{slide?.ctaLabel||'Ανακάλυψε'}
            </button>}
          {featuredStation&&<button type="button" onClick={()=>navigate('/station/'+(featuredStation.slug||featuredStation._id))}
            className="min-h-11 rounded-xl border border-white/30 bg-black/35 px-5 text-xs font-bold text-white backdrop-blur hover:border-[#ccff00]/60">
            Πληροφορίες σταθμού
          </button>}
        </div>
      </div>
      {visible.length>1&&<div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 sm:bottom-4 sm:right-4">
        <span className="mr-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-zinc-200">{activeIndex+1}/{visible.length}</span>
        <button type="button" onClick={()=>shift(-1)} aria-label="Προηγούμενο slide"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white hover:text-[#ccff00]"><ChevronLeft size={18}/></button>
        <button type="button" onClick={()=>shift(1)} aria-label="Επόμενο slide"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white hover:text-[#ccff00]"><ChevronRight size={18}/></button>
      </div>}
    </section>
  );
}
