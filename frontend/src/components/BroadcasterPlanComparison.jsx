import React, {useState} from 'react';
import {BarChart3,Check,ChevronRight,Crown,Infinity as InfinityIcon,Info,Minus,Plus,SlidersHorizontal,Target,X} from 'lucide-react';

const money=cents=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(cents/100);
const ADDONS=[
  {sku:'ADD-DSP',label:'WebDSP',icon:SlidersHorizontal},
  {sku:'ADD-ADS',label:'Ad Control',icon:Target},
  {sku:'ADD-AN',label:'Audience Radar',icon:BarChart3}
];
const ROWS=[
  {label:'Προφίλ και βασική παρουσία σταθμού',free:'Περιλαμβάνεται',premium:'Περιλαμβάνεται'},
  {label:'Πλήθος σταθμών',free:'Έως 3 σταθμοί',premium:'Απεριόριστοι σταθμοί'},
  {label:'WebDSP – επεξεργασία ήχου',free:'Προαιρετικό add-on ανά σταθμό',premium:'Σε όλους τους σταθμούς'},
  {label:'Ad Control – δικές σου διαφημίσεις',free:'Προαιρετικό add-on ανά σταθμό',premium:'Σε όλους τους σταθμούς'},
  {label:'Audience Radar – στοιχεία ακρόασης',free:'Προαιρετικό add-on ανά σταθμό',premium:'Σε όλους τους σταθμούς'},
  {label:'Boost προβολής',free:'Αγορά Boost ανά σταθμό',premium:'Premium Boost με επιλογή σταθμών'},
  {label:'Πρόσθετο αγορασμένο Boost',free:'Διαθέσιμο',premium:'Διαθέσιμο – έχει προτεραιότητα'}
];

