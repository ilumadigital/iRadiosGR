import React from 'react';
import {SkipForward} from 'lucide-react';

/** Shared desktop/fullscreen/mobile control. The parent player alone decides
 * when the underlying audible-time counter unlocks an ad skip.
 */
export default function AdSkipControl({isPlayingAd,secondsUntilSkip,onSkip,compact=false,className=''}) {
  if(!isPlayingAd||secondsUntilSkip===null||secondsUntilSkip===undefined)return null;
  const ready=secondsUntilSkip===0;
  if(!ready)return <span role="status" aria-label={'Παράλειψη διαφήμισης σε '+secondsUntilSkip+' δευτερόλεπτα'}
    className={'inline-flex items-center rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-[11px] font-bold text-zinc-300 '+className}>
    Skip σε {secondsUntilSkip}″
  </span>;
  return <button type="button" aria-label="Παράλειψη διαφήμισης" onClick={event=>{event.preventDefault();event.stopPropagation();onSkip?.();}}
    className={'inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-purple-300/40 bg-purple-600 px-3 py-2 text-[11px] font-black text-white hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-200 '+className}>
    {compact?'Skip':'Παράλειψη διαφήμισης'} <SkipForward size={14}/>
  </button>;
}
