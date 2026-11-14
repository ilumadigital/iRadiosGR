import React, { useEffect, useState } from 'react';
import { ArrowLeft, Pause, Play, SkipBack, SkipForward, Volume2, Heart,
  ListMusic, Info, ScanSearch, Loader2, Radio, ExternalLink, X, MonitorSpeaker } from 'lucide-react';
import StationPlaylistPanel from './StationPlaylistPanel';
import MusicServiceLinks from './MusicServiceLinks';
import FoundWithAI from './FoundWithAI';
import FullscreenArtwork from './FullscreenArtwork';
import AdSkipControl from './AdSkipControl';
import OnAirShowCard from './OnAirShowCard';
import {parseMusicMetadata} from '../utils/musicMetadata';
import {remoteLocationLabel} from '../utils/playbackPresentation.mjs';

// This visual layer never creates an <audio>. App.jsx remains the only stream player.
export default function DesktopFullPlayer({
  station, currentUser, isPlaying, isBuffering, isPlayingAd, adWarning, currentAdInfo,
  adTimeRemaining, adSkipCountdown, onSkipAd, nowPlaying, nowPlayingInfo, globalCoverArt, currentShow, liveBroadcast, rdsShowProducer, volume, setVolume,
  togglePlayPause, handlePrevStation, handleNextStation, onClose, onFavorite, isFavorite,
  onRecognize, isRecognizing, onOpenStation, onOpenDevices, remotePlayback
}) {
  const [showPlaylist,setShowPlaylist]=useState(false);
  useEffect(()=>{
    const onKey=e=>{if(e.key==='Escape'){if(showPlaylist)setShowPlaylist(false);else onClose();}};
    document.addEventListener('keydown',onKey);
    return ()=>document.removeEventListener('keydown',onKey);
  },[onClose,showPlaylist]);
  if(!station)return null;
  // An unverified DJZONE / RadioShow marker is a live program, never a song.
  const music=currentUser&&!isPlayingAd&&!isRecognizing?
    parseMusicMetadata(nowPlaying,station.name):null;
  const validTitle=Boolean(music);
  const showProducerArt=Boolean(currentUser&&!isPlayingAd&&!isRecognizing&&
    liveBroadcast?.imageUrl&&rdsShowProducer);
  const visibleSong=validTitle;
  const songTitle=showProducerArt?liveBroadcast.title:music?.title||'';
  const artist=showProducerArt?liveBroadcast.artist:music?.artist||'';
  const image=isPlayingAd&&currentAdInfo?.logoUrl?currentAdInfo.logoUrl:
    (showProducerArt?liveBroadcast.imageUrl:
      (visibleSong&&globalCoverArt?globalCoverArt:station.logo));
  const baseArtwork=Boolean(validTitle&&globalCoverArt&&!isPlayingAd);
  const baseImage=isPlayingAd&&currentAdInfo?.logoUrl?currentAdInfo.logoUrl:
    baseArtwork?globalCoverArt:station.logo;
  const artwork=Boolean((baseArtwork||showProducerArt)&&!isPlayingAd);
  const canShowDj=Boolean(currentUser&&!isPlayingAd&&liveBroadcast?.imageUrl);
  const showName=isPlayingAd?(currentAdInfo?.client||'Διαφήμιση'):
    (currentShow?.title||station.name);
  return (
    <div role="dialog" aria-modal="true" aria-label={'Πλήρης αναπαραγωγή '+station.name}
      className="ir-desktop-player fixed inset-0 z-[150] hidden h-[100vh] h-[100dvh] overflow-hidden overscroll-none bg-[#05070a] text-white lg:block">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img src={image} alt="" className="h-full w-full scale-125 object-cover opacity-[0.18] blur-[105px]"/>
        <div className="absolute inset-0 bg-gradient-to-r from-[#06080c]/95 via-[#080a10]/90 to-[#05070a]/60"/>
        <div className="ir-player-wave absolute -left-32 top-[30%] h-[400px] w-[90%] rounded-full border-t border-[#ccff00]/25 bg-gradient-to-b from-[#ccff00]/[0.07] to-transparent blur-2xl"/>
      </div>
      <div className="ir-desktop-player-layout relative z-10 mx-auto flex h-full min-h-0 max-w-[1660px] flex-col gap-[clamp(0.35rem,1.3dvh,1rem)] overflow-hidden px-[clamp(1rem,3vw,4rem)] py-[clamp(0.5rem,1.4dvh,1.6rem)]">
        <header className="ir-desktop-player-header flex min-h-11 shrink-0 flex-nowrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onClose} aria-label="Κλείσιμο πλήρους player" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white hover:text-[#ccff00]"><ArrowLeft size={21}/></button>
            <span className="text-xl font-black tracking-tight">iRadios<span className="text-[#ccff00]">GR</span></span>
            <span className="rounded-full border border-[#ccff00]/20 bg-[#ccff00]/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#ccff00]">LIVE RADIO</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {currentUser&&<button type="button" onClick={onOpenDevices} aria-label="Συσκευές αναπαραγωγής"
              title="iRadios Connect" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:text-[#ccff00]">
              <MonitorSpeaker size={21}/>
            </button>}
            <button type="button" onClick={()=>setShowPlaylist(v=>!v)} aria-expanded={showPlaylist}
              className="flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-xs font-bold hover:border-[#ccff00]/40">
              <ListMusic size={18}/> Playlist σταθμού
            </button>
            <button type="button" onClick={onOpenStation} className="flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-xs font-bold hover:border-[#ccff00]/40">
              <Info size={17}/> Προφίλ σταθμού
            </button>
            <button type="button" onClick={onFavorite} aria-label={isFavorite?'Αφαίρεση από αγαπημένα':'Προσθήκη στα αγαπημένα'}
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 ${isFavorite?'text-[#ccff00]':''}`}>
              <Heart size={19} fill={isFavorite?'currentColor':'none'}/>
            </button>
          </div>
        </header>
        <main className="ir-desktop-player-main grid min-h-0 flex-1 grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] items-center gap-[clamp(1rem,3.5vw,3.75rem)]">
          <div className="ir-desktop-player-copy flex min-h-0 min-w-0 max-w-3xl flex-col justify-center">
            <div className="mb-[clamp(0.25rem,1dvh,0.9rem)] inline-flex items-center gap-2 text-[clamp(0.6rem,1.25dvh,0.75rem)] font-black uppercase tracking-[0.2em] text-[#ccff00]">
              <Radio size={19}/> {isPlayingAd?'ΔΙΑΦΗΜΙΣΗ':'ΖΩΝΤΑΝΑ ΣΤΟΝ ΑΕΡΑ'}
            </div>
            <div className="min-w-0" aria-live="polite">
              <h1 className="ir-desktop-player-title break-words font-black leading-[1.03] tracking-tight">
                {isPlayingAd?(currentAdInfo?.client||'Διαφήμιση'):(music?.title||currentShow?.title||station.name)}
              </h1>
              <p className="mt-[clamp(0.25rem,1dvh,0.75rem)] line-clamp-2 text-[clamp(1rem,2.8dvh,1.8rem)] font-semibold leading-tight text-zinc-200">
                {isPlayingAd?(currentAdInfo?.title||'Διαφημιστικό διάλειμμα'):
                  (music?.artist||currentShow?.host||station.name)}
              </p>
            </div>
            {visibleSong&&!isPlayingAd&&nowPlayingInfo?.foundWithAI&&<FoundWithAI className="mt-2"/>}
            <div className="mt-[clamp(0.5rem,2dvh,1.2rem)] flex min-w-0 items-center gap-3">
              <img src={station.logo} alt="" className="h-[clamp(32px,5.5dvh,48px)] w-[clamp(32px,5.5dvh,48px)] shrink-0 rounded-xl bg-white p-1 object-contain"/>
              <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{station.name}</p>
                <p className="text-xs text-zinc-400">{station.frequency||station.genre||'Ζωντανός ραδιοφωνικός σταθμός'}</p>
              </div>
              <span className="ml-2 rounded-full bg-[#ccff00] px-3 py-1.5 text-[10px] font-black text-black">LIVE</span>
            </div>
            {remotePlayback&&<button type="button" onClick={onOpenDevices}
              className="mt-3 flex max-w-full items-center gap-2 self-start rounded-xl border border-[#ccff00]/25 bg-[#ccff00]/10 px-3 py-2 text-xs font-bold text-[#ccff00]">
              <MonitorSpeaker size={17}/>
              <span className="truncate">{remoteLocationLabel(remotePlayback.state)} {remotePlayback.deviceName}</span>
              <span className="shrink-0 text-white/70">· Συσκευές</span>
            </button>}
            {!isPlayingAd&&<OnAirShowCard show={currentShow} stationName={station.name}
              className="mt-[clamp(0.45rem,1.8dvh,1rem)]"/>}
            {isPlayingAd&&<p className="ir-desktop-player-show mt-[clamp(0.25rem,1dvh,0.75rem)] line-clamp-1 text-xs text-zinc-300">{currentAdInfo?.title||'Διαφημιστικό διάλειμμα'}{Number.isFinite(adTimeRemaining)?' · '+adTimeRemaining+'″':''}</p>}
            <AdSkipControl isPlayingAd={isPlayingAd} secondsUntilSkip={adSkipCountdown} onSkip={onSkipAd}
              className="mt-2 self-start"/>
            {!isPlayingAd&&!validTitle&&!showProducerArt&&nowPlayingInfo?.premiumOnly&&<a href="/premium"
              className="ir-desktop-player-show mt-2 inline-block text-xs font-black text-[#ccff00] hover:underline">✦ Premium μέλος ανακάλυψε τραγούδι με AI · Δες το με Premium</a>}
            {!isPlayingAd&&!validTitle&&!showProducerArt&&!nowPlayingInfo?.premiumOnly&&<p className="ir-desktop-player-show mt-[clamp(0.25rem,1dvh,0.75rem)] line-clamp-1 text-xs text-zinc-400">{currentUser?'Δεν γνωρίζουμε ποιο τραγούδι παίζει αυτή τη στιγμή.':'Συνδέσου στο iRadios για NowPlaying'}</p>}
            {!isPlayingAd && !isRecognizing && (
              <MusicServiceLinks song={nowPlaying} stationName={station.name}
                currentUser={currentUser} compact className="ir-music-links--desktop-player" />
            )}
            <div className="mt-[clamp(0.5rem,2.2dvh,1.6rem)] flex shrink-0 flex-wrap items-center gap-[clamp(0.4rem,1.1vw,1.25rem)]">
              <button type="button" onClick={togglePlayPause} disabled={isPlayingAd} aria-label={isPlaying?'Παύση ραδιοφώνου':'Αναπαραγωγή ραδιοφώνου'}
                className="ir-player-transport flex h-[clamp(48px,8dvh,80px)] w-[clamp(48px,8dvh,80px)] shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 disabled:opacity-40">
                {isBuffering?<Loader2 className="animate-spin" size={34}/>:isPlaying&&!isPlayingAd?<Pause size={36} fill="currentColor"/>:<Play size={36} fill="currentColor"/>}
              </button>
              <div className="flex flex-col gap-1"><span className="text-xs font-black uppercase tracking-widest">ON AIR / LIVE</span>
                <span className="text-xs text-zinc-400">{isBuffering?'Σύνδεση…':remotePlayback?remoteLocationLabel(remotePlayback.state)+' '+remotePlayback.deviceName:isPlaying?'Ακούς ζωντανά':'Έτοιμο για αναπαραγωγή'}</span>
              </div>
              <span className="mx-1 h-10 w-px bg-white/15"/>
              <button type="button" onClick={handlePrevStation} disabled={isPlayingAd||adWarning}
                className="rounded-full p-3 text-zinc-300 hover:bg-white/10 disabled:opacity-30" aria-label="Προηγούμενος ραδιοφωνικός σταθμός"><SkipBack size={25} fill="currentColor"/></button>
              <button type="button" onClick={handleNextStation} disabled={isPlayingAd||adWarning}
                className="rounded-full p-3 text-zinc-300 hover:bg-white/10 disabled:opacity-30" aria-label="Επόμενος ραδιοφωνικός σταθμός"><SkipForward size={25} fill="currentColor"/></button>
            </div>
            <div className="mt-[clamp(0.4rem,1.8dvh,1.15rem)] flex shrink-0 flex-wrap items-center gap-[clamp(0.5rem,1.4vw,1.25rem)]">
              <label className="flex min-h-11 items-center gap-3 text-zinc-400"><Volume2 size={20}/><span className="sr-only">Ένταση</span>
                <input aria-label="Ένταση ραδιοφώνου" type="range" min={0} max={1} step={0.01} value={volume} onChange={e=>setVolume(Number(e.target.value))}
                  className="w-[clamp(110px,12vw,176px)] accent-[#ccff00]"/>
              </label>
              {!isPlayingAd&&<button type="button" onClick={onRecognize} disabled={isRecognizing||!isPlaying}
                className="ir-recognize-button"><ScanSearch size={18}/>{isRecognizing?'Ψάχνουμε το τραγούδι…':'Βρες το τραγούδι'}</button>}
            </div>
          </div>
          <div className="ir-desktop-player-artframe relative mx-auto flex h-full min-h-0 min-w-0 w-full max-w-[650px] items-center justify-center">
            <FullscreenArtwork station={station}
              songCover={baseArtwork?globalCoverArt:null}
              producerImage={canShowDj?liveBroadcast.imageUrl:null}
              showProducer={showProducerArt}
              adImage={isPlayingAd?currentAdInfo?.logoUrl:null}
              className="ir-desktop-player-art aspect-square"/>

          </div>
        </main>
        <footer className="ir-desktop-player-footer flex min-h-[56px] shrink-0 flex-nowrap items-center justify-between gap-3 rounded-[clamp(12px,1.6vw,22px)] border border-white/10 bg-white/5 px-4 py-[clamp(0.35rem,0.85dvh,0.8rem)] backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-[clamp(36px,5.5dvh,54px)] w-[clamp(36px,5.5dvh,54px)] shrink-0 overflow-hidden rounded-xl bg-white">
              <img src={baseImage} alt="" className={`h-full w-full ${baseImage===station.logo?'bg-white object-contain p-1':'object-cover'}`}/>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#ccff00]">ΤΩΡΑ ΠΑΙΖΕΙ</p>
              <p className="max-w-xs truncate text-sm font-bold">
                {isPlayingAd?(currentAdInfo?.client||'Διαφήμιση'):(music?.title||currentShow?.title||station.name)}
              </p>
              <p className="truncate text-xs text-zinc-400">
                {isPlayingAd?(currentAdInfo?.title||'Διάλειμμα'):(music?.artist||currentShow?.host||station.name)}
              </p>
            </div>

          </div>
          <p className="hidden text-xs text-zinc-400 2xl:block">Ζωντανή ροή · χωρίς δυνατότητα μετακίνησης στο τραγούδι</p>
          <button type="button" onClick={()=>setShowPlaylist(true)} className="flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-zinc-200 hover:text-[#ccff00]">
            <ListMusic size={17}/> Τελευταία 12 τραγούδια
          </button>
        </footer>
      </div>
      {showPlaylist&&<div className="fixed inset-0 z-[160] flex justify-end bg-black/70" onClick={()=>setShowPlaylist(false)}>
        <aside role="complementary" aria-label="Playlist σταθμού" onClick={e=>e.stopPropagation()} className="h-screen w-full max-w-[460px] overflow-y-auto border-l border-white/15 bg-[#070b0f] p-5 shadow-2xl">
          <div className="mb-4 flex justify-end"><button onClick={()=>setShowPlaylist(false)} aria-label="Κλείσιμο playlist" className="rounded-full border border-white/10 p-2"><X size={20}/></button></div>
          <StationPlaylistPanel station={station} currentUser={currentUser}/>
        </aside>
      </div>}
    </div>
  );
}
