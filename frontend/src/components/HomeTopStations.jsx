import React from 'react';
import { ChevronRight, Play, Radio, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { stationIsPlaying } from './StationListenButton';

// Guest-only replacement for Favorites, using the same station play controls.
export default function HomeTopStations({ topStations = [], currentStation, isPlaying, onPlayStation, onPlayPause }) {
  const navigate = useNavigate();
  const top = topStations.filter(Boolean).slice(0, 7);
  const play = station => {
    if (station.isOffline === true || stationIsPlaying(station, currentStation, isPlaying)) return;
    if (String(station._id) === String(currentStation?._id) && onPlayPause) onPlayPause();
    else onPlayStation(station);
  };
  return (
    <section className="min-w-0" aria-label="Top σταθμοί">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-black text-white">
          <Trophy size={21} className="text-[#ccff00]"/>Top σταθμοί
        </h2>
        <button type="button" onClick={() => navigate('/?explore=top')} aria-label="Όλοι οι Top σταθμοί"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-[#ccff00] hover:bg-[#ccff00]/10">
          <ChevronRight size={17}/>
        </button>
      </div>
      <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-[#11171d] px-3">
        {top.map((station, index) => (
          <div key={station._id} className="flex min-h-[44px] min-w-0 items-center gap-2 py-1.5">
            <span className={`w-3 shrink-0 text-xs font-black tabular-nums ${index === 0 ? 'text-[#ccff00]' : 'text-zinc-500'}`}>{index+1}</span>
            <img src={station.logo} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-1"/>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => navigate('/station/' + (station.slug || station._id))}
                className="block max-w-full truncate text-left text-xs font-black text-white hover:text-[#ccff00]">{station.name}</button>
              <span className="block truncate text-[10px] text-zinc-500">{station.genre || station.region || 'Radio'}</span>
            </div>
            <button type="button" disabled={station.isOffline === true || stationIsPlaying(station, currentStation, isPlaying)}
              onClick={() => play(station)} aria-label={'Άκου τώρα: ' + station.name}
              title={station.isOffline === true ? 'OFFLINE' : 'Άκου τώρα'}
              className={station.isOffline === true
                ? 'flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-red-600 text-[9px] font-black text-white'
                : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-300 hover:border-[#ccff00]/50 hover:text-[#ccff00] disabled:opacity-50'}>
              {station.isOffline === true ? 'OFFLINE' : <Play size={15} fill="currentColor"/>}
            </button>
          </div>
        ))}
        {!top.length && <div className="flex min-h-[176px] items-center justify-center gap-2 text-xs text-zinc-500"><Radio size={20}/> Δεν υπάρχουν Top σταθμοί.</div>}
      </div>
    </section>
  );
}
