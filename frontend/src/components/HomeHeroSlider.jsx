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
  onPlayStation, onOpenDiscovery, onFeaturedStationChange,
  placement='home', value='', fallbackStation=null
}) {
  const navigate=useNavigate();
  const [slides,setSlides]=useState([]);
  const [index,setIndex]=useState(0);
  const [hover,setHover]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    setIndex(0);
    setSlides([]);
    if(placement!=='home'&&!value)return()=>controller.abort();
    const query=placement==='home'?'':'?'+new URLSearchParams({placement,value}).toString();
    fetch('/api/home-slides'+query,{signal:controller.signal})
      .then(r=>r.ok?r.json():[])
      .then(data=>{if(!controller.signal.aborted)setSlides(Array.isArray(data)?data:[]);})
      .catch(()=>{if(!controller.signal.aborted)setSlides([]);});
    return ()=>controller.abort();
  },[placement,value]);
  const stationFallback=useMemo(()=>
    (placement==='home'?currentStation:null) || fallbackStation ||
    stations.find(s=>s.isFeatured) || stations[0],
    [placement,currentStation,fallbackStation,stations]);
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
  useEffect(()=>{onFeaturedStationChange?.(featuredStation?._id || null);},[featuredStation?._id,onFeaturedStationChange]);
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
  const linkAction=slide?.targetType==='genre'||slide?.targetType==='external'||
    (slide?.targetType==='none'&&Boolean(onOpenDiscovery));

  return (
    <section aria-roledescription="carousel" aria-label="Επιλεγμένοι σταθμοί και editorial slides iRadios"
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      onFocusCapture={()=>setHover(true)}
      onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHover(false);}}
      style={{'--ir-ambient-rgb':brandRgb}}
      className="ir-home-hero ir-ambient-hero relative isolate h-[245px] w-full min-h-0 min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#10161b] sm:h-[295px] sm:rounded-[28px] lg:h-[340px] xl:h-[355px]">
      <img src={image} alt="" loading="eager"
        className={`pointer-events-none absolute inset-0 h-full w-full ${slide?'object-cover opacity-80':'object-cover opacity-20 blur-[2px]'}`}/>
      <div className="ir-ambient-hero-gradient pointer-events-none absolute inset-0"/>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#090b10]/95 via-[#090b10]/65 to-transparent"/>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"/>
      <div className="absolute inset-0 z-10 flex min-w-0 w-full flex-col justify-end gap-1.5 p-3 pb-11 sm:gap-3 sm:p-6 sm:pb-10 xl:p-8">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[#ccff00]/40 bg-black/60 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#ccff00] backdrop-blur-xl sm:gap-2 sm:px-3 sm:py-2 sm:text-[10px]">
          <Sparkles size={15}/>{slide?.eyebrow||'ΕΠΙΛΟΓΗ ΓΙΑ ΣΕΝΑ'}
        </span>
        <div className="flex min-w-0 items-center justify-between gap-4 sm:gap-8">
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 break-words text-[clamp(1.25rem,2.55vw,2.5rem)] font-black leading-[1.07] tracking-tight text-white drop-shadow-lg">
              {title}
            </h2>
            <p className="mt-2 hidden max-w-xl text-xs font-medium leading-relaxed text-zinc-200 sm:line-clamp-2 sm:text-sm">{description}</p>
          </div>
          {displayLogo&&<div className="ir-hero-station-logo relative hidden h-24 w-24 shrink-0 items-center justify-center rounded-[22px] border border-white/25 bg-white/95 p-3 shadow-[0_18px_55px_rgba(0,0,0,.5)] sm:flex lg:h-32 lg:w-32 xl:h-36 xl:w-36">
            <img src={displayLogo} alt={featuredStation?.name||'Λογότυπο σταθμού'} className="h-full w-full object-contain"/>
          </div>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
          {stationAction
            ?<StationListenButton station={featuredStation} currentStation={currentStation} isPlaying={isPlaying}
              onPlayStation={onPlayStation} onPlayPause={onPlayPause}
              className="min-h-9 px-3 sm:min-h-11 sm:px-8"/>
            :linkAction?<button type="button" onClick={activate} className="ir-action-primary min-h-9 px-3 text-xs sm:min-h-11 sm:px-8">
              <ArrowUpRight size={18}/>{slide?.ctaLabel||'Ανακάλυψε'}
            </button>:null}
          {stationAction&&<button type="button" onClick={()=>navigate('/station/'+(featuredStation.slug||featuredStation._id))}
            className="hidden min-h-11 rounded-xl border border-white/30 bg-black/35 px-5 text-xs font-bold text-white backdrop-blur hover:border-[#ccff00]/60 sm:inline-flex sm:items-center">
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
