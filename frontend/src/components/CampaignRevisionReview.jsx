import React from 'react';
import ProtectedAudioPreview from './ProtectedAudioPreview';

const text=value=>value==null?'—':typeof value==='object'?JSON.stringify(value):String(value);
const labels={title:'Τίτλος',description:'Περιγραφή',client:'Brand',
 imageUrl:'Cover',squareImageUrl:'Square image',logoUrl:'Λογότυπο',
 targetUrl:'URL προορισμού',linkUrl:'URL προορισμού',placement:'Τοποθετήσεις',
 targetLocations:'Νομός',targetCountry:'Χώρα',targetRegion:'Περιφέρεια',
 designConfig:'Creative Studio',ctaLabel:'CTA',brandColor:'Brand color',
 audioUrl:'Audio Spot',frequency:'Συχνότητα',dspPreset:'DSP'};
export default function CampaignRevisionReview({revision,adId,kind}) {
 if(!revision)return null;
 const changes=Array.isArray(revision.changes)?revision.changes:[];
 return <details className="mt-3 w-full rounded-xl border border-amber-400/30 bg-amber-400/[.05] p-3 text-xs text-amber-100">
  <summary className="cursor-pointer font-black">Αλλαγές Agency προς έγκριση · Σύγκριση πριν → μετά</summary>
  <div className="mt-3 space-y-2">
   {changes.map(item=><div key={item.field} className="rounded-lg border border-white/10 bg-black/30 p-2">
    <p className="font-bold text-white">{labels[item.field]||item.field}</p>
    <p className="mt-1 break-words text-zinc-400">Πριν: {text(item.before)}</p>
    <p className="mt-1 break-words text-amber-200">Μετά: {text(item.after)}</p>
   </div>)}
   {kind==='banner'&&revision.patch?.imageUrl&&
    <img src={revision.patch.imageUrl} loading="lazy" alt="Νέο δημιουργικό προς έγκριση"
      className="h-36 w-full rounded-lg object-contain"/>}
   {kind==='audio'&&revision.patch?.audioUrl&&
    <ProtectedAudioPreview adId={adId} pending sourceUrl={revision.patch.audioUrl} scope="admin"/>}
   <p className="text-zinc-400">Η ενεργή έκδοση παραμένει ως έχει μέχρι την απόφαση.</p>
  </div>
 </details>;
}
