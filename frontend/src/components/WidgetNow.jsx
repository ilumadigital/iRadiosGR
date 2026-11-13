import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, SignalHigh, Radio, Mic, ScanSearch } from 'lucide-react';
import { cleanMetadata } from '../utils/cleanMetadata';

export default function WidgetNow({ API_URL = '/api' }) {
  const { stationId } = useParams();
  
  const [station, setStation] = useState(null);
  const [nowPlaying, setNowPlaying] = useState('');
  const [coverArt, setCoverArt] = useState(null);
  const [error, setError] = useState(false);
  const [currentShow, setCurrentShow] = useState(null);
  
  const safeApiUrl = `__IRADIOS_SITE_ORIGIN__/api`;

  // 1. Fetch Station Data
  useEffect(() => {
    let isMounted = true;
    const fetchStation = async () => {
      try {
        const res = await fetch(`${safeApiUrl}/stations`);
        if (!res.ok) throw new Error('Failed');
        const allStations = await res.json();
        const found = allStations.find(s => s.slug === stationId || s._id === stationId);
        if (isMounted) found ? setStation(found) : setError(true);
      } catch (err) {
        if (isMounted) setError(true);
      }
    };
    if (stationId) fetchStation();
    return () => { isMounted = false; };
  }, [stationId, safeApiUrl]);

  // 2. Fetch Metadata (Now Playing)
  useEffect(() => {
    let interval;
    if (!station) return;
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
    interval = setInterval(fetchMeta, 30000);
    return () => { if (interval) clearInterval(interval); };
  }, [station, safeApiUrl]);

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
      // 1. Παίρνουμε την ΑΚΡΙΒΗ ημερομηνία και ώρα Αθήνας
      const now = new Date();
      const athensDateString = now.toLocaleString('en-US', { timeZone: 'Europe/Athens' });
      const athensDate = new Date(athensDateString);
      
      // 2. Υπολογίζουμε την τρέχουσα ώρα σε λεπτά (0-1439)
      const currentTime = athensDate.getHours() * 60 + athensDate.getMinutes();
      
      // 3. Παίρνουμε την ημέρα της JS (0 = Κυριακή, 1 = Δευτέρα, ..., 6 = Σάββατο)
      const jsDay = athensDate.getDay(); 

      // 🟢 ΤΟ FIX ΜΕ ΤΟ -1: Μετατρέπουμε την ημέρα της JS στο δικό σου format (0 = Δευτέρα ... 6 = Κυριακή)
      const currentDbDay = jsDay === 0 ? 6 : jsDay - 1;
      
      // Βρίσκουμε και ποια ήταν η χθεσινή μέρα (για τις νυχτερινές εκπομπές)
      const prevDbDay = currentDbDay === 0 ? 6 : currentDbDay - 1;

      const activeShow = station.schedule.find(item => {
        const showDay = parseInt(item.day);

        // Ελέγχουμε αν η εκπομπή είναι καταχωρημένη για τη σημερινή ή τη χθεσινή μέρα
        const isToday = showDay === currentDbDay;
        const isYesterday = showDay === prevDbDay;

        if (!isToday && !isYesterday) return false;

        // Μετατροπή ώρας εκπομπής σε λεπτά
        const [startH, startM] = item.startTime.split(':').map(Number);
        const [endH, endM] = item.endTime.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;

        // Είναι μεταμεσονύχτια εκπομπή; (π.χ. 22:00 - 02:00)
        const isOvernight = startTotal > endTotal;

        if (isToday) {
            if (!isOvernight) {
                // Κανονική εκπομπή (π.χ. 10:00 - 12:00)
                return currentTime >= startTotal && currentTime < endTotal;
            } else {
                // Νυχτερινή εκπομπή που ξεκίνησε ΣΗΜΕΡΑ το βράδυ
                return currentTime >= startTotal;
            }
        } else if (isYesterday && isOvernight) {
            // Νυχτερινή εκπομπή που ξεκίνησε ΧΘΕΣ το βράδυ και παίζει ακόμα
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

  if (error || (!station && !error)) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-zinc-950">
         <Loader2 className="animate-spin text-[#ccff00]" size={32} />
      </div>
    );
  }

  const isPremiumStation = station.dspPreset && station.dspPreset !== 'OFF';
  const displayImage = coverArt || station.logo;

  return (
    <div className="relative w-full h-screen bg-zinc-950 overflow-hidden font-sans select-none">
      
      {/* BACKGROUNDS */}
      <img src={displayImage} alt="bg" className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110 pointer-events-none" />
      <img src={displayImage} alt="cover" className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 pointer-events-none scale-105`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/60 pointer-events-none"></div>

      {/* 🟢 TOP LEFT: METADATA ΜΟΝΟ */}
      <div className="absolute top-[5%] left-[5%] z-20 max-w-[65%] pointer-events-none">
        <span className="text-[clamp(7px,2vw,9px)] font-black tracking-[0.2em] text-[#ccff00] uppercase mb-[0.5vh] flex items-center gap-1.5 drop-shadow-md opacity-80">
          <div className="w-[1.2vw] h-[1.2vw] max-w-[5px] max-h-[5px] bg-[#ccff00] rounded-full shrink-0 animate-pulse shadow-[0_0_5px_#ccff00]"></div>
          <span>Now Playing</span>
        </span>
        <h2 className="text-white font-bold text-[clamp(0.75rem,3.5vw,1.1rem)] leading-tight drop-shadow-xl line-clamp-2 break-words">
          {nowPlaying || "Live Stream"}
        </h2>
      </div>

      {/* 🟢 TOP RIGHT: SPOTIFY & RADAR */}
      <div className="absolute top-[5%] right-[5%] z-20 flex flex-col items-end gap-[1.5vw] pointer-events-none">
        
        {nowPlaying && isPremiumStation && (
          <a 
            href={`https://open.spotify.com/search/$${encodeURIComponent(nowPlaying)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto flex items-center gap-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black px-[3vw] py-[1.5vw] rounded-full transition-all active:scale-95 shadow-lg group"
            title="Search on Spotify"
          >
            <span className="text-[clamp(8px,2vw,10px)] font-black uppercase tracking-widest">Discover on</span>
            <svg className="w-[3.5vw] h-[3.5vw] max-w-[16px] max-h-[16px]" viewBox="0 0 24 24" fill="currentColor">
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

      {/* 🟢 BOTTOM LEFT: STATION INFO & SCHEDULE ΚΑΤΩ ΑΠΟ ΤΟ GENRE */}
      <div className="absolute bottom-[6%] left-[5%] right-[35%] flex flex-col gap-[2.5vw] z-40 pointer-events-none">
        <div className="flex flex-col min-w-0 drop-shadow-lg">
          <span className="text-white font-black text-[clamp(14px,4.5vw,24px)] leading-tight truncate w-full">
            {station.name}
          </span>
          <div className="inline-flex items-center gap-1.5 mt-0.5">
             {station.transmissionType === 'Επίγειο' ? <Radio size={10} className="text-zinc-400" /> : <SignalHigh size={10} className="text-zinc-400" />}
             <span className="text-[clamp(8px,2vw,10px)] text-zinc-400 font-bold tracking-widest truncate">{station.genre}</span>
          </div>

          {/* 🟢 SCHEDULE PLACEMENT */}
          {currentShow && (
            <div className="mt-[1.5vw] inline-flex items-center gap-2 bg-black/50 backdrop-blur-md px-[1.5vw] py-[0.8vw] rounded-full border border-white/10 self-start shadow-lg pointer-events-auto">
              
              {/* Το Mic Icon και το LIVE NOW Badge */}
              <div className="flex items-center gap-1 bg-[#ccff00]/10 border border-[#ccff00]/20 px-[0.8vw] py-[0.3vw] rounded-full">
                <Mic size="clamp(11px, 2.2vw, 15px)" className="text-[#ccff00]" />
                <span className="text-[clamp(9px,1.9vw,12px)] font-black text-[#ccff00] uppercase tracking-widest leading-none">
                  NOW ON AIR
                </span>
              </div>

              {/* Το Όνομα του Παραγωγού / Εκπομπής */}
              <span className="text-[clamp(9px,1.9vw,12px)] text-white font-bold leading-none truncate max-w-[140px] sm:max-w-[200px] mr-[0.5vw]">
                {currentShow.host || currentShow.title}
              </span>
              
            </div>
          )}
        </div>
      </div>

      {/* 🟢 BOTTOM RIGHT: BRANDING COLUMN */}
      <div className="absolute bottom-[6%] right-[5%] z-50 flex flex-col items-end gap-[2vw]">
        {coverArt && (
          <div className="w-[18vw] h-[18vw] max-w-[100px] max-h-[100px] bg-zinc-950/90 backdrop-blur-md p-[15%] rounded-[20%] border border-white/10 shadow-2xl flex items-center justify-center animate-in fade-in slide-in-from-bottom-2 duration-500">
            <img src={station.logo} alt={station.name} className="w-full h-full object-contain rounded-[10%]" />
          </div>
        )}
        <a 
          href={`__IRADIOS_SITE_ORIGIN__/station/${station.slug || station._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-[18vw] max-w-[100px] bg-black p-[2.5vw] rounded-[20%] shadow-xl border border-white/10 transition-transform hover:scale-105 duration-300 flex items-center justify-center pointer-events-auto"
        >
          <img src="__IRADIOS_SITE_ORIGIN__/noicon-iradios-app-logo.svg" alt="iRadios" className="w-full h-auto object-contain" />
        </a>
      </div>
    </div>
  );
}
