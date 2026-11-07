import React from 'react';
import { ChevronRight, Headphones, Play, Radio, Sparkles, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { stationIsPlaying } from './StationListenButton';

const gradients=[
  'from-fuchsia-950 via-purple-900/80 to-zinc-950',
  'from-sky-950 via-indigo-900/80 to-zinc-950',
  'from-rose-950 via-orange-900/70 to-zinc-950',
  'from-emerald-950 via-teal-900/75 to-zinc-950'
];
export default function HomeRecommendationDeck({moodStations=[],topStations=[],currentStation,isPlaying,onPlayStation,onPlayPause}) {
  const navigate=useNavigate();
  const play=station=>{ if(stationIsPlaying(station,currentStation,isPlaying))return; if(String(station._id)===String(currentStation?._id)&&onPlayPause)onPlayPause(); else onPlayStation(station); };
  const picks=moodStations.filter(Boolean).slice(0,4);
  const top=topStations.filter(Boolean).slice(0,4);
  if(!picks.length&&!top.length)return null;
  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl"><Sparkles className="text-[#ccff00]" size={23}/> Για σένα</h2>
            <p className="mt-1 text-xs text-zinc-400">Σταθμοί που ταιριάζουν στις προτιμήσεις σου</p></div>
          <button type="button" onClick={()=>navigate('/?explore=for-you')} aria-label="Όλες οι προτάσεις"
            className="rounded-full border border-white/15 p-2 text-[#ccff00] hover:bg-white/10"><ChevronRight size={18}/></button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <button type="button" disabled={stationIsPlaying(station,currentStation,isPlaying)} onClick={()=>play(station)} title={stationIsPlaying(station,currentStation,isPlaying)?'Παίζει τώρα':'Άκου τώρα'} aria-label={(stationIsPlaying(station,currentStation,isPlaying)?'Παίζει τώρα: ':'Άκου τώρα: ')+station.name}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition-colors hover:bg-[#ccff00] hover:text-black">
                <Play size={17} fill="currentColor"/>
              </button>
            </div>
          </article>)}
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl"><Trophy className="text-[#ccff00]" size={22}/> Top σταθμοί</h2>
            <p className="mt-1 text-xs text-zinc-400">Επιλεγμένοι από το iRadiosGR</p></div>
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
            <button type="button" disabled={stationIsPlaying(station,currentStation,isPlaying)} onClick={()=>play(station)} title={stationIsPlaying(station,currentStation,isPlaying)?'Παίζει τώρα':'Άκου τώρα'} aria-label={(stationIsPlaying(station,currentStation,isPlaying)?'Παίζει τώρα: ':'Άκου τώρα: ')+station.name}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-300 hover:border-[#ccff00]/50 hover:text-[#ccff00]"><Play size={15} fill="currentColor"/></button>
          </div>)}
          {!top.length&&<div className="flex h-36 items-center justify-center text-xs text-zinc-500"><Radio size={20}/></div>}
        </div>
      </div>
    </section>
  );
}
