import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {Activity,ArrowRight,BarChart3,CheckCircle2,Clock3,FileCheck2,
 LayoutGrid,Mic2,Plus,RefreshCw,ShieldCheck,Wallet} from 'lucide-react';

const panel='rounded-[26px] border border-white/[.085] bg-[#14121c]';
const primary='inline-flex items-center justify-center gap-2 rounded-xl bg-purple-500 px-5 py-3 text-[12px] font-black text-white transition hover:bg-purple-400';
const euros=micros=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(Number(micros||0)/1e6);
const fmt=n=>new Intl.NumberFormat('el-GR').format(n||0);
const approvalText={draft:'Draft',pending:'Προς έγκριση',approved:'Εγκεκριμένη',rejected:'Απορρίφθηκε'};
function Metric({icon:Icon,title,value,detail}){
 return <div className={panel+' relative overflow-hidden p-5 sm:p-6'}>
  <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-zinc-400">{title}</p><span className="rounded-xl bg-purple-500/10 p-2.5 text-purple-300"><Icon size={19}/></span></div>
  <p className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">{value}</p>
  <p className="mt-2 text-xs leading-5 text-zinc-500">{detail}</p>
 </div>;
}
export default function AgencyBackofficeHome({user}){
 const [campaigns,setCampaigns]=useState([]);
 const [status,setStatus]=useState('loading');
 const [error,setError]=useState('');
 const load=useCallback(async(signal)=>{
  setStatus('loading');setError('');
  try{
   const response=await fetch('/api/advertising/campaigns',{
    headers:{Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')},
    cache:'no-store',signal});
   const data=await response.json().catch(()=>null);
   if(!response.ok||!Array.isArray(data))
    throw Error(data?.error||'Δεν φορτώθηκαν οι καμπάνιες.');
   if(!signal?.aborted){setCampaigns(data);setStatus('ready');}
  }catch(e){
   if(!signal?.aborted){setError(e.message||'Αποτυχία φόρτωσης.');setStatus('error');}
  }
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
 const metrics=useMemo(()=>({
  total:campaigns.length,
  pending:campaigns.filter(c=>c.approvalStatus==='pending').length,
  approved:campaigns.filter(c=>c.approvalStatus==='approved').length,
  balance:campaigns.reduce((sum,c)=>sum+Number(c.budget?.remainingMicros||0),0)
 }),[campaigns]);
 const recent=[...campaigns].sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0)).slice(0,4);
 return <div className="space-y-8">
  <header className="relative overflow-hidden rounded-[30px] border border-purple-400/25 bg-gradient-to-br from-[#29183f] via-[#171421] to-[#121318] p-7 sm:p-10">
   <div className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-purple-500/20 blur-[75px]"/>
   <div className="relative flex flex-wrap items-end justify-between gap-7">
    <div className="max-w-2xl">
     <span className="inline-flex items-center gap-2 rounded-full border border-purple-300/30 bg-purple-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-purple-200"><Activity size={14}/> iRadios Ad Network</span>
     <h1 className="mt-5 text-3xl font-black tracking-[-.05em] text-white sm:text-5xl">Το Agency σου.<br/><span className="text-purple-300">Όλα σε ένα μέρος.</span></h1>
     <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300">Καλώς ήρθες{user?.fname?' '+user.fname:''}. Δημιούργησε ενιαίες καμπάνιες, διαχειρίσου visual και audio δημιουργικά, δες εγκρίσεις και διαθέσιμο budget.</p>
    </div>
    <Link to="/backoffice/agency/campaigns" className={primary}><Plus size={17}/> Νέα καμπάνια <ArrowRight size={16}/></Link>
   </div>
  </header>

  {status==='error'&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/25 bg-red-400/[.07] p-4 text-sm text-red-200"><span>{error}</span><button type="button" onClick={()=>load()} className="font-black underline">Επανάληψη</button></div>}
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
   <Metric icon={LayoutGrid} title="Ενιαίες καμπάνιες" value={status==='loading'?'…':fmt(metrics.total)} detail="Οι καμπάνιες του Agency"/>
   <Metric icon={Clock3} title="Προς έγκριση" value={status==='loading'?'…':fmt(metrics.pending)} detail="Σε αναμονή ελέγχου Admin"/>
   <Metric icon={CheckCircle2} title="Εγκεκριμένες" value={status==='loading'?'…':fmt(metrics.approved)} detail="Με εγκεκριμένη κατάσταση"/>
   <Metric icon={Wallet} title="Διαθέσιμο budget" value={status==='loading'?'…':euros(metrics.balance)} detail="Επιβεβαιωμένα διαθέσιμα ποσά"/>
  </div>

  <section>
   <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[.23em] text-purple-300">Quick actions</p><h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Τι θέλεις να κάνεις;</h2></div>
   <div className="grid gap-4 md:grid-cols-3">
    {[
     {to:'/backoffice/agency/campaigns',icon:FileCheck2,title:'Καμπάνιες & budget',desc:'Drafts, ενεργοποίηση, στόχευση, top-up και αναλυτικά οικονομικά.'},
     {to:'/backoffice/agency/creatives',icon:Mic2,title:'Τα δημιουργικά μου',desc:'Προεπισκόπηση, ιστορικό αλλαγών, visual και audio spots.'},
     {to:'/go-ads',icon:BarChart3,title:'Δες το Ad Network',desc:'Η δημόσια παρουσίαση των θέσεων προβολής και του δικτύου.'}
    ].map(item=><Link to={item.to} key={item.title} className={panel+' group flex flex-col justify-between p-6 transition hover:border-purple-400/40 hover:bg-[#21192c]'}>
     <div className="flex items-center justify-between"><span className="rounded-xl bg-purple-500/10 p-3 text-purple-300"><item.icon size={22}/></span><ArrowRight className="text-zinc-500 transition group-hover:translate-x-1 group-hover:text-purple-200" size={18}/></div>
     <div className="mt-6"><h3 className="text-lg font-black text-white">{item.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{item.desc}</p></div>
    </Link>)}
   </div>
  </section>

  <section className={panel+' p-5 sm:p-7'}>
   <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-purple-300">Campaigns</p><h2 className="mt-2 text-xl font-black text-white">Πρόσφατες καμπάνιες</h2></div>
    <Link to="/backoffice/agency/campaigns" className="inline-flex items-center gap-2 text-xs font-black text-purple-200 hover:text-white">Προβολή όλων <ArrowRight size={15}/></Link></div>
   {status==='loading'&&<p role="status" className="inline-flex items-center gap-2 text-sm text-zinc-400"><RefreshCw size={16} className="animate-spin"/> Φόρτωση καμπανιών…</p>}
   {status==='ready'&&recent.length===0&&<p className="rounded-2xl border border-dashed border-white/15 p-7 text-center text-sm text-zinc-400">Δεν υπάρχει ακόμα καμπάνια. Ξεκίνα με τη δημιουργία ενός draft.</p>}
   <div className="space-y-2">{recent.map(c=><Link key={c._id} to="/backoffice/agency/campaigns" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[.06] bg-black/20 p-4 transition hover:border-purple-400/25">
    <div className="flex min-w-0 items-center gap-3"><span className="shrink-0 rounded-xl bg-purple-500/10 p-2.5 text-purple-300"><FileCheck2 size={18}/></span>
     <div className="min-w-0"><p className="truncate text-sm font-black text-white">{c.title}</p><p className="mt-1 text-xs text-zinc-500">{c.brand||'Agency'} · {c.prefecture||c.region||'Ελλάδα'}</p></div></div>
    <div className="flex items-center gap-3"><span className="text-xs font-bold text-purple-200">{approvalText[c.approvalStatus]||c.approvalStatus}</span><ArrowRight size={17} className="text-zinc-500"/></div>
   </Link>)}</div>
  </section>
  <p className="flex items-start gap-2 text-xs leading-6 text-zinc-500"><ShieldCheck size={16} className="mt-1 shrink-0 text-purple-300"/> Οι πληρωμές Nexi και η πληρωμένη προβολή Advertising v2 δεν είναι ακόμη ενεργές στο staging. Η δημιουργία draft δεν δημιουργεί χρέωση.</p>
 </div>;
}
