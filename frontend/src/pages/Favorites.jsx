import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Search, Radio, Grid2X2, List, X, ArrowUpDown, Sparkles } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import StationCatalogCard from '../components/StationCatalogCard';

const normalize = value => String(value || '').toLocaleLowerCase('el-GR');

export default function Favorites({
  stations=[], currentUser, currentStation, setCurrentStation,
  isPlaying, onPlayPause, toggleFavorite
}) {
  const [query,setQuery]=useState('');
  const [genre,setGenre]=useState('');
  const [sort,setSort]=useState('name');
  const [view,setView]=useState('grid');

  // User favorites may be stored as string IDs or populated objects.
  const favoriteIds=useMemo(()=>new Set((currentUser?.favorites||[])
    .map(item=>String(item?._id||item?.id||item)).filter(Boolean)),[currentUser?.favorites]);
  const favorites=useMemo(()=>stations.filter(station=>
    station?._id && (station.status==='approved'||!station.status) &&
    favoriteIds.has(String(station._id))),[stations,favoriteIds]);
  const genres=useMemo(()=>[...new Set(favorites.map(s=>s.genre).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'el-GR')),[favorites]);
  const visible=useMemo(()=>{
    const q=normalize(query.trim());
    const filtered=favorites.filter(s=>(!genre||s.genre===genre) &&
      (!q||[s.name,s.genre,s.city,s.region,s.frequency].some(v=>normalize(v).includes(q))));
    return [...filtered].sort((a,b)=>sort==='recent'
      ? (Number(b.plays||0)-Number(a.plays||0)||a.name.localeCompare(b.name,'el-GR'))
      : a.name.localeCompare(b.name,'el-GR'));
  },[favorites,query,genre,sort]);
  const clear=()=>{setQuery('');setGenre('');};

  return (
    <div className="ir-favorites-page mx-auto w-full max-w-[1720px] space-y-6 px-4 pb-36 pt-6 sm:px-6 lg:px-8">
      <Helmet>
        <title>Τα αγαπημένα μου | iRadiosGR</title>
        <meta name="description" content="Άκου τους αγαπημένους σου ραδιοφωνικούς σταθμούς στο iRadiosGR."/>
      </Helmet>
      <header className="relative overflow-hidden rounded-[28px] border border-[#ccff00]/15 bg-gradient-to-br from-[#20271c] via-[#131a1b] to-[#0b1015] px-5 py-7 sm:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#ccff00]/10 blur-[65px]"/>
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#ccff00]"><Sparkles size={15}/> Η μουσική σου</p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-tight text-white sm:text-4xl"><Heart className="text-[#ccff00]" fill="currentColor" size={28}/> Τα αγαπημένα μου</h1>
            <p className="mt-2 text-sm text-zinc-300">Οι σταθμοί που θέλεις να έχεις πάντα κοντά σου.</p>
          </div>
          {!!currentUser&&<span className="rounded-full border border-[#ccff00]/25 bg-[#ccff00]/10 px-4 py-2 text-xs font-black text-[#ccff00]">{favorites.length} {favorites.length===1?'σταθμός':'σταθμοί'}</span>}
        </div>
      </header>

      {!currentUser?(
        <section className="flex min-h-[270px] flex-col items-center justify-center rounded-[26px] border border-white/10 bg-[#12181d] p-8 text-center">
          <Heart size={33} className="text-[#ccff00]"/>
          <h2 className="mt-4 text-xl font-black text-white">Κράτησε τους αγαπημένους σου σταθμούς</h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-400">Συνδέσου για να έχεις τους σταθμούς σου σε ένα μέρος.</p>
          <Link to="/login" className="ir-action-primary mt-5 px-6">Σύνδεση</Link>
        </section>
      ):favorites.length===0?(
        <section className="flex min-h-[280px] flex-col items-center justify-center rounded-[26px] border border-dashed border-white/15 bg-[#11171d] p-8 text-center">
          <Heart size={33} className="text-zinc-500"/>
          <h2 className="mt-4 text-xl font-black text-white">Εδώ θα μπουν οι αγαπημένοι σου</h2>
          <p className="mt-2 max-w-sm text-sm text-zinc-400">Πάτησε την καρδιά σε έναν σταθμό για να τον βρίσκεις εύκολα.</p>
          <Link to="/?explore=all" className="ir-action-primary mt-5 px-6">Ανακάλυψε σταθμούς</Link>
        </section>
      ):(
        <>
          <section aria-label="Φίλτρα αγαπημένων" className="rounded-2xl border border-white/10 bg-[#12181d]/90 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-11 min-w-[175px] flex-1 items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-3 focus-within:border-[#ccff00]/55">
                <Search size={18} className="shrink-0 text-[#ccff00]"/>
                <span className="sr-only">Αναζήτηση αγαπημένων σταθμών</span>
                <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
                  placeholder="Αναζήτησε στα αγαπημένα σου…" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-zinc-500"/>
                {!!query&&<button type="button" onClick={()=>setQuery('')} aria-label="Καθαρισμός αναζήτησης" className="rounded-full p-1 text-zinc-400 hover:text-white"><X size={16}/></button>}
              </label>
              <button type="button" onClick={()=>setSort(v=>v==='name'?'recent':'name')} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-bold text-zinc-300 hover:border-[#ccff00]/50">
                <ArrowUpDown size={16} className="text-[#ccff00]"/>{sort==='name'?'Αλφαβητικά':'Πιο δημοφιλή'}
              </button>
              <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black/25 p-1" role="group" aria-label="Τρόπος προβολής">
                <button type="button" aria-label="Προβολή πλέγματος" aria-pressed={view==='grid'} onClick={()=>setView('grid')}
                  className={`rounded-lg p-2 ${view==='grid'?'bg-[#ccff00] text-black':'text-zinc-400 hover:text-white'}`}><Grid2X2 size={17}/></button>
                <button type="button" aria-label="Προβολή λίστας" aria-pressed={view==='list'} onClick={()=>setView('list')}
                  className={`rounded-lg p-2 ${view==='list'?'bg-[#ccff00] text-black':'text-zinc-400 hover:text-white'}`}><List size={17}/></button>
              </div>
            </div>
            {genres.length>1&&<div aria-label="Είδη μουσικής" className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {['',...genres].map(g=><button type="button" key={g||'all'} aria-pressed={genre===g} onClick={()=>setGenre(g)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${genre===g?'border-[#ccff00] bg-[#ccff00] text-black':'border-white/15 bg-white/5 text-zinc-300 hover:border-[#ccff00]/40'}`}>{g||'Όλα τα είδη'}</button>)}
            </div>}
          </section>
          <p className="text-xs text-zinc-400" role="status">{visible.length} {visible.length===1?'σταθμός':'σταθμοί'}</p>
          {visible.length?(
            <div className={view==='grid'?'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 sm:gap-5':'grid grid-cols-1 gap-3 md:grid-cols-2'}>
              {visible.map(station=><div key={station._id} className="relative min-w-0">
                <StationCatalogCard station={station} currentStation={currentStation} isPlaying={isPlaying}
                  onPlayStation={setCurrentStation} onPlayPause={onPlayPause} mode={view}/>
                {toggleFavorite&&<button type="button" onClick={()=>toggleFavorite(station._id)}
                  aria-label={'Αφαίρεση από αγαπημένα: '+station.name}
                  className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#ccff00]/35 bg-black/80 text-[#ccff00] hover:bg-[#ccff00] hover:text-black">
                  <Heart size={15} fill="currentColor"/>
                </button>}
              </div>)}
            </div>
          ):<div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <Radio className="mx-auto text-zinc-500" size={30}/>
            <p className="mt-3 text-sm text-zinc-300">Δεν βρήκαμε σταθμούς με αυτά τα φίλτρα.</p>
            <button type="button" onClick={clear} className="mt-3 text-sm font-bold text-[#ccff00]">Καθαρισμός φίλτρων</button>
          </div>}
        </>
      )}
    </div>
  );
}
