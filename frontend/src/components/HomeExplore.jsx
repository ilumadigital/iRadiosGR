import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StationCatalogCard from './StationCatalogCard';
import EditorialPlacement from './EditorialPlacement';
import {PRIMARY_CATEGORY_GROUPS} from '../utils/stationCategories';
import {catalogStationInfo,compareCatalogPopularity,compareCatalogCompleteness} from '../utils/catalogLive';
import {
  Search, SlidersHorizontal, Radio, Heart, History, Sparkles, ChevronRight,
  Play, MapPin, X, Headphones, Disc3, Music2, Grid2X2, MapPinned
} from 'lucide-react';

const normalize = s => String(s || '').toLocaleLowerCase('el-GR');
const unique = list => [...new Set(list.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'));
const gradients = [
  'from-[#812e70] via-[#4a2145] to-[#11151d]',
  'from-[#966337] via-[#573c24] to-[#11151d]',
  'from-[#4643a5] via-[#252963] to-[#11151d]',
  'from-[#7b344f] via-[#472139] to-[#11151d]',
  'from-[#446f83] via-[#203f54] to-[#11151d]',
  'from-[#777431] via-[#434322] to-[#11151d]',
  'from-[#366d68] via-[#224744] to-[#11151d]',
  'from-[#784755] via-[#392531] to-[#11151d]'
];
const tabs=[
  {id:'for-you',label:'Για σένα',Icon:Sparkles},
  {id:'top',label:'Top σταθμοί',Icon:Radio},
  {id:'recent',label:'Πρόσφατα',Icon:History},
  {id:'favorites',label:'Αγαπημένα',Icon:Heart},
  {id:'all',label:'Όλοι',Icon:Grid2X2}
];

export default function HomeExplore({stations=[], currentUser, recentStations=[], favoriteStations=[], currentStation, isPlaying, onPlayStation, onPlayPause, onOpenDiscovery, catalogNowPlaying={}, catalogClock}) {
  const navigate=useNavigate();
  const location=useLocation();
  const [tab,setTab]=useState('for-you');
  const [query,setQuery]=useState('');
  const [genre,setGenre]=useState('');
  const [region,setRegion]=useState('');
  const [showAll,setShowAll]=useState(false);
  const [showRegions,setShowRegions]=useState(false);
  const [regionSearch,setRegionSearch]=useState('');
  const [editorialTiles,setEditorialTiles]=useState({genre:[],region:[]});
  useEffect(()=>{
    const controller=new AbortController();
    Promise.all(['genre','region'].map(placement=>
      fetch('/api/home-slides?'+new URLSearchParams({placement,tiles:'1'}),{signal:controller.signal})
        .then(r=>r.ok?r.json():[])
        .catch(()=>[])
    )).then(([genres,regions])=>{
      if(!controller.signal.aborted)setEditorialTiles({
        genre:Array.isArray(genres)?genres:[],region:Array.isArray(regions)?regions:[]
      });
    });
    return ()=>controller.abort();
  },[]);
  const canSeeSlide=slide=>slide.audience==='all'||!slide.audience||
    (slide.audience==='guest'&&!currentUser)||
    (slide.audience==='member'&&Boolean(currentUser))||
    (slide.audience==='premium'&&Boolean(currentUser&&(currentUser.isPremium||currentUser.role==='admin'||currentUser?.broadcasterProfile?.tier==='premium')));
  const genreSlideFor=name=>editorialTiles.genre.find(s=>s.placementValue===name&&canSeeSlide(s));
  const regionSlideFor=name=>editorialTiles.region.find(s=>s.placementValue===name&&canSeeSlide(s));
  const regionList=useMemo(()=>unique(stations.map(x=>x.region)),[stations]);

  // Sidebar shortcuts open this exact visual finder without introducing dropdowns/routes.
  useEffect(()=>{
    const target=new URLSearchParams(location.search).get('explore');
    if(!target||target==='playlist')return;
    if(['for-you','top','recent','favorites','all'].includes(target))setTab(target);
    if(target==='categories'){setGenre('');setTab('all');}
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
    if(genre)result=result.filter(s=>s.genre===genre);
    if(region)result=result.filter(s=>s.region===region);
    if(query.trim()){
      const q=normalize(query.trim());
      result=result.filter(s=>[s.name,s.genre,s.secondaryGenre,s.region,s.city,s.slogan].some(t=>normalize(t).includes(q)));
    }
    return result;
  },[eligible,tab,genre,region,query,favIds,recentIds,prefGenres,catalogNowPlaying,catalogClock]);
  const displayed=showAll?filtered.slice(0,48):filtered.slice(0,12);
  const clear=()=>{setGenre('');setRegion('');setQuery('');};
  return (
    <section id="station-explorer" className="ir-discovery-shell scroll-mt-24 space-y-5 rounded-[28px] border border-white/10 bg-gradient-to-b from-[#141a20]/95 to-[#0b1014]/95 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#ccff00]"><SlidersHorizontal size={15}/> Ανακάλυψη</p>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Βρες τον δικό σου ήχο</h2>
          <p className="mt-1 text-sm text-zinc-400">Σταθμοί, είδη και περιοχές. Χωρίς περιττά dropdown.</p>
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

      <div id="home-categories" className="scroll-mt-24 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-black text-white"><Disc3 size={20} className="text-[#ccff00]"/> Κατηγορίες</h3>
          <button type="button" onClick={()=>{setGenre('');setTab('all');}} className="text-xs font-semibold text-[#ccff00]">Όλα τα είδη <ChevronRight size={14} className="inline"/></button>
        </div>
        {PRIMARY_CATEGORY_GROUPS.map((group,groupIndex)=><section key={group.label} aria-label={group.label}>
          <h4 className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-zinc-400">{group.label}</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {group.items.map((g,i)=>{
              const count=eligible.filter(station=>station.genre===g).length;
              const slide=genreSlideFor(g);
              return <button type="button" key={g} aria-pressed={genre===g} onClick={()=>{setGenre(genre===g?'':g);setTab('all');setShowAll(false);}}
                className={`ir-genre-tile relative flex aspect-[1.3] min-h-[104px] flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br p-3 text-left transition-all hover:-translate-y-0.5 ${gradients[(i+groupIndex*5)%gradients.length]} ${genre===g?'border-[#ccff00] ring-1 ring-[#ccff00]':'border-white/15 hover:border-white/40'}`}>
                {slide?.imageUrl&&<>
                  <img src={slide.imageUrl} alt="" loading="lazy" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-65"/>
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10"/>
                </>}
                <Music2 size={21} className="relative z-10 text-white/90"/>
                <span className="relative z-10"><span className="block line-clamp-2 text-xs font-black leading-snug text-white">{g}</span><span className="mt-1 block text-[10px] text-zinc-300">{count} σταθμοί</span></span>
                <span aria-hidden="true" className="absolute -bottom-6 -right-3 h-20 w-20 rounded-full border-[14px] border-white/10"/>
              </button>;
            })}
          </div>
        </section>)}
      </div>

      {editorialTiles.region.some(s=>canSeeSlide(s)&&regionList.includes(s.placementValue))&&
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {editorialTiles.region.filter((s,i,a)=>canSeeSlide(s)&&regionList.includes(s.placementValue)&&a.findIndex(x=>x.placementValue===s.placementValue)===i).slice(0,3).map(slide=>
            <button type="button" key={slide._id} onClick={()=>{setRegion(slide.placementValue);setShowRegions(true);setTab('all');setShowAll(false);}}
              className={`group relative min-h-28 overflow-hidden rounded-2xl border text-left transition-colors ${region===slide.placementValue?'border-[#ccff00]':'border-white/10 hover:border-[#ccff00]/40'}`}>
              <img src={slide.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-70 transition-transform group-hover:scale-105"/>
              <span className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent"/>
              <span className="relative z-10 flex h-full flex-col justify-end p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#ccff00]">Προτεινόμενη περιοχή</span>
                <span className="mt-1 text-sm font-black text-white">{slide.placementValue}</span>
              </span>
            </button>
          )}
        </div>}

      <div>
        <button type="button" onClick={()=>setShowRegions(v=>!v)} aria-expanded={showRegions}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-xs font-bold ${showRegions?'border-[#ccff00]/50 bg-[#ccff00]/10 text-[#ccff00]':'border-white/15 bg-white/5 text-zinc-300'}`}>
          <MapPinned size={16}/> {region||'Περιοχές'} <ChevronRight size={14} className={showRegions?'rotate-90 transition-transform':'transition-transform'}/>
        </button>
        {showRegions&&<div className="mt-3 rounded-2xl border border-white/10 bg-[#080d12] p-3" aria-label="Επιλογή περιοχής">
          <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 focus-within:border-[#ccff00]/50">
            <Search size={16} className="text-zinc-400"/>
            <span className="sr-only">Αναζήτηση περιοχής</span>
            <input type="search" placeholder="Βρες περιοχή…" value={regionSearch} onChange={e=>setRegionSearch(e.target.value)}
              className="min-h-10 w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"/>
          </label>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          <button type="button" aria-pressed={!region} onClick={()=>setRegion('')}
            className={`rounded-full border px-3 py-2 text-xs font-semibold ${!region?'border-[#ccff00] bg-[#ccff00] text-black':'border-white/15 text-zinc-300'}`}>Όλες</button>
          {regionList.filter(r=>normalize(r).includes(normalize(regionSearch))).map(r=><button type="button" key={r} aria-pressed={region===r} onClick={()=>{setRegion(region===r?'':r);setShowAll(false);}}
            className={`rounded-full border px-3 py-2 text-xs font-semibold ${region===r?'border-[#ccff00] bg-[#ccff00] text-black':'border-white/15 text-zinc-300 hover:border-[#ccff00]/40'}`}>{r}</button>)}
          </div>
        </div>}
      </div>

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
