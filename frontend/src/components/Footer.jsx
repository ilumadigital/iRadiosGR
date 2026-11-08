import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Heart, Volume2, SkipBack, SkipForward, SlidersHorizontal, 
  MonitorSpeaker, Headphones, PowerOff, Radio, MessageSquare, ScanSearch, 
  Loader2, Waves, Maximize2, Minimize2, Laptop, Smartphone, X 
} from 'lucide-react';
import ShareStory from './ShareStory';
import LiveChat from './LiveChat';
import DesktopFullPlayer from './DesktopFullPlayer';
import FoundWithAI from './FoundWithAI';
import {parseMusicMetadata,spotifySongLink} from '../utils/musicMetadata'; 
import { useAlert } from '../context/AlertContext';

export default function Footer({ 
  currentStation, isPlayingAd, currentAdInfo, adTimeRemaining, adWarning, 
  isPlaying, isBuffering, nowPlaying, nowPlayingInfo, volume, setVolume, togglePlayPause, 
  toggleFavorite, isFavorite, handleNextStation, handlePrevStation,
  currentUser, userOverrides, onUserDSPChange,
  unreadListenerChat, setUnreadListenerChat,
  isRecognizing, handleRecognizeTrack, spotifyUrl,  
  availableDevices = [],
  localDeviceId,
  onTransferPlayback,
  onRequestDevices,
  globalCoverArt // 🟢 Λαμβάνει το Cover Art από το App.jsx
}) {
  
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const [showEQMenu, setShowEQMenu] = useState(false);
  const [showChat, setShowChat] = useState(false); 
  const [isMaximized, setIsMaximized] = useState(false);
  const [showDevicesMenu, setShowDevicesMenu] = useState(false);
  const eqMenuRef = useRef(null);
  const devicesMenuRef = useRef(null);

  const formatGenre = (text) => {
    if (!text || typeof text !== 'string') return "";
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  const utmParams = "ref=iradiosapp&utm_campaign=ft_player_ir&utm_content=ft_player_ir&utm_medium=ilumadigitalagencyiradios&utm_source=iradios";
  
  const realTrack=parseMusicMetadata(nowPlaying,currentStation?.name);
  const isRealSong=Boolean(currentUser&&isPlaying&&!isPlayingAd&&!adWarning&&
    !isRecognizing&&realTrack);
  const finalSpotifyUrl=isRealSong
    ?(spotifyUrl||spotifySongLink(realTrack.raw,currentStation?.name)):null;

  const currentShow = useMemo(() => {
    try {
      if (!currentStation || !currentStation.schedule || !Array.isArray(currentStation.schedule) || currentStation.schedule.length === 0) return null;
      const now = new Date();
      const jsDay = now.getDay();
      const currentDayIdx = jsDay === 0 ? 6 : jsDay - 1; 
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const parseTime = (timeStr) => {
        if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };

      return currentStation.schedule.find(s => 
        s && s.day === currentDayIdx && 
        parseTime(s.startTime) <= currentMinutes && 
        parseTime(s.endTime) > currentMinutes
      );
    } catch(e) { return null; }
  }, [currentStation]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eqMenuRef.current && !eqMenuRef.current.contains(event.target)) setShowEQMenu(false);
      if (devicesMenuRef.current && !devicesMenuRef.current.contains(event.target)) setShowDevicesMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { setShowChat(false); }, [currentStation?._id]);

  const lastTrackedAdId = useRef(null);
  useEffect(() => {
    if (isPlayingAd && currentAdInfo?._id && lastTrackedAdId.current !== currentAdInfo._id) {
      lastTrackedAdId.current = currentAdInfo._id; 
      fetch(`/api/ads/${currentAdInfo._id}/impression`, { method: 'POST' }).catch(() => {});
    }
    if (!isPlayingAd) lastTrackedAdId.current = null;
  }, [isPlayingAd, currentAdInfo?._id]);

  const isCurrentlyFavorite = useMemo(() => {
    return currentStation ? isFavorite(currentStation._id) : false;
  }, [currentUser?.favorites, currentStation?._id]);

  const isPremium = currentUser?.isPremium || currentUser?.broadcasterProfile?.tier === 'premium';
  
  // 🟢 ΛΟΓΙΚΗ ΕΙΚΟΝΑΣ
  // 1. Minified Player (Κάτω Μπάρα): ΠΑΝΤΑ Λογότυπο Σταθμού (ή Διαφήμισης)
  const minifiedImage = isPlayingAd && currentAdInfo?.logoUrl ? currentAdInfo.logoUrl : (currentStation?.logo || '');

  // 2. Maximized Player (Full Screen): Δείχνει Cover Art ΑΝ υπάρχει ΚΑΙ είναι πραγματικό τραγούδι.
  const showCoverArt = isRealSong && globalCoverArt && !isPlayingAd;
  const maximizedImage = isPlayingAd && currentAdInfo?.logoUrl 
    ? currentAdInfo.logoUrl 
    : (showCoverArt ? globalCoverArt : (currentStation?.logo || ''));


  const handleLogoTitleClick = () => {
    if (isPlayingAd && currentAdInfo?.linkUrl) {
      fetch(`/api/ads/${currentAdInfo._id}/click`, { method: 'POST' }).catch(() => {});
      const separator = currentAdInfo.linkUrl.includes('?') ? '&' : '?';
      window.open(`${currentAdInfo.linkUrl}${separator}${utmParams}`, '_blank', 'noopener,noreferrer');
    } else if (!isPlayingAd && currentStation) {
      navigate(`/station/${currentStation.slug || currentStation._id}`);
      setIsMaximized(false);
    }
  };

  const handleRadarClick = (e) => {
    e.stopPropagation();
    if (!currentUser) {
      showAlert("Συνδέσου στο iRadios για να βρεις ποιο τραγούδι παίζει.");
      return;
    }
    handleRecognizeTrack();
  };

  const handleSpotifyClick = (e) => {
    e.stopPropagation();
    if(!finalSpotifyUrl)return;
    if (isPremium) {
      window.open(finalSpotifyUrl, '_blank', 'noopener,noreferrer');
    } else {
      showAlert("Αναβαθμίστε σε Premium για 1-Click Spotify Save.");
      navigate('/premium'); 
    }
  };

  const canUseCustomEQ = currentStation && isPremium && isCurrentlyFavorite;
  const currentPreset = (currentStation && userOverrides?.[currentStation._id]) || 'Station Default';

  return (
    <>
    <style>
        {`
          @keyframes eq-bar {
            0% { height: 4px; }
            50% { height: 18px; }
            100% { height: 4px; }
          }
          .eq-bar-1 { animation: eq-bar 0.6s infinite ease-in-out alternate; }
          .eq-bar-2 { animation: eq-bar 0.9s infinite ease-in-out alternate 0.2s; }
          .eq-bar-3 { animation: eq-bar 0.7s infinite ease-in-out alternate 0.4s; }
          .eq-bar-4 { animation: eq-bar 0.5s infinite ease-in-out alternate 0.1s; }
          .eq-bar-5 { animation: eq-bar 0.8s infinite ease-in-out alternate 0.3s; }

          @keyframes bounce-dot {
            0%, 100% { transform: translateY(0); opacity: 0.5; }
            50% { transform: translateY(-4px); opacity: 1; }
          }
          .dot-1 { animation: bounce-dot 0.6s infinite ease-in-out; }
          .dot-2 { animation: bounce-dot 0.6s infinite ease-in-out 0.2s; }
          .dot-3 { animation: bounce-dot 0.6s infinite ease-in-out 0.4s; }
        `}
      </style>
      
      {/* Cinematic desktop visual shell. The actual audio element remains in App.jsx. */}
      {isMaximized && currentStation && (
        <DesktopFullPlayer
          station={currentStation}
          currentUser={currentUser}
          isPlaying={isPlaying}
          isBuffering={isBuffering}
          isPlayingAd={isPlayingAd}
          adWarning={adWarning}
          currentAdInfo={currentAdInfo}
          adTimeRemaining={adTimeRemaining}
          nowPlaying={nowPlaying}
          nowPlayingInfo={nowPlayingInfo}
          globalCoverArt={globalCoverArt}
          currentShow={currentShow}
          volume={volume}
          setVolume={setVolume}
          togglePlayPause={togglePlayPause}
          handlePrevStation={handlePrevStation}
          handleNextStation={handleNextStation}
          isFavorite={isCurrentlyFavorite}
          onFavorite={() => currentUser ? toggleFavorite(currentStation._id) : navigate('/login')}
          onRecognize={handleRadarClick}
          isRecognizing={isRecognizing}
          onOpenStation={() => { setIsMaximized(false); navigate('/station/'+(currentStation.slug||currentStation._id)); }}
          onClose={() => setIsMaximized(false)}
        />
      )}

      {/* 🟢 FOOTER BAR (MINIFIED) - ΠΑΝΤΑ STATION LOGO */}
      <footer className="hidden lg:flex z-[100] fixed bottom-0 left-0 right-0 h-24 bg-black/80 backdrop-blur-3xl border-t border-white/5 px-8 items-center justify-between">
        
        <div className="flex items-center gap-4 w-1/3 min-w-[300px]">
          {currentStation ? (
            <>
              <div onClick={handleLogoTitleClick} className="w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shadow-md flex items-center justify-center relative cursor-pointer transition-transform hover:scale-105 active:scale-95">
                <img 
                  src={minifiedImage} 
                  className={`w-full h-full transition-all object-contain bg-white p-1`} 
                  alt="" 
                />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <Link to={isPlayingAd ? '#' : `/station/${currentStation.slug || currentStation._id}`} className="text-sm font-bold text-white truncate hover:text-[#ccff00] transition-colors">
                  {isPlayingAd ? (currentAdInfo?.client || 'Διαφήμιση') : currentStation.name}
                </Link>
                {isPlayingAd ? (
                  <span className="text-[10px] text-[#ccff00] truncate font-black tracking-widest mt-0.5 uppercase">Sponsored</span>
                ) : (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-zinc-400 truncate font-black tracking-widest">{formatGenre(currentStation.genre)}</span>
                    <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
                    <span className="text-[10px] text-zinc-500 truncate font-bold tracking-tighter">{currentStation.region || 'Web Radio'}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                {!isPlayingAd && (
                  <div className="flex items-center">
                    
                    {!isRealSong ? (
                      <button onClick={handleRadarClick} disabled={isRecognizing || !isPlaying} className={`p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isRecognizing ? 'text-[#ccff00] animate-pulse bg-[#ccff00]/10' : 'text-zinc-400 hover:text-[#ccff00]'}`}>
                        {isRecognizing ? <Loader2 size={18} className="animate-spin" /> : <ScanSearch size={18} />}
                      </button>
                    ) : (
                      <button onClick={handleSpotifyClick} className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 ${isPremium ? 'bg-[#1DB954] text-black shadow-[0_0_15px_rgba(29,185,84,0.4)]' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-white'}`} title="Άνοιγμα στο Spotify">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.48-1.02.659-1.56.3z"/></svg>
                      </button>
                    )}
                  </div>
                )}
                <button onClick={() => toggleFavorite(currentStation._id)} className={`p-2 transition-all hover:scale-125 active:scale-90 ${isCurrentlyFavorite ? 'text-[#ccff00]' : 'text-zinc-500 hover:text-white'}`}><Heart size={20} fill={isCurrentlyFavorite ? "currentColor" : "none"} strokeWidth={isCurrentlyFavorite ? 2.5 : 2} /></button>
                {currentUser && isCurrentlyFavorite && !isPlayingAd && (
                  <button onClick={() => { setShowChat(!showChat); if (!showChat) setUnreadListenerChat(false); }} className={`relative p-2 transition-all duration-300 hover:scale-110 rounded-full ${showChat ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-white'}`}>
                    <MessageSquare size={18} />
                    {!showChat && unreadListenerChat && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#ccff00] rounded-full border-2 border-black animate-pulse"></span>}
                  </button>
                )}
                {canUseCustomEQ && !isPlayingAd && (
                  <div className="relative" ref={eqMenuRef}>
                    <button onClick={() => setShowEQMenu(!showEQMenu)} className={`p-2 transition-all duration-300 hover:scale-110 rounded-full ${showEQMenu || currentPreset !== 'Station Default' ? 'bg-[#ccff00]/20 text-[#ccff00]' : 'text-zinc-500 hover:text-white'}`}>
                      <SlidersHorizontal size={18} />
                    </button>
                    {showEQMenu && (
                      <div className="absolute bottom-full left-0 mb-4 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 animate-in fade-in slide-in-from-bottom-2">
                        <div className="px-3 py-2 mb-2 border-b border-white/5"><span className="text-[10px] font-black uppercase tracking-widest text-[#ccff00]">Audio Studio</span></div>
                        {[
                          { id: 'Station Default', label: 'Προεπιλογή Σταθμού', icon: Radio },
                          { id: 'HomeTheater', label: 'Home Theater', icon: MonitorSpeaker },
                          { id: 'HiRes', label: 'Hi-Res Audio (Studio)', icon: Headphones },
                          { id: 'Immersive3D', label: 'Immersive 3D (Spatial)', icon: Waves }
                        ].map(preset => (
                          <button key={preset.id} onClick={() => { onUserDSPChange(currentStation._id, preset.id); setShowEQMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${currentPreset === preset.id ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
                            <preset.icon size={14} /> <span>{preset.label}</span>
                          </button>
                        ))}
                        <div className="my-1 border-t border-white/5"></div>
                        <button onClick={() => { onUserDSPChange(currentStation._id, 'OFF'); setShowEQMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${currentPreset === 'OFF' ? 'bg-red-500/10 text-red-500' : 'text-zinc-500 hover:text-white'}`}>
                          <PowerOff size={14} /> <span>Χωρίς εφέ</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <ShareStory currentStation={currentStation} nowPlaying={nowPlaying} />
              </div>
            </>
          ) : ( 
            <div className="text-xs font-bold text-zinc-600 uppercase tracking-widest italic flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 animate-pulse"></div> Επιλέξτε Σταθμό
            </div> 
          )}
        </div>

        <div className="flex flex-col items-center gap-2 w-1/3">
          <div className="flex items-center gap-6">
            <button onClick={handlePrevStation} disabled={isPlayingAd || adWarning} className="text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-20"><SkipBack size={22} fill="currentColor" /></button>
            
            <button onClick={togglePlayPause} disabled={!currentStation || isPlayingAd} className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 shadow-xl disabled:bg-zinc-800">
              {isBuffering ? (
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-1.5 h-1.5 bg-black rounded-full dot-1"></div>
                    <div className="w-1.5 h-1.5 bg-black rounded-full dot-2"></div>
                    <div className="w-1.5 h-1.5 bg-black rounded-full dot-3"></div>
                  </div>
              ) : isPlaying && !isPlayingAd ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" className="ml-1" />
              )}
            </button>

            <button onClick={handleNextStation} disabled={isPlayingAd || adWarning} className="text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-20"><SkipForward size={22} fill="currentColor" /></button>
          </div>

          {currentStation && (
            <div className="h-5 flex items-center">
              {adWarning ? (
                <span className="text-[10px] font-black uppercase tracking-widest text-[#ccff00] animate-bounce">ΔΙΑΦΗΜΙΣΗ ΣΕ {adWarning}...</span>
              ) : isPlayingAd ? (
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#ccff00] animate-pulse">ADVERTISEMENT • {adTimeRemaining}s</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isRecognizing ? 'bg-blue-400 animate-ping' : isPlaying ? 'bg-[#ccff00] shadow-[0_0_8px_#ccff00]' : 'bg-red-500'}`}></div>
                  <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all ${isRecognizing ? 'text-blue-400' : 'text-[#ccff00]'}`}>
                    {!currentUser ? 'Συνδέσου στο iRadios για NowPlaying' : isRecognizing ? nowPlaying : (!isRealSong ? (isPlaying ? 'ΠΑΙΖΕΙ ΤΩΡΑ' : 'STOPPED') : nowPlaying)}
                  </span>
                  {currentUser&&nowPlayingInfo?.foundWithAI&&isRealSong&&!isPlayingAd&&<FoundWithAI compact/>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end items-center gap-6 w-1/3 pr-4 group">
          <div className="flex items-center gap-3 w-32">
            <Volume2 size={16} className="text-zinc-500 group-hover:text-[#ccff00] transition-colors shrink-0" />
            <div className="w-full h-1.5 bg-zinc-800 rounded-full relative overflow-hidden shadow-inner">
              <div className="absolute top-0 left-0 h-full bg-[#ccff00] transition-all" style={{ width: `${parseFloat(volume) * 100}%` }}></div>
              <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
            </div>
          </div>
          <div className="w-px h-6 bg-white/10 mx-2"></div>
          {isPremium && (
            <div className="relative" ref={devicesMenuRef}>
              <button onClick={() => { setShowDevicesMenu(!showDevicesMenu); if (!showDevicesMenu && onRequestDevices) onRequestDevices(); }} className={`p-2 transition-all hover:scale-110 active:scale-95 rounded-full ${isPlaying ? 'text-[#ccff00]' : 'text-zinc-500 hover:text-white'}`} title="Συσκευές Αναπαραγωγής">
                <MonitorSpeaker size={20} />
              </button>
              {showDevicesMenu && (
                <div className="absolute bottom-full right-0 mb-6 w-72 bg-zinc-900 border border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-4 z-[100] animate-in fade-in slide-in-from-bottom-2">
                  <div className="absolute -bottom-2 right-4 w-4 h-4 bg-zinc-900 border-b border-r border-white/10 rotate-45"></div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white">Συνδεδεμενες Συσκευες</span>
                    <button onClick={() => setShowDevicesMenu(false)} className="text-zinc-500 hover:text-white"><X size={16}/></button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {availableDevices.length === 0 && (
                       <button className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all bg-[#ccff00]/10 border border-[#ccff00]/20 cursor-default">
                         <div className="flex items-center gap-3"><Laptop size={18} className="text-[#ccff00]" /><span className="text-sm font-bold text-[#ccff00]">Αυτή η συσκευή</span></div>
                         {isPlaying && <div className="w-1.5 h-1.5 rounded-full bg-[#ccff00] animate-pulse shadow-[0_0_8px_#ccff00]"></div>}
                       </button>
                    )}
                    {availableDevices.map(device => {
                      const isLocal = device.deviceId === localDeviceId;
                      const isMobileDev = /iphone|ipad|android|mobile/i.test(device.deviceName);
                      const DeviceIcon = isMobileDev ? Smartphone : Laptop;
                      return (
                        <button key={device.deviceId} onClick={(e) => { e.stopPropagation(); onTransferPlayback(device.deviceId); setShowDevicesMenu(false); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${device.isPlaying ? 'bg-[#ccff00]/10 border border-[#ccff00]/20' : 'bg-zinc-950/50 border border-white/5 hover:bg-white/5 hover:border-white/10'}`}>
                          <div className="flex items-center gap-3">
                            <DeviceIcon size={18} className={device.isPlaying ? 'text-[#ccff00]' : 'text-zinc-400'} />
                            <div className="flex flex-col items-start">
                              <span className={`text-sm font-bold leading-tight ${device.isPlaying ? 'text-[#ccff00]' : 'text-zinc-300'}`}>{isLocal ? 'Αυτή η συσκευή' : device.deviceName}</span>
                              {isLocal && <span className="text-[9px] text-[#ccff00] uppercase tracking-widest">{device.deviceName}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          <button onClick={() => setIsMaximized(true)} className="p-2 text-zinc-500 hover:text-[#ccff00] transition-colors active:scale-90" title="Πλήρης Οθόνη"><Maximize2 size={20} /></button>
        </div>
      </footer>

      {showChat && currentStation && currentUser && (
        <LiveChat currentStation={currentStation} currentUser={currentUser} onClose={() => setShowChat(false)} />
      )}
    </>
  );
}
