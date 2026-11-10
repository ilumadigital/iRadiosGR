import React,{useCallback,useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {Crown,ShieldCheck,ExternalLink,RefreshCw,AlertTriangle,
 CreditCard,CheckCircle2,Clock3,LockKeyhole,Gift} from 'lucide-react';

// Phase 3 is an isolated first-month Nexi SANDBOX checkout. It never stores
// card details, never confirms success from redirect alone, and never auto-renews.
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
function verifiedNexiUrl(value){
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
   scheduled:{title:'Η ανανέωση ολοκληρώθηκε',desc:'Η νέα πληρωμή επιβεβαιώθηκε από το Gateway. Η επόμενη μηνιαία περίοδος θα ξεκινήσει στη λήξη της τρέχουσας, χωρίς να χαθούν πληρωμένες ημέρες.',icon:CheckCircle2,style:'border-lime-500/30 bg-lime-900/10 text-lime-200'},
   active:{title:'Η συνδρομή είναι ενεργή',desc:'Η πληρωμή επιβεβαιώθηκε από το Gateway με υπογεγραμμένο webhook.',icon:CheckCircle2,style:'border-lime-500/30 bg-lime-900/10 text-lime-200'},
   grace:{title:'Περίοδος χάριτος',desc:'Η πληρωμένη περίοδος ολοκληρώθηκε. Τα προνόμια διατηρούνται προσωρινά έως το όριο χάριτος που έχει ορίσει το iRadios.',icon:Clock3,style:'border-amber-500/30 bg-amber-900/10 text-amber-200'},
   expired:{title:'Η συνδρομή Premium έληξε',desc:'Τα πληρωμένα προνόμια έχουν ολοκληρωθεί. Μπορείς να ανανεώσεις χειροκίνητα για μία νέα μηνιαία περίοδο με ασφαλή πληρωμή μέσω ILUMA Gateway και Nexi.',icon:Clock3,style:'border-white/10 bg-white/5 text-zinc-200'},
   awaiting_sync:{title:'Η πληρωμή ολοκληρώθηκε — συγχρονισμός συνδρομής',desc:'Το ILUMA Gateway έχει καταγράψει πληρωμή από τη Nexi, αλλά το iRadios περιμένει την υπογεγραμμένη ειδοποίηση για να ενεργοποιήσει τα προνόμια. Δεν χρειάζεται δεύτερη χρέωση. Η κατάσταση ελέγχεται αυτόματα.',icon:Clock3,style:'border-lime-500/30 bg-lime-900/10 text-lime-200'},
   pending:{title:'Δεν έχει ανοίξει η φόρμα της Nexi',desc:'Δημιουργήθηκε αίτημα πληρωμής, αλλά δεν υπάρχει ακόμη σελίδα καταχώρισης κάρτας. Δεν πρόκειται για επιβεβαιωμένη χρέωση. Μην ξεκινήσεις δεύτερη συναλλαγή.',icon:Clock3,style:'border-yellow-500/30 bg-yellow-900/10 text-yellow-200'},
   creating:{title:'Προετοιμασία ασφαλούς πληρωμής',desc:'Δημιουργείται το αίτημα. Μη δημιουργήσεις δεύτερο checkout.',icon:Clock3,style:'border-yellow-500/30 bg-yellow-900/10 text-yellow-200'},
   redirect:{title:'Αναμονή πληρωμής μέσω Nexi Sandbox',desc:'Το checkout είναι διαθέσιμο. Premium ενεργοποιείται μόνο μετά την επιβεβαίωση.',icon:CreditCard,style:'border-yellow-500/30 bg-yellow-900/10 text-yellow-200'},
   unknown:{title:'Χρειάζεται έλεγχος της συναλλαγής',desc:'Η κατάσταση είναι άγνωστη. Δεν δημιουργούμε δεύτερη χρέωση και περιμένουμε ασφαλή επαλήθευση.',icon:AlertTriangle,style:'border-orange-500/30 bg-orange-900/10 text-orange-200'},
   failed:{title:'Η πληρωμή απέτυχε',desc:'Δεν ενεργοποιήθηκε Premium. Μπορείς να ξεκινήσεις νέα δοκιμαστική συναλλαγή.',icon:AlertTriangle,style:'border-red-500/30 bg-red-900/10 text-red-200'},
   canceled:{title:'Η συναλλαγή ακυρώθηκε',desc:'Δεν ενεργοποιήθηκε Premium και δεν έγινε αυτόματη επαναχρέωση.',icon:AlertTriangle,style:'border-white/10 bg-white/5 text-zinc-200'}
 };
 const waitingForWebhook=order.providerStatus==='paid' &&
   ['pending','redirect','unknown','creating'].includes(order.status);
 const state=waitingForWebhook?states.awaiting_sync:(states[order.status]||states.pending);
 const Icon=state.icon;
 return <div role="status" className={'rounded-2xl border p-5 '+state.style}>
   <div className="flex items-start gap-3">
    <Icon size={24} className="shrink-0"/>
    <div><h3 className="font-black text-lg">{state.title}</h3>
      <p className="mt-2 text-sm opacity-80 leading-6">{state.desc}</p>
      {order.status==='scheduled'&&order.periodStartsAt&&<p className="mt-2 text-sm">Έναρξη νέας περιόδου: <strong>{dateText(order.periodStartsAt)}</strong></p>}
      {order.periodEndsAt&&<p className="mt-2 text-sm">Τέλος πληρωμένης περιόδου: <strong>{dateText(order.periodEndsAt)}</strong></p>}
      {order.status==='grace'&&order.graceEndsAt&&<p className="mt-2 text-sm">Λήξη χάριτος: <strong>{dateText(order.graceEndsAt)}</strong></p>}
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
 const [paymentMethod,setPaymentMethod]=useState({state:'none',automaticRenewal:false});
 const [saveCard,setSaveCard]=useState(false);
 const [useSavedCard,setUseSavedCard]=useState(false);
 const [methodBusy,setMethodBusy]=useState(false);
 const [methodError,setMethodError]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const userId=currentUser?._id||currentUser?.id||'';
 // UI-only demonstration: no server time change, financial mutation or API
 // checkout is allowed from preview mode. Exclusively stage.iradios.gr.
 const renewalPreviewRequested=window.location.hostname==='stage.iradios.gr' &&
   new URLSearchParams(location.search).get('renewal_preview')==='1';

 useEffect(()=>{
  if(!userId){setRenewalEligibility(null);return;}
  let canceled=false;
  const load=async()=>{
   try{
    const info=await call(API_URL+'/billing/me/renewal-notice');
    if(!canceled)setRenewalEligibility(info.renewal||null);
   }catch{if(!canceled)setRenewalEligibility(null);}
  };
  void load();
  return()=>{canceled=true;};
 },[API_URL,userId]);

 const refreshPaymentMethod=useCallback(async()=>{
  if(!userId)return;
  try{
   const response=await call(API_URL+'/billing/me/payment-method');
   const pm=response.paymentMethod;
   if(pm)setPaymentMethod(pm);
  }catch{
   setPaymentMethod({state:'unavailable',automaticRenewal:false});
   setMethodError('Η αποθηκευμένη κάρτα δεν είναι διαθέσιμη αυτή τη στιγμή. Μπορείς να πληρώσεις κανονικά με Nexi.');
  }
 },[API_URL,userId]);
 useEffect(()=>{
  if(!userId)return;
  void refreshPaymentMethod();
  const refresh=()=>void refreshPaymentMethod();
  window.addEventListener('focus',refresh);
  return()=>window.removeEventListener('focus',refresh);
 },[userId,refreshPaymentMethod]);
 const revokePaymentMethod=async()=>{
  if(methodBusy||!window.confirm('Να αφαιρεθεί η αποθηκευμένη κάρτα σου από τη Nexi; Δεν ακυρώνεται η ήδη πληρωμένη περίοδος.'))return;
  setMethodBusy(true);setMethodError('');
  try{
   const result=await call(API_URL+'/billing/me/payment-method/revoke',{
    method:'POST',headers:{'Content-Type':'application/json'},body:'{}'
   });
   setPaymentMethod(result.paymentMethod||{state:'revocation_pending'});
   setUseSavedCard(false);setSaveCard(false);
  }catch(e){setMethodError('Η αφαίρεση δεν ολοκληρώθηκε: '+e.message);}
  finally{setMethodBusy(false);}
 };

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
   }else if(result.order?.providerStatus==='paid'){
    setMessage('Η Nexi επιβεβαίωσε την πληρωμή στο ILUMA Gateway. Εκκρεμεί μόνο η ασφαλής αποστολή της ενημέρωσης προς το iRadios.');
   }
  }catch(e){setMessage(e.message);}
  finally{setBusy(false);}
 },[API_URL,order,loadOrders,finishVerified]);

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
      setMessage('Η Nexi επιβεβαίωσε την πληρωμή μέσω ILUMA Gateway. Η συνδρομή ενημερώθηκε στο iRadios.');
     }else if(result.order?.providerStatus==='paid')
      setMessage('Η πληρωμή είναι καταχωρισμένη ως επιτυχής στο Gateway. Περιμένουμε μόνο το υπογεγραμμένο webhook για την ενεργοποίηση της συνδρομής — μην πληρώσεις ξανά.');
     else if(kind==='cancel')
      setMessage('Επέστρεψες από ακύρωση. Θα επιβεβαιώσουμε την τελική κατάσταση στη Nexi πριν επιτραπεί άλλη προσπάθεια.');
     else
      setMessage('Επέστρεψες από τη Nexi. Αναμένουμε υπογεγραμμένη επιβεβαίωση από το Gateway πριν ενεργοποιηθεί η συνδρομή.');
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
  if(!userId||busy||!catalogOk||renewalPreviewRequested||
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
   const cardChoice=saveCard?{saveCard:true}:
     useSavedCard&&paymentMethod.state==='active'?{useSavedCard:true}:{};
   const response=await call(API_URL+'/billing/checkout',{
     method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},
     body:JSON.stringify(cardChoice)
   });
   setOrder(response.order);
   const url=response.order?.status==='redirect'?
      verifiedNexiUrl(response.order.checkoutUrl):null;
   if(url)window.location.assign(url);
   else setMessage('Το Gateway καταχώρισε το αίτημα αλλά δεν επέστρεψε ασφαλή σελίδα Nexi για δοκιμαστική κάρτα. Δεν έχει επιβεβαιωθεί πληρωμή. Έλεγξε την κατάσταση χωρίς δεύτερη προσπάθεια.');
  }catch(e){
   if(e.code==='GATEWAY_CATALOG_NOT_READY'){
    // Gateway 422 rejects before Nexi; this failed attempt can use a NEW
    // idempotency key after the catalog is repaired.
    sessionStorage.removeItem(KEY_PREFIX+userId);
    try{await loadOrders();}catch{}
   }
   setMessage(e.message);
  }
  finally{setBusy(false);}
 };
 const isListener=currentUser?.role==='user';
 const previewOnly=renewalPreviewRequested&&isListener&&
   ['active','grace'].includes(order?.status);
 // The displayed expired state is a demonstration only; checkout always
 // checks real server entitlements and never sends preview flags to Gateway.
 const visibleOrder=previewOnly?{...order,status:'expired'}:order;
 const isRenewal=(visibleOrder?.status==='expired' &&
   visibleOrder?.providerStatus==='paid') ||
   ['soon','grace'].includes(renewalEligibility?.kind);
 const paid=['active','grace','scheduled'].includes(order?.status);
 const blocked=['redirect','unknown','pending','creating'].includes(order?.status);
 const canCheckout=isListener&&
   (!currentUser?.isPremium||previewOnly||['soon','grace'].includes(renewalEligibility?.kind))&&
   (!paid||previewOnly||['soon','grace'].includes(renewalEligibility?.kind))&&!blocked;
 return <main className="mx-auto max-w-4xl px-4 pt-8 pb-44 lg:pt-14 text-white">
  <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-[#191e10] via-[#111411] to-[#090a08] p-6 sm:p-10 lg:p-12 overflow-hidden relative">
   <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#ccff00]/10 blur-[80px] pointer-events-none"/>
   <div className="relative">
    <div className="flex items-center gap-3 text-[#ccff00]">
      <Crown size={28}/><span className="text-xs uppercase tracking-[.2em] font-black">iRadios Premium</span>
    </div>
    <h1 className="mt-5 text-3xl sm:text-5xl font-black tracking-tight">Περισσότερη μουσική. Χωρίς διαφημίσεις της εφαρμογής.</h1>
    <p className="mt-4 text-zinc-400 leading-7">{isRenewal
     ?(renewalEligibility?.kind==='soon'
       ?'Το Premium πλησιάζει στη λήξη του. Ανανέωσε χειροκίνητα μέσω Nexi Sandbox: ο επόμενος μήνας θα ξεκινήσει όταν ολοκληρωθεί ο τρέχων, χωρίς να χάσεις ημέρες.'
       :renewalEligibility?.kind==='grace'
        ?'Η συνδρομή βρίσκεται σε περίοδο χάριτος. Με νέα χειροκίνητη πληρωμή μέσω Nexi Sandbox ξεκινά καινούρια μηνιαία περίοδος.'
        :'Το Premium σου έχει ολοκληρωθεί. Η χειροκίνητη ανανέωση δημιουργεί νέα συναλλαγή στο ILUMA Gateway, με πληρωμή στην ασφαλή σελίδα Nexi Sandbox. Δεν γίνεται αυτόματη χρέωση.')
     :'Μηνιαίο Listener Premium μέσω Nexi Sandbox, αποκλειστικά στο staging. Κάθε νέα περίοδος απαιτεί ξεχωριστή, χειροκίνητη πληρωμή.'}</p>
    <div className="mt-8 flex items-end gap-2"><span className="text-5xl font-black text-[#ccff00]">3,99 €</span><span className="text-zinc-400 pb-2 text-sm">{isRenewal?'για την επόμενη μηνιαία περίοδο':'για έναν μήνα'} · ΦΠΑ 24% συμπεριλαμβάνεται</span></div>
    <div className="grid sm:grid-cols-2 gap-3 mt-8">
     {['Χωρίς διαφημίσεις του iRadios','Music Radar χειροκίνητης αναγνώρισης',
       'Audio DSP και ισοσταθμιστής','Αναβαθμισμένες λειτουργίες ακρόασης'].map(title=><div key={title} className="flex items-center gap-2 text-sm text-zinc-200"><CheckCircle2 className="text-[#ccff00] shrink-0" size={17}/>{title}</div>)}
    </div>
   </div>
  </div>
  <section className="mt-6 p-5 sm:p-7 border border-white/10 bg-zinc-950/70 rounded-[24px] space-y-5">
   <div className="flex items-center gap-2"><ShieldCheck size={20} className="text-[#ccff00]"/><h2 className="font-bold text-xl">Ασφαλές Nexi Sandbox checkout</h2></div>
   <div className="flex items-start gap-2 text-xs text-zinc-400 leading-6">
    <LockKeyhole size={16} className="shrink-0 mt-1"/>
    Τα στοιχεία κάρτας πληκτρολογούνται μόνο στην ασφαλή σελίδα της Nexi. Το iRadios και η ILUMA δεν αποθηκεύουν αριθμούς κάρτας ή CVV. Δεν υπάρχει αυτόματη ανανέωση ή πραγματική χρέωση στο Sandbox.
   </div>
   {!currentUser&&<p className="text-sm">Για να συνεχίσεις χρειάζεται <Link to="/login" className="font-bold text-[#ccff00]">σύνδεση στον λογαριασμό σου</Link>.</p>}
   {currentUser&&!isListener&&<div role="alert" className="text-sm text-orange-200">Η δοκιμή αυτή αφορά μόνο Listener accounts. Για Broadcaster και Agency θα ακολουθήσουν ξεχωριστές πληρωμές.</div>}
   {previewOnly&&<div role="note" className="rounded-xl border border-amber-400/40 bg-amber-950/20 p-4 text-sm text-amber-100">
      <strong>Προεπισκόπηση ληγμένης συνδρομής — χωρίς χρέωση.</strong>
      <p className="mt-2 text-amber-200/80">Βλέπεις μόνο πώς θα εμφανιστεί η χειροκίνητη ανανέωση στον ακροατή. Η πραγματική συνδρομή παραμένει ενεργή, και το κουμπί πληρωμής είναι απενεργοποιημένο στην προεπισκόπηση.</p>
      <Link className="mt-3 inline-flex font-bold underline" to="/premium" replace>Επιστροφή στην πραγματική κατάσταση</Link>
    </div>}
   {isRenewal&&<div className="rounded-2xl border border-[#ccff00]/30 bg-[#ccff00]/5 p-5">
      <div className="flex items-center gap-2 text-[#ccff00] font-black"><RefreshCw size={18}/> Ανανέωση Listener Premium</div>
      <p className="mt-2 text-sm text-zinc-300">Νέα περίοδος ενός μήνα με 3,99 €. Θα μεταφερθείς στη Nexi για να πληκτρολογήσεις δοκιμαστική κάρτα. {renewalEligibility?.kind==='soon'
       ?'Αν πληρώσεις πριν τη λήξη, η επόμενη περίοδος ξεκινά όταν ολοκληρωθεί η τωρινή.'
       :'Το iRadios ενεργοποιεί την περίοδο μόνο όταν επιβεβαιωθεί η νέα πληρωμή από το ILUMA Gateway.'}</p>
    </div>}
   {currentUser?.isPremium&&!previewOnly&&order?.status!=='expired'&&
     <div className="flex items-center gap-2 text-lime-200 text-sm"><Gift size={18}/> Ο λογαριασμός σου έχει ήδη ενεργό Premium.</div>}
   {visibleOrder&&<Status order={visibleOrder}/>}
   {isListener&&<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2"><CreditCard size={18} className="text-[#ccff00]"/><h3 className="font-black">Τρόπος πληρωμής Nexi OneClick</h3></div>
      <p className="text-xs leading-6 text-zinc-400">Η κάρτα αποθηκεύεται μόνο στη Nexi. Το iRadios και το ILUMA Gateway δεν λαμβάνουν αριθμό κάρτας, CVV ή ημερομηνία λήξης. Καμία αυτόματη χρέωση δεν είναι ενεργή.</p>
      {paymentMethod.state==='active'&&<>
       <p className="text-sm text-lime-300">Η αποθηκευμένη κάρτα σου έχει επιβεβαιωθεί από τη Nexi.</p>
       <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input type="checkbox" checked={useSavedCard} disabled={!canCheckout||busy||previewOnly}
         onChange={e=>{setUseSavedCard(e.target.checked);if(e.target.checked)setSaveCard(false);}}
         className="mt-1 h-4 w-4 accent-[#ccff00]"/>
        <span>Χρήση αποθηκευμένης κάρτας στην επόμενη χειροκίνητη πληρωμή (με επιβεβαίωση Nexi / 3D Secure όπου ζητηθεί).</span>
       </label>
       <button type="button" onClick={revokePaymentMethod} disabled={methodBusy}
        className="text-sm underline text-zinc-300 hover:text-white disabled:opacity-50">Αφαίρεση αποθηκευμένης κάρτας</button>
      </>}
      {['none','revoked'].includes(paymentMethod.state)&&<label className="flex items-start gap-3 cursor-pointer text-sm">
       <input type="checkbox" checked={saveCard} disabled={!canCheckout||busy||previewOnly}
        onChange={e=>{setSaveCard(e.target.checked);if(e.target.checked)setUseSavedCard(false);}}
        className="mt-1 h-4 w-4 accent-[#ccff00]"/>
       <span>Επιλέγω προαιρετικά να αποθηκεύσει η Nexi την κάρτα μου για μελλοντικές πληρωμές που θα ξεκινώ εγώ. Μπορώ να την αφαιρέσω οποτεδήποτε. <strong>Δεν συμφωνώ σε αυτόματες χρεώσεις.</strong></span>
      </label>}
      {paymentMethod.state==='pending'&&<p className="text-sm text-amber-200">Η αποθήκευση της κάρτας εκκρεμεί μέχρι να επαληθευτεί το OneClick contract από τη Nexi.</p>}
      {paymentMethod.state==='revocation_pending'&&<p className="text-sm text-amber-200">Η αφαίρεση ζητήθηκε. Η κάρτα έχει ήδη απενεργοποιηθεί για νέες πληρωμές και περιμένουμε επιβεβαίωση Nexi.</p>}
      {paymentMethod.state==='revoked'&&<p className="text-sm text-zinc-300">Η προηγούμενη αποθηκευμένη κάρτα έχει αφαιρεθεί. Σε νέα πληρωμή θα πληκτρολογήσεις κάρτα.</p>}
      {methodError&&<p role="alert" className="text-sm text-amber-200">{methodError}</p>}
      <button type="button" disabled={methodBusy} onClick={refreshPaymentMethod}
       className="text-xs font-semibold text-[#ccff00] underline disabled:opacity-40">Ενημέρωση κατάστασης κάρτας</button>
    </div>}
   {message&&<div role="status" className="text-sm text-amber-100 bg-amber-950/30 border border-amber-700/30 p-4 rounded-xl">{message}</div>}
   {catalogError&&<div role="alert" className="text-sm text-red-200">{catalogError}</div>}
   <div className="flex gap-3 flex-wrap">
    {canCheckout&&
      <button type="button" disabled={busy||!catalogOk||previewOnly} onClick={beginCheckout}
       className="inline-flex items-center gap-2 bg-[#ccff00] hover:bg-[#d9ff4a] disabled:opacity-40 rounded-xl px-6 py-3.5 text-black font-black">
       <CreditCard size={18}/>{busy?'Επεξεργασία...':isRenewal?'Ανανέωση Premium — 3,99 €':'Συνέχεια στη Nexi Sandbox'}
      </button>}
    {order?.status==='redirect'&&verifiedNexiUrl(order.checkoutUrl)&&
      <a href={verifiedNexiUrl(order.checkoutUrl)} className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] text-black px-5 py-3 font-bold">
       <ExternalLink size={17}/> Άνοιγμα υπάρχοντος checkout
      </a>}
    {order&&<button disabled={busy} type="button" onClick={checkStatus}
      className="inline-flex items-center gap-2 px-5 py-3 border border-white/20 rounded-xl text-sm font-bold hover:bg-white/10 disabled:opacity-40">
      <RefreshCw size={17}/> Έλεγχος κατάστασης
     </button>}
    {paid&&<button type="button" onClick={()=>window.location.reload()} className="rounded-xl bg-[#ccff00] px-5 py-3 text-black font-bold">Ανανέωση προνομίων</button>}
   </div>
   <p className="text-xs text-zinc-500">Η επιστροφή από τη Nexi δεν ισοδυναμεί με επιτυχημένη πληρωμή. Ενεργοποίηση πραγματοποιείται μόνο μετά από επιβεβαιωμένο webhook προς το iRadios. Αν η κατάσταση είναι άγνωστη, δεν ξεκινάμε δεύτερο checkout.</p>
  </section>
 </main>;
}
