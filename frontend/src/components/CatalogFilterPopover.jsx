import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

// Accessible searchable filter popover with explicit selection, rather than native HTML selects.
export default function CatalogFilterPopover({label,value='all',options=[],onChange,allLabel='Όλα',searchable=true,includeAll=true}) {
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const shell=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const close=e=>{if(e.key==='Escape')setOpen(false);};
    const outside=e=>{if(shell.current&&!shell.current.contains(e.target))setOpen(false);};
    document.addEventListener('keydown',close);
    document.addEventListener('pointerdown',outside);
    return ()=>{document.removeEventListener('keydown',close);document.removeEventListener('pointerdown',outside);};
  },[open]);
  const choices=[...(includeAll?[{value:'all',label:allLabel}]:[]),...options.map(x=>
    typeof x==='string'?{value:x,label:x}:{value:x.value,label:x.label})];
  const chosen=choices.find(x=>x.value===value)?.label||label;
  const filtered=choices.filter(x=>x.value==='all'||x.label.toLocaleLowerCase('el').includes(query.trim().toLocaleLowerCase('el')));
  return (
    <div ref={shell} className="relative min-w-0">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={()=>{setOpen(o=>!o);setQuery('');}}
        className={`ir-catalog-filter flex min-h-11 min-w-[135px] max-w-[220px] items-center justify-between gap-3 rounded-2xl border px-4 text-left text-xs font-bold transition-colors
          ${open||value!=='all'?'border-[#ccff00]/60 bg-[#ccff00]/10 text-[#ccff00]':'border-white/15 bg-[#161d23] text-zinc-200 hover:border-white/30'}`}>
        <span className="min-w-0 truncate"><span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span><span className="block truncate">{chosen}</span></span>
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open?'rotate-180':''}`}/>
      </button>
      {open&&<div className="ir-catalog-popover absolute left-0 top-[calc(100%+8px)] z-[90] w-[min(300px,calc(100vw-32px))] rounded-2xl border border-[#ccff00]/25 bg-[#10161c] p-2 shadow-[0_20px_65px_rgba(0,0,0,.75)]">
        {searchable&&choices.length>7&&<label className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3">
          <Search size={15} className="text-zinc-500"/>
          <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={'Αναζήτηση '+label.toLowerCase()+'…'}
            className="min-h-10 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"/>
          {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Καθαρισμός φίλτρου" className="p-1 text-zinc-400"><X size={14}/></button>}
        </label>}
        <div role="listbox" aria-label={label} className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map(x=><button role="option" aria-selected={value===x.value} key={x.value} type="button"
            onClick={()=>{onChange(x.value);setOpen(false);setQuery('');}}
            className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-left text-xs font-semibold transition-colors ${value===x.value?'bg-[#ccff00]/12 text-[#ccff00]':'text-zinc-300 hover:bg-white/10 hover:text-white'}`}>
            <span className="truncate">{x.label}</span>{value===x.value&&<Check size={15} className="shrink-0"/>}
          </button>)}
          {!filtered.length&&<p className="p-3 text-xs text-zinc-500">Δεν βρέθηκαν επιλογές.</p>}
        </div>
      </div>}
    </div>
  );
}
