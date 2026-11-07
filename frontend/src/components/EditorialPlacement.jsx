import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Play, Sparkles, ArrowUpRight } from 'lucide-react';
import { stationIsPlaying } from './StationListenButton';

const matchesAudience=(slide,user)=>{
  if(slide.audience==='guest')return !user;
  if(slide.audience==='member')return Boolean(user);
  if(slide.audience==='premium')return Boolean(user && (user.isPremium||user.role==='admin'||user?.broadcasterProfile?.tier==='premium'));
  return true;
};
// Editorial content is not an ad. Sponsored banners keep their own placements/tracking.
export default function EditorialPlacement({
  placement, value, currentUser, stations=[], currentStation, isPlaying,
  onPlayStation, onPlayPause
}) {
  const navigate=useNavigate();
  const [slides,setSlides]=useState([]);
  const [index,setIndex]=useState(0);
  useEffect(()=>{
    if(!value||!['genre','region'].includes(placement)){setSlides([]);return;}
    const ac=new AbortController();
    setSlides([]);setIndex(0);
    const query=new URLSearchParams({placement,value});
    fetch('/api/home-slides?'+query.toString(),{signal:ac.signal})
      .then(r=>r.ok?r.json():[])
      .then(data=>{if(!ac.signal.aborted)setSlides(Array.isArray(data)?data:[]);})
      .catch(()=>{if(!ac.signal.aborted)setSlides([]);});
    return ()=>ac.abort();
  },[placement,value]);
  const eligible=useMemo(()=>slides.filter(s=>matchesAudience(s,currentUser)),[slides,currentUser]);
  const slide=eligible[eligible.length?index%eligible.length:0];
  if(!slide)return null;
  const station=slide.targetType==='station' ? stations.find(s=>String(s._id)===String(slide.stationId)) : null;
  const active=stationIsPlaying(station,currentStation,isPlaying);
  const action=()=>{
    if(slide.targetType==='station'&&station){
      if(active)return;
      if(String(currentStation?._id)===String(station._id)&&onPlayPause)onPlayPause();
      else onPlayStation?.(station);
    }else if(slide.targetType==='genre'&&slide.genre)navigate('/genre/'+encodeURIComponent(slide.genre));
    else if(slide.targetType==='external'&&/^https:\/\//.test(slide.externalUrl))window.open(slide.externalUrl,'_blank','noopener,noreferrer');
  };
  const actionable=Boolean(station||(slide.targetType==='genre'&&slide.genre)||
    (slide.targetType==='external'&&/^https:\/\//.test(slide.externalUrl)));
  return (
    <section aria-label={'Επιλεγμένες προτάσεις '+value} className="ir-editorial-placement relative mb-8 min-h-[220px] overflow-hidden rounded-[28px] border border-white/15 bg-[#151a20] sm:min-h-[265px]">
      <img src={slide.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90"/>
      <div className="absolute inset-0 bg-gradient-to-r from-[#070a0d]/95 via-[#070a0d]/75 to-[#070a0d]/20"/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent"/>
      <div className="relative z-10 flex min-h-[220px] flex-col items-start justify-center p-6 sm:min-h-[265px] sm:p-9">
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#ccff00]"><Sparkles size={15}/>{slide.eyebrow||'ΕΠΙΛΟΓΗ iRADIOS'}</p>
        <h2 className="mt-3 max-w-2xl text-2xl font-black leading-tight text-white sm:text-4xl">{slide.title}</h2>
        {slide.subtitle&&<p className="mt-2 max-w-lg text-sm text-zinc-200">{slide.subtitle}</p>}
        {actionable&&<button type="button" onClick={action} disabled={active}
          className={`mt-5 flex min-h-11 items-center gap-2 rounded-xl px-5 text-xs font-black ${active?'border border-[#ccff00]/40 bg-[#ccff00]/15 text-[#ccff00]':'bg-[#ccff00] text-black hover:bg-[#e4ff83]'}`}>
          {slide.targetType==='station'?<Play size={16} fill="currentColor"/>:<ArrowUpRight size={17}/>}
          {active?'Παίζει τώρα':slide.ctaLabel||'Ανακάλυψε'}
        </button>}
      </div>
      {eligible.length>1&&<div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        <span className="text-xs font-bold text-zinc-200">{index%eligible.length+1}/{eligible.length}</span>
        <button type="button" onClick={()=>setIndex(i=>(i+eligible.length-1)%eligible.length)} aria-label="Προηγούμενο editorial slide" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"><ChevronLeft size={18}/></button>
        <button type="button" onClick={()=>setIndex(i=>(i+1)%eligible.length)} aria-label="Επόμενο editorial slide" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white"><ChevronRight size={18}/></button>
      </div>}
    </section>
  );
}
