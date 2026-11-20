import React,{useEffect,useMemo,useState} from 'react';
import {adminFetch as fetch} from '../utils/adminFetch';
const eurNano=n=>new Intl.NumberFormat('el-GR',{
 style:'currency',currency:'EUR',minimumFractionDigits:3,
 maximumFractionDigits:3}).format(Number(n||0)/1e9);
const eurCent=n=>new Intl.NumberFormat('el-GR',{
 style:'currency',currency:'EUR'}).format(Number(n||0)/100);
const names={
 entry:'Πρώτο Play',every_5_stations:'Ανά 5 σταθμούς',
 every_10_stations:'Ανά 10 σταθμούς',every_20_stations:'Ανά 20 σταθμούς',
 every_30_stations:'Ανά 30 σταθμούς',twice_a_day:'2 φορές / ημέρα',
 four_times_a_day:'4 φορές / ημέρα',six_times_a_day:'6 φορές / ημέρα',
 hero:'Homepage Hero',home:'Home Feed',radio_feed:'Radio Grid',
 news_feed:'News Feed',station_profile:'Station Profile'
};
const label='text-xs text-zinc-400';
const cell='rounded-2xl border border-white/10 bg-black/25 p-4';
export default function AdvertisingV2CampaignStats({campaign,onBudgetClick}){
 const [state,setState]=useState({loading:true,data:null,error:null});
 useEffect(()=>{
  if(!campaign?._id)return;
  let alive=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/advertising/v2/campaigns/'+campaign._id+'/analytics',
     {cache:'no-store'});
    const result=await res.json();
    if(!res.ok)throw Error(result.error||'Analytics unavailable');
    if(alive)setState({loading:false,data:result,error:null});
   }catch(e){if(alive)setState({loading:false,data:null,error:e.message});}
  };
  void load();
  // Qualified server-side settlements update immediately in MongoDB. Refresh
  // the read-only projection every 5s while visible rather than showing a
  // seemingly frozen balance for half a minute after an actual ad plays.
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},5000);
  const onVisible=()=>{if(document.visibilityState==='visible')void load();};
  document.addEventListener('visibilitychange',onVisible);
  return ()=>{alive=false;clearInterval(timer);
   document.removeEventListener('visibilitychange',onVisible);};
 },[campaign?._id]);
 const data=state.data;
 const rows=useMemo(()=>{
  const groups=new Map();
  for(const e of data?.events||[]){
   const key=e.kind+':'+e.placement;
   if(!groups.has(key))groups.set(key,{kind:e.kind,placement:e.placement,
    listen10:0,cta:0,complete:0,impression:0,click:0,costNanos:0});
   const row=groups.get(key);
   row[e.event]=(row[e.event]||0)+e.count;
   row.costNanos+=e.costNanos;
  }
  for(const s of data?.skips||[]){
   const key='audio:'+s.placement;
   if(!groups.has(key))groups.set(key,{kind:'audio',placement:s.placement,
    listen10:0,cta:0,complete:0,impression:0,click:0,costNanos:0});
   groups.get(key).skips=s.count;
  }
  return [...groups.values()];
 },[data]);
 if(state.loading)return <div className={cell+' text-xs text-zinc-400'}>Φόρτωση Advertising Analytics…</div>;
 if(state.error)return <div className={cell+' text-xs text-amber-200'}>Analytics: {state.error}</div>;
 if(!data)return null;
 const daily=data.today||{},balance=data.balance||{},delivery=data.delivery||{};
 const missingPaidRequirements=[
  !delivery.configured?'Η χρέωση Advertising v2 δεν έχει ενεργοποιηθεί.':null,
  delivery.configured&&!delivery.mongoReplicaSetReady?'Η ασφαλής MongoDB transaction processing δεν είναι διαθέσιμη.':null,
  delivery.configured&&!delivery.trustedGeoReady?'Απουσιάζει επαληθευμένη γεωγραφική πληροφορία από το reverse proxy.':null,
  !delivery.compatibleFunding?'Δεν υπάρχει συμβατό διαθέσιμο υπόλοιπο για τις χρεώσεις Advertising v2.':null,
  delivery.compatibleFunding&&!delivery.hasEligibleCreative?'Δεν υπάρχει διαθέσιμο ενεργό δημιουργικό για νέο ticket.':null,
  delivery.hasEligibleCreative&&delivery.walletCapable===false?'Το συμβατό υπόλοιπο δεν επαρκεί για ολόκληρο νέο ticket.':null,
  delivery.hasEligibleCreative&&delivery.dayCapable===false?
   'Το υπόλοιπο ημέρας δεν καλύπτει ολόκληρη την απαιτούμενη κράτηση. Ελάχιστη κράτηση '+eurNano(delivery.minimumReservationNanos)+
   ', λείπουν '+eurNano(delivery.dayShortfallNanos)+'.':null
 ].filter(Boolean);
 const status=campaign.adminSuspended?'Παύση από Admin':
  !campaign.agencyEnabled?'Απενεργοποιημένη από Agency':
  campaign.approvalStatus!=='approved'?'Σε αναμονή έγκρισης':
  !delivery.campaignRunning?'Εκτός ενεργού χρονικού διαστήματος':
  Number(data.compatibleAvailableNanos||0)<=0?'Απαιτείται διαθέσιμη πίστωση v2':
  delivery.hasEligibleCreative===false?'Δεν υπάρχει έτοιμο δημιουργικό':
  delivery.dayCapable===false?'Ανεπαρκές ημερήσιο budget για νέο ticket':
  delivery.walletCapable===false?'Ανεπαρκής πίστωση για νέο ticket':
  daily.availableNanos<=0?'Εξαντλήθηκε το ημερήσιο όριο':
  delivery.payable?'Ενεργή οικονομική διανομή':
  'Η οικονομική διανομή δεν είναι διαθέσιμη';
 return <section className="space-y-4 rounded-[24px] border border-purple-400/20 bg-[#16131e] p-5 sm:p-7">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-[10px] font-black uppercase tracking-widest text-purple-300">Advertising v2 · Live οικονομικά στοιχεία</p>
    <h3 className="mt-2 text-lg font-black text-white">Αποτελέσματα καμπάνιας</h3></div>
   <span role="status" aria-live="polite" className={'rounded-full border px-3 py-1.5 text-xs font-bold '+(delivery.payable?'border-emerald-400/30 bg-emerald-400/10 text-emerald-200':'border-amber-400/30 bg-amber-400/10 text-amber-200')}>{status}</span>
  </div>
  {!delivery.payable&&missingPaidRequirements.length>0&&<div role="status"
    className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3 text-xs leading-relaxed text-amber-200">
    <strong className="block font-black">Η καμπάνια δεν πραγματοποιεί χρεώσιμη προβολή αυτή τη στιγμή.</strong>
    {missingPaidRequirements.map(reason=><p key={reason} className="mt-1">{reason}</p>)}
    {onBudgetClick&&!delivery.dayCapable&&delivery.hasEligibleCreative&&
     <button type="button" onClick={onBudgetClick}
      className="mt-3 inline-flex items-center rounded-lg border border-amber-300/30 px-3 py-2 text-xs font-black transition hover:bg-amber-400/10">
      Αλλαγή ημερήσιου budget
     </button>}
   </div>}
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   <div className={cell}><div className={label}>Επιβεβαιωμένη πίστωση</div><strong className="mt-2 block text-lg text-white">{eurNano(balance.fundedNanos)}</strong></div>
   <div className={cell}><div className={label}>Εσωτερικό υπόλοιπο</div><strong className="mt-2 block text-lg text-white">{eurNano(balance.remainingNanos)}</strong></div>
   <div className={cell}><div className={label}>Σήμερα χρεώθηκαν</div><strong className="mt-2 block text-lg text-white">{eurNano(daily.spentNanos)}</strong></div>
   <div className={cell}><div className={label}>Ημερήσιο υπόλοιπο</div><strong className="mt-2 block text-lg text-white">{eurNano(daily.availableNanos)}</strong></div>
  </div>
  <p className="text-xs text-zinc-300"><strong>Διαθέσιμο για Advertising v2: {eurNano(data.compatibleAvailableNanos)}</strong> · Η ιστορική πίστωση διαφορετικού τιμοκαταλόγου δεν χρεώνεται ως v2.</p>
  <p className="text-xs text-zinc-400">Όριο ανά ημέρα {eurCent(data.dailyBudgetCents)} · Reset 00:00 ώρα Ελλάδας · Ενεργές κρατήσεις {data.activeReservations||0}. Μόνο επιβεβαιωμένα server-side γεγονότα χρεώνονται.</p>
  {delivery.minimumReservationNanos>0&&<div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-zinc-300">
   <strong className="text-white">Ελάχιστη κράτηση για νέο ticket: {eurNano(delivery.minimumReservationNanos)}</strong>
   <span>Απαιτείται πλήρης κάλυψη πριν την έναρξη. Το αχρησιμοποίητο ποσό αποδεσμεύεται.</span>
  </div>}
  <div className="overflow-x-auto">
   <table className="w-full min-w-[620px] text-left text-xs">
    <thead><tr className="border-b border-white/10 text-zinc-400">
     <th className="py-3 pr-3">Placement</th><th className="pr-3">10″ / Views</th>
     <th className="pr-3">CTA</th><th className="pr-3">Completion / CTR</th>
     <th className="pr-3">Skips</th><th>Χρέωση</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row.kind+row.placement} className="border-b border-white/5">
     <td className="py-3 pr-3 font-semibold text-white">{names[row.placement]||row.placement}</td>
     <td className="pr-3">{row.kind==='audio'?row.listen10:row.impression}</td>
     <td className="pr-3">{row.kind==='audio'?row.cta:row.click}</td>
     <td className="pr-3">{row.kind==='audio'?row.complete:
      row.impression?(row.click/row.impression*100).toFixed(2)+'%':'0%'}</td>
     <td className="pr-3">{row.kind==='audio'?(row.skips||0):'—'}</td>
     <td className="font-semibold text-white">{eurNano(row.costNanos)}</td>
    </tr>)}</tbody>
   </table>
   {!rows.length&&<p className="py-5 text-xs text-zinc-500">Δεν έχουν καταγραφεί ακόμη χρεώσιμα γεγονότα.</p>}
  </div>
  <p className="text-[11px] text-zinc-500">Visual: χρεώσιμη ορατότητα ≥50% επί 300 συνεχόμενα ms. Audio: πραγματική ακρόαση 10″ + ανεξάρτητο CTA + ολοκλήρωση. Τα Visual CTA δεν χρεώνονται.</p>
 </section>;
}
