import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Play, Pause, Heart, SkipBack, Car, SkipForward, Shuffle, 
  ScanSearch, Loader2, ChevronUp, ChevronDown, 
  AlertTriangle, MonitorSpeaker, 
  ArrowUpRight 
} from 'lucide-react';
import ShareStory from './ShareStory';
import FoundWithAI from './FoundWithAI';
import MusicServiceLinks from './MusicServiceLinks';
import FullscreenArtwork from './FullscreenArtwork';
import AdSkipControl from './AdSkipControl';
import OnAirShowCard from './OnAirShowCard';
import {parseMusicMetadata} from '../utils/musicMetadata';
import {remoteLocationLabel} from '../utils/playbackPresentation.mjs';
import { useAlert } from '../context/AlertContext';
import '../styles/mobile-player-glass.css';

/** Keep the station name visible; scroll only the changing Now Playing detail. */
function MiniPlayerRdsTicker({stationName, detail}) {
  const viewportRef = useRef(null);
  const segmentRef = useRef(null);
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const segment = segmentRef.current;
    if (!viewport || !segment) return undefined;
    const measure = () => setScrolling(segment.scrollWidth > viewport.clientWidth + 2);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(viewport);
    observer?.observe(segment);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [stationName, detail]);

  const label = stationName + ' • ' + detail;
  const duration = Math.max(15, Math.min(44, Math.ceil(detail.length * 0.38)));
  return (
    <div className="ir-mini-rds" role="status" aria-live="off"
      aria-label={label} title={label}>
      <strong className="ir-mini-rds-station" title={stationName}>{stationName}</strong>
      <span className="ir-mini-rds-separator" aria-hidden="true">•</span>
      <div className="ir-mini-rds-viewport" ref={viewportRef}>
        <div className={'ir-mini-rds-track' + (scrolling ? ' is-scrolling' : '')}
          style={{'--ir-mini-rds-duration': duration + 's'}}>
          <span className="ir-mini-rds-segment" ref={segmentRef} aria-hidden="true">{detail}</span>
          {scrolling && <span className="ir-mini-rds-segment" aria-hidden="true">{detail}</span>}
        </div>
      </div>
    </div>
  );
}

