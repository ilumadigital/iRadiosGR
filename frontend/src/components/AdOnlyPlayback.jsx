import React, {useEffect, useRef, useState} from 'react';
import {ChevronDown, ChevronUp, ExternalLink, Megaphone, Volume2, X} from 'lucide-react';
import AdSkipControl from './AdSkipControl';

// Presentation only: all advertising playback, impressions, billing and Skip
// remain owned by the existing App.jsx audio engine.
function AdArtwork({ad, className=''}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[ad?.logoUrl]);
  return (
    <div className={'flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-zinc-900 '+className}>
      {ad?.logoUrl&&!failed
        ? <img src={ad.logoUrl} alt={'Λογότυπο '+(ad.client||'διαφημιζόμενου')}
            onError={()=>setFailed(true)} className="h-full w-full bg-white object-contain p-1"/>
        : <Megaphone aria-hidden="true" className="text-[#ccff00]" size={28}/>}
    </div>
  );
}

export function AdOnlyDesktopIdentity({ad,onAdClick}) {
  if(!ad)return null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3" data-ad-only="desktop">
      <AdArtwork ad={ad} className="h-14 w-14"/>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#ccff00]">Sponsored</span>
        <strong className="truncate text-sm font-black text-white" title={ad.client||'Διαφήμιση'}>
          {ad.client||'Διαφήμιση'}
        </strong>
        <span className="truncate text-xs text-zinc-400" title={ad.title||''}>
          {ad.title||'Διαφημιστικό διάλειμμα'}
        </span>
      </div>
      {ad.linkUrl&&<button type="button" onClick={onAdClick}
        aria-label={'Μάθε περισσότερα για '+(ad.client||'τη διαφήμιση')}
        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#ccff00]/40 px-3 py-2 text-xs font-bold text-[#ccff00] hover:bg-[#ccff00]/10">
        Μάθε περισσότερα <ExternalLink size={14}/>
      </button>}
    </div>
  );
}

export function AdOnlyFullscreen({
  ad,onClose,onAdClick,adTimeRemaining,adSkipCountdown,onSkipAd,
  volume,setVolume,mobile=false
}) {
  const closeRef=useRef(null);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement;
    const previousOverflow=document.body.style.overflow;
    if(mobile)document.body.style.overflow='hidden';
    closeRef.current?.focus();
    const onKey=event=>{if(event.key==='Escape'){event.preventDefault();onCloseRef.current?.();}};
    document.addEventListener('keydown',onKey);
    return ()=>{
      document.removeEventListener('keydown',onKey);
      if(mobile)document.body.style.overflow=previousOverflow;
      if(previous?.isConnected)previous.focus();
    };
  },[mobile]);
  if(!ad)return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Αναπαραγωγή διαφήμισης"
      data-ad-only={mobile?'mobile-fullscreen':'desktop-fullscreen'}
      className={'fixed inset-0 flex h-[100dvh] min-h-0 flex-col overflow-y-auto bg-[#07090c] text-white '+(mobile?'z-[150] lg:hidden':'z-[150] hidden lg:flex')}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {ad.logoUrl&&<div className="absolute inset-0 scale-125 bg-cover bg-center opacity-15 blur-[90px]"
          style={{backgroundImage:'url("'+ad.logoUrl+'")'}}/>}
        <div className="absolute inset-0 bg-gradient-to-br from-black/90 via-zinc-950/80 to-[#1b2805]/50"/>
      </div>
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-4xl flex-1 flex-col px-5 py-5 sm:px-10">
        <header className="flex items-center justify-between gap-3">
          <span className="text-lg font-black tracking-tight">iRadios<span className="text-[#ccff00]">GR</span></span>
          <button ref={closeRef} type="button" onClick={onClose}
            aria-label="Ελαχιστοποίηση player"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20">
            {mobile?<ChevronDown size={24}/>:<X size={22}/>}
          </button>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
          <span className="rounded-full border border-[#ccff00]/30 bg-[#ccff00]/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-[#ccff00]">
            Sponsored · Audio Ad
          </span>
          <AdArtwork ad={ad} className="h-40 w-40 shadow-2xl sm:h-60 sm:w-60"/>
          <h1 className="max-w-2xl break-words text-2xl font-black sm:text-4xl">{ad.client||'Διαφήμιση'}</h1>
          <p className="max-w-xl text-base font-medium text-zinc-300 sm:text-xl">{ad.title||'Διαφημιστικό διάλειμμα'}</p>
          {Number.isFinite(adTimeRemaining)&&<p className="text-sm font-bold text-zinc-400" role="status">
            Απομένουν {Math.max(0,Math.ceil(adTimeRemaining))}″
          </p>}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {ad.linkUrl&&<button type="button" onClick={onAdClick}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ccff00] px-5 py-3 text-sm font-black text-black hover:bg-[#dfff66]">
              Μάθε περισσότερα <ExternalLink size={18}/>
            </button>}
            <AdSkipControl isPlayingAd secondsUntilSkip={adSkipCountdown} onSkip={onSkipAd}/>
          </div>
        </main>
        {typeof volume==='number'&&typeof setVolume==='function'&&
          <div className="flex items-center justify-center gap-3 py-4 text-zinc-400">
            <Volume2 size={18}/>
            <input type="range" aria-label="Ένταση" min={0} max={1} step={0.01}
              value={volume} onChange={event=>setVolume(Number(event.target.value))}
              className="w-40 accent-[#ccff00]"/>
          </div>}
      </div>
    </div>
  );
}

