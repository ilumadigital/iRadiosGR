import React, { useState, useEffect, useRef } from 'react';
import { formatFMFrequency } from '../utils/stationFrequency';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Play, Pause, Heart, SkipBack, Car, SkipForward, MessageSquare, 
  ScanSearch, Loader2, ChevronUp, ChevronDown, Radio, SignalHigh, 
  AlertTriangle, CalendarDays, MonitorSpeaker, Headphones, PowerOff, 
  SlidersHorizontal, Waves, Laptop, Smartphone, X, Ellipsis, RefreshCw 
} from 'lucide-react';
import LiveChat from './LiveChat'; 
import ShareStory from './ShareStory';
import FoundWithAI from './FoundWithAI';
import MusicServiceLinks from './MusicServiceLinks';
import RdsCrossfade from './RdsCrossfade';
import FullscreenArtwork from './FullscreenArtwork';
import OnAirShowCard from './OnAirShowCard';
import {parseMusicMetadata} from '../utils/musicMetadata';
import { useAlert } from '../context/AlertContext';
import '../styles/mobile-player-glass.css';

export default function MobileMiniPlayer({
  currentStation,
  isPlayingAd,
  currentAdInfo,
  adTimeRemaining,
  adWarning,
  nowPlaying,
  nowPlayingInfo,
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
  onOpenCarMode,
  userOverrides, onUserDSPChange,
  availableDevices = [],
  localDeviceId,
  onTransferPlayback,
  onRequestDevices,
  globalCoverArt,
  liveBroadcast,
  rdsShowProducer
}) {

  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const location = useLocation(); 
  
  const [showChat, setShowChat] = useState(false); 
  const [isMaximized, setIsMaximized] = useState(false);
  const fullscreenRef = useRef(null);
  
  // 🟢 ΝΕΑ TOUCH STATES ΓΙΑ ΤΟ SMOOTH SWIPE
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [swipeX, setSwipeX] = useState(0); 
  const [isAnimatingX, setIsAnimatingX] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);

  const [showEQMenu, setShowEQMenu] = useState(false); 
  const [showDevicesMenu, setShowDevicesMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false); 

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

  useEffect(() => { setShowChat(false); setShowMoreMenu(false); setShowDevicesMenu(false); setShowEQMenu(false); }, [currentStation?._id]);
  useEffect(()=>{
    if(!isMaximized)return;
    const previousOverflow=document.body.style.overflow;
    const previousFocus=document.activeElement;
    document.body.style.overflow='hidden';
    fullscreenRef.current?.querySelector('[aria-label="Ελαχιστοποίηση player"]')?.focus();
    const onEscape=e=>{
      if(e.key==='Escape'){
        if(showChat)setShowChat(false);
        else if(showEQMenu)setShowEQMenu(false);
        else if(showDevicesMenu)setShowDevicesMenu(false);
        else if(showMoreMenu)setShowMoreMenu(false);
        else setIsMaximized(false);
      }
    };
    document.addEventListener('keydown',onEscape);
    return ()=>{
      document.body.style.overflow=previousOverflow;
      document.removeEventListener('keydown',onEscape);
      if(previousFocus?.isConnected)previousFocus.focus();
    };
  },[isMaximized,showChat,showEQMenu,showDevicesMenu,showMoreMenu]);

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

  const currentTrack=parseMusicMetadata(nowPlaying,currentStation?.name);
  const isActualSong=Boolean(currentUser&&!isRecognizing&&!isPlayingAd&&currentTrack);
  const showProducerArt=Boolean(currentUser&&!isPlayingAd&&!isRecognizing&&
    liveBroadcast?.imageUrl&&rdsShowProducer);
  const visibleSong=isActualSong;

  const minifiedImage = isPlayingAd && currentAdInfo?.logoUrl ? currentAdInfo.logoUrl : (currentStation?.logo || '');
  const showCoverArt = Boolean(isActualSong && globalCoverArt && !isPlayingAd);
  const canShowDj=Boolean(currentUser&&!isPlayingAd&&!isRecognizing&&liveBroadcast?.imageUrl);
  const maximizedImage = isPlayingAd && currentAdInfo?.logoUrl 
    ? currentAdInfo.logoUrl 
    : (showCoverArt ? globalCoverArt : (showProducerArt?liveBroadcast.imageUrl:(currentStation?.logo || '')));

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
      showAlert("Συνδέσου στο iRadios για να βρεις ποιο τραγούδι παίζει.");
      return;
    }
    handleRecognizeTrack();
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
    if (touchStartY === null || touchStartX === null || showChat || showEQMenu || showDevicesMenu || showMoreMenu) return; 

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


  const openStationProfile = () => {
    setIsMaximized(false);
    setShowMoreMenu(false);
    navigate('/station/' + (currentStation.slug || currentStation._id));
  };

  const openCarMode = () => {
    if (!isPremium) {
      showAlert('Αναβαθμίστε σε Premium για να χρησιμοποιήσετε το Car Mode.');
      return;
    }
    setShowMoreMenu(false);
    setIsMaximized(false);
    onOpenCarMode?.();
  };

  const openDevices = () => {
    if (!isPremium) {
      showAlert('Αναβαθμίστε σε Premium για να αλλάζετε συσκευή αναπαραγωγής.');
      return;
    }
    setShowMoreMenu(false);
    setShowDevicesMenu(true);
    onRequestDevices?.();
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


      {/* --- 1. FULL SCREEN: liquid glass, single-purpose controls --- */}
      <div
        ref={fullscreenRef}
        role="dialog"
        aria-label={'Πλήρης αναπαραγωγή: ' + currentStation.name}
        aria-modal={isMaximized}
        aria-hidden={!isMaximized}
        inert={!isMaximized}
        tabIndex={-1}
        className={'ir-full-player ir-full-player--glass fixed inset-0 z-[100] flex h-[100vh] h-[100dvh] min-h-0 flex-col overflow-hidden overscroll-contain transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform lg:hidden ' +
          (isMaximized ? 'translate-y-0' : 'translate-y-full')}
      >
        <div className="ir-glass-backdrop" aria-hidden="true">
          <div className="ir-glass-backdrop__art" style={{ backgroundImage: 'url("' + maximizedImage + '")' }} />
          <div className="ir-glass-backdrop__veil" />
        </div>

        <div className="ir-mobile-player-content ir-glass-layout relative z-10 flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain">
          <header className="ir-glass-header">
            <button type="button" onClick={() => setIsMaximized(false)}
              aria-label="Ελαχιστοποίηση player" className="ir-glass-header__close">
              <ChevronDown size={25} />
            </button>
            <button type="button" onClick={openStationProfile}
              className="ir-glass-header__station" aria-label={'Άνοιγμα προφίλ σταθμού ' + currentStation.name}>
              <span className="ir-glass-header__eyebrow"><span className="ir-glass-live-dot"/> ΖΩΝΤΑΝΑ ΣΤΟ iRadios</span>
              <strong>{currentStation.name}</strong>
            </button>
            <div className="ir-glass-header__right">
              <div className="ir-glass-broadcast-pill">
                {currentStation.transmissionType === 'Επίγειο' ? <Radio size={12} /> : <SignalHigh size={12} />}
                <span>{currentStation.transmissionType === 'Επίγειο' && currentStation.frequency
                  ? formatFMFrequency(currentStation.frequency) : 'WEB'}</span>
              </div>
              {currentStation.explicit && <span className="ir-glass-explicit"><AlertTriangle size={11}/> Explicit</span>}
            </div>
          </header>

          {/* Only the artwork/track stage owns swipes; scrolling and bottom controls remain predictable. */}
          <section className="ir-glass-stage" aria-label="Εξώφυλλο και πληροφορίες σταθμού"
            onTouchStart={handleTouchStart} onTouchMove={handleTouchMoveMaximized}
            onTouchEnd={handleTouchEndMaximized}
            onTouchCancel={() => { setSwipeX(0); setTouchStartX(null); setTouchStartY(null); setSwipeDirection(null); }}>
            <div className="ir-glass-swipe-surface"
              style={{ transform: 'translateX(' + swipeX + 'px)',
                transition: isAnimatingX ? 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)' : 'none' }}>
              <div className="ir-mobile-player-artwrap ir-glass-artwrap">
                <FullscreenArtwork station={currentStation}
                  songCover={showCoverArt ? globalCoverArt : null}
                  producerImage={canShowDj ? liveBroadcast.imageUrl : null}
                  showProducer={showProducerArt}
                  adImage={isPlayingAd ? currentAdInfo?.logoUrl : null}
                  onAdClick={handleAdClick}
                  onStationClick={openStationProfile}
                  className="h-full w-full"/>
              </div>
              <div className="ir-glass-track-copy">
                <h2 onClick={handleAdClick} title={isActualSong ? currentTrack.title : currentStation.name}>
                  {isPlayingAd ? (currentAdInfo?.client || 'Διαφήμιση') :
                    (isActualSong ? currentTrack.title : (liveBroadcast?.show?.title || currentStation.name))}
                </h2>
                <p>{isPlayingAd ? (currentAdInfo?.title || 'Διαφημιστικό διάλειμμα') :
                    isRecognizing ? 'Αναγνώριση…' :
                    isActualSong ? currentTrack.artist :
                    (liveBroadcast?.show?.host || (currentUser ? 'Ζωντανό ραδιόφωνο' : 'Συνδέσου στο iRadios για NowPlaying'))}</p>
                {visibleSong && !isPlayingAd && nowPlayingInfo?.foundWithAI &&
                  <FoundWithAI compact className="ir-glass-found-ai"/>}
              </div>
              {!isPlayingAd && <OnAirShowCard show={liveBroadcast?.show} stationName={currentStation.name}
                className="ir-mobile-show-card ir-glass-on-air"/>}
            </div>
            <span className="ir-glass-swipe-help" aria-hidden="true">‹ &nbsp; Σύρε για αλλαγή σταθμού &nbsp; ›</span>
          </section>

          {!isPlayingAd && <div className={'ir-live-visualizer ir-glass-visualizer ' +
            ((!isPlaying || isBuffering) ? 'ir-live-visualizer--paused' : '')} aria-hidden="true">
            {Array.from({ length: 23 }, (_, i) => <span key={i} style={{ '--i': i }} />)}
          </div>}

          <nav className="ir-full-player-actions ir-glass-transport" aria-label="Χειριστήρια αναπαραγωγής">
            <button type="button" onClick={() => toggleFavorite(currentStation._id)}
              disabled={isPlayingAd} aria-label={isCurrentlyFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
              className={'ir-glass-transport__side ' + (isCurrentlyFavorite ? 'is-active' : '')}>
              <Heart size={25} fill={isCurrentlyFavorite ? 'currentColor' : 'none'} />
            </button>
            <button type="button" onClick={handlePrevStation} disabled={isPlayingAd || adWarning}
              aria-label="Προηγούμενος σταθμός" className="ir-glass-transport__skip">
              <SkipBack size={29} fill="currentColor" />
            </button>
            <button type="button" onClick={togglePlayPause} disabled={isPlayingAd}
              aria-label={isPlaying ? 'Παύση ραδιοφώνου' : 'Αναπαραγωγή ραδιοφώνου'}
              className="ir-player-transport ir-glass-transport__play">
              {isBuffering ? <span className="ir-glass-buffering"><i className="dot-1"/><i className="dot-2"/><i className="dot-3"/></span> :
                isPlaying ? <Pause size={33} fill="currentColor"/> :
                <Play size={33} fill="currentColor" className="ml-1"/>}
            </button>
            <button type="button" onClick={handleNextStation} disabled={isPlayingAd || adWarning}
              aria-label="Επόμενος σταθμός" className="ir-glass-transport__skip">
              <SkipForward size={29} fill="currentColor" />
            </button>
            <button type="button" onClick={() => setShowMoreMenu(true)} aria-label="Περισσότερες λειτουργίες"
              className="ir-glass-transport__side"><Ellipsis size={28}/></button>
          </nav>

          <div className="ir-glass-quick-access" aria-label="Γρήγορες λειτουργίες">
            <button type="button" onClick={openCarMode} className="ir-glass-quick-access__button">
              <Car size={22} aria-hidden="true"/>
              <span>Car Mode</span>
            </button>
            <button type="button" onClick={openDevices} className="ir-glass-quick-access__button">
              <MonitorSpeaker size={21} aria-hidden="true"/>
              <span>Συσκευές</span>
              {isPremium && availableDevices.length > 1 && <span className="ir-glass-device-count">{availableDevices.length}</span>}
            </button>
          </div>

          <div className="ir-glass-song-actions">
            {!isPlayingAd && <button type="button" onClick={handleRadarClick}
              disabled={isRecognizing || !isPlaying} className="ir-recognize-button"
              aria-label="Βρες ποιο τραγούδι παίζει">
              {isRecognizing ? <Loader2 size={17} className="animate-spin"/> : <ScanSearch size={17}/>}
              {isRecognizing ? 'Ψάχνουμε το τραγούδι…' : 'Βρες το τραγούδι'}
            </button>}
            {isActualSong && <MusicServiceLinks song={nowPlaying} stationName={currentStation.name}
              currentUser={currentUser} compact className="ir-music-links--mobile-player"/>}
          </div>
        </div>

        {showMoreMenu && <div className="ir-glass-sheet-layer">
          <button type="button" className="ir-glass-sheet-scrim" aria-label="Κλείσιμο μενού"
            onClick={() => { setShowMoreMenu(false); setShowEQMenu(false); }}/>
          <section role="dialog" aria-modal="true" aria-label="Περισσότερες λειτουργίες"
            className="ir-glass-sheet">
            <div className="ir-glass-sheet__handle" aria-hidden="true"/>
            <div className="ir-glass-sheet__header">
              <div><span className="ir-glass-sheet__eyebrow">iRadios PLAYER</span><h3>Περισσότερα</h3></div>
              <button type="button" onClick={() => { setShowMoreMenu(false); setShowEQMenu(false); }}
                aria-label="Κλείσιμο μενού" className="ir-glass-sheet__close"><X size={21}/></button>
            </div>
            <div className="ir-glass-more-grid">
              <button type="button" onClick={openStationProfile} className="ir-glass-more-tile">
                <CalendarDays size={24}/><span>Σταθμός &amp; πρόγραμμα</span>
              </button>
              {currentUser && isCurrentlyFavorite && !isPlayingAd &&
                <button type="button" onClick={() => { setShowMoreMenu(false); setShowChat(true); setUnreadListenerChat(false); }}
                  className="ir-glass-more-tile">
                  <span className="ir-glass-more-tile__icon">
                    <MessageSquare size={24}/>
                    {unreadListenerChat && <i className="ir-glass-notification-dot"/>}
                  </span>
                  <span>Live chat</span>
                </button>}
              {!isPlayingAd && <ShareStory currentStation={currentStation} nowPlaying={nowPlaying}
                label="Κοινοποίηση Story" className="ir-glass-more-tile ir-glass-more-tile--share"/>}
              {canUseCustomEQ && !isPlayingAd && !isIOS &&
                <button type="button" onClick={() => setShowEQMenu(value => !value)}
                  className={'ir-glass-more-tile ' + (showEQMenu ? 'is-selected' : '')}
                  aria-expanded={showEQMenu}><SlidersHorizontal size={24}/><span>Audio Studio</span></button>}
            </div>
            {canUseCustomEQ && !isPlayingAd && !isIOS && showEQMenu &&
              <div className="ir-glass-eq-list" aria-label="Προεπιλογές ήχου">
                <span className="ir-glass-sheet__eyebrow">ΕΠΙΛΟΓΗ ΗΧΟΥ</span>
                {[
                  { id:'Station Default', label:'Προεπιλογή Σταθμού', icon:Radio },
                  { id:'HomeTheater', label:'Home Theater', icon:MonitorSpeaker },
                  { id:'HiRes', label:'Hi-Res Audio', icon:Headphones },
                  { id:'Immersive3D', label:'Immersive 3D', icon:Waves },
                  { id:'OFF', label:'DSP Off', icon:PowerOff }
                ].map(preset => <button type="button" key={preset.id}
                  className={'ir-glass-eq-option ' + (currentPreset === preset.id ? 'is-selected' : '')}
                  aria-pressed={currentPreset === preset.id}
                  onClick={() => { onUserDSPChange(currentStation._id, preset.id); setShowEQMenu(false); setShowMoreMenu(false); }}>
                  <preset.icon size={18}/><span>{preset.label}</span>
                </button>)}
              </div>}
          </section>
        </div>}

        {showDevicesMenu && <div className="ir-glass-sheet-layer">
          <button type="button" className="ir-glass-sheet-scrim" aria-label="Κλείσιμο συσκευών"
            onClick={() => setShowDevicesMenu(false)}/>
          <section role="dialog" aria-modal="true" aria-label="Επιλογή συσκευής αναπαραγωγής"
            className="ir-glass-sheet ir-glass-sheet--devices">
            <div className="ir-glass-sheet__handle" aria-hidden="true"/>
            <div className="ir-glass-sheet__header">
              <div><span className="ir-glass-sheet__eyebrow">iRadios CONNECT</span><h3>Οι συσκευές σου</h3></div>
              <div className="ir-glass-sheet__header-actions">
                <button type="button" onClick={() => onRequestDevices?.()} aria-label="Ανανέωση συσκευών"
                  className="ir-glass-sheet__close"><RefreshCw size={19}/></button>
                <button type="button" onClick={() => setShowDevicesMenu(false)}
                  aria-label="Κλείσιμο συσκευών" className="ir-glass-sheet__close"><X size={21}/></button>
              </div>
            </div>
            <p className="ir-glass-device-hint">Συνέχισε την ακρόαση σε άλλη συνδεδεμένη συσκευή.</p>
            <div className="ir-glass-device-list">
              {availableDevices.length === 0 &&
                <div className="ir-glass-device-row is-selected"><Smartphone size={22}/>
                  <span>Αυτό το κινητό</span><small>Τρέχουσα συσκευή</small></div>}
              {availableDevices.map(device => {
                const local = device.deviceId === localDeviceId;
                const mobile = /iphone|ipad|android|mobile/i.test(device.deviceName || '');
                const DeviceIcon = mobile ? Smartphone : Laptop;
                return <button type="button" key={device.deviceId}
                  onClick={() => { if (!local) onTransferPlayback?.(device.deviceId); setShowDevicesMenu(false); }}
                  className={'ir-glass-device-row ' + (device.isPlaying || local ? 'is-selected' : '')}>
                  <DeviceIcon size={22}/>
                  <span>{local ? 'Αυτό το κινητό' : (device.deviceName || 'Συσκευή')}</span>
                  {(device.isPlaying || local) && <small>Ενεργή</small>}
                </button>;
              })}
            </div>
          </section>
        </div>}

        {showChat && currentStation && currentUser && <div className="absolute inset-0 z-50 bg-black/95">
          <LiveChat currentStation={currentStation} currentUser={currentUser} onClose={() => setShowChat(false)}/>
        </div>}
      </div>

      {/* --- 2. MINIFIED PLAYER (ΚΑΤΩ ΜΠΑΡΑ) --- */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMoveMinified}
        onTouchEnd={handleTouchEndMinified}
        onClick={() => setIsMaximized(true)} 
        role="button" tabIndex={0} aria-label={`Άνοιγμα player: ${currentStation.name}`}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setIsMaximized(true); } }}
        className={`ir-mini-player ${location.pathname.startsWith('/station/') ? 'ir-mini-player--station-page' : ''} fixed bottom-[84px] left-2 right-2 h-[68px] flex items-center justify-between px-3 lg:hidden z-[90] cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
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
                  {isRecognizing ? "Αναγνώριση..." : (
                    <RdsCrossfade showSecondary={showProducerArt}
                      secondary={canShowDj?<span className="block truncate">{liveBroadcast.title}</span>:null}>
                      <span className="block truncate">{isActualSong?nowPlaying:
                        (currentUser?'Ζωντανό ραδιόφωνο':'Συνδέσου στο iRadios για NowPlaying')}</span>
                    </RdsCrossfade>
                  )}
                </div>
                {visibleSong&&nowPlayingInfo?.foundWithAI&&<span className="text-[9px] font-bold text-[#ccff00]">✦ Found with AI</span>}
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
