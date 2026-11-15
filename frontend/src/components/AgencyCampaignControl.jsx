import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {adminFetch as fetch} from '../utils/adminFetch';
import AdvertisingV2CampaignStats from './AdvertisingV2CampaignStats';
import ProtectedAudioPreview from './ProtectedAudioPreview';
import AgencyCampaignTopUp from '../pages/AgencyCampaignTopUp';
import {Activity,ArrowDownRight,BarChart3,CalendarDays,CheckCircle2,
 CircleAlert,Clock3,Image as ImageIcon,MapPin,Pause,Play,
 RefreshCw,ShieldCheck,SlidersHorizontal,Wallet,Volume2} from 'lucide-react';

const moneyCents=n=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'})
 .format(Number(n||0)/100);
const moneyNanos=n=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR',
 minimumFractionDigits:3,maximumFractionDigits:3}).format(Number(n||0)/1e9);
const card='rounded-[22px] border border-white/10 bg-[#191620] p-5 sm:p-6';
const button='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-4 text-sm font-bold text-zinc-100 transition hover:border-purple-300/40 hover:bg-white/[.08] disabled:cursor-not-allowed disabled:opacity-50';
const primary=button+' border-purple-400/40 bg-purple-500 text-white hover:bg-purple-400';
const tabs=[
 ['overview','Επισκόπηση',BarChart3],
 ['budget','Budget & χρεώσεις',Wallet],
 ['creatives','Δημιουργικά',ImageIcon],
 ['settings','Στόχευση & πρόγραμμα',SlidersHorizontal]
];
const PLACE={
 entry:'Πρώτο Play',every_5_stations:'Ανά 5 σταθμούς',
 every_10_stations:'Ανά 10 σταθμούς',every_20_stations:'Ανά 20 σταθμούς',
 every_30_stations:'Ανά 30 σταθμούς',twice_a_day:'2 φορές / ημέρα',
 four_times_a_day:'4 φορές / ημέρα',six_times_a_day:'6 φορές / ημέρα',
 hero:'Homepage Hero',home:'Home Feed',radio_feed:'Radio Grid',
 news_feed:'News Feed',station_profile:'Station Profile'
};
function toCents(value){
 const formatted=String(value).trim().replace(',','.');
 if(!/^(?:\d+)(?:\.\d{1,2})?$/.test(formatted))return null;
 const [whole,decimal='']=formatted.split('.');
 const cents=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 return Number.isSafeInteger(cents)?cents:null;
}
async function call(url,options={}){
 const r=await fetch(url,{cache:'no-store',...options,headers:{
  ...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.error||'Η ενέργεια δεν ολοκληρώθηκε.');
 return d;
}
function readinessLabel(campaign,delivery,daily){
 if(campaign.adminSuspended)return ['Παύση από Admin','Η καμπάνια έχει ανασταλεί από τον διαχειριστή.'];
 if(!campaign.agencyEnabled)return ['Σε παύση','Πάτησε Επανενεργοποίηση για να συνεχίσει.'];
 if(campaign.approvalStatus!=='approved')return ['Αναμονή έγκρισης','Η διανομή αρχίζει μετά την έγκριση.'];
 if(!delivery?.campaignRunning)return ['Εκτός προγράμματος','Έλεγξε τις ημερομηνίες έναρξης και λήξης.'];
 if(!delivery?.hasEligibleCreative)return ['Χωρίς έτοιμο δημιουργικό','Δεν βρέθηκε ενεργό και διαθέσιμο spot ή banner.'];
 if(!delivery?.compatibleFunding)return ['Απαιτείται πίστωση v2','Χρειάζεται επαληθευμένη πίστωση στον ισχύοντα τιμοκατάλογο.'];
 if(!delivery?.dayCapable)return ['Ανεπαρκές ημερήσιο budget',
  'Το υπόλοιπο ημέρας δεν καλύπτει την απαιτούμενη κράτηση για νέο ticket.'];
 if(!delivery?.walletCapable)return ['Ανεπαρκής πίστωση',
  'Το διαθέσιμο υπόλοιπο καμπάνιας δεν καλύπτει την πλήρη κράτηση.'];
 if(!delivery?.configured||!delivery?.mongoReplicaSetReady||!delivery?.trustedGeoReady)
  return ['Προσωρινά μη διαθέσιμη','Αναμονή επιβεβαίωσης υπηρεσίας και γεωγραφικής πληροφορίας.'];
 if(delivery?.payable)return ['Έτοιμη για οικονομική διανομή',
  'Μπορούν να εκδοθούν νέα tickets για κατάλληλους επισκέπτες.'];
 return ['Μη διαθέσιμη','Το διαθέσιμο υπόλοιπο δεν επαρκεί για νέο ticket.'];
}
function Snapshot({title,value,foot,Icon}){
 return <div className="rounded-2xl border border-white/10 bg-[#0e0d13] p-4 sm:p-5">
  <div className="flex items-center justify-between gap-2"><p className="text-xs text-zinc-400">{title}</p><Icon size={17} className="text-purple-300"/></div>
  <strong className="mt-3 block text-xl font-black text-white sm:text-2xl">{value}</strong>
  <p className="mt-2 text-[11px] leading-5 text-zinc-500">{foot}</p>
 </div>;
}
export default function AgencyCampaignControl({campaign,creatives,pricing,onRefresh}){
 const [tab,setTab]=useState('overview');
 const [info,setInfo]=useState(null),[analytics,setAnalytics]=useState(null);
 const [draftLimit,setDraftLimit]=useState('');
 const [dirty,setDirty]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const load=useCallback(async({forceDraft=false}={})=>{
  if(!campaign?._id)return;
  const [budget,stats]=await Promise.all([
   call('/api/advertising/campaigns/'+campaign._id+'/daily-budget'),
   call('/api/advertising/v2/campaigns/'+campaign._id+'/analytics')
  ]);
  setInfo(budget);setAnalytics(stats);
  if(!dirty||forceDraft)setDraftLimit((budget.dailyBudgetCents/100).toFixed(2));
  setLoading(false);
 },[campaign?._id,dirty]);
 useEffect(()=>{
  setLoading(true);setError('');setMessage('');
  let alive=true;
  const refresh=()=>{if(alive&&document.visibilityState==='visible')
   void load().catch(e=>{if(alive){setError(e.message);setLoading(false);}});};
  refresh();
  const timer=setInterval(refresh,7000);
  document.addEventListener('visibilitychange',refresh);
  return ()=>{alive=false;clearInterval(timer);
   document.removeEventListener('visibilitychange',refresh);};
 },[load]);
 const delivery=analytics?.delivery||{},today=analytics?.today||{};
 const [status,statusHint]=readinessLabel(campaign,delivery,today);
 const canPause=campaign.approvalStatus==='approved'&&!campaign.adminSuspended;
 const changingCents=toCents(draftLimit);
 const maxCents=info?.plannedBudgetCents||campaign.plannedBudgetCents||0;
 const newDayNanos=changingCents===null?0:changingCents*10000000;
 const committedNanos=(info?.spentNanos||0)+(info?.reservedNanos||0);
 const availablePreview=Math.max(0,newDayNanos-committedNanos);
 const needed=delivery.minimumReservationNanos||0;
 const validNewLimit=changingCents!==null&&changingCents>0&&
  changingCents<=maxCents&&newDayNanos>=committedNanos;
 const save=async()=>{
  if(!info||!validNewLimit){setError('Έλεγξε το όριο: δεν μπορεί να είναι μικρότερο από τις σημερινές χρεώσεις και κρατήσεις.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   const outcome=await call('/api/advertising/campaigns/'+campaign._id+'/daily-budget',{
    method:'PATCH',body:JSON.stringify({
     dailyBudgetCents:changingCents,
     expectedDailyBudgetCents:info.dailyBudgetCents
    })});
   setDirty(false);
   await onRefresh?.();
   await load({forceDraft:true});
   setMessage(outcome.changed?'Το νέο ημερήσιο όριο αποθηκεύτηκε χωρίς νέα πληρωμή.':'Το ημερήσιο όριο παραμένει ίδιο.');
  }catch(e){setError(e.message);await load().catch(()=>{});}
  finally{setBusy(false);}
 };
 const toggle=async()=>{
  setBusy(true);setError('');setMessage('');
  try{
   await call('/api/advertising/campaigns/'+campaign._id+'/enabled',{
    method:'PATCH',body:JSON.stringify({enabled:!campaign.agencyEnabled})});
   await onRefresh?.();await load();
   setMessage(campaign.agencyEnabled?'Η καμπάνια τέθηκε σε παύση.':'Η καμπάνια επανενεργοποιήθηκε.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const slots=delivery.placements||[];
 return <div className="space-y-5">
  <section className="relative overflow-hidden rounded-[28px] border border-purple-400/25 bg-gradient-to-br from-[#29203b] via-[#1b1825] to-[#14141b] p-5 sm:p-8">
   <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-purple-500/20 blur-3xl"/>
   <div className="relative flex flex-wrap items-start justify-between gap-5">
    <div className="min-w-0">
     <p className="text-[10px] font-black uppercase tracking-[.2em] text-purple-300">Agency Campaign Manager</p>
     <h3 className="mt-2 break-words text-2xl font-black tracking-tight text-white sm:text-3xl">{campaign.title}</h3>
     <p className="mt-2 text-sm text-zinc-300">{campaign.brand} · {campaign.prefecture||campaign.region||'Πανελλαδικά'}</p>
     <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className={'rounded-full border px-3 py-1.5 text-xs font-bold '+(
       delivery.payable?'border-emerald-400/30 bg-emerald-400/10 text-emerald-200':
       'border-amber-400/30 bg-amber-400/10 text-amber-200')}>
       <Activity size={13} className="mr-1 inline"/>{status}</span>
      <span className="rounded-full border border-white/15 bg-white/[.05] px-3 py-1.5 text-xs text-zinc-300">
       {campaign.approvalStatus==='approved'?'Εγκεκριμένη':
        campaign.approvalStatus==='pending'?'Σε έγκριση':'Σε αναθεώρηση'}</span>
     </div>
     <p className="mt-3 max-w-xl text-xs leading-6 text-zinc-400">{statusHint}</p>
    </div>
    <div className="flex flex-wrap gap-2">
     <button type="button" disabled={busy||!canPause} className={button} onClick={toggle}>
      {campaign.agencyEnabled?<Pause size={16}/>:<Play size={16}/>}
      {campaign.agencyEnabled?'Παύση':'Επανενεργοποίηση'}
     </button>
     <button type="button" className={primary} onClick={()=>setTab('budget')}>
      <Wallet size={16}/> Αλλαγή budget
     </button>
    </div>
   </div>
   <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
    <Snapshot title="Επιβεβαιωμένη πίστωση" value={moneyNanos(analytics?.balance?.fundedNanos)} foot="Πίστωση από επιβεβαιωμένη πληρωμή" Icon={ShieldCheck}/>
    <Snapshot title="Διαθέσιμο v2" value={moneyNanos(analytics?.compatibleAvailableNanos)} foot="Υπόλοιπο για τον τρέχοντα τιμοκατάλογο" Icon={Wallet}/>
    <Snapshot title="Χρέωση σήμερα" value={moneyNanos(today.spentNanos)} foot="Από πραγματικά qualified events" Icon={ArrowDownRight}/>
    <Snapshot title="Υπόλοιπο ημέρας" value={moneyNanos(today.availableNanos)} foot="Μετά από χρεώσεις & κρατήσεις" Icon={Clock3}/>
   </div>
  </section>
  {error&&<div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"><CircleAlert size={18} className="shrink-0"/>{error}</div>}
  {message&&<div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 size={18} className="shrink-0"/>{message}</div>}
  <nav aria-label="Διαχείριση καμπάνιας" className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
   {tabs.map(([id,title,Icon])=><button type="button" key={id}
    aria-current={tab===id?'page':undefined}
    onClick={()=>setTab(id)}
    className={'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition sm:text-sm '+(
     tab===id?'bg-purple-500 text-white shadow-lg shadow-purple-900/20':
     'text-zinc-400 hover:bg-white/[.06] hover:text-white')}>
    <Icon size={16}/>{title}</button>)}
  </nav>
  {tab==='overview'&&<div className="space-y-4">
   <div className="flex flex-wrap items-center justify-between gap-3 px-1">
    <div><h4 className="text-lg font-black">Απόδοση σε πραγματικό χρόνο</h4>
     <p className="text-xs text-zinc-400">Χρεώσεις ανά spot, clicks και ολοκληρώσεις — χωρίς εκτιμήσεις.</p></div>
    <button type="button" onClick={()=>void load().catch(e=>setError(e.message))} className={button}>
     <RefreshCw size={16}/> Ανανέωση</button>
   </div>
   <AdvertisingV2CampaignStats campaign={campaign} onBudgetClick={()=>setTab('budget')}/>
   <div className="grid gap-3 md:grid-cols-2">
    <button type="button" onClick={()=>setTab('budget')} className={card+' flex items-center justify-between gap-4 text-left transition hover:border-purple-400/30'}>
     <div><p className="text-xs text-purple-300">Budget Control</p><strong className="mt-2 block text-lg">{moneyCents(info?.dailyBudgetCents)}</strong>
      <p className="mt-1 text-xs text-zinc-400">Άλλαξε το ημερήσιο όριο χωρίς top-up.</p></div><Wallet className="text-purple-300"/></button>
    <button type="button" onClick={()=>setTab('creatives')} className={card+' flex items-center justify-between gap-4 text-left transition hover:border-purple-400/30'}>
     <div><p className="text-xs text-purple-300">Δημιουργικά</p><strong className="mt-2 block text-lg">{(creatives?.audios?.length||0)+(creatives?.banners?.length||0)} spots / banners</strong>
      <p className="mt-1 text-xs text-zinc-400">Έλεγξε εγκεκριμένα και εκκρεμή δημιουργικά.</p></div><ImageIcon className="text-purple-300"/></button>
   </div>
  </div>}
  {tab==='budget'&&<div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
   <section className={card+' space-y-5'}>
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-purple-300">Budget Control</p>
      <h4 className="mt-2 text-xl font-black">Ημερήσιο όριο προβολών</h4>
      <p className="mt-2 max-w-xl text-xs leading-6 text-zinc-400">Αλλάζεις το όριο διάθεσης, όχι το συνολικό προπληρωμένο ποσό. Όλες οι προηγούμενες χρεώσεις διατηρούνται.</p></div>
     <span className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-xs text-zinc-300">Όριο {moneyCents(maxCents)}</span>
    </div>
    <label className="block text-sm font-bold text-white" htmlFor="agency-daily-limit">Νέο ημερήσιο budget</label>
    <div className="relative max-w-sm">
     <input id="agency-daily-limit" inputMode="decimal" type="text" value={draftLimit}
      onChange={e=>{setDraftLimit(e.target.value);setDirty(true);}}
      className="w-full rounded-2xl border border-purple-400/30 bg-[#0e0d14] px-4 py-4 pr-14 text-2xl font-black text-white outline-none focus:ring-2 focus:ring-purple-400/25"
      aria-describedby="agency-budget-preview"/>
     <span className="absolute right-5 top-5 text-lg text-zinc-400">€</span>
    </div>
    <input aria-label="Ρύθμιση ημερήσιου budget" type="range" min="0.01"
     max={Math.max(0.01,maxCents/100)} step="0.01"
     value={Math.max(0.01,Math.min(maxCents/100,Number(draftLimit.replace(',','.'))||0.01))}
     onChange={e=>{setDraftLimit(Number(e.target.value).toFixed(2));setDirty(true);}}
     className="w-full accent-purple-400"/>
    <div className="flex flex-wrap gap-2">{[2,5,10,20].filter(n=>n*100<=maxCents)
     .map(n=><button key={n} type="button" className={button+' min-h-9 px-3 text-xs'} onClick={()=>{setDraftLimit(n.toFixed(2));setDirty(true);}}>{n} €</button>)}</div>
    <div id="agency-budget-preview" className="grid grid-cols-2 gap-3">
     <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs text-zinc-400">Σήμερα δαπανήθηκαν / κρατήθηκαν</p>
      <strong className="mt-2 block text-lg">{moneyNanos(committedNanos)}</strong></div>
     <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs text-zinc-400">Νέο διαθέσιμο ημέρας</p>
      <strong className="mt-2 block text-lg">{validNewLimit?moneyNanos(availablePreview):'—'}</strong></div>
    </div>
    {needed>0&&<div className={'rounded-xl border px-4 py-3 text-xs leading-6 '+(
     validNewLimit&&availablePreview>=needed?'border-emerald-400/20 bg-emerald-400/[.06] text-emerald-200':
     'border-amber-400/25 bg-amber-400/[.06] text-amber-200')}>
     Απαιτούμενη προσωρινή κράτηση από {moneyNanos(needed)} για το φθηνότερο ενεργό placement.
     {validNewLimit&&availablePreview<needed?' Το νέο όριο δεν επαρκεί ακόμη για αυτήν την κράτηση.':''}
    </div>}
    {!validNewLimit&&<p role="alert" className="text-xs text-rose-300">Το όριο πρέπει να είναι θετικό, έως {moneyCents(maxCents)} και να καλύπτει τις σημερινές χρεώσεις και κρατήσεις.</p>}
    <div className="flex flex-wrap items-center gap-3">
     <button type="button" className={primary} disabled={busy||loading||!validNewLimit||!dirty||changingCents===info?.dailyBudgetCents}
      onClick={save}>{busy?'Αποθήκευση…':'Αποθήκευση ημερήσιου budget'}</button>
     <button type="button" className={button} disabled={busy||!dirty}
      onClick={()=>{setDraftLimit(((info?.dailyBudgetCents||0)/100).toFixed(2));setDirty(false);}}>Επαναφορά</button>
    </div>
    <p className="text-xs text-zinc-500">Η αλλαγή ισχύει άμεσα για νέα tickets. Οι ήδη δεσμευμένες χρεώσεις προστατεύονται από MongoDB transaction.</p>
   </section>
   <div className="space-y-4">
    <section className={card+' space-y-3'}>
     <h4 className="text-base font-black">Τι μπορεί να παίξει τώρα;</h4>
     {slots.length===0?<p className="text-sm text-zinc-400">Δεν υπάρχουν ενεργές θέσεις προβολής.</p>:
      slots.map(x=><div key={x.kind+':'+x.placement} className="flex items-center justify-between gap-3 border-b border-white/[.07] py-2 last:border-0">
       <div><p className="text-xs font-bold">{PLACE[x.placement]||x.placement}</p>
        <p className="text-[11px] text-zinc-500">Κράτηση {moneyNanos(x.requiredNanos)}</p></div>
       <span className={'rounded-full px-2.5 py-1 text-[10px] font-black '+(
        x.ready?'bg-emerald-400/10 text-emerald-300':'bg-amber-400/10 text-amber-200')}>
        {x.ready?'Επαρκές':'Ανεπαρκές'}</span>
      </div>)}
     <p className="text-[11px] leading-5 text-zinc-500">Η τελική προβολή εξαρτάται επιπλέον από geo, διαθέσιμο σταθμό και frequency caps.</p>
    </section>
    <section className={card+' space-y-3'}>
     <h4 className="text-base font-black">Ιστορικό αλλαγών</h4>
     {!info?.history?.length?<p className="text-xs text-zinc-500">Δεν έχουν γίνει αλλαγές ημερήσιου budget.</p>:
      info.history.map(row=><div key={row._id} className="border-b border-white/[.07] pb-2 text-xs last:border-0">
       <p className="font-semibold">{moneyCents(row.oldDailyBudgetCents)} → {moneyCents(row.newDailyBudgetCents)}</p>
       <p className="mt-1 text-zinc-500">{new Date(row.createdAt).toLocaleString('el-GR')}</p></div>)}
    </section>
   </div>
   {pricing&&<div className="xl:col-span-2"><AgencyCampaignTopUp campaign={campaign} pricing={pricing} onRefresh={async()=>{await onRefresh?.();await load();}}/></div>}
  </div>}
  {tab==='creatives'&&<section className={card+' space-y-4'}>
   <div><h4 className="text-xl font-black">Visual & Audio δημιουργικά</h4>
    <p className="mt-2 text-xs leading-6 text-zinc-400">Εμφανίζονται οι εγκεκριμένες και εκκρεμείς δημιουργίες. Οι αλλαγές σε πληρωμένα δημιουργικά περνούν από την κανονική έγκριση Admin.</p></div>
   <div className="grid gap-3 md:grid-cols-2">{[
    ...(creatives?.audios||[]).map(ad=>({...ad,kind:'audio'})),
    ...(creatives?.banners||[]).map(ad=>({...ad,kind:'banner'}))
   ].map(ad=><article key={ad._id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
    <div className="flex items-center justify-between gap-3">
     <span className="rounded-xl bg-purple-500/15 p-2.5 text-purple-200">
      {ad.kind==='audio'?<Volume2 size={19}/>:<ImageIcon size={19}/>}</span>
     <span className={'rounded-full px-3 py-1 text-xs font-bold '+(
      ad.status==='active'?'bg-emerald-400/10 text-emerald-200':'bg-amber-400/10 text-amber-200')}>
      {ad.status==='active'?'Ενεργό':ad.status==='pending'?'Σε έγκριση':ad.status==='rejected'?'Απορρίφθηκε':'Προσχέδιο'}</span>
    </div>
    <h5 className="mt-4 truncate text-base font-black">{ad.title}</h5>
    <p className="mt-2 text-xs text-zinc-400">{ad.kind==='audio'?
     (ad.frequencies?.length?ad.frequencies:[ad.frequency]).map(x=>PLACE[x]||x).join(' · '):
     (ad.placement||[]).map(x=>PLACE[x]||x).join(' · ')}</p>
    {ad.kind==='audio'?<div className="mt-4"><ProtectedAudioPreview adId={ad._id} scope="agency" sourceUrl={ad.audioUrl}/></div>:
     ad.imageUrl?<img src={ad.imageUrl} alt={ad.title} className="mt-4 h-36 w-full rounded-xl object-cover"/>:null}
   </article>)}</div>
  </section>}
  {tab==='settings'&&<section className={card+' space-y-5'}>
   <div><h4 className="text-xl font-black">Πρόγραμμα και στόχευση</h4>
    <p className="mt-2 text-sm text-zinc-400">Συνοπτικά όλα τα στοιχεία της καμπάνιας σε μία οθόνη.</p></div>
   <div className="grid gap-3 md:grid-cols-2">
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"><MapPin className="shrink-0 text-purple-300"/><div>
     <p className="text-xs text-zinc-400">Γεωγραφική στόχευση</p><strong className="mt-2 block text-sm">{[campaign.country,campaign.region==='All'?null:campaign.region,campaign.prefecture].filter(Boolean).join(' · ')}</strong></div></div>
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"><CalendarDays className="shrink-0 text-purple-300"/><div>
     <p className="text-xs text-zinc-400">Περίοδος προβολής</p><strong className="mt-2 block text-sm">{new Date(campaign.startsAt).toLocaleDateString('el-GR')} – {new Date(campaign.endsAt).toLocaleDateString('el-GR')}</strong></div></div>
   </div>
   <div className="rounded-xl border border-purple-400/20 bg-purple-500/[.06] p-4 text-xs leading-6 text-purple-100">
    <ShieldCheck size={17} className="mr-2 inline"/>Η πληρωμή, τα δημιουργικά και οι προηγούμενες χρεώσεις παραμένουν αμετάβλητα. Το Agency μπορεί να διαχειρίζεται το ημερήσιο budget και να παύει/επαναφέρει εγκεκριμένη καμπάνια.</div>
  </section>}
 </div>;
}
