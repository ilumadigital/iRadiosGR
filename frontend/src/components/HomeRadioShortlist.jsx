import React from 'react';
import { ArrowUpRight, Heart, History, Play, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Lightweight, factual shortlists matching the approved desktop home composition.
export default function HomeRadioShortlist({ kind='recent', stations=[], currentUser, onPlayStation }) {
  const navigate=useNavigate();
  const isFavorite=kind==='favorites';
  const title=isFavorite?'Αγαπημένα':'Πρόσφατα';
  const Icon=isFavorite?Heart:History;
  const listed=stations.slice(0,4);
  return (
    <section className="ir-home-shortlist min-w-0" aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-black text-white"><Icon size={21} className="text-[#ccff00]"/>{title}</h2>
        <button type="button" aria-label={'Περισσότερα: '+title}
          onClick={()=>isFavorite?navigate('/favorites'):navigate('/?explore=recent')}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#ccff00] hover:bg-[#ccff00]/10">
          <ArrowUpRight size={16}/>
        </button>
      </div>
      <div className="min-h-[176px] divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#12171c]/90 px-3">
        {listed.map(item=><div key={item._id} className="group flex min-w-0 items-center gap-2.5 py-2">
          <button type="button" onClick={()=>navigate('/station/'+(item.slug||item._id))}
            aria-label={'Προφίλ σταθμού '+item.name} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <img src={item.logo} alt="" loading="lazy"
              className="h-9 w-9 shrink-0 rounded-lg border border-white/10 bg-white object-contain p-1"/>
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-white">{item.name}</span>
              <span className="block truncate text-[10px] text-zinc-500">{item.genre||item.region||'Ραδιόφωνο'}</span>
            </span>
          </button>
          <button type="button" onClick={()=>onPlayStation(item)} aria-label={'Άκου '+item.name}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-zinc-200 transition-colors hover:bg-[#ccff00] hover:text-black">
            <Play size={15} fill="currentColor"/>
          </button>
        </div>)}
        {!listed.length&&<div className="flex min-h-[172px] flex-col items-center justify-center gap-2 p-4 text-center">
          <Radio className="text-zinc-600" size={25}/>
          <p className="text-xs text-zinc-400">{!currentUser&&isFavorite?'Συνδέσου για να αποθηκεύσεις αγαπημένα':isFavorite?'Πρόσθεσε σταθμούς στα αγαπημένα σου.':'Οι πρόσφατες ακροάσεις σου θα εμφανιστούν εδώ.'}</p>
          {isFavorite&&<button type="button" onClick={()=>navigate(currentUser?'/?explore=all':'/login')} className="text-xs font-bold text-[#ccff00]">{currentUser?'Βρες σταθμούς':'Σύνδεση'}</button>}
        </div>}
      </div>
    </section>
  );
}
