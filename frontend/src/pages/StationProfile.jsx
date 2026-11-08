import React, { useEffect, useState, useMemo, useRef } from 'react';
import { formatFMFrequency } from '../utils/stationFrequency';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Heart, ArrowLeft, Disc3, Globe, Zap, Facebook, Instagram, Twitter, 
  Phone, Mail, Music, AlertTriangle, CalendarDays, SlidersHorizontal, MonitorSpeaker, 
  Headphones, PowerOff, Radio, SignalHigh, Share2, Check, ShieldCheck, ExternalLink,
  MessageCircle, Loader2, ScanSearch
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import CircularVU from '../components/CircularVU';
import StationPlaylistPanel from '../components/StationPlaylistPanel';
import StationCatalogCard from '../components/StationCatalogCard';
import FoundWithAI from '../components/FoundWithAI'; 
import { useAlert } from '../context/AlertContext';

const DAYS_OF_WEEK = ['Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'];

export default function StationProfile({ 
  stations, currentStation, isPlaying, onPlayPause, setCurrentStation, 
  toggleFavorite, isFavorite, nowPlaying: globalNowPlaying, nowPlayingInfo: globalNowPlayingInfo, analyser,
  currentUser, userOverrides, onUserDSPChange, API_URL,
  isRecognizing, handleRecognizeTrack, globalCoverArt // 🟢 Λαμβάνουμε το έτοιμο cover από το App.jsx
}) {
  const { showAlert } = useAlert();
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [copied, setCopied] = useState(false);
  const [showEQMenu, setShowEQMenu] = useState(false);
  const [activeBanners, setActiveBanners] = useState([]);
  const eqMenuRef = useRef(null);

  const [localNowPlaying, setLocalNowPlaying] = useState(null);
  const [localNowPlayingInfo,setLocalNowPlayingInfo]=useState({source:'none',foundWithAI:false});
  const [isSearchingMetadata, setIsSearchingMetadata] = useState(false);
  
  // Station metadata must never update the page after the station changes.

  const station = stations.find(s => s.slug === id || s._id === id);
  const isFreeOrGuest = !currentUser || (!currentUser.isPremium && currentUser?.broadcasterProfile?.tier !== 'premium');
  const isThisPlaying = currentStation && (currentStation._id === station?._id);

  const LOADING_MESSAGES = [
    "Ακούμε τον σταθμό…",
    "Ψάχνουμε το τραγούδι…",
    "Λίγο ακόμη…",
    "Σχεδόν έτοιμο…",
    "Βρίσκουμε το τραγούδι…",
    "ΠΑΙΖΕΙ ΤΩΡΑ"
  ];

  const useGlobal=Boolean(currentUser&&isThisPlaying&&isPlaying&&globalNowPlaying&&
    !LOADING_MESSAGES.includes(globalNowPlaying));
  const effectiveNowPlaying=currentUser?(useGlobal?globalNowPlaying:localNowPlaying):null;
  const foundWithAI=Boolean(effectiveNowPlaying&&
    (useGlobal?globalNowPlayingInfo?.foundWithAI:localNowPlayingInfo.foundWithAI));

  const isCurrentlyLoadingMeta = LOADING_MESSAGES.includes(effectiveNowPlaying) || isRecognizing;

  // --- FETCH BANNERS ---
  useEffect(() => {
    if (isFreeOrGuest) {
      fetch(`/api/banners/active`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setActiveBanners(data || []))
        .catch(err => console.error("Error fetching banners:", err));
    }
  }, [isFreeOrGuest]);

  const homeBanners = activeBanners.filter(b => b.placement && b.placement.includes('home'));

  // Fetch live song information only for the authenticated listener's active station.
  useEffect(() => {
    const controller=new AbortController();
    let intervalId;
    let inFlight=false;
    setLocalNowPlaying(null);
    setLocalNowPlayingInfo({source:'none',foundWithAI:false});
    setIsSearchingMetadata(false);
    if (!station?._id || !currentUser) {
      return () => controller.abort();
    }
    const read=async()=>{
      if(inFlight || controller.signal.aborted)return;
      inFlight=true;
      setIsSearchingMetadata(true);
      try{
        const response=await fetch(`${API_URL}/metadata?stationId=${encodeURIComponent(station._id)}`,{
          headers:{Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`},
          signal:controller.signal
        });
        if(!response.ok)throw new Error('Song information unavailable');
        const data=await response.json();
        if(!controller.signal.aborted){
          const title=typeof data?.title==='string'&&data.title.trim()?data.title.trim():null;
          setLocalNowPlaying(title);
          setLocalNowPlayingInfo({source:data?.source||'none',
            foundWithAI:Boolean(title&&data?.foundWithAI)});
        }
      }catch{
        if(!controller.signal.aborted){setLocalNowPlaying(null);setLocalNowPlayingInfo({source:'none',foundWithAI:false});}
      }finally{
        inFlight=false;
        if(!controller.signal.aborted)setIsSearchingMetadata(false);
      }
    };
    read();
    intervalId=setInterval(read,45000);
    return ()=>{controller.abort();clearInterval(intervalId);};
  }, [station?._id, currentUser?._id, API_URL]);

  // 🟢 ΚΛΙΚ ΣΤΟ AI RADAR
  const onRadarClick = (e) => {
    e.stopPropagation();
    if (!isThisPlaying || !isPlaying) {
      showAlert("Πρέπει πρώτα να πατήσεις Play στον σταθμό για να αναγνωρίσεις τη μουσική!");
      return;
    }
    if (!currentUser) {
      showAlert("Συνδέσου στο iRadios για να βρεις ποιο τραγούδι παίζει.");
      return;
    }
    if (handleRecognizeTrack) handleRecognizeTrack();
  };

  // 🟢 ΚΛΙΚ ΣΤΟ SPOTIFY (ΔΙΟΡΘΩΜΕΝΟ TYPO)
  const onSpotifyClick = (e) => {
    e.stopPropagation();
    if (currentUser?.isPremium) {
      window.open(`https://open.spotify.com/search/${encodeURIComponent(effectiveNowPlaying)}`, '_blank', 'noopener,noreferrer');
    } else {
      showAlert("Αναβαθμίστε σε Premium για 1-Click Spotify Save.");
      navigate('/premium');
    }
  };


  const relatedStations = useMemo(() => {
    if(!station?._id)return [];
    const available=stations.filter(s=>
      s?._id && String(s._id)!==String(station._id) && (s.status==='approved'||!s.status));
    const sameGenre=available.filter(s=>s.genre && s.genre===station.genre);
    const sameRegion=available.filter(s=>
      s.region && s.region===station.region && !sameGenre.includes(s));
    const others=available.filter(s=>!sameGenre.includes(s)&&!sameRegion.includes(s));
    return [...sameGenre,...sameRegion,...others].slice(0,6);
  }, [station?._id,station?.genre,station?.region,stations]);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const mainScroller = document.getElementById('main-scroller');
    if (mainScroller) mainScroller.scrollTop = 0;
  }, [id, station]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eqMenuRef.current && !eqMenuRef.current.contains(event.target)) {
        setShowEQMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { currentShow, nextShow } = useMemo(() => {
    if (!station || !station.schedule || station.schedule.length === 0) {
      return { currentShow: null, nextShow: null };
    }
    const now = new Date();
    const currentDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const parseTime = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    const sortedSchedule = [...station.schedule].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return parseTime(a.startTime) - parseTime(b.startTime);
    });
    const curr = sortedSchedule.find(s => 
      s.day === currentDayIdx && 
      parseTime(s.startTime) <= currentMinutes && 
      parseTime(s.endTime) > currentMinutes
    );
    let next = null;
    const todayShows = sortedSchedule.filter(s => s.day === currentDayIdx && parseTime(s.startTime) > currentMinutes);
    if (todayShows.length > 0) {
      next = todayShows[0];
    } else {
      for (let i = 1; i <= 7; i++) {
        const nextDayIdx = (currentDayIdx + i) % 7;
        const nextDayShows = sortedSchedule.filter(s => s.day === nextDayIdx);
        if (nextDayShows.length > 0) {
          next = nextDayShows[0];
          break;
        }
      }
    }
    return { currentShow: curr, nextShow: next };
  }, [station]);

  if (!station) return <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
    <Radio size={38} className="text-[#ccff00]"/>
    <h1 className="text-2xl font-black text-white">Δεν βρήκαμε αυτόν τον σταθμό</h1>
    <p className="text-sm text-zinc-400">Μπορείς να ανακαλύψεις άλλους σταθμούς στην αρχική.</p>
    <button type="button" onClick={()=>navigate('/')} className="ir-action-primary px-6">Στην αρχική</button>
  </div>;

  const isFav = isFavorite ? isFavorite(station._id) : false;
  const canUseCustomEQ = currentUser?.isPremium && isFav;
  const currentPreset = userOverrides?.[station._id] || 'Station Default';

  const handlePlayClick = () => {
    if (isThisPlaying) {
      onPlayPause(); 
    } else {
      setCurrentStation(station); 
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Άκου τον ${station.name} στο iRadios`,
      text: station.slogan || `Ακούστε ζωντανά τον σταθμό ${station.name} στο iRadios!`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); 
    }
  };

  const TrackableAd = ({ banner, children, className }) => {
    const adRef = useRef(null);
    const tracked = useRef(false);
    useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !tracked.current) {
          tracked.current = true;
          fetch(`/api/banners/${banner._id}/impression`, { method: 'POST' }).catch(()=>{});
        }
      }, { threshold: 0.5 });
      if (adRef.current) observer.observe(adRef.current);
      return () => observer.disconnect();
    }, [banner._id]);

    const campaign = "stationprofile_ad";
    const baseParams = `ref=iradiosapp&utm_medium=ilumadigitalagencyiradios&utm_source=iradios&utm_campaign=${campaign}&utm_content=${campaign}`;
    const finalUrl = `${banner.targetUrl}${banner.targetUrl.includes('?') ? '&' : '?'}${baseParams}`;

    return (
      <a 
        ref={adRef} href={finalUrl} target="_blank" rel="noopener noreferrer" 
        className={`${className} block cursor-pointer`} 
        onClick={(e) => {
          e.stopPropagation();
          fetch(`/api/banners/${banner._id}/click`, { method: 'POST' }).catch(()=>{});
        }}
      >
        {children}
      </a>
    );
  };

  const StationAdBanner = ({ banner }) => {
    if (!banner) return null;
    return (
      <TrackableAd 
        banner={banner}
        className="w-full my-8 bg-emerald-900/10 border border-emerald-500/20 hover:border-emerald-500/50 rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 group transition-all"
      >
        <div className="w-full md:w-1/3 h-32 md:h-40 rounded-2xl overflow-hidden shrink-0 bg-black">
          <img src={banner.imageUrl} alt="Ad" className="w-full h-full object-contain bg-white group-hover:scale-105 transition-transform duration-700" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-3 border border-emerald-500/30">
            <ShieldCheck size={10} /> SPONSORED
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{banner.title}</h3>
          <p className="text-sm text-zinc-400">{banner.description}</p>
        </div>
        <div className="shrink-0">
          <button className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
            ΔΕΙΤΕ ΠΕΡΙΣΣΟΤΕΡΑ <ExternalLink size={16} />
          </button>
        </div>
      </TrackableAd>
    );
  };

  const SocialLink = ({ href, icon, label, type }) => {
    if (!href) return null;
    let link = href;
    let target = "_blank";
    
    if (type === 'phone') {
      link = `tel:${href}`; target = "_self";
    } else if (type === 'email') {
      link = `mailto:${href}`; target = "_self";
    } else if (type === 'viber') { 
      const cleanPhone = href.replace(/[^\d+]/g, ''); 
      const encodedText = encodeURIComponent('Γειά σας! Σας ακούω από το iRadios!');
      link = `viber://chat?number=${cleanPhone}&draft=${encodedText}`; target = "_self";
    } else {
      if (!href.startsWith('http')) link = `https://${href}`;
      if (label === 'Website') {
        try {
          const urlObj = new URL(link);
          urlObj.searchParams.set('utm_source', 'iradios.gr');
          urlObj.searchParams.set('utm_medium', 'referral');
          urlObj.searchParams.set('utm_campaign', 'station_profile');
          link = urlObj.toString();
        } catch (e) {
          const separator = link.includes('?') ? '&' : '?';
          link = `${link}${separator}utm_source=iradios.gr&utm_medium=referral`;
        }
      }
    }

    return (
      <a 
        href={link} target={target} rel="noopener noreferrer" 
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900/50 hover:bg-zinc-800 border border-white/10 hover:border-white/20 transition-all text-sm font-medium group backdrop-blur-sm ${type === 'viber' ? 'text-[#7360f2] hover:text-white' : 'text-zinc-300 hover:text-white'}`}
      >
        <span className={`${type === 'viber' ? 'text-[#7360f2]' : 'text-zinc-400'} group-hover:text-[#ccff00] transition-colors`}>{icon}</span>
        <span className="truncate max-w-[150px]">{label}</span>
      </a>
    );
  };

  // 🟢 Απλή λογική: Αν παίζει ο σταθμός ΚΑΙ υπάρχει CoverArt από το App.jsx, το δείχνουμε. Αλλιώς, το Logo.
  const showCoverArt = Boolean(currentUser && isThisPlaying && isPlaying && globalCoverArt && !isCurrentlyLoadingMeta);
  const currentImage = showCoverArt ? globalCoverArt : station.logo;

  return (
    <div className="ir-station-page relative flex flex-col pb-40 w-full min-h-screen">
      
      <Helmet>
        <title>{`${station.name} στο iRadios. ${currentShow ? 'ON Air: ' + currentShow.title : ''} ${station.slogan ? ' | ' + station.slogan : ''}`}</title>
      </Helmet>

      {/* BACKGROUND BLUR */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none h-[80vh]">
        <div 
          className="absolute inset-0 opacity-20 blur-[100px] scale-110 transition-all duration-1000"
          style={{ backgroundImage: `url(${currentImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black"></div>
      </div>

      <div className="relative z-10 flex-1 px-4 sm:px-6 lg:px-12 py-6 lg:py-12 max-w-[1400px] mx-auto w-full">
        
        {/* BACK BUTTON */}
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 lg:mb-12 group w-fit"
        >
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> 
          </div>
          <span className="text-[10px] font-black tracking-[0.2em] uppercase">Πίσω</span>
        </button>

        <div className="ir-station-hero flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-start text-center lg:text-left mb-12 px-5 py-7 sm:p-8 lg:p-12">
          
          {/* 🟢 DYNAMIC LOGO / COVER ART AREA */}
          <div className="flex flex-col items-center lg:items-start gap-4 shrink-0">
            <div className="ir-station-hero-art w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 overflow-hidden group relative z-10 transition-all duration-500">
              
              <img 
                src={currentImage} 
                alt={showCoverArt ? effectiveNowPlaying : station.name} 
                className={`w-full h-full transition-all duration-700 z-10 
                  ${showCoverArt ? 'object-cover group-hover:scale-110' : 'object-contain bg-white group-hover:scale-105'}
                  ${isThisPlaying && isPlaying && !showCoverArt ? 'animate-audio-pulse shadow-[0_0_50px_-12px_var(--station-accent)]' : ''}
                `}
              />

              {/* 🟢 AI RADAR BUTTON (Top Right) */}
              <div className="absolute top-4 right-4 z-20 flex justify-end">
                <button 
                  onClick={onRadarClick}
                  disabled={isRecognizing}
                  className={`group/radar bg-black/60 backdrop-blur-md h-8 rounded-full border border-white/10 flex items-center overflow-hidden transition-all duration-300 w-8 hover:w-[180px] text-white hover:text-[#ccff00] shadow-lg disabled:opacity-50`}
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    {isRecognizing ? <Loader2 size={14} className="animate-spin text-[#ccff00]" /> : <ScanSearch size={14} />}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap opacity-0 group-hover/radar:opacity-100 transition-opacity duration-300">
                    ΒΡΕΣ ΤΟ ΤΡΑΓΟΥΔΙ
                  </span>
                </button>
              </div>

              {showCoverArt && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
                  
                  {/* Miniature Station Logo */}
                  <div className="absolute bottom-4 left-4 z-20">
                    <div className="bg-white p-1 rounded-[12px] shadow-lg w-20 h-20 flex items-center justify-center border border-black/5 overflow-hidden">
                      <img src={station.logo} alt={station.name} className="w-full h-full object-contain" />
                    </div>
                  </div>

                   <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse shadow-[0_0_8px_#ccff00]"></div>
                     <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">ΤΩΡΑ ΠΑΙΖΕΙ</span>
                   </div>
                </>
              )}

              {/* Searching Indicator Overlay */}
              {isSearchingMetadata && !localNowPlaying && !isCurrentlyLoadingMeta && (
                 <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2 text-white bg-black/60 px-4 py-2 rounded-full text-xs font-bold">
                       <Loader2 size={14} className="animate-spin text-[#ccff00]" /> Αναζήτηση...
                    </div>
                 </div>
              )}
            </div>

            {/* 🟢 SPOTIFY BUTTON (Φαίνεται σε όλους, συμπεριφορά βάσει Premium) */}
            {effectiveNowPlaying && !isCurrentlyLoadingMeta && (
              <button 
                onClick={onSpotifyClick}
                className="w-full flex items-center justify-center gap-2 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/20 px-6 py-3.5 rounded-2xl transition-all font-bold text-xs tracking-wider shrink-0"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.56.3z"/>
                </svg>
                Ψάξ'το στο Spotify
              </button>
            )}
          </div>

          {/* STATION INFO */}
          <div className="flex flex-col flex-1 max-w-3xl w-full relative z-10">
            
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-3 justify-center lg:justify-start">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-2xl">
                {station.name}{station.boostStatus && new Date(station.boostExpiresAt) > new Date() && (<Zap size={14} className="inline ml-2 text-black bg-[#ccff00] rounded-full p-0.5 mb-0.5" />)}
              </h1>
              
              {/* TRANSMISSION BADGE */}
              <div className="flex items-center justify-center lg:justify-start gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black tracking-widest border ${
                  station.transmissionType === 'Επίγειο' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                  station.transmissionType === 'DAB' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  <SignalHigh size={12} />
                  {station.transmissionType || 'Web Radio'} {station.frequency && `• ${formatFMFrequency(station.frequency)}`}
                </span>

                {station.explicit && (
                  <span className="inline-flex items-center justify-center gap-1 bg-red-500/20 text-red-500 border border-red-500/20 text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded-lg h-fit w-fit">
                    <AlertTriangle size={12} /> Explicit
                  </span>
                )}
              </div>
            </div>
            
            {/* Real authenticated station metadata (no fabricated song history). */}
            <div className="ir-station-now mb-6 min-h-[60px] w-full max-w-2xl">
              {effectiveNowPlaying ? (
                <div className="animate-fade-in flex flex-col items-center lg:items-start">
                  <div className="inline-flex items-center gap-2 mb-2">
                    {!isCurrentlyLoadingMeta ? (
                       <Disc3 size={14} className="text-[#ccff00] animate-spin-slow" />
                    ) : (
                       <Loader2 size={14} className="text-[#ccff00] animate-spin" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ccff00]">
                      {isCurrentlyLoadingMeta ? 'ΑΝΑΓΝΩΡΙΣΗ' : 'ΤΩΡΑ ΠΑΙΖΕΙ'}
                    </span>
                     {foundWithAI&&<FoundWithAI compact/>}
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug drop-shadow-md">
                    {/* Box clone styling to hug the text */}
                    <span className="backdrop-blur-sm px-3 py-1 box-decoration-clone rounded-lg">
                      {effectiveNowPlaying}
                    </span>
                  </h2>
                </div>
              ) : !currentUser ? (
                <button type="button" onClick={()=>navigate('/login')} className="min-h-11 text-left text-sm font-bold text-[#ccff00] hover:underline">
                  Συνδέσου στο iRadios για NowPlaying
                </button>
              ) : (
                station.slogan && (
                  <h2 className="text-lg lg:text-xl text-[#ffffff55] tracking-tight mt-1 animate-fade-in">
                    "{station.slogan}"
                  </h2>
                )
              )}
              
              <div className="mt-4 flex flex-wrap justify-center lg:justify-start gap-3">
                {currentShow && (
                  <div className="inline-flex items-center gap-2 bg-[#ccff00]/10 border border-[#ccff00]/20 px-3 py-1.5 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse"></div>
                    <span className="text-[14px] font-black text-[#ccff00] tracking-widest">
                      LIVE: {currentShow.title} {currentShow.host && `• ${currentShow.host}`}
                    </span>
                  </div>
                )}
                {nextShow && (
                  <div className="inline-flex items-center gap-2 bg-[#24242485]/10 border border-[#24242499]/20 px-3 py-1.5 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-[#7777778c]"></div>
                    <span className="text-[12px] font-black text-[#9c9c9c] tracking-widest">
                      NEXT: {nextShow.title} {nextShow.host && `• ${nextShow.host}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* CONTROLS ROW */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 sm:gap-8 mb-8">
              <div className="flex items-center gap-4 lg:gap-6">
                
                {/* VU METER & PLAY BUTTON */}
                <div className="relative w-16 h-16 lg:w-20 lg:h-20 shrink-0 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center scale-[1.3] lg:scale-[1.65] pointer-events-none z-0">
                    <CircularVU analyser={analyser} isPlaying={isThisPlaying && isPlaying} />
                  </div>
                  
                  <button 
                    onClick={handlePlayClick}
                    aria-label={isThisPlaying && isPlaying ? 'Παύση σταθμού' : 'Αναπαραγωγή σταθμού'}
                    className="ir-player-transport relative z-10 w-full h-full rounded-full flex items-center justify-center hover:scale-105 transition-transform active:scale-95"
                  >
                    {isThisPlaying && isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1.5" />}
                  </button>
                </div>
                
                {/* FAVORITE BUTTON */}
                <button 
                  onClick={() => toggleFavorite && toggleFavorite(station._id)}
                  className={`w-12 h-12 lg:w-14 lg:h-14 border rounded-full flex items-center justify-center transition-all shrink-0 ${isFav ? 'border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]' : 'border-white/20 text-white hover:bg-white/10'}`}
                >
                  <Heart size={24} fill={isFav ? '#ccff00' : 'none'} />
                </button>

                {/* SHARE BUTTON */}
                <button 
                  onClick={handleShare}
                  className={`w-12 h-12 lg:w-14 lg:h-14 border rounded-full flex items-center justify-center transition-all shrink-0 ${copied ? 'border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]' : 'border-white/20 text-white hover:bg-white/10'}`}
                  title="Κοινοποίηση"
                >
                  {copied ? <Check size={24} /> : <Share2 size={24} />}
                </button>

                {/* PREMIUM EQ BUTTON */}
                {canUseCustomEQ && (
                  <div className="relative" ref={eqMenuRef}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowEQMenu(!showEQMenu); }}
                      className={`w-12 h-12 lg:w-14 lg:h-14 border rounded-full flex items-center justify-center transition-all shrink-0 ${showEQMenu || currentPreset !== 'Station Default' ? 'border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]' : 'border-white/20 text-white hover:bg-white/10'}`}
                      title="Προσαρμογή Ήχου (Premium)"
                    >
                      <SlidersHorizontal size={24} />
                    </button>

                    {showEQMenu && (
                      <div className="absolute top-full left-0 lg:left-1/2 lg:-translate-x-1/2 mt-3 w-56 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-[100] animate-fade-in">
                        <div className="px-3 py-2 mb-2 border-b border-white/5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ρυθμιση ηχου</span>
                        </div>
                        
                        <button 
                          onClick={() => { onUserDSPChange(station._id, 'Station Default'); setShowEQMenu(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${currentPreset === 'Station Default' ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'text-white hover:bg-white/5'}`}
                        >
                          <Radio size={16} /> <span>Προεπιλογή Σταθμού</span>
                        </button>

                        <button 
                          onClick={() => { onUserDSPChange(station._id, 'HomeTheater'); setShowEQMenu(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${currentPreset === 'HomeTheater' ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'text-white hover:bg-white/5'}`}
                        >
                          <MonitorSpeaker size={16} /> <span>Κινηματογράφος</span>
                        </button>

                        <button 
                          onClick={() => { onUserDSPChange(station._id, 'HiRes'); setShowEQMenu(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${currentPreset === 'HiRes' ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'text-white hover:bg-white/5'}`}
                        >
                          <Headphones size={16} /> <span>Καθαρός ήχος</span>
                        </button>

                        <div className="my-1 border-t border-white/5"></div>

                        <button 
                          onClick={() => { onUserDSPChange(station._id, 'OFF'); setShowEQMenu(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${currentPreset === 'OFF' ? 'bg-red-500/10 text-red-500' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                        >
                          <PowerOff size={16} /> <span>Χωρίς εφέ</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6 sm:gap-8 text-left">
                <div className="h-10 w-px bg-white/10 hidden sm:block"></div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-black mb-1 block uppercase tracking-widest">Τοποθεσια</span>
                  <span className="text-[14px] sm:text-[15px] font-bold text-white">
                    {station.city ? `${station.city}, ${station.region}` : (station.region || 'Web')}
                  </span>
                </div>
                <div className="h-10 w-px bg-white/10"></div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-black mb-1 block uppercase tracking-widest">Ειδος</span>
                  <span className="text-[14px] sm:text-[15px] font-bold text-[#ccff00] tracking-wider">{station.genre}</span>
                </div>
              </div>
            </div>

            {/* DESCRIPTION */}
            <p className="text-zinc-400 text-sm lg:text-base leading-relaxed mb-6 font-medium max-w-2xl mx-auto lg:mx-0">
              {station.description || 'Δεν υπάρχει διαθέσιμη περιγραφή για αυτόν τον σταθμό. Πατήστε το Play για να συντονιστείτε ζωντανά.'}
            </p>

            {/* SOCIAL & CONTACT LINKS */}
            {(station.website || station.facebook || station.instagram || station.twitter || station.tiktok || station.phone || station.viber || station.email) && (
              <div className="mt-4 border-t border-white/5 pt-8 w-full">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 text-center lg:text-left">
                  Επικοινωνια & Social
                </h3>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                  <SocialLink href={station.website} icon={<Globe size={16} />} label="Website" type="web" />
                  <SocialLink href={station.facebook} icon={<Facebook size={16} />} label="Facebook" type="web" />
                  <SocialLink href={station.instagram} icon={<Instagram size={16} />} label="Instagram" type="web" />
                  <SocialLink href={station.tiktok} icon={<Music size={16} />} label="TikTok" type="web" />
                  <SocialLink href={station.twitter} icon={<Twitter size={16} />} label="Twitter" type="web" />
                  <SocialLink href={station.phone} icon={<Phone size={16} />} label={station.phone} type="phone" />
                  <SocialLink href={station.viber} icon={<MessageCircle size={16} />} label="Viber" type="viber" />
                  <SocialLink href={station.email} icon={<Mail size={16} />} label="Email" type="email" />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Real last 12 songs for this station, never demo/mock track rows. */}
        <StationPlaylistPanel station={station} currentUser={currentUser} currentStation={currentStation} isPlaying={isPlaying} onPlayPause={onPlayPause} onPlayStation={setCurrentStation}/>

        {/* 3. ΑΝΑΛΥΤΙΚΟ ΠΡΟΓΡΑΜΜΑ (TIMELINE) */}
        {station.schedule && station.schedule.length > 0 && (
          <div className="mt-8 border-t border-white/5 pt-16">
            <div className="flex items-center gap-3 mb-8 justify-center lg:justify-start">
              <CalendarDays className="text-[#ccff00]" size={28} />
              <h3 className="text-xl font-black text-white  tracking-widest">Πρόγραμμα του {station.name}</h3>
            </div>

            <div className="flex overflow-x-auto gap-3 pb-4 custom-scrollbar mb-8 justify-start lg:justify-start snap-x">
              {DAYS_OF_WEEK.map((dayName, idx) => {
                 const hasShows = station.schedule.some(s => s.day === idx);
                 if (!hasShows) return null;
                 
                 const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                 const isToday = todayIdx === idx;

                 return (
                   <button
                     key={idx}
                     onClick={() => setSelectedDay(idx)}
                     className={`px-6 py-3 rounded-full text-sm font-black  tracking-widest whitespace-nowrap transition-all snap-start shadow-lg ${
                       selectedDay === idx 
                         ? 'bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]' 
                         : 'bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800'
                     }`}
                   >
                     {dayName} {isToday && <span className="ml-2 opacity-50">(Σημερα)</span>}
                   </button>
                 )
              })}
            </div>

            <div className="flex flex-col gap-3">
               {station.schedule
                  .filter(s => s.day === selectedDay)
                  .sort((a,b) => {
                    const parseTime = (timeStr) => { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; };
                    return parseTime(a.startTime) - parseTime(b.startTime);
                  })
                  .map((show, i) => {
                    const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                    const isPlayingNow = currentShow && currentShow.title === show.title && currentShow.startTime === show.startTime && selectedDay === todayIdx;

                    return (
                      <div key={i} className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-5 sm:p-6 rounded-3xl border transition-all ${
                        isPlayingNow 
                          ? 'bg-[#ccff00]/5 border-[#ccff00]/50 shadow-[0_0_20px_rgba(204,255,0,0.05)]' 
                          : 'bg-zinc-900/50 border-white/5 hover:border-white/10 hover:bg-zinc-900'
                      }`}>
                         <div className="w-auto sm:w-28 shrink-0 flex flex-row sm:flex-col items-center sm:items-start gap-2 sm:gap-0">
                            <div className={`text-lg font-black ${isPlayingNow ? 'text-[#ccff00]' : 'text-white'}`}>{show.startTime}</div>
                            <div className="text-xs text-zinc-500 font-bold tracking-widest sm:mt-1">έως {show.endTime}</div>
                         </div>
                         
                         <div className="hidden sm:block h-12 w-px bg-white/10 shrink-0"></div>
                         
                         <div className="min-w-0 flex-1 w-full">
                            <div className={`font-black text-lg truncate ${isPlayingNow ? 'text-[#ccff00]' : 'text-white'}`}>{show.title}</div>
                            <div className="text-sm text-zinc-400 mt-1 font-medium flex items-center gap-1.5 truncate"><Music size={14} className="text-zinc-600"/> {show.host}</div>
                         </div>

                         {isPlayingNow && (
                            <div className="flex shrink-0 items-center gap-2 px-4 py-2 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20 ml-auto sm:ml-0 mt-2 sm:mt-0">
                               <div className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse"></div>
                               <span className="text-[10px] font-black text-[#ccff00] uppercase tracking-widest">LIVE NOW</span>
                            </div>
                         )}
                      </div>
                    )
               })}
               {station.schedule.filter(s => s.day === selectedDay).length === 0 && (
                 <div className="p-8 text-center text-zinc-500 font-medium italic bg-zinc-900/30 rounded-3xl border border-white/5">
                   Δεν υπάρχει προγραμματισμένη εκπομπή για αυτή την ημέρα.
                 </div>
               )}
            </div>
          </div>
        )}

        {/* 🟢 AD BANNER */}
        {isFreeOrGuest && homeBanners.length > 0 && (
          <div className="mt-8">
            <StationAdBanner banner={homeBanners[Math.floor(Math.random() * homeBanners.length)]} />
          </div>
        )}

        {/* 4. YOU MIGHT ALSO LIKE (ΣΧΕΤΙΚΟΙ ΣΤΑΘΜΟΙ) */}
        {relatedStations.length > 0 && (
          <div className="mt-16 border-t border-white/5 pt-12 animate-fade-in">
            <h3 className="text-[12px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-6 text-center lg:text-left">
              Μπορει να σου αρεσουν
            </h3>
            
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 sm:gap-5">
              {relatedStations.map(relStation=>(
                <StationCatalogCard key={relStation._id} station={relStation}
                  currentStation={currentStation} isPlaying={isPlaying} onPlayPause={onPlayPause}
                  onPlayStation={setCurrentStation}/>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
