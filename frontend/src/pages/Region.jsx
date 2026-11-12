import React, { useState, useMemo, useEffect } from 'react';
import DynamicAdCreative from '../components/DynamicAdCreative';
import {geoAllowsAd} from '../utils/adPlacements';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, LayoutGrid, List, Map as MapIcon, Globe, Megaphone, ExternalLink } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import RadioGeoMap from '../components/RadioGeoMap';
import EditorialPlacement from '../components/EditorialPlacement';
import CatalogFilterPopover from '../components/CatalogFilterPopover';
import StationCatalogCard from '../components/StationCatalogCard';
import useCatalogNowPlaying from '../hooks/useCatalogNowPlaying';
import {stationMatchesRegion} from '../utils/stationRegions';
import {sortCatalogStations} from '../utils/catalogLive';
import {buildSponsoredCatalog,sponsoredGridColumns,withoutPaidBoostRank,restoreSortedStations} from '../utils/sponsoredCatalog';
 

export default function Region({ stations, currentStation, setCurrentStation, isPlaying, onPlayPause, analyser, currentUser, userLocation, checkGeoMatch }) {
  const { regionName } = useParams();
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState('grid');
  const [viewportWidth,setViewportWidth]=useState(()=>typeof window==='undefined'?1024:window.innerWidth);
  const [sponsorClock,setSponsorClock]=useState(()=>Date.now());
  useEffect(()=>{
    const timer=setInterval(()=>setSponsorClock(Date.now()),30000);
    return()=>clearInterval(timer);
  },[]);
  useEffect(()=>{
    const resize=()=>setViewportWidth(window.innerWidth);
    window.addEventListener('resize',resize,{passive:true});
    return()=>window.removeEventListener('resize',resize);
  },[]);
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
        .then(data => setActiveBanners((Array.isArray(data)?data:[]).filter(banner =>
          banner.status==='active'&&
          (!banner.expiresAt||new Date(banner.expiresAt)>new Date())&&
          geoAllowsAd(banner.targetLocations,userLocation,checkGeoMatch))))
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
    return activeBanners.filter(b => b.placement && b.placement.includes('radio_feed'));
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

    return restoreSortedStations(sortCatalogStations(result.map(withoutPaidBoostRank),
      catalogNowPlaying,catalogClock,sortBy,'region',regionName),result);
  }, [baseStations, selectedGenre, selectedTransmission, sortBy, catalogNowPlaying, catalogClock, regionName]);

  const formatGenre = (text) => text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  // Όλα τα region pages έχουν map view. Χωρίς γεωγραφικό σημείο δείχνουμε ξεχωριστή λίστα.
  const canShowMap = Boolean(regionName);

  const displayStations=useMemo(()=>viewMode!=='map' && promotedStationId
    ? filteredAndSorted.filter(s=>String(s._id)!==String(promotedStationId))
    : filteredAndSorted,[filteredAndSorted,viewMode,promotedStationId]);

  const sponsoredEntries=useMemo(()=>buildSponsoredCatalog({
    organic:displayStations,
    // Promoted is a separate editorial placement, not a disqualification
    // from an independently purchased Sponsored impression.
    allStations:stations,
    scope:'region',value:regionName,mode:viewMode,
    columns:sponsoredGridColumns(viewportWidth),now:sponsorClock,
    categoryFilter:selectedGenre,transmissionFilter:selectedTransmission
  }),[displayStations,stations,promotedStationId,regionName,viewMode,viewportWidth,sponsorClock,
    selectedGenre,selectedTransmission]);

  const handleBannerView = async (bannerId) => {
    try { await fetch(`/api/banners/${bannerId}/impression`, { method: 'POST' }); } catch (e) {}
  };

  // Stable wrapper prevents impressions on unrelated station/player renders.
  const SquareAdCard = ({banner,variant='card',slotKey=''}) => (
    <DynamicAdCreative banner={banner} placement="radio_feed" variant={variant} slotKey={slotKey}/>
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
        currentUser={currentUser} stations={stations}
        currentStation={currentStation} isPlaying={isPlaying}
        onPlayStation={setCurrentStation} onPlayPause={onPlayPause} />

      {viewMode !== 'map' && sponsoredEntries.length > 0 && (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 md:gap-5" : "flex w-full min-w-0 flex-col gap-3"}>
          {sponsoredEntries.map(({station,sponsored}, index) => {
            const isCurrent = currentStation && (currentStation._id === station._id);
            const isCurrentlyPlaying = isCurrent && isPlaying;
            
            // 🟢 ΤΑ ΜΙΚΡΑ (SQUARE) BANNERS
            const showAd = isFreeOrGuest && index > 0 && index % 5 === 0 && radioFeedBanners.length > 0;
            const currentBanner = showAd ? radioFeedBanners[Math.floor(index / 5) % radioFeedBanners.length] : null;

            // 🔥 ΤΑ ΜΕΓΑΛΑ (FULL WIDTH) BANNERS - Κάθε 12 σταθμούς στο GRID view

            return (
              <React.Fragment key={station._id}>
                
                {/* 🟢 SQUARE BANNER INJECTION */}
                {showAd && currentBanner &&
                  <SquareAdCard banner={currentBanner} variant={viewMode==='grid'?'card':'list'}
                    slotKey={`catalog-${index}`} />
                }

                {/* Shared premium station card; profile navigation is separate from live playback. */}
                <StationCatalogCard station={station} currentStation={currentStation} isPlaying={isPlaying}
                  onPlayStation={setCurrentStation} onPlayPause={onPlayPause} mode={viewMode}
                  sponsored={sponsored}
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

      {sponsoredEntries.length === 0 && (
        <div className="text-zinc-500 font-bold italic py-20 text-center w-full bg-zinc-900/20 rounded-[32px] border border-white/5 mt-4">Δεν βρέθηκαν σταθμοί με αυτά τα κριτήρια.</div>
      )}


    </div>
  );
}
