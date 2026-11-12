import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioLines, ChevronLeft, ChevronRight, Loader2, Radio } from 'lucide-react';
import { parseMusicMetadata } from '../utils/musicMetadata';
import FoundWithAI from '../components/FoundWithAI';

// ONE fast MongoDB feed replaces per-browser probing of dozens of radio URLs.
// Songs come from the 2-minute backend prefetch and existing shared AI results.
export default function PlayingNow({ stations = [], API_URL, currentUser }) {
  const navigate=useNavigate();
  const [liveStations,setLiveStations]=useState([]);
  const [aiTeasers,setAiTeasers]=useState([]);
  const [isLoading,setIsLoading]=useState(true);
  const stripRef=useRef(null);
  const displayStations=liveStations;

  useEffect(()=>{
    if(!currentUser){
      setLiveStations([]);setAiTeasers([]);setIsLoading(false);return;
    }
    const controller=new AbortController();
    let running=false,alive=true;
    const lookup=new Map(stations.filter(s=>s?._id && (s.status==='approved'||!s.status))
      .map(s=>[String(s._id),s]));
    const poll=async()=>{
      if(running||!alive||controller.signal.aborted)return;
      running=true;
      try{
        const token=localStorage.getItem('iluma_token');
        if(!token){setLiveStations([]);setAiTeasers([]);return;}
        const response=await fetch(`${API_URL}/metadata/live`,{
          headers:{Authorization:`Bearer ${token}`},signal:controller.signal
        });
        if(!response.ok)throw new Error('Music feed unavailable');
        const json=await response.json();
        const entries=Array.isArray(json?.tracks)?json.tracks:[];
        const teasers=entries.filter(entry=>entry?.premiumOnly===true)
          .map(entry=>lookup.get(String(entry.stationId||''))).filter(Boolean);
        const next=entries
          .map(entry=>{
            const station=lookup.get(String(entry.stationId||''));
            const music=parseMusicMetadata(entry.title,station?.name);
            if(!station||!music||!['station','acrcloud'].includes(entry.source)||
               (entry.expiresAt&&Date.parse(entry.expiresAt)<=Date.now()))return null;
            return {...station,music,coverArt:station.logo,
              foundWithAI:entry.source==='acrcloud'&&entry.foundWithAI===true};
          }).filter(Boolean);
        if(alive){
          setAiTeasers(teasers);
          // When the backend confirms the same song after two minutes,
          // the public card remains untouched: no re-render or cover refetch.
          setLiveStations(prev=>{
            const old=new Map(prev.map(s=>[String(s._id),s]));
            const merged=next.map(s=>{
              const p=old.get(String(s._id));
              return p&&p.music.raw===s.music.raw&&p.foundWithAI===s.foundWithAI
                ?{...s,coverArt:p.coverArt}:s;
            });
            const same=prev.length===merged.length&&prev.every((p,i)=>
              String(p._id)===String(merged[i]._id)&&
              p.music.raw===merged[i].music.raw&&
              p.foundWithAI===merged[i].foundWithAI);
            return same?prev:merged;
          });
        }
      }catch(error){
        if(error.name!=='AbortError'&&alive){setLiveStations([]);setAiTeasers([]);}
      }finally{
        if(alive)setIsLoading(false);
        running=false;
      }
    };
    poll();
    const timer=setInterval(()=>{if(!document.hidden)poll();},15000);
    return ()=>{alive=false;controller.abort();clearInterval(timer);};
  },[stations,API_URL,currentUser?._id]);

  // Artwork is optional and never delays the native/AI song display.
  useEffect(()=>{
    if(!currentUser||!liveStations.length)return;
    const controller=new AbortController();
    let alive=true;
    void Promise.all(liveStations.slice(0,8).filter(item=>item.coverArt===item.logo).map(async item=>{
      try{
        const response=await fetch(`${API_URL}/cover-art?term=${encodeURIComponent(item.music.raw)}`,
          {signal:controller.signal});
        if(!response.ok)return;
        const json=await response.json();
        if(!alive||!/^https:\/\//.test(json?.artworkUrl||''))return;
        setLiveStations(prev=>prev.map(s=>
          String(s._id)===String(item._id)&&s.music.raw===item.music.raw
            ?{...s,coverArt:json.artworkUrl}:s));
      }catch{ /* station logo is the fallback */ }
    }));
    return()=>{alive=false;controller.abort();};
  },[currentUser?._id,API_URL,
    liveStations.map(s=>s._id+':'+s.music.raw).join('|')]);

  if (!currentUser) return null;
  return (
    <section className="ir-home-now-playing min-w-0" aria-label="Τραγούδια που παίζουν τώρα στο ραδιόφωνο">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl">
            <AudioLines className="text-[#ccff00]" size={23}/> Στον αέρα τώρα
            {isLoading && <Loader2 size={16} className="animate-spin text-[#ccff00]"/>}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {(!isLoading || displayStations.length>0)&&<span className="hidden rounded-full border border-[#ccff00]/20 bg-[#ccff00]/10 px-3 py-1.5 text-[11px] font-bold text-[#ccff00] sm:inline">
            {displayStations.length} {displayStations.length===1?"σταθμός LIVE":"σταθμοί LIVE"}
          </span>}
          <button type="button" aria-label="Προηγούμενοι σταθμοί που παίζουν" disabled={!displayStations.length}
            onClick={()=>stripRef.current?.scrollBy({left:-330,behavior:'smooth'})}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-zinc-300 hover:border-[#ccff00]/40 hover:text-[#ccff00] disabled:opacity-30">
            <ChevronLeft size={17}/>
          </button>
          <button type="button" aria-label="Επόμενοι σταθμοί που παίζουν" disabled={!displayStations.length}
            onClick={()=>stripRef.current?.scrollBy({left:330,behavior:'smooth'})}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-zinc-300 hover:border-[#ccff00]/40 hover:text-[#ccff00] disabled:opacity-30">
            <ChevronRight size={17}/>
          </button>
        </div>
      </div>
      {isLoading && !displayStations.length &&
        <div className="flex gap-3 overflow-hidden" aria-label="Φόρτωση">
          {Array.from({length:5},(_,i)=><div key={i} className="h-44 w-36 shrink-0 animate-pulse rounded-2xl bg-white/5"/>)}
        </div>
      }
      {!isLoading && !displayStations.length && !aiTeasers.length &&
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center">
          <Radio size={27} className="mx-auto text-[#ccff00]/60"/>
          <p className="mt-3 text-sm text-zinc-300">Δεν έχουμε τραγούδια να σου δείξουμε αυτή τη στιγμή.</p>
          <p className="mt-1 text-xs text-zinc-500">Δοκίμασε ξανά σε λίγο ή ανακάλυψε άλλους σταθμούς.</p>
        </div>
      }
      {!!aiTeasers.length&&<div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#ccff00]/25 bg-[#ccff00]/5 px-4 py-3" role="status">
        <span className="flex-1 text-xs font-semibold text-zinc-200">✦ Premium μέλος ανακάλυψε τραγούδι με AI σε {aiTeasers.length} {aiTeasers.length===1?'σταθμό':'σταθμούς'}. Τα αποτελέσματα είναι διαθέσιμα στο Premium.</span>
        <button type="button" onClick={()=>navigate('/premium')} className="rounded-lg bg-[#ccff00] px-3 py-2 text-xs font-black text-black">Δες τα με Premium</button>
      </div>}
      {!!displayStations.length &&
        <div ref={stripRef} className="ir-now-playing-scroll flex snap-x gap-3 overflow-x-auto pb-3" aria-live="polite">
          {displayStations.map(item=>
            <article key={item._id} className="group w-[132px] shrink-0 snap-start sm:w-[154px]">
              <button type="button" onClick={() => navigate(`/station/${item.slug || item._id}`)}
                aria-label={`Άνοιγμα σταθμού ${item.name}: ${item.music.artist} - ${item.music.title}`}
                className="ir-now-playing-card relative block aspect-square w-full overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 text-left transition-all hover:border-[#ccff00]/60 hover:shadow-[0_0_20px_rgba(204,255,0,0.13)]">
                <img src={item.coverArt||item.logo} alt="" loading="lazy"
                  onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=item.logo||'/iradios-app-logo.png';}}
                  className="h-full w-full bg-white object-cover transition-transform duration-500 group-hover:scale-105"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"/>
                <span className="absolute bottom-2 left-2 rounded-full border border-black/20 bg-[#ccff00] px-2 py-1 text-[9px] font-black uppercase text-black">LIVE</span>
                {item.coverArt!==item.logo&&item.logo&&
                  <img src={item.logo} alt="" className="absolute right-2 top-2 h-9 w-9 rounded-lg border border-white/20 bg-white object-contain p-1"/>}
              </button>
              <p className="mt-2 truncate text-[11px] font-bold text-white">{item.name}</p>
              <p className="truncate text-[11px] text-[#ccff00]">{item.music.title}</p>
              <p className="truncate text-[10px] text-zinc-500">{item.music.artist}</p>
              {item.foundWithAI&&<FoundWithAI compact className="mt-1"/>}
            </article>
          )}
        </div>
      }
    </section>
  );
}
