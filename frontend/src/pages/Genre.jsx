import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, ArrowLeft, Radio, LayoutGrid, List, MapPin, Zap, Megaphone, ExternalLink, SignalHigh } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import CircularVU from '../components/CircularVU';

export default function Genre({ stations, currentStation, setCurrentStation, isPlaying, onPlayPause, analyser, currentUser, userLocation, checkGeoMatch }) {
  const { genreName } = useParams();
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState('grid');
  
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedTransmission, setSelectedTransmission] = useState('all'); 
  
  const [activeBanners, setActiveBanners] = useState([]);

  // 🟢 ΑΣΠΙΔΑ PREMIUM
  const isPremiumUser = Boolean(
    currentUser && (
      currentUser.role === 'admin' || 
      currentUser.role === 'agency' || 
      currentUser.isPremium === true || 
      currentUser.isPremium === 'true' || 
      currentUser?.broadcasterProfile?.tier === 'premium'
    )
  );
  
  const isFreeOrGuest = !isPremiumUser;

  // Φορτώνουμε τα banners ΜΟΝΟ αν είναι Free/Guest
  useEffect(() => {
    if (isFreeOrGuest) {
      fetch(`/api/banners/active`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          // 🚨 1. Κρατάμε ΑΥΣΤΗΡΑ μόνο τα active
          const strictlyActiveBanners = data.filter(banner => banner.status === 'active');
          
          if (checkGeoMatch && userLocation) {
            // 🚨 2. Φιλτράρουμε το strictlyActiveBanners (ΟΧΙ το data)
            const geoFilteredBanners = strictlyActiveBanners.filter(banner => {
              const targetArea = (banner.targetLocations && banner.targetLocations.length > 0) ? banner.targetLocations[0] : 'All';
              return checkGeoMatch(targetArea, userLocation);
            });
            setActiveBanners(geoFilteredBanners);
          } else {
            // 🚨 3. Περνάμε το strictlyActiveBanners (ΟΧΙ το data)
            setActiveBanners(strictlyActiveBanners);
          }
        })
        .catch(err => console.error("Error fetching banners:", err));
    } else {
      setActiveBanners([]);
    }
  }, [isFreeOrGuest, userLocation, checkGeoMatch]);

  // 🟢 SQUARE BANNERS (Κάθε 5 σταθμούς)
  const radioFeedBanners = useMemo(() => {
    if (isPremiumUser) return []; 
    return activeBanners.filter(b => b.placement && b.placement.includes('radio_feed'));
  }, [activeBanners, isPremiumUser]);

  // 🔥 HERO BANNERS (Κάθε 12 σταθμούς - Full Width)
  const homeBanners = useMemo(() => {
    if (isPremiumUser) return []; 
    return activeBanners.filter(b => b.placement && b.placement.includes('home'));
  }, [activeBanners, isPremiumUser]);

  const baseStations = useMemo(() => stations.filter(s => s.genre === genreName), [stations, genreName]);

  const availableRegions = useMemo(() => {
    return [...new Set(baseStations.map(s => s.region))].filter(Boolean).sort();
  }, [baseStations]);

  const availableTransmissions = useMemo(() => {
    return [...new Set(baseStations.map(s => s.transmissionType || 'Web Radio'))].filter(Boolean).sort();
  }, [baseStations]);

  const filteredAndSorted = useMemo(() => {
    let result = [...baseStations];
    
    if (selectedRegion !== 'all') {
      result = result.filter(s => s.region === selectedRegion);
    }
    
    if (selectedTransmission !== 'all') {
      result = result.filter(s => (s.transmissionType || 'Web Radio') === selectedTransmission);
    }

    return result.sort((a, b) => {
      if (sortBy === 'popularity') return (b.popularity || 0) - (a.popularity || 0);
      if (sortBy === 'alphabetical') return a.name.localeCompare(b.name);
      if (sortBy === 'date') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      return 0;
    });
  }, [baseStations, selectedRegion, selectedTransmission, sortBy]);

  const handleBannerView = async (bannerId) => {
    try {
      await fetch(`/api/banners/${bannerId}/impression`, { method: 'POST' });
    } catch (e) {
      console.error("View tracking failed", e);
    }
  };

  const TrackableAdWrapper = ({ banner, children, className }) => {
    const adRef = React.useRef(null);
    const tracked = React.useRef(false);

    React.useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !tracked.current) {
          tracked.current = true;
          handleBannerView(banner._id);
        }
      }, { threshold: 0.5 });

      if (adRef.current) observer.observe(adRef.current);
      return () => observer.disconnect();
    }, [banner._id]);

    const baseParams = "ref=iradiosapp&utm_medium=ilumadigitalagencyiradios&utm_source=iradios&utm_campaign=radiofeed_ir&utm_content=radiofeed_ir";
    const finalUrl = `${banner.targetUrl}${banner.targetUrl.includes('?') ? '&' : '?'}${baseParams}`;

    return (
      <a 
        ref={adRef} 
        href={finalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} block cursor-pointer`} 
        onClick={(e) => {
          e.stopPropagation(); 
          fetch(`/api/banners/${banner._id}/click`, { method: 'POST' }).catch(err => console.error("Click error", err));
        }}
      >
        {children}
      </a>
    );
  };

  const SquareAdCard = ({ banner }) => (
    <TrackableAdWrapper banner={banner} className="group flex flex-col relative cursor-pointer h-full">
      <div className="relative aspect-square w-full rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-900 shadow-lg border border-purple-500/30 transition-all duration-500 group-hover:-translate-y-1 group-hover:border-purple-500 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
        <img src={banner.squareImageUrl || banner.imageUrl} alt={banner.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
        <div className="absolute top-2 right-2 bg-purple-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-1 shadow-md">
          <Megaphone size={8} /> AD
        </div>
      </div>
      <div className="mt-2 px-1">
        <h3 className="font-bold text-[14px] md:text-[18px] text-purple-400 truncate flex items-center gap-1">
          {banner.title} <ExternalLink size={12} />
        </h3>
        <p className="text-[9px] md:text-[12px] text-zinc-500 font-black tracking-widest truncate uppercase">Sponsored</p>
      </div>
    </TrackableAdWrapper>
  );

  return (
    <div className="w-full px-4 md:px-8 py-6 md:py-10 pb-40 animate-fade-in">
      <Helmet>
        <title>{`${genreName} Ραδιόφωνα στο iRadios App - Η Νέα Εποχή στο Ραδιόφωνο`}</title>
        <meta name="keywords" content={`iRadios, ραδιόφωνο, ${genreName}, online radio, web radio, ελληνικό ραδιόφωνο, eradio, ζωντανή μουσική, ιντερνετικό ραδιόφωνο, εραδιο, ραδιοφωνικοί σταθμοί, podcasts, λιωε24, live24, ILUMA Digital Agency`} />
        <meta name="description" content={`Ακούστε Ραδιόφωνα ${genreName} LIVE στο iRadios App. Όλα τα ραδιόφωνα σε μία εφαρμογή. Streaming radio από Αθήνα, Θεσσαλονίκη, Κύπρο και τα κορυφαία Greek Radios είναι εδώ.`} />
        <meta property="og:title" content={`Ραδιόφωνα ${genreName} στο iRadios App`} />
        <meta property="og:description" content={`Ακούστε Ραδιόφωνα ${genreName} LIVE. Όλα τα ραδιόφωνα σε μία εφαρμογή. Streaming radio από Αθήνα, Θεσσαλονίκη, Κύπρο και τα κορυφαία Greek Radios είναι εδώ.`} />
      </Helmet>

      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 md:mb-12 group">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[10px] font-black tracking-[0.2em] uppercase">Επιστροφη</span>
      </button>

      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8 md:mb-12 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white italic flex items-center gap-4">
            <Radio className="text-[#ccff00]" size={36} /> {genreName}
          </h2>
          <p className="text-[11px] md:text-sm text-zinc-500 mt-2 font-bold tracking-widest uppercase">
            {filteredAndSorted.length} Σταθμοι {selectedRegion !== 'all' && `στην περιοχή ${selectedRegion}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-zinc-500 hidden sm:block" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-zinc-900 border border-white/10 text-white text-xs font-bold rounded-xl px-4 py-2.5 outline-none cursor-pointer max-w-[160px]"
            >
              <option value="all">Όλες οι Περιοχές</option>
              {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <SignalHigh size={14} className="text-zinc-500 hidden sm:block" />
            <select
              value={selectedTransmission}
              onChange={(e) => setSelectedTransmission(e.target.value)}
              className="bg-zinc-900 border border-white/10 text-white text-xs font-bold rounded-xl px-4 py-2.5 outline-none cursor-pointer max-w-[160px]"
            >
              <option value="all">Όλες οι Μεταδόσεις</option>
              {availableTransmissions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-zinc-900 border border-white/10 text-white text-xs font-bold rounded-xl px-4 py-2.5 outline-none cursor-pointer">
            <option value="popularity">Δημοτικότητα</option>
            <option value="alphabetical">Αλφαβητικά</option>
            <option value="date">Νεότερα</option>
          </select>

          <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl p-1">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><LayoutGrid size={16} /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><List size={16} /></button>
          </div>
        </div>
      </div>

      {filteredAndSorted.length > 0 ? (
        <div className={viewMode === 'grid' ? "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-6" : "flex flex-col gap-3 max-w-4xl"}>
          {filteredAndSorted.map((station, index) => {
            const isCurrent = currentStation && (currentStation._id === station._id);
            const isCurrentlyPlaying = isCurrent && isPlaying;

            // 🟢 ΤΑ ΜΙΚΡΑ BANNERS (Κάθε 5)
            const showAd = isFreeOrGuest && index > 0 && index % 5 === 0 && radioFeedBanners.length > 0;
            const currentBanner = showAd ? radioFeedBanners[Math.floor(index / 5) % radioFeedBanners.length] : null;

            // 🔥 ΤΑ HERO BANNERS (Κάθε 12)
            const showFullBanner = viewMode === 'grid' && isFreeOrGuest && index > 0 && index % 12 === 0 && homeBanners.length > 0;
            const currentFullBanner = showFullBanner ? homeBanners[Math.floor(index / 12) % homeBanners.length] : null;

            return (
              <React.Fragment key={station._id}>
                
                {/* 🔥 FULL WIDTH BANNER INJECTION */}
                {showFullBanner && currentFullBanner && (
                  <div className="col-span-full py-4 md:py-8">
                    <TrackableAdWrapper banner={currentFullBanner} className="relative w-full h-[200px] md:h-[350px] rounded-[32px] md:rounded-[40px] overflow-hidden group border border-purple-500/20 hover:border-purple-500 shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] transition-all duration-500 block">
                      <img src={currentFullBanner.imageUrl} alt={currentFullBanner.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                      
                      <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-purple-500 text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg z-10">
                        <Megaphone size={14} /> Sponsored
                      </div>

                      <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="max-w-2xl">
                          <h3 className="text-2xl md:text-4xl font-black text-white mb-2 leading-tight group-hover:text-purple-300 transition-colors">{currentFullBanner.title}</h3>
                          <p className="text-zinc-300 text-xs md:text-base line-clamp-2 md:line-clamp-3">{currentFullBanner.description}</p>
                        </div>
                        <span className="inline-flex items-center justify-center gap-2 bg-[#ccff00] text-black px-6 py-3.5 md:px-8 md:py-4 rounded-2xl text-xs font-black uppercase tracking-widest group-hover:bg-white transition-colors shrink-0 shadow-xl">
                          Μαθε Περισσοτερα <ExternalLink size={16} />
                        </span>
                      </div>
                    </TrackableAdWrapper>
                  </div>
                )}

                {/* 🟢 SQUARE BANNER INJECTION */}
                {showAd && currentBanner && (
                   viewMode === 'grid' ? <SquareAdCard banner={currentBanner} /> : (
                    <TrackableAdWrapper 
                      banner={currentBanner} 
                      className="flex items-center gap-4 p-3 bg-purple-900/10 border border-purple-500/20 rounded-2xl cursor-pointer hover:bg-purple-900/20 transition-all"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-black">
                        <img src={currentBanner.squareImageUrl || currentBanner.imageUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-purple-400 text-sm">{currentBanner.title}</h3>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Sponsored Content</p>
                      </div>
                      <ExternalLink size={16} className="text-purple-500 mr-2" />
                    </TrackableAdWrapper>
                  )
                )}

                {/* 🟢 ΚΑΝΟΝΙΚΟΣ ΣΤΑΘΜΟΣ */}
                {viewMode === 'grid' ? (
                  <div className="group flex flex-col relative cursor-pointer h-full"
                    onClick={() => isCurrentlyPlaying ? navigate(`/station/${station.slug || station._id}`) : setCurrentStation(station)}
                  >
                    <div className="relative aspect-square w-full rounded-2xl md:rounded-3xl overflow-hidden bg-white shadow-lg border border-[#000000] transition-all duration-500 group-hover:-translate-y-1 group-hover:border-[#ccff0088]">
                      <img src={station.logo} alt={station.name} className="w-full h-full object-contain bg-white transition-transform duration-700 group-hover:scale-105" />
                      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                      <div className={`absolute transition-all duration-500 z-20 ${isCurrentlyPlaying ? 'inset-0 flex items-center justify-center md:inset-auto md:bottom-4 md:right-4 md:w-12 md:h-12' : 'bottom-2 right-2 md:bottom-4 md:right-4 w-9 h-9 md:w-12 md:h-12 opacity-0 group-hover:opacity-100'}`}>
                        {isCurrentlyPlaying && <div className="absolute inset-0 scale-[1.2] z-0"><CircularVU analyser={analyser} isPlaying={isCurrentlyPlaying} /></div>}
                        <button onClick={(e) => { e.stopPropagation(); if (isCurrent) onPlayPause(); else setCurrentStation(station); }} className={`relative z-10 bg-[#ccff00] rounded-full flex items-center justify-center shadow-xl text-black ${isCurrentlyPlaying ? 'w-14 h-14 md:w-full md:h-full' : 'w-full h-full'}`}>
                          {isCurrentlyPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} className="ml-0.5" fill="currentColor" />}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 md:mt-4 px-1">
                      <h3 className={`font-bold text-[14px] md:text-[18px] truncate transition-colors ${isCurrentlyPlaying ? 'text-[#ccff00]' : 'text-white'}`}>
                        {station.name}{station.boostStatus && (<Zap size={14} className="inline ml-2 text-black bg-[#ccff00] rounded-full p-0.5 mb-0.5" />)}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {station.transmissionType && station.transmissionType !== 'Web Radio' && (
                           <span className={`shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                             station.transmissionType === 'Επίγειο' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                           }`}>
                             <SignalHigh size={8} /> {station.transmissionType === 'Επίγειο' && station.frequency ? station.frequency : station.transmissionType}
                           </span>
                        )}
                        <span className="text-[9px] md:text-[12px] text-zinc-500 font-black tracking-widest truncate">{station.city || station.region}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => isCurrentlyPlaying ? navigate(`/station/${station.slug || station._id}`) : setCurrentStation(station)} className="flex items-center justify-between p-3 md:p-4 bg-zinc-900/40 border border-white/5 rounded-2xl hover:bg-zinc-900/80 transition-all cursor-pointer group">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative bg-white border border-white/10 shadow-lg"><img src={station.logo} alt={station.name} className="w-full h-full object-contain bg-white" /></div>
                      <div className="min-w-0">
                        <h3 className={`font-bold text-base md:text-lg truncate ${isCurrentlyPlaying ? 'text-[#ccff00]' : 'text-white'}`}>{station.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {station.transmissionType && station.transmissionType !== 'Web Radio' && (
                             <span className={`shrink-0 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                               station.transmissionType === 'Επίγειο' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                             }`}>
                               <SignalHigh size={8} /> {station.transmissionType === 'Επίγειο' && station.frequency ? station.frequency : station.transmissionType}
                             </span>
                          )}
                          <p className="text-[10px] text-zinc-500 font-black tracking-widest uppercase truncate">{station.city || station.region}</p>
                        </div>
                      </div>
                    </div>
                    {isCurrentlyPlaying && (
                      <div className="flex items-center gap-1 shrink-0 px-4">
                        <div className="w-1 h-4 bg-[#ccff00] animate-[bounce_1s_infinite]"></div>
                        <div className="w-1 h-5 bg-[#ccff00] animate-[bounce_1s_infinite_0.4s]"></div>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="text-zinc-500 font-bold italic py-20 text-center w-full bg-zinc-900/20 rounded-[32px] border border-white/5">Δεν βρέθηκαν σταθμοί με αυτά τα κριτήρια.</div>
      )}
    </div>
  );
}
