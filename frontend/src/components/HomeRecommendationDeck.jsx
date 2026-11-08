import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronUp, Mic2, Play, Radio, Sparkles, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { stationIsPlaying } from './StationListenButton';
import { getAthensClock } from '../utils/schedule.js';
import { getOnAirProducers } from '../utils/onAirProducers.js';

const gradients=[
  'from-fuchsia-950 via-purple-900/80 to-zinc-950',
  'from-sky-950 via-indigo-900/80 to-zinc-950',
  'from-rose-950 via-orange-900/70 to-zinc-950',
  'from-emerald-950 via-teal-900/75 to-zinc-950'
];
export default function HomeRecommendationDeck({moodStations=[],topStations=[],stations=[],currentStation,isPlaying,onPlayStation,onPlayPause}) {
  const navigate=useNavigate();
  const play=station=>{ if(station.isOffline===true||stationIsPlaying(station,currentStation,isPlaying))return; if(String(station._id)===String(currentStation?._id)&&onPlayPause)onPlayPause(); else onPlayStation(station); };
  const picks=moodStations.filter(Boolean).sort((a,b)=>Number(a.isOffline===true)-Number(b.isOffline===true)).slice(0,4);
  const top=topStations.filter(Boolean).sort((a,b)=>Number(a.isOffline===true)-Number(b.isOffline===true)).slice(0,7);
  const [clock, setClock] = useState(() => getAthensClock());
  const [showAllProducers, setShowAllProducers] = useState(false);
  useEffect(() => {
    const refreshClock = () => {
      const next = getAthensClock();
      setClock(prev => prev.day === next.day && prev.minute === next.minute ? prev : next);
    };
    const timer = setInterval(refreshClock, 30000);
    const onVisibility = () => { if (!document.hidden) refreshClock(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  const liveProducers = useMemo(() => getOnAirProducers(stations, clock), [stations, clock]);
  const visibleProducers = showAllProducers ? liveProducers : liveProducers.slice(0, 4);
  if(!picks.length&&!top.length&&!liveProducers.length)return null;
  return (
    <section className="grid min-w-0 gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(280px,1fr)]">
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl"><Sparkles className="text-[#ccff00]" size={23}/> Για σένα</h2>
            <p className="mt-1 text-xs text-zinc-400">Μουσική που μπορεί να σου αρέσει</p></div>
          <button type="button" onClick={()=>navigate('/?explore=for-you')} aria-label="Όλες οι προτάσεις"
            className="rounded-full border border-white/15 p-2 text-[#ccff00] hover:bg-white/10"><ChevronRight size={18}/></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {picks.map((station,i)=><article key={station._id}
            className={`group relative isolate flex min-h-[146px] flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br p-3 ${gradients[i%gradients.length]}`}>
            <div className="pointer-events-none absolute -right-8 -top-7 h-28 w-28 rounded-full bg-white/10 blur-[30px]"/>
            <img src={station.logo} alt="" loading="lazy" className="relative z-10 h-14 w-14 rounded-xl bg-white object-contain p-1.5 shadow-xl"/>
            <div className="relative z-10 mt-4 flex items-end justify-between gap-2">
              <div className="min-w-0">
                <span className="block line-clamp-1 text-[10px] font-black text-white/75">{station.genre||'Ραδιόφωνο'}</span>
                <button type="button" onClick={()=>navigate('/station/'+(station.slug||station._id))}
                  className="mt-1 block max-w-full truncate text-left text-sm font-black text-white hover:text-[#ccff00]">{station.name}</button>
              </div>
              <button type="button" disabled={station.isOffline===true||stationIsPlaying(station,currentStation,isPlaying)} onClick={()=>play(station)} title={station.isOffline===true?'OFFLINE':stationIsPlaying(station,currentStation,isPlaying)?'Παίζει τώρα':'Άκου τώρα'} aria-label={(station.isOffline===true?'OFFLINE: ':stationIsPlaying(station,currentStation,isPlaying)?'Παίζει τώρα: ':'Άκου τώρα: ')+station.name}
                className={station.isOffline===true?"flex h-9 min-w-[68px] shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-red-500 bg-red-600 text-white":"flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-[#ccff00] hover:text-black"}>
                {station.isOffline===true?<span className="text-[9px] font-black text-white">OFFLINE</span>:<Play size={17} fill="currentColor"/>}
              </button>
            </div>
          </article>)}
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl"><Mic2 className="text-[#ccff00]" size={23}/> Στον αέρα τώρα</h2>
            <p className="mt-1 text-xs text-zinc-400">Παραγωγοί που παίζουν αυτή τη στιγμή</p>
          </div>
          {liveProducers.length > 4 && <button type="button" onClick={() => setShowAllProducers(v => !v)}
            title={showAllProducers ? 'Λιγότεροι παραγωγοί' : 'Όλοι οι παραγωγοί'}
            aria-expanded={showAllProducers}
            aria-label={showAllProducers ? 'Εμφάνιση τεσσάρων παραγωγών' : 'Εμφάνιση όλων των παραγωγών'}
            className="shrink-0 rounded-full border border-white/15 p-2 text-[#ccff00] hover:bg-white/10">
            {showAllProducers ? <ChevronUp size={18}/> : <ChevronRight size={18}/>}
          </button>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {visibleProducers.map(({station,host,endLabel,backgroundUrl,hasProducerPhoto}) => (
            <article key={station._id}
              className="group relative isolate flex min-h-[146px] flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#15302b] via-[#161e2b] to-zinc-950 p-3">
              <img src={backgroundUrl} alt="" loading="lazy" aria-hidden="true"
                onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = station.logo; }}
                className={hasProducerPhoto
                  ? 'pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80'
                  : 'pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-2xl'}/>
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/25"/>
              <div className="relative z-10 flex items-start justify-between gap-2">
                <img src={station.logo} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1.5 shadow-xl"/>
                <span className="shrink-0 rounded-full border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold text-white/90">έως {endLabel}</span>
              </div>
              <div className="relative z-10 mt-4 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <span className="block line-clamp-1 text-[10px] font-black text-white/85" title={host}>{host}</span>
                  <button type="button" onClick={() => navigate('/station/' + (station.slug || station._id))}
                    className="mt-1 block max-w-full truncate text-left text-sm font-black text-white hover:text-[#ccff00]">{station.name}</button>
                </div>
                <button type="button" disabled={stationIsPlaying(station,currentStation,isPlaying)}
                  onClick={() => play(station)}
                  title={stationIsPlaying(station,currentStation,isPlaying) ? 'Παίζει τώρα' : 'Άκου τώρα'}
                  aria-label={(stationIsPlaying(station,currentStation,isPlaying) ? 'Παίζει τώρα: ' : 'Άκου τώρα: ') + station.name + ', ' + host}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white transition-colors hover:bg-[#ccff00] hover:text-black disabled:cursor-default disabled:opacity-60">
                  <Play size={17} fill="currentColor"/>
                </button>
              </div>
            </article>
          ))}
          {!liveProducers.length && <div className="col-span-2 flex min-h-[306px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#11171d] p-6 text-center">
            <Mic2 size={28} className="text-zinc-500"/>
            <p className="text-sm font-semibold text-zinc-300">Δεν υπάρχει αυτή τη στιγμή προγραμματισμένη εκπομπή με παραγωγό.</p>
            <p className="text-xs text-zinc-500">Οι παραγωγοί εμφανίζονται αυτόματα με βάση το πρόγραμμα κάθε σταθμού.</p>
          </div>}
        </div>
      </div>
      <div className="min-w-0 lg:col-span-2 xl:col-span-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl"><Trophy className="text-[#ccff00]" size={22}/> Top σταθμοί</h2>
            <p className="mt-1 text-xs text-zinc-400">Σταθμοί που ξεχωρίζουν</p></div>
          <button type="button" onClick={()=>navigate('/?explore=top')} aria-label="Προβολή Top σταθμών"
            className="rounded-full border border-white/15 p-2 text-[#ccff00] hover:bg-white/10"><ChevronRight size={18}/></button>
        </div>
        <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-[#11171d] px-3">
          {top.map((station,i)=><div key={station._id} className="flex min-h-[44px] min-w-0 items-center gap-3 py-1.5">
            <span className={`text-sm font-black tabular-nums ${i===0?'text-[#ccff00]':'text-zinc-500'}`}>{i+1}</span>
            <img src={station.logo} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-1"/>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={()=>navigate('/station/'+(station.slug||station._id))}
                className="block max-w-full truncate text-left text-xs font-black text-white hover:text-[#ccff00]">{station.name}</button>
              <span className="block truncate text-[10px] text-zinc-500">{station.genre||station.region||'Radio'}</span>
            </div>
            <button type="button" disabled={station.isOffline===true||stationIsPlaying(station,currentStation,isPlaying)} onClick={()=>play(station)} title={station.isOffline===true?'OFFLINE':stationIsPlaying(station,currentStation,isPlaying)?'Παίζει τώρα':'Άκου τώρα'} aria-label={(station.isOffline===true?'OFFLINE: ':stationIsPlaying(station,currentStation,isPlaying)?'Παίζει τώρα: ':'Άκου τώρα: ')+station.name}
              className={station.isOffline===true?"flex h-9 min-w-[68px] shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-red-500 bg-red-600 text-white":"flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-300 hover:border-[#ccff00]/50 hover:text-[#ccff00]"}>{station.isOffline===true?<span className="text-[9px] font-black text-white">OFFLINE</span>:<Play size={15} fill="currentColor"/>}</button>
          </div>)}
          {!top.length&&<div className="flex h-36 items-center justify-center text-xs text-zinc-500"><Radio size={20}/></div>}
        </div>
      </div>
    </section>
  );
}
