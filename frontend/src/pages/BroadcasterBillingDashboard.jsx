import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,CheckCircle2,Clock3,CreditCard,FileText,RefreshCcw,
  ShieldCheck,SquareArrowOutUpRight,Wallet,XCircle} from 'lucide-react';

const headers=()=>({Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')});
async function call(path,options={}){
 const res=await fetch('/api'+path,{...options,headers:{
  ...headers(),...(options.body?{'Content-Type':'application/json'}:{}),...options.headers
 },cache:'no-store'});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error||'Δεν ήταν δυνατή η ολοκλήρωση της ενέργειας.');
 return data;
}
const money=cents=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format((Number(cents)||0)/100);
const date=value=>value?new Intl.DateTimeFormat('el-GR',{dateStyle:'medium',timeStyle:'short',
 timeZone:'Europe/Athens'}).format(new Date(value)):'—';
const ongoing=status=>['creating','pending','redirect','unknown'].includes(status);
const recurringStates=['active','pending','verification_pending','past_due'];
const labels={active:'Ενεργή',expired:'Έληξε',scheduled:'Προγραμματισμένη',
 pending:'Σε αναμονή',creating:'Προετοιμασία',redirect:'Σε πληρωμή',
 unknown:'Αναμονή διασταύρωσης',failed:'Απέτυχε',canceled:'Ακυρώθηκε'};
export default function BroadcasterBillingDashboard({stations=[]}){
 const [orders,setOrders]=useState([]),[catalog,setCatalog]=useState({});
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState('');
 const [mandates,setMandates]=useState({}),[confirm,setConfirm]=useState(null);
 const refresh=async()=>{
  const [a,b]=await Promise.all([
   call('/billing/broadcaster/orders'),call('/billing/catalog')
  ]);
  setOrders(a.orders||[]);
  setCatalog(Object.fromEntries((b.products||[]).map(p=>[p.sku,p])));
 };
 useEffect(()=>{let alive=true;setLoading(true);
  refresh().catch(e=>{if(alive)setError(e.message)})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[]);
 const stationName=id=>stations.find(s=>String(s._id)===String(id))?.name||
  (id?'Σταθμός '+String(id).slice(-6):'Ο λογαριασμός μου');
 const key=row=>row.sku+':'+String(row.stationId||'account');
 const loadMandate=async row=>{
  const id=key(row);setBusy('mandate-'+id);
  try{
   const qs=new URLSearchParams({sku:row.sku,...(row.stationId?{stationId:row.stationId}:{})});
   const data=await call('/billing/broadcaster/recurring?'+qs);
   setMandates(prev=>({...prev,[id]:data.recurring}));
  }catch(e){setNotice(e.message);}
  finally{setBusy('');}
 };
 const inspect=async row=>{
  setBusy(row.id);setNotice('');
  try{
   const result=await call('/billing/broadcaster/orders/'+encodeURIComponent(row.id)+'?refresh=1');
   setOrders(prev=>prev.map(o=>o.id===row.id?result.order:o));
   setNotice(result.order?.status==='active'?
    'Η πληρωμή επιβεβαιώθηκε από το Gateway και η περίοδος είναι ενεργή.':
    'Ο έλεγχος ολοκληρώθηκε. Τα προνόμια ενεργοποιούνται μόνο με signed payment.paid webhook.');
  }catch(e){setNotice(e.message);}
  finally{setBusy('');}
 };
 const cancel=async()=>{
  if(!confirm||busy)return;
  setBusy('cancel');setNotice('');
  try{
   const result=await call('/billing/broadcaster/recurring/cancel',{
    method:'POST',body:JSON.stringify({
     sku:confirm.sku,...(confirm.stationId?{stationId:confirm.stationId}:{})
    })
   });
   setMandates(prev=>({...prev,[key(confirm)]:result.recurring}));
   setConfirm(null);
   setNotice('Η αυτόματη ανανέωση ακυρώθηκε στο Gateway. Η πληρωμένη περίοδος παραμένει ενεργή μέχρι τη λήξη.');
  }catch(e){setNotice(e.message)}
  finally{setBusy('')}
 };
 const activeSubs=orders.filter(o=>o.status==='active'&&!o.sku.startsWith('BOOST-'));
 const activeBoosts=orders.filter(o=>o.status==='active'&&o.sku.startsWith('BOOST-'));
 return <div className="mx-auto max-w-[1250px] space-y-7 pb-16 text-white">
  <header className="rounded-[30px] border border-[#ccff00]/20 bg-gradient-to-br from-[#1e281a] to-[#111619] p-7 md:p-11">
   <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-[#ccff00]"><Wallet size={15}/> IRADIOS / BROADCASTER BILLING</span>
   <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">Οι συνδρομές μου</h1>
   <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300">Όλες οι αγορές Broadcaster σε ένα μέρος. Παρακολούθησε την κατάσταση χρέωσης, ανανέωσης και τις ημερομηνίες λήξης. Η διακοπή ανανέωσης δεν διαγράφει την ήδη πληρωμένη περίοδο.</p>
   <div className="mt-7 flex flex-wrap gap-3">
    <Link to="/backoffice/pro-features" className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-5 py-3 text-xs font-black text-black">Δες τα Pro Features <ArrowRight size={15}/></Link>
    <Link to="/backoffice/boost" className="rounded-xl border border-white/20 px-5 py-3 text-xs font-black">Αγορά Boost</Link>
   </div>
  </header>
  {notice&&<div role="status" className="rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/[.06] p-4 text-sm text-zinc-200">{notice}</div>}
  {loading?<p role="status" className="p-10 text-sm text-zinc-300">Φόρτωση συναλλαγών…</p>:
   error?<div role="alert" className="rounded-xl border border-rose-400/30 p-6 text-sm text-rose-300">{error}</div>:<>
   <div className="grid gap-4 sm:grid-cols-3">
    {[{label:'Ενεργές πληρωμένες συνδρομές',value:activeSubs.length,icon:ShieldCheck},
      {label:'Ενεργά αγορασμένα Boost',value:activeBoosts.length,icon:CheckCircle2},
      {label:'Συναλλαγές στη λίστα',value:orders.length,icon:CreditCard}]
     .map(m=><div key={m.label} className="rounded-[24px] border border-white/10 bg-[#131718] p-6">
      <m.icon className="text-[#ccff00]" size={22}/>
      <p className="mt-5 text-3xl font-black">{m.value}</p>
      <p className="mt-2 text-xs text-zinc-400">{m.label}</p>
     </div>)}
   </div>
   <div className="flex items-center justify-between gap-3">
    <h2 className="text-2xl font-black">Ιστορικό αγορών</h2>
    <button onClick={()=>void refresh().catch(e=>setNotice(e.message))}
     type="button" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold"><RefreshCcw size={15}/> Ανανέωση</button>
   </div>
   {!orders.length?<div className="rounded-3xl border border-white/10 bg-[#131718] p-10 text-center">
    <CreditCard className="mx-auto text-zinc-500" size={32}/>
    <p className="mt-4 font-bold">Δεν υπάρχουν ακόμα αγορές Broadcaster.</p>
    <Link to="/backoffice/pro-features" className="mt-3 inline-flex text-xs font-black text-[#ccff00] underline">Εξερεύνησε τα Pro Features</Link>
   </div>:
   <div className="space-y-3">{orders.map(row=>{
    const sub=!row.sku.startsWith('BOOST-');
    const mandate=mandates[key(row)];
    return <article key={row.id} className="rounded-[22px] border border-white/10 bg-[#131718] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
       <div className="flex min-w-0 items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/[.07] text-[#ccff00]">
         {sub?<CreditCard size={20}/>:<Clock3 size={20}/>}</div>
        <div><p className="text-base font-black">{catalog[row.sku]?.title||row.sku}</p>
         <p className="mt-1 text-xs text-zinc-400">{stationName(row.stationId)}</p>
         <p className="mt-2 text-xs text-zinc-500">{sub?'Μηνιαία συνδρομή':'Εφάπαξ αγορά'} · {row.sku}</p>
        </div>
       </div>
       <div className="text-right"><p className="text-lg font-black">{money(row.amountCents)}</p>
        <p className={'mt-2 text-xs font-black '+(row.status==='active'?'text-[#ccff00]':'text-zinc-400')}>
          {labels[row.status]||row.status}</p>
       </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/10 pt-4 text-xs text-zinc-400">
       <span>Χρέωση: {date(row.paidAt)}</span>
       <span>Πληρωμένη έως: {date(row.periodEndsAt)}</span>
       {row.gatewayOrderId&&<span>Order: {row.gatewayOrderId}</span>}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
       {ongoing(row.status)&&<button onClick={()=>void inspect(row)} disabled={Boolean(busy)}
        className="rounded-xl bg-[#ccff00] px-4 py-2.5 text-xs font-black text-black disabled:opacity-40">
        Έλεγχος πληρωμής</button>}
       {sub&&row.status==='active'&&<button type="button" disabled={Boolean(busy)}
        onClick={()=>void loadMandate(row)} className="rounded-xl border border-white/20 px-4 py-2.5 text-xs font-bold">
        Κατάσταση ανανέωσης</button>}
       {mandate&&<span className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-xs text-zinc-300">
        Αυτόματη ανανέωση: {mandate.state==='active'?'Ενεργή':mandate.state==='cancelled'?'Ακυρωμένη':mandate.state}</span>}
       {sub&&mandate&&recurringStates.includes(mandate.state)&&
        <button onClick={()=>setConfirm(row)} className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-300">
          Διακοπή ανανέωσης</button>}
      </div>
     </article>;
   })}</div>}
   <p className="text-[11px] leading-5 text-zinc-500">Sandbox περιβάλλον · Το ιστορικό εμφανίζει έως 60 πρόσφατες συναλλαγές. Οι αποδείξεις/τα φορολογικά παραστατικά δεν εμφανίζονται ως εκδοθέντα αν δεν υπάρχει ξεχωριστή επιβεβαιωμένη διαδικασία έκδοσης.</p>
  </>}
  {confirm&&<div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
   <div role="dialog" aria-modal="true" aria-label="Επιβεβαίωση ακύρωσης" className="w-full max-w-lg rounded-[26px] border border-white/20 bg-[#171c1d] p-8">
    <XCircle size={32} className="text-rose-400"/>
    <h3 className="mt-4 text-xl font-black">Να διακοπεί η αυτόματη ανανέωση;</h3>
    <p className="mt-3 text-sm leading-6 text-zinc-300">Ακύρωση για {catalog[confirm.sku]?.title||confirm.sku}. Δεν θα πραγματοποιηθούν νέες αυτόματες χρεώσεις. Η ήδη πληρωμένη περίοδος διατηρείται μέχρι τη λήξη.</p>
    <div className="mt-7 flex gap-3">
     <button onClick={()=>setConfirm(null)} disabled={Boolean(busy)} className="rounded-xl border border-white/20 px-5 py-3 text-xs font-black">Επιστροφή</button>
     <button onClick={()=>void cancel()} disabled={Boolean(busy)} className="rounded-xl bg-rose-500 px-5 py-3 text-xs font-black disabled:opacity-40">Επιβεβαίωση ακύρωσης</button>
    </div>
   </div>
  </div>}
 </div>;
}
