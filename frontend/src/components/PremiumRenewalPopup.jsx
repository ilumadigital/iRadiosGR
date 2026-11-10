import React,{useCallback,useEffect,useRef,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {BellRing,Clock3,Crown,RefreshCw,X} from 'lucide-react';

const HOURS_24=86400000;
const clock=d=>d?new Intl.DateTimeFormat('el-GR',{
 dateStyle:'long',timeStyle:'short',timeZone:'Europe/Athens'
}).format(new Date(d)):'—';

/**
 * Listener-only staging reminder. The backend derives the cycle, dates and
 * payment eligibility. Snooze belongs to the account and the paid cycle,
 * never to a Gateway credential or browser-supplied financial state.
 */
export default function PremiumRenewalPopup({currentUser,authReady,API_URL='/api'}){
 const navigate=useNavigate();
 const location=useLocation();
 const accountId=currentUser?._id||currentUser?.id||'';
 const stage=window.location.hostname==='stage.iradios.gr';
 const eligible=stage&&authReady&&!!accountId&&currentUser?.role==='user';
 const previewKind=eligible?new URLSearchParams(location.search)
  .get('premium_popup_preview'):null;
 const demo=['soon','grace','expired'].includes(previewKind)?previewKind:null;
 const [notice,setNotice]=useState(null);
 const [recurring,setRecurring]=useState(null);
 const [previewClosed,setPreviewClosed]=useState(false);
 const [locallySkipped,setLocallySkipped]=useState(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const closeRef=useRef(null);

 const fetchNotice=useCallback(async()=>{
  if(!eligible)return;
  const options={
   headers:{Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`},
   cache:'no-store'
  };
  try{
   const [noticeResponse,recurringResponse]=await Promise.all([
    fetch(API_URL+'/billing/me/renewal-notice',options),
    fetch(API_URL+'/billing/me/recurring-status',options)
   ]);
   if(noticeResponse.ok){
    const data=await noticeResponse.json();
    setNotice(data.notice||null);
   }else setNotice(null);
   if(recurringResponse.ok){
    const data=await recurringResponse.json();
    setRecurring(data.recurring||null);
   }else setRecurring(null);
  }catch{setNotice(null);setRecurring(null);}
 },[eligible,accountId,API_URL]);

 useEffect(()=>{
  setNotice(null);
  setRecurring(null);
  setLocallySkipped(null);
  setPreviewClosed(false);
  if(!eligible)return;
  let closed=false;
  const check=()=>{if(!closed)void fetchNotice();};
  check();
  const interval=setInterval(check,60000);
  const visibility=()=>{if(document.visibilityState==='visible')check();};
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',visibility);
  return()=>{
   closed=true;clearInterval(interval);
   window.removeEventListener('focus',check);
   document.removeEventListener('visibilitychange',visibility);
  };
 },[eligible,accountId,fetchNotice]);

 const hiddenPage=location.pathname==='/premium'||
  location.pathname==='/login'||location.pathname==='/register'||
  location.pathname.startsWith('/backoffice')||
  location.pathname.startsWith('/widget');
 const display=demo&&!previewClosed?{
  kind:demo,cycleId:'preview',priceCents:399,
  periodEndsAt:new Date(Date.now()+(demo==='soon'?3600000:-3600000)).toISOString(),
  graceEndsAt:new Date(Date.now()+(demo==='grace'?3600000:-3600000)).toISOString()
 }:notice;
 const isLocallySkipped=display&&locallySkipped?.cycleId===display.cycleId&&
  locallySkipped.until>Date.now();
 const shown=eligible&&!hiddenPage&&display&&!isLocallySkipped&&!(demo&&previewClosed);
 const skip=useCallback(async()=>{
  if(!display||busy)return;
  if(demo){setPreviewClosed(true);return;}
  setBusy(true);setError('');
  const cycleId=display.cycleId;
  try{
   const response=await fetch(API_URL+'/billing/me/renewal-notice/snooze',{
    method:'POST',
    headers:{
     Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`,
     'Content-Type':'application/json'
    },
    body:'{}'
   });
   if(!response.ok)throw Error('Δεν αποθηκεύτηκε η υπενθύμιση. Προσπάθησε ξανά.');
   const data=await response.json();
   if(data.cycleId!==cycleId)throw Error('Η περίοδος άλλαξε. Κάνε ανανέωση της σελίδας.');
   setLocallySkipped({cycleId,until:Date.parse(data.snoozedUntil)||Date.now()+HOURS_24});
   setNotice(null);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 },[display,busy,demo,API_URL]);

 useEffect(()=>{
  if(!shown)return;
  closeRef.current?.focus();
  const onEscape=e=>{if(e.key==='Escape'){e.preventDefault();void skip();}};
  window.addEventListener('keydown',onEscape);
  return()=>window.removeEventListener('keydown',onEscape);
 },[shown,skip]);

 if(!shown)return null;
 const expiring=display.kind==='soon';
 const grace=display.kind==='grace';
 const mandateState=recurring?.state;
 const hasMit=['active','pending','verification_pending','past_due'].includes(mandateState);
 // Manual checkout is rejected while a recurring mandate is active.
 // Unknown Gateway status also goes to Billing rather than suggesting
 // a potentially overlapping second payment.
 const billingRequired=hasMit||recurring===null;
 const autoExec=hasMit&&recurring?.execution_enabled===true;
 const ctaLabel=demo?'Προβολή Billing — χωρίς πληρωμή':
  billingRequired?'Διαχείριση συνδρομής στο Billing':'Ανανέωση τώρα';
 const title=expiring?'Το Premium σου λήγει σύντομα':
  grace?'Το Premium σου είναι σε περίοδο χάριτος':'Η συνδρομή σου έληξε';
 const description=expiring
  ?'Η τρέχουσα συνδρομή σου ολοκληρώνεται μέσα στις επόμενες 24 ώρες.'
  :grace
   ?'Η πληρωμένη περίοδος ολοκληρώθηκε, αλλά τα προνόμιά σου διατηρούνται προσωρινά έως το τέλος της χάριτος.'
   :'Τα Premium προνόμια έχουν απενεργοποιηθεί επειδή δεν έχει επιβεβαιωθεί νέα πληρωμένη περίοδος.';
 return <div className="fixed inset-0 z-[10050] flex items-center justify-center px-4 py-7 bg-black/75 backdrop-blur-md"
   role="presentation">
   <section role="dialog" aria-modal="true" aria-labelledby="premium-renewal-popup-title"
    aria-describedby="premium-renewal-popup-description"
    className="relative w-full max-w-[460px] rounded-[30px] border border-[#ccff00]/25 bg-[#111510] text-white shadow-[0_30px_100px_rgba(0,0,0,.8)] overflow-hidden">
    <div className="absolute -right-12 -top-16 w-48 h-48 bg-[#ccff00]/10 rounded-full blur-[70px] pointer-events-none"/>
    <div className="relative p-6 sm:p-8">
     <button ref={closeRef} type="button" onClick={skip} disabled={busy}
      aria-label="Παράλειψη ειδοποίησης για 1 ημέρα"
      className="absolute right-4 top-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-50">
      <X size={19}/></button>
     <div className="w-14 h-14 rounded-[18px] bg-[#ccff00]/10 border border-[#ccff00]/20 flex items-center justify-center text-[#ccff00]">
      {expiring?<BellRing size={26}/>:grace?<Clock3 size={26}/>:<Crown size={26}/>}
     </div>
     <div className="mt-6 text-[11px] tracking-[.2em] font-black text-[#ccff00] uppercase">iRadios Premium</div>
     {demo&&<p className="mt-3 text-xs font-bold text-amber-300">ΠΡΟΕΠΙΣΚΟΠΗΣΗ STAGING — Δεν γίνεται πληρωμή</p>}
     <h2 id="premium-renewal-popup-title" className="mt-2 text-2xl sm:text-[28px] leading-tight font-black">{title}</h2>
     <p id="premium-renewal-popup-description" className="mt-3 text-sm leading-6 text-zinc-300">{description}</p>
     {hasMit&&<p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
      {autoExec
       ?'Έχεις ενεργή αυτόματη ανανέωση Nexi. Δεν απαιτείται δεύτερη χειροκίνητη πληρωμή. Δες την κατάσταση της επόμενης χρέωσης στο Billing.'
       :'Έχεις εξουσιοδότηση αυτόματης ανανέωσης, όμως οι αυτόματες χρεώσεις Sandbox δεν εκτελούνται ακόμη. Για να αποφύγουμε διπλή χρέωση, διαχειρίσου την από το Billing.'}
     </p>}
     {recurring===null&&<p className="mt-4 text-xs leading-5 text-amber-200">Δεν ήταν δυνατός ο έλεγχος του MIT contract. Έλεγξε το Billing πριν ξεκινήσεις νέα πληρωμή.</p>}
     <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
       <span className="text-sm text-zinc-300">Ανανέωση ενός μήνα</span>
       <strong className="text-xl text-[#ccff00]">3,99 €</strong>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
       {expiring?'Τρέχουσα λήξη: '+clock(display.periodEndsAt):
        grace?'Λήξη χάριτος: '+clock(display.graceEndsAt):
         hasMit?'Κατάσταση αυτόματης ανανέωσης: '+(autoExec?'ενεργή':'Sandbox σε έλεγχο'):
          'Χειροκίνητη αγορά · Ασφαλές checkout Nexi'}
      </p>
     </div>
     <button type="button" disabled={busy}
      onClick={()=>navigate(demo||billingRequired?'/profile?tab=billing':'/premium')}
      className="mt-6 w-full rounded-xl bg-[#ccff00] px-5 py-3.5 text-sm sm:text-base font-black text-black hover:bg-[#deff63] disabled:opacity-50 flex items-center justify-center gap-2">
      <RefreshCw size={18}/> {ctaLabel}
     </button>
     <button type="button" disabled={busy} onClick={skip}
      className="mt-2 w-full rounded-xl px-5 py-3 text-sm font-bold text-zinc-300 hover:text-white hover:bg-white/5 disabled:opacity-50">
      {busy?'Αποθήκευση...':'Παράλειψη για 1 ημέρα'}
     </button>
     {error&&<p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
     <p className="mt-3 text-center text-xs leading-5 text-zinc-500">Η παράλειψη αναβάλλει μόνο την υπενθύμιση, όχι τη λήξη ή τα δικαιώματα συνδρομής.</p>
    </div>
   </section>
 </div>;
}
