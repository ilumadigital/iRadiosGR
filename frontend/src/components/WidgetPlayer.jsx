import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Play, Pause, Loader2, SignalHigh, Radio, Volume2, VolumeX, Mic, ScanSearch, Volume1 } from 'lucide-react';
import useAudioDSP from '../hooks/useAudioDSP'; 
import { cleanMetadata } from '../utils/cleanMetadata';

export default function WidgetPlayer({ API_URL = '/api' }) {
  const { stationId } = useParams();
  const location = useLocation(); 
  
  const [station, setStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [nowPlaying, setNowPlaying] = useState('');
  const [coverArt, setCoverArt] = useState(null);
  const [error, setError] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentShow, setCurrentShow] = useState(null);
  
  // State για Toggle του DSP
  const [dspEnabled, setDspEnabled] = useState(true);
  
  // 🟢 TWIN AUDIO REFS
  const audioRefDSP = useRef(null);
  const audioRefRaw = useRef(null);
  
  const safeApiUrl = `__IRADIOS_SITE_ORIGIN__/api`;

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // 🟢 Το hook δένει ΜΟΝΟ στο audioRefDSP
  const { resumeDSP } = useAudioDSP(
    audioRefDSP, 
    station, 
    null, 
    false, 
    isMobile, 
    null, 
    {},
    dspEnabled 
  );

  // 1. Fetch Station
  useEffect(() => {
    let isMounted = true;
    let interval;

    const fetchStation = async () => {
      try {
        const res = await fetch(`${safeApiUrl}/stations`);
        if (!res.ok) throw new Error('Failed');
        const allStations = await res.json();
        const found = allStations.find(s => s.slug === stationId || s._id === stationId);
        
        if (isMounted && found) {
          setStation(prev => {
            if (!prev) return found;
            if (prev.dspPreset !== found.dspPreset || prev.name !== found.name) return found; 
            return prev;
          });
          setError(false);
        }
      } catch (err) {
        if (isMounted && !station) setError(true);
      }
    };

    fetchStation(); 
    interval = setInterval(fetchStation, 60000); 

    return () => { 
      isMounted = false; 
      if (interval) clearInterval(interval);
    };
  }, [stationId, safeApiUrl]);

  // 2. Fetch Metadata
  useEffect(() => {
    let interval;
    if (!station || !isPlaying) { setNowPlaying(''); return; }
    const fetchMeta = async () => {
      try {
        const res = await fetch(`${safeApiUrl}/metadata?stream=${encodeURIComponent(station.stream)}`);
        const data = await res.json();
        
        if (data && data.title) {
          const rawTitle = data.title.replace(/-$/, '').trim();
          const cleanTitle = cleanMetadata(rawTitle);
          setNowPlaying(cleanTitle || rawTitle);
        } else {
          setNowPlaying('');
        }
      } catch (e) { setNowPlaying(''); }
    };
    fetchMeta(); 
    interval = setInterval(fetchMeta, 31000);
    return () => { if (interval) clearInterval(interval); };
  }, [station, isPlaying, safeApiUrl]);

  // 3. Fetch Cover Art
  useEffect(() => {
    let isMounted = true;
    if (!nowPlaying) { setCoverArt(null); return; }
    const fetchCover = async () => {
      try {
        const res = await fetch(`${safeApiUrl}/cover-art?term=${encodeURIComponent(nowPlaying)}`);
        const data = await res.json();
        if (isMounted) setCoverArt(data?.artworkUrl || null);
      } catch (err) { if (isMounted) setCoverArt(null); }
    };
    fetchCover();
    return () => { isMounted = false; };
  }, [nowPlaying, safeApiUrl]);

  // 4. Calculate Current Show 
  useEffect(() => {
    if (!station || !station.schedule || station.schedule.length === 0) {
      setCurrentShow(null);
      return;
    }

    const checkCurrentShow = () => {
      const now = new Date();
      const athensDateString = now.toLocaleString('en-US', { timeZone: 'Europe/Athens' });
      const athensDate = new Date(athensDateString);
      
      const currentTime = athensDate.getHours() * 60 + athensDate.getMinutes();
      const jsDay = athensDate.getDay(); 

      const currentDbDay = jsDay === 0 ? 6 : jsDay - 1;
      const prevDbDay = currentDbDay === 0 ? 6 : currentDbDay - 1;

      const activeShow = station.schedule.find(item => {
        const showDay = parseInt(item.day);

        const isToday = showDay === currentDbDay;
        const isYesterday = showDay === prevDbDay;

        if (!isToday && !isYesterday) return false;

        const [startH, startM] = item.startTime.split(':').map(Number);
        const [endH, endM] = item.endTime.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;

        const isOvernight = startTotal > endTotal;

        if (isToday) {
            if (!isOvernight) {
                return currentTime >= startTotal && currentTime < endTotal;
            } else {
                return currentTime >= startTotal;
            }
        } else if (isYesterday && isOvernight) {
            return currentTime < endTotal;
        }

        return false;
      });

      setCurrentShow(activeShow || null);
    };
    
    checkCurrentShow();
    const showInterval = setInterval(checkCurrentShow, 60000);
    return () => clearInterval(showInterval);
  }, [station]);

  // 🟢 5. NEW PLAY/PAUSE ENGINE (TWIN AUDIO)
  const getActiveAudio = (checkDspState = dspEnabled) => {
    return (isIOS || !checkDspState) ? audioRefRaw.current : audioRefDSP.current;
  };

  const stopAllAudio = () => {
    if (audioRefDSP.current) {
        audioRefDSP.current.pause();
        audioRefDSP.current.src = '';
        audioRefDSP.current.load();
    }
    if (audioRefRaw.current) {
        audioRefRaw.current.pause();
        audioRefRaw.current.src = '';
        audioRefRaw.current.load();
    }
    setIsPlaying(false);
  };

  const playAudio = async (overrideDspState = dspEnabled) => {
    if (!station) return;
    
    stopAllAudio(); // Κλείνουμε ό,τι παίζει για να έχουμε καθαρό τοπίο

    const audioEl = getActiveAudio(overrideDspState);
    if (!audioEl) return;

    if (resumeDSP && !isIOS && overrideDspState) {
        resumeDSP();
    }

    const rawUrl = station.streamUrl || station.stream;
    const shouldUseRawUrl = isIOS || !overrideDspState;
    const streamSrc = shouldUseRawUrl ? rawUrl : `${safeApiUrl}/proxy-stream?url=${encodeURIComponent(rawUrl)}`;
    
    audioEl.src = streamSrc;
    audioEl.load(); 
    
    try {
      await audioEl.play();
      setIsPlaying(true);
    } catch (error) {
      console.warn("Autoplay blocked or Play failed:", error);
      setIsPlaying(false);
    }
  };

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      stopAllAudio();
    } else {
      await playAudio();
    }
  }, [isPlaying, station, resumeDSP, isIOS, safeApiUrl, dspEnabled]);

  const handleDspToggle = async () => {
      const wasPlaying = isPlaying;
      const newDspState = !dspEnabled;
      
      setDspEnabled(newDspState);

      if (wasPlaying) {
          // Ξεκινάει άμεσα το νέο engine, στέλνοντας το νέο state
          playAudio(newDspState);
      }
  };

  // AUTOPLAY
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldAutoplay = params.get('autoplay') === 'true';

    // Χρειάζεται ένα μικρό timeout για να σιγουρευτούμε ότι τα Refs έχουν δεθεί στο DOM
    if (shouldAutoplay && station && !isPlaying) {
      setTimeout(() => {
         playAudio(dspEnabled);
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station, location.search]); 

  // 6. Volume Control (Εφαρμόζεται και στα δύο)
  useEffect(() => {
    if (audioRefDSP.current) audioRefDSP.current.volume = volume;
    if (audioRefRaw.current) audioRefRaw.current.volume = volume;
  }, [volume]);

  // SPACEBAR EVENT
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); 
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay]); 

  // MEDIA SESSION API
  useEffect(() => {
    if ('mediaSession' in navigator && station) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: nowPlaying || 'Live Stream', 
        artist: station.name,               
        album: 'iRadios Player',            
        artwork: [
          {
            src: coverArt || station.logo || '__IRADIOS_SITE_ORIGIN__/presskit/iradios-app-logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => { if (!isPlaying) togglePlay(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (isPlaying) togglePlay(); });
      navigator.mediaSession.setActionHandler('stop', () => { if (isPlaying) togglePlay(); });
    }
  }, [nowPlaying, coverArt, station, isPlaying, togglePlay]);

  if (error || (!station && !error)) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-zinc-950">
         <Loader2 className="animate-spin text-[#ccff00]" size={32} />
      </div>
    );
  }

  const isPremiumStation = station.dspPreset && station.dspPreset !== 'OFF';
  const displayImage = (isPlaying && coverArt) ? coverArt : station.logo;

  return (
    <div className="relative w-full h-screen bg-zinc-950 overflow-hidden font-sans select-none">
      
      {/* 🟢 TWIN ENGINES 🟢 */}
      <audio 
        ref={audioRefDSP}
        crossOrigin="anonymous" 
        onWaiting={() => { if(dspEnabled && !isIOS) setIsBuffering(true); }}
        onPlaying={() => { if(dspEnabled && !isIOS) setIsBuffering(false); }}
        onError={() => { if(dspEnabled && !isIOS) setIsPlaying(false); }}
      />
      <audio 
        ref={audioRefRaw}
        onWaiting={() => { if(!dspEnabled || isIOS) setIsBuffering(true); }}
        onPlaying={() => { if(!dspEnabled || isIOS) setIsBuffering(false); }}
        onError={() => { if(!dspEnabled || isIOS) setIsPlaying(false); }}
      />

      <img src={displayImage} alt="bg" className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110 pointer-events-none" />
      <img src={displayImage} alt="cover" className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 pointer-events-none ${isPlaying ? 'scale-105' : 'scale-100 grayscale-[20%]'}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/60 pointer-events-none"></div>

      {/* TOP LEFT: METADATA */}
      <div className="absolute top-[5%] left-[5%] z-20 max-w-[65%] flex flex-col gap-3 pointer-events-none">
        <div>
          <span className="text-[clamp(7px,2vw,9px)] font-black tracking-[0.2em] text-[#ccff00] uppercase mb-[0.5vh] flex items-center gap-1.5 drop-shadow-md opacity-80">
            <div className="w-[1.2vw] h-[1.2vw] max-w-[5px] max-h-[5px] bg-[#ccff00] rounded-full shrink-0 animate-pulse shadow-[0_0_5px_#ccff00]"></div>
            <span>Now Playing</span>
          </span>
          <h2 className="text-white font-bold text-[clamp(0.75rem,3.5vw,1.1rem)] leading-tight drop-shadow-xl line-clamp-2 break-words">
            {nowPlaying || "Live Stream"}
          </h2>
        </div>
      </div>

      {/* TOP RIGHT: SPOTIFY & RADAR */}
      <div className="absolute top-[5%] right-[5%] z-20 flex flex-col items-end gap-[1.5vw] pointer-events-none">
        {nowPlaying && isPremiumStation && (
          <a 
            href={`https://open.spotify.com/search/$${encodeURIComponent(nowPlaying)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black px-[2.5vw] py-[1.2vw] rounded-full transition-all active:scale-95 shadow-lg group"
            title="Search on Spotify"
          >
            <span className="text-[clamp(7px,1.8vw,10px)] font-black uppercase tracking-widest">Discover on</span>
            <svg className="w-[3vw] h-[3vw] max-w-[14px] max-h-[14px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.496 17.306c-.221.363-.693.475-1.056.254-2.92-1.786-6.593-2.187-10.927-1.197-.417.095-.834-.171-.93-.588s.171-.834.588-.93c4.737-1.082 8.791-.621 12.075 1.385.363.221.475.694.25 1.056zm1.46-3.26c-.277.452-.865.596-1.317.319-3.344-2.056-8.442-2.653-12.398-1.453-.51.155-1.045-.133-1.2-.643s.133-1.045.643-1.2c4.52-1.373 10.138-.707 13.954 1.638.452.277.596.865.318 1.317zm.125-3.41c-4.01-2.38-10.615-2.6-14.445-1.437-.614.186-1.26-.168-1.446-.783s.168-1.26.783-1.446c4.406-1.34 11.69-1.08 16.315 1.666.552.327.738 1.04.41 1.593-.327.552-1.04.738-1.593.41z"/>
            </svg>
          </a>
        )}

        <a 
          href={`__IRADIOS_SITE_ORIGIN__/station/${station.slug || station._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group/radar pointer-events-auto bg-black/60 backdrop-blur-md h-8 rounded-full border border-white/10 flex items-center overflow-hidden transition-all duration-300 w-8 hover:w-[100px] text-white hover:text-[#ccff00] shadow-lg"
          title="Αναγνώριση Τραγουδιού με AI"
        >
          <div className="w-8 h-8 flex items-center justify-center shrink-0">
            <ScanSearch size={14} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap opacity-0 group-hover/radar:opacity-100 transition-opacity duration-300">
            AI RADAR
          </span>
        </a>
      </div>

      {/* BOTTOM LEFT: PLAYER CONTROLS & SCHEDULE */}
      <div className="absolute bottom-[6%] left-[5%] right-[35%] flex flex-col gap-[2.5vw] z-40">
        <div className="flex items-center gap-[2.5vw]">
          <div className="relative w-[12vw] h-[12vw] max-w-[50px] max-h-[50px] shrink-0 flex items-center justify-center">
            {isPlaying && !isBuffering && (
              <>
                <div className="absolute inset-[-10%] border-2 border-[#ccff00] rounded-full animate-ping opacity-40"></div>
                <div className="absolute inset-0 border-4 border-[#ccff00]/30 rounded-full animate-pulse"></div>
              </>
            )}
            <button onClick={togglePlay} className="relative z-10 w-full h-full bg-[#ccff00] text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer outline-none border-none">
              {isBuffering ? <Loader2 className="animate-spin w-[45%]" /> : isPlaying ? <Pause className="w-[45%]" fill="currentColor" /> : <Play className="w-[45%] ml-1" fill="currentColor" />}
            </button>
          </div>
          
          <div className="flex flex-col min-w-0 drop-shadow-lg pointer-events-none">
            <span className="text-white font-black text-[clamp(12px,3.8vw,18px)] leading-tight truncate w-full">{station.name}</span>
            <div className="inline-flex items-center gap-1 mt-0.5">
               {station.transmissionType === 'Επίγειο' ? <Radio size={8} className="text-zinc-400" /> : <SignalHigh size={8} className="text-zinc-400" />}
               <span className="text-[clamp(7px,1.8vw,9px)] text-zinc-400 font-bold tracking-widest truncate">{station.genre}</span>
               {isPremiumStation && !isIOS && dspEnabled && (
                 <span className="text-[9px] font-black uppercase text-[#ccff00] ml-2 tracking-wider">HD+</span>
               )}
            </div>

          {/* SCHEDULE PLACEMENT */}
          {currentShow && (
            <div className="mt-[1.5vw] inline-flex items-center gap-2 bg-black/50 backdrop-blur-md px-[1.5vw] py-[0.8vw] rounded-full border border-white/10 self-start shadow-lg pointer-events-auto">
              <div className="flex items-center gap-1 bg-[#ccff00]/10 border border-[#ccff00]/20 px-[0.8vw] py-[0.3vw] rounded-full">
                <Mic size="clamp(11px, 2.2vw, 15px)" className="text-[#ccff00]" />
                <span className="text-[clamp(9px,1.9vw,12px)] font-black text-[#ccff00] uppercase tracking-widest leading-none">
                  LIVE NOW
                </span>
              </div>
              <span className="text-[clamp(9px,1.9vw,12px)] text-white font-bold leading-none truncate max-w-[140px] sm:max-w-[200px] mr-[0.5vw]">
                {currentShow.host || currentShow.title}
              </span>
            </div>
          )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 pl-0.5 pointer-events-auto">
           <button onClick={() => setVolume(volume > 0 ? 0 : 0.7)} className="text-zinc-300 hover:text-white transition-colors cursor-pointer outline-none bg-transparent border-none p-0">
             {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
           </button>
           <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-[25vw] max-w-[100px] h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ccff00]" />
        </div>
      </div>

      {/* BOTTOM RIGHT: BRANDING & NO SOUND BTN */}
      <div className="absolute bottom-[6%] right-[5%] z-50 flex flex-col items-end gap-[2vw]">
        
        {isPlaying && coverArt && (
          <div className="w-[16vw] h-[16vw] max-w-[100px] max-h-[100px] shrink-0 aspect-square bg-zinc-950/90 backdrop-blur-md p-[15%] rounded-[20%] border border-white/10 shadow-2xl flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-500 pointer-events-none">
            <img src={station.logo} alt={station.name} className="w-full h-full object-contain rounded-[10%]" />
          </div>
        )}
        
        <a 
          href={`__IRADIOS_SITE_ORIGIN__/station/${station.slug || station._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-[18vw] max-w-[100px] shrink-0 bg-black p-[2.5vw] rounded-[20%] shadow-xl border border-white/10 transition-transform hover:scale-105 duration-300 flex items-center justify-center pointer-events-auto"
        >
          <img src="__IRADIOS_SITE_ORIGIN__/presskit/iradios-app-logo.png" alt="iRadios" className="w-full h-auto object-contain" />
        </a>

        {/* 🟢 No Sound Button (ΑΠΟΛΥΤΩΣ ΛΕΙΤΟΥΡΓΙΚΟ) */}
        {!isIOS && isPremiumStation && (
          <button 
            onClick={handleDspToggle}
            className="flex items-center gap-1.5 mt-1 shrink-0 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white hover:bg-white/10 transition-colors pointer-events-auto whitespace-nowrap"
          >
            {dspEnabled ? (
              <>
                <Volume1 size={12} className="text-red-400 shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-300">No Sound? Click Here</span>
              </>
            ) : (
              <>
                <SignalHigh size={12} className="text-[#ccff00] shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#ccff00]">Enable HD+</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
