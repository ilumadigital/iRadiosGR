import React from 'react';
import {LISTENER_MODES,normalizeListenerMode} from '../utils/dspEngine';

// Single source of truth across the station page and the global player.
// These changes affect only the current authenticated Premium listener.
export default function PremiumSoundModes({value='DEFAULT',onChange}){
  const selected=normalizeListenerMode(value);
  return <div role="group" aria-label="Premium προσωπική ρύθμιση ήχου"
    className="min-w-64 space-y-1 rounded-2xl border border-white/10 bg-zinc-900 p-2 shadow-2xl">
    <p className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#ccff00]">
      Premium · Προσωπικός ήχος
    </p>
    {Object.entries(LISTENER_MODES).map(([mode,item])=>
      <button key={mode} type="button"
        aria-pressed={selected===mode} onClick={()=>onChange(mode)}
        className={'flex w-full flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left transition-colors '+
          (selected===mode?'bg-[#ccff00]/10 text-[#ccff00]':'text-zinc-200 hover:bg-white/5')}>
        <span className="text-sm font-bold">{item.label}</span>
        <span className="text-[10px] leading-4 text-zinc-400">{item.description}</span>
      </button>)}
    <p className="border-t border-white/10 px-3 pt-2 text-[10px] leading-4 text-zinc-500">
      Dolby Style: stereo virtual surround, όχι αυθεντική Dolby 5.1 κωδικοποίηση.
      Το OFF ακούει το αρχικό stream χωρίς WebDSP.
    </p>
  </div>;
}
