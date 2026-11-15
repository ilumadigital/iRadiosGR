import React from 'react';
import {Cookie,Settings2} from 'lucide-react';
import LegalLayout from '../components/legal/LegalLayout';
import {cookies} from './legalDocuments';
export default function CookiePolicy(){
  const openSettings=()=>window.dispatchEvent(new Event('iradios:open-cookie-settings'));
  return <LegalLayout document={cookies}>
    <button type="button" onClick={openSettings} className="mt-7 inline-flex items-center gap-3 rounded-xl bg-[#ccff00] px-6 py-3.5 text-sm font-black text-black hover:bg-[#e4ff84]">
      <Settings2 size={18}/> Άνοιγμα ρυθμίσεων Cookies <Cookie size={17}/>
    </button>
  </LegalLayout>;
}