export function AdOnlyMobilePlayer({ad,adTimeRemaining,adSkipCountdown,onSkipAd,onAdClick}) {
  const [expanded,setExpanded]=useState(false);
  const startY=useRef(null);
  if(!ad)return null;
  return (
    <>
      {expanded&&<AdOnlyFullscreen ad={ad} mobile onClose={()=>setExpanded(false)}
        onAdClick={onAdClick} adTimeRemaining={adTimeRemaining}
        adSkipCountdown={adSkipCountdown} onSkipAd={onSkipAd}/>}
      <div data-ad-only="mobile-mini"
        className={'ir-mini-player-stack fixed bottom-[84px] left-2 right-2 z-[90] lg:hidden '+(expanded?'pointer-events-none translate-y-[150%] opacity-0':'')}
        onTouchStart={event=>{startY.current=event.touches[0]?.clientY??null;}}
        onTouchEnd={event=>{
          if(startY.current!==null&&startY.current-(event.changedTouches[0]?.clientY??startY.current)>28)
            setExpanded(true);
          startY.current=null;
        }}>
        <div className="truncate rounded-t-xl border border-b-0 border-white/10 bg-zinc-950 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ccff00]">
          Sponsored · {ad.title||'Διαφημιστικό διάλειμμα'}
          {Number.isFinite(adTimeRemaining)?' · '+Math.max(0,Math.ceil(adTimeRemaining))+'″':''}
        </div>
        <div className="ir-mini-player ir-mini-player--compact flex min-h-[68px] items-center gap-2 rounded-b-xl px-2 py-2">
          <button type="button" onClick={()=>setExpanded(true)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            aria-label={'Άνοιγμα διαφημιστικού player: '+(ad.client||'Διαφήμιση')}>
            <AdArtwork ad={ad} className="h-11 w-11"/>
            <span className="flex min-w-0 flex-col">
              <strong className="truncate text-sm font-black text-white">{ad.client||'Διαφήμιση'}</strong>
              <span className="truncate text-[11px] text-zinc-400">{ad.title||'Διαφημιστικό διάλειμμα'}</span>
            </span>
          </button>
          <AdSkipControl isPlayingAd secondsUntilSkip={adSkipCountdown} onSkip={onSkipAd} compact
            className="ir-mini-ad-skip"/>
          {ad.linkUrl&&<button type="button" onClick={onAdClick}
            aria-label="Μάθε περισσότερα για τη διαφήμιση"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ccff00] text-black">
            <ExternalLink size={18}/>
          </button>}
          <button type="button" onClick={()=>setExpanded(true)} aria-label="Πλήρης οθόνη διαφήμισης"
            className="flex h-10 w-7 shrink-0 items-center justify-center text-zinc-300">
            <ChevronUp size={21}/>
          </button>
        </div>
      </div>
    </>
  );
}
