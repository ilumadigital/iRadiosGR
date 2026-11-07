import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Play, Pause, Heart, SkipBack, Car, SkipForward, MessageSquare, 
  ScanSearch, Loader2, ChevronUp, ChevronDown, Radio, SignalHigh, 
  AlertTriangle, CalendarDays, MonitorSpeaker, Headphones, PowerOff, 
  SlidersHorizontal, Waves, Laptop, Smartphone, X 
} from 'lucide-react';
import LiveChat from './LiveChat'; 
import ShareStory from './ShareStory';
import { useAlert } from '../context/AlertContext';

export default function MobileMiniPlayer({
  currentStation,
  isPlayingAd,
  currentAdInfo,
  adTimeRemaining,
  adWarning,
  nowPlaying,
  isPlaying,
  isBuffering, 
  togglePlayPause,
  toggleFavorite,
  isFavorite,
  currentUser,
  handleNextStation,
  handlePrevStation,
  unreadListenerChat, setUnreadListenerChat,
  isRecognizing, handleRecognizeTrack,
  spotifyUrl, onOpenCarMode,
  userOverrides, onUserDSPChange,
  availableDevices = [],
  localDeviceId,
  onTransferPlayback,
  onRequestDevices,
  globalCoverArt
}) {

  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const location = useLocation(); 
  
  const [showChat, setShowChat] = useState(false); 
  const [isMaximized, setIsMaximized] = useState(false);
  
  // 🟢 ΝΕΑ TOUCH STATES ΓΙΑ ΤΟ SMOOTH SWIPE
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [swipeX, setSwipeX] = useState(0); 
  const [isAnimatingX, setIsAnimatingX] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);

  const [showEQMenu, setShowEQMenu] = useState(false); 
  const [showDevicesMenu, setShowDevicesMenu] = useState(false); 

  const eqMenuRef = useRef(null);
  const devicesMenuRef = useRef(null);
  const lastTrackedAdId = useRef(null);

  const isIOS = typeof navigator !== 'undefined' && 
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  useEffect(() => { setIsMaximized(false); }, [location.pathname]);

  useEffect(() => {
    const handleMinify = () => setIsMaximized(false);
    window.addEventListener('minify_player', handleMinify);
    return () => window.removeEventListener('minify_player', handleMinify);
  }, []);

  useEffect(() => { setShowChat(false); }, [currentStation?._id]);

  useEffect(() => {
    if (isPlayingAd && currentAdInfo?._id && lastTrackedAdId.current !== currentAdInfo._id) {
      lastTrackedAdId.current = currentAdInfo._id;
      fetch(`/api/ads/${currentAdInfo._id}/impression`, { method: 'POST' }).catch(() => {});
    }
    if (!isPlayingAd) lastTrackedAdId.current = null;
  }, [isPlayingAd, currentAdInfo?._id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eqMenuRef.current && !eqMenuRef.current.contains(event.target)) setShowEQMenu(false);
      if (devicesMenuRef.current && !devicesMenuRef.current.contains(event.target)) setShowDevicesMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!currentStation) return null;

  const utmParams = "ref=iradiosapp&utm_campaign=mb_player_ir&utm_content=mb_player_ir&utm_medium=ilumadigitalagencyiradios&utm_source=iradios";
  const isCurrentlyFavorite = isFavorite(currentStation._id);
  const isPremium = currentUser?.isPremium || currentUser?.broadcasterProfile?.tier === 'premium';
  const canUseCustomEQ = currentStation && isPremium && isCurrentlyFavorite;
  const currentPreset = (currentStation && userOverrides?.[currentStation._id]) || 'Station Default';

  const isActualSong = 
    Boolean(currentUser) && !isRecognizing &&
    nowPlaying && typeof nowPlaying === 'string' &&
    nowPlaying !== "LIVE NOW" && 
    nowPlaying !== "ΠΑΙΖΕΙ ΤΩΡΑ" && 
    !nowPlaying.toLowerCase().includes("αναζήτηση") && 
    !nowPlaying.toLowerCase().includes("ακούω") &&
    !nowPlaying.toLowerCase().includes("scanning");

  // Show factual stream metadata as a track label, never as a seekable duration.
  const trackParts = isActualSong ? nowPlaying.split(/\s+[-–—]\s+/) : [];
  const displayTrackTitle = trackParts.length > 1 ? trackParts.slice(1).join(' — ')
    : (isActualSong ? nowPlaying : currentStation.name);
  const displayTrackArtist = trackParts.length > 1 ? trackParts[0] : '';

  const finalSpotifyUrl = spotifyUrl || (isActualSong && nowPlaying ? `https://open.spotify.com/search/${encodeURIComponent(nowPlaying)}` : null);

  const minifiedImage = isPlayingAd && currentAdInfo?.logoUrl ? currentAdInfo.logoUrl : (currentStation?.logo || '');
  const showCoverArt = isActualSong && globalCoverArt && !isPlayingAd;
  const maximizedImage = isPlayingAd && currentAdInfo?.logoUrl 
    ? currentAdInfo.logoUrl 
    : (showCoverArt ? globalCoverArt : (currentStation?.logo || ''));

  const handleAdClick = (e) => {
    if (isPlayingAd && currentAdInfo?.linkUrl) {
      e.stopPropagation(); 
      fetch(`/api/ads/${currentAdInfo._id}/click`, { method: 'POST' }).catch(() => {});
      const separator = currentAdInfo.linkUrl.includes('?') ? '&' : '?';
      window.open(`${currentAdInfo.linkUrl}${separator}${utmParams}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRadarClick = (e) => {
    e.stopPropagation();
    if (!currentUser) {
      showAlert("Παρακαλούμε συνδεθείτε ή δημιουργήστε λογαριασμό εντελώς δωρεάν στο iRadios για να χρησιμοποιήσετε την Αναγνώριση Μουσικής!");
      return;
    }
    handleRecognizeTrack();
  };

  const handleSpotifyClick = (e) => {
    e.stopPropagation();
    if (isPremium) {
      window.open(finalSpotifyUrl, '_blank', 'noopener,noreferrer');
    } else {
      showAlert("Αναβαθμίστε σε Premium για 1-Click Spotify Save.");
      setIsMaximized(false);
      navigate('/premium');
    }
  };

  // 🟢 ------------------- TOUCH EVENT LOGIC ------------------- 🟢
  
  const handleTouchStart = (e) => { 
    setTouchStartY(e.touches[0].clientY); 
    setTouchStartX(e.touches[0].clientX); 
    setSwipeDirection(null);
    setIsAnimatingX(false);
  };

  const handleTouchMoveMinified = (e) => {
    if (!touchStartY) return;
    const currentY = e.touches[0].clientY;
    if (touchStartY - currentY > 30) { 
      setIsMaximized(true); 
      setTouchStartY(null); 
      setTouchStartX(null); 
    }
  };

  const handleTouchMoveMaximized = (e) => {
    if (!touchStartY || !touchStartX || showChat || showEQMenu || showDevicesMenu) return; 

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffY = currentY - touchStartY;
    const diffX = currentX - touchStartX;

    // Κλειδώνουμε την κατεύθυνση στο πρώτο ξεκάθαρο movement (X ή Y)
    if (!swipeDirection) {
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
        setSwipeDirection('x');
      } else if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
        setSwipeDirection('y');
      }
    }

    if (swipeDirection === 'x') {
      // Αν παίζει διαφήμιση, βάζουμε αντίσταση (resistance) στο swipe
      const resistance = (isPlayingAd || adWarning) ? 0.2 : 1;
      setSwipeX(diffX * resistance);
    } else if (swipeDirection === 'y' && diffY > 50) {
      // Minimize
      setIsMaximized(false);
      setTouchStartY(null);
      setTouchStartX(null);
      setSwipeDirection(null);
    }
  };

  const handleTouchEndMaximized = () => {
    if (swipeDirection === 'x') {
      const threshold = window.innerWidth * 0.25; // 25% της οθόνης για αλλαγή
      
      if (swipeX > threshold && !isPlayingAd && !adWarning) {
         // SWIPE RIGHT (Προηγούμενος Σταθμός)
         setIsAnimatingX(true);
         setSwipeX(window.innerWidth); // Πετάγεται δεξιά εκτός οθόνης
         
         setTimeout(() => {
           setIsAnimatingX(false); // Κλείνουμε το animation
           setSwipeX(-window.innerWidth); // Το πάμε αόρατα τέρμα αριστερά
           handlePrevStation(); // Φορτώνουμε τον νέο σταθμό

           // Μόλις αλλάξει, το φέρνουμε στο κέντρο με ομαλό animation
           requestAnimationFrame(() => {
             requestAnimationFrame(() => {
               setIsAnimatingX(true);
               setSwipeX(0); 
               setTimeout(() => setIsAnimatingX(false), 300); // Cleanup
             });
           });
         }, 250);

      } else if (swipeX < -threshold && !isPlayingAd && !adWarning) {
         // SWIPE LEFT (Επόμενος Σταθμός)
         setIsAnimatingX(true);
         setSwipeX(-window.innerWidth); // Πετάγεται αριστερά εκτός οθόνης
         
         setTimeout(() => {
           setIsAnimatingX(false);
           setSwipeX(window.innerWidth); // Το πάμε αόρατα τέρμα δεξιά
           handleNextStation();

           requestAnimationFrame(() => {
             requestAnimationFrame(() => {
               setIsAnimatingX(true);
               setSwipeX(0);
               setTimeout(() => setIsAnimatingX(false), 300);
             });
           });
         }, 250);
      } else {
         // Δεν έφτασε το threshold -> Επιστροφή στο κέντρο
         setIsAnimatingX(true);
         setSwipeX(0);
         setTimeout(() => setIsAnimatingX(false), 300);
      }
    }

    setTouchStartY(null);
    setTouchStartX(null);
    setSwipeDirection(null);
  };

  const handleTouchEndMinified = () => {
    setTouchStartY(null);
    setTouchStartX(null);
  };

  return (
    <>
      <style>
        {`
          @keyframes bounce-dot {
            0%, 100% { transform: translateY(0); opacity: 0.5; }
            50% { transform: translateY(-4px); opacity: 1; }
          }
          .dot-1 { animation: bounce-dot 0.6s infinite ease-in-out; }
          .dot-2 { animation: bounce-dot 0.6s infinite ease-in-out 0.2s; }
          .dot-3 { animation: bounce-dot 0.6s infinite ease-in-out 0.4s; }
        `}
      </style>

      {/* --- 1. FULL SCREEN (MAXIMIZED) PLAYER --- */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMoveMaximized}
        onTouchEnd={handleTouchEndMaximized}
        className={`ir-full-player fixed inset-0 z-[100] flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          isMaximized ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div 
             className={`absolute top-0 left-0 w-full h-[60%] transition-all duration-1000 ${isPlaying ? 'opacity-30 blur-3xl scale-150' : 'opacity-0'}`}
             style={{ backgroundImage: `url(${maximizedImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-transparent" />
        </div>

        <div className="relative z-10 flex h-full flex-col overflow-x-hidden overflow-y-auto px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
          
          <div className="relative flex items-center justify-between mb-8 min-h-[36px]">
            <div className="flex-1 flex justify-start z-10 relative">
              <button onClick={() => setIsMaximized(false)} aria-label="Ελαχιστοποίηση player" className="p-2 -ml-2 text-white/70 hover:text-white transition-colors active:scale-90">
                <ChevronDown size={28} />
              </button>
              
              {isPlaying && !isPlayingAd && !isBuffering && (
                <div className="absolute top-[38px] left-0 flex items-end gap-[3px] h-[20px]">
                  <div className="w-1 h-3 bg-[#ccff00] rounded-full animate-pulse" />
                  <div className="w-1 h-5 bg-white rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                  <div className="w-1 h-4 bg-[#ccff00] rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                  <div className="w-1 h-6 bg-white rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                  <div className="w-1 h-3 bg-[#ccff00] rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center z-0 w-3/5 pointer-events-none">
              <span className="text-[9px] font-black text-white/50 tracking-[0.25em] uppercase mb-0.5">ΖΩΝΤΑΝΑ ΣΤΟ iRadios</span>
              <span className="text-sm font-bold text-white tracking-wide truncate w-full text-center">{currentStation.name}</span>
            </div>

            <div className="flex-1 flex flex-col items-end gap-1.5 z-10">
              <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-[8px] font-black tracking-[0.1em] border shadow-md bg-zinc-800/80 text-zinc-300 border-white/10">
                {currentStation.transmissionType === 'Επίγειο' ? <Radio size={10} strokeWidth={3} /> : <SignalHigh size={10} strokeWidth={3} />}
                <span>{currentStation.transmissionType === 'Επίγειο' && currentStation.frequency ? currentStation.frequency : 'WEB'}</span>
              </div>

              {currentStation.explicit && (
                <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-red-500/15 text-red-400 border border-red-500/30 text-[8px] font-black tracking-[0.1em] uppercase rounded-full">
                  <AlertTriangle size={10} strokeWidth={3} />
                  <span>Explicit</span>
                </div>
              )}
            </div>
          </div>

          {/* 🟢 Κεντρική Εικόνα Maximized Player ΜΕ SWIPE ANIMATION */}
          <div 
            className="flex-1 flex flex-col items-center justify-center w-full relative z-10 will-change-transform"
            style={{
              transform: `translateX(${swipeX}px)`,
              transition: isAnimatingX ? 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
            }}
          >
            <div className="relative mb-5 flex aspect-square w-full max-w-[min(68vw,310px)] justify-center sm:max-w-[340px]">
              <img 
                onClick={handleAdClick}
                src={maximizedImage} 
                alt={currentStation.name}
                className={`ir-full-player-art w-full h-full transition-all duration-500 mx-auto ${
                  showCoverArt ? 'object-cover shadow-2xl' : 'bg-white object-contain p-4'
                } ${isPlayingAd ? 'cursor-pointer' : 'pointer-events-none'} ${
                  isPlaying && !isBuffering ? 'scale-100 shadow-[0_30px_60px_rgba(0,0,0,0.6)]' : 'scale-95 grayscale-[30%] opacity-80'
                }`}
              />

              {showCoverArt && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none rounded-[32px]"></div>
                  <div className="absolute bottom-3 left-3 z-20">
                    <div className="bg-white p-1 rounded-xl shadow-lg w-14 h-14 flex items-center justify-center border border-black/5 overflow-hidden">
                      <img src={currentStation.logo} alt={currentStation.name} className="w-full h-full object-contain" />
                    </div>
                  </div>
                  <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse shadow-[0_0_8px_#ccff00]"></div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">NOW PLAYING</span>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex flex-col items-center text-center gap-1 w-full max-w-sm px-2">
              <h2 onClick={handleAdClick} className="text-2xl sm:text-3xl font-black text-white truncate tracking-tight w-full">
                {isPlayingAd ? (currentAdInfo?.client || 'Διαφήμιση') : displayTrackTitle}
              </h2>
              <p className={`text-base sm:text-lg font-medium truncate w-full ${isRecognizing ? 'text-blue-400 animate-pulse' : 'text-zinc-400'}`}>
                {isPlayingAd ? `${currentAdInfo?.title || 'Sponsored Ad'} • ${adTimeRemaining}s` : (isRecognizing ? 'Αναγνώριση...' : (isActualSong ? (displayTrackArtist || currentStation.name) : 'Ζωντανό ραδιόφωνο'))}
              </p>
              {!isPlayingAd && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="ir-live-indicator">LIVE RADIO</span>
                  <span className="max-w-[150px] truncate text-xs text-zinc-400">{currentStation.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Decorative motion only; live radio has no track progress bar. */}
          {!isPlayingAd && (
            <div className={`ir-live-visualizer mb-3 ${(!isPlaying || isBuffering) ? 'ir-live-visualizer--paused' : ''}`} aria-hidden="true">
              {Array.from({ length: 23 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
            </div>
          )}

          {/* MAIN CONTROLS - MAXIMIZED PLAYER */}
          <div className="ir-full-player-actions grid grid-cols-3 items-center justify-between mb-4 px-2 w-full">
            <div className="flex justify-start">
              {!isPlayingAd && (
                <button onClick={(e) => { e.stopPropagation(); toggleFavorite(currentStation._id); }} aria-label={isCurrentlyFavorite ? "Αφαίρεση από αγαπημένα" : "Προσθήκη στα αγαπημένα"} className={`p-2 rounded-full transition-all active:scale-90 ${isCurrentlyFavorite ? 'text-[#ccff00]' : 'text-white/40 hover:text-white'}`}>
                  <Heart size={28} fill={isCurrentlyFavorite ? "currentColor" : "none"} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 sm:gap-6 w-full">
              <button 
                onClick={(e) => { e.stopPropagation(); handlePrevStation(); }} aria-label="Προηγούμενος σταθμός" 
                onTouchStart={(e) => e.stopPropagation()} 
                disabled={isPlayingAd || adWarning || !isPremium} 
                className={`p-4 transition-all ${(!isPremium || isPlayingAd || adWarning) ? 'opacity-20' : 'text-white active:scale-90'}`}
              >
                <SkipBack size={32} fill="currentColor" />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} 
                onTouchStart={(e) => e.stopPropagation()} 
                disabled={isPlayingAd} 
                aria-label={isPlaying ? 'Παύση ραδιοφώνου' : 'Αναπαραγωγή ραδιοφώνου'}
                className={`ir-player-transport w-[72px] h-[72px] sm:w-20 sm:h-20 mx-1 shrink-0 rounded-full flex items-center justify-center transition-all active:scale-95 ${isPlayingAd ? 'opacity-50' : ''}`}
              >
                {isBuffering ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-2.5 h-2.5 bg-black rounded-full dot-1"></div>
                    <div className="w-2.5 h-2.5 bg-black rounded-full dot-2"></div>
                    <div className="w-2.5 h-2.5 bg-black rounded-full dot-3"></div>
                  </div>
                ) : isPlaying ? (
                  <Pause size={36} fill="currentColor" />
                ) : (
                  <Play size={36} fill="currentColor" className="ml-1" />
                )}
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); handleNextStation(); }} aria-label="Επόμενος σταθμός" 
                onTouchStart={(e) => e.stopPropagation()} 
                disabled={isPlayingAd || adWarning} 
                className={`p-4 transition-all ${(isPlayingAd || adWarning) ? 'opacity-20' : 'text-white active:scale-90'}`}
              >
                <SkipForward size={32} fill="currentColor" />
              </button>
            </div>

            <div className="flex justify-end relative" ref={devicesMenuRef}>
              {isPremium ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setShowDevicesMenu(!showDevicesMenu); if (!showDevicesMenu && onRequestDevices) onRequestDevices(); }} className={`p-2 rounded-full transition-all active:scale-90 ${isPlaying ? 'text-[#ccff00]' : 'text-white/40 hover:text-white'}`}>
                    <MonitorSpeaker size={28} />
                  </button>
                  {showDevicesMenu && (
                    <div className="absolute bottom-full right-0 mb-4 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-4 z-[100] animate-in zoom-in-95 text-left">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#ccff00]">Συσκευες</span>
                        <button onClick={(e) => { e.stopPropagation(); setShowDevicesMenu(false); }} className="text-zinc-500 hover:text-white"><X size={16}/></button>
                      </div>
                      <div className="flex flex-col gap-2">
                        {availableDevices.length === 0 && (
                           <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#ccff00]/10 border border-[#ccff00]/20 cursor-default">
                             <div className="flex items-center gap-3"><Smartphone size={16} className="text-[#ccff00]" /><span className="text-xs font-bold text-[#ccff00]">Αυτό το κινητό</span></div>
                           </button>
                        )}
                        {availableDevices.map(device => {
                          const isLocal = device.deviceId === localDeviceId;
                          const isMobileDev = /iphone|ipad|android|mobile/i.test(device.deviceName);
                          const DeviceIcon = isMobileDev ? Smartphone : Laptop;
                          return (
                            <button key={device.deviceId} onClick={(e) => { e.stopPropagation(); onTransferPlayback(device.deviceId); setShowDevicesMenu(false); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${device.isPlaying ? 'bg-[#ccff00]/10 border border-[#ccff00]/20' : 'bg-zinc-950/50 border border-white/5 hover:bg-white/5'}`}>
                              <div className="flex items-center gap-3">
                                <DeviceIcon size={16} className={device.isPlaying ? 'text-[#ccff00]' : 'text-zinc-400'} />
                                <span className={`text-xs font-bold ${device.isPlaying ? 'text-[#ccff00]' : 'text-zinc-300'}`}>{isLocal ? 'Αυτό το κινητό' : device.deviceName}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (!isPlayingAd && <button onClick={() => { setIsMaximized(false); navigate(`/station/${currentStation.slug || currentStation._id}`); }} className="p-2 rounded-full transition-all active:scale-90 text-white/40 hover:text-white"><CalendarDays size={28} /></button>)}
            </div>
          </div>

          {!isPlayingAd && (
            <div className="mb-4 flex justify-center">
              <button type="button" onClick={handleRadarClick} disabled={isRecognizing || !isPlaying}
                className="ir-recognize-button" aria-label="Αναγνώριση τραγουδιού με ACRCloud">
                {isRecognizing ? <Loader2 size={17} className="animate-spin" /> : <ScanSearch size={17} />}
                {isRecognizing ? 'Γίνεται αναγνώριση...' : 'Αναγνώριση τραγουδιού'}
              </button>
            </div>
          )}
          <div className="flex items-center justify-evenly bg-white/5 border border-white/10 rounded-3xl py-3 px-2">
            {isPremium && !isPlayingAd && <button onClick={() => { setIsMaximized(false); navigate(`/station/${currentStation.slug || currentStation._id}`); }} className="p-3 text-white/80 hover:text-white rounded-full active:scale-90 transition-all"><CalendarDays size={24} /></button>}
            
            {!isPlayingAd && (!isActualSong ? (
                <button onClick={handleRadarClick} disabled={isRecognizing || !isPlaying} className={`p-3 rounded-full transition-all active:scale-90 ${isRecognizing ? 'text-[#ccff00] animate-pulse' : 'text-white'}`}>
                  {isRecognizing ? <Loader2 size={24} className="animate-spin" /> : <ScanSearch size={24} />}
                </button>
              ) : (
                <button onClick={handleSpotifyClick} className={`p-3 rounded-full transition-all active:scale-90 ${isPremium ? 'text-[#1DB954]' : 'text-zinc-600 hover:text-zinc-400'}`}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.48-1.02.659-1.56.3z"/></svg>
                </button>
              )
            )}

            {isPremium && !isPlayingAd && <button onClick={onOpenCarMode} className="p-3 text-orange-500 rounded-full active:scale-90 transition-all"><Car size={24} /></button>}

            {canUseCustomEQ && !isPlayingAd && !isIOS && (
              <div className="relative" ref={eqMenuRef}>
                <button onClick={(e) => { e.stopPropagation(); setShowEQMenu(!showEQMenu); }} className={`p-3 transition-all duration-300 hover:scale-110 rounded-full ${showEQMenu || currentPreset !== 'Station Default' ? 'bg-[#ccff00]/20 text-[#ccff00]' : 'text-zinc-500 hover:text-white'}`}>
                  <SlidersHorizontal size={24} />
                </button>
                {showEQMenu && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-[100] animate-in zoom-in-95">
                    <div className="px-3 py-2 mb-2 border-b border-white/5 text-center"><span className="text-[10px] font-black uppercase tracking-widest text-[#ccff00]">Audio Studio</span></div>
                    {[{ id: 'Station Default', label: 'Προεπιλογή Σταθμού', icon: Radio }, { id: 'HomeTheater', label: 'Home Theater', icon: MonitorSpeaker }, { id: 'HiRes', label: 'Hi-Res Audio (Studio)', icon: Headphones }, { id: 'Immersive3D', label: 'Immersive 3D (Spatial)', icon: Waves }].map(preset => (
                      <button key={preset.id} onClick={(e) => { e.stopPropagation(); onUserDSPChange(currentStation._id, preset.id); setShowEQMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${currentPreset === preset.id ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}><preset.icon size={14} /> <span>{preset.label}</span></button>
                    ))}
                    <div className="my-1 border-t border-white/5"></div>
                    <button onClick={(e) => { e.stopPropagation(); onUserDSPChange(currentStation._id, 'OFF'); setShowEQMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${currentPreset === 'OFF' ? 'bg-red-500/10 text-red-500' : 'text-zinc-500 hover:text-white'}`}><PowerOff size={14} /> <span>DSP Off</span></button>
                  </div>
                )}
              </div>
            )}

            {currentUser && isCurrentlyFavorite && !isPlayingAd && (
              <button onClick={() => { setShowChat(!showChat); if (!showChat) setUnreadListenerChat(false); }} className={`relative p-3 rounded-full transition-all active:scale-90 ${showChat ? 'text-blue-400' : 'text-white'}`}>
                <MessageSquare size={24} />
                {!showChat && unreadListenerChat && <span className="absolute top-2 right-2 w-3 h-3 bg-[#ccff00] rounded-full shadow-[0_0_10px_#ccff00] animate-pulse"></span>}
              </button>
            )}

            {!isPlayingAd && <ShareStory currentStation={currentStation} nowPlaying={nowPlaying} isMaximized={true} />}
          </div>
        </div>

        {showChat && currentStation && currentUser && (
          <div className="absolute inset-0 z-50 bg-black/90 animate-in fade-in slide-in-from-bottom-10">
            <LiveChat currentStation={currentStation} currentUser={currentUser} onClose={() => setShowChat(false)} />
          </div>
        )}
      </div>

      {/* --- 2. MINIFIED PLAYER (ΚΑΤΩ ΜΠΑΡΑ) --- */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMoveMinified}
        onTouchEnd={handleTouchEndMinified}
        onClick={() => setIsMaximized(true)} 
        role="button" tabIndex={0} aria-label={`Άνοιγμα player: ${currentStation.name}`}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setIsMaximized(true); } }}
        className={`ir-mini-player fixed bottom-[84px] left-2 right-2 h-[68px] flex items-center justify-between px-3 lg:hidden z-[90] cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          isMaximized ? 'translate-y-[150%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 pointer-events-none">
          <div className="relative shrink-0">
            <img 
               src={minifiedImage} 
               className={`ir-mini-player-logo w-12 h-12 shadow-lg bg-white object-contain p-1 transition-all duration-500 ${!isPlaying && !isBuffering ? 'scale-95 grayscale-[30%]' : ''}`} 
               alt="" 
            />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            {isPlayingAd ? (
              <div onClick={handleAdClick} className="cursor-pointer group pointer-events-auto">
                <div className="text-[10px] font-black text-[#ccff00] uppercase tracking-[0.15em]">Ad • {adTimeRemaining}s</div>
                <div className="text-sm font-bold text-white truncate">{currentAdInfo?.title || 'Διαφήμιση'}</div>
              </div>
            ) : (
              <>
                <div className="text-sm font-bold text-white truncate tracking-tight">{currentStation.name}</div>
                <div className={`text-[11px] font-medium truncate max-w-[140px] mt-0.5 ${isRecognizing ? 'text-blue-400 animate-pulse' : 'text-zinc-400'}`}>
                  {isRecognizing ? "Αναγνώριση..." : (isActualSong ? nowPlaying : "Ζωντανό ραδιόφωνο")}
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center shrink-0">
          {!isPlayingAd && (
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(currentStation._id); }} aria-label={isCurrentlyFavorite ? "Αφαίρεση από αγαπημένα" : "Προσθήκη στα αγαπημένα"} className={`p-2 transition-all active:scale-90 mr-1 ${isCurrentlyFavorite ? 'text-[#ccff00]' : 'text-zinc-400'}`}>
              <Heart size={20} fill={isCurrentlyFavorite ? "currentColor" : "none"} />
            </button>
          )}

          {isPremium && (
            <button onClick={(e) => { e.stopPropagation(); handlePrevStation(); }} aria-label="Προηγούμενος σταθμός" disabled={isPlayingAd || adWarning} className={`p-2 transition-all ${(isPlayingAd || adWarning) ? 'opacity-20' : 'text-white active:scale-90'}`}>
              <SkipBack size={20} fill="currentColor" />
            </button>
          )}

          <button onClick={(e) => { e.stopPropagation(); togglePlayPause(); }} disabled={isPlayingAd} aria-label={isPlaying ? 'Παύση ραδιοφώνου' : 'Αναπαραγωγή ραδιοφώνου'}
            className={`ir-player-transport w-11 h-11 mx-1 rounded-full flex items-center justify-center transition-all active:scale-95 ${isPlayingAd ? 'opacity-50' : ''}`}>
            {isBuffering ? (
              <div className="flex items-center justify-center gap-0.5">
                <div className="w-1.5 h-1.5 bg-black rounded-full dot-1"></div>
                <div className="w-1.5 h-1.5 bg-black rounded-full dot-2"></div>
                <div className="w-1.5 h-1.5 bg-black rounded-full dot-3"></div>
              </div>
            ) : isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" className="ml-0.5" />
            )}
          </button>

          <button onClick={(e) => { e.stopPropagation(); handleNextStation(); }} aria-label="Επόμενος σταθμός" disabled={isPlayingAd || adWarning} className={`p-2 transition-all ${(isPlayingAd || adWarning) ? 'opacity-20' : 'text-white active:scale-90'}`}>
            <SkipForward size={20} fill="currentColor" />
          </button>

          <div className="pl-2 ml-1 border-l border-white/10 text-zinc-500">
            <ChevronUp size={22} />
          </div>
        </div>
      </div>
    </>
  );
}
