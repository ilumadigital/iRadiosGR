import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Radio, Heart, History, Sparkles, ChevronRight, Play, MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const normalize = s => String(s||'').toLocaleLowerCase('el-GR');
const listUnique = values=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el'));
export default function HomeExplore({stations=[], currentUser, recentStations=[], favoriteStations=[], onPlayStation, onOpenDiscovery}) {
  const navigate=useNavigate();
  const [tab,setTab]=useState('for-you');
  const [query,setQuery]=useState('');
  const [genre,setGenre]=useState('');
  const [region,setRegion]=useState('');
  const [showAll,setShowAll]=useState(false);
  const genreList=useMemo(()=>listUnique(stations.map(x=>x.genre)),[stations]);
  const regionList=useMemo(()=>listUnique(stations.map(x=>x.region)),[stations]);
  const favIds=new Set(favoriteStations.map(x=>String(x._id)));
  const recentIds=new Set(recentStations.map(x=>String(x._id)));
  const preferredGenres=new Set([...favoriteStations,...recentStations].map(x=>x.genre).filter(Boolean));
  const filtered=useMemo(()=>{
    let sorted=stations.filter(s=>s.status==='approved'||!s.status);
    if(tab==='favorites')sorted=sorted.filter(s=>favIds.has(String(s._id)));
    if(tab==='recent')sorted=sorted.filter(s=>recentIds.has(String(s._id)));
    if(tab==='for-you')sorted=[...sorted].sort((a,b)=>
      (Number(preferredGenres.has(b.genre))*20+Number(favIds.has(String(b._id)))*15+Number(b.isFeatured)*7+Number(b.plays||0)/10000)-
      (Number(preferredGenres.has(a.genre))*20+Number(favIds.has(String(a._id)))*15+Number(a.isFeatured)*7+Number(a.plays||0)/10000)
    );
    if(tab==='top')sorted=[...sorted].sort((a,b)=>(Number(b.plays||0)+Number(b.isFeatured)*100)-(Number(a.plays||0)+Number(a.isFeatured)*100));
    if(genre)sorted=sorted.filter(s=>s.genre===genre);
    if(region)sorted=sorted.filter(s=>s.region===region);
    if(query.trim()){
      const q=normalize(query.trim());
      sorted=sorted.filter(s=>[s.name,s.genre,s.region,s.city,s.slogan].some(t=>normalize(t).includes(q)));
    }
    return sorted;
  },[stations,tab,genre,region,query,preferredGenres,favIds,recentIds]);
  const displayed=showAll?filtered.slice(0,48):filtered.slice(0,12);
  const tabs=[
    {id:'for-you',label:'Για σένα',Icon:Sparkles},
    {id:'top',label:'Top σταθμοί',Icon:Radio},
    {id:'recent',label:'Πρόσφατα',Icon:History},
    {id:'favorites',label:'Αγαπημένα',Icon:Heart},
    {id:'all',label:'Όλοι',Icon:SlidersHorizontal}
  ];
  return (
    <section id="station-explorer" className="ir-explore rounded-[28px] border border-white/10 bg-zinc-950/60 p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-xs font-black uppercase tracking-widest text-[#ccff00]">ΑΝΑΚΑΛΥΨΗ ΣΤΑΘΜΩΝ</p>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Βρες αυτό που θέλεις να ακούσεις</h2>
          <p className="mt-1 text-sm text-zinc-400">Φίλτραρε πραγματικούς σταθμούς ανά είδος, περιοχή ή προτιμήσεις.</p>
        </div>
        <button onClick={onOpenDiscovery} className="flex items-center gap-1 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-200 hover:text-[#ccff00]">
          Ανακάλυψη με swipe <ChevronRight size={16}/>
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-3" role="tablist" aria-label="Προτάσεις ραδιοφωνικών σταθμών">
        {tabs.map(({id,label,Icon})=><button type="button" key={id} role="tab" aria-selected={tab===id} onClick={()=>{setTab(id);setShowAll(false);}}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold transition-colors ${tab===id?'border-[#ccff00] bg-[#ccff00] text-black':'border-white/10 bg-white/5 text-zinc-300 hover:border-[#ccff00]/40'}`}>
          <Icon size={15}/>{label}
        </button>)}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(150px,0.28fr)_minmax(150px,0.28fr)]">
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/15 bg-black/40 px-3 text-zinc-400 focus-within:border-[#ccff00]/60">
          <Search size={19}/><span className="sr-only">Αναζήτηση σταθμών</span>
          <input type="search" value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false);}} placeholder="Σταθμός, μουσική, πόλη…" className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-zinc-500"/>
        </label>
        <label className="sr-only" htmlFor="ir-filter-genre">Μουσικό είδος</label>
        <select id="ir-filter-genre" value={genre} onChange={e=>{setGenre(e.target.value);setShowAll(false);}}
          className="min-h-11 rounded-xl border border-white/15 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-[#ccff00]/60">
          <option value="">Όλα τα είδη</option>{genreList.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        <label className="sr-only" htmlFor="ir-filter-region">Περιοχή</label>
        <select id="ir-filter-region" value={region} onChange={e=>{setRegion(e.target.value);setShowAll(false);}}
          className="min-h-11 rounded-xl border border-white/15 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-[#ccff00]/60">
          <option value="">Όλες οι περιοχές</option>{regionList.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      {genreList.length>0&&<div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {genreList.slice(0,9).map(g=><button type="button" key={g} onClick={()=>{setGenre(genre===g?'':g);setShowAll(false);}}
          className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold ${genre===g?'border-[#ccff00]/70 bg-[#ccff00]/10 text-[#ccff00]':'border-white/10 bg-white/5 text-zinc-400 hover:text-white'}`}>{g}</button>)}
        <button onClick={()=>{setGenre('');setTab('all');}} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">Όλες οι κατηγορίες</button>
      </div>}
      <div className="mb-4 mt-5 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-400">{filtered.length} σταθμοί{tab==='for-you'&&currentUser?' · βάσει ακροάσεων και αγαπημένων':''}</span>
        {(genre||region||query)&&<button type="button" onClick={()=>{setGenre('');setRegion('');setQuery('');}} className="flex items-center gap-1 text-xs text-zinc-300 hover:text-[#ccff00]"><X size={13}/> Καθαρισμός φίλτρων</button>}
      </div>
      {displayed.length?(
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {displayed.map(s=><div key={s._id} className="group min-w-0 rounded-2xl border border-white/10 bg-[#151b22] p-2.5 transition-colors hover:border-[#ccff00]/45">
            <button type="button" onClick={()=>navigate('/station/'+(s.slug||s._id))}
              aria-label={'Προφίλ '+s.name} className="block w-full text-left">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
                <img src={s.logo} alt="" loading="lazy" className="h-full w-full object-contain transition-transform group-hover:scale-105"/>
                <span className="absolute right-2 top-2 rounded-full bg-[#ccff00] px-2 py-1 text-[9px] font-black text-black">LIVE</span>
              </div>
              <h3 className="mt-2 truncate text-sm font-bold text-white">{s.name}</h3>
              <p className="mt-1 truncate text-[11px] text-zinc-400">{s.genre||'Radio'}{s.city?' · '+s.city:''}</p>
            </button>
            <button type="button" onClick={()=>onPlayStation(s)} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#ccff00]/10 text-xs font-bold text-[#ccff00] hover:bg-[#ccff00] hover:text-black">
              <Play size={14} fill="currentColor"/> Άκου τώρα
            </button>
          </div>)}
        </div>
      ):<div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-zinc-400">
        <Radio size={28} className="mx-auto mb-3"/>
        <p className="text-sm">{tab==='favorites'?'Δεν έχεις προσθέσει αγαπημένους σταθμούς.':'Δεν βρέθηκαν σταθμοί με αυτά τα φίλτρα.'}</p>
        <button type="button" onClick={()=>{setTab('all');setGenre('');setRegion('');setQuery('');}} className="mt-4 text-sm font-bold text-[#ccff00]">Εμφάνιση όλων</button>
      </div>}
      {!showAll&&filtered.length>displayed.length&&<button type="button" onClick={()=>setShowAll(true)} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-sm font-bold text-white hover:border-[#ccff00]/40">
        Περισσότεροι σταθμοί ({filtered.length-displayed.length}) <ChevronRight size={16}/>
      </button>}
      {showAll&&filtered.length>48&&<button type="button" onClick={onOpenDiscovery} className="mt-5 text-sm font-bold text-[#ccff00]">Ανακάλυψε και άλλους σταθμούς</button>}
    </section>
  );
}
