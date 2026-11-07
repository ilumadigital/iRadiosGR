import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Radio, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const meetsAudience=(slide,user)=>{
  if(slide.audience==='guest')return !user;
  if(slide.audience==='member')return Boolean(user);
  if(slide.audience==='premium')return Boolean(user?.isPremium||user?.broadcasterProfile?.tier==='premium');
  return true;
};
export default function HomeHeroSlider({ currentUser, currentStation, stations=[], onPlayStation, onOpenDiscovery }) {
  const navigate=useNavigate();
  const [slides,setSlides]=useState([]);
  const [index,setIndex]=useState(0);
  const [hover,setHover]=useState(false);
  useEffect(()=>{
    let active=true;
    fetch('/api/home-slides').then(r=>r.ok?r.json():[]).then(data=>{
      if(active)setSlides(Array.isArray(data)?data:[]);
    }).catch(()=>{if(active)setSlides([]);});
    return ()=>{active=false;};
  },[]);
  const stationFallback=useMemo(()=>currentStation || stations.find(s=>s.isFeatured) || stations[0], [currentStation,stations]);
  const visible=useMemo(()=>{
    const approved=new Set(stations.map(s=>String(s._id)));
    return slides.filter(item=>meetsAudience(item,currentUser) &&
      (item.targetType!=='station'||approved.has(String(item.stationId))));
  },[slides,currentUser,stations]);
  const activeIndex=visible.length?index%visible.length:0;
  const slide=visible[activeIndex];
  useEffect(()=>{
    if(visible.length<=1||hover)return;
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduce)return;
    const timer=setInterval(()=>{if(!document.hidden)setIndex(i=>(i+1)%visible.length);},8500);
    return ()=>clearInterval(timer);
  },[visible.length,hover]);
  const shift=direction=>setIndex(i=>(i+visible.length+direction)%visible.length);
  const activate=()=>{
    if(!slide){ if(stationFallback) onPlayStation(stationFallback); else onOpenDiscovery?.();return;}
    switch(slide.targetType){
      case 'station': {
        const station=stations.find(s=>String(s._id)===String(slide.stationId));
        if(station) onPlayStation(station); break;
      }
      case 'genre': navigate('/genre/'+encodeURIComponent(slide.genre));break;
      case 'external':
        if(/^https:\/\//.test(slide.externalUrl))window.open(slide.externalUrl,'_blank','noopener,noreferrer');
        break;
      default: onOpenDiscovery?.();
    }
  };
  const image=slide?.imageUrl||stationFallback?.cover||stationFallback?.logo||'/iradios-wall.png';
  const title=slide?.title||(stationFallback?.name||'Ανακάλυψε τον ήχο σου');
  const description=slide?.subtitle||(stationFallback?.slogan||'Χιλιάδες σταθμοί. Μία εμπειρία που προσαρμόζεται στις επιλογές σου.');
  return (
    <section
      aria-roledescription="carousel" aria-label="Επιλεγμένες προτάσεις iRadios"
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      onFocusCapture={()=>setHover(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHover(false);}}
      className="ir-home-hero relative isolate flex min-h-[345px] overflow-hidden rounded-[30px] border border-white/10 bg-zinc-900 md:min-h-[420px]"
    >
      <img src={image} alt="" loading="eager" className="absolute inset-0 h-full w-full object-cover opacity-75" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07090d] via-[#080a10]/90 via-45% to-[#080a10]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070a]/80 via-transparent to-transparent" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-[70%] rounded-full bg-[#ccff00]/10 blur-[70px]" />
      <div className="relative z-10 flex w-full flex-col justify-end p-6 pb-14 sm:p-9 sm:pb-14 md:p-12 md:pb-12">
        <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#ccff00]/40 bg-black/60 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#ccff00] backdrop-blur-lg">
          <Sparkles size={15}/>{slide?.eyebrow||'ΕΠΙΛΟΓΗ ΓΙΑ ΣΕΝΑ'}
        </span>
        <h2 className="max-w-[680px] break-words text-3xl font-black leading-tight tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
          {title}
        </h2>
        <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-zinc-200 sm:text-base">{description}</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button type="button" onClick={activate} className="ir-action-primary px-6 sm:px-8"><Play size={17} fill="currentColor"/>{slide?.ctaLabel||'Άκου τώρα'}</button>
          {!slide&&stationFallback&&<button type="button" onClick={()=>navigate('/station/'+(stationFallback.slug||stationFallback._id))} className="min-h-11 rounded-xl border border-white/25 bg-black/40 px-5 text-sm font-semibold text-white hover:border-[#ccff00]/50">Πληροφορίες σταθμού</button>}
        </div>
      </div>
      {visible.length>1&&(
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <span className="mr-2 text-[11px] font-bold tabular-nums text-zinc-300">{activeIndex+1} / {visible.length}</span>
          <button type="button" onClick={()=>shift(-1)} aria-label="Προηγούμενο slide" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white hover:text-[#ccff00]"><ChevronLeft size={20}/></button>
          <button type="button" onClick={()=>shift(1)} aria-label="Επόμενο slide" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white hover:text-[#ccff00]"><ChevronRight size={20}/></button>
        </div>
      )}
    </section>
  );
}
