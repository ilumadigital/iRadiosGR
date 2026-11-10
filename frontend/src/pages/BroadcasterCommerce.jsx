import React, {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {Activity,ArrowRight,BarChart3,Check,CheckCircle2,Clock3,Crown,
  Globe2,LockKeyhole,Radio,Rocket,ShieldCheck,SlidersHorizontal,Sparkles,
  Target,Zap} from 'lucide-react';

// Catalog is authoritative for pricing. Entitlements come from the server,
// never from a localStorage flag, a checkout redirect, or a client assertion.
const MODULES=[
  {sku:'ADD-AN',right:'broadcaster.analytics',name:'Audience Radar',
   subtitle:'Κάθε ακροατής μετράει',icon:BarChart3,accent:'sky',
   benefits:['Live Listeners Tracker','Χάρτης ακροατών και περιοχές',
    'Μέση διάρκεια ακρόασης','Ιστορικές περιοχές ακροατών','Στατιστικά διαφημίσεων']},
,
  {sku:'ADD-DSP',right:'broadcaster.webdsp',name:'WebDSP Audio Engine',
   subtitle:'Το δικό σου επαγγελματικό sound',icon:SlidersHorizontal,accent:'violet',
   benefits:['Audio Engine με επαγγελματικά presets','Dynamic range & προσαρμογή ήχου',
    'Premium Player Widget με DSP','Metadata, εξώφυλλα και Spotify 1Click',
    'Metadata Widget για το site του σταθμού']},
  {sku:'ADD-ADS',right:'broadcaster.ad_control',name:'iRadios Ad Control',
   subtitle:'Εσύ ορίζεις τις διαφημίσεις σου',icon:Target,accent:'emerald',
   benefits:['Διαχείριση διαφημίσεων του σταθμού','Custom ad spots',
    'Frequency targeting','Δυνατότητα opt-out από network ads']}
];
const PERIODS=[
  {code:'day',name:'1 ημέρα'},
  {code:'week',name:'7 ημέρες'},
  {code:'two_weeks',name:'14 ημέρες'},
  {code:'month',name:'1 μήνας'},
  {code:'year',name:'1 έτος'}
];
const euros=cents=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(Number(cents)/100);
const authHeaders=()=>({Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')});
async function get(url,signal){
  const response=await fetch(url,{headers:authHeaders(),signal,cache:'no-store'});
  if(!response.ok)throw new Error(response.status===401?'Η σύνδεσή σου έληξε. Συνδέσου ξανά.':
    'Δεν ήταν δυνατή η ανάκτηση των συνδρομών. Δοκίμασε ανανέωση.');
  return response.json();
}
async function post(url,body,requestKey=null){
 const res=await fetch(url,{method:'POST',
   headers:{...authHeaders(),'Content-Type':'application/json',
     ...(requestKey?{'Idempotency-Key':requestKey}:{})},
   body:JSON.stringify(body),cache:'no-store'});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Object.assign(new Error(data.error||'Η συναλλαγή δεν ολοκληρώθηκε.'),
   {code:data.code||'',status:res.status});
 return data;
}
function hostedUrl(value){
 try{
  const url=new URL(value);
  if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
    (url.hostname==='nexigroup.com'||url.hostname.endsWith('.nexigroup.com')))
    return url.toString();
 }catch{}
 return null;
}
const activeStates=new Set(['creating','pending','unknown','redirect']);
const purchaseKey=(account,sku,station)=>'iradios-broadcaster-key-'+account+'-'+sku+'-'+(station||'account');

function StateTag({active,included=false}){
  return <span className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider '+
    (active?'bg-[#ccff00]/15 text-[#ccff00]':included?'bg-sky-400/10 text-sky-300':'bg-white/[.07] text-zinc-400')}>
    {active?<CheckCircle2 size={13}/>:included?<Crown size={13}/>:<LockKeyhole size={12}/>}
    {active?'Ενεργό':included?'Στο Premium':'Κλειδωμένο'}
  </span>;
}
function Bullet({children,bright=false}){
  return <li className="flex items-start gap-3 text-[13px] leading-6 text-zinc-300">
    <Check className={'mt-1 shrink-0 '+(bright?'text-[#ccff00]':'text-zinc-500')} size={15}/>{children}
  </li>;
}
function Loading(){
  return <div role="status" className="rounded-3xl border border-white/10 bg-[#131718] p-8 text-sm text-zinc-300">
    <Activity className="mr-2 inline animate-pulse text-[#ccff00]" size={18}/> Ανάκτηση προϊόντων και ενεργών δικαιωμάτων…
  </div>;
}

export default function BroadcasterCommerce({stations=[],view='features',role='broadcaster',accountId=null}){
  const [catalog,setCatalog]=useState(null);
  const [accountRights,setAccountRights]=useState([]);
  const [byStation,setByStation]=useState({});
  const [selectedStation,setSelectedStation]=useState('');
  const [period,setPeriod]=useState('month');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [orders,setOrders]=useState([]);
  const [order,setOrder]=useState(null);
  const [busySku,setBusySku]=useState('');
  const [paymentNotice,setPaymentNotice]=useState('');
  const [recurring,setRecurring]=useState({});
  const [cancelTarget,setCancelTarget]=useState(null);
  const [cancelBusy,setCancelBusy]=useState(false);
  const [premiumBoostStations,setPremiumBoostStations]=useState([]);
  const [premiumBoostSelected,setPremiumBoostSelected]=useState([]);
  const [premiumBoostSaving,setPremiumBoostSaving]=useState(false);
  const approved=useMemo(()=>stations.filter(s=>s.status==='approved'),[stations]);
  useEffect(()=>{if(!approved.some(s=>s._id===selectedStation))
    setSelectedStation(approved[0]?._id||'');},[approved,selectedStation]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    Promise.all([
      get('/api/billing/catalog',controller.signal),
      get('/api/billing/me/entitlements',controller.signal),
      get('/api/billing/me/station-entitlements',controller.signal),
      get('/api/billing/broadcaster/orders',controller.signal)
    ]).then(([items,account,owned,purchases])=>{
      if(controller.signal.aborted)return;
      setCatalog(Object.fromEntries((items.products||[]).map(p=>[p.sku,p])));
      setAccountRights(account.entitlements||[]);
      setByStation(owned.byStation||{});
      setOrders(purchases.orders||[]);
      const last=accountId&&sessionStorage.getItem('iradios-broadcaster-order-'+accountId);
      const current=(purchases.orders||[]).find(p=>p.id===last)||
       (purchases.orders||[]).find(p=>p.gatewayOrderId&&
         p.gatewayOrderId===new URLSearchParams(window.location.search).get('order'));
      if(current)setOrder(current);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[accountId]);
  const refreshRights=async()=>{
   const [account,station,purchases]=await Promise.all([
    get('/api/billing/me/entitlements'),
    get('/api/billing/me/station-entitlements'),
    get('/api/billing/broadcaster/orders')
   ]);
   setAccountRights(account.entitlements||[]);
   setByStation(station.byStation||{});
   setOrders(purchases.orders||[]);
  };
  const inspectOrder=async(id=order?.id)=>{
   if(!id)return;
   setBusySku('reconcile');
   try{
    const data=await get('/api/billing/broadcaster/orders/'+encodeURIComponent(id)+'?refresh=1');
    setOrder(data.order);
    if(data.order?.status==='active'||data.order?.status==='expired'){
     setPaymentNotice('Η πληρωμή έχει επιβεβαιωθεί από το Gateway.');
     sessionStorage.removeItem('iradios-broadcaster-order-'+accountId);
     await refreshRights();
    }else if(['failed','canceled'].includes(data.order?.status)){
     setPaymentNotice('Η συναλλαγή δεν ολοκληρώθηκε. Δεν ενεργοποιήθηκαν προνόμια.');
     sessionStorage.removeItem('iradios-broadcaster-order-'+accountId);
     sessionStorage.removeItem(purchaseKey(accountId,data.order.sku,data.order.stationId));
    }else{
     setPaymentNotice('Αναμονή signed επιβεβαίωσης πληρωμής. Δεν θα γίνει δεύτερη χρέωση.');
    }
   }catch(e){setPaymentNotice(e.message);}
   finally{setBusySku('');}
  };
  const beginCheckout=async(sku,stationId=null,autoRenew=true)=>{
   if(busySku||!accountId||role!=='broadcaster'||(stationId&&!available))return;
   setBusySku(sku);setPaymentNotice('');
   const keyName=purchaseKey(accountId,sku,stationId);
   let key=sessionStorage.getItem(keyName);
   if(!key){key=crypto.randomUUID();sessionStorage.setItem(keyName,key);}
   try{
    const result=await post('/api/billing/broadcaster/checkout',{
      sku,...(stationId?{stationId}:{}),autoRenew
    },key);
    if(result.order){
     setOrder(result.order);
     sessionStorage.setItem('iradios-broadcaster-order-'+accountId,result.order.id);
     const url=result.order.status==='redirect'?hostedUrl(result.order.checkoutUrl):null;
     if(url){window.location.assign(url);return;}
     setPaymentNotice('Η πληρωμή εκκρεμεί. Έλεγξε πρώτα την υπάρχουσα συναλλαγή, χωρίς νέα χρέωση.');
    }
   }catch(e){
    if(e.code==='GATEWAY_BROADCASTER_NOT_READY'){
      sessionStorage.removeItem(keyName);
    }
    setPaymentNotice(e.message);
    await get('/api/billing/broadcaster/orders').then(data=>setOrders(data.orders||[])).catch(()=>{});
   }finally{setBusySku('');}
  };
  const recurringKey=(sku,stationId)=>sku+':'+(stationId||'account');
  const loadRecurring=async(sku,stationId=null)=>{
   const key=recurringKey(sku,stationId);
   try{
    const params=new URLSearchParams({sku,...(stationId?{stationId}:{})});
    const result=await get('/api/billing/broadcaster/recurring?'+params.toString());
    setRecurring(prev=>({...prev,[key]:result.recurring}));
   }catch{setRecurring(prev=>({...prev,[key]:{state:'unavailable'}}));}
  };
  useEffect(()=>{
   if(!accountId||!catalog)return;
   const scoped=selectedStation?MODULES.map(p=>[p.sku,selectedStation]):[];
   void Promise.all([loadRecurring('B-PREM'),...scoped.map(([sku,station])=>loadRecurring(sku,station))]);
  },[accountId,catalog,selectedStation]);
  useEffect(()=>{
   if(!order||!activeStates.has(order.status))return;
   const timer=setInterval(()=>{void inspectOrder(order.id);},20000);
   return()=>clearInterval(timer);
  },[order?.id,order?.status]);
  useEffect(()=>{
   if(!accountId||!order?.id)return;
   const params=new URLSearchParams(window.location.search);
   if(!params.get('gateway_return')||!params.get('order')||
      order.gatewayOrderId!==params.get('order'))return;
   void inspectOrder(order.id);
  },[accountId,order?.id,order?.gatewayOrderId]);
  const stopRenewal=async()=>{
   if(!cancelTarget||cancelBusy)return;
   setCancelBusy(true);
   try{
    const payload={sku:cancelTarget.sku,...(cancelTarget.stationId?
      {stationId:cancelTarget.stationId}:{})};
    const data=await post('/api/billing/broadcaster/recurring/cancel',payload);
    setPaymentNotice('Η αυτόματη ανανέωση διακόπηκε. Τα πληρωμένα προνόμια παραμένουν μέχρι τη λήξη.');
    setRecurring(prev=>({...prev,[recurringKey(payload.sku,payload.stationId)]:
      data.recurring}));
    setCancelTarget(null);
   }catch(e){setPaymentNotice(e.message);}
   finally{setCancelBusy(false);}
  };
  const fullPremium=accountRights.includes('broadcaster.unlimited_stations');
  useEffect(()=>{
    if(!fullPremium)return;
    const ctrl=new AbortController();
    get('/api/billing/broadcaster/premium-boost',ctrl.signal).then(result=>{
      if(!ctrl.signal.aborted){
        setPremiumBoostStations(result.stations||[]);
        setPremiumBoostSelected(result.selected||[]);
      }
    }).catch(()=>{if(!ctrl.signal.aborted)
      setPaymentNotice('Δεν ήταν διαθέσιμη η επιλογή Premium Boost.');});
    return()=>ctrl.abort();
  },[fullPremium]);
  const savePremiumBoost=async()=>{
    if(premiumBoostSaving)return;
    setPremiumBoostSaving(true);
    try{
      const result=await post('/api/billing/broadcaster/premium-boost',{
        stationIds:premiumBoostSelected
      });
      setPremiumBoostSelected(result.selected||[]);
      setPaymentNotice('Οι επιλογές Premium Boost αποθηκεύτηκαν.');
    }catch(e){setPaymentNotice(e.message);}
    finally{setPremiumBoostSaving(false);}
  };
  const stationRights=new Set(byStation[selectedStation]||[]);
  const has=right=>fullPremium||stationRights.has(right);
  const price=sku=>catalog?.[sku]?euros(catalog[sku].priceCents):'—';
  const isPreview=role==='admin';
  const duration=PERIODS.find(p=>p.code===period)?.name||'';
  const available=Boolean(selectedStation)&&!isPreview;
  const gateNote='Οι αγορές πραγματοποιούνται αποκλειστικά μέσω ασφαλούς Nexi Sandbox checkout. Η ενεργοποίηση γίνεται μόνο μετά από υπογεγραμμένη επιβεβαίωση του Gateway. Σε άγνωστη κατάσταση μην ξεκινήσεις δεύτερη πληρωμή.';
  return <div className="mx-auto max-w-[1300px] space-y-8 pb-16 text-white">
    <header className="relative overflow-hidden rounded-[32px] border border-[#ccff00]/20 bg-gradient-to-br from-[#202920] via-[#151a19] to-[#0a0d0d] p-7 md:p-12">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[#ccff00]/10 blur-[85px]"/>
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/25 bg-[#ccff00]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.18em] text-[#ccff00]">
          {view==='boost'?<Rocket size={14}/>:<Crown size={14}/>} iRadiosGR Broadcaster
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-[-.055em] md:text-6xl">
          {view==='boost'?'Δώσε στον σταθμό σου την προβολή που αξίζει.':'Ξεκλείδωσε ολόκληρη τη δύναμη του σταθμού σου.'}
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-300 md:text-base">
          {view==='boost'?'Αγόρασε επιπλέον προβολή για συγκεκριμένο χρονικό διάστημα, χωρίς αυτόματη ανανέωση.':
            'Επαγγελματικός ήχος, πραγματικά δεδομένα και έλεγχος διαφημίσεων. Επίλεξε ένα εργαλείο ανά σταθμό ή το ολοκληρωμένο Premium πακέτο.'}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/backoffice/pro-features" className={'rounded-xl px-5 py-3 text-xs font-black '+(view==='features'?'bg-[#ccff00] text-black':'border border-white/20 text-white hover:bg-white/10')}>Pro Features</Link>
          <Link to="/backoffice/boost" className={'rounded-xl px-5 py-3 text-xs font-black '+(view==='boost'?'bg-[#ccff00] text-black':'border border-white/20 text-white hover:bg-white/10')}>Boost My Radio</Link>
          <Link to="/backoffice/billing" className="rounded-xl border border-white/20 px-5 py-3 text-xs font-black text-white hover:bg-white/10">Οι συνδρομές μου</Link>
        </div>
      </div>
    </header>

    {paymentNotice&&<div role="status" className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">{paymentNotice}</div>}
    {order&&<section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/15 bg-[#161c1c] p-5">
      <div><p className="text-xs font-black text-white">Τελευταία συναλλαγή · {order.sku}</p>
        <p className="mt-2 text-xs text-zinc-400">Κατάσταση: <strong className="text-[#ccff00]">{order.status}</strong>
        {order.periodEndsAt?' · Λήξη: '+new Date(order.periodEndsAt).toLocaleDateString('el-GR'):''}</p></div>
      {activeStates.has(order.status)&&<button type="button" disabled={Boolean(busySku)}
        onClick={()=>void inspectOrder(order.id)}
        className="rounded-xl bg-[#ccff00] px-5 py-3 text-xs font-black text-black disabled:opacity-50">Έλεγχος πληρωμής</button>}
    </section>}
    {loading?<Loading/>:error?<div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5 text-sm text-rose-200">
      {error} <button className="ml-3 font-black underline" onClick={()=>window.location.reload()}>Ανανέωση</button></div>:<>
      <section className="flex flex-wrap items-end justify-between gap-5 rounded-[24px] border border-white/10 bg-[#131718] p-5 md:p-7">
        <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ccff00]">Ο σταθμός σου</p>
          <h2 className="mt-2 text-xl font-black">Διάλεξε τον σταθμό που διαχειρίζεσαι</h2>
          <p className="mt-2 max-w-lg text-xs leading-5 text-zinc-400">
            Τα add-ons και τα αγορασμένα Boost ισχύουν ανά σταθμό. Το Broadcaster Premium καλύπτει τους σταθμούς του λογαριασμού σύμφωνα με το τρέχον πρόγραμμα.</p></div>
        <label className="min-w-[230px] flex-1 md:max-w-sm">
          <span className="mb-2 block text-[11px] font-bold text-zinc-400">Εγκεκριμένος σταθμός</span>
          <select value={selectedStation} onChange={e=>setSelectedStation(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-[#090b0d] p-3.5 text-sm font-bold text-white focus:border-[#ccff00]">
            {!approved.length&&<option value="">Δεν υπάρχει εγκεκριμένος σταθμός</option>}
            {approved.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </label>
      </section>
      {view==='features'?<>
        <section className="relative overflow-hidden rounded-[32px] border-2 border-[#ccff00]/60 bg-[#171e12] p-7 shadow-[0_20px_80px_rgba(204,255,0,.06)] md:p-10">
          <div className="pointer-events-none absolute -right-12 -top-12 size-64 rounded-full bg-[#ccff00]/10 blur-[70px]"/>
          <div className="relative grid items-start gap-8 lg:grid-cols-[1.15fr_.85fr]">
            <div>
              <StateTag active={fullPremium}/>
              <div className="mt-5 flex items-center gap-3 text-[#ccff00]"><Crown size={33}/><span className="text-[11px] font-black uppercase tracking-[.2em]">THE PRO PACK</span></div>
              <h2 className="mt-3 text-4xl font-black tracking-[-.05em] md:text-5xl">Broadcaster Premium</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300">Τα εργαλεία που χρειάζεται ένας σύγχρονος ραδιοφωνικός σταθμός, σε ένα πακέτο. Περιλαμβάνει WebDSP, Audience Radar, Ad Control και Premium Boost.</p>
              <div className="mt-6 flex items-end gap-2"><span className="text-5xl font-black tracking-tighter text-[#ccff00]">{price('B-PREM')}</span><span className="pb-1 text-sm text-zinc-400">/ μήνα</span></div>
              <p className="mt-2 text-[11px] text-zinc-400">Τελική τιμή με ΦΠΑ 24% · Μηνιαία συνδρομή μέχρι ακύρωσης</p>
              <p className="mt-2 text-xs leading-6 text-zinc-300">Με την «Έναρξη συνδρομής» συμφωνείς σε επαναλαμβανόμενη χρέωση <strong>{price('B-PREM')}/μήνα</strong> μέσω Nexi, μέχρι να την ακυρώσεις από το Backoffice. Η ακύρωση σταματά τις μελλοντικές χρεώσεις.</p>
              {fullPremium&&recurring[recurringKey('B-PREM')]?.state==='active'&&<button
                className="mt-3 text-xs font-bold text-rose-300 underline" type="button"
                onClick={()=>setCancelTarget({sku:'B-PREM'})}>Διακοπή αυτόματης ανανέωσης Premium</button>}
              <div className="mt-7 flex flex-wrap gap-3">
                {fullPremium?<span className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-6 py-3.5 text-xs font-black text-black"><CheckCircle2 size={16}/> Το Premium σου είναι ενεργό</span>:
                  <button type="button" disabled={Boolean(busySku)}
                    onClick={()=>void beginCheckout('B-PREM',null,true)}
                    className="rounded-xl bg-[#ccff00] px-6 py-3.5 text-xs font-black text-black transition hover:bg-[#e2ff83] disabled:opacity-50">
                    {busySku==='B-PREM'?'Δημιουργία ασφαλούς πληρωμής…':'Έναρξη συνδρομής με Nexi'}
                  </button>}
                <Link to="/backoffice/boost" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3.5 text-xs font-black text-white">Πρόσθετη προβολή <ArrowRight size={15}/></Link>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/25 p-6">
              <p className="mb-5 text-xs font-black uppercase tracking-[.13em] text-[#ccff00]">Όλα μέσα στο Premium</p>
              <ul className="space-y-3">
                {['Απεριόριστη διαχείριση σταθμών','WebDSP Audio Engine & προσαρμογή ήχου',
                  'Audience Radar & προηγμένα Analytics','iRadios Ad Control',
                  'Premium Player & Metadata Widgets με Spotify 1Click',
                  'Premium Boost στους επιλέξιμους σταθμούς',
                  'Προτεραιότητα στην υποστήριξη','Πρόσβαση σε νέες Beta λειτουργίες'].map(v=><Bullet key={v} bright>{v}</Bullet>)}
              </ul>
              <div className="mt-6 rounded-xl border border-[#ccff00]/15 bg-[#ccff00]/[.06] p-3 text-xs leading-5 text-zinc-300">
                Το αγορασμένο Boost έχει πάντα υψηλότερη προτεραιότητα από το Boost που περιλαμβάνει το Premium.
              </div>
              {fullPremium&&<div className="mt-6 border-t border-white/10 pt-6">
                <h3 className="text-sm font-black text-[#ccff00]">Επιλογή σταθμών Premium Boost</h3>
                <p className="mt-2 text-xs leading-6 text-zinc-400">Επίλεξε τους εγκεκριμένους σταθμούς σου που θα χρησιμοποιούν το περιλαμβανόμενο Premium Boost. Οι αγορασμένες προβολές υπερισχύουν.</p>
                <div className="mt-4 max-h-56 space-y-2 overflow-y-auto">
                  {premiumBoostStations.length===0&&<p className="text-xs text-zinc-500">Δεν υπάρχει εγκεκριμένος σταθμός.</p>}
                  {premiumBoostStations.map(station=><label key={station.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs font-bold">
                    <input type="checkbox" className="size-4 accent-lime-400"
                      checked={premiumBoostSelected.includes(station.id)}
                      onChange={e=>setPremiumBoostSelected(prev=>e.target.checked?
                        [...prev.filter(id=>id!==station.id),station.id]:
                        prev.filter(id=>id!==station.id))}/>
                    <span>{station.name}</span>
                  </label>)}
                </div>
                <button type="button" disabled={premiumBoostSaving}
                  onClick={()=>void savePremiumBoost()}
                  className="mt-4 w-full rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/10 p-3.5 text-xs font-black text-[#ccff00] hover:bg-[#ccff00]/20 disabled:opacity-50">
                  {premiumBoostSaving?'Αποθήκευση…':'Αποθήκευση σταθμών Premium Boost'}
                </button>
              </div>}
            </div>
          </div>
        </section>
        <div>
          <h2 className="text-2xl font-black tracking-tight">Πάρε μόνο ό,τι χρειάζεσαι</h2>
          <p className="mt-2 text-sm text-zinc-400">Τα ανεξάρτητα modules χρεώνονται ανά σταθμό. Η ενεργοποίησή τους δεν κλειδώνει την πρόσβαση στο υπόλοιπο Pro Pack.</p>
        </div>
        <section className="grid gap-5 lg:grid-cols-3">
          {MODULES.map(module=>{
            const Icon=module.icon,active=has(module.right);
            const included=fullPremium;
            return <article key={module.sku} className="flex flex-col rounded-[28px] border border-white/10 bg-[#131718] p-6 transition hover:border-white/20">
              <div className="flex items-start justify-between gap-4"><div className="flex size-12 items-center justify-center rounded-2xl bg-white/[.07] text-[#ccff00]"><Icon size={23}/></div>
                <StateTag active={active} included={included}/></div>
              <h3 className="mt-5 text-2xl font-black tracking-tight">{module.name}</h3>
              <p className="mt-1 text-xs text-zinc-400">{module.subtitle}</p>
              <div className="mt-5 flex items-baseline gap-1"><span className="text-3xl font-black">{price(module.sku)}</span><span className="text-xs text-zinc-500">/ μήνα / σταθμό</span></div>
              <p className="mt-2 text-[11px] leading-5 text-zinc-400">Μηνιαία επαναλαμβανόμενη χρέωση μέσω Nexi μέχρι ακύρωσης. Περιλαμβάνεται ΦΠΑ 24%.</p>
              <ul className="my-7 flex-1 space-y-3">{module.benefits.map(f=><Bullet key={f}>{f}</Bullet>)}</ul>
              {active?<Link to={{'ADD-AN':'/backoffice/radar','ADD-DSP':'/backoffice/audio','ADD-ADS':'/backoffice/ad-control'}[module.sku]}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/10 px-4 py-3.5 text-xs font-black text-[#ccff00] transition hover:bg-[#ccff00]/20">
                <CheckCircle2 size={16}/>{included?'Περιλαμβάνεται · Άνοιγμα':'Ενεργό · Άνοιγμα εργαλείου'} <ArrowRight size={14}/></Link>:
              <button type="button" disabled={!available||Boolean(busySku)}
                onClick={()=>void beginCheckout(module.sku,selectedStation,true)}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-xs font-black text-black hover:bg-[#ccff00] disabled:opacity-40">
                <Zap size={15}/>{busySku===module.sku?'Δημιουργία πληρωμής…':'Ενεργοποίηση με Nexi'}</button>}
              {active&&recurring[recurringKey(module.sku,selectedStation)]?.state==='active'&&
                <button type="button" onClick={()=>setCancelTarget({sku:module.sku,stationId:selectedStation})}
                  className="mt-3 text-xs font-bold text-rose-300 underline">Διακοπή αυτόματης ανανέωσης</button>}
            </article>;
          })}
        </section>
      </>:<>
        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[.06] p-5 text-xs leading-6 text-sky-100">
          <Clock3 className="mr-2 inline" size={16}/> Το Boost αγοράζεται μία φορά, με συγκεκριμένη ημερομηνία λήξης. Δεν μετατρέπεται σε συνδρομή και δεν ανανεώνεται χωρίς νέα αγορά.
        </div>
        <section className="grid gap-5 md:grid-cols-2">
          {[{prefix:'BOOST-T',name:'Category / Region Boost',icon:Target,description:'Στοχευμένη προβολή στη σωστή κατηγορία και περιοχή.'},
            {prefix:'BOOST-G',name:'Global Boost',icon:Globe2,description:'Προβολή σε ολόκληρο το δίκτυο iRadios με ανώτερη προτεραιότητα από το Premium Boost.'}
          ].map(pack=>{
            const Icon=pack.icon;
            return <article key={pack.prefix} className="flex flex-col rounded-[28px] border border-white/10 bg-[#131718] p-7">
              <div className="flex items-center gap-3 text-[#ccff00]"><Icon size={29}/><span className="text-[10px] font-black uppercase tracking-[.2em]">One-off αγορά</span></div>
              <h2 className="mt-5 text-2xl font-black">{pack.name}</h2>
              <p className="mt-3 min-h-14 text-sm leading-6 text-zinc-400">{pack.description}</p>
              <p className="mt-6 text-4xl font-black tracking-tight">{price(pack.prefix+'-'+period.toUpperCase().replace('TWO_WEEKS','2W').replace('MONTH','MONTH'))}</p>
              <p className="mt-2 text-xs text-zinc-400">Τελική τιμή με ΦΠΑ 24% · {duration}</p>
              <button type="button" disabled={!available||Boolean(busySku)}
                onClick={()=>void beginCheckout(pack.prefix+'-'+period.toUpperCase().replace('TWO_WEEKS','2W'),selectedStation,false)}
                className="mt-8 rounded-xl bg-[#ccff00] px-5 py-3.5 text-xs font-black text-black transition hover:bg-white disabled:opacity-40">
                {busySku.startsWith(pack.prefix)?'Δημιουργία πληρωμής…':'Αγορά Boost με Nexi · μία φορά'}</button>
            </article>;
          })}
        </section>
        <div className="rounded-2xl border border-white/10 bg-[#131718] p-6">
          <h3 className="text-sm font-black">Επίλεξε διάρκεια</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {PERIODS.map(p=><button key={p.code} type="button" onClick={()=>setPeriod(p.code)}
              aria-pressed={period===p.code} className={'rounded-xl px-4 py-3 text-xs font-bold '+(period===p.code?'bg-[#ccff00] text-black':'border border-white/10 bg-white/[.04] text-zinc-300 hover:bg-white/10')}>{p.name}</button>)}
          </div>
        </div>
      </>}
      {cancelTarget&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
        <div role="dialog" aria-modal="true" aria-label="Ακύρωση αυτόματης ανανέωσης"
          className="w-full max-w-lg rounded-[28px] border border-white/20 bg-[#161b1d] p-8">
          <h3 className="text-2xl font-black">Διακοπή αυτόματης ανανέωσης;</h3>
          <p className="mt-4 text-sm leading-7 text-zinc-300">Θα σταματήσουν οι μελλοντικές χρεώσεις για το {cancelTarget.sku}. Όσα προνόμια έχουν ήδη πληρωθεί θα παραμείνουν διαθέσιμα μέχρι τη λήξη της περιόδου.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button disabled={cancelBusy} onClick={()=>setCancelTarget(null)}
              className="rounded-xl border border-white/20 px-5 py-3 text-xs font-black">Επιστροφή</button>
            <button disabled={cancelBusy} onClick={()=>void stopRenewal()}
              className="rounded-xl bg-rose-500 px-5 py-3 text-xs font-black text-white disabled:opacity-50">
              {cancelBusy?'Ενημέρωση Gateway…':'Επιβεβαίωση ακύρωσης'}</button>
          </div>
        </div>
      </div>}
      <div role="note" className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[.06] p-5 text-xs leading-6 text-amber-100">
        <ShieldCheck className="mt-1 shrink-0" size={18}/>
        <span>{gateNote}{!available&&!isPreview?' Για αγορές ανά σταθμό απαιτείται πρώτα εγκεκριμένος σταθμός.':''}</span>
      </div>
    </>}
  </div>;
}
