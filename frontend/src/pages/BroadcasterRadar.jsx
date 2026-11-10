import React,{useCallback,useEffect,useState} from 'react';
import {Activity,BarChart3,Clock3,Headphones,MapPin,Radio,RefreshCw,
  ShieldCheck,Target,TrendingUp} from 'lucide-react';
import {Link} from 'react-router-dom';

const fmt=v=>new Intl.NumberFormat('el-GR').format(Number(v)||0);
const percent=v=>Math.min(100,Math.max(0,Number(v)||0));
async function readRadar(accountId,signal){
 const token=localStorage.getItem('iluma_token')||'';
 const response=await fetch('/api/broadcaster/'+encodeURIComponent(accountId)+'/analytics',{
  headers:{Authorization:'Bearer '+token},cache:'no-store',signal
 });
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(json.error||'Δεν ήταν δυνατή η φόρτωση του Audience Radar.');
 if(!json||typeof json!=='object'||!Number.isFinite(Number(json.liveListeners)))
  throw new Error('Μη έγκυρη απάντηση Analytics.');
 return json;
}
function Stat({icon:Icon,title,value,note}){
 return <section className="relative overflow-hidden rounded-[25px] border border-white/10 bg-[#14181b] p-6">
  <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-[#ccff00]/5 blur-3xl"/>
  <div className="flex items-center justify-between"><span className="text-xs font-bold text-zinc-400">{title}</span>
    <span className="rounded-xl bg-[#ccff00]/10 p-2.5 text-[#ccff00]"><Icon size={20}/></span></div>
  <p className="relative mt-7 text-4xl font-black tracking-tight text-white md:text-5xl">{value}</p>
  <p className="mt-3 text-xs leading-5 text-zinc-500">{note}</p>
 </section>;
}
function Locations({title,subtitle,icon:Icon,items=[],live=false}){
 return <section className="rounded-[28px] border border-white/10 bg-[#14181b] p-6 md:p-8">
   <div className="flex items-center gap-3"><div className="rounded-xl bg-[#ccff00]/10 p-3 text-[#ccff00]"><Icon size={21}/></div>
    <div><h3 className="text-lg font-black">{title}</h3><p className="mt-1 text-xs text-zinc-500">{subtitle}</p></div></div>
   <div className="mt-7 space-y-5">
     {!items.length&&<p className="rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-zinc-400">
      {live?'Δεν υπάρχουν ενεργές συνεδρίες με διαθέσιμη περιοχή αυτή τη στιγμή.':'Δεν υπάρχουν ακόμη επαρκή ιστορικά δεδομένα περιοχών.'}</p>}
     {items.slice(0,10).map((item,i)=><div key={item.city+'-'+i}>
      <div className="mb-2 flex justify-between gap-3 text-xs"><span className="truncate font-bold text-zinc-200">{i+1}. {item.city}</span>
       <strong className="tabular-nums text-[#ccff00]">{percent(item.percentage)}%</strong></div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[.07]">
       <div className="h-full rounded-full bg-[#ccff00]" style={{width:percent(item.percentage)+'%'}}/>
      </div>
     </div>)}
   </div>
 </section>;
}
export default function BroadcasterRadar({accountId}){
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');
 const [checkedAt,setCheckedAt]=useState(null);
 const update=useCallback(async signal=>{
  if(!accountId)return;
  setRefreshing(true);
  try{
   const result=await readRadar(accountId,signal);
   if(signal?.aborted)return;
   setData(result);setError('');setCheckedAt(new Date());
  }catch(e){if(!signal?.aborted)setError(e.message);}
  finally{if(!signal?.aborted){setLoading(false);setRefreshing(false);}}
 },[accountId]);
 useEffect(()=>{
  const controller=new AbortController();
  void update(controller.signal);
  // Read-only refresh: no provider calls and no financial actions.
  const timer=setInterval(()=>void update(controller.signal),15000);
  return()=>{controller.abort();clearInterval(timer)};
 },[update]);
 return <div className="mx-auto max-w-[1300px] space-y-7 pb-16 text-white">
  <header className="relative overflow-hidden rounded-[30px] border border-sky-400/15 bg-gradient-to-br from-[#14222b] via-[#15191b] to-[#0a0d0d] p-7 md:p-11">
   <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-sky-400/10 blur-[80px]"/>
   <div className="relative">
    <span className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/20 bg-[#ccff00]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.2em] text-[#ccff00]">
      <Activity size={14}/> AUDIENCE RADAR · PRO
    </span>
    <h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">Το κοινό σου, σε πραγματικό χρόνο.</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">
     Παρακολούθησε τους live ακροατές και τα στατιστικά των σταθμών σου με ενεργό Analytics ή Broadcaster Premium. Η πρόσβαση επιβεβαιώνεται από τον server ανά σταθμό.
    </p>
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-300">
       <span className="size-2 animate-pulse rounded-full bg-emerald-400"/> Live δεδομένα
      </span>
      {checkedAt&&<span className="text-xs text-zinc-400">Τελευταία ενημέρωση: {checkedAt.toLocaleTimeString('el-GR')}</span>}
      <button type="button" disabled={refreshing} onClick={()=>void update()}
       className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50">
       <RefreshCw className={refreshing?'animate-spin':''} size={15}/> Ανανέωση
      </button>
    </div>
   </div>
  </header>
  {error&&<p role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-200">{error}</p>}
  {loading?<div role="status" className="rounded-3xl border border-white/10 bg-[#14181b] p-10 text-sm text-zinc-300">Ανάκτηση live ακροατών και στατιστικών…</div>:
  data&&<>
   <div className="grid gap-4 md:grid-cols-3">
    <Stat icon={Headphones} title="Live ακροατές" value={fmt(data.liveListeners)}
     note="Ενεργές συνεδρίες ακρόασης στο iRadios αυτή τη στιγμή"/>
    <Stat icon={Clock3} title="Μέση διάρκεια ακρόασης" value={data.avgListenTime||'—'}
     note="Υπολογισμός από καταγεγραμμένες συνεδρίες"/>
    <Stat icon={Target} title="Εμφανίσεις διαφημίσεων" value={fmt(data.adStats?.totalImpressions)}
     note="Καταγεγραμμένες εμφανίσεις στατιστικών διαφημίσεων"/>
   </div>
   <div className="grid gap-5 lg:grid-cols-2">
    <Locations title="Περιοχές ακρόασης" subtitle="Ιστορική γεωγραφική κατανομή" icon={BarChart3}
      items={data.topOrigins||[]}/>
    <Locations title="Πού ακούν τώρα" subtitle="Περιοχές από ενεργές συνεδρίες που διαθέτουν τοποθεσία" icon={MapPin}
      items={data.liveLocations||[]} live/>
   </div>
   <section className="rounded-[28px] border border-white/10 bg-[#14181b] p-7">
    <h3 className="flex items-center gap-2 text-lg font-black"><Radio size={20} className="text-[#ccff00]"/> Αξιοποίηση δεδομένων</h3>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
     Τα live δεδομένα αφορούν τις ενεργές ακροάσεις και ανανεώνονται κάθε 15 δευτερόλεπτα.
     Η γεωγραφική εικόνα περιλαμβάνει μόνο συνεδρίες με διαθέσιμη περιοχή, επομένως μπορεί να διαφέρει από το συνολικό live πλήθος.
    </p>
    <Link to="/backoffice/pro-features" className="mt-5 inline-flex items-center gap-2 text-xs font-black text-[#ccff00]">
     Δες τα υπόλοιπα Pro Features <TrendingUp size={15}/>
    </Link>
   </section>
  </>}
 </div>;
}
