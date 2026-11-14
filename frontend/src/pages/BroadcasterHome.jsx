import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {Activity,ArrowRight,BarChart3,CheckCircle2,Clock3,ExternalLink,
  Gauge,Headphones,LockKeyhole,Radio,RefreshCw,ShieldAlert,SlidersHorizontal,
  Sparkles,TriangleAlert,WifiOff} from 'lucide-react';

const authHeaders=()=>({Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')});
const fmt=value=>new Intl.NumberFormat('el-GR').format(Number(value)||0);
const modeNames={OFF:'OFF',ENHANCER:'Enhanced',FM_MODE:'FM Mode',AUTO_MODE:'Auto'};
const slowAfterMs=2000;
const card='relative min-w-0 overflow-hidden rounded-[25px] border border-white/10 bg-gradient-to-br from-[#191e20] to-[#111518] p-5 shadow-[0_18px_45px_rgba(0,0,0,.12)] md:p-6';

function SummaryCard({icon:Icon,title,value,note,tone='lime',to,locked=false,loading=false}){
 const tones={
  lime:'text-[#caff00] bg-[#caff00]/10',
  pink:'text-pink-300 bg-pink-400/10',
  violet:'text-violet-300 bg-violet-400/10',
  sky:'text-sky-300 bg-sky-400/10'
 };
 const selected=tones[tone]||tones.lime;
 return <section className={card+(locked?' border-[#caff00]/20':'')}>
  <div className={'pointer-events-none absolute -right-12 -top-16 size-36 rounded-full blur-[58px] '+(locked?'bg-[#caff00]/[.08]':'bg-white/[.035]')}/>
  <div className="relative flex min-h-10 items-start justify-between gap-2">
   <h3 className="pt-1 text-xs font-bold leading-5 text-zinc-300">{title}</h3>
   <span className={'flex size-10 shrink-0 items-center justify-center rounded-2xl '+selected}>
    {locked?<LockKeyhole size={19}/>:<Icon size={20}/>}
   </span>
  </div>
  {loading?<div className="mt-7 h-10 w-24 animate-pulse rounded-lg bg-white/10" aria-label="Φόρτωση"/>:
   locked?<div className="relative mt-5 min-h-[62px]">
     <p className="flex items-center gap-2 text-lg font-black text-[#caff00]"><LockKeyhole size={17}/> Κλειδωμένο</p>
     <p className="mt-2 text-[11px] leading-5 text-zinc-400">Απαιτείται ενεργό add-on</p>
   </div>:
   <p className="relative mt-5 break-words text-3xl font-black tracking-[-.055em] text-white md:text-4xl">{value??'—'}</p>}
  {!locked&&<p className="relative mt-2 min-h-5 text-[11px] leading-5 text-zinc-500">{note}</p>}
  {to&&<Link to={to} aria-label={(locked?'Ενεργοποίηση ':'Προβολή ')+title}
    className="relative mt-4 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#caff00] hover:text-white">
    {locked?'Δες τα Add-ons':'Περισσότερα'} <ArrowRight size={14}/>
   </Link>}
 </section>;
}

function StreamPanel({stations=[]}){
 const eligible=useMemo(()=>stations.filter(s=>s.status==='approved'&&s.stream),[stations]);
 const [selectedId,setSelectedId]=useState('');
 const [refreshKey,setRefreshKey]=useState(0);
 const [state,setState]=useState({status:'idle',result:null,error:'',checkedAt:null});
 const selected=eligible.find(s=>s.id===selectedId)||eligible[0];
 useEffect(()=>{
  if(!selected?.stream){setState({status:'idle',result:null,error:'',checkedAt:null});return;}
  const controller=new AbortController();
  setState({status:'loading',result:null,error:'',checkedAt:null});
  fetch('/api/backoffice/stream-diagnostics',{
   method:'POST',headers:{...authHeaders(),'Content-Type':'application/json'},
   body:JSON.stringify({stream:selected.stream}),cache:'no-store',signal:controller.signal
  }).then(async response=>{
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(body.error||'Ο έλεγχος του stream απέτυχε.');
   if(!body.stream)throw new Error('Μη έγκυρη απάντηση ελέγχου stream.');
   if(!controller.signal.aborted)setState({status:'ready',result:body.stream,error:'',checkedAt:new Date()});
  }).catch(error=>{
   if(!controller.signal.aborted)setState({status:'error',result:null,error:error.message,checkedAt:null});
  });
  return()=>controller.abort();
 },[selected?.id,selected?.stream,refreshKey]);
 const info=state.result;
 const slow=state.status==='ready'&&info.reachable&&Number(info.responseMs)>=slowAfterMs;
 const offline=state.status==='ready'&&!info.reachable;
 const healthy=state.status==='ready'&&info.reachable&&!slow;
 const alert=slow||offline;
 const name=selected?.name||'του σταθμού';
 const responseTime=Number.isFinite(Number(info?.responseMs))?fmt(info.responseMs)+' ms':'—';
 const bitrate=Number(info?.bitrateKbps)>0?fmt(info.bitrateKbps)+' kbps':'—';
 return <section aria-label="Stream Status"
  className={'relative overflow-hidden rounded-[29px] border bg-gradient-to-br from-[#171f20] via-[#13191a] to-[#121518] p-5 shadow-[0_20px_70px_rgba(0,0,0,.18)] md:p-7 '+
   (alert?'border-rose-500/30':'border-[#caff00]/15')}>
  <div className={'pointer-events-none absolute -right-32 -top-28 size-96 rounded-full blur-[100px] '+(alert?'bg-rose-500/[.14]':'bg-[#caff00]/[.08]')}/>
  <div className="relative mb-6 flex flex-wrap items-center justify-between gap-4">
   <div className="flex items-center gap-3">
    <span className="flex size-12 items-center justify-center rounded-2xl bg-[#caff00]/10 text-[#caff00]"><Radio size={24}/></span>
    <div><h2 className="text-xl font-black tracking-tight text-white md:text-2xl">Stream Status</h2>
     <p className="mt-1 text-xs text-zinc-400">Έλεγχος απόκρισης του πραγματικού streaming server</p></div>
   </div>
   <div className="flex min-w-0 flex-wrap items-center gap-2">
    {eligible.length>1&&<label className="sr-only" htmlFor="stream-station">Σταθμός για έλεγχο</label>}
    {eligible.length>1&&<select id="stream-station" value={selected?.id||''}
      onChange={event=>setSelectedId(event.target.value)}
      className="max-w-[220px] rounded-xl border border-white/15 bg-[#101516] px-3 py-2.5 text-xs font-semibold text-white">
      {eligible.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
     </select>}
    {selected&&<button type="button" onClick={()=>setRefreshKey(n=>n+1)} disabled={state.status==='loading'}
      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.055] px-3 py-2.5 text-xs font-bold text-zinc-200 hover:border-[#caff00]/40 disabled:opacity-50">
      <RefreshCw size={15} className={state.status==='loading'?'animate-spin':''}/> Επανέλεγχος
     </button>}
   </div>
  </div>
  {!eligible.length?<p className="relative rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-zinc-300">
   Δεν υπάρχει ακόμη εγκεκριμένος σταθμός με καταχωρημένο stream για έλεγχο.</p>:
  <div className="relative grid gap-4 xl:grid-cols-[1.35fr_1fr]">
   <div className={'rounded-[22px] border p-5 md:p-6 '+(offline||slow?'border-rose-500/30 bg-rose-500/[.07]':
    'border-[#caff00]/20 bg-[#caff00]/[.045]')}>
    <div className="flex flex-wrap items-center gap-3">
     {state.status==='loading'?<RefreshCw size={24} className="animate-spin text-[#caff00]"/>:
      offline?<WifiOff size={25} className="text-rose-300"/>:
      slow?<TriangleAlert size={25} className="text-rose-300"/>:
      healthy?<CheckCircle2 size={25} className="text-[#caff00]"/>:
      <Activity size={25} className="text-zinc-400"/>}
     <div className="min-w-0">
      <p className="break-words text-base font-black text-white md:text-lg">{selected.name}</p>
      <p role="status" className={'mt-1 text-sm font-bold '+(alert?'text-rose-300':'text-[#caff00]')}>
       {state.status==='loading'?'Ελέγχουμε την απόκριση…':
        state.status==='error'?'Ο έλεγχος δεν ολοκληρώθηκε':
        offline?'Το stream δεν απαντά':
        slow?'Αργό loading':'Ο streaming server ανταποκρίνεται'}
      </p>
     </div>
    </div>
    <div className="mt-6 grid grid-cols-2 gap-5 border-t border-white/10 pt-5 sm:grid-cols-3">
     <div><p className="text-[11px] text-zinc-400">Απόκριση HTTP</p>
      <p className={'mt-2 text-xl font-black tabular-nums '+(slow||offline?'text-rose-300':'text-[#caff00]')}>
       {state.status==='ready'?responseTime:'—'}</p></div>
     <div><p className="text-[11px] text-zinc-400">Bitrate</p>
      <p className="mt-2 text-xl font-black tabular-nums text-white">{state.status==='ready'?bitrate:'—'}</p></div>
     <div><p className="text-[11px] text-zinc-400">Διαθεσιμότητα</p>
      <p className={'mt-2 text-xl font-black '+(offline?'text-rose-300':healthy||slow?'text-[#caff00]':'text-white')}>
       {state.status==='ready'?(info.reachable?'Online':'Offline'):'—'}</p></div>
    </div>
    {state.status==='error'&&<p role="alert" className="mt-4 text-xs text-rose-300">{state.error}</p>}
    {state.checkedAt&&<p className="mt-4 text-[10px] text-zinc-500">
      Τελευταίος έλεγχος: {state.checkedAt.toLocaleTimeString('el-GR')} · Ο έλεγχος HTTP δεν εγγυάται αναπαραγωγή ή διαθεσιμότητα 24/7.
     </p>}
   </div>
   <div className={'flex flex-col justify-center rounded-[22px] border p-5 md:p-6 '+(alert?
    'border-rose-400/30 bg-rose-500/[.08]':'border-white/10 bg-white/[.025]')}>
    <div className="mb-3 flex items-center gap-2">
     {alert?<Gauge size={21} className="text-rose-300"/>:<ShieldAlert size={21} className="text-[#caff00]"/>}
     <h3 className="text-base font-black text-white">
      {slow?'Το Stream του '+name+' είναι πολύ αργό.':
       offline?'Το Stream του '+name+' δεν είναι διαθέσιμο.':
       'Η ταχύτητα του stream μετράει.'}
     </h3>
    </div>
    <p className="text-xs leading-6 text-zinc-300">
     {slow?'71% των ακροατών, προσπερνούν ραδιόφωνα που αργούν να φορτώσουν τον ήχο, νομίζοντας ότι δεν παίζει.':
      offline?'Ο streaming server δεν απάντησε στον έλεγχο. Έλεγξε τη διεύθυνση του stream ή μίλησε μαζί μας για να το εξετάσουμε.':
      'Οι γρήγορες αποκρίσεις βοηθούν τους ακροατές να ξεκινήσουν αμέσως την ακρόαση. Εάν αντιμετωπίζεις καθυστερήσεις, μπορούμε να βοηθήσουμε.'}
    </p>
    <p className="mt-3 text-xs font-semibold text-zinc-300">Μίλα μαζί μας να σου βρούμε μια γρήγορη λύση streaming.</p>
    <a href="https://iluma.gr/contact" target="_blank" rel="noopener noreferrer"
      className={'mt-4 inline-flex w-fit items-center gap-2 rounded-xl px-5 py-3 text-xs font-black transition hover:brightness-110 '+(alert?
       'bg-rose-400 text-[#210b15]':'bg-[#caff00] text-[#111600]')}>
      Μίλα μαζί μας <ExternalLink size={15}/>
    </a>
   </div>
  </div>}
 </section>;
}

export default function BroadcasterHome({data}){
 const [metrics,setMetrics]=useState(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const fetchMetrics=useCallback(async signal=>{
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/backoffice/broadcaster-dashboard',{
    headers:authHeaders(),cache:'no-store',signal
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||'Δεν ήταν δυνατή η ανάκτηση των δεδομένων.');
   if(signal?.aborted)return;
   setMetrics(result);
  }catch(err){if(!signal?.aborted){setMetrics(null);setError(err.message);}}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{
  const controller=new AbortController();
  void fetchMetrics(controller.signal);
  return()=>controller.abort();
 },[fetchMetrics]);
 const counts=data.counts||{};
 const pending=(Number(counts.pendingApproval)||0)+(Number(counts.pendingEdits)||0);
 const dsp=metrics?.dsp;
 const plays=metrics?.appPlays;
 return <div className="space-y-7 pb-8 text-white">
  <StreamPanel stations={metrics?.stations||[]}/>
  {error&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-5 py-4 text-xs text-rose-200">
   <span>{error}</span><button type="button" className="font-bold underline" onClick={()=>void fetchMetrics()}>Επανάληψη</button>
  </div>}
  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
   <SummaryCard icon={Radio} title="Σταθμοί" value={fmt(counts.total)}
    note="Στο επίπεδο πρόσβασής σου" tone="lime" to="/backoffice/stations"/>
   <SummaryCard icon={Clock3} title="Εκκρεμότητες" value={fmt(pending)}
    note="Καταχωρήσεις και αλλαγές σε αναμονή" tone="pink" to="/backoffice/stations"/>
   <SummaryCard icon={SlidersHorizontal} title="DSP Mode" tone="violet"
    loading={loading||Boolean(error)}
    locked={!loading&&!error&&!dsp?.enabled}
    value={dsp?.enabled?(modeNames[dsp.mode]||'—'):null}
    note={dsp?.enabled?'Σταθμός: '+dsp.stationName:''}
    to={dsp?.enabled?'/backoffice/audio':'/backoffice/pro-features'}/>
   <SummaryCard icon={Headphones} title="Συνολικές ακροάσεις στο App" tone="sky"
    loading={loading||Boolean(error)}
    locked={!loading&&!error&&!plays?.enabled}
    value={plays?.enabled?fmt(plays.total):null}
    note={plays?.enabled?'Καταγεγραμμένα plays · '+fmt(plays.stationCount)+' σταθμός/οί με Audience Radar':''}
    to={plays?.enabled?'/backoffice/radar':'/backoffice/pro-features'}/>
  </div>
  <section>
   <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#caff00]">Quick actions</p>
   <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">Τι θέλεις να κάνεις;</h2>
   <div className="mt-5 grid gap-3 md:grid-cols-3">
    {[
     {to:'/backoffice/stations',title:'Διαχείριση σταθμών',desc:'Επεξεργασία στοιχείων και stream',icon:Radio},
     {to:'/backoffice/boost',title:'Boost My Radio',desc:'Αύξησε την προβολή του σταθμού σου',icon:Sparkles},
     {to:'/backoffice/pro-features',title:'Αναβάθμιση & Add-ons',desc:'Audience Radar, WebDSP και άλλα',icon:BarChart3}
    ].map(item=><Link key={item.to} to={item.to}
     className="group flex items-center gap-3 rounded-[21px] border border-white/10 bg-[#171a1c] p-4 transition hover:border-[#caff00]/35 hover:bg-[#1c2421]">
     <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#caff00]/10 text-[#caff00]">
      <item.icon size={21}/></span>
     <span className="min-w-0 flex-1"><strong className="block text-sm text-white">{item.title}</strong>
      <small className="mt-1 block text-[11px] leading-5 text-zinc-400">{item.desc}</small></span>
     <ArrowRight size={17} className="shrink-0 text-zinc-500 transition group-hover:translate-x-1 group-hover:text-[#caff00]"/>
    </Link>)}
   </div>
  </section>
 </div>;
}