export default function MobileMiniPlayer({
  currentStation,
  isPlayingAd,
  currentAdInfo,
  adTimeRemaining,
  adWarning,
  adSkipCountdown,
  onSkipAd,
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
  shuffleEnabled = false, onShuffleToggle,
  isRecognizing, handleRecognizeTrack,
  onOpenCarMode,
  availableDevices = [],
  localDeviceId,
  onTransferPlayback,
  onRequestDevices, onOpenDevices, remotePlayback,
  globalCoverArt,
  liveBroadcast,
  rdsShowProducer
}) {

  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const location = useLocation(); 
  
  const [isMaximized, setIsMaximized] = useState(false);
  const fullscreenRef = useRef(null);
  
  // 🟢 ΝΕΑ TOUCH STATES ΓΙΑ ΤΟ SMOOTH SWIPE
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [swipeX, setSwipeX] = useState(0); 
  const [isAnimatingX, setIsAnimatingX] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);

  useEffect(() => { setIsMaximized(false); }, [location.pathname]);

  useEffect(() => {
    const handleMinify = () => setIsMaximized(false);
    window.addEventListener('minify_player', handleMinify);
    return () => window.removeEventListener('minify_player', handleMinify);
  }, []);

  useEffect(()=>{
    if(!isMaximized)return;
    const previousOverflow=document.body.style.overflow;
    const previousFocus=document.activeElement;
    document.body.style.overflow='hidden';
    fullscreenRef.current?.querySelector('[aria-label="Ελαχιστοποίηση player"]')?.focus();
    const onEscape=e=>{
      if(e.key==='Escape'){
        setIsMaximized(false);
      }
    };
    document.addEventListener('keydown',onEscape);
    return ()=>{
      document.body.style.overflow=previousOverflow;
      document.removeEventListener('keydown',onEscape);
      if(previousFocus?.isConnected)previousFocus.focus();
    };
  },[isMaximized]);

  // Playback metrics are emitted by the shared audio element only.

  if (!currentStation) return null;

  const utmParams = "ref=iradiosapp&utm_campaign=mb_player_ir&utm_content=mb_player_ir&utm_medium=ilumadigitalagencyiradios&utm_source=iradios";
  const isCurrentlyFavorite = isFavorite(currentStation._id);
  const isPremium = currentUser?.isPremium || currentUser?.broadcasterProfile?.tier === 'premium';

  const currentTrack=parseMusicMetadata(nowPlaying,currentStation?.name);
  const isActualSong=Boolean(currentUser&&!isRecognizing&&!isPlayingAd&&currentTrack);
  const showProducerArt=Boolean(currentUser&&!isPlayingAd&&!isRecognizing&&
    liveBroadcast?.imageUrl&&rdsShowProducer);
  const visibleSong=isActualSong;

  const miniTickerDetail = isPlayingAd
    ? 'Διαφήμιση: ' + (currentAdInfo?.title || 'Διαφημιστικό διάλειμμα') +
      (Number.isFinite(adTimeRemaining) ? ' · ' + adTimeRemaining + '″' : '')
    : isRecognizing ? 'Αναγνώριση…'
    : isActualSong ? 'Παίζει τώρα: ' + currentTrack.title +
      (currentTrack.artist ? ' — ' + currentTrack.artist : '') +
      (nowPlayingInfo?.foundWithAI ? ' · ✦ Found with AI' : '')
    : showProducerArt && liveBroadcast?.title ? 'Στον αέρα: ' + liveBroadcast.title
    : remotePlayback ? remoteLocationLabel(remotePlayback.state) + ' ' + remotePlayback.deviceName
    : (currentUser ? 'Συντονίσου στο iRadiosGR' : 'Συνδέσου για NowPlaying');

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
    if (touchStartY === null || touchStartX === null) return; 

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
    navigate('/station/' + (currentStation.slug || currentStation._id));
  };

  const openCarMode = () => {
    if (!isPremium) {
      showAlert('Αναβαθμίστε σε Premium για να χρησιμοποιήσετε το Car Mode.');
      return;
    }
    setIsMaximized(false);
    onOpenCarMode?.();
  };

  const openDevices = () => {
    if(!currentUser){navigate('/login');return;}
    onOpenDevices?.();
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
              {remotePlayback&&<span className="block max-w-[180px] truncate text-[10px] font-bold text-[#ccff00]">
                {remoteLocationLabel(remotePlayback.state)} {remotePlayback.deviceName}
              </span>}
            </button>
            <div className="ir-glass-header__right">
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
                    (liveBroadcast?.show?.host || (currentUser ? 'στο iRadiosGR' : 'Συνδέσου στο iRadios για NowPlaying'))}</p>
                {nowPlayingInfo?.premiumOnly&&!isPlayingAd&&<a href="/premium"
                  className="text-xs font-bold text-[#ccff00] underline underline-offset-2">✦ AI ανακάλυψη από Premium μέλος · Αναβάθμιση</a>}
                {visibleSong && !isPlayingAd && nowPlayingInfo?.foundWithAI &&
                  <FoundWithAI compact className="ir-glass-found-ai"/>}
              </div>
              <AdSkipControl isPlayingAd={isPlayingAd} secondsUntilSkip={adSkipCountdown} onSkip={onSkipAd}
                className="mx-4 mb-2 self-center"/>
              {!isPlayingAd && <OnAirShowCard show={liveBroadcast?.show} stationName={currentStation.name}
                showArtwork={false} className="ir-mobile-show-card ir-glass-on-air"/>}
            </div>
            <span className="ir-glass-swipe-help" aria-hidden="true">‹ &nbsp; Σύρε για αλλαγή σταθμού &nbsp; ›</span>
          </section>

          <nav className="ir-full-player-actions ir-glass-transport" aria-label="Χειριστήρια αναπαραγωγής">
            <button type="button" onClick={onShuffleToggle} disabled={isPlayingAd || adWarning}
              aria-label={shuffleEnabled ? 'Απενεργοποίηση τυχαίας αλλαγής σταθμών' : 'Ενεργοποίηση τυχαίας αλλαγής σταθμών'}
              aria-pressed={shuffleEnabled}
              className={'ir-glass-transport__side ' + (shuffleEnabled ? 'is-active' : '')}>
              <Shuffle size={25} />
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
            <button type="button" onClick={openDevices} aria-label="Επιλογή συσκευής αναπαραγωγής"
              className="ir-glass-transport__side"><MonitorSpeaker size={27}/></button>
          </nav>

          <div className="ir-glass-primary-actions" aria-label="Γρήγορες ενέργειες">
            <button type="button" onClick={() => toggleFavorite(currentStation._id)} disabled={isPlayingAd}
              aria-label={isCurrentlyFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
              aria-pressed={isCurrentlyFavorite} className={'ir-glass-primary-tile ' + (isCurrentlyFavorite ? 'is-active' : '')}>
              <Heart size={23} fill={isCurrentlyFavorite ? 'currentColor' : 'none'}/><span>Αγαπημένα</span>
            </button>
            {!isPlayingAd && <ShareStory currentStation={currentStation} nowPlaying={isActualSong ? nowPlaying : null}
              artworkUrl={showCoverArt ? globalCoverArt : null}
              show={liveBroadcast?.show} showImageUrl={liveBroadcast?.imageUrl}
              label="Ανέβασε Story" className="ir-glass-primary-tile ir-glass-story-tile" iconSize={23}/>}
          </div>
          <div className="ir-glass-quick-access" aria-label="Επιπλέον λειτουργίες">
            <button type="button" onClick={openCarMode} className="ir-glass-quick-access__button">
              <Car size={20} aria-hidden="true"/><span>Car Mode</span>
            </button>
            <button type="button" onClick={openStationProfile} className="ir-glass-quick-access__button ir-glass-profile-link"
              aria-label={'Προφίλ ' + currentStation.name}>
              <ArrowUpRight size={20} aria-hidden="true"/><span>Προφίλ {currentStation.name}</span>
            </button>
          </div>

          <div className="ir-glass-song-actions">
            {isActualSong && (
              <MusicServiceLinks song={nowPlaying} stationName={currentStation.name}
                currentUser={currentUser} compact className="ir-music-links--mobile-player"/>
            )}
            {!isPlayingAd && <button type="button" onClick={handleRadarClick}
              disabled={isRecognizing || !isPlaying} className="ir-recognize-button"
              aria-label="Βρες ποιο τραγούδι παίζει">
              {isRecognizing ? <Loader2 size={17} className="animate-spin"/> : <ScanSearch size={17}/>}
              {isRecognizing ? 'Ψάχνουμε το τραγούδι…' : 'Βρες το τραγούδι'}
            </button>}
          </div>
        </div>

      </div>

      {/* --- 2. MOBILE MINI PLAYER: RDS above transport --- */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMoveMinified}
        onTouchEnd={handleTouchEndMinified}
        onClick={() => setIsMaximized(true)}
        role="button" tabIndex={0} aria-label={'Άνοιγμα player: ' + currentStation.name}
        onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setIsMaximized(true); } }}
        className={'ir-mini-player-stack ' + (location.pathname.startsWith('/station/') ? 'ir-mini-player--station-page ' : '') +
          'fixed bottom-[84px] left-2 right-2 lg:hidden z-[90] cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ' +
          (isMaximized ? 'translate-y-[150%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100')}
      >
        <MiniPlayerRdsTicker stationName={currentStation.name} detail={miniTickerDetail}/>
        <div className="ir-mini-player ir-mini-player--compact h-[68px] flex items-center justify-between">
          <div className="ir-mini-player-art relative shrink-0 pointer-events-none">
            <img src={minifiedImage}
              className={'ir-mini-player-logo w-12 h-12 shadow-lg bg-white object-contain p-1 transition-all duration-500 ' +
                (!isPlaying && !isBuffering ? 'scale-95 grayscale-[30%]' : '')}
              alt=""/>
          </div>
        <div className="ir-mini-player-controls flex items-center min-w-0 flex-1 justify-between">
          <AdSkipControl isPlayingAd={isPlayingAd} secondsUntilSkip={adSkipCountdown} onSkip={onSkipAd} compact
            className="ir-mini-ad-skip"/>
          {!isPlayingAd && <ShareStory currentStation={currentStation} nowPlaying={isActualSong ? nowPlaying : null}
            artworkUrl={showCoverArt ? globalCoverArt : null} show={liveBroadcast?.show} showImageUrl={liveBroadcast?.imageUrl}
            className="ir-mini-story-button" iconSize={20}/>}
          {currentUser&&<button type="button" onClick={e=>{e.stopPropagation();openDevices();}}
            aria-label="Συσκευές αναπαραγωγής" title="iRadios Connect"
            className="p-2 text-[#ccff00] active:scale-90"><MonitorSpeaker size={20}/></button>}
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

          <div className="ir-mini-player-chevron flex items-center justify-center border-l border-white/10 text-zinc-500">
            <ChevronUp size={22} />
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