export default function BroadcasterPlanComparison({catalog,initialStations=5}){
  const [count,setCount]=useState(()=>Math.min(20,Math.max(1,initialStations)));
  const priceFor=sku=>catalog?.[sku]?.priceCents;
  const monthly=ADDONS.reduce((sum,addon)=>sum+Number(priceFor(addon.sku)||0),0);
  const premium=Number(priceFor('B-PREM')||0);
  const valid=Number.isSafeInteger(premium)&&premium>0&&
    ADDONS.every(addon=>Number.isSafeInteger(priceFor(addon.sku))&&priceFor(addon.sku)>0);
  if(!valid){
    return <section className="rounded-[30px] border border-white/10 bg-[#131718] p-6 text-sm text-zinc-300" role="status">
      Δεν υπάρχουν αυτή τη στιγμή διαθέσιμες τιμές για τη σύγκριση. Δες τις επιλογές συνδρομής παρακάτω.
    </section>;
  }
  const addonsTotal=monthly*count;
  const difference=addonsTotal-premium;
  const expensive=Math.max(addonsTotal,premium);
  const percent=s=>Math.max(3,Math.round(s/expensive*100));
  const setClamped=value=>setCount(Math.min(20,Math.max(1,value)));

  return <>
    <section aria-labelledby="broadcaster-cost-title" className="overflow-hidden rounded-[32px] border border-white/10 bg-[#131718] p-5 shadow-[0_24px_90px_rgba(0,0,0,.17)] md:p-9">
      <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[.18em] text-[#ccff00]">Υπολογιστής κόστους</span>
          <h2 id="broadcaster-cost-title" className="mt-3 text-2xl font-black tracking-tight md:text-3xl">Πόσο σε συμφέρει το Premium;</h2>
          <p className="mt-3 max-w-md text-sm leading-7 text-zinc-300">
            Μετακίνησε τον δείκτη για να δεις πόσο κοστίζουν και τα 3 add-ons σε κάθε σταθμό, σε σύγκριση με μία συνδρομή Premium για ολόκληρο το account.
          </p>
          <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="broadcaster-station-count" className="text-sm font-bold text-white">Πόσους σταθμούς διαχειρίζεσαι;</label>
              <span className="min-w-12 rounded-xl bg-[#ccff00] px-3 py-2 text-center text-xl font-black tabular-nums text-black">{count}</span>
            </div>
            <input id="broadcaster-station-count" type="range" min="1" max="20" step="1"
              value={count} onChange={e=>setClamped(Number(e.target.value))}
              aria-valuetext={count+' σταθμοί'}
              className="mt-6 w-full cursor-pointer accent-[#ccff00]"/>
            <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-zinc-500">
              <span>1 σταθμός</span>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Ένας σταθμός λιγότερος" disabled={count===1}
                  onClick={()=>setClamped(count-1)} className="rounded-lg border border-white/15 p-2 text-white disabled:opacity-30"><Minus size={14}/></button>
                <button type="button" aria-label="Ένας σταθμός περισσότερος" disabled={count===20}
                  onClick={()=>setClamped(count+1)} className="rounded-lg border border-white/15 p-2 text-white disabled:opacity-30"><Plus size={14}/></button>
              </div>
              <span>20 σταθμοί</span>
            </div>
          </div>
          <div className="mt-5 space-y-2 text-xs text-zinc-400">
            {ADDONS.map(addon=>{
              const Icon=addon.icon;
              return <div key={addon.sku} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2"><Icon size={15} className="text-[#ccff00]"/>{addon.label}</span>
                <span className="font-bold tabular-nums text-zinc-200">{money(priceFor(addon.sku))} / σταθμό</span>
              </div>;
            })}
            <div className="flex justify-between border-t border-white/10 pt-3 text-sm font-bold text-white">
              <span>Σύνολο add-ons / σταθμό</span><span className="tabular-nums">{money(monthly)}</span>
            </div>
          </div>
        </div>
        <div aria-live="polite" aria-atomic="true" className="flex flex-col justify-between rounded-[26px] border border-[#ccff00]/20 bg-[#0d160d] p-5 md:p-7">
          <div>
            <div className="mb-7 flex items-center gap-2 text-[#ccff00]"><Crown size={21}/><span className="text-xs font-black uppercase tracking-widest">Η σύγκριση για {count} {count===1?'σταθμό':'σταθμούς'}</span></div>
            <div className="space-y-7">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-300">Όλα τα add-ons ξεχωριστά</span>
                  <strong className="text-2xl font-black tabular-nums text-white">{money(addonsTotal)}<span className="ml-1 text-xs font-medium text-zinc-400">/ μήνα</span></strong>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-zinc-400 transition-[width] duration-200" style={{width:percent(addonsTotal)+'%'}}/></div>
              </div>
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[#ccff00]">Broadcaster Premium – όλο το account</span>
                  <strong className="text-2xl font-black tabular-nums text-[#ccff00]">{money(premium)}<span className="ml-1 text-xs font-medium text-zinc-400">/ μήνα</span></strong>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ccff00] transition-[width] duration-200" style={{width:percent(premium)+'%'}}/></div>
              </div>
            </div>
          </div>
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/25 p-5">
            {difference>0?<><p className="text-xs font-bold text-zinc-300">Με το Premium εξοικονομείς</p>
              <p className="mt-1 text-3xl font-black tracking-tight tabular-nums text-[#ccff00]">{money(difference)} <span className="text-base">/ μήνα</span></p>
              <p className="mt-2 text-xs text-zinc-400">Δηλαδή {money(difference*12)} σε 12 μήνες με σταθερές τιμές.</p></>:
              <><p className="text-sm font-bold text-white">Για {count} {count===1?'σταθμό':'σταθμούς'}, τα μεμονωμένα add-ons κοστίζουν λιγότερο.</p>
                <p className="mt-2 text-xs leading-6 text-zinc-300">Το Premium κοστίζει {money(-difference)} περισσότερο τον μήνα, αλλά προσφέρει απεριόριστους σταθμούς και Premium Boost.</p></>}
            <a href="#premium-offer" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#ccff00] hover:underline">Δες τι περιλαμβάνει το Premium <ChevronRight size={17}/></a>
          </div>
        </div>
      </div>
      <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-zinc-500"><Info size={15} className="mt-0.5 shrink-0"/>
        Ενδεικτική σύγκριση για την αγορά και των τριών add-ons ανά σταθμό. Δεν αφαιρούνται τυχόν ήδη ενεργές συνδρομές ή προσφορές. Όλες οι τιμές είναι τελικές, με ΦΠΑ 24%. Το Premium καλύπτει και νέους σταθμούς όσο η συνδρομή είναι ενεργή.</p>
    </section>
    <section aria-labelledby="broadcaster-compare-title" className="overflow-hidden rounded-[32px] border border-white/10 bg-[#131718]">
      <div className="p-6 md:p-8">
        <span className="text-[10px] font-black uppercase tracking-[.18em] text-[#ccff00]">Free vs Premium</span>
        <h2 id="broadcaster-compare-title" className="mt-3 text-2xl font-black tracking-tight md:text-3xl">Τι κερδίζεις με το Premium;</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Ξεκινάς δωρεάν και προσθέτεις εργαλεία στον σταθμό που θέλεις. Με το Premium, όλα τα add-ons περιλαμβάνονται για ολόκληρο τον λογαριασμό.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[590px] text-left text-sm">
          <thead><tr className="border-y border-white/10 bg-white/[.03]">
            <th scope="col" className="px-6 py-5 text-xs font-bold text-zinc-400">Λειτουργία</th>
            <th scope="col" className="px-5 py-5 text-xs font-black text-white">Broadcaster Free <span className="block pt-1 text-zinc-400">0 € / μήνα</span></th>
            <th scope="col" className="bg-[#ccff00]/[.07] px-5 py-5 text-xs font-black text-[#ccff00]">Broadcaster Premium <span className="block pt-1">{money(premium)} / μήνα / account</span></th>
          </tr></thead>
          <tbody>{ROWS.map((row,index)=><tr key={row.label} className={index%2===0?'bg-black/10':''}>
            <th scope="row" className="border-b border-white/[.06] px-6 py-4 text-xs font-semibold text-zinc-200">{row.label}</th>
            <td className="border-b border-white/[.06] px-5 py-4 text-xs leading-5 text-zinc-400">{row.free}</td>
            <td className="border-b border-white/[.06] bg-[#ccff00]/[.035] px-5 py-4 text-xs font-semibold leading-5 text-white"><Check size={14} className="mr-2 inline text-[#ccff00]"/>{row.premium}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="flex items-start gap-2 px-6 py-5 text-xs leading-6 text-zinc-400"><Info size={17} className="mt-1 shrink-0 text-[#ccff00]"/>
        Το περιλαμβανόμενο Premium Boost εφαρμόζεται στους σταθμούς που επιλέγεις από το Backoffice. Οι αγορασμένες προβολές εξακολουθούν να έχουν υψηλότερη προτεραιότητα. Οι ήδη πληρωμένες συνδρομές add-ons χρειάζονται ξεχωριστή διακοπή ανανέωσης.</p>
    </section>
  </>;
}
