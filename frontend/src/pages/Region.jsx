import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, LayoutGrid, List, Map as MapIcon, Globe, Megaphone, ExternalLink } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import RadioGeoMap from '../components/RadioGeoMap';
import EditorialPlacement from '../components/EditorialPlacement';
import CatalogFilterPopover from '../components/CatalogFilterPopover';
import StationCatalogCard from '../components/StationCatalogCard';
import useCatalogNowPlaying from '../hooks/useCatalogNowPlaying';
import {stationMatchesRegion} from '../utils/stationRegions';
import {compareCatalogPopularity,compareCatalogStations} from '../utils/catalogLive';
 

export default function Region({ stations, currentStation, setCurrentStation, isPlaying, onPlayPause, analyser, currentUser, userLocation, checkGeoMatch }) {
  const { regionName } = useParams();
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState('grid');
  const [promotedStationId,setPromotedStationId] = useState(null);
  const {byId:catalogNowPlaying,clock:catalogClock}=useCatalogNowPlaying(currentUser);
  useEffect(()=>setPromotedStationId(null),[regionName]);
  
  const [selectedGenre, setSelectedGenre] = useState('all'); 
  const [selectedTransmission, setSelectedTransmission] = useState('all');
  
  const [activeBanners, setActiveBanners] = useState([]);

  const isPremiumUser = Boolean(
    currentUser && (
      currentUser.role === 'admin' || 
      currentUser.isPremium === true || 
      currentUser.isPremium === 'true' || 
      currentUser?.broadcasterProfile?.tier === 'premium'
    )
  );
  
  const isFreeOrGuest = !isPremiumUser;

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
        .catch(err => console.error(err));
    } else {
      setActiveBanners([]);
    }
  }, [isFreeOrGuest, userLocation, checkGeoMatch]);

  // SQUARE BANNERS (Για τα μικρά slots του grid)
  const radioFeedBanners = useMemo(() => {
    if (isPremiumUser) return []; 
    return activeBanners.filter(b => b.placement && b.placement.includes('radio_feed'));
  }, [activeBanners, isPremiumUser]);

  // 🔥 HERO BANNERS (Για τα μεγάλα full-width slots)
  const homeBanners = useMemo(() => {
    if (isPremiumUser) return []; 
    return activeBanners.filter(b => b.placement && b.placement.includes('home'));
  }, [activeBanners, isPremiumUser]);

  const baseStations = useMemo(() => stations.filter(station => stationMatchesRegion(station, regionName)), [stations, regionName]);

  const availableGenres = useMemo(() => {
    return [...new Set(baseStations.map(s => s.genre))].filter(Boolean).sort();
  }, [baseStations]);

  const availableTransmissions = useMemo(() => {
    return [...new Set(baseStations.map(s => s.transmissionType || 'Web Radio'))].filter(Boolean).sort();
  }, [baseStations]);

  const filteredAndSorted = useMemo(() => {
    let result = [...baseStations];
    
    if (selectedGenre !== 'all') result = result.filter(s => s.genre === selectedGenre);
    if (selectedTransmission !== 'all') result = result.filter(s => (s.transmissionType || 'Web Radio') === selectedTransmission);

    return result.sort((a,b)=>sortBy==='popularity'
      ? compareCatalogPopularity(a,b,catalogNowPlaying,catalogClock,'region',regionName)
      : compareCatalogStations(a,b,catalogNowPlaying,catalogClock,sortBy,'region',regionName));
  }, [baseStations, selectedGenre, selectedTransmission, sortBy, catalogNowPlaying, catalogClock, regionName]);

  const formatGenre = (text) => text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  // Όλα τα region pages έχουν map view. Χωρίς γεωγραφικό σημείο δείχνουμε ξεχωριστή λίστα.
  const canShowMap = Boolean(regionName);

  const displayStations=useMemo(()=>viewMode==='grid' && promotedStationId
    ? filteredAndSorted.filter(s=>String(s._id)!==String(promotedStationId))
    : filteredAndSorted,[filteredAndSorted,viewMode,promotedStationId]);

  const handleBannerView = async (bannerId) => {
    try { await fetch(`/api/banners/${bannerId}/impression`, { method: 'POST' }); } catch (e) {}
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
          fetch(`/api/banners/${banner._id}/click`, { method: 'POST' }).catch(err => {});
        }}
      >
        {children}
      </a>
    );
  };

  const SquareAdCard = ({ banner }) => (
    <TrackableAdWrapper banner={banner} className="group flex flex-col relative cursor-pointer h-full">
      <div className="relative aspect-square w-full rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-900 shadow-lg border border-purple-500/30 transition-all duration-500 group-hover:-translate-y-1 group-hover:border-purple-500 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
        <img src={banner.squareImageUrl || banner.imageUrl} alt={banner.title} className="w-full h-full object-contain bg-white transition-transform duration-700 group-hover:scale-105" />
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
    <div className="ir-catalog-page relative w-full animate-fade-in px-4 pb-40 pt-6 md:px-8 md:pt-9">
      
      <Helmet>
        <title>{`Ραδιόφωνα από ${regionName} | iRadios`}</title>
        <meta name="keywords" content={`iRadios, ραδιόφωνο, ${regionName}, online radio, web radio, ελληνικό ραδιόφωνο, eradio, ζωντανή μουσική, ιντερνετικό ραδιόφωνο, εραδιο, ραδιοφωνικοί σταθμοί, podcasts, λιωε24, live24, ILUMA Digital Agency`} />
        <meta name="description" content={`Ραδιόφωνα ${regionName} LIVE στο iRadios App. Όλα τα ραδιόφωνα σε μία εφαρμογή. Streaming radio από Αθήνα, Θεσσαλονίκη, Κύπρο και τα κορυφαία Greek Radios είναι εδώ.`} />
        <meta property="og:title" content={`Ραδιόφωνα ${regionName} στο iRadios App`} />
        <meta property="og:description" content={`Ακούστε Ραδιόφωνα ${regionName} LIVE. Όλα τα ραδιόφωνα σε μία εφαρμογή. Streaming radio από Αθήνα, Θεσσαλονίκη, Κύπρο και τα κορυφαία Greek Radios είναι εδώ.`} />
      </Helmet>

      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 md:mb-12 group">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
        <span className="text-[10px] font-black tracking-[0.2em] uppercase">Επιστροφη</span>
      </button>

      <div className="ir-catalog-heading mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white italic flex items-center gap-4">
            {canShowMap ? <MapPin className="text-[#ccff00]" size={36} /> : <Globe className="text-[#ccff00]" size={36} />}
            {regionName}
          </h2>
          <p className="text-[11px] md:text-sm text-zinc-500 mt-2 font-bold tracking-widest uppercase">
            {filteredAndSorted.length} Σταθμοι 
            {selectedGenre !== 'all' && ` με μουσική ${selectedGenre}`}
            {selectedTransmission !== 'all' && ` (${selectedTransmission})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <CatalogFilterPopover label="Είδος" value={selectedGenre} onChange={setSelectedGenre}
            options={availableGenres} allLabel="Όλα τα είδη"/>
          <CatalogFilterPopover label="Μετάδοση" value={selectedTransmission} onChange={setSelectedTransmission}
            options={availableTransmissions} allLabel="Όλες οι μεταδόσεις"/>
          <CatalogFilterPopover label="Ταξινόμηση" value={sortBy} onChange={setSortBy} searchable={false} includeAll={false}
            options={[{value:'popularity',label:'Δημοτικότητα'},{value:'completeness',label:'Πληρότητα'},{value:'frequency',label:'Συχνότητα'},{value:'alphabetical',label:'Αλφαβητικά'}]}/>
          <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl p-1">
            {canShowMap && (
              <button type="button" aria-label="Προβολή χάρτη" onClick={() => setViewMode('map')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'map' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><MapIcon size={16} /></button>
            )}
            <button type="button" aria-label="Προβολή πλέγματος" onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><LayoutGrid size={16} /></button>
            <button type="button" aria-label="Προβολή λίστας" onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><List size={16} /></button>
          </div>
        </div>
      </div>

      <EditorialPlacement placement="region" value={regionName} viewMode={viewMode} onPromotedStationChange={setPromotedStationId}
        currentUser={currentUser} stations={stations} fallbackStation={baseStations[0]}
        currentStation={currentStation} isPlaying={isPlaying}
        onPlayStation={setCurrentStation} onPlayPause={onPlayPause} />

      {viewMode !== 'map' && filteredAndSorted.length > 0 && (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 md:gap-5" : "flex w-full min-w-0 flex-col gap-3"}>
          {displayStations.map((station, index) => {
            const isCurrent = currentStation && (currentStation._id === station._id);
            const isCurrentlyPlaying = isCurrent && isPlaying;
            
            // 🟢 ΤΑ ΜΙΚΡΑ (SQUARE) BANNERS
            const showAd = isFreeOrGuest && index > 0 && index % 5 === 0 && radioFeedBanners.length > 0;
            const currentBanner = showAd ? radioFeedBanners[Math.floor(index / 5) % radioFeedBanners.length] : null;

            // 🔥 ΤΑ ΜΕΓΑΛΑ (FULL WIDTH) BANNERS - Κάθε 12 σταθμούς στο GRID view
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

                {/* Shared premium station card; profile navigation is separate from live playback. */}
                <StationCatalogCard station={station} currentStation={currentStation} isPlaying={isPlaying}
                  onPlayStation={setCurrentStation} onPlayPause={onPlayPause} mode={viewMode}
                  nowPlaying={catalogNowPlaying[String(station._id)]} clock={catalogClock} currentUser={currentUser} />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {viewMode === 'map' && canShowMap && (
        <RadioGeoMap
          key={regionName}
          stations={filteredAndSorted}
          nowPlayingById={catalogNowPlaying}
          catalogClock={catalogClock}
          currentUser={currentUser}
          sortMode={sortBy}
          rankingScope="region" rankingValue={regionName}
          currentStation={currentStation}
          onPlayStation={setCurrentStation}
          isPlaying={isPlaying}
          onPlayPause={onPlayPause}
          centerName={regionName}
          initialZoom={regionName === 'Κύπρος' ? 8 : 8.5}
          className="mt-4 h-[min(76dvh,760px)] min-h-[440px]"
        />
      )}

      {filteredAndSorted.length === 0 && (
        <div className="text-zinc-500 font-bold italic py-20 text-center w-full bg-zinc-900/20 rounded-[32px] border border-white/5 mt-4">Δεν βρέθηκαν σταθμοί με αυτά τα κριτήρια.</div>
      )}


    </div>
  );
}
