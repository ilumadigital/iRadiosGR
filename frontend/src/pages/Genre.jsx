import React, { useState, useMemo, useEffect } from 'react';
import DynamicAdCreative from '../components/DynamicAdCreative';
import {sparseAdMap} from '../utils/sparseAdSlots';
import {geoAllowsAd} from '../utils/adPlacements';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, ArrowLeft, Radio, LayoutGrid, List, MapPin, Zap, Megaphone, ExternalLink, SignalHigh } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import CircularVU from '../components/CircularVU';
import EditorialPlacement from '../components/EditorialPlacement';
import CatalogFilterPopover from '../components/CatalogFilterPopover';
import StationCatalogCard from '../components/StationCatalogCard';
import useCatalogNowPlaying from '../hooks/useCatalogNowPlaying';
import {sortCatalogStations} from '../utils/catalogLive';
import {buildSponsoredCatalog,sponsoredGridColumns,withoutPaidBoostRank,restoreSortedStations} from '../utils/sponsoredCatalog';


export default function Genre({ stations, currentStation, setCurrentStation, isPlaying, onPlayPause, analyser, currentUser, userLocation, checkGeoMatch }) {
  const { genreName } = useParams();
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState('grid');
  const [viewportWidth,setViewportWidth]=useState(()=>typeof window==='undefined'?1024:window.innerWidth);
  const [sponsorClock,setSponsorClock]=useState(()=>Date.now());
  const [adSeed]=useState(()=>Math.floor(Math.random()*0xFFFFFFFF));
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
  useEffect(()=>setPromotedStationId(null),[genreName]);
  
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
        .then(data => setActiveBanners((Array.isArray(data)?data:[]).filter(banner =>
          banner.status==='active'&&
          (!banner.expiresAt||new Date(banner.expiresAt)>new Date())&&
          geoAllowsAd(banner.targetLocations,userLocation,checkGeoMatch,banner.serverGeoEligible===true))))
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
    return activeBanners.filter(b => b.placement && b.placement.includes('radio_feed'));
  }, [activeBanners, isPremiumUser]);

  const baseStations = useMemo(() => stations.filter(s => s.genre === genreName || s.secondaryGenre === genreName), [stations, genreName]);

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

    return restoreSortedStations(sortCatalogStations(result.map(withoutPaidBoostRank),
      catalogNowPlaying,catalogClock,sortBy,'genre',genreName),result);
  }, [baseStations, selectedRegion, selectedTransmission, sortBy, catalogNowPlaying, catalogClock, genreName]);

  const displayStations=useMemo(()=>viewMode!=='map' && promotedStationId
    ? filteredAndSorted.filter(s=>String(s._id)!==String(promotedStationId))
    : filteredAndSorted,[filteredAndSorted,viewMode,promotedStationId]);

  const sponsoredEntries=useMemo(()=>buildSponsoredCatalog({
    organic:displayStations,
    // Promoted is a separate editorial placement, not a disqualification
    // from an independently purchased Sponsored impression.
    allStations:stations,
    scope:'genre',value:genreName,mode:viewMode,
    columns:sponsoredGridColumns(viewportWidth),now:sponsorClock,
    regionFilter: selectedRegion,
    transmissionFilter:selectedTransmission
  }),[displayStations,stations,promotedStationId,genreName,viewMode,viewportWidth,sponsorClock,
    selectedRegion,selectedTransmission]);

  const adPlacementMap=useMemo(
    ()=>sparseAdMap(sponsoredEntries.length,radioFeedBanners,adSeed),
    [sponsoredEntries.length,radioFeedBanners,adSeed]
  );

  const handleBannerView = async (bannerId) => {
    try {
      await fetch(`/api/banners/${bannerId}/impression`, { method: 'POST' });
    } catch (e) {
      console.error("View tracking failed", e);
    }
  };

  // Stable wrapper prevents impressions on unrelated station/player renders.
  const SquareAdCard = ({banner,variant='card',slotKey=''}) => (
    <DynamicAdCreative banner={banner} placement="radio_feed" variant={variant} slotKey={slotKey}/>
  );

  return (
    <div className="ir-catalog-page relative w-full animate-fade-in px-4 pb-40 pt-6 md:px-8 md:pt-9">
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

      <div className="ir-catalog-heading mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white italic flex items-center gap-4">
            <Radio className="text-[#ccff00]" size={36} /> {genreName}
          </h2>
          <p className="text-[11px] md:text-sm text-zinc-500 mt-2 font-bold tracking-widest uppercase">
            {filteredAndSorted.length} Σταθμοι {selectedRegion !== 'all' && `στην περιοχή ${selectedRegion}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <CatalogFilterPopover label="Περιοχή" value={selectedRegion} onChange={setSelectedRegion}
            options={availableRegions} allLabel="Όλες οι περιοχές"/>
          <CatalogFilterPopover label="Μετάδοση" value={selectedTransmission} onChange={setSelectedTransmission}
            options={availableTransmissions} allLabel="Όλες οι μεταδόσεις"/>
          <CatalogFilterPopover label="Ταξινόμηση" value={sortBy} onChange={setSortBy} searchable={false} includeAll={false}
            options={[{value:'popularity',label:'Δημοτικότητα'},{value:'completeness',label:'Πληρότητα'},{value:'alphabetical',label:'Αλφαβητικά'},{value:'date',label:'Νεότερα'}]}/>
          <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl p-1">
            <button type="button" aria-label="Προβολή πλέγματος" onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><LayoutGrid size={16} /></button>
            <button type="button" aria-label="Προβολή λίστας" onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><List size={16} /></button>
          </div>
        </div>
      </div>

      <EditorialPlacement placement="genre" value={genreName} viewMode={viewMode} onPromotedStationChange={setPromotedStationId}
        currentUser={currentUser} stations={stations}
        currentStation={currentStation} isPlaying={isPlaying}
        onPlayStation={setCurrentStation} onPlayPause={onPlayPause} />

      {sponsoredEntries.length > 0 ? (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 md:gap-5" : "flex w-full min-w-0 flex-col gap-3"}>
          {sponsoredEntries.map(({station,sponsored}, index) => {
            const isCurrent = currentStation && (currentStation._id === station._id);
            const isCurrentlyPlaying = isCurrent && isPlaying;

            // 🟢 ΤΑ ΜΙΚΡΑ BANNERS (Κάθε 5)
            const currentBanner=isFreeOrGuest?adPlacementMap.get(index):null;

            // 🔥 ΤΑ HERO BANNERS (Κάθε 12)

            return (
              <React.Fragment key={station._id}>
                
                {/* 🟢 SQUARE BANNER INJECTION */}
                {currentBanner &&
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
      ) : (
        <div className="text-zinc-500 font-bold italic py-20 text-center w-full bg-zinc-900/20 rounded-[32px] border border-white/5">Δεν βρέθηκαν σταθμοί με αυτά τα κριτήρια.</div>
      )}
    </div>
  );
}
