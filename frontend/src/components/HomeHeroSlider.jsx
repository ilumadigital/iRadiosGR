import React, { useEffect, useMemo, useState } from 'react';
import {useLiveRevision} from '../utils/liveUpdates';
import { ChevronLeft, ChevronRight, Radio, Sparkles, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StationListenButton from './StationListenButton';
import { useStationAmbient } from '../hooks/useStationAmbient';
import { activeStationShow } from '../utils/liveBroadcast';
import { getAthensClock } from '../utils/schedule';
import {visibleEditorialSlides,homeFeaturedFallback} from '../utils/editorialPresentation';

export default function HomeHeroSlider({
  currentUser, currentStation, stations=[], listeningProfile={}, isPlaying, onPlayPause,
  onPlayStation, onOpenDiscovery, onFeaturedStationChange,
  placement='home', value='', onAvailabilityChange, excludeStationId=null
}) {
  const navigate=useNavigate();
  const [slides,setSlides]=useState([]);
  const [loadedScope,setLoadedScope]=useState(null);
  const [index,setIndex]=useState(0);
  const [hover,setHover]=useState(false);
  const [athensClock,setAthensClock]=useState(()=>getAthensClock());
  const premiumAccountId=placement==='home'&&
    (currentUser?.isPremium===true||currentUser?.isPremium==='true'||
      currentUser?.broadcasterProfile?.tier==='premium')
    ?String(currentUser?._id||currentUser?.id||''):'';
  const [premiumLast,setPremiumLast]=useState({accountId:'',stationId:'',at:0});
  useEffect(()=>{
    if(!premiumAccountId){setPremiumLast({accountId:'',stationId:'',at:0});return;}
    let stationId='',at=0;
    try{
      stationId=localStorage.getItem('iradios_premium_last_'+premiumAccountId)||'';
      at=Number(localStorage.getItem('iradios_premium_last_at_'+premiumAccountId))||0;
    }catch{}
    setPremiumLast({accountId:premiumAccountId,stationId,at});
  },[premiumAccountId]);
  useEffect(()=>{
    const id=String(currentStation?._id||'');
    if(!premiumAccountId||!isPlaying||!id||!stations.some(s=>
      String(s._id)===id&&(s.status==='approved'||!s.status)&&s.isOffline!==true))return;
    const at=Date.now();
    setPremiumLast({accountId:premiumAccountId,stationId:id,at});
    try{
      localStorage.setItem('iradios_premium_last_'+premiumAccountId,id);
      localStorage.setItem('iradios_premium_last_at_'+premiumAccountId,String(at));
    }catch{}
  },[premiumAccountId,currentStation?._id,isPlaying,stations]);
  useEffect(()=>{
    const refreshClock=()=>setAthensClock(getAthensClock());
    const timer=setInterval(refreshClock,30000);
    document.addEventListener('visibilitychange',refreshClock);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refreshClock);};
  },[]);
  const liveSlidesRevision = useLiveRevision('slides');
  // Preserve the visible slide while remote Admin saves propagate.
  // Only a genuine placement change resets this slider's scope.
  useEffect(()=>{
    setIndex(0);
    setSlides([]);
    setLoadedScope(null);
  },[placement,value]);
  useEffect(()=>{
    const controller=new AbortController();
    if(!['home','news'].includes(placement)&&!value)return()=>controller.abort();
    const query=placement==='home'?'':'?'+new URLSearchParams({placement,value}).toString();
    const scopeKey=placement+':'+value;
    fetch('/api/home-slides'+query,{signal:controller.signal,cache:'no-store'})
      .then(r=>r.ok?r.json():[])
      .then(data=>{if(!controller.signal.aborted){setSlides(Array.isArray(data)?data:[]);setLoadedScope(scopeKey);}})
      .catch(()=>{if(!controller.signal.aborted){setSlides([]);setLoadedScope(scopeKey);}});
    return ()=>controller.abort();
  },[placement,value,liveSlidesRevision]);
  // Only an explicitly featured station may fill the unconfigured Home hero.
  // Catalog pages never fall back to the current, first or random station.
  const stationFallback=useMemo(()=>{
    if(!premiumAccountId)return homeFeaturedFallback(stations,placement);
    const available=stations.filter(s=>s?._id&&
      (s.status==='approved'||!s.status)&&s.isOffline!==true);
    const byId=new Map(available.map(s=>[String(s._id),s]));
    const active=isPlaying?byId.get(String(currentStation?._id||'')):null;
    if(active)return active;
    // The listening profile is already account-scoped, synchronized across
    // devices by useListeningProfile. Compare the local immediate play event
    // to its latest verified station timestamp (not another user's history).
    const lastLocal=premiumLast.accountId===premiumAccountId?premiumLast:null;
    const fromProfile=Object.entries(listeningProfile?.stations||{})
      .filter(([id,stat])=>byId.has(id)&&Number(stat?.lastPlayedAt)>0)
      .sort((a,b)=>Number(b[1].lastPlayedAt)-Number(a[1].lastPlayedAt))[0];
    const profileAt=Number(fromProfile?.[1]?.lastPlayedAt)||0;
    const localAt=Number(lastLocal?.at)||0;
    const chosen=localAt>=profileAt?lastLocal?.stationId:fromProfile?.[0];
    return byId.get(String(chosen||''))||
      byId.get(String(fromProfile?.[0]||''))||null;
  },[stations,placement,premiumAccountId,premiumLast,listeningProfile,currentStation?._id,isPlaying]);
  // Never flash a previous category's CMS slides while a new placement loads.
  const visible=useMemo(()=>{
    if(loadedScope!==placement+':'+value)return [];
    const eligible=visibleEditorialSlides(slides,currentUser,stations,excludeStationId);
    // Premium home: personal listening is the default. Only explicitly
    // Premium-targeted Admin slides may replace it.
    return premiumAccountId?eligible.filter(slide=>slide.audience==='premium'):eligible;
  },[loadedScope,placement,value,slides,currentUser,stations,excludeStationId,premiumAccountId]);
  useEffect(()=>{onAvailabilityChange?.(visible.length>0);},
    [visible.length,onAvailabilityChange]);
  const activeIndex=visible.length?index%visible.length:0;
  const slide=visible[activeIndex];
  // The playlist always follows the visible station, including changes of editorial slide.
  const featuredStation=slide?.targetType==='station'
    ? stations.find(s=>String(s._id)===String(slide.stationId))
    : !slide?stationFallback:null;
  const isStationHero=!slide||slide.targetType==='station';
  const displayLogo=isStationHero?featuredStation?.logo:null;
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
  const title=slide?.title || (isStationHero?featuredStation?.name:stationFallback?.name) ||
    (premiumAccountId?'Καλώς ήρθες στο iRadios Premium':'Ανακάλυψε τον ήχο σου');
  const description=slide?.subtitle || (isStationHero?featuredStation?.slogan:stationFallback?.slogan) ||
    (premiumAccountId?'Ο αγαπημένος σου σταθμός θα εμφανιστεί εδώ μόλις ξεκινήσεις ακρόαση.':
      'Χιλιάδες σταθμοί. Μία εμπειρία που προσαρμόζεται στις επιλογές σου.');
  const stationAction=isStationHero&&featuredStation;
  // Home cards are text-only for on-air programs: never render a producer photo.
  // Match the actual Greek-local schedule, preferring the host over the show title.
  const activeShow=stationAction?activeStationShow(featuredStation,athensClock):null;
  const onAirName=[activeShow?.host,activeShow?.title]
    .find(value=>typeof value==='string'&&value.trim())?.trim()||'';
  // Playback state highlights only the chosen editorial or featured station.
  const featuredStationIsPlaying=Boolean(isPlaying && currentStation?._id &&
    String(currentStation._id)===String(featuredStation?._id));
  const heroEyebrow=slide?.eyebrow || (featuredStationIsPlaying
    ? 'Ακούς LIVE στο iRadios GR'
    : featuredStation?(premiumAccountId?'Τελευταίος σταθμός':'Επιλεγμένος σταθμός')
      :premiumAccountId?'Η μουσική σου · Premium':'Ανακάλυψε σταθμούς');
  const linkAction=slide?.targetType==='genre'||slide?.targetType==='external'||
    ((!slide||slide.targetType==='none')&&Boolean(onOpenDiscovery));
  if(placement!=='home'&&!slide)return null;

  return (
    <section aria-roledescription="carousel" aria-label="Επιλεγμένοι σταθμοί και editorial slides iRadios"
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      onFocusCapture={()=>setHover(true)}
      onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setHover(false);}}
      style={{'--ir-ambient-rgb':brandRgb}}
      className={`ir-home-hero ir-ambient-hero ${isStationHero ? 'ir-home-hero--station' : 'ir-home-hero--editorial'} relative isolate h-[245px] w-full min-h-0 min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#10161b] sm:h-[295px] sm:rounded-[28px] lg:h-[340px] xl:h-[355px]`}>
      {!isStationHero&&<img src={image} alt="" loading="eager" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"/>}
      <div className="ir-ambient-hero-gradient pointer-events-none absolute inset-0"/>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${isStationHero ? 'from-[#081013]/80 via-[#081013]/45 to-[#081013]/10' : 'from-[#090b10]/95 via-[#090b10]/65 to-transparent'}`}/>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"/>
      <div className="absolute inset-0 z-10 flex min-w-0 w-full flex-col justify-end gap-1.5 p-3 pb-11 sm:gap-3 sm:p-6 sm:pb-10 xl:p-8">
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-[#ccff00]/40 bg-black/60 px-2 py-1 text-[9px] font-black tracking-[0.1em] text-[#ccff00] backdrop-blur-xl sm:gap-2 sm:px-3 sm:py-2 sm:text-[10px] ${slide?.eyebrow ? 'uppercase' : ''}`}>
          <Sparkles size={15}/>{heroEyebrow}
        </span>
        <div className="flex min-w-0 items-center justify-between gap-4 sm:gap-8">
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 break-words text-[clamp(1.25rem,2.55vw,2.5rem)] font-black leading-[1.07] tracking-tight text-white drop-shadow-lg">
              {title}
            </h2>
            <p className="mt-2 hidden max-w-xl text-xs font-medium leading-relaxed text-zinc-200 sm:line-clamp-2 sm:text-sm">{description}</p>
            {onAirName&&<div className="mt-3 inline-flex max-w-full min-w-0 items-center gap-2.5 rounded-2xl border border-white/25 bg-black/35 px-3 py-2 shadow-[0_9px_30px_rgba(0,0,0,.17)] backdrop-blur-xl sm:mt-4 sm:px-4 sm:py-2.5">
              <Radio size={16} className="shrink-0 text-[#ccff00]" aria-hidden="true"/>
              <span className="min-w-0">
                <span className="block text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#dcffa0]">ΣΤΟΝ ΑΕΡΑ ΤΩΡΑ</span>
                <span className="block line-clamp-2 text-xs font-black leading-snug text-white sm:text-sm" title={onAirName}>{onAirName}</span>
              </span>
            </div>}
          </div>
          {displayLogo&&<div className="ir-hero-station-logo relative flex h-24 w-24 shrink-0 items-center justify-center rounded-[22px] border border-white/25 bg-white/95 p-3 shadow-[0_18px_55px_rgba(0,0,0,.5)] lg:h-32 lg:w-32 xl:h-36 xl:w-36">
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
