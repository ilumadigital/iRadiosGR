import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, Share2, Play, ChevronUp, ChevronRight, ChevronLeft,
  Music, Radio as RadioIcon, X, Disc3, Loader2, Check
} from 'lucide-react';
import { cleanMetadata } from '../utils/cleanMetadata'; // 🟢 Import το καθαριστικό metadata

// --- ΞΕΧΩΡΙΣΤΟ COMPONENT ΓΙΑ ΚΑΘΕ ΣΤΑΘΜΟ (SLIDE / CAROUSEL ITEM) ---
const DiscoverySlide = ({ station, isActive, onPlayLive, toggleFavorite, isFavorite, currentUser }) => {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nowPlaying, setNowPlaying] = useState('');
  const [coverArt, setCoverArt] = useState(null); // 🟢 State για το cover art

  const isLoggedIn = !!currentUser;
  const isFav = (isFavorite && isLoggedIn) ? isFavorite(station._id || station.id) : false;
  const safeApiUrl = `__IRADIOS_SITE_ORIGIN__/api`;

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src'); 
      audioRef.current.load(); 
    }
    setIsPlaying(false);
    setIsLoading(false);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  // 1. Fetch Metadata & Cover Art
  useEffect(() => {
    let interval;
    if (!isActive || !station) { 
      setNowPlaying(''); 
      setCoverArt(null); 
      return; 
    }
    
    const fetchMeta = async () => {
      try {
        const res = await fetch(`${safeApiUrl}/metadata?stream=${encodeURIComponent(station.stream)}`);
        const data = await res.json();
        
        if (data && data.title) {
          const cleanTitle = cleanMetadata(data.title);
          setNowPlaying(cleanTitle || data.title);

          // 🟢 Ψάχνουμε Cover Art αν έχουμε καθαρό τίτλο
          if (cleanTitle) {
            try {
              const coverRes = await fetch(`${safeApiUrl}/cover-art?term=${encodeURIComponent(cleanTitle)}`);
              if (coverRes.ok) {
                const coverData = await coverRes.json();
                if (coverData && coverData.artworkUrl) {
                  setCoverArt(coverData.artworkUrl);
                } else {
                  setCoverArt(null);
                }
              }
            } catch (e) {
              console.error("Discovery Cover Fetch Error:", e);
              setCoverArt(null);
            }
          } else {
            setCoverArt(null);
          }
        } else {
          setNowPlaying('');
          setCoverArt(null);
        }
      } catch (e) { 
        setNowPlaying(''); 
        setCoverArt(null);
      }
    };
    
    fetchMeta(); 
    interval = setInterval(fetchMeta, 15000);
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, station, safeApiUrl]);

  // 2. Play Audio & Initialize Real-Time Visualizer
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !isActive) {
      stopAudio();
      return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const rawUrl = station.streamUrl || station.stream;
    
    // Χρησιμοποιούμε το Proxy για να έχουμε CORS (απαραίτητο για το Visualizer)
    const streamSrc = isIOS ? rawUrl : `${safeApiUrl}/proxy-stream?url=${encodeURIComponent(rawUrl)}`;
    
    audioEl.crossOrigin = "anonymous";
    audioEl.src = streamSrc;
    setIsLoading(true);

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
          
          if (!isIOS) {
            if (!audioCtxRef.current) {
              try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioCtxRef.current = new AudioContext();
                analyserRef.current = audioCtxRef.current.createAnalyser();
                analyserRef.current.fftSize = 128; 
                
                sourceRef.current = audioCtxRef.current.createMediaElementSource(audioEl);
                sourceRef.current.connect(analyserRef.current);
                analyserRef.current.connect(audioCtxRef.current.destination);
              } catch (e) {
                console.warn("Visualizer CORS / Context error:", e);
              }
            }

            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
              audioCtxRef.current.resume();
            }

            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            
            if (canvas && ctx && analyserRef.current) {
              const bufferLength = analyserRef.current.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);

              const draw = () => {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                
                animationRef.current = requestAnimationFrame(draw);
                analyserRef.current.getByteFrequencyData(dataArray);
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                const barWidth = (canvas.width / bufferLength) * 1.2;
                let x = 0;

                for (let i = 0; i < bufferLength / 1.2; i++) { 
                  const value = dataArray[i];
                  const percent = value / 255;
                  const height = Math.max(percent * canvas.height * 0.5, 2); 
                  
                  const y = (canvas.height - height) / 2;
                  
                  ctx.fillStyle = `rgba(204, 255, 0, ${percent * 0.8 + 0.1})`; 
                  
                  ctx.fillRect(canvas.width / 2 + x, y, barWidth - 1, height);
                  if (x > 0) {
                     ctx.fillRect(canvas.width / 2 - x, y, barWidth - 1, height);
                  }
                  
                  x += barWidth;
                }
              };
              draw();
            }
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') console.warn("Discovery play blocked:", err);
          setIsPlaying(false);
          setIsLoading(false);
        });
    }

    return () => stopAudio();
  }, [isActive, station, safeApiUrl]);

  const handleLike = (e) => {
    e.stopPropagation();
    if (toggleFavorite && isLoggedIn) {
      toggleFavorite(station._id || station.id);
      if (!isFav) {
        setShowBigHeart(true);
        setTimeout(() => setShowBigHeart(false), 1000);
      }
    }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/station/${station.slug || station._id || station.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🟢 Επιλογή της εικόνας: Cover Art (αν υπάρχει) ή Logo
  const displayImage = coverArt || station.logo;

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden group/slide">
      
      {showBigHeart && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none animate-in zoom-in duration-300 fade-out delay-500">
          <Heart size={150} className="text-red-500 fill-red-500 drop-shadow-[0_0_50px_rgba(239,68,68,0.8)]" />
        </div>
      )}

      {/* BACKGROUND BLUR με την ενεργή εικόνα */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-[60px] scale-125 transition-all duration-1000"
        style={{ backgroundImage: `url(${displayImage})` }}
      ></div>
      <div className="absolute inset-0 bg-black/60"></div>

      <audio ref={audioRef} preload="none" />

      {/* REAL-TIME AUDIO VISUALIZER CANVAS */}
      <canvas ref={canvasRef} className="absolute top-1/2 -translate-y-1/2 w-full h-[40%] z-0 opacity-50 mix-blend-screen pointer-events-none" />

      {/* ΚΕΝΤΡΙΚΟ ΠΕΡΙΕΧΟΜΕΝΟ */}
      <div className="relative z-10 flex flex-col items-center w-full px-4">
        
        {/* 🟢 LOGO / COVER ART (12px Radius, bg-white) */}
        <button 
          onClick={(e) => { e.stopPropagation(); stopAudio(); onPlayLive(station); }}
          className="relative rounded-[12px] border border-white/10 hover:border-[#ccff00] transition-colors cursor-pointer group/logo mb-6 shadow-2xl bg-white overflow-hidden"
        >
          <img 
            src={displayImage} 
            alt={station.name} 
            className="w-48 h-48 md:w-56 md:h-56 object-cover bg-white group-hover/logo:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
             <Play size={48} className="text-[#ccff00]" fill="currentColor" />
          </div>
          {isLoading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
               <Loader2 size={32} className="text-[#ccff00] animate-spin" />
            </div>
          )}
        </button>

        {/* STATION NAME */}
        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight text-center drop-shadow-lg mb-2 px-4 line-clamp-2">
          {station.name}
        </h2>

        {/* NOW PLAYING METADATA */}
        <div className="h-8 flex items-center justify-center mb-4">
          {nowPlaying ? (
            <p className="text-[#ccff00] text-sm md:text-base font-bold text-center px-4 line-clamp-1 max-w-[300px] md:max-w-md drop-shadow-md">
              {nowPlaying}
            </p>
          ) : (
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
               <RadioIcon size={12} className="text-red-500 animate-pulse" /> Live Broadcast
            </p>
          )}
        </div>

        {/* HASHTAGS (GENRE / REGION) */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
           {station.genre && (
             <a href={`/genre/${station.genre}`} onClick={(e) => { e.stopPropagation(); }} className="text-[10px] font-black tracking-widest text-zinc-300 hover:text-black bg-white/10 hover:bg-[#ccff00] px-3 py-1.5 rounded-lg backdrop-blur-md transition-all shadow-md">
               #{station.genre}
             </a>
           )}
           {station.region && (
             <a href={`/region/${station.region}`} onClick={(e) => { e.stopPropagation(); }} className="text-[10px] font-black tracking-widest text-zinc-300 hover:text-black bg-white/10 hover:bg-[#ccff00] px-3 py-1.5 rounded-lg backdrop-blur-md transition-all shadow-md">
               #{station.region}
             </a>
           )}
        </div>
      </div>

      {/* ΑΚΟΥ LIVE BUTTON */}
      {isActive && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-[85%] max-w-[320px]">
          <button 
            onClick={(e) => { e.stopPropagation(); stopAudio(); onPlayLive(station); }}
            className="w-full h-14 bg-[#ccff00] text-black font-black uppercase tracking-[0.15em] rounded-2xl flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-transform shadow-[0_15px_40px_rgba(204,255,0,0.25)]"
          >
            <Play fill="currentColor" size={18} /> ΑΚΟΥ LIVE
          </button>
        </div>
      )}

      {/* ACTION BUTTONS (LIKE / SHARE) */}
      {isActive && (
        <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20">
          {isLoggedIn && (
            <button 
              onClick={handleLike}
              className={`w-12 h-12 backdrop-blur-md rounded-full flex items-center justify-center border transition-all duration-300 group ${isFav ? 'bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-black/50 border-white/20 text-white hover:bg-white/10'}`}
            >
              <Heart size={20} className={`group-hover:scale-110 transition-transform ${isFav ? 'fill-white' : ''}`} />
            </button>
          )}
          <button 
            onClick={handleShare}
            className="w-12 h-12 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 hover:bg-white hover:text-black transition-colors group relative"
          >
            {copied ? <Check size={20} className="text-green-400" /> : <Share2 size={20} className="group-hover:scale-110 transition-transform" />}
          </button>
        </div>
      )}
      
      {/* SWIPE UP HINT */}
      {isActive && (
        <div className="md:hidden absolute top-24 right-4 flex flex-col items-center opacity-40 animate-pulse pointer-events-none">
          <ChevronUp size={20} className="text-white" />
          <span className="text-[8px] font-black uppercase tracking-widest text-white mt-1">Swipe</span>
        </div>
      )}
    </div>
  );
};

