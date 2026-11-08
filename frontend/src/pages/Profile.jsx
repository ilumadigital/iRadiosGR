import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {
  ArrowRight,Bell,BellRing,CalendarDays,Check,ChevronRight,Clock3,Compass,
  CreditCard,Crown,Headphones,Heart,Loader2,LogOut,Mail,MapPin,Mic2,
  Music2,Newspaper,Radio,Save,Settings2,ShieldCheck,Sparkles,UserRound,
  Volume2,Wallet,XCircle,Zap
} from 'lucide-react';
import ProfileFollows from '../components/ProfileFollows';
import ProfileInbox from '../components/ProfileInbox';
import ProfileSecurity from '../components/ProfileSecurity';
import '../styles/profile.css';

const TOPICS=[
  {id:'newStations',Icon:Radio,title:'Νέοι ραδιοφωνικοί σταθμοί',desc:'Μάθε όταν νέοι σταθμοί προστίθενται στο iRadiosGR.'},
  {id:'favoriteSchedule',Icon:CalendarDays,title:'Πρόγραμμα αγαπημένων σταθμών',desc:'Ενημερώσεις για το πρόγραμμα των σταθμών που ακολουθείς.'},
  {id:'shows',Icon:Mic2,title:'Εκπομπές & παραγωγοί',desc:'Υπενθυμίσεις για εκπομπές και αγαπημένους παραγωγούς.'},
  {id:'news',Icon:Newspaper,title:'Ειδήσεις που σε αφορούν',desc:'Επιλεγμένη ενημέρωση από το δίκτυο ειδήσεων.'},
  {id:'promotions',Icon:Sparkles,title:'Προσφορές & προωθητικές ενέργειες',desc:'Προαιρετικές εμπορικές ενημερώσεις. Χρειάζεται ρητή συγκατάθεση.'}
];
const INITIAL_PREFS={
  push:true,email:true,
  topics:{newStations:true,favoriteSchedule:true,shows:true,news:true,promotions:false}
};
const PLAN_NAMES={
  listener_premium:'iRadios Premium',full_premium:'Broadcaster Premium',
  ad_control_solo:'Ad Control',dsp_solo:'DSP Studio',analytics_solo:'Analytics Pro'
};
const fmtDate=value=>{
  if(!value)return 'Δεν έχει οριστεί';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('el-GR',{dateStyle:'medium'}).format(date):'Δεν έχει οριστεί';
};
const authHeaders=()=>({
  'Content-Type':'application/json',
  Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')
});
const toFields=user=>({
  username:user.username||'',email:user.email||'',fname:user.fname||'',
  lname:user.lname||'',phone:user.phone||'',
  birthdate:user.birthdate&&Number.isFinite(new Date(user.birthdate).getTime())?new Date(user.birthdate).toISOString().slice(0,10):''
});
function Toggle({checked,onChange,label,disabled=false}){
  return <button type="button" role="switch" aria-checked={Boolean(checked)} aria-label={label}
    onClick={onChange} disabled={disabled}
    className={'ir-profile-switch '+(checked?'ir-profile-switch--on':'')} >
    <span aria-hidden="true" className="ir-profile-switch__thumb"/>
  </button>;
}
function ProfileField({label,name,type='text',value,onChange,required=false}){
  return <label className="flex min-w-0 flex-col gap-2">
    <span className="text-xs font-bold text-zinc-400">{label}</span>
    <input className="ir-profile-input" type={type} value={value} required={required}
      onChange={e=>onChange(name,e.target.value)} maxLength={name==='phone'?30:120}/>
  </label>;
}
function SectionHeading({icon:Icon,title,description}){
  return <div className="mb-5 flex items-start gap-3">
    <span className="ir-profile-section-icon"><Icon size={19}/></span>
    <div><h2 className="text-lg font-black tracking-tight text-white sm:text-xl">{title}</h2>
      {description&&<p className="mt-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">{description}</p>}</div>
  </div>;
}

