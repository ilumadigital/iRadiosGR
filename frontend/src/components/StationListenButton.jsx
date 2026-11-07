import React from 'react';
import { Check, Play } from 'lucide-react';

// Playback is public. This action describes *live radio* state, not song metadata.
export const stationIsPlaying = (station, currentStation, isPlaying) =>
  Boolean(isPlaying && station?._id && currentStation?._id &&
    String(station._id) === String(currentStation._id));

export default function StationListenButton({
  station, currentStation, isPlaying, onPlayStation, onPlayPause,
  className='', compact=false
}) {
  const active=stationIsPlaying(station,currentStation,isPlaying);
  const same=Boolean(station?._id && String(station._id)===String(currentStation?._id));
  const play=()=>{
    if(!station||active)return;
    if(same && onPlayPause)onPlayPause();
    else onPlayStation?.(station);
  };
  return (
    <button type="button" onClick={play} disabled={active||!station} aria-label={active?`Παίζει τώρα: ${station?.name}`:`Άκου τώρα: ${station?.name}`}
      className={`ir-station-listen inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition-all
        ${active?'border border-[#ccff00]/40 bg-[#ccff00]/15 text-[#ccff00]':'bg-[#ccff00] text-black hover:bg-[#e4ff83] active:scale-[.98]'}
        ${className}`}>
      {active?<Check size={compact?13:16}/>:<Play size={compact?13:16} fill="currentColor"/>}
      <span>{active?'Παίζει τώρα':'Άκου τώρα'}</span>
    </button>
  );
}
