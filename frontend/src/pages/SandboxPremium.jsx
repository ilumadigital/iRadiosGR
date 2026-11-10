import React,{useCallback,useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import PremiumCompare from '../components/PremiumCompare';
import {Crown,ShieldCheck,ExternalLink,RefreshCw,AlertTriangle,
 CreditCard,CheckCircle2,Clock3,LockKeyhole,Gift,ArrowRight,CalendarClock,
 Sparkles,Headphones,Volume2,ScanSearch,Info,Check,ChevronRight} from 'lucide-react';

// Subscription-only staging checkout: recurring authorization is submitted
// only after the listener clicks the clearly disclosed subscription button.
// Browser returns never confirm a payment; signed webhooks remain authoritative.
const KEY_PREFIX='iradios-nexi-stage-intent:';
const RETURN_PREFIX='iradios-billing-return:';
function rememberReturnPath(userId){
 try{
  const prior=JSON.parse(sessionStorage.getItem('iradios-billing-origin')||'null');
  const path=prior?.path;
  if(typeof path==='string' && path.length<=512 && /^\/(?!\/)/.test(path) &&
    !path.includes('\\') && !path.startsWith('/premium') &&
    !path.startsWith('/backoffice') && Date.now()-prior.at<900000 &&
    Date.now()>=prior.at)
    sessionStorage.setItem(RETURN_PREFIX+userId,path);
 }catch{/* browser may block session storage */}
}
function takeReturnPath(userId){
 try{
  const name=RETURN_PREFIX+userId;
  const path=sessionStorage.getItem(name);
  if(typeof path==='string' && path.length<=512 && /^\/(?!\/)/.test(path) &&
    !path.includes('\\') && !path.startsWith('/premium') &&
    !path.startsWith('/backoffice')){
   sessionStorage.removeItem(name);
   return path;
  }
 }catch{}
 return null;
}
const authHeaders=()=>({Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`});
async function call(url,options={}){
 const response=await fetch(url,{cache:'no-store',...options,
   headers:{...authHeaders(),...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){
  const error=new Error(data.error||'Η επικοινωνία με τον server απέτυχε.');
  error.code=data.code||'';
  throw error;
 }
 return data;
}
const dateText=d=>d?new Intl.DateTimeFormat('el-GR',{
 dateStyle:'long',timeStyle:'short',timeZone:'Europe/Athens'
}).format(new Date(d)):'—';
function getOrCreateKey(userId,newAttempt=false){
 const name=KEY_PREFIX+userId;
 if(newAttempt)sessionStorage.removeItem(name);
 let key=sessionStorage.getItem(name);
 if(!key){
  key=crypto.randomUUID();
  sessionStorage.setItem(name,key);
 }
 return key;
}
function verifiedHostedPaymentUrl(value){
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
   (url.hostname==='nexigroup.com'||url.hostname.endsWith('.nexigroup.com'))
   ?url.toString():null;
 }catch{return null;}
}

function Status({order}){
 if(!order)return null;
 const states={
  scheduled:{title:'Η ανανέωση προγραμματίστηκε',desc:'Η πληρωμή επιβεβαιώθηκε. Η επόμενη περίοδος θα ξεκινήσει μετά τη λήξη της τρέχουσας.',tone:'border-[#ccff00]/30 bg-[#ccff00]/[.06] text-lime-100',icon:CheckCircle2},
  active:{title:'Έχεις Premium συνδρομή',desc:'Η πληρωμή σου επιβεβαιώθηκε και τα προνόμια έχουν ενεργοποιηθεί.',tone:'border-[#ccff00]/30 bg-[#ccff00]/[.06] text-lime-100',icon:CheckCircle2},
  grace:{title:'Περίοδος χάριτος',desc:'Η πληρωμένη περίοδος ολοκληρώθηκε. Τα προνόμια διατηρούνται προσωρινά.',tone:'border-amber-400/25 bg-amber-400/[.06] text-amber-100',icon:Clock3},
  expired:{title:'Η προηγούμενη συνδρομή έληξε',desc:'Μπορείς να ξεκινήσεις νέα μηνιαία συνδρομή.',tone:'border-white/10 bg-white/[.04] text-zinc-200',icon:Clock3},
  awaiting_sync:{title:'Γίνεται ενεργοποίηση του Premium',desc:'Η πληρωμή επιβεβαιώθηκε. Ο λογαριασμός θα ενημερωθεί αυτόματα.',tone:'border-[#ccff00]/30 bg-[#ccff00]/[.06] text-lime-100',icon:Clock3},
  pending:{title:'Η πληρωμή είναι σε αναμονή',desc:'Έλεγξε την κατάστασή της πριν επιχειρήσεις νέα πληρωμή.',tone:'border-amber-400/25 bg-amber-400/[.06] text-amber-100',icon:Clock3},
  creating:{title:'Προετοιμάζεται η πληρωμή',desc:'Μη δημιουργήσεις δεύτερο αίτημα.',tone:'border-amber-400/25 bg-amber-400/[.06] text-amber-100',icon:Clock3},
  redirect:{title:'Εκκρεμεί η πρώτη πληρωμή',desc:'Η συνδρομή ενεργοποιείται μόνο όταν επιβεβαιωθεί η πληρωμή.',tone:'border-amber-400/25 bg-amber-400/[.06] text-amber-100',icon:CreditCard},
  unknown:{title:'Ελέγχουμε την προηγούμενη πληρωμή',desc:'Δεν θα γίνει δεύτερη προσπάθεια μέχρι να γνωρίζουμε το αποτέλεσμα.',tone:'border-amber-400/25 bg-amber-400/[.06] text-amber-100',icon:AlertTriangle},
  failed:{title:'Η πληρωμή δεν ολοκληρώθηκε',desc:'Δεν έγινε ενεργοποίηση ή αυτόματη επανάληψη της χρέωσης.',tone:'border-red-400/25 bg-red-400/[.06] text-red-100',icon:AlertTriangle},
  canceled:{title:'Η πληρωμή ακυρώθηκε',desc:'Η συνδρομή δεν ενεργοποιήθηκε από αυτή την προσπάθεια.',tone:'border-white/10 bg-white/[.04] text-zinc-200',icon:AlertTriangle}
 };
 const state=order.providerStatus==='paid'&&['creating','pending','redirect','unknown'].includes(order.status)?
  states.awaiting_sync:(states[order.status]||states.pending);
 const Icon=state.icon;
 return <div role="status" className={'rounded-2xl border p-4 sm:p-5 '+state.tone}>
  <div className="flex items-start gap-3"><Icon size={22} className="mt-0.5 shrink-0"/>
   <div><h3 className="text-sm font-black sm:text-base">{state.title}</h3>
    <p className="mt-1.5 text-sm leading-6 opacity-80">{state.desc}</p>
    {order.periodEndsAt&&<p className="mt-2 text-xs">Τέλος πληρωμένης περιόδου: <strong>{dateText(order.periodEndsAt)}</strong></p>}
   </div>
  </div>
 </div>;
}

export default function SandboxPremium({API_URL='/api',currentUser,setCurrentUser}){
 const location=useLocation();
 const navigate=useNavigate();
 const [catalogOk,setCatalogOk]=useState(false);
 const [catalogError,setCatalogError]=useState('');
 const [order,setOrder]=useState(null);
 const [renewalEligibility,setRenewalEligibility]=useState(null);
 const [winback,setWinback]=useState(null);
 const [recurring,setRecurring]=useState({state:'none',execution_enabled:false});
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const userId=currentUser?._id||currentUser?.id||'';
 // Visual previews never submit financial intents, including link targets.
 const renewalPreviewRequested=window.location.hostname==='stage.iradios.gr'&&
  new URLSearchParams(location.search).get('renewal_preview')==='1';
 const winbackPreviewRequested=window.location.hostname==='stage.iradios.gr'&&
  new URLSearchParams(location.search).get('winback_preview')==='1';
 const previewOnly=renewalPreviewRequested||winbackPreviewRequested;
 const winbackNoCharge=winbackPreviewRequested;
 const winbackActive=winback?.eligible===true&&!winback.requiresCancellation;
 const winbackShown=winbackPreviewRequested||winback?.eligible===true;

 useEffect(()=>{
  if(!userId){setRenewalEligibility(null);return;}
  let canceled=false;
  call(API_URL+'/billing/me/renewal-notice').then(data=>{
   if(!canceled)setRenewalEligibility(data.renewal||null);
  }).catch(()=>{if(!canceled)setRenewalEligibility(null);});
  return()=>{canceled=true;};
 },[API_URL,userId]);
 useEffect(()=>{
  if(!userId){setWinback(null);return;}
  let canceled=false;
  call(API_URL+'/billing/me/winback').then(data=>{
   if(!canceled)setWinback(data.offer?.eligible?data.offer:null);
  }).catch(()=>{if(!canceled)setWinback(null);});
  return()=>{canceled=true;};
 },[API_URL,userId]);
 const refreshRecurring=useCallback(async()=>{
  if(!userId)return;
  try{
   const result=await call(API_URL+'/billing/me/overview');
   if(result?.recurring)setRecurring(result.recurring);
  }catch{/* Status is informational; financial eligibility is on the server. */}
 },[API_URL,userId]);
 useEffect(()=>{if(userId)void refreshRecurring();},[userId,refreshRecurring]);

 const loadOrders=useCallback(async()=>{
  if(!userId)return;
  const response=await call(API_URL+'/billing/me/orders');
  const recent=(response.orders||[])[0]||null;
  setOrder(recent);
  return recent;
 },[API_URL,userId]);

 useEffect(()=>{
  let canceled=false;
  call(API_URL+'/billing/catalog').then(data=>{
   if(canceled)return;
   const product=(data.products||[]).find(p=>p.sku==='L-PREM');
   if(!product||product.priceCents!==399||product.currency!=='EUR')
    throw Error('Ο τιμοκατάλογος του Listener Premium δεν είναι έτοιμος.');
   setCatalogOk(true);
  }).catch(e=>{if(!canceled)setCatalogError(e.message);});
  if(userId)loadOrders().catch(e=>{if(!canceled)setMessage(e.message);});
  return()=>{canceled=true;};
 },[API_URL,userId,loadOrders]);

 const updateAccount=useCallback(async()=>{
  if(!setCurrentUser)return;
  try{
   const me=await call(API_URL+'/auth/me');
   setCurrentUser(me);
  }catch{/* The billing order remains server-authoritative; retry on next refresh. */}
 },[API_URL,setCurrentUser]);

 // Always refresh the projected server entitlement when opening this page.
 // A still-open tab may carry a now-expired isPremium flag from last month.
 useEffect(()=>{
  if(userId)void updateAccount();
 },[userId,updateAccount]);

 // Return to the listener's last iRadios page only after HMAC-verified activation.
 // The path is local to the tab, never provided to the Gateway.
 const finishVerified=useCallback(async(status)=>{
  await updateAccount();
  if(['active','scheduled'].includes(status)){
   const destination=takeReturnPath(userId);
   if(destination){
    navigate(destination,{replace:true,state:{billingCompleted:true}});
    return true;
   }
  }
  return false;
 },[navigate,updateAccount,userId]);

 const checkStatus=useCallback(async()=>{
  setBusy(true);setMessage('');
  try{
   const current=order?.id?order:await loadOrders();
   if(!current?.id)return;
   const result=await call(API_URL+'/billing/orders/'+encodeURIComponent(current.id)+'?refresh=1');
   setOrder(result.order);
   // A browser return or a signed provider GET does NOT grant Premium.
   if(['active','grace','scheduled'].includes(result.order?.status)){
    const navigated=await finishVerified(result.order.status);
    if(navigated)return;
    setMessage(result.order.status==='scheduled'
     ?'Η ανανέωση πληρώθηκε. Η επόμενη περίοδος ξεκινά μετά τη λήξη της τρέχουσας.'
     :result.order.status==='active'
      ?'Η πληρωμή επιβεβαιώθηκε από το Gateway. Το Premium είναι ενεργό.'
      :'Η συνδρομή βρίσκεται σε περίοδο χάριτος σύμφωνα με τους κανόνες του iRadios.');
   }else if(['failed','canceled'].includes(result.order?.status)){
    // Only a definitive, authenticated Gateway failed/canceled outcome may
    // free the original local intent. The next click generates a NEW UUID;
    // we never auto-charge or restart a provider POST from this status poll.
    sessionStorage.removeItem(KEY_PREFIX+userId);
    setMessage(result.order.status==='failed'
     ?'Η προηγούμενη προσπάθεια δεν ολοκληρώθηκε. Δεν έγινε νέα αυτόματη χρέωση. Μπορείς να δοκιμάσεις ξανά αφού ολοκληρωθεί ο έλεγχος.'
     :'Η προηγούμενη πληρωμή ακυρώθηκε. Δεν ενεργοποιήθηκε Premium. Μπορείς να ξεκινήσεις νέα προσπάθεια όποτε το επιλέξεις.');
   }else if(result.order?.recoveryReason==='not_created'){
    setMessage('Η προηγούμενη προσπάθεια δεν δημιούργησε πληρωμή. Μπορείς να δοκιμάσεις ξανά.');
    sessionStorage.removeItem(KEY_PREFIX+userId);
   }else if(result.order?.providerStatus==='paid'){
    setMessage('Η πληρωμή έχει επιβεβαιωθεί. Γίνεται συγχρονισμός της συνδρομής σου.');
   }
  }catch(e){setMessage(e.message);}
  finally{setBusy(false);}
 },[API_URL,order,loadOrders,finishVerified,userId]);

 // Nexi returns through ILUMA Gateway to this exact iRadios route.
 // The URL is a navigation hint, NOT a proof of payment.
 useEffect(()=>{
  const query=new URLSearchParams(location.search);
  const kind=query.get('gateway_return'),paymentOrder=query.get('order');
  if(!userId||!['result','cancel'].includes(kind))return;
  let canceled=false;
  (async()=>{
   let navigated=false;
   try{
    const recent=await loadOrders();
    if(canceled)return;
    if(!recent||!paymentOrder||recent.gatewayOrderId!==paymentOrder){
     setMessage('Η επιστροφή δεν αντιστοιχεί στην τελευταία συναλλαγή σου. Έλεγξε το ιστορικό πριν συνεχίσεις.');
    }else{
     const result=await call(API_URL+'/billing/orders/'+encodeURIComponent(recent.id)+'?refresh=1');
     if(canceled)return;
     setOrder(result.order);
     if(['active','grace','scheduled'].includes(result.order?.status)){
      navigated=await finishVerified(result.order.status);
      if(canceled||navigated)return;
      setMessage('Η πληρωμή επιβεβαιώθηκε και η συνδρομή σου ενημερώθηκε.');
     }else if(result.order?.providerStatus==='paid')
      setMessage('Η πληρωμή καταχωρίστηκε επιτυχώς. Γίνεται συγχρονισμός των προνομίων σου — μην πληρώσεις ξανά.');
     else if(kind==='cancel')
      setMessage('Επέστρεψες από ακύρωση. Ελέγχουμε την τελική κατάσταση πριν από νέα προσπάθεια.');
     else
      setMessage('Επέστρεψες από την πληρωμή. Αναμένουμε ασφαλή επιβεβαίωση πριν ενεργοποιηθεί η συνδρομή.');
    }
   }catch(e){if(!canceled)setMessage(e.message);}
   finally{if(!canceled&&!navigated)navigate('/premium',{replace:true});}
  })();
  return()=>{canceled=true;};
 },[API_URL,location.search,userId,loadOrders,navigate,finishVerified]);

 useEffect(()=>{
  if(!order||!['redirect','unknown','pending','creating'].includes(order.status))return;
  const id=setInterval(()=>void checkStatus(),20000);
  return()=>clearInterval(id);
 },[order?.id,order?.status,checkStatus]);

 const beginCheckout=async()=>{
  const canRenewActive=['soon','grace'].includes(renewalEligibility?.kind);
  if(!userId||busy||!catalogOk||renewalPreviewRequested||winbackNoCharge||
     (currentUser?.isPremium&&!canRenewActive))return;
  setBusy(true);setMessage('');
  try{
   const newAttempt=order&&(
    ['failed','canceled','expired'].includes(order.status) ||
    (['active','grace'].includes(order.status)&&
     ['soon','grace'].includes(renewalEligibility?.kind))
   );
   rememberReturnPath(userId);
   const key=getOrCreateKey(userId,newAttempt);
   // Only an explicit click below the complete pricing/renewal disclosure
   // sends recurring consent to Gateway. Never from page load or preview.
   const cardChoice={autoRenew:true,...(winbackActive?{winback:true}:{})};
   const response=await call(API_URL+'/billing/checkout',{
     method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},
     body:JSON.stringify(cardChoice)
   });
   setOrder(response.order);
   const url=response.order?.status==='redirect'?
      verifiedHostedPaymentUrl(response.order.checkoutUrl):null;
   if(url)window.location.assign(url);
   else setMessage(response.order?.gatewayOrderId
     ?'Η ασφαλής φόρμα πληρωμής δεν άνοιξε. Πάτησε «Έλεγχος πληρωμής» πριν δοκιμάσεις ξανά.'
     :'Η πληρωμή δεν έχει επιβεβαιωθεί ακόμη. Πάτησε «Έλεγχος πληρωμής» πριν ξεκινήσεις νέα προσπάθεια.');
  }catch(e){
   if(['GATEWAY_CATALOG_NOT_READY','GATEWAY_ONECLICK_NOT_READY','GATEWAY_RECURRING_NOT_READY','GATEWAY_WINBACK_NOT_READY'].includes(e.code)){
    // Gateway 422 rejects before Nexi; a new idempotency key is safe
    // only after the product or OneClick preflight issue is repaired.
    sessionStorage.removeItem(KEY_PREFIX+userId);
    try{await loadOrders();}catch{}
   }
   setMessage(e.message);
  }
  finally{setBusy(false);}
 };

 const isListener=currentUser?.role==='user';
 const activeSubscription=currentUser?.isPremium===true&&!previewOnly;
 const canRenewActive=['soon','grace'].includes(renewalEligibility?.kind);
 const blocked=!previewOnly&&['redirect','unknown','pending','creating'].includes(order?.status);
 const hasMandate=!previewOnly&&['active','pending','verification_pending','past_due'].includes(recurring.state);
 const needsOldCancellation=winback?.requiresCancellation===true&&!previewOnly;
 const canCheckout=isListener&&currentUser?.isVerified===true&&!previewOnly&&
  !blocked&&!hasMandate&&!needsOldCancellation&&
  (!currentUser?.isPremium||canRenewActive)&&
  (!['active','grace','scheduled'].includes(order?.status)||canRenewActive);
 const price=winbackShown?'1,99 €':'3,99 €';
 const cards=[
  {icon:ShieldCheck,title:'Χωρίς διαφημίσεις της εφαρμογής',description:'Άκου χωρίς διακοπές από διαφημίσεις του iRadios.'},
  {icon:ScanSearch,title:'Music Radar',description:'Αναγνώρισε τραγούδια όταν το επιλέγεις.'},
  {icon:Headphones,title:'1Click to Spotify Search',description:'Βρες το τραγούδι που ακούς στο Spotify με ένα πάτημα.'},
  {icon:Headphones,title:'1Click to Apple Music Search',description:'Αναζήτησε το τραγούδι στο Apple Music με ένα πάτημα.'},
  {icon:Volume2,title:'Audio DSP & ισοσταθμιστής',description:'Προσάρμοσε την ακρόαση όπως σου ταιριάζει.'},
  {icon:Headphones,title:'Περισσότερες δυνατότητες',description:'Απόλαυσε τα πρόσθετα εργαλεία του Premium.'}
 ];
 return <main className="w-full min-w-0 max-w-none px-4 pb-40 pt-5 text-white sm:px-6 sm:pt-9 lg:px-9 xl:px-12 2xl:px-16">
  <div className="mx-auto w-full max-w-[1700px] space-y-6 lg:space-y-8">
   <section className="relative isolate overflow-hidden rounded-[28px] border border-white/10 bg-[#0e120d] shadow-[0_30px_100px_rgba(0,0,0,.28)] sm:rounded-[36px]">
    <div className="pointer-events-none absolute -right-24 -top-40 size-[380px] rounded-full bg-[#ccff00]/[.10] blur-[110px] lg:size-[620px]"/>
    <div className="pointer-events-none absolute -bottom-56 left-1/4 size-[420px] rounded-full bg-emerald-700/[.07] blur-[110px]"/>
    <div className="relative grid gap-7 px-5 py-7 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1.13fr)_minmax(350px,.87fr)] lg:items-center lg:gap-10 lg:px-10 lg:py-12 xl:gap-14 xl:px-14 2xl:py-16">
     <div className="min-w-0">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/20 bg-[#ccff00]/[.08] px-3.5 py-2 text-[11px] font-black uppercase tracking-[.15em] text-[#ccff00]">
       <Crown size={16}/> iRadios Premium <span className="mx-1 size-1 rounded-full bg-[#ccff00]"/> Μηνιαία συνδρομή
      </div>
      <h1 className="mt-7 max-w-[850px] text-[clamp(2.35rem,5.5vw,5.7rem)] font-black leading-[1.045] tracking-[-.05em]">
       Η μουσική σου.<span className="block text-[#ccff00]">Χωρίς περιορισμούς.</span>
      </h1>
      <p className="mt-5 max-w-[660px] text-base leading-8 text-zinc-300 sm:text-lg">
       Όλα όσα αγαπάς στην ακρόαση, σε μία απλή συνδρομή. Χωρίς περιττές επιλογές πληρωμής, με δυνατότητα ακύρωσης οποιαδήποτε στιγμή.
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:max-w-[690px] sm:gap-4">
       {cards.map(item=><div key={item.title} className="min-w-0 rounded-2xl border border-white/[.08] bg-white/[.035] p-4 sm:p-5">
        <item.icon size={22} className="text-[#ccff00]"/>
        <h2 className="mt-3 text-sm font-black leading-5 sm:text-base">{item.title}</h2>
        <p className="mt-2 text-xs leading-5 text-zinc-400 sm:text-sm">{item.description}</p>
       </div>)}
      </div>
     </div>

     <div className="min-w-0">
      <div className="relative overflow-hidden rounded-[26px] border border-[#ccff00]/25 bg-[#181e12] p-5 shadow-[0_20px_90px_rgba(0,0,0,.28)] sm:p-7 xl:p-8">
       <div className="absolute right-0 top-0 h-36 w-40 rounded-bl-full bg-[#ccff00]/[.065]"/>
       <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
         <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#ccff00]"><Sparkles size={16}/> Premium</div>
         <span className="rounded-full border border-[#ccff00]/25 bg-[#ccff00]/[.08] px-3 py-1 text-[11px] font-bold text-lime-200">{activeSubscription?'Ενεργό':'Μηνιαία συνδρομή'}</span>
        </div>
        {previewOnly&&<div role="note" className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/[.08] px-3 py-2.5 text-xs font-bold text-amber-200">
         Προεπισκόπηση δοκιμών — χωρίς χρέωση και χωρίς αλλαγή συνδρομής.
        </div>}
        {winbackShown&&<p className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ccff00]/10 px-3 py-1.5 text-xs font-bold text-[#ccff00]"><Gift size={14}/> Μοναδική προσφορά επιστροφής</p>}
        <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-1">
         {winbackShown&&<span className="pb-2 text-xl font-semibold text-zinc-500 line-through">3,99 €</span>}
         <span className="text-[clamp(3.4rem,5vw,5.3rem)] font-black leading-none tracking-tight text-white">{price}</span>
         <span className="pb-2 text-sm text-zinc-400">/ πρώτο μήνα</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
         {winbackShown?'Μόνο για την πρώτη επανενεργοποίηση. Από τον δεύτερο μήνα 3,99 € / μήνα.':'Από τον δεύτερο μήνα και κάθε επόμενο, 3,99 € / μήνα.'}
         {' '}Οι τιμές περιλαμβάνουν ΦΠΑ 24%.
        </p>
        {winback?.offerEndsAt&&!previewOnly&&<p className="mt-2 text-xs text-amber-200">Η προσφορά λήγει στις {dateText(winback.offerEndsAt)}.</p>}
        <div className="my-6 h-px bg-white/10"/>
        {activeSubscription?<div className="space-y-4">
         <div className="flex items-start gap-3 rounded-2xl border border-[#ccff00]/20 bg-[#ccff00]/[.07] p-4 text-lime-100">
          <CheckCircle2 size={23} className="mt-0.5 shrink-0 text-[#ccff00]"/>
          <div><h3 className="font-black">Έχεις Premium συνδρομή</h3>
           <p className="mt-1.5 text-sm leading-6 text-lime-100/75">
            {order?.periodEndsAt?'Η τρέχουσα πληρωμένη περίοδος ολοκληρώνεται '+dateText(order.periodEndsAt)+'.':'Τα Premium προνόμιά σου είναι ενεργά.'}
           </p>
           <p className="mt-1 text-xs text-lime-100/70">
            {recurring.state==='active'?(recurring.execution_enabled?'Η αυτόματη ανανέωση είναι ενεργή.':'Η αυτόματη ανανέωση είναι σε δοκιμαστική αναμονή.'):
              'Δεν υπάρχει ενεργή αυτόματη ανανέωση. Τα προνόμια ισχύουν για την πληρωμένη περίοδο.'}
           </p>
          </div>
         </div>
         <Link to="/profile?tab=billing" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[.07] px-5 py-4 text-sm font-bold transition hover:bg-white/10">
          Διαχείριση συνδρομής <ArrowRight size={17}/>
         </Link>
        </div>:<div className="space-y-4">
         {needsOldCancellation&&<div className="rounded-2xl border border-amber-300/30 bg-amber-300/[.08] p-4 text-sm leading-6 text-amber-100">
          Για να αποφευχθεί διπλή χρέωση, ακύρωσε πρώτα την προηγούμενη αυτόματη ανανέωση από το Billing.
         </div>}
         {hasMandate&&!needsOldCancellation&&<div className="rounded-2xl border border-amber-300/30 bg-amber-300/[.08] p-4 text-sm leading-6 text-amber-100">
          Υπάρχει ήδη ενεργή ή εκκρεμής εξουσιοδότηση συνδρομής. Έλεγξε την κατάστασή της στο Billing.
         </div>}
         {!currentUser&&<p className="text-sm text-zinc-300">Για να αποκτήσεις Premium, συνδέσου στον λογαριασμό σου.</p>}
         {currentUser&&!isListener&&<p className="text-sm text-amber-100">Το Premium διατίθεται σε λογαριασμούς ακροατών.</p>}
         {isListener&&currentUser?.isVerified!==true&&<p className="text-sm text-amber-100">Επιβεβαίωσε πρώτα το email σου για να ξεκινήσεις συνδρομή.</p>}
         <div className="rounded-2xl border border-white/[.10] bg-black/25 p-4 sm:p-5">
          <div className="flex items-start gap-3">
           <ShieldCheck size={21} className="mt-0.5 shrink-0 text-[#ccff00]"/>
           <div className="min-w-0 space-y-2 text-sm leading-6 text-zinc-200">
            <p className="font-bold text-white">Σαφής ενημέρωση πριν από τη συνδρομή</p>
            <p>Με το πάτημα «Έναρξη συνδρομής» συμφωνείς στην αρχική χρέωση <strong className="text-white">{price}</strong> και εξουσιοδοτείς αυτόματη χρέωση <strong className="text-white">3,99 € κάθε μήνα</strong> μετά τον πρώτο μήνα, μέχρι να ακυρώσεις.</p>
            <p>Μπορείς να ακυρώσεις οποτεδήποτε από το <Link to="/profile?tab=billing" className="font-bold text-[#ccff00] underline underline-offset-2">Billing</Link>. Η ακύρωση σταματά τις επόμενες χρεώσεις, χωρίς να αφαιρεί την ήδη πληρωμένη περίοδο.</p>
            <p className="text-xs text-zinc-400">Η κάρτα καταχωρίζεται σε ασφαλή εξωτερική σελίδα πληρωμής. Δεν αποθηκεύουμε τον αριθμό ή το CVV της κάρτας σου.</p>
           </div>
          </div>
         </div>
         {blocked?<div className="space-y-3">
           <p className="text-sm leading-6 text-amber-200">Υπάρχει ήδη εκκρεμής πληρωμή. Μην ξεκινήσεις δεύτερη χρέωση.</p>
           {order?.status==='redirect'&&!previewOnly&&verifiedHostedPaymentUrl(order.checkoutUrl)&&
            <a href={verifiedHostedPaymentUrl(order.checkoutUrl)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ccff00] px-5 py-4 text-sm font-black text-black">
             Συνέχεια στην ασφαλή πληρωμή <ExternalLink size={17}/>
            </a>}
         </div>:!currentUser?<Link to="/login" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ccff00] px-5 py-4 text-sm font-black text-black transition hover:bg-[#dfff62]">
           Σύνδεση για Premium <ArrowRight size={17}/>
          </Link>:needsOldCancellation||hasMandate?
          <Link to="/profile?tab=billing" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ccff00] px-5 py-4 text-sm font-black text-black transition hover:bg-[#dfff62]">
           Διαχείριση συνδρομής <ArrowRight size={17}/>
          </Link>:
          <button type="button" onClick={beginCheckout} disabled={!canCheckout||busy||!catalogOk} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#ccff00] px-5 py-4 text-sm font-black text-black shadow-[0_10px_40px_rgba(204,255,0,.13)] transition hover:bg-[#dfff62] disabled:cursor-not-allowed disabled:opacity-45 sm:text-base">
           {busy?'Προετοιμασία πληρωμής…':'Έναρξη συνδρομής'} <ArrowRight size={19}/>
          </button>}
         <p className="text-center text-xs leading-5 text-zinc-500">Η έναρξη γίνεται μόνο με δικό σου πάτημα. Η επόμενη μηνιαία χρέωση σταματά μόλις ακυρώσεις.</p>
        </div>}
        {!recurring.execution_enabled&&<p className="mt-4 text-xs leading-5 text-amber-200/85">Δοκιμαστικό περιβάλλον: οι επόμενες αυτόματες χρεώσεις δεν εκτελούνται ακόμη.</p>}
        {catalogError&&<p role="alert" className="mt-4 text-sm text-red-200">{catalogError}</p>}
       </div>
      </div>
     </div>
    </div>
   </section>

   {message&&<p role="status" className="rounded-2xl border border-amber-400/25 bg-amber-400/[.06] p-4 text-sm leading-6 text-amber-100">{message}</p>}
   {!previewOnly&&order&&(!currentUser?.isPremium||blocked)&&
    <Status order={order}/>}
   {!previewOnly&&order&&<div className="flex flex-wrap items-center gap-3">
    {blocked&&<button type="button" onClick={checkStatus} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[.05] px-4 py-3 text-sm font-bold transition hover:bg-white/10 disabled:opacity-50"><RefreshCw size={17}/> Έλεγχος πληρωμής</button>}
    {['active','grace','scheduled'].includes(order.status)&&
     <button type="button" onClick={()=>window.location.reload()} className="inline-flex items-center gap-2 rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/10 px-4 py-3 text-sm font-bold text-[#ccff00] transition hover:bg-[#ccff00]/15"><RefreshCw size={17}/> Ανανέωση στοιχείων</button>}
   </div>}
   <PremiumCompare/>
   <section className="grid gap-4 rounded-[28px] border border-white/10 bg-[#11140e]/85 p-6 sm:grid-cols-3 sm:p-8">
    <div className="flex items-start gap-3"><CalendarClock size={21} className="mt-1 shrink-0 text-[#ccff00]"/><div><h2 className="font-black">Κάθε μήνα</h2><p className="mt-1 text-sm leading-6 text-zinc-400">3,99 € με ΦΠΑ, μετά τον πρώτο μήνα.</p></div></div>
    <div className="flex items-start gap-3"><ShieldCheck size={21} className="mt-1 shrink-0 text-[#ccff00]"/><div><h2 className="font-black">Ακύρωση όποτε θέλεις</h2><p className="mt-1 text-sm leading-6 text-zinc-400">Σταματάς τις επόμενες χρεώσεις από το Billing.</p></div></div>
    <div className="flex items-start gap-3"><LockKeyhole size={21} className="mt-1 shrink-0 text-[#ccff00]"/><div><h2 className="font-black">Ασφαλής πληρωμή</h2><p className="mt-1 text-sm leading-6 text-zinc-400">Χωρίς αποθήκευση στοιχείων κάρτας από την εφαρμογή.</p></div></div>
   </section>
   <p className="px-2 text-xs leading-6 text-zinc-500">Δες τους <Link to="/terms" className="underline hover:text-white">όρους χρήσης</Link> και την <Link to="/privacy" className="underline hover:text-white">πολιτική απορρήτου</Link> για περισσότερες πληροφορίες.</p>
  </div>
 </main>;
}