export default function Profile({API_URL='/api',onLogout,currentUser=null}){
  const navigate=useNavigate();
  const location=useLocation();
  const allowedTabs=['details','notifications','follows','inbox','subscription'];
  const fromQuery=()=>{
    const requested=new URLSearchParams(location.search).get('tab');
    return requested==='security'||requested==='settings'?'details':
      allowedTabs.includes(requested)?requested:'details';
  };
  const [tab,setTab]=useState(fromQuery);
  const [inboxUnread,setInboxUnread]=useState(0);
  const selectTab=id=>{
    if(!allowedTabs.includes(id))return;
    setTab(id);
    navigate('/profile?tab='+id,{replace:true});
  };
  useEffect(()=>{setTab(fromQuery());},[location.search]);
  // Display the authenticated session instantly; refresh only from /auth/me.
  // Failure of notification-preferences must NEVER erase account/premium details.
  const [user,setUser]=useState(currentUser||null);
  const [fields,setFields]=useState(toFields(currentUser||{}));
  const [preferences,setPreferences]=useState(INITIAL_PREFS);
  const [newsCategories,setNewsCategories]=useState([]);
  const [pushAvailable,setPushAvailable]=useState(false);
  const [pushSupported,setPushSupported]=useState(false);
  const [deviceRegistered,setDeviceRegistered]=useState(false);
  const [pushPermission,setPushPermission]=useState('default');
  const [busy,setBusy]=useState(false);
  const [prefBusy,setPrefBusy]=useState('');
  const [deviceBusy,setDeviceBusy]=useState(false);
  const [cancelId,setCancelId]=useState('');
  const [notice,setNotice]=useState(null);
  const [loading,setLoading]=useState(!currentUser);

  const refreshUser=useCallback(async(signal)=>{
    // Keep independent API calls independent: the Profile is sourced from
    // /auth/me; preference failure only affects the notification panel.
    const response=await fetch(API_URL+'/auth/me',{headers:authHeaders(),signal,cache:'no-store'});
    if(!response.ok)throw Error(response.status===401?'Η συνεδρία έληξε. Συνδέσου ξανά.':'Δεν φορτώθηκαν τα στοιχεία λογαριασμού.');
    const loaded=await response.json();
    if(!loaded||(!loaded._id&&!loaded.id))throw Error('Ο server δεν επέστρεψε έγκυρο λογαριασμό.');
    if(signal.aborted)return;
    setUser(loaded);
    setFields(toFields(loaded));
    try{
      const prefsResponse=await fetch(API_URL+'/users/me/notification-preferences',{
        headers:authHeaders(),signal,cache:'no-store'});
      if(!prefsResponse.ok)throw Error('Οι επιλογές ειδοποιήσεων δεν είναι προσωρινά διαθέσιμες.');
      const settings=await prefsResponse.json();
      if(signal.aborted)return;
      setPreferences(settings.preferences||INITIAL_PREFS);
      setPushAvailable(Boolean(settings.pushDeliveryAvailable));
    }catch(error){
      if(!signal.aborted)setNotice({type:'error',text:error.message||'Δεν φορτώθηκαν οι προτιμήσεις.'});
    }
  },[API_URL]);
  useEffect(()=>{
    const controller=new AbortController();
    refreshUser(controller.signal).catch(err=>{
      if(!controller.signal.aborted)setNotice({type:'error',text:err.message||'Σφάλμα σύνδεσης.'});
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[refreshUser]);

  const checkDevice=useCallback(async()=>{
    const supported=typeof Notification!=='undefined' && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext;
    setPushSupported(supported);
    if(!supported)return;
    setPushPermission(Notification.permission);
    const registration=await navigator.serviceWorker.getRegistration();
    const subscription=await registration?.pushManager?.getSubscription();
    if(!subscription){setDeviceRegistered(false);return;}
    // The browser's subscription alone does not prove the device is linked to this account.
    const response=await fetch(API_URL+'/notifications/my-device/status',{
      method:'POST',headers:authHeaders(),body:JSON.stringify({endpoint:subscription.endpoint})
    });
    const data=await response.json().catch(()=>({}));
    setDeviceRegistered(response.ok && Boolean(data.registered));
  },[API_URL]);

  useEffect(()=>{
    if(!user)return;
    checkDevice().catch(()=>setDeviceRegistered(false));
  },[user?._id,checkDevice]);

  useEffect(()=>{
    if(tab!=='notifications')return undefined;
    const controller=new AbortController();
    fetch(API_URL+'/newsfeed',{signal:controller.signal})
      .then(r=>r.ok?r.json():{})
      .then(data=>{
        if(controller.signal.aborted)return;
        setNewsCategories(Array.isArray(data.categories)?data.categories.filter(c=>typeof c==='string'&&c.trim()).slice(0,24):[]);
      }).catch(()=>{});
    return()=>controller.abort();
  },[tab,API_URL]);

  const setField=(name,value)=>setFields(old=>({...old,[name]:value}));

  const saveProfile=async event=>{
    event.preventDefault();
    if(busy)return;
    setBusy(true);setNotice(null);
    try{
      const response=await fetch(API_URL+'/users/me',{method:'PUT',headers:authHeaders(),body:JSON.stringify(fields)});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(payload.error||'Δεν αποθηκεύτηκαν τα στοιχεία σου.');
      setUser(payload);setFields(toFields(payload));
      setNotice({type:'success',text:'Τα στοιχεία του λογαριασμού αποθηκεύτηκαν.'});
    }catch(error){setNotice({type:'error',text:error.message||'Σφάλμα αποθήκευσης.'});}
    finally{setBusy(false);}
  };

  const togglePreference=async(type,key)=>{
    if(prefBusy)return;
    const current=type==='topic'?preferences.topics[key]:preferences[key];
    const next=!current;
    const request=type==='topic'?{topic:key,enabled:next}:{channel:key,enabled:next};
    setPrefBusy(type+key);
    setNotice(null);
    try{
      const response=await fetch(API_URL+'/users/me/notification-preferences',{
        method:'PATCH',headers:authHeaders(),body:JSON.stringify(request)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Η αλλαγή δεν αποθηκεύτηκε.');
      setPreferences(data.preferences);
      setNotice({type:'success',text:'Η προτίμηση αποθηκεύτηκε.'});
    }catch(error){setNotice({type:'error',text:error.message||'Σφάλμα αποθήκευσης.'});}
    finally{setPrefBusy('');}
  };

  const saveNewsCategories=async categories=>{
    if(prefBusy)return;
    setPrefBusy('newsCategories');setNotice(null);
    try{
      const response=await fetch(API_URL+'/users/me/notification-preferences',{
        method:'PATCH',headers:authHeaders(),body:JSON.stringify({newsCategories:categories})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Δεν αποθηκεύτηκαν οι κατηγορίες ειδήσεων.');
      setPreferences(data.preferences);
      setNotice({type:'success',text:'Οι κατηγορίες ειδήσεων ενημερώθηκαν.'});
    }catch(error){setNotice({type:'error',text:error.message||'Σφάλμα αποθήκευσης.'});}
    finally{setPrefBusy('');}
  };

  const registerDevice=async()=>{
    if(deviceBusy||!pushAvailable)return;
    setDeviceBusy(true);setNotice(null);
    try{
      if(!pushSupported)throw Error('Ο browser δεν υποστηρίζει push ειδοποιήσεις σε αυτή τη συσκευή.');
      if(Notification.permission==='denied')throw Error('Οι ειδοποιήσεις είναι αποκλεισμένες στις ρυθμίσεις του browser.');
      const permission=await Notification.requestPermission();
      setPushPermission(permission);
      if(permission!=='granted')throw Error('Δεν δόθηκε άδεια για ειδοποιήσεις.');
      const registration=await navigator.serviceWorker.register('/sw.js');
      let subscription=await registration.pushManager.getSubscription();
      if(!subscription){
        const vapid=await fetch(API_URL+'/notifications/vapidPublicKey');
        if(!vapid.ok)throw Error('Δεν είναι διαθέσιμο το κλειδί push.');
        const key=(await vapid.text()).trim();
        if(!key)throw Error('Η υπηρεσία push δεν έχει ρυθμιστεί.');
        const base64=(key+'='.repeat((4-key.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');
        const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
        subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
      }
      const response=await fetch(API_URL+'/notifications/my-device',{
        method:'PUT',headers:authHeaders(),body:JSON.stringify({subscription:subscription.toJSON()})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Η εγγραφή της συσκευής απέτυχε.');
      setDeviceRegistered(true);setNotice({type:'success',text:'Η συσκευή συνδέθηκε επιτυχώς με τις ειδοποιήσεις.'});
    }catch(error){setNotice({type:'error',text:error.message||'Αποτυχία ενεργοποίησης push.'});}
    finally{setDeviceBusy(false);}
  };

  const removeDevice=async()=>{
    if(deviceBusy)return;
    setDeviceBusy(true);setNotice(null);
    try{
      const registration=await navigator.serviceWorker.getRegistration();
      const subscription=await registration?.pushManager?.getSubscription();
      if(subscription){
        const response=await fetch(API_URL+'/notifications/my-device',{
          method:'DELETE',headers:authHeaders(),body:JSON.stringify({endpoint:subscription.endpoint})
        });
        if(!response.ok)throw Error('Δεν αποσυνδέθηκε η συσκευή.');
        await subscription.unsubscribe();
      }
      setDeviceRegistered(false);
      setNotice({type:'success',text:'Οι push ειδοποιήσεις απενεργοποιήθηκαν σε αυτή τη συσκευή.'});
    }catch(error){setNotice({type:'error',text:error.message||'Δεν ολοκληρώθηκε η αποσύνδεση.'});}
    finally{setDeviceBusy(false);}
  };

  const cancelSubscription=async sub=>{
    if(!sub?.stripeSubscriptionId||cancelId)return;
    if(!window.confirm('Να σταματήσει η αυτόματη ανανέωση; Τα προνόμια παραμένουν έως τη λήξη της περιόδου.'))return;
    setCancelId(sub.stripeSubscriptionId);setNotice(null);
    try{
      const response=await fetch(API_URL+'/payments/cancel-subscription',{
        method:'POST',headers:authHeaders(),body:JSON.stringify({subscriptionId:sub.stripeSubscriptionId})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Η ακύρωση δεν ολοκληρώθηκε.');
      const userResponse=await fetch(API_URL+'/auth/me',{headers:authHeaders()});
      if(!userResponse.ok)throw Error('Η αίτηση υποβλήθηκε, αλλά δεν ανανεώθηκε η εικόνα της συνδρομής.');
      setUser(await userResponse.json());
      setNotice({type:'success',text:'Η ανανέωση ακυρώθηκε. Τα προνόμια παραμένουν μέχρι τη λήξη.'});
    }catch(error){setNotice({type:'error',text:error.message||'Σφάλμα διαχείρισης συνδρομής.'});}
    finally{setCancelId('');}
  };

  const subscriptions=useMemo(()=>Array.isArray(user?.activeSubscriptions)?user.activeSubscriptions:[],[user]);
  const premium=Boolean(user?.isPremium===true ||
    subscriptions.some(sub=>sub.planId==='listener_premium' &&
      (['active','trialing'].includes(sub.status) ||
        (['canceled','cancelled'].includes(sub.status) && new Date(sub.currentPeriodEnd).getTime()>Date.now()))) ||
    (user?.stripeSubscriptionId&&user?.subscriptionStatus==='active'));
  const broadcasterPremium=Boolean(user?.broadcasterProfile?.tier==='premium');
  const tierLabel=premium?'Premium μέλος':broadcasterPremium?'Broadcaster Premium':'Free μέλος';
  const hasManualPremium=premium&&!subscriptions.some(sub=>sub.planId==='listener_premium')&&!user?.stripeSubscriptionId;
  const favoriteCount=user?.favorites?.length||0;
  const tabs=[
    {id:'details',label:'Λογαριασμός',Icon:UserRound},
    {id:'notifications',label:'Ειδοποιήσεις',Icon:BellRing},
    {id:'follows',label:'DJs & Εκπομπές',Icon:Mic2},
    {id:'inbox',label:'Inbox',Icon:Mail},
    {id:'subscription',label:'Συνδρομή',Icon:Crown}
  ];

  if(loading)return <div className="mx-auto flex min-h-[55dvh] items-center justify-center gap-3 text-zinc-400"><Loader2 className="animate-spin text-[#ccff00]"/> Φόρτωση προφίλ…</div>;
  if(!user)return <div className="ir-profile-page mx-auto w-full max-w-2xl px-4 py-20 text-center">
    <div className="ir-profile-panel p-8">
      <ShieldCheck size={30} className="mx-auto mb-4 text-[#ccff00]"/>
      <h1 className="text-xl font-black text-white">Τα στοιχεία του λογαριασμού δεν φορτώθηκαν.</h1>
      <p className="mt-3 text-sm text-zinc-400">Δεν θα εμφανιστούν άδεια προσωπικά δεδομένα ή λανθασμένο πλάνο.</p>
      <button type="button" className="ir-profile-primary mt-5" onClick={()=>window.location.reload()}>Δοκίμασε ξανά</button>
      <Link to="/login" className="mt-4 block text-xs text-[#ccff00]">Σύνδεση</Link>
    </div>
  </div>;

  return <div className="ir-profile-page mx-auto w-full max-w-[1250px] px-4 pb-44 pt-5 sm:px-6 sm:pt-7 xl:px-9">
    <div className="ir-profile-hero relative overflow-hidden rounded-[30px] p-5 sm:p-8">
      <div className="ir-profile-glow pointer-events-none absolute -right-16 -top-24 size-72 rounded-full"/>
      <div className="relative flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div className="ir-profile-avatar flex size-[68px] shrink-0 items-center justify-center rounded-[23px] text-3xl font-black text-[#121b05] sm:size-20">
            {String(user?.fname||user?.username||'i').charAt(0).toLocaleUpperCase('el-GR')}
          </div>
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.19em] text-[#ccff00]"><Sparkles size={13}/> MY iRADIOSGR</p>
            <h1 className="truncate text-2xl font-black tracking-tight text-white sm:text-4xl">
              {user?.fname ? 'Γεια σου, '+user.fname : 'Το προσωπικό σου προφίλ'}
            </h1>
            <p className="mt-1 truncate text-xs text-zinc-400 sm:text-sm">{user?.email||'Ο προσωπικός σου χώρος'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="ir-profile-pill"><Crown size={15}/>{tierLabel}</span>
          <Link to="/favorites" className="ir-profile-pill ir-profile-pill--muted"><Heart size={15}/>{favoriteCount} αγαπημένα <ChevronRight size={13}/></Link>
        </div>
      </div>
      <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <button type="button" onClick={()=>selectTab('inbox')} className="ir-profile-quick"><Bell size={17}/><span>Notification Center</span><ArrowRight size={14} className="ml-auto"/></button>
        <button type="button" onClick={()=>selectTab('subscription')} className="ir-profile-quick"><Wallet size={17}/><span>Το πλάνο μου</span><ArrowRight size={14} className="ml-auto"/></button>
        <button type="button" onClick={()=>selectTab('follows')} className="ir-profile-quick col-span-2 sm:col-span-1">
          <Mic2 size={17}/><span>Οι παραγωγοί & εκπομπές μου</span><ArrowRight size={14} className="ml-auto"/></button>
      </div>
    </div>

    <div className="ir-profile-tabs mt-6 flex gap-1 overflow-x-auto rounded-2xl p-1.5" role="tablist" aria-label="Ενότητες προφίλ">
      {tabs.map(({id,label,Icon})=><button type="button" role="tab" key={id} aria-selected={tab===id}
        onClick={()=>{selectTab(id);setNotice(null);}}
        className={'ir-profile-tab '+(tab===id?'ir-profile-tab--active':'')}>
        <Icon size={17}/><span>{label}</span></button>)}
    </div>

    {notice&&<div role="status" aria-live="polite" className={'mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm '+(notice.type==='success'?'border-[#ccff00]/30 bg-[#ccff00]/[.08] text-[#eaffb2]':'border-rose-500/25 bg-rose-500/10 text-rose-200')}>
      {notice.type==='success'?<Check size={18} className="shrink-0"/>:<XCircle size={18} className="shrink-0"/>}{notice.text}</div>}

    {tab==='details'&&<div role="tabpanel" className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="ir-profile-panel p-5 sm:p-7">
        <SectionHeading icon={UserRound} title="Τα στοιχεία σου" description="Ο λογαριασμός σου, συγκεντρωμένος σε ένα σημείο."/>
        <form onSubmit={saveProfile}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ProfileField label="Όνομα" name="fname" value={fields.fname} required onChange={setField}/>
            <ProfileField label="Επώνυμο" name="lname" value={fields.lname} onChange={setField}/>
            <ProfileField label="Όνομα χρήστη" name="username" value={fields.username} required onChange={setField}/>
            <ProfileField label="Email" name="email" type="email" value={fields.email} required onChange={setField}/>
            <ProfileField label="Τηλέφωνο (προαιρετικό)" name="phone" type="tel" value={fields.phone} onChange={setField}/>
            <ProfileField label="Ημερομηνία γέννησης" name="birthdate" type="date" value={fields.birthdate} onChange={setField}/>
          </div>
          <div className="mt-6 flex justify-end"><button type="submit" disabled={busy} className="ir-profile-primary">
            {busy?<Loader2 size={18} className="animate-spin"/>:<Save size={18}/>} Αποθήκευση στοιχείων</button></div>
        </form>
      </section>
      <aside className="flex flex-col gap-5">
        <ProfileSecurity API_URL={API_URL} onLogout={onLogout} user={user} actionsAvailable={pushAvailable}/>
        <button type="button" onClick={onLogout} className="ir-profile-logout"><LogOut size={17}/> Αποσύνδεση</button>
      </aside>
    </div>}

    {tab==='notifications'&&<div role="tabpanel" className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(290px,.65fr)]">
      <section className="ir-profile-panel p-5 sm:p-7">
        <SectionHeading icon={BellRing} title="Τι θέλεις να μαθαίνεις;" description="Επίλεξε ξεχωριστά κάθε κατηγορία. Οι αλλαγές αποθηκεύονται αυτόματα."/>
        <div className="space-y-2">
          {TOPICS.map(({id,Icon,title,desc})=><div key={id} className="ir-profile-topic">
            <span className="ir-profile-topic-icon"><Icon size={19}/></span>
            <div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{desc}</p></div>
            <Toggle label={title} checked={preferences.topics?.[id]}
              onChange={()=>togglePreference('topic',id)} disabled={Boolean(prefBusy)}/>
          </div>)}
        </div>
        {newsCategories.length>0&&preferences.topics?.news&&<div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-white"><Newspaper size={16} className="text-[#ccff00]"/> Ποιες ειδήσεις σε ενδιαφέρουν;</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-400">Επίλεξε θεματικές για πιο σχετικές ειδοποιήσεις. Χωρίς επιλογή λαμβάνεις όλες τις κατηγορίες.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Προσωπικές κατηγορίες ειδήσεων">
            <button type="button" aria-pressed={!preferences.newsCategories?.length}
              disabled={Boolean(prefBusy)} onClick={()=>saveNewsCategories([])}
              className={'ir-profile-news-chip '+(!preferences.newsCategories?.length?'ir-profile-news-chip--active':'')}>Όλες</button>
            {newsCategories.map(category=><button type="button" key={category} disabled={Boolean(prefBusy)}
              aria-pressed={preferences.newsCategories?.includes(category)||false}
              onClick={()=>{
                const selected=preferences.newsCategories||[];
                saveNewsCategories(selected.includes(category)?selected.filter(x=>x!==category):[...selected,category]);
              }}
              className={'ir-profile-news-chip '+(preferences.newsCategories?.includes(category)?'ir-profile-news-chip--active':'')}>
              {category}</button>)}
          </div>
        </div>}
        <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-zinc-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#ccff00]"/> Οι προωθητικές ενέργειες είναι απενεργοποιημένες μέχρι να δώσεις εσύ ρητή συγκατάθεση.</p>
      </section>
      <div className="flex flex-col gap-5">
        <section className="ir-profile-panel p-5 sm:p-6">
          <SectionHeading icon={Settings2} title="Πώς θέλεις να ενημερώνεσαι;" description="Κάθε κανάλι ελέγχεται ανεξάρτητα."/>
          <div className="space-y-3">
            <div className="ir-profile-channel"><Bell size={19} className="text-[#ccff00]"/>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-white">Push στη συσκευή</strong><small className="mt-1 block text-zinc-400">Browser & ειδοποιήσεις εφαρμογής</small></span>
              <Toggle label="Push ειδοποιήσεις" checked={preferences.push} onChange={()=>togglePreference('channel','push')} disabled={Boolean(prefBusy)}/>
            </div>
            <div className="ir-profile-channel"><Mail size={19} className="text-[#ccff00]"/>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-white">Ειδοποιήσεις email</strong><small className="mt-1 block text-zinc-400">{user?.email||'Στον λογαριασμό σου'}</small></span>
              <Toggle label="Ειδοποιήσεις email" checked={preferences.email} onChange={()=>togglePreference('channel','email')} disabled={Boolean(prefBusy)}/>
            </div>
          </div>
        </section>
        <section className="ir-profile-panel p-5 sm:p-6">
          <SectionHeading icon={Bell} title="Αυτή η συσκευή" description="Οι διακόπτες δεν δίνουν αυτόματα άδεια στον browser."/>
          {!pushAvailable?<div className="ir-profile-device-note">
            <ShieldCheck size={18} className="shrink-0 text-[#ccff00]"/>
            <p>Στο staging η αποστολή push είναι απενεργοποιημένη για ασφάλεια. Οι προτιμήσεις σου αποθηκεύονται κανονικά.</p>
          </div>:deviceRegistered?<div className="space-y-3">
            <p className="flex items-center gap-2 text-xs font-bold text-[#ccff00]"><Check size={16}/> Η συσκευή είναι συνδεδεμένη.</p>
            <button type="button" onClick={removeDevice} disabled={deviceBusy} className="ir-profile-secondary w-full">
              {deviceBusy?<Loader2 size={16} className="animate-spin"/>:<XCircle size={16}/>} Αφαίρεση συσκευής
            </button>
          </div>:<div className="space-y-3">
            <p className="text-xs leading-6 text-zinc-400">{!pushSupported?'Ο browser ή η εγκατάσταση δεν υποστηρίζει push.':pushPermission==='denied'?'Ο browser έχει αποκλείσει τις ειδοποιήσεις. Ενεργοποίησέ τες στις ρυθμίσεις του.':'Πάτησε ενεργοποίηση για να δώσεις άδεια και να καταχωρήσεις αυτή τη συσκευή.'}</p>
            <button type="button" onClick={registerDevice} disabled={deviceBusy||!pushSupported||!preferences.push} className="ir-profile-primary w-full">
              {deviceBusy?<Loader2 size={17} className="animate-spin"/>:<BellRing size={17}/>} Ενεργοποίηση στη συσκευή
            </button>
          </div>}
        </section>
        <Link to="/favorites" className="ir-profile-panel flex items-center gap-3 p-5 hover:border-[#ccff00]/35"><Heart size={19} className="text-[#ccff00]"/><span className="min-w-0 flex-1 text-sm font-bold text-white">Διαχείριση αγαπημένων σταθμών</span><ArrowRight size={16} className="text-zinc-500"/></Link>
      </div>
    </div>}

    {tab==='follows'&&<div role="tabpanel" className="mt-6"><ProfileFollows API_URL={API_URL}/></div>}
    {tab==='inbox'&&<div role="tabpanel" className="mt-6"><ProfileInbox API_URL={API_URL} onUnread={setInboxUnread}/></div>}

    {tab==='subscription'&&<div role="tabpanel" className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="ir-profile-panel p-5 sm:p-7">
        <SectionHeading icon={Crown} title="Συνδρομές & προνόμια" description="Όλα τα πλάνα και η κατάσταση ανανέωσης, χωρίς κρυφές αλλαγές."/>
        <div className="ir-profile-plan-hero mb-5 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><span className="text-[10px] font-black uppercase tracking-[.15em] text-[#ccff00]">Το τωρινό σου πλάνο</span>
            <h3 className="mt-2 flex items-center gap-2 text-2xl font-black text-white"><Crown size={23} className="text-[#ccff00]"/>{premium?'iRadios Premium':'iRadios Free'}</h3>
            <p className="mt-2 text-xs text-zinc-400">{premium?'Έχεις ενεργοποιημένη premium πρόσβαση.':'Ανακάλυψε περισσότερες δυνατότητες με Premium.'}</p></div>
          {!premium&&<button type="button" onClick={()=>navigate('/premium')} className="ir-profile-primary"><Zap size={17}/> Δες το Premium</button>}
        </div>
        {hasManualPremium&&<div className="ir-profile-subscription-row mb-3"><ShieldCheck size={18} className="text-[#ccff00]"/><div className="flex-1"><p className="text-sm font-black text-white">Premium πρόσβαση</p><p className="mt-1 text-xs text-zinc-400">Παραχωρημένη πρόσβαση · χωρίς Stripe χρέωση.</p></div></div>}
        {subscriptions.length>0?<div className="space-y-3">{subscriptions.map((sub,index)=>{
          const canceled=['canceled','cancelled'].includes(sub.status);
          const active=sub.status==='active'||sub.status==='trialing';
          const subscriptionId=sub.stripeSubscriptionId;
          return <div key={subscriptionId||sub._id||index} className="ir-profile-subscription-row">
            <span className="ir-profile-section-icon"><CreditCard size={19}/></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">{PLAN_NAMES[sub.planId]||sub.planId||'Συνδρομή'}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {canceled?'Λήγει':active?'Επόμενη ανανέωση':'Κατάσταση: '+(sub.status||'άγνωστη')} · {fmtDate(sub.currentPeriodEnd)}
              </p>
              <span className={'mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold '+(canceled?'bg-amber-500/10 text-amber-300':'bg-[#ccff00]/10 text-[#ccff00]')}>
                {canceled?'Ακύρωση ανανέωσης':active?'Ενεργή':'Σε αναμονή'}</span>
            </div>
            {subscriptionId&&active&&!canceled&&pushAvailable&&<button type="button" onClick={()=>cancelSubscription(sub)}
              disabled={Boolean(cancelId)} className="ir-profile-cancel">
              {cancelId===subscriptionId?<Loader2 size={15} className="animate-spin"/>:<XCircle size={15}/>} Διακοπή ανανέωσης
            </button>}
          </div>;
        })}</div>:!premium?<p className="rounded-2xl border border-white/10 bg-white/[.025] p-5 text-xs text-zinc-400">Δεν υπάρχει ενεργή συνδρομή στον λογαριασμό σου.</p>:null}
        {!pushAvailable&&<p className="mt-4 text-xs leading-6 text-amber-200/80">Το staging δεν εκτελεί πραγματικές χρεώσεις ή αλλαγές συνδρομών. Μπορείς να ελέγξεις εδώ την εμφάνιση των στοιχείων.</p>}
      </section>
      <aside className="flex flex-col gap-5">
        <section className="ir-profile-panel p-5"><SectionHeading icon={Headphones} title="Με το iRadios Premium"/>
          <div className="space-y-3 text-xs text-zinc-300">
            <p className="flex items-center gap-2"><Check size={15} className="text-[#ccff00]"/> Ακρόαση χωρίς in-app διαφημίσεις</p>
            <p className="flex items-center gap-2"><Check size={15} className="text-[#ccff00]"/> Περισσότερος έλεγχος ήχου</p>
            <p className="flex items-center gap-2"><Check size={15} className="text-[#ccff00]"/> Premium εμπειρία σταθμών</p>
          </div>
          <Link to="/premium" className="ir-profile-link mt-5">Δες όλα τα προνόμια <ArrowRight size={15}/></Link>
        </section>
        <button type="button" onClick={()=>selectTab('details')} className="ir-profile-panel flex items-center gap-3 p-5 text-left hover:border-[#ccff00]/35"><ShieldCheck size={18} className="text-[#ccff00]"/><span className="flex-1 text-sm font-bold">Ρυθμίσεις λογαριασμού</span><ChevronRight size={16}/></button>
      </aside>
    </div>}
  </div>;
}
