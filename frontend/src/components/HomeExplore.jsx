import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import StationCatalogCard from './StationCatalogCard';
import CatalogFilterPopover from './CatalogFilterPopover';
import EditorialPlacement from './EditorialPlacement';
import {PRIMARY_CATEGORY_GROUPS} from '../utils/stationCategories';
import {catalogStationInfo,compareCatalogPopularity,compareCatalogCompleteness,applyPostBoostLift} from '../utils/catalogLive';
import {
  Search, SlidersHorizontal, Radio, Heart, History, Sparkles, ChevronRight,
  X, Headphones, Grid2X2, MapPinned
} from 'lucide-react';

const normalize = s => String(s || '').toLocaleLowerCase('el-GR');
const unique = list => [...new Set(list.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'));
const tabs=[
  {id:'for-you',label:'Για σένα',Icon:Sparkles},
  {id:'top',label:'Top σταθμοί',Icon:Radio},
  {id:'recent',label:'Πρόσφατα',Icon:History},
  {id:'favorites',label:'Αγαπημένα',Icon:Heart},
  {id:'all',label:'Όλοι',Icon:Grid2X2}
];

export default function HomeExplore({stations=[], currentUser, recentStations=[], favoriteStations=[], currentStation, isPlaying, onPlayStation, onPlayPause, onOpenDiscovery, catalogNowPlaying={}, catalogClock}) {
  const location=useLocation();
  const [tab,setTab]=useState('for-you');
  const [query,setQuery]=useState('');
  const [genre,setGenre]=useState('');
  const [region,setRegion]=useState('');
  const [showAll,setShowAll]=useState(false);
  const [showRegions,setShowRegions]=useState(false);
  const [regionSlides,setRegionSlides]=useState([]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/home-slides?'+new URLSearchParams({placement:'region',tiles:'1'}),{signal:controller.signal})
      .then(response=>response.ok?response.json():[])
      .then(data=>{
        if(!controller.signal.aborted)setRegionSlides(Array.isArray(data)?data:[]);
      })
      .catch(()=>{});
    return ()=>controller.abort();
  },[]);
  const canSeeSlide=slide=>slide.audience==='all'||!slide.audience||
    (slide.audience==='guest'&&!currentUser)||
    (slide.audience==='member'&&Boolean(currentUser))||
    (slide.audience==='premium'&&Boolean(currentUser&&(currentUser.isPremium||currentUser.role==='admin'||currentUser?.broadcasterProfile?.tier==='premium')));
  const regionList=useMemo(()=>unique(stations.map(x=>x.region)),[stations]);

  // Sidebar shortcuts open the requested discovery tab or the separate category links.
  useEffect(()=>{
    const target=new URLSearchParams(location.search).get('explore');
    if(!target||target==='playlist')return;
    if(['for-you','top','recent','favorites','all'].includes(target))setTab(target);
    if(target==='categories'){
      document.getElementById('home-categories')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(target==='regions'){setShowRegions(true);setTab('all');}
    setShowAll(false);
    document.getElementById('station-explorer')?.scrollIntoView({behavior:'smooth',block:'start'});
  },[location.search]);

  const favIds=useMemo(()=>new Set(favoriteStations.map(x=>String(x._id))),[favoriteStations]);
  const recentIds=useMemo(()=>new Set(recentStations.map(x=>String(x._id))),[recentStations]);
  const prefGenres=useMemo(()=>new Set([...favoriteStations,...recentStations].map(x=>x.genre).filter(Boolean)),[favoriteStations,recentStations]);
  const eligible=useMemo(()=>stations.filter(s=>s._id && (s.status==='approved'||!s.status)),[stations]);
  const filtered=useMemo(()=>{
    let result=eligible;
    if(tab==='favorites')result=result.filter(s=>favIds.has(String(s._id)));
    if(tab==='recent')result=result.filter(s=>recentIds.has(String(s._id)));
    // Strict metadata/programme tiers across discovery tabs; personal preference
    // only reorders stations WITHIN the same quality tier.
    const personalized=station=>
      Number(prefGenres.has(station.genre))*20+
      Number(favIds.has(String(station._id)))*15+
      Number(station.isFeatured)*7+Number(station.plays||0)/10000;
    result=[...result].sort((a,b)=>{
      const offline=Number(a.isOffline===true)-Number(b.isOffline===true);
      if(offline)return offline;
      if(tab==='for-you'){
        const aTier=catalogStationInfo(a,catalogNowPlaying[String(a._id)],catalogClock).tier;
        const bTier=catalogStationInfo(b,catalogNowPlaying[String(b._id)],catalogClock).tier;
        if(aTier!==bTier)return compareCatalogCompleteness(a,b,catalogNowPlaying,catalogClock);
        const preference=personalized(b)-personalized(a);
        if(preference)return preference;
      }
      return compareCatalogPopularity(a,b);
    });
    if(tab!=='for-you')result=applyPostBoostLift(result,'global');
    if(genre)result=result.filter(s=>s.genre===genre||s.secondaryGenre===genre);
    if(region)result=result.filter(s=>s.region===region);
    if(query.trim()){
      const q=normalize(query.trim());
      result=result.filter(s=>[s.name,s.genre,s.secondaryGenre,s.region,s.city,s.slogan].some(t=>normalize(t).includes(q)));
    }
    return result;
  },[eligible,tab,genre,region,query,favIds,recentIds,prefGenres,catalogNowPlaying,catalogClock]);
  const displayed=showAll?filtered.slice(0,48):filtered.slice(0,12);
  const clear=()=>{setGenre('');setRegion('');setQuery('');setShowAll(false);};
  return (
    <section id="station-explorer" className="ir-discovery-shell scroll-mt-24 space-y-5 rounded-[28px] border border-white/10 bg-gradient-to-b from-[#141a20]/95 to-[#0b1014]/95 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#ccff00]"><SlidersHorizontal size={15}/> Ανακάλυψη</p>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Βρες τον δικό σου ήχο</h2>
          <p className="mt-1 text-sm text-zinc-400">Βρες σταθμούς με αναζήτηση και διακριτικά φίλτρα.</p>
        </div>
        <button type="button" onClick={onOpenDiscovery} className="flex min-h-11 items-center gap-2 rounded-full border border-[#ccff00]/30 bg-[#ccff00]/10 px-4 text-xs font-bold text-[#ccff00] hover:bg-[#ccff00]/20">
          <Headphones size={16}/> Γρήγορη ανακάλυψη <ChevronRight size={15}/>
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Συλλογές σταθμών">
        {tabs.map(({id,label,Icon})=><button key={id} type="button" role="tab" aria-selected={tab===id}
          onClick={()=>{setTab(id);setShowAll(false);}}
          className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-bold transition-colors ${tab===id?'border-[#ccff00] bg-[#ccff00] text-black':'border-white/10 bg-white/5 text-zinc-300 hover:border-[#ccff00]/50'}`}>
          <Icon size={15}/>{label}
        </button>)}
      </div>

      <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/15 bg-[#080d12] px-4 text-zinc-400 focus-within:border-[#ccff00]/60">
        <Search size={19} className="shrink-0"/><span className="sr-only">Αναζήτηση ραδιοφωνικών σταθμών</span>
        <input type="search" value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false);}}
          placeholder="Αναζήτηση σταθμού, μουσικής ή περιοχής…"
          className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-500"/>
        {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Καθαρισμός αναζήτησης" className="rounded-full p-2 hover:bg-white/10"><X size={16}/></button>}
      </label>

      {/* Compact discovery filters: category tiles now navigate directly to /genre/:genreName above the deck. */}
      <div className="flex flex-wrap items-center gap-2" aria-label="Φίλτρα σταθμών">
        <CatalogFilterPopover label="Κατηγορία" value={genre||'all'}
          onChange={next=>{setGenre(next==='all'?'':next);setShowAll(false);}}
          options={PRIMARY_CATEGORY_GROUPS.flatMap(group=>group.items)}
          allLabel="Όλες οι κατηγορίες"/>
        <CatalogFilterPopover label="Περιοχή" value={region||'all'}
          onChange={next=>{setRegion(next==='all'?'':next);setShowAll(false);}}
          options={regionList} allLabel="Όλες οι περιοχές"/>
      </div>

      {/* Editorial region tiles remain available, but do not push the results down by default. */}
      {regionSlides.some(slide=>canSeeSlide(slide)&&regionList.includes(slide.placementValue))&&
        <div>
          <button type="button" onClick={()=>setShowRegions(open=>!open)}
            aria-expanded={showRegions}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-[#ccff00]">
            <MapPinned size={15}/> Προτεινόμενες περιοχές
            <ChevronRight size={15} className={showRegions?'rotate-90 transition-transform':'transition-transform'}/>
          </button>
          {showRegions&&
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {regionSlides.filter((slide,index,all)=>canSeeSlide(slide)&&regionList.includes(slide.placementValue)&&
                all.findIndex(other=>other.placementValue===slide.placementValue)===index).slice(0,3).map(slide=>
                <button type="button" key={slide._id+':'+slide.placementValue}
                  onClick={()=>{setRegion(slide.placementValue);setTab('all');setShowAll(false);}}
                  className={`group relative aspect-[40/21] min-w-0 overflow-hidden rounded-2xl border bg-[#101419] text-left transition-colors ${region===slide.placementValue?'border-[#ccff00]':'border-white/10 hover:border-[#ccff00]/40'}`}>
                  <img src={slide.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain opacity-90"/>
                  <span className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-black/10"/>
                  <span className="relative z-10 flex h-full flex-col justify-end p-3 sm:p-4">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#ccff00]">Συμβαίνει τώρα στην περιοχή</span>
                    <span className="mt-1 text-sm font-black text-white">{slide.placementValue}</span>
                  </span>
                </button>
              )}
            </div>}
        </div>}

      {genre&&<EditorialPlacement placement="genre" value={genre} currentUser={currentUser} stations={stations}
        currentStation={currentStation} isPlaying={isPlaying} onPlayStation={onPlayStation} onPlayPause={onPlayPause}/>}
      {region&&<EditorialPlacement placement="region" value={region} currentUser={currentUser} stations={stations}
        currentStation={currentStation} isPlaying={isPlaying} onPlayStation={onPlayStation} onPlayPause={onPlayPause}/>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-400">{filtered.length} διαθέσιμοι σταθμοί {tab==='for-you'&&currentUser?'· προτάσεις από τις ακροάσεις σου':''}</span>
        {(genre||region||query)&&<button onClick={clear} type="button" className="flex items-center gap-1 text-xs font-semibold text-[#ccff00]"><X size={14}/> Καθαρισμός φίλτρων</button>}
      </div>
      {!!displayed.length?<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {displayed.map(s=><StationCatalogCard key={s._id} station={s} currentStation={currentStation}
          isPlaying={isPlaying} onPlayStation={onPlayStation} onPlayPause={onPlayPause}
          nowPlaying={catalogNowPlaying[String(s._id)]} clock={catalogClock}/>)}
      </div>:<div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
        <Radio size={30} className="mx-auto text-zinc-500"/>
        <p className="mt-3 text-sm text-zinc-300">{tab==='favorites'?'Δεν έχεις προσθέσει αγαπημένους σταθμούς.':'Δεν βρέθηκαν σταθμοί με αυτά τα φίλτρα.'}</p>
        <button type="button" onClick={()=>{setTab('all');clear();}} className="mt-3 text-xs font-black text-[#ccff00]">Δες όλους τους σταθμούς</button>
      </div>}
      {!showAll&&filtered.length>displayed.length&&<button type="button" onClick={()=>setShowAll(true)}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 text-xs font-bold text-zinc-300 hover:border-[#ccff00]/40">
        Περισσότεροι σταθμοί ({filtered.length-displayed.length}) <ChevronRight size={16}/>
      </button>}
      {showAll&&filtered.length>48&&<button type="button" onClick={onOpenDiscovery} className="w-full text-center text-sm font-bold text-[#ccff00]">Περισσότερη ανακάλυψη</button>}
    </section>
  );
}
