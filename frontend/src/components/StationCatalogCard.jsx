import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Radio, SignalHigh } from 'lucide-react';
import StationListenButton, { stationIsPlaying } from './StationListenButton';

// Shared genre/region cards: a station profile action is separate from the player action.
export default function StationCatalogCard({
  station, currentStation, isPlaying, onPlayStation, onPlayPause, mode='grid'
}) {
  const navigate=useNavigate();
  const active=stationIsPlaying(station,currentStation,isPlaying);
  const profile=()=>navigate('/station/'+(station.slug||station._id));
  const meta=station.transmissionType==='Επίγειο'&&station.frequency
    ? station.frequency+' FM' : (station.transmissionType||'Web Radio');
  const listen=<StationListenButton station={station} currentStation={currentStation} isPlaying={isPlaying}
    onPlayStation={onPlayStation} onPlayPause={onPlayPause} className={mode==='grid'?'w-full':'shrink-0'}/>;
  if(mode==='list')return (
    <article className={`ir-catalog-row flex min-w-0 items-center gap-3 rounded-2xl border p-3 sm:gap-4 sm:p-4 ${active?'border-[#ccff00]/45 bg-[#ccff00]/[.055]':'border-white/10 bg-[#141a20] hover:border-[#ccff00]/30'}`}>
      <button type="button" onClick={profile} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={'Προφίλ '+station.name}>
        <img src={station.logo} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl border border-white/10 bg-white object-contain p-1"/>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-white">{station.name}</span>
          <span className="mt-1 block truncate text-xs text-zinc-400">{meta} · {station.city||station.region||'Online'}</span>
        </span>
      </button>
      {listen}
    </article>
  );
  return (
    <article className={`ir-catalog-card group min-w-0 rounded-[22px] border p-2.5 transition-all hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,0,0,.35)] sm:p-3
      ${active?'border-[#ccff00]/50 bg-[#ccff00]/[.065]':'border-white/10 bg-[#141a20] hover:border-[#ccff00]/45'}`}>
      <button type="button" onClick={profile} className="block w-full text-left" aria-label={'Προφίλ '+station.name}>
        <div className="relative aspect-square overflow-hidden rounded-[17px] border border-white/10 bg-white">
          <img src={station.logo} alt="" loading="lazy" className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.035]"/>
          <span className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black ${active?'bg-[#ccff00] text-black':'bg-black/80 text-white'}`}>
            <Radio size={10}/>{active?'LIVE':'RADIO'}
          </span>
        </div>
        <h3 className="mt-3 truncate text-sm font-black text-white group-hover:text-[#ccff00]">{station.name}</h3>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-400">
          <SignalHigh size={12} className="shrink-0 text-[#ccff00]/75"/><span className="truncate">{meta}</span>
        </div>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-zinc-500"><MapPin size={11} className="shrink-0"/><span className="truncate">{station.city||station.region||'Online'}</span></p>
      </button>
      <div className="mt-3">{listen}</div>
    </article>
  );
}
