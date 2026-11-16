import React,{useCallback,useEffect,useState} from 'react';
import {AlertTriangle,CheckCircle2,ExternalLink,RefreshCw,ShieldCheck} from 'lucide-react';

const KEY_PREFIX='iradios-live-nexi-qa-v1:';
const NexiUrl=value=>{
 try{const u=new URL(value);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
   (u.hostname==='nexigroup.com'||u.hostname.endsWith('.nexigroup.com'))?u.toString():null;
 }catch{return null;}
};
const headers=()=>({Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')});
async function read(url,opts={}){
 const response=await fetch(url,{cache:'no-store',...opts,
  headers:{...headers(),...(opts.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Η δοκιμή δεν είναι διαθέσιμη.');
 return data;
}
/**
 * Real-card test only: it is visible solely when the backend says this exact
 * verified stage Listener is allowlisted and the QA checkout flag is enabled.
 * It never replaces the normal Sandbox subscription checkout.
 */
export default function ProductionQaCheckout({API_URL='/api',currentUser}){
 const userId=String(currentUser?._id||currentUser?.id||'');
 const [eligible,setEligible]=useState(false);
 const [order,setOrder]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const base=API_URL+'/billing/production-qa';
 const refresh=useCallback(async(readOnly=false)=>{
  const status=await read(base+'/status'+(readOnly?'?refresh=1':''));
  setOrder(status.order||null);
 },[base]);
 useEffect(()=>{
  if(!userId||currentUser?.role!=='user'||
    window.location.hostname!=='stage.iradios.gr')return;
  let live=true;
  read(base+'/availability').then(async data=>{
   if(!live||data.eligible!==true)return;
   setEligible(true);
   const status=await read(base+'/status'+
     (new URLSearchParams(window.location.search).has('production_qa_return')?'?refresh=1':''));
   if(live)setOrder(status.order||null);
  }).catch(()=>{if(live)setEligible(false);});
  return ()=>{live=false;};
 },[userId,currentUser?.role,base]);
 const start=async()=>{
  if(busy||order)return;
  if(!window.confirm('ΠΡΑΓΜΑΤΙΚΗ ΧΡΕΩΣΗ 3,99 € με κανονική κάρτα μέσω Nexi Production. '+
   'ΜΟΝΟ μία πληρωμή, χωρίς αυτόματη ανανέωση. Θέλεις να συνεχίσεις;'))return;
  setBusy(true);setError('');
  try{
   const storage=KEY_PREFIX+userId;
   let key=sessionStorage.getItem(storage);
   if(!key){key=crypto.randomUUID();sessionStorage.setItem(storage,key);}
   const result=await read(base+'/checkout',{
    method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},
    body:JSON.stringify({productSku:'L-PREM',amountCents:399,confirmedLiveCharge:true})
   });
   setOrder(result.order||null);
   const url=NexiUrl(result.order?.checkoutUrl);
   if(url)window.location.assign(url);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 if(!eligible)return null;
 const url=order?.status==='redirect'?NexiUrl(order.checkoutUrl):null;
 const title=order?.status==='paid'?'Η πραγματική πληρωμή επιβεβαιώθηκε':
  order?'Υπάρχει ήδη μία δοκιμαστική συναλλαγή':'Ελεγχόμενη πραγματική πληρωμή';
 return <section className="rounded-3xl border border-amber-400/40 bg-amber-400/[.07] p-5 sm:p-7" aria-label="Nexi Production QA">
  <div className="flex items-start gap-3">
   {order?.status==='paid'?<CheckCircle2 className="mt-1 shrink-0 text-lime-400"/>:
    <AlertTriangle className="mt-1 shrink-0 text-amber-300"/>}
   <div className="min-w-0 flex-1 space-y-3">
    <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">ILUMA — Nexi Production QA</p>
    <h2 className="text-lg font-black text-white">{title}</h2>
    <p className="text-sm leading-6 text-zinc-200">
     <strong>Πραγματική χρέωση 3,99 €</strong> στην Production Nexi, μόνο για αυτόν τον
     staging δοκιμαστικό λογαριασμό. Μία αγορά Listener Premium, χωρίς αυτόματη ανανέωση.
     Δεν χρησιμοποιείται δοκιμαστική κάρτα.
    </p>
    {order&&<p className="text-sm text-amber-100" role="status">
     Κατάσταση: <strong>{order.status}</strong>
     {order.gatewayOrderId?' · Gateway Order: '+order.gatewayOrderId:''}
     {order.status==='unknown'?' · Μη δοκιμάσεις δεύτερη χρέωση. Χρειάζεται συμφωνία συναλλαγής.':''}
    </p>}
    {error&&<p className="text-sm text-red-200" role="alert">{error}</p>}
    {!order&&<button type="button" onClick={start} disabled={busy}
     className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-black disabled:opacity-50">
     <ShieldCheck size={17} className="mr-2 inline"/>
     {busy?'Έλεγχος Gateway…':'Εκκίνηση πραγματικής χρέωσης 3,99 €'}
    </button>}
    {url&&<a href={url} rel="noopener noreferrer"
     className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-black">
     Συνέχεια στη Nexi Production <ExternalLink size={17}/></a>}
    {order&&<button type="button" disabled={busy} onClick={async()=>{
     setBusy(true);setError('');
     try{await refresh(true);}catch(e){setError(e.message);}
     finally{setBusy(false);}
    }} className="inline-flex items-center gap-2 rounded-xl border border-amber-300/40 px-4 py-3 text-sm font-bold text-amber-100 disabled:opacity-50">
     <RefreshCw size={16}/> Επαλήθευση κατάστασης
    </button>}
    <p className="text-xs text-zinc-400">
     Η επιστροφή από το checkout δεν επιβεβαιώνει πληρωμή.
     Το Premium ενεργοποιείται μόνο μετά από υπογεγραμμένο webhook.
    </p>
   </div>
  </div>
 </section>;
}
