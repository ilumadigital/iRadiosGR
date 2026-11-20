import React from 'react';
import {Sparkles} from 'lucide-react';

// Explicit provenance, never inferred from a logo, station name or missing song.
export default function FoundWithAI({compact=false,className=''}) {
  return <span aria-label="Found with AI" className={`inline-flex w-fit items-center gap-1 rounded-full border border-[#ccff00]/30 bg-[#ccff00]/10 font-black tracking-wide text-[#ccff00] ${compact?'px-1.5 py-0.5 text-[9px]':'px-2.5 py-1 text-[10px]'} ${className}`}>
    <Sparkles size={compact?10:12} aria-hidden="true"/> Found with AI
  </span>;
}
