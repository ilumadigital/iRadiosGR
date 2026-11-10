import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {
  ArrowRight,CalendarClock,Check,ChevronRight,CircleAlert,
  CreditCard,Crown,FileText,History,Loader2,RefreshCw,ShieldCheck,XCircle
} from 'lucide-react';

const headers=()=>({
  Authorization:'Bearer '+(localStorage.getItem('iluma_token')||''),
  'Content-Type':'application/json'
});
const date=value=>{
 if(!value)return '—';
 const parsed=new Date(value);
 return Number.isFinite(+parsed)?new Intl.DateTimeFormat('el-GR',{
  dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Athens'
 }).format(parsed):'—';
};
const amount=cents=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'})
  .format((Number(cents)||0)/100);
const labels={
 paid:'Πληρώθηκε',pending:'Εκκρεμεί',redirect:'Σε εξέλιξη',
 unknown:'Χρειάζεται έλεγχος',failed:'Απέτυχε',canceled:'Ακυρώθηκε',
 active:'Ενεργή',grace:'Περίοδος χάριτος',expired:'Έληξε',scheduled:'Προγραμματισμένη'
};
const stages={
 active:'Ενεργή αυτόματη ανανέωση',pending:'Αναμονή πρώτης πληρωμής',
 verification_pending:'Επιβεβαίωση εξουσιοδότησης Nexi',
 past_due:'Αποτυχία αυτόματης πληρωμής',
 cancelled:'Η αυτόματη ανανέωση ακυρώθηκε',
 unavailable:'Η υπηρεσία ανανεώσεων δεν είναι διαθέσιμη',
 none:'Δεν υπάρχει αυτόματη ανανέωση'
};
function Surface({children,className=''}) {
 return <div className={'rounded-[26px] border border-white/10 bg-[#111510]/85 p-5 sm:p-7 shadow-[0_18px_60px_rgba(0,0,0,.22)] '+className}>
  {children}
 </div>;
}
export default function ProfileBilling({API_URL='/api',user}){
 const [view,setView]=useState('subscription');
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const refresh=useCallback(async()=>{
  setError('');
  try{
   const res=await fetch(API_URL+'/billing/me/overview',{
    headers:headers(),cache:'no-store'
   });
   const payload=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(payload.error||'Δεν φορτώθηκαν οι πληροφορίες Billing.');
   setData(payload);
  }catch(e){setError(e.message||'Αποτυχία ανάκτησης συνδρομής.');}
  finally{setLoading(false);}
 },[API_URL]);
 useEffect(()=>{
  setLoading(true);setData(null);void refresh();
 },[refresh,user?._id]);
 const cancel=async()=>{
  if(busy||!window.confirm('Να σταματήσουν οι επόμενες αυτόματες χρεώσεις; Η ήδη πληρωμένη πρόσβαση Premium παραμένει μέχρι τη λήξη της.'))return;
  setBusy(true);setError('');setSuccess('');
  try{
   const res=await fetch(API_URL+'/billing/me/recurring/cancel',{
    method:'POST',headers:headers(),body:'{}'
   });
   const payload=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(payload.error||'Η ακύρωση δεν ολοκληρώθηκε.');
   setData(previous=>previous?{...previous,recurring:payload.recurring}:previous);
   setSuccess('Η επόμενη αυτόματη χρέωση απενεργοποιήθηκε. Η ήδη πληρωμένη περίοδος συνεχίζεται κανονικά.');
   await refresh();
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 };
 const orders=data?.orders||[];
 const active=orders.find(o=>['active','grace'].includes(o.status));
 const scheduled=orders.find(o=>o.status==='scheduled');
 const current=active||scheduled||orders.find(o=>o.status==='expired')||null;
 const recurring=data?.recurring||{state:'none',auto_renew:false};
 const card=data?.paymentMethod||{state:'none'};
 const payments=data?.payments||[];
 return <div className="mt-6 space-y-5">
  <div className="relative overflow-hidden rounded-[30px] border border-[#ccff00]/20 bg-gradient-to-br from-[#232b13] via-[#161a11] to-[#080a08] p-6 sm:p-9">
   <div className="pointer-events-none absolute -right-12 -top-24 size-72 rounded-full bg-[#ccff00]/15 blur-[75px]"/>
   <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
    <div>
     <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.18em] text-[#ccff00]"><Crown size={17}/> iRadios Billing</span>
     <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">Οι πληρωμές σου. Με πλήρη έλεγχο.</h2>
     <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-300">Διαχειρίσου τη συνδρομή Premium, τις αυτόματες ανανεώσεις και το ιστορικό σου από έναν χώρο.</p>
    </div>
    <button type="button" disabled={loading||busy} onClick={()=>void refresh()}
     className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40">
     <RefreshCw size={16}/> Ανανέωση
    </button>
   </div>
  </div>
  <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#0c0e0b] p-1.5" role="tablist" aria-label="Ενότητες Billing">
   {[
    {id:'subscription',name:'Συνδρομή',Icon:Crown},
    {id:'payments',name:'Πληρωμές',Icon:History},
    {id:'invoices',name:'Τιμολόγια',Icon:FileText}
   ].map(({id,name,Icon})=><button key={id} role="tab" type="button"
     aria-selected={view===id} onClick={()=>setView(id)}
     className={'flex min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition-colors sm:text-sm '+(view===id?'bg-[#ccff00] text-black':'text-zinc-400 hover:bg-white/5 hover:text-white')}>
      <Icon size={16}/><span>{name}</span>
   </button>)}
  </div>
  {loading&&<Surface><div className="flex items-center gap-3 text-zinc-400"><Loader2 className="animate-spin" size={19}/> Φόρτωση Billing…</div></Surface>}
  {error&&<p role="alert" className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-200">{error}</p>}
  {success&&<p role="status" className="rounded-xl border border-[#ccff00]/25 bg-[#ccff00]/5 p-4 text-sm text-[#e7ffac]"><Check size={16} className="mr-2 inline"/>{success}</p>}
  {!loading&&view==='subscription'&&<div role="tabpanel" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
   <Surface>
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div>
      <p className="text-xs font-semibold text-zinc-400">Τρέχον πλάνο</p>
      <h3 className="mt-2 flex items-center gap-2 text-2xl font-black text-white"><Crown className="text-[#ccff00]" size={23}/> {user?.isPremium?'iRadios Premium':'iRadios Free'}</h3>
     </div>
     <span className={'rounded-full px-3 py-1.5 text-xs font-black '+(active?'bg-[#ccff00]/15 text-[#ccff00]':'bg-zinc-800 text-zinc-300')}>{current?labels[current.status]||current.status:'Free'}</span>
    </div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
     <div className="rounded-2xl bg-white/[.04] p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400"><CalendarClock size={16}/> Λήξη τρέχουσας περιόδου</div>
      <p className="mt-2 text-sm font-bold text-white">{date(current?.periodEndsAt)}</p>
     </div>
     <div className="rounded-2xl bg-white/[.04] p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400"><RefreshCw size={16}/> Επόμενη αυτόματη χρέωση</div>
      <p className="mt-2 text-sm font-bold text-white">{recurring.state==='active'?date(recurring.next_charge_at):'Δεν έχει προγραμματιστεί'}</p>
     </div>
    </div>
    <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-5">
     <p className="text-sm font-bold text-white">{stages[recurring.state]||'Άγνωστη κατάσταση συνδρομής'}</p>
     <p className="text-xs leading-6 text-zinc-400">
      {recurring.state==='active'
       ?'Η Nexi διατηρεί την εξουσιοδότηση MIT. Η επόμενη χρέωση θα γίνει μόνο αν επιβεβαιωθεί η ενεργοποίηση του Sandbox recurring worker.'
       :'Δεν πραγματοποιούνται αυτόματες χρεώσεις χωρίς επαληθευμένη εξουσιοδότηση Nexi. Η απλή αποθήκευση OneClick δεν δημιουργεί συνδρομή.'}
     </p>
     {recurring.state==='active'&&!recurring.execution_enabled&&
      <p className="text-xs font-semibold text-amber-200">Η αυτόματη εκτέλεση βρίσκεται ακόμη σε έλεγχο Sandbox.</p>}
    </div>
    {['active','pending','verification_pending','past_due'].includes(recurring.state)&&
     <button type="button" disabled={busy} onClick={cancel}
      className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-5 py-3 text-sm font-bold text-rose-200 hover:bg-rose-500/15 disabled:opacity-40">
      <XCircle size={16} className="mr-2 inline"/> Ακύρωση αυτόματης ανανέωσης
     </button>}
    <Link to="/premium" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#ccff00]">Δες τα πλάνα <ArrowRight size={16}/></Link>
   </Surface>
   <div className="space-y-5">
    <Surface>
     <h4 className="flex items-center gap-2 font-black text-white"><CreditCard size={19} className="text-[#ccff00]"/> Τρόπος πληρωμής</h4>
     <p className="mt-3 text-sm text-zinc-300">{['active','pending','verification_pending','past_due'].includes(recurring.state)
      ?'Nexi recurring MIT — εξουσιοδότηση συνδρομής'
      :card.state==='active'?'Nexi OneClick — επαληθευμένο':'Δεν υπάρχει αποθηκευμένη κάρτα'}</p>
     <p className="mt-2 text-xs leading-5 text-zinc-500">Τα πλήρη στοιχεία κάρτας αποθηκεύονται μόνο στη Nexi, ποτέ στο iRadios.</p>
     <Link to="/premium" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#ccff00]">Διαχείριση κάρτας <ChevronRight size={14}/></Link>
    </Surface>
    <Surface>
     <h4 className="flex items-center gap-2 font-black text-white"><ShieldCheck size={19} className="text-[#ccff00]"/> Έλεγχος & ασφάλεια</h4>
     <p className="mt-3 text-xs leading-6 text-zinc-400">Κάθε πληρωμή επιβεβαιώνεται από το ILUMA Gateway μέσω Nexi. Η ακύρωση αποτρέπει μελλοντικές ανανεώσεις και διατηρεί την τρέχουσα πληρωμένη πρόσβαση.</p>
    </Surface>
   </div>
  </div>}
  {!loading&&view==='payments'&&<Surface>
   <div className="flex items-center justify-between gap-3">
    <div><h3 className="text-lg font-black text-white">Ιστορικό πληρωμών</h3>
     <p className="mt-1 text-xs text-zinc-400">Αυθεντικές εγγραφές από το ILUMA Gateway · Nexi Sandbox</p></div>
    <History size={23} className="text-[#ccff00]"/>
   </div>
   {payments.length===0?<p className="mt-6 rounded-xl bg-white/[.03] p-5 text-sm text-zinc-400">Δεν υπάρχουν καταχωρημένες πληρωμές ακόμη.</p>:
    <div className="mt-5 divide-y divide-white/10">{payments.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0">
       <p className="font-bold text-sm text-white">{p.title||'Listener Premium'}</p>
       <p className="mt-1 text-xs text-zinc-400">{date(p.paidAt||p.createdAt)}</p>
       <p className="mt-1 truncate text-[11px] text-zinc-500">Order {p.orderId}</p>
      </div>
      <div className="text-right">
       <p className="text-sm font-black text-white">{amount(p.amountCents)}</p>
       <span className={'mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold '+(p.status==='paid'?'bg-[#ccff00]/10 text-[#ccff00]':'bg-amber-400/10 text-amber-300')}>{labels[p.status]||p.status}</span>
      </div>
     </div>)}</div>}
  </Surface>}
  {!loading&&view==='invoices'&&<Surface className="flex min-h-[270px] flex-col items-center justify-center text-center">
   <div className="flex size-16 items-center justify-center rounded-3xl bg-[#ccff00]/10 text-[#ccff00]"><FileText size={28}/></div>
   <h3 className="mt-5 text-xl font-black text-white">Τιμολόγια</h3>
   <p className="mt-3 max-w-sm text-sm leading-6 text-zinc-400">Η ενότητα έχει προβλεφθεί για μελλοντική έκδοση παραστατικών. Δεν υπάρχουν ακόμη τιμολόγια ή διαθέσιμα αρχεία για λήψη.</p>
   <span className="mt-5 rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-zinc-400">Σύντομα διαθέσιμο</span>
  </Surface>}
  <p className="flex items-start gap-2 px-1 text-xs leading-6 text-zinc-500"><CircleAlert size={15} className="mt-1 shrink-0"/> Οι λειτουργίες πληρωμών βρίσκονται στο staging. Το ιστορικό είναι πραγματικό ως προς τα sandbox γεγονότα, όχι πραγματικές τραπεζικές χρεώσεις.</p>
 </div>;
}
