import React,{useCallback,useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {Crown,ShieldCheck,ExternalLink,RefreshCw,AlertTriangle,
 CreditCard,CheckCircle2,Clock3,LockKeyhole,Gift} from 'lucide-react';

// Phase 3 is an isolated first-month Nexi SANDBOX checkout. It never stores
// card details, never confirms success from redirect alone, and never auto-renews.
const KEY_PREFIX='iradios-nexi-stage-intent:';
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
   active:{title:'Η συνδρομή είναι ενεργή',desc:'Η πληρωμή επιβεβαιώθηκε από το Gateway με υπογεγραμμένο webhook.',icon:CheckCircle2,style:'border-lime-500/30 bg-lime-900/10 text-lime-200'},
   grace:{title:'Περίοδος χάριτος',desc:'Η πληρωμένη περίοδος ολοκληρώθηκε. Τα προνόμια διατηρούνται προσωρινά έως το όριο χάριτος που έχει ορίσει το iRadios.',icon:Clock3,style:'border-amber-500/30 bg-amber-900/10 text-amber-200'},
   expired:{title:'Η περίοδος ολοκληρώθηκε',desc:'Δεν υπάρχει ενεργή συνδρομή και δεν πραγματοποιείται αυτόματη ανανέωση.',icon:Clock3,style:'border-white/10 bg-white/5 text-zinc-200'},
   pending:{title:'Δεν έχει ανοίξει η φόρμα της Nexi',desc:'Δημιουργήθηκε αίτημα πληρωμής, αλλά δεν υπάρχει ακόμη σελίδα καταχώρισης κάρτας. Δεν πρόκειται για επιβεβαιωμένη χρέωση. Μην ξεκινήσεις δεύτερη συναλλαγή.',icon:Clock3,style:'border-yellow-500/30 bg-yellow-900/10 text-yellow-200'},
   creating:{title:'Προετοιμασία ασφαλούς πληρωμής',desc:'Δημιουργείται το αίτημα. Μη δημιουργήσεις δεύτερο checkout.',icon:Clock3,style:'border-yellow-500/30 bg-yellow-900/10 text-yellow-200'},
   redirect:{title:'Αναμονή πληρωμής μέσω Nexi Sandbox',desc:'Το checkout είναι διαθέσιμο. Premium ενεργοποιείται μόνο μετά την επιβεβαίωση.',icon:CreditCard,style:'border-yellow-500/30 bg-yellow-900/10 text-yellow-200'},
   unknown:{title:'Χρειάζεται έλεγχος της συναλλαγής',desc:'Η κατάσταση είναι άγνωστη. Δεν δημιουργούμε δεύτερη χρέωση και περιμένουμε ασφαλή επαλήθευση.',icon:AlertTriangle,style:'border-orange-500/30 bg-orange-900/10 text-orange-200'},
   failed:{title:'Η πληρωμή απέτυχε',desc:'Δεν ενεργοποιήθηκε Premium. Μπορείς να ξεκινήσεις νέα δοκιμαστική συναλλαγή.',icon:AlertTriangle,style:'border-red-500/30 bg-red-900/10 text-red-200'},
   canceled:{title:'Η συναλλαγή ακυρώθηκε',desc:'Δεν ενεργοποιήθηκε Premium και δεν έγινε αυτόματη επαναχρέωση.',icon:AlertTriangle,style:'border-white/10 bg-white/5 text-zinc-200'}
 };
 const state=states[order.status]||states.pending;
 const Icon=state.icon;
 return <div role="status" className={'rounded-2xl border p-5 '+state.style}>
   <div className="flex items-start gap-3">
    <Icon size={24} className="shrink-0"/>
    <div><h3 className="font-black text-lg">{state.title}</h3>
      <p className="mt-2 text-sm opacity-80 leading-6">{state.desc}</p>
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
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const userId=currentUser?._id||currentUser?.id||'';

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

 const checkStatus=useCallback(async()=>{
  setBusy(true);setMessage('');
  try{
   const current=order?.id?order:await loadOrders();
   if(!current?.id)return;
   const result=await call(API_URL+'/billing/orders/'+encodeURIComponent(current.id)+'?refresh=1');
   setOrder(result.order);
   // A browser return or a signed provider GET does NOT grant Premium.
   if(['active','grace'].includes(result.order?.status)){
    await updateAccount();
    setMessage(result.order.status==='active'
     ?'Η πληρωμή επιβεβαιώθηκε από το Gateway. Το Premium είναι ενεργό.'
     :'Η συνδρομή βρίσκεται σε περίοδο χάριτος σύμφωνα με τους κανόνες του iRadios.');
   }
  }catch(e){setMessage(e.message);}
  finally{setBusy(false);}
 },[API_URL,order,loadOrders,updateAccount]);

 // Nexi returns through ILUMA Gateway to this exact iRadios route.
 // The URL is a navigation hint, NOT a proof of payment.
 useEffect(()=>{
  const query=new URLSearchParams(location.search);
  const kind=query.get('gateway_return'),paymentOrder=query.get('order');
  if(!userId||!['result','cancel'].includes(kind))return;
  let canceled=false;
  (async()=>{
   try{
    const recent=await loadOrders();
    if(canceled)return;
    if(!recent||!paymentOrder||recent.gatewayOrderId!==paymentOrder){
     setMessage('Η επιστροφή δεν αντιστοιχεί στην τελευταία συναλλαγή σου. Έλεγξε το ιστορικό πριν συνεχίσεις.');
    }else{
     const result=await call(API_URL+'/billing/orders/'+encodeURIComponent(recent.id)+'?refresh=1');
     if(canceled)return;
     setOrder(result.order);
     if(['active','grace'].includes(result.order?.status)){
      await updateAccount();
      if(canceled)return;
      setMessage('Η Nexi επιβεβαίωσε την πληρωμή μέσω ILUMA Gateway. Η συνδρομή ενημερώθηκε στο iRadios.');
     }else if(kind==='cancel')
      setMessage('Επέστρεψες από ακύρωση. Θα επιβεβαιώσουμε την τελική κατάσταση στη Nexi πριν επιτραπεί άλλη προσπάθεια.');
     else
      setMessage('Επέστρεψες από τη Nexi. Αναμένουμε υπογεγραμμένη επιβεβαίωση από το Gateway πριν ενεργοποιηθεί η συνδρομή.');
    }
   }catch(e){if(!canceled)setMessage(e.message);}
   finally{if(!canceled)navigate('/premium',{replace:true});}
  })();
  return()=>{canceled=true;};
 },[API_URL,location.search,userId,loadOrders,navigate,updateAccount]);

 useEffect(()=>{
  if(!order||!['redirect','unknown','pending','creating'].includes(order.status))return;
  const id=setInterval(()=>void checkStatus(),20000);
  return()=>clearInterval(id);
 },[order?.id,order?.status,checkStatus]);

 const beginCheckout=async()=>{
  if(!userId||busy||!catalogOk||currentUser?.isPremium)return;
  setBusy(true);setMessage('');
  try{
   const newAttempt=order&&['failed','canceled','expired'].includes(order.status);
   const key=getOrCreateKey(userId,newAttempt);
   const response=await call(API_URL+'/billing/checkout',{
     method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},
     body:'{}'
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
 const paid=['active','grace'].includes(order?.status);
 const blocked=['redirect','unknown','pending','creating'].includes(order?.status);
 return <main className="mx-auto max-w-4xl px-4 pt-8 pb-44 lg:pt-14 text-white">
  <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-[#191e10] via-[#111411] to-[#090a08] p-6 sm:p-10 lg:p-12 overflow-hidden relative">
   <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#ccff00]/10 blur-[80px] pointer-events-none"/>
   <div className="relative">
    <div className="flex items-center gap-3 text-[#ccff00]">
      <Crown size={28}/><span className="text-xs uppercase tracking-[.2em] font-black">iRadios Premium</span>
    </div>
    <h1 className="mt-5 text-3xl sm:text-5xl font-black tracking-tight">Περισσότερη μουσική. Χωρίς διαφημίσεις της εφαρμογής.</h1>
    <p className="mt-4 text-zinc-400 leading-7">Δοκιμή πρώτης μηνιαίας περιόδου με Nexi Sandbox, αποκλειστικά στο staging. Η πραγματική ανανέωση θα ενεργοποιηθεί μόνο μετά τους ελέγχους Nexi.</p>
    <div className="mt-8 flex items-end gap-2"><span className="text-5xl font-black text-[#ccff00]">3,99 €</span><span className="text-zinc-400 pb-2 text-sm">για την πρώτη περίοδο ενός μήνα · ΦΠΑ 24% συμπεριλαμβάνεται</span></div>
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
   {currentUser?.isPremium&&!order?.status?.includes('expired')&&
     <div className="flex items-center gap-2 text-lime-200 text-sm"><Gift size={18}/> Ο λογαριασμός σου έχει ήδη ενεργό Premium.</div>}
   {order&&<Status order={order}/>}
   {message&&<div role="status" className="text-sm text-amber-100 bg-amber-950/30 border border-amber-700/30 p-4 rounded-xl">{message}</div>}
   {catalogError&&<div role="alert" className="text-sm text-red-200">{catalogError}</div>}
   <div className="flex gap-3 flex-wrap">
    {isListener&&!currentUser?.isPremium&&!paid&&!blocked&&
      <button type="button" disabled={busy||!catalogOk} onClick={beginCheckout}
       className="inline-flex items-center gap-2 bg-[#ccff00] hover:bg-[#d9ff4a] disabled:opacity-40 rounded-xl px-6 py-3.5 text-black font-black">
       <CreditCard size={18}/>{busy?'Επεξεργασία...':'Συνέχεια στη Nexi Sandbox'}
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