// --- MAIN DISCOVERY COMPONENT ---
export default function RadioDiscovery({ API_URL, onClose, onSelectStation, currentUser, toggleFavorite, isFavorite }) {
  const [stations, setStations] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const containerRef = useRef(null);

  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchDiscovery = async () => {
      try {
        const url = currentUser 
          ? `${API_URL}/stations/discovery?userId=${currentUser._id || currentUser.id}`
          : `${API_URL}/stations/discovery`;
          
        const res = await fetch(url); 
        const data = await res.json();
        setStations(data.length > 0 ? data : []);
      } catch (err) {
        console.error("Discovery fetch error:", err);
      }
    };
    fetchDiscovery();
  }, [API_URL, currentUser]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasStarted || isDesktop) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            setActiveIndex(index);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );

    const slideElements = container.querySelectorAll('.mobile-slide');
    slideElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [stations, hasStarted, isDesktop]);

  const handlePrevDesktop = () => {
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
  };

  const handleNextDesktop = () => {
    if (activeIndex < stations.length - 1) setActiveIndex(activeIndex + 1);
  };

  if (!hasStarted) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center p-8 text-center backdrop-blur-3xl animate-in fade-in duration-500">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#ccff00]/10 via-black to-purple-500/10 opacity-50"></div>
        <div className="w-24 h-24 bg-[#ccff00]/10 rounded-full flex items-center justify-center mb-8 border border-[#ccff00]/30 animate-pulse relative z-10">
          <Disc3 size={48} className="text-[#ccff00]" />
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter mb-4 leading-tight relative z-10">
          Discovery Mode
        </h1>
        <p className="text-zinc-400 mb-12 text-sm md:text-lg max-w-md relative z-10">
          <span className="md:hidden">Κάνε Swipe Up</span><span className="hidden md:inline">Πάτα Next</span> για να ανακαλύψεις νέους σταθμούς. 10 δευτερόλεπτα αρκούν για να βρεις το νέο σου κόλλημα.
        </p>
        <button 
          onClick={() => setHasStarted(true)}
          className="relative z-10 w-full max-w-xs bg-[#ccff00] text-black h-16 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-transform shadow-[0_20px_50px_rgba(204,255,0,0.2)]"
        >
          ΕΝΑΡΞΗ ΑΝΑΚΑΛΥΨΗΣ
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="absolute top-0 left-0 w-full p-6 z-50 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <RadioIcon size={20} className="text-[#ccff00]" />
          <span className="font-black text-white tracking-widest uppercase text-[10px] md:text-xs drop-shadow-md">iRadios Discovery</span>
        </div>
        <button onClick={onClose} className="w-10 h-10 bg-black/50 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-white hover:text-black transition-colors shadow-lg">
          <X size={20} />
        </button>
      </div>

      {!isDesktop ? (
        <div 
          ref={containerRef}
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar bg-black"
          style={{ scrollBehavior: 'smooth' }}
        >
          {stations.map((station, index) => (
            <div key={station._id || index} data-index={index} className="mobile-slide w-full h-full snap-start shrink-0 relative">
              <DiscoverySlide 
                station={station} 
                isActive={index === activeIndex}
                toggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
                currentUser={currentUser} 
                onPlayLive={(st) => { onClose(); onSelectStation(st); }}
              />
            </div>
          ))}
          <div data-index={stations.length} className="mobile-slide w-full h-full snap-start shrink-0 flex flex-col items-center justify-center bg-zinc-950 p-8 text-center relative">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5"><Music size={32} className="text-zinc-500" /></div>
            <h3 className="text-2xl font-black text-white uppercase italic mb-2">Τέλος λίστας!</h3>
            <p className="text-zinc-500 text-sm mb-8 font-medium">Επιστρέψτε αργότερα για νέες ανακαλύψεις.</p>
            <button onClick={onClose} className="px-8 py-4 bg-white/10 text-white rounded-full font-bold uppercase text-[10px] tracking-widest hover:bg-white/20 border border-white/10 transition-colors">ΕΞΟΔΟΣ</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center relative perspective-container h-full">
          {stations[activeIndex] && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-20 blur-[100px] scale-150 transition-all duration-1000"
              style={{ backgroundImage: `url(${stations[activeIndex].logo})` }}
            ></div>
          )}
          <div className="absolute inset-0 bg-black/40 z-0"></div>

          <div className="relative w-full max-w-6xl h-[600px] flex items-center justify-center z-10 perspective-[1200px]">
            <button 
              onClick={handlePrevDesktop} 
              disabled={activeIndex === 0}
              className="absolute left-8 z-50 w-14 h-14 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all shadow-2xl"
            >
              <ChevronLeft size={28} />
            </button>

            {activeIndex > 0 && (
              <div 
                className="absolute left-[15%] w-[320px] h-[480px] z-10 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer carousel-side-left rounded-[40px] overflow-hidden"
                onClick={handlePrevDesktop}
              >
                <DiscoverySlide station={stations[activeIndex - 1]} isActive={false} />
              </div>
            )}

            {stations[activeIndex] && (
              <div className="absolute w-[400px] h-[540px] z-30 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-[40px] overflow-hidden border border-white/20 carousel-center">
                <DiscoverySlide 
                  station={stations[activeIndex]} 
                  isActive={true} 
                  toggleFavorite={toggleFavorite}
                  isFavorite={isFavorite}
                  currentUser={currentUser} 
                  onPlayLive={(st) => { onClose(); onSelectStation(st); }}
                />
              </div>
            )}

            {activeIndex < stations.length - 1 && (
              <div 
                className="absolute right-[15%] w-[320px] h-[480px] z-10 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer carousel-side-right rounded-[40px] overflow-hidden"
                onClick={handleNextDesktop}
              >
                <DiscoverySlide station={stations[activeIndex + 1]} isActive={false} />
              </div>
            )}

            {activeIndex === stations.length - 1 && (
              <div className="absolute right-[15%] w-[320px] h-[480px] z-10 carousel-side-right flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-[40px] backdrop-blur-md opacity-50">
                <Music size={40} className="text-zinc-600 mb-4" />
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Τέλος Λίστας</p>
              </div>
            )}

            <button 
              onClick={handleNextDesktop} 
              disabled={activeIndex === stations.length - 1}
              className="absolute right-8 z-50 w-14 h-14 bg-[#ccff00]/10 hover:bg-[#ccff00]/20 backdrop-blur-xl border border-[#ccff00]/30 rounded-full flex items-center justify-center text-[#ccff00] disabled:opacity-0 transition-all shadow-[0_0_30px_rgba(204,255,0,0.2)]"
            >
              <ChevronRight size={28} />
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        /* 3D CAROUSEL CSS */
        .carousel-side-left {
          transform: translateX(-30%) scale(0.8) rotateY(25deg);
          opacity: 0.4;
          filter: blur(4px);
        }
        .carousel-side-left:hover { opacity: 0.7; filter: blur(2px); }
        
        .carousel-center {
          transform: translateX(0) scale(1) rotateY(0deg);
          opacity: 1;
        }
        
        .carousel-side-right {
          transform: translateX(30%) scale(0.8) rotateY(-25deg);
          opacity: 0.4;
          filter: blur(4px);
        }
        .carousel-side-right:hover { opacity: 0.7; filter: blur(2px); }
      `}} />
    </div>
  );
}
