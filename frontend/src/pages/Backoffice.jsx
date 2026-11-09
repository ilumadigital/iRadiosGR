import React, {useCallback,useEffect,useMemo,useState,Suspense,lazy} from 'react';
import {Link,NavLink,Routes,Route,Navigate,useLocation,useNavigate,useParams} from 'react-router-dom';
import {Helmet} from 'react-helmet-async';
import '../styles/backoffice-admin.css';
import ScheduleXmlImport from '../components/ScheduleXmlImport';
import {PrimaryCategorySelect,SecondaryCategorySelect} from '../components/StationCategorySelect';
import {isPrimaryCategory,isSecondaryCategory} from '../utils/stationCategories';
import {LOCATION_DATA,stationCityOptions,canonicalStationLocation} from '../utils/stationLocations';
import {minutes,scheduleDayBase,toCanonical,normalize,nextDay} from '../utils/schedule';
import {
  Activity,ArrowDownRight,ArrowLeft,ArrowRight,BadgeCheck,BarChart3,
  Bell,Building2,CalendarDays,Check,CheckCircle2,ChevronDown,ChevronRight,
  CircleAlert,Clock3,CloudUpload,Copy,ExternalLink,FileCheck2,
  Globe2,Headphones,Home,Image,LayoutDashboard,LogOut,Menu,Mic2,
  Music2,Plus,Radio,RefreshCw,Save,Search,Settings2,Shield,ShieldCheck,
  SlidersHorizontal,Sparkles,Trash2,Users,X
} from 'lucide-react';

const AdminDashboard=lazy(()=>import('./AdminDashboard'));
const AdminUsers=lazy(()=>import('./AdminUsers'));
const AdminAds=lazy(()=>import('./AdminAds'));
const AdminBanners=lazy(()=>import('./AdminBanners'));
const AdminHomeSlides=lazy(()=>import('./AdminHomeSlides'));
const AdminNewsFeed=lazy(()=>import('./AdminNewsFeed'));
const AdminPromotedStations=lazy(()=>import('../components/AdminPromotedStations'));
const AdminEmails=lazy(()=>import('./AdminEmails'));
const AdminPaid=lazy(()=>import('./AdminPaid'));
const AdminRadioSet=lazy(()=>import('./AdminRadioSet'));
const AdminAdControl=lazy(()=>import('./AdminAdControl'));
const Boost=lazy(()=>import('./Boost'));
const NewPush=lazy(()=>import('./NewPush'));
const DAY_NAMES=['','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'];
const EDIT_FIELDS=['name','slug','slogan','description','genre','secondaryGenre','transmissionType','frequency',
  'country','region','prefecture','city','website','email','phone','stream','metadata','facebook','instagram',
  'twitter','tiktok','explicit'];
const BLANK={name:'',slug:'',slogan:'',description:'',genre:'',secondaryGenre:'',transmissionType:'Web Radio',
  frequency:'',country:'Ελλάδα',region:'',prefecture:'',city:'',website:'',email:'',phone:'',stream:'',metadata:'',
  facebook:'',instagram:'',twitter:'',tiktok:'',explicit:false};
const panel='rounded-[26px] border border-white/[0.075] bg-[#111418] shadow-[0_22px_90px_rgba(0,0,0,0.14)]';
const inputClass='w-full rounded-xl border border-white/10 bg-[#090b0d] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-[#caff00]/70 focus:ring-2 focus:ring-[#caff00]/10';
const buttonPrimary='inline-flex items-center justify-center gap-2 rounded-xl bg-[#caff00] px-5 py-3 text-[12px] font-black uppercase tracking-[.08em] text-[#101300] shadow-[0_8px_26px_rgba(202,255,0,.18)] transition hover:bg-[#e5ff83] disabled:opacity-50';
const buttonSecondary='inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-[12px] font-bold text-zinc-200 transition hover:border-white/25 hover:bg-white/[.09]';
const roleLabels={admin:'Administrator',broadcaster:'Broadcaster',producer:'Producer'};
function suggestStationSlug(name){
  const greek={α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',
    κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',
    τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o'};
  return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[α-ω]/g,letter=>greek[letter]||'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
    .slice(0,100).replace(/-+$/g,'');
}
function shortNumber(n){return new Intl.NumberFormat('el-GR',{notation:'compact',maximumFractionDigits:1}).format(Number(n)||0);}
function Badge({children,tone='neutral'}){const tones={
  lime:'bg-[#caff00]/10 text-[#d7ff55] ring-[#caff00]/20',
  rose:'bg-rose-400/10 text-rose-300 ring-rose-400/20',
  amber:'bg-amber-400/10 text-amber-300 ring-amber-400/20',
  neutral:'bg-white/[.06] text-zinc-300 ring-white/10'
};return <span className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-extrabold tracking-wide ring-1 '+tones[tone]}>{children}</span>;}
function StationStatus({station}){
  if(station.pendingEdits&&Object.keys(station.pendingEdits).length)
    return <Badge tone="amber">Αναμονή αλλαγών</Badge>;
  return station.status==='approved'?<Badge tone="lime"><CheckCircle2 size={12}/> Ενεργός</Badge>:
    <Badge tone="amber"><Clock3 size={12}/> Προς έγκριση</Badge>;
}
function SectionTitle({eyebrow,title,description,aside}){
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
    <div className="max-w-2xl">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[.25em] text-[#caff00]">{eyebrow}</p>
      <h2 className="text-3xl font-black tracking-[-.06em] text-white md:text-4xl">{title}</h2>
      {description&&<p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>}
    </div>{aside}</div>;
}
function Field({label,help,children,wide=false}){
  return <label className={'block min-w-0 space-y-2 '+(wide?'md:col-span-2':'')}>
    <span className="block text-[11px] font-bold text-zinc-300">{label}</span>
    {children}{help&&<span className="block text-[10px] leading-4 text-zinc-500">{help}</span>}
  </label>;
}
function NavItem({to,icon:Icon,label,close,end=false}){
  return <NavLink to={to} end={end} onClick={close} className={({isActive})=>
    'flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[13px] font-bold transition '+
    (isActive?'bg-[#caff00] text-[#111400] shadow-[0_12px_30px_rgba(202,255,0,.15)]':
      'text-zinc-400 hover:bg-white/[.07] hover:text-white')
  }><Icon size={18} strokeWidth={2}/>{label}</NavLink>;
}
function Logo(){
  return <div className="flex items-center gap-2.5">
    <div className="flex size-10 items-center justify-center rounded-xl bg-[#caff00] text-[#101300] shadow-[0_0_26px_rgba(202,255,0,.18)]"><Radio size={23} strokeWidth={3}/></div>
    <div className="leading-none"><div className="text-[19px] font-black tracking-[-.07em] text-white">iRadios<span className="text-[#caff00]">GR</span></div>
      <p className="mt-1.5 text-[8px] font-black uppercase tracking-[.26em] text-zinc-500">Business Console</p></div>
  </div>;
}
async function api(url,options={}){
  const token=localStorage.getItem('iluma_token');
  if(!token)throw Object.assign(new Error('Απαιτείται σύνδεση.'),{status:401});
  const headers={Authorization:'Bearer '+token,...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers};
  const res=await fetch('/api/backoffice'+url,{...options,headers});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Object.assign(new Error(data.error||'Η ενέργεια δεν ολοκληρώθηκε.'),{status:res.status,code:data.code});
  return data;
}
function AuthGate({title,description,href='/login',label='Σύνδεση στο iRadios'}){
  return <div className="flex min-h-screen items-center justify-center bg-[#080a0b] p-6">
    <div className={panel+' w-full max-w-md p-8 text-center md:p-12'}>
      <div className="mx-auto mb-7 flex w-fit justify-center"><Logo/></div>
      <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-[#caff00]/10 text-[#caff00]"><ShieldCheck size={30}/></div>
      <h1 className="text-2xl font-black text-white">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
      <a className={buttonPrimary+' mt-7 w-full'} href={href}>{label}<ArrowRight size={16}/></a>
      <a href="/" className="mt-5 block text-xs font-bold text-zinc-500 hover:text-white">Επιστροφή στο iRadios App</a>
    </div>
  </div>;
}
function Metric({icon:Icon,label,value,caption,rose=false}){
  return <div className={panel+' relative overflow-hidden p-5 md:p-6'}>
    <div className={'absolute -right-9 -top-12 size-32 rounded-full blur-[55px] '+(rose?'bg-[#ff4d9b]/10':'bg-[#caff00]/10')}/>
    <div className="relative flex items-start justify-between"><span className="text-[11px] font-bold text-zinc-400">{label}</span>
      <div className={'flex size-9 items-center justify-center rounded-xl '+(rose?'bg-[#ff4d9b]/10 text-[#ff80b6]':'bg-[#caff00]/10 text-[#caff00]')}><Icon size={18}/></div>
    </div><p className="relative mt-5 text-4xl font-black tracking-[-.07em] text-white">{value}</p>
    <p className="relative mt-2 text-[11px] text-zinc-500">{caption}</p>
  </div>;
}
function DeleteStationDialog({station,onClose,onDeleted,notify}){
  const [typedName,setTypedName]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{setTypedName('');setBusy(false);},[station?._id]);
  useEffect(()=>{
    if(!station)return;
    const onKeyDown=event=>{if(event.key==='Escape'&&!busy)onClose();};
    document.addEventListener('keydown',onKeyDown);
    return ()=>document.removeEventListener('keydown',onKeyDown);
  },[station,busy,onClose]);
  if(!station)return null;
  const submit=async event=>{
    event.preventDefault();
    if(typedName!==station.name||busy)return;
    setBusy(true);
    try{
      const result=await api('/stations/'+station._id,{
        method:'DELETE',body:JSON.stringify({confirmationName:typedName})
      });
      onClose();
      try{await onDeleted(station);}catch(error){notify('Ο σταθμός διαγράφηκε, αλλά απέτυχε η ανανέωση: '+error.message,'error');return;}
      notify(result.message||'Ο σταθμός διαγράφηκε.');
    }catch(error){notify(error.message,'error');}
    finally{setBusy(false);}
  };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl">
    <div role="dialog" aria-modal="true" aria-labelledby="delete-station-title"
      aria-describedby="delete-station-description"
      className="w-full max-w-lg rounded-[28px] border border-rose-400/20 bg-[#171b1e]/95 p-6 shadow-[0_32px_90px_rgba(0,0,0,.65)] md:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300">
            <Trash2 size={23}/></div>
          <div><p className="text-[10px] font-black uppercase tracking-widest text-rose-300">Admin / Danger zone</p>
            <h2 id="delete-station-title" className="mt-1 text-xl font-black text-white">Οριστική διαγραφή σταθμού</h2></div>
        </div>
        <button type="button" disabled={busy} onClick={onClose}
          aria-label="Κλείσιμο" className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:text-white"><X size={18}/></button>
      </div>
      <p id="delete-station-description" className="text-sm leading-6 text-zinc-300">
        Ο σταθμός θα αφαιρεθεί από το δίκτυο iRadiosGR. Η ενέργεια δεν αναιρείται αυτόματα.
        Τα αρχεία media και τα ιστορικά στοιχεία δεν διαγράφονται αυτόματα για λόγους ασφάλειας.
      </p>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
        <p className="break-words text-base font-black text-white">{station.name}</p>
        <p className="mt-2 break-all text-[11px] text-zinc-400">/station/{station.slug||station._id}</p>
        <p className="mt-1 break-all text-[10px] text-zinc-600">ID: {station._id}</p>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <Field label="Πληκτρολόγησε ακριβώς το όνομα του σταθμού για επιβεβαίωση">
          <input autoFocus className={inputClass+' border-rose-500/20 focus:border-rose-400'}
            autoComplete="off" value={typedName} onChange={e=>setTypedName(e.target.value)}
            placeholder={station.name} aria-label="Επιβεβαίωση ονόματος σταθμού"/>
        </Field>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" disabled={busy} onClick={onClose} className={buttonSecondary}>Ακύρωση</button>
          <button type="submit" disabled={busy||typedName!==station.name}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/35 bg-rose-500 px-5 py-3 text-xs font-black text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40">
            {busy?<RefreshCw size={16} className="animate-spin"/>:<Trash2 size={16}/>} Οριστική διαγραφή
          </button>
        </div>
      </form>
    </div>
  </div>;
}
function StationCard({station,role,onDelete}){
  const to=role==='producer'?'/backoffice/schedules?station='+encodeURIComponent(station._id):'/backoffice/stations/'+station._id+'/edit';
  return <div className={panel+' group flex flex-col gap-4 p-4 transition hover:border-[#caff00]/30 md:flex-row md:items-center md:p-5'}>
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-[#070808]">
      {station.logo?<img src={station.logo} alt="" className="h-full w-full object-contain p-2" loading="lazy"/>:
        <div className="flex size-full items-center justify-center text-[#caff00]"><Radio size={32}/></div>}
    </div>
    <div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2">
      <h3 className="truncate text-lg font-black tracking-tight text-white">{station.name}</h3><StationStatus station={station}/></div>
      <p className="text-xs text-zinc-500">{station.genre||'Χωρίς κατηγορία'} · {station.city||station.region||'Online radio'}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-zinc-400">
        <span className="flex items-center gap-1"><Headphones size={13}/> {shortNumber(station.plays)} ακροάσεις</span>
        <span className="flex items-center gap-1"><Globe2 size={13}/> {station.transmissionType||'Web Radio'}</span>
      </div></div>
    <div className="flex shrink-0 flex-wrap gap-2">
      <Link to={to} className={buttonSecondary}>
        {role==='producer'?'Πρόγραμμα':'Επεξεργασία'}<ArrowRight size={15}/></Link>
      {role==='admin'&&station.status==='approved'&&
        <Link to={'/backoffice/admin/promoted?station='+encodeURIComponent(station._id)}
          className={buttonSecondary} title={'Προώθηση '+station.name}>
          <Sparkles size={15} className="text-[#caff00]"/> Promoted
        </Link>}
      {role==='admin'&&onDelete&&<button type="button" onClick={()=>onDelete(station)}
        className={buttonSecondary+' !border-rose-500/20 !text-rose-300 hover:!bg-rose-500/10'}
        aria-label={'Διαγραφή σταθμού '+station.name} title="Διαγραφή σταθμού">
        <Trash2 size={16}/></button>}
      {role!=='producer'&&<Link to={'/backoffice/schedules?station='+encodeURIComponent(station._id)} className={buttonSecondary}
        aria-label={'Πρόγραμμα '+station.name} title="Πρόγραμμα σταθμού">
        <CalendarDays size={16}/></Link>}
      <a href={'/station/'+(station.slug||station._id)} target="_blank"
        rel="noopener noreferrer" className={buttonSecondary}
        aria-label={'Δημόσια σελίδα '+station.name} title="Δημόσια σελίδα">
        <ExternalLink size={16}/></a>
    </div>
  </div>;
}
function Dashboard({data}){
  const {user,counts,stations=[]}=data;
  const admin=user.role==='admin',producer=user.role==='producer';
  const primaryStation=stations.find(s=>s.status==='approved')||stations[0];
  const popular=[...stations].sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,4);
  const pending=(Number(counts.pendingApproval)||0)+(Number(counts.pendingEdits)||0);
  const today=new Date(),day=today.getDay()||7;
  const currentTime=String(today.getHours()).padStart(2,'0')+':'+String(today.getMinutes()).padStart(2,'0');
  const nextShows=stations.flatMap(station=>toCanonical(station.schedule||[],
    scheduleDayBase(station.schedule,station.scheduleDayBase))
    .filter(show=>Number(show.day)===day&&minutes(show.endTime,true)>minutes(currentTime))
    .map(show=>({...show,stationName:station.name,stationId:station._id})))
    .sort((a,b)=>a.startTime.localeCompare(b.startTime)).slice(0,3);
  const cards=[
    ...(primaryStation&&!producer?[{to:'/backoffice/stations/'+primaryStation._id+'/edit',
      icon:Settings2,name:'Ενημέρωση σταθμού',desc:'Όνομα, στοιχεία, λογότυπο και stream.',
      label:primaryStation.name}]:[]),
    {to:'/backoffice/schedules',icon:CalendarDays,name:'Πρόγραμμα εκπομπών',
      desc:'Οργάνωσε εύκολα την εβδομάδα ανά ημέρα.',label:nextShows.length?nextShows.length+' σήμερα':'Εβδομάδα'},
    ...(user.role==='broadcaster'?[{to:'/backoffice/team',icon:Users,name:'Παραγωγοί & ομάδα',
      desc:'Πρόσθεσε παραγωγούς και ανάθεσε σταθμούς.',label:'Συνεργάτες'}]:[]),
    ...(admin?[{to:'/backoffice/review',icon:FileCheck2,name:'Εγκρίσεις',
      desc:'Δες συγκεντρωμένα τα αιτήματα.',label:pending+' σε αναμονή'},
      {to:'/backoffice/admin',icon:SlidersHorizontal,name:'Κέντρο διαχείρισης',
      desc:'Όλα τα εργαλεία Admin σε ένα σημείο.',label:'11 εργαλεία'}]:[]),
    {to:'/backoffice/stations',icon:Radio,name:admin?'Σταθμοί δικτύου':'Οι σταθμοί μου',
      desc:'Εντόπισε και διαχειρίσου τους σταθμούς.',label:stations.length+' σταθμοί'},
    ...(!producer?[{to:'/backoffice/stations/new',icon:Plus,name:'Προσθήκη σταθμού',
      desc:'Συμπλήρωσε μόνο τα βασικά για να ξεκινήσεις.',label:'Νέα καταχώρηση'}]:[]),
    ...(!admin?[{to:'/backoffice/insights',icon:BarChart3,name:'Στατιστικά σταθμών',
      desc:'Δες καταγεγραμμένες ακροάσεις ανά σταθμό.',label:'Insights'}]:[])
  ];
  return <div className="space-y-8">
    <div className="relative overflow-hidden rounded-[28px] border border-[#caff00]/15 bg-[#11181a] p-7 md:p-10">
      <div className="absolute -right-20 -top-28 size-80 rounded-full bg-[#caff00]/[.11] blur-[90px]"/>
      <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <Badge tone="lime"><Sparkles size={12}/> iRadios Business Console</Badge>
          <h1 className="mt-4 text-3xl font-black tracking-[-.05em] text-white md:text-5xl">
            {admin?'Το δίκτυο με μια ματιά.':producer?'Το πρόγραμμά σου, απλά.':
              'Καλώς ήρθες στο στούντιό σου.'}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300">
            {admin?'Αιτήματα, σταθμοί, χρήστες και εργαλεία οργανωμένα σε ένα μέρος.':
              producer?'Βρες τις εκπομπές σου και οργάνωσε τις ώρες του σταθμού χωρίς περιττά βήματα.':
              'Διαχειρίσου τους σταθμούς, το εβδομαδιαίο πρόγραμμα και τους συνεργάτες σου από ένα σημείο.'}
          </p>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <Link to="/backoffice/schedules" className={buttonPrimary}><CalendarDays size={16}/> Επεξεργασία προγράμματος</Link>
          {admin?<Link to="/backoffice/review" className={buttonSecondary}><FileCheck2 size={16}/> Εγκρίσεις</Link>:
            !producer&&<Link to="/backoffice/stations/new" className={buttonSecondary}><Plus size={16}/> Νέος σταθμός</Link>}
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric icon={Radio} label="Σταθμοί" value={shortNumber(counts.total)} caption="Στο επίπεδο πρόσβασής σου"/>
      <Metric icon={BadgeCheck} label="Εγκεκριμένοι" value={shortNumber(counts.approved)} caption="Ενεργοί στο δίκτυο"/>
      <Metric icon={Clock3} label="Εκκρεμότητες" value={shortNumber(pending)}
        caption={admin?'Νέες καταχωρήσεις & αλλαγές':'Αναμονή έγκρισης'} rose/>
      <Metric icon={admin?Users:Headphones} label={admin?'Χρήστες':'Ακροάσεις'}
        value={shortNumber(admin?counts.users:stations.reduce((n,s)=>n+(Number(s.plays)||0),0))}
        caption={admin?'Λογαριασμοί δικτύου':'Καταγεγραμμένα plays, όχι live ακροατές'}/>
    </div>
    <section>
      <SectionTitle eyebrow="Quick actions" title="Τι θέλεις να κάνεις;"
        description="Άμεση πρόσβαση στις πιο συχνές εργασίες σου, χωρίς να ψάχνεις σε μενού."/>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(card=><Link key={card.to} to={card.to}
          className={panel+' group flex min-h-44 flex-col justify-between p-5 transition hover:border-[#caff00]/35 hover:bg-[#17201b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#caff00]'}>
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-[#caff00]/10 bg-[#caff00]/[.08] text-[#caff00]">
              <card.icon size={21}/></span>
            <ArrowRight size={17} className="text-zinc-600 transition group-hover:translate-x-1 group-hover:text-[#caff00]"/>
          </div>
          <div><h3 className="mt-4 text-base font-black text-white">{card.name}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{card.desc}</p>
            <span className="mt-3 inline-block text-[10px] font-black text-[#caff00]">{card.label}</span>
          </div>
        </Link>)}
      </div>
    </section>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section><SectionTitle eyebrow="Οι σταθμοί" title={admin?'Κορυφαίοι σταθμοί':'Οι σταθμοί σου'}
        aside={<Link to="/backoffice/stations" className={buttonSecondary}>Όλοι οι σταθμοί <ArrowRight size={14}/></Link>}/>
        {popular.length?<div className="space-y-3">{popular.map(s=>
          <StationCard key={s._id} station={s} role={user.role}/>)}</div>:
          <div className={panel+' p-8 text-center text-sm text-zinc-400'}>
            Δεν υπάρχουν ακόμη σταθμοί στον λογαριασμό.
            {!producer&&<div className="mt-4"><Link className={buttonSecondary}
              to="/backoffice/stations/new"><Plus size={14}/> Προσθήκη πρώτου σταθμού</Link></div>}
          </div>}
      </section>
      <section className={panel+' p-5 md:p-6'}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-[#caff00]">Σήμερα</p>
            <h3 className="mt-2 text-lg font-black text-white">Επόμενες εκπομπές</h3></div>
          <CalendarDays size={22} className="text-[#caff00]"/>
        </div>
        {nextShows.length?nextShows.map((show,index)=><div key={show.stationId+'-'+index}
          className="border-t border-white/10 py-4 first:border-t-0">
          <p className="text-xs font-black text-[#caff00]">{show.startTime} – {show.endTime==='24:00'?'00:00':show.endTime}</p>
          <p className="mt-1 text-sm font-bold text-white">{show.title}</p>
          <p className="mt-1 text-[11px] text-zinc-500">{show.stationName}{show.host?' · '+show.host:''}</p>
        </div>):<p className="py-5 text-xs leading-6 text-zinc-400">
          Δεν υπάρχουν άλλες προγραμματισμένες εκπομπές για σήμερα.</p>}
        <Link className={buttonSecondary+' mt-3 w-full'} to="/backoffice/schedules">
          <CalendarDays size={15}/> Άνοιγμα προγράμματος</Link>
      </section>
    </div>
  </div>;
}
function Stations({data,requestDelete}){
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('all');
  const filtered=useMemo(()=>data.stations.filter(s=>{
    const value=(s.name+' '+s.genre+' '+s.city+' '+s.region).toLocaleLowerCase('el');
    return value.includes(search.toLocaleLowerCase('el'))&&(status==='all'||s.status===status||
      status==='pendingEdits'&&Boolean(s.pendingEdits&&Object.keys(s.pendingEdits).length));
  }),[data,search,status]);
  return <div>
    <SectionTitle eyebrow="Station directory" title={data.user.role==='admin'?'Όλο το δίκτυο.':'Οι σταθμοί μου.'}
      description="Βρες κάθε σταθμό, επεξεργάσου τις πληροφορίες του και παρακολούθησε την έγκριση."
      aside={data.user.role!=='producer'&&<div className="flex flex-wrap gap-2">
        {data.user.role==='admin'&&<Link to="/backoffice/admin/promoted" className={buttonSecondary}>
          <Sparkles size={17} className="text-[#caff00]"/> Διαχείριση Promoted
        </Link>}
        <Link to="/backoffice/stations/new" className={buttonPrimary}><Plus size={17}/> Νέος σταθμός</Link>
      </div>}/>
    <div className={panel+' mb-5 flex flex-wrap gap-3 p-4'}>
      <div className="relative min-w-[200px] flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/>
        <input className={inputClass+' pl-11'} placeholder="Αναζήτηση σταθμού ή κατηγορίας…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <select className={inputClass+' max-w-52'} value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="all">Όλες οι καταστάσεις</option><option value="approved">Ενεργοί</option>
        <option value="pending">Προς έγκριση</option><option value="pendingEdits">Αλλαγές σε αναμονή</option>
      </select>
    </div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs font-semibold text-zinc-400">{filtered.length} από {data.stations.length} σταθμούς</p>
      {(search||status!=='all')&&<button type="button" className="text-xs font-bold text-[#caff00] hover:underline"
        onClick={()=>{setSearch('');setStatus('all');}}>Καθαρισμός φίλτρων</button>}
    </div>
    <div className="space-y-3">{filtered.length?filtered.map(s=><StationCard key={s._id} station={s} role={data.user.role} onDelete={requestDelete}/>):
      <div className={panel+' p-12 text-center text-zinc-500'}>Δεν βρέθηκαν σταθμοί με αυτά τα κριτήρια.</div>}</div>
  </div>;
}
function StationEditor({data,reload,notify,requestDelete}){
  const {id}=useParams(),navigate=useNavigate();
  const isNew=id===undefined;
  const listedStation=data.stations.find(s=>String(s._id)===String(id));
  const [remoteStation,setRemoteStation]=useState(null);
  const [stationLookup,setStationLookup]=useState(false);
  const station=listedStation||(String(remoteStation?._id)===String(id)?remoteStation:null);
  const isAdmin=data.user.role==='admin';
  const [form,setForm]=useState(BLANK),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(''),[dirty,setDirty]=useState(false);
  const [slugTouched,setSlugTouched]=useState(false);
  useEffect(()=>{
    if(isNew||listedStation)return;
    let active=true;
    setStationLookup(true);
    api('/stations/'+id).then(result=>{if(active)setRemoteStation(result.station);})
      .catch(error=>{if(active)notify(error.message,'error');})
      .finally(()=>{if(active)setStationLookup(false);});
    return ()=>{active=false;};
  },[id,isNew,listedStation?._id,notify]);
  useEffect(()=>{
    const origin=isNew?BLANK:canonicalStationLocation({...BLANK,...station,...(station?.pendingEdits||{})});
    setForm(Object.fromEntries(EDIT_FIELDS.map(k=>[k,origin[k]??BLANK[k]])));
    setSlugTouched(false);
    setDirty(false);
  },[id,isNew,station?._id]); // Refresh by changing station id. Explicit reset after save.
  const update=(field,value)=>{
    setForm(prev=>{
      const next={...prev,[field]:value};
      if(field==='name'&&isNew&&!slugTouched)next.slug=suggestStationSlug(value);
      if(field==='country'){next.region='';next.prefecture='';next.city='';}
      if(field==='region'){next.prefecture='';next.city='';}
      if(field==='prefecture')next.city='';
      return next;
    });
    if(field==='slug')setSlugTouched(true);
    setDirty(true);
  };
  async function save(e){
    e.preventDefault();
    if(!isPrimaryCategory(form.genre)||!isSecondaryCategory(form.secondaryGenre)){
      notify('Επίλεξε μία βασική και μία δευτερεύουσα κατηγορία.','error');return;
    }
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug||'')){
      notify('Το slug πρέπει να περιέχει πεζά λατινικά γράμματα, αριθμούς και παύλες.','error');return;
    }
    if(!LOCATION_DATA[form.country]?.[form.region]?.[form.prefecture] ||
      !stationCityOptions(form.country,form.region,form.prefecture).includes(form.city)){
      notify('Επίλεξε έγκυρη χώρα, περιφέρεια, νομό και πόλη.','error');return;
    }
    setBusy(true);
    try{
      const payload=isNew?Object.fromEntries(['name','slug','slogan','description','genre','secondaryGenre','stream',
        'transmissionType','country','region','prefecture','city'].map(k=>[k,form[k]])):
        Object.fromEntries(Object.entries(form).filter(([key])=>key!=='slug'||form.slug!==station.slug));
      const result=await api(isNew?'/stations':'/stations/'+station._id,
        {method:isNew?'POST':'PATCH',body:JSON.stringify(payload)});
      notify(result.message||'Αποθηκεύτηκε.');setDirty(false);await reload();
      if(result.station)setRemoteStation(result.station);
      if(isNew)navigate('/backoffice/stations/'+result.station._id+'/edit');
    }catch(error){notify(error.message,'error');}finally{setBusy(false);}
  }
  async function upload(kind,file){
    if(!file||!station)return;
    setUploading(kind);
    try{
      const fd=new FormData();fd.append('image',file);
      const result=await api('/stations/'+station._id+'/media/'+kind,{method:'POST',body:fd});
      notify(result.message);await reload();
      if(result.station)setRemoteStation(result.station);
    }catch(error){notify(error.message,'error');}finally{setUploading('');}
  }
  if(data.user.role==='producer')return <Navigate to="/backoffice/schedules" replace/>;
  if(!isNew&&!station&&stationLookup)return <div className={panel+' p-10 text-center text-sm text-zinc-400'}><RefreshCw size={20} className="mx-auto mb-3 animate-spin text-[#caff00]"/>Φόρτωση στοιχείων σταθμού…</div>;
  if(!isNew&&!station)return <AuthGate title="Ο σταθμός δεν βρέθηκε" description="Δεν έχεις δικαίωμα πρόσβασης σε αυτόν τον σταθμό." href="/backoffice/stations" label="Πίσω στους σταθμούς"/>;
  const actionTitle=isNew?'Νέος σταθμός':'Επεξεργασία σταθμού';
  return <div>
    <div className="mb-6"><Link to="/backoffice/stations" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white"><ArrowLeft size={15}/> Όλοι οι σταθμοί</Link></div>
    <SectionTitle eyebrow={isAdmin?'iRadios Network / Admin':'iRadios Broadcasters'}
      title={actionTitle} description={isAdmin?'Οι αλλαγές σου δημοσιεύονται αμέσως.':
        'Οι αλλαγές προφίλ υποβάλλονται για έγκριση από την ομάδα iRadios.'}
      aside={!isNew&&<div className="flex flex-wrap items-center gap-2">
        {isAdmin&&station.status==='approved'&&<Link
          to={'/backoffice/admin/promoted?station='+encodeURIComponent(station._id)}
          className={buttonSecondary}>
          <Sparkles size={16} className="text-[#caff00]"/> Promoted Station
        </Link>}
        <StationStatus station={station}/>
        {isAdmin&&<button type="button" onClick={()=>requestDelete(station)}
          className={buttonSecondary+' !border-rose-500/20 !text-rose-300 hover:!bg-rose-500/10'}>
          <Trash2 size={16}/> Διαγραφή σταθμού</button>}
      </div>}/>
    {!isNew&&station.pendingEdits&&Object.keys(station.pendingEdits).length>0&&
      <div className="mb-6 flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[.07] p-4 text-[12px] text-amber-200">
        <Clock3 size={18} className="shrink-0"/> Υπάρχουν προτεινόμενες αλλαγές σε αναμονή. Η φόρμα εμφανίζει τις πιο πρόσφατες υποβληθείσες τιμές.</div>}
    <form onSubmit={save} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <section className={panel+' p-5 md:p-7'}>
          <div className="mb-7 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#caff00]/10 text-[#caff00]"><Radio size={20}/></div>
            <div><h3 className="text-lg font-black text-white">Ταυτότητα σταθμού</h3><p className="text-xs text-zinc-500">Πληροφορίες καταλόγου και δημόσιου προφίλ</p></div></div>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Όνομα σταθμού *"><input required maxLength={100} className={inputClass} value={form.name} onChange={e=>update('name',e.target.value)}/></Field>
            <Field label="Slug / Δημόσιο URL *" help="Μοναδικό όνομα διεύθυνσης, π.χ. venus-fm-105-1. Μόνο a-z, 0-9 και παύλες.">
              <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#090b0d] focus-within:border-[#caff00]/70 sm:flex-row sm:items-center">
                <span className="shrink-0 px-3 pt-3 text-[11px] font-semibold text-zinc-500 sm:py-3 sm:pr-0">/station/</span>
                <input required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" spellCheck={false}
                  autoComplete="off" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none"
                  placeholder="venus-fm-105-1" value={form.slug||''}
                  onChange={e=>update('slug',e.target.value.toLowerCase().replace(/\s+/g,'-'))}/>
              </div>
            </Field>
            <Field label="Βασική κατηγορία *"><PrimaryCategorySelect className={inputClass} value={form.genre} onChange={value=>update('genre',value)}/></Field>
            <Field label="Δευτερεύουσα κατηγορία *" help="Εξειδικευμένο ύφος για SEO / GEO. Δεν εμφανίζεται στο βασικό μενού."><SecondaryCategorySelect className={inputClass} value={form.secondaryGenre} onChange={value=>update('secondaryGenre',value)}/></Field>
            <Field label="Slogan" wide><input maxLength={240} className={inputClass} placeholder="Η μουσική σου, ο κόσμος σου." value={form.slogan} onChange={e=>update('slogan',e.target.value)}/></Field>
            <Field label="Περιγραφή" wide><textarea rows={4} maxLength={4000} className={inputClass+' resize-y'} value={form.description} onChange={e=>update('description',e.target.value)}/></Field>
            <Field label="Τύπος μετάδοσης"><select className={inputClass} value={form.transmissionType} onChange={e=>update('transmissionType',e.target.value)}>
              <option>Web Radio</option><option>Επίγειο</option><option>DAB</option></select></Field>
            <Field label="Συχνότητα (αν υπάρχει)"><input className={inputClass} maxLength={30} placeholder="π.χ. 96.3" value={form.frequency} onChange={e=>update('frequency',e.target.value)}/></Field>
            <Field label="Χώρα *"><select required className={inputClass} value={form.country} onChange={e=>update('country',e.target.value)}>
              {Object.keys(LOCATION_DATA).map(country=><option key={country} value={country}>{country}</option>)}
            </select></Field>
            <Field label="Περιφέρεια *"><select required className={inputClass} value={form.region}
              onChange={e=>update('region',e.target.value)} disabled={!form.country}>
              <option value="">Επιλογή περιφέρειας</option>
              {Object.keys(LOCATION_DATA[form.country]||{}).map(region=><option key={region} value={region}>{region}</option>)}
            </select></Field>
            <Field label="Νομός / Επαρχία *"><select required className={inputClass} value={form.prefecture}
              onChange={e=>update('prefecture',e.target.value)} disabled={!form.region}>
              <option value="">Επιλογή νομού</option>
              {Object.keys(LOCATION_DATA[form.country]?.[form.region]||{}).map(prefecture=>
                <option key={prefecture} value={prefecture}>{prefecture}</option>)}
            </select></Field>
            <Field label="Πόλη *" help="Επίλεξε μία από τις διαθέσιμες πόλεις του νομού.">
              <select required className={inputClass} value={form.city} onChange={e=>update('city',e.target.value)}
                disabled={!form.prefecture}>
                <option value="">Επιλογή πόλης</option>
                {stationCityOptions(form.country,form.region,form.prefecture).map(city=>
                  <option key={city} value={city}>{city}</option>)}
              </select>
            </Field>
            {!isNew&&<Field label="Σήμανση περιεχομένου" wide><span className="flex items-center gap-3 text-sm text-zinc-300"><input type="checkbox" className="size-4 accent-[#caff00]" checked={Boolean(form.explicit)} onChange={e=>update('explicit',e.target.checked)}/> Ο σταθμός μεταδίδει explicit περιεχόμενο</span></Field>}
          </div>
        </section>
        <section className={panel+' p-5 md:p-7'}>
          <div className="mb-6 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#caff00]/10 text-[#caff00]"><Radio size={19}/></div>
            <div><h3 className="text-lg font-black text-white">Ήχος & Streaming</h3><p className="text-xs text-zinc-500">Stream και προαιρετικό metadata URL</p></div></div>
          <div className="grid gap-5">
            <Field label="Stream URL *" help="Επιτρέπονται δημόσιες διευθύνσεις HTTP/HTTPS."><input required className={inputClass} type="url" maxLength={1200} placeholder="https://radio.example/live" value={form.stream} onChange={e=>update('stream',e.target.value)}/></Field>
            {!isNew&&<Field label="Metadata URL (προαιρετικό)"><input className={inputClass} type="url" maxLength={1200} placeholder="https://..." value={form.metadata} onChange={e=>update('metadata',e.target.value)}/></Field>}
          </div>
        </section>
        {!isNew&&<details className={panel+' p-5 md:p-7'}>
          <summary className="mb-5 flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#caff00]/10 text-[#caff00]"><Globe2 size={19}/></div>
              <div><h3 className="text-lg font-black text-white">Επικοινωνία & Social</h3>
                <p className="text-xs text-zinc-500">Προαιρετικά στοιχεία — πάτησε για επεξεργασία.</p></div>
            </div><ChevronDown size={20} className="shrink-0 text-[#caff00]"/>
          </summary>
          <div className="grid gap-5 md:grid-cols-2">
            {[
              ['website','Website URL'],['email','Δημόσιο email'],['phone','Τηλέφωνο'],
              ['facebook','Facebook URL'],['instagram','Instagram URL'],
              ['twitter','X / Twitter URL'],['tiktok','TikTok URL']
            ].map(([key,label])=><Field key={key} label={label}>
              <input className={inputClass} type={key==='email'?'email':'text'} maxLength={key==='email'?254:450}
                value={form[key]} onChange={e=>update(key,e.target.value)}/></Field>)}
          </div>
        </details>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#151819] p-4">
          <div className="text-[11px] text-zinc-400">{dirty?'Υπάρχουν αλλαγές που δεν αποθηκεύτηκαν.':
            isNew?'Ο νέος σταθμός θα δημιουργηθεί ως εκκρεμής.':'Τα στοιχεία είναι έτοιμα.'}</div>
          <button disabled={busy} type="submit" className={buttonPrimary}>
            {busy?<RefreshCw size={16} className="animate-spin"/>:<Save size={16}/>}
            {isNew?'Δημιουργία σταθμού':isAdmin?'Αποθήκευση':'Αποστολή για έγκριση'}</button>
        </div>
      </div>
      <aside className="space-y-5 xl:sticky xl:top-7">
        <div className={panel+' overflow-hidden p-5'}>
          <p className="mb-4 text-[10px] font-black uppercase tracking-[.2em] text-zinc-500">Live preview</p>
          <div className="rounded-2xl border border-white/10 bg-[#07090b] p-5 text-center">
            <div className="mx-auto flex size-28 items-center justify-center overflow-hidden rounded-2xl bg-[#121519]">
              {station?.pendingEdits?.logo||station?.logo?<img src={station.pendingEdits?.logo||station.logo} className="size-full object-contain p-3" alt="Logo"/>:<Radio size={46} className="text-[#caff00]"/>}</div>
            <h3 className="mt-4 truncate text-xl font-black text-white">{form.name||'Ο σταθμός σου'}</h3>
            <p className="mt-2 text-xs text-zinc-400">{form.genre||'Βασική κατηγορία'}{form.secondaryGenre?` · ${form.secondaryGenre}`:''}</p>
            <p className="mt-3 text-xs text-[#caff00]">{form.slogan||'iRadiosGR'}</p>
          </div>
          {!isNew&&<div className="mt-4 flex flex-wrap gap-2">
            <a className={buttonSecondary+' flex-1'} href={'/station/'+(station.slug||station._id)} target="_blank" rel="noopener noreferrer">Προβολή <ExternalLink size={13}/></a>
            <button type="button" className={buttonSecondary+' flex-1'} onClick={async()=>{
              try{await navigator.clipboard.writeText(window.location.origin+'/station/'+(station.slug||station._id));notify('Το link αντιγράφηκε.');}
              catch{notify('Δεν ήταν δυνατή η αντιγραφή.','error');}}}>Copy link <Copy size={13}/></button>
          </div>}
        </div>
        {!isNew&&<div className={panel+' p-5'}>
          <h3 className="font-black text-white">Visual Identity</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">Branding που ξεχωρίζει σε κάθε οθόνη.</p>
          {['logo','cover'].map(kind=><label key={kind} className="mt-4 block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-white/[.025] p-4 text-center transition hover:border-[#caff00]/50">
            <div className="mx-auto mb-2 flex size-8 items-center justify-center text-[#caff00]"><CloudUpload size={23}/></div>
            <p className="text-xs font-bold text-zinc-200">{uploading===kind?'Μεταφόρτωση…':kind==='logo'?'Ανέβασε λογότυπο':'Ανέβασε εξώφυλλο'}</p>
            <p className="mt-1 text-[10px] text-zinc-500">PNG, JPG ή WEBP · έως 3 MB</p>
            <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploading)}
              onChange={e=>{upload(kind,e.target.files?.[0]);e.target.value='';}}/>
          </label>)}
          {station.cover&&<img className="mt-4 h-28 w-full rounded-xl object-cover" src={station.pendingEdits?.cover||station.cover} alt="Cover"/>}
        </div>}
        <div className={panel+' flex gap-3 p-5'}><ShieldCheck size={22} className="shrink-0 text-[#caff00]"/>
          <p className="text-[11px] leading-5 text-zinc-400">Ασφαλής πρόσβαση με JWT και έλεγχο ιδιοκτησίας στον server. Οι αλλαγές broadcaster χρειάζονται έγκριση.</p></div>
      </aside>
    </form>
  </div>;
}
function Scheduler({data,reload,notify}){
  const location=useLocation();
  const requestedStation=new URLSearchParams(location.search).get('station');
  const initialStation=data.stations.find(s=>String(s._id)===String(requestedStation));
  const [selected,setSelected]=useState(initialStation?._id||data.stations[0]?._id||'');
  const station=data.stations.find(s=>String(s._id)===String(selected));
  const [schedule,setSchedule]=useState([]);
  const [sourceBase,setSourceBase]=useState(0);
  const [ambiguousBase,setAmbiguousBase]=useState(false);
  const [activeDay,setActiveDay]=useState(1);
  const [copyTarget,setCopyTarget]=useState('2');
  const [saving,setSaving]=useState(false),[dirty,setDirty]=useState(false);
  useEffect(()=>{
    const existing=station?.schedule||[];
    const base=scheduleDayBase(existing,station?.scheduleDayBase);
    setSourceBase(base);
    setAmbiguousBase(existing.length>0&&station?.scheduleDayBase!==0&&station?.scheduleDayBase!==1&&
      !existing.some(show=>Number(show.day)===0||Number(show.day)===7));
    setSchedule(toCanonical(existing,base).map(s=>({
      day:Number(s.day),startTime:s.startTime,endTime:s.endTime,title:s.title,host:s.host||'',
      imageUrl:s.imageUrl||'',description:s.description||''
    })));
    setDirty(false);
  },[station?._id]);
  useEffect(()=>{
    if(!dirty)return;
    const preventLeave=e=>{e.preventDefault();e.returnValue='';};
    const confirmNavigation=event=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||
        event.altKey||event.shiftKey)return;
      const anchor=event.target.closest?.('a[href]');
      if(!anchor||anchor.getAttribute('href')?.startsWith('/backoffice/schedules'))return;
      if(!window.confirm('Υπάρχουν μη αποθηκευμένες αλλαγές στο πρόγραμμα. Θέλεις να φύγεις χωρίς αποθήκευση;')){
        event.preventDefault();event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload',preventLeave);
    document.addEventListener('click',confirmNavigation,true);
    return ()=>{
      window.removeEventListener('beforeunload',preventLeave);
      document.removeEventListener('click',confirmNavigation,true);
    };
  },[dirty]);
  const changeLegacyInterpretation=()=>{
    const other=sourceBase===0?1:0;
    const existing=station?.schedule||[];
    setSourceBase(other);
    setSchedule(toCanonical(existing,other).map(s=>({
      day:Number(s.day),startTime:s.startTime,endTime:s.endTime,title:s.title,host:s.host||'',
      imageUrl:s.imageUrl||'',description:s.description||''
    })));
    setDirty(true);
    notify('Έλεγξε τις ημέρες και πάτησε Αποθήκευση για επιβεβαίωση.');
  };
  const updateSchedule=callback=>{
    setSchedule(previous=>callback(previous));
    setDirty(true);
  };
  const validation=useMemo(()=>{
    const found={};
    if(schedule.length>160)found.limit='Το πρόγραμμα δέχεται έως 160 εγγραφές.';
    schedule.forEach((show,index)=>{
      const from=minutes(show.startTime),to=minutes(show.endTime,true);
      if(!show.title?.trim())found[index]='Συμπλήρωσε τίτλο εκπομπής.';
      else if(!Number.isFinite(from)||!Number.isFinite(to))
        found[index]='Επίλεξε έγκυρες ώρες έναρξης και λήξης.';
      else if(from===to&&show.startTime!=='00:00')
        found[index]='Για ολοήμερη εκπομπή χρησιμοποίησε 00:00–00:00.';
      else if(show.imageUrl&&!/^https?:\/\//i.test(show.imageUrl))
        found[index]='Η εικόνα χρειάζεται δημόσιο HTTP/HTTPS URL.';
      else if((show.description||'').length>600)found[index]='Η περιγραφή έχει όριο 600 χαρακτήρων.';
    });
    let message='',prepared=null;
    if(!Object.keys(found).length){
      try{prepared=normalize(schedule);}
      catch(error){message=error.message;}
    }
    return {errors:found,message,prepared};
  },[schedule]);
  const errors=validation.errors;
  const overnightCount=schedule.filter(s=>Number.isFinite(minutes(s.startTime))&&
    Number.isFinite(minutes(s.endTime,true))&&minutes(s.endTime,true)<minutes(s.startTime)).length;
  const dailyShows=schedule.map((show,index)=>({...show,index}))
    .filter(show=>show.day===activeDay).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  const add=()=>{
    if(schedule.length>=160){notify('Το πρόγραμμα υποστηρίζει έως 160 εγγραφές.','error');return;}
    const last=dailyShows[dailyShows.length-1];
    const startTime=last?.endTime&&last.endTime>'00:00'&&last.endTime<'23:00'?last.endTime:'10:00';
    const hour=Number(startTime.slice(0,2));
    const endTime=String(Math.min(hour+1,23)).padStart(2,'0')+':'+startTime.slice(3);
    updateSchedule(previous=>[...previous,{day:activeDay,startTime,endTime,title:'',host:'',imageUrl:'',description:''}]);
  };
  const edit=(index,key,value)=>updateSchedule(previous=>previous.map((s,j)=>
    j===index?{...s,[key]:value}:s));
  const remove=index=>updateSchedule(previous=>previous.filter((_,j)=>j!==index));
  const duplicate=show=>{
    if(schedule.length>=160){notify('Το πρόγραμμα υποστηρίζει έως 160 εγγραφές.','error');return;}
    const startTime=show.endTime>'00:00'&&show.endTime<'23:00'?show.endTime:show.startTime;
    const endHour=Number(startTime.slice(0,2))+1;
    const endTime=String(Math.min(endHour,23)).padStart(2,'0')+':'+startTime.slice(3);
    updateSchedule(previous=>[...previous,{
      day:activeDay,startTime,endTime,title:show.title,host:show.host,
      imageUrl:show.imageUrl||'',description:show.description||''
    }]);
  };
  const changeStation=value=>{
    if(dirty&&!window.confirm('Υπάρχουν μη αποθηκευμένες αλλαγές. Θέλεις να αλλάξεις σταθμό και να τις χάσεις;'))return;
    setSelected(value);setActiveDay(1);setCopyTarget('2');
  };
  const copyDay=()=>{
    const day=Number(copyTarget);
    if(!day||day===activeDay)return;
    const source=schedule.filter(show=>show.day===activeDay);
    if(!source.length){notify('Δεν υπάρχουν εκπομπές για αντιγραφή.','error');return;}
    const existing=schedule.filter(show=>show.day===day);
    if(schedule.length-existing.length+source.length>160){
      notify('Το πρόγραμμα υποστηρίζει έως 160 εγγραφές.','error');return;
    }
    if(existing.length&&!window.confirm('Οι '+existing.length+' εκπομπές της '+DAY_NAMES[day]+
      ' θα αντικατασταθούν. Συνέχεια;'))return;
    updateSchedule(previous=>[
      ...previous.filter(show=>show.day!==day),
      ...source.map(show=>({...show,day}))
    ]);
    setActiveDay(day);setCopyTarget(String(activeDay));
    notify('Η ημέρα αντιγράφηκε. Πάτησε Αποθήκευση για να ολοκληρώσεις.');
  };
  // Explicit, reviewable adjustment: when a later show starts before the previous
  // one ends, finish the previous show at the next start. Never discard entries,
  // auto-edit equal starts or silently alter airtime on the server.
  const alignAdjacent=()=>{
    const arranged=schedule.map(item=>({...item}));
    let changes=0;
    for(let day=1;day<=7;day++){
      const indices=arranged.map((item,index)=>({item,index}))
        .filter(({item})=>item.day===day&&Number.isFinite(minutes(item.startTime))&&
          Number.isFinite(minutes(item.endTime,true))&&
          minutes(item.endTime,true)>minutes(item.startTime))
        .sort((a,b)=>minutes(a.item.startTime)-minutes(b.item.startTime));
      for(let i=1;i<indices.length;i++){
        const prev=indices[i-1],cur=indices[i];
        if(minutes(cur.item.startTime)<minutes(prev.item.endTime,true)&&
          minutes(cur.item.startTime)>minutes(prev.item.startTime)){
          arranged[prev.index].endTime=cur.item.startTime;
          changes++;
        }
      }
    }
    if(changes){
      updateSchedule(()=>arranged);
      notify('Τακτοποιήθηκαν '+changes+' όρια εκπομπών. Έλεγξε τις ώρες πριν αποθηκεύσεις.');
    }else notify('Δεν μπορεί να διορθωθεί αυτόματα αυτή η σύγκρουση. Έλεγξε τις εκπομπές με ίδια ώρα.','error');
  };
  async function save(){
    if(!station||saving||!dirty)return;
    if(Object.keys(errors).length||validation.message){
      notify(validation.message||'Συμπλήρωσε τους τίτλους και τις ώρες πριν αποθηκεύσεις.','error');
      return;
    }
    if(station.scheduleFeed?.enabled){
      if(data.user.role==='producer'){notify('Μόνο ο broadcaster ή ο admin μπορεί να σταματήσει το XML feed.','error');return;}
      if(!window.confirm('Η χειροκίνητη αποθήκευση θα απενεργοποιήσει τον καθημερινό XML συγχρονισμό. Συνέχεια;'))return;
    }
    setSaving(true);
    try{
      // The API does the same normalization again, under JWT + ownership checks.
      // Keep the user's overnight input intact until the server confirms the save.
      const result=await api('/stations/'+station._id+'/schedule',{
        method:'PUT',body:JSON.stringify({schedule:schedule.map(({day,startTime,endTime,title,host,imageUrl,description})=>
          ({day,startTime,endTime,title:title.trim(),host:host.trim(),
            imageUrl:(imageUrl||'').trim(),description:(description||'').trim()}))})
      });
      setSchedule(toCanonical(result.station.schedule||[],1).map(show=>({
        day:Number(show.day),startTime:show.startTime,endTime:show.endTime,
        title:show.title,host:show.host||'',imageUrl:show.imageUrl||'',
        description:show.description||''
      })));
      setSourceBase(1);setAmbiguousBase(false);
      setDirty(false);
      notify(result.message||'Το πρόγραμμα αποθηκεύτηκε.');
      await reload();
    }catch(error){notify(error.message,'error');}finally{setSaving(false);}
  }
  async function removeAll(){
    if(!station||saving||data.user.role==='producer')return;
    const count=station.schedule?.length||0;
    const message='Διαγραφή ΟΛΟΥ του προγράμματος του «'+station.name+'» ('+count+
      ' αποθηκευμένες εκπομπές); Η ενέργεια δεν αναιρείται και ο αυτόματος XML συγχρονισμός θα απενεργοποιηθεί.'+
      (dirty?' Οι μη αποθηκευμένες αλλαγές σου θα χαθούν.':'')+' Συνέχεια;';
    if(!window.confirm(message))return;
    setSaving(true);
    try{
      const result=await api('/stations/'+station._id+'/schedule',{method:'DELETE'});
      setSchedule([]);
      setSourceBase(1);setAmbiguousBase(false);setDirty(false);
      notify(result.message||'Το πρόγραμμα διαγράφηκε.');
      await reload();
    }catch(error){notify(error.message,'error');}
    finally{setSaving(false);}
  }
  const countDay=day=>schedule.filter(show=>show.day===day).length;
  const totalErrors=Object.keys(errors).length+Number(Boolean(validation.message));
  return <div>
    <SectionTitle eyebrow="Εύκολο πρόγραμμα" title="Οργάνωσε τις εκπομπές σου."
      description="Οι ημέρες είναι Δευτέρα–Κυριακή (1–7). Γράψε ώρες κανονικά, ακόμη και αν μια εκπομπή τελειώνει μετά τα μεσάνυχτα. Το πρόγραμμα βάζει τη σωστή σειρά και χωρίζει τις ημέρες μόνο του."
      aside={<div className="flex flex-wrap items-center gap-3">
        {dirty&&<Badge tone="amber">Μη αποθηκευμένες αλλαγές</Badge>}
        {data.user.role!=='producer'&&station&&<button type="button" onClick={removeAll}
          disabled={saving||(!station.schedule?.length&&!station.scheduleFeed?.enabled)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-xs font-bold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40">
          <Trash2 size={16}/> Διαγραφή όλου του προγράμματος
        </button>}
        <button type="button" onClick={save} disabled={!station||saving||!dirty||totalErrors>0}
          className={buttonPrimary}><Save size={16}/>{saving?'Αποθήκευση…':'Αποθήκευση προγράμματος'}</button>
      </div>}/>
    <div className={panel+' mb-5 flex flex-wrap items-end justify-between gap-4 p-5'}>
      <div className="min-w-[220px] flex-1"><Field label="Σταθμός">
        <select aria-label="Σταθμός προγράμματος" className={inputClass} value={selected}
          onChange={e=>changeStation(e.target.value)}>
          {data.stations.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
        </select></Field></div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="lime">{schedule.length} εγγραφές / εβδομάδα</Badge>
        <Badge tone={totalErrors?'rose':'neutral'}>{totalErrors?'Χρειάζεται διόρθωση':'Έτοιμο για αποθήκευση'}</Badge>
      </div>
    </div>
    {ambiguousBase&&<div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[.07] p-4">
      <div className="max-w-2xl"><p className="text-xs font-black text-amber-200">Έλεγχος ημερών παλιού προγράμματος</p>
        <p className="mt-1 text-xs leading-5 text-zinc-300">
          Το πρόγραμμα είχε αποθηκευτεί χωρίς ένδειξη αρίθμησης ημερών. Τώρα προβάλλεται ως παλιό πρόγραμμα.
          Αν βλέπεις τις εκπομπές μία ημέρα μετά ή πριν, επίλεξε την άλλη αντιστοίχιση.
          Με την αποθήκευση οι ημέρες οριστικοποιούνται σωστά.</p></div>
      <button type="button" onClick={changeLegacyInterpretation}
        className={buttonSecondary}>Αλλαγή αντιστοίχισης ημερών</button>
    </div>}
    {overnightCount>0&&<div className="mb-5 rounded-2xl border border-[#caff00]/20 bg-[#caff00]/[.055] p-4 text-xs leading-6 text-zinc-200">
      <span className="font-black text-[#caff00]">Αυτόματος διαχωρισμός μεσονυχτίου:</span>
      {' '+overnightCount+' εκπομπές περνούν στην επόμενη ημέρα. Μπορείς να γράψεις π.χ. 23:00–02:00.'}
      {' Με την αποθήκευση θα χωριστούν αυτόματα σε 23:00–24:00 και 00:00–02:00.'}
    </div>}
    {validation.message&&<div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/[.055] p-4">
      <span className="flex items-start gap-2 text-xs leading-6 text-rose-200">
        <CircleAlert size={17} className="mt-0.5 shrink-0"/>{validation.message}</span>
      {validation.message.includes('επικαλύπτονται')&&
        <button type="button" onClick={alignAdjacent} className={buttonSecondary}>
          <RefreshCw size={15}/> Τακτοποίηση ωρών</button>}
    </div>}
    {station&&<ScheduleXmlImport station={station} api={api} notify={notify} reload={reload}
      canManage={data.user.role!=='producer'} onImported={updated=>{
        setSchedule(toCanonical(updated.schedule||[],1).map(show=>({
          day:Number(show.day),startTime:show.startTime,endTime:show.endTime,
          title:show.title,host:show.host||'',imageUrl:show.imageUrl||'',
          description:show.description||''
        })));
        setDirty(false);setSourceBase(1);setAmbiguousBase(false);
      }}/>}
    {!station?<div className={panel+' p-12 text-center text-zinc-400'}>Δεν έχεις εκχωρημένο σταθμό.
      {data.user.role==='broadcaster'&&<div className="mt-4"><Link className={buttonSecondary}
        to="/backoffice/stations/new">Προσθήκη σταθμού</Link></div>}</div>:
    <>
      <div role="tablist" aria-label="Επίλεξε ημέρα" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {DAY_NAMES.slice(1).map((day,index)=>{
          const number=index+1,active=activeDay===number;
          return <button role="tab" aria-selected={active} type="button" key={day}
            onClick={()=>{setActiveDay(number);if(Number(copyTarget)===number)
              setCopyTarget(String(number===7?1:number+1));}}
            className={'rounded-2xl border px-4 py-4 text-left transition '+(active?
              'border-[#caff00] bg-[#caff00] text-[#121600] shadow-[0_8px_25px_rgba(202,255,0,.16)]':
              'border-white/10 bg-[#151819] text-zinc-200 hover:border-[#caff00]/35')}>
            <span className="block text-xs font-black">{day}</span>
            <span className={'mt-2 block text-[11px] '+(active?'text-[#303900]':'text-zinc-500')}>
              {countDay(number)} {countDay(number)===1?'εκπομπή':'εκπομπές'}</span>
          </button>;
        })}
      </div>
      <div className={panel+' overflow-hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5 md:p-7">
          <div><h3 className="text-xl font-black text-white">{DAY_NAMES[activeDay]}</h3>
            <p className="mt-1 text-xs text-zinc-500">Οι εκπομπές εμφανίζονται με σειρά ώρας.</p></div>
          <button className={buttonPrimary} type="button" onClick={add}><Plus size={17}/> Νέα εκπομπή</button>
        </div>
        <div role="tabpanel" className="space-y-4 p-4 md:p-6">
          {dailyShows.length?dailyShows.map(show=><div key={show.index}
            className={'rounded-2xl border p-4 md:p-5 '+(errors[show.index]?
              'border-rose-400/35 bg-rose-400/[.045]':'border-white/10 bg-[#0b0e0f]')}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-black text-[#caff00]">
                <Clock3 size={15}/>{show.startTime} – {show.endTime}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={()=>duplicate(show)} title="Αντιγραφή εκπομπής"
                  aria-label={'Αντιγραφή '+(show.title||'εκπομπής')} className={buttonSecondary+' !px-3 !py-2'}>
                  <Copy size={15}/> <span className="hidden sm:inline">Αντιγραφή</span></button>
                <button type="button" onClick={()=>remove(show.index)} title="Διαγραφή εκπομπής"
                  aria-label={'Διαγραφή '+(show.title||'εκπομπής')}
                  className="rounded-xl border border-rose-400/20 px-3 py-2 text-rose-300 hover:bg-rose-400/10">
                  <Trash2 size={16}/></button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[130px_130px_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Από"><input aria-label="Από" type="time" className={inputClass}
                value={show.startTime} onChange={e=>edit(show.index,'startTime',e.target.value)}/></Field>
              <Field label="Έως"><input aria-label="Έως" type="time" className={inputClass}
                value={show.endTime} onChange={e=>edit(show.index,'endTime',e.target.value)}/></Field>
              <Field label="Τίτλος εκπομπής *"><input required maxLength={120} className={inputClass}
                placeholder="π.χ. Πρωινή παρέα" value={show.title}
                onChange={e=>edit(show.index,'title',e.target.value)}/></Field>
              <Field label="Παραγωγός"><input maxLength={100} className={inputClass}
                placeholder="π.χ. DJ Maria" value={show.host}
                onChange={e=>edit(show.index,'host',e.target.value)}/></Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_64px]">
              <Field label="Εικόνα εκπομπής (URL)">
                <input type="url" maxLength={800} className={inputClass}
                  placeholder="https://example.com/producer.jpg" value={show.imageUrl||''}
                  onChange={e=>edit(show.index,'imageUrl',e.target.value)}/>
              </Field>
              <Field label="Περιγραφή εκπομπής">
                <input maxLength={600} className={inputClass}
                  placeholder="Μουσικό ύφος, θεματολογία…" value={show.description||''}
                  onChange={e=>edit(show.index,'description',e.target.value)}/>
              </Field>
              <div className="flex items-end justify-start">
                <img src={show.imageUrl||station.logo} alt="Προεπισκόπηση εικόνας εκπομπής"
                  onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=station.logo;}}
                  className="size-14 rounded-xl border border-white/10 bg-white object-cover"/>
              </div>
            </div>
            {errors[show.index]&&<p role="alert" className="mt-3 flex items-center gap-2 text-xs text-rose-300">
              <CircleAlert size={15}/>{errors[show.index]}</p>}
          </div>):<div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
            <CalendarDays className="mx-auto mb-3 text-[#caff00]" size={30}/>
            <p className="font-bold text-white">Δεν υπάρχουν εκπομπές για {DAY_NAMES[activeDay]}.</p>
            <p className="mt-2 text-xs text-zinc-500">Πάτησε «Νέα εκπομπή» για να ξεκινήσεις.</p>
          </div>}
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[.025] p-4">
            <div className="min-w-[170px] flex-1"><Field label="Αντιγραφή αυτής της ημέρας σε">
              <select className={inputClass} aria-label="Ημέρα προορισμού αντιγραφής"
                value={Number(copyTarget)===activeDay?'':copyTarget}
                onChange={e=>setCopyTarget(e.target.value)}>
                <option value="">Επίλεξε ημέρα</option>
                {DAY_NAMES.slice(1).map((day,index)=>index+1===activeDay?null:
                  <option key={day} value={index+1}>{day}</option>)}
              </select></Field></div>
            <button type="button" disabled={!dailyShows.length||!copyTarget||Number(copyTarget)===activeDay}
              onClick={copyDay} className={buttonSecondary}><Copy size={15}/> Αντιγραφή ημέρας</button>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#caff00]/15 bg-[#caff00]/[.035] p-5">
        <div className="flex items-center gap-3 text-xs text-zinc-300"><ShieldCheck size={19} className="text-[#caff00]"/>
          <span>{totalErrors?'Διόρθωσε πρώτα τις επισημασμένες εκπομπές.':
            dirty?'Οι αλλαγές δεν έχουν αποθηκευτεί ακόμη.':'Το πρόγραμμά σου είναι ενημερωμένο.'}</span>
        </div>
        <button type="button" disabled={!dirty||saving||totalErrors>0} onClick={save}
          className={buttonPrimary}><Save size={16}/>{saving?'Αποθήκευση…':'Αποθήκευση'}</button>
      </div>
    </>}
  </div>;
}
function Review({data,reload,notify,requestDelete}){
  const empty={items:[],total:0,page:1,pageSize:50};
  const [queue,setQueue]=useState({pending:empty,edits:empty});
  const [pendingPage,setPendingPage]=useState(1);
  const [editsPage,setEditsPage]=useState(1);
  const [searchInput,setSearchInput]=useState('');
  const [search,setSearch]=useState('');
  const [refreshKey,setRefreshKey]=useState(0);
  const [queueLoading,setQueueLoading]=useState(true);
  const [queueError,setQueueError]=useState('');
  const [busy,setBusy]=useState('');
  useEffect(()=>{
    if(data.user.role!=='admin')return;
    let active=true;
    setQueueLoading(true);
    api('/review-queue?pendingPage='+pendingPage+'&editsPage='+editsPage+'&q='+encodeURIComponent(search))
      .then(next=>{
        if(!active)return;
        setQueue(next);setQueueError('');
        if(pendingPage>1&&!next.pending.items.length)setPendingPage(p=>Math.max(1,p-1));
        if(editsPage>1&&!next.edits.items.length)setEditsPage(p=>Math.max(1,p-1));
      })
      .catch(error=>{if(active)setQueueError(error.message);})
      .finally(()=>{if(active)setQueueLoading(false);});
    return ()=>{active=false;};
  },[data.user.role,pendingPage,editsPage,search,refreshKey]);
  if(data.user.role!=='admin')return <Navigate to="/backoffice" replace/>;
  const changed=queue.edits.items||[];
  const newStations=queue.pending.items||[];
  const work=async(s,action,isApproval=false)=>{
    setBusy(String(s._id));
    try{
      const response=await api('/stations/'+s._id+(isApproval?'/approve':'/review'),
        {method:'POST',body:JSON.stringify({action})});
      notify(response.message);await reload();setRefreshKey(v=>v+1);
    }catch(error){notify(error.message,'error');}
    finally{setBusy('');}
  };
  const pager=(part,setPage)=>{
    const pages=Math.max(1,Math.ceil(part.total/part.pageSize));
    return pages>1?<div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-xs text-zinc-400">
      <button type="button" className={buttonSecondary} disabled={queueLoading||part.page<=1}
        onClick={()=>setPage(p=>Math.max(1,p-1))}>Προηγούμενη</button>
      <span>Σελίδα {part.page} από {pages} · {part.total} εγγραφές</span>
      <button type="button" className={buttonSecondary} disabled={queueLoading||part.page>=pages}
        onClick={()=>setPage(p=>p+1)}>Επόμενη</button>
    </div>:null;
  };
  return <div><SectionTitle eyebrow="Moderation queue" title="Εγκρίσεις με ένα κλικ."
    description="Όλες οι εκκρεμότητες, μαζί με σταθμούς που εισήχθησαν από μεταφορά δεδομένων. Ανεξάρτητη φόρτωση από τον κατάλογο."/>
    <form className={panel+' mb-6 flex flex-wrap items-center gap-3 p-4'} onSubmit={event=>{
      event.preventDefault();setPendingPage(1);setEditsPage(1);
      setSearch(searchInput.trim());setRefreshKey(v=>v+1);
    }}>
      <div className="relative min-w-[180px] flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/>
        <input className={inputClass+' pl-11'} placeholder="Αναζήτησε και σταθμούς από μεταφορά (π.χ. 102.5 FM)" value={searchInput}
          onChange={event=>setSearchInput(event.target.value)} maxLength={100}/></div>
      <button type="submit" className={buttonPrimary}><Search size={15}/> Αναζήτηση</button>
      <button type="button" className={buttonSecondary} onClick={()=>{
        setSearchInput('');setSearch('');setPendingPage(1);setEditsPage(1);setRefreshKey(v=>v+1);
      }}><RefreshCw size={15}/> Όλες οι εγκρίσεις</button>
    </form>
    {queueLoading&&<div className="mb-5 flex items-center gap-2 text-xs text-[#caff00]" role="status">
      <RefreshCw size={16} className="animate-spin"/> Φόρτωση εγκρίσεων από τη βάση…</div>}
    {queueError&&<div role="alert" className="mb-6 rounded-xl border border-rose-500/25 bg-rose-500/[.07] p-4 text-sm text-rose-300">{queueError}</div>}
    <div className="space-y-8">
      <section><h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Clock3 size={19} className="text-[#caff00]"/> Αιτήματα αλλαγών <Badge tone="amber">{queue.edits.total}</Badge></h3>
        <div className="space-y-3">{changed.length?changed.map(s=><div key={s._id} className={panel+' p-5'}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h4 className="font-black text-white">{s.name}</h4>
              <p className="mt-1 text-[11px] text-zinc-500">Πεδία: {Object.keys(s.pendingEdits||{}).join(', ')}</p></div>
            <div className="flex flex-wrap gap-2">
              <Link to={'/backoffice/stations/'+s._id+'/edit'} className={buttonSecondary}>Προβολή <ArrowRight size={13}/></Link>
              <button className={buttonSecondary+' text-rose-300'} disabled={Boolean(busy)} onClick={()=>work(s,'reject')}>Απόρριψη</button>
              <button className={buttonPrimary} disabled={Boolean(busy)} onClick={()=>work(s,'approve')}><Check size={15}/> Έγκριση</button>
            </div></div></div>):!queueLoading&&<div className={panel+' p-7 text-sm text-zinc-500'}>Δεν υπάρχουν αλλαγές σε αναμονή.</div>}</div>
        {pager(queue.edits,setEditsPage)}
      </section>
      <section><h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Radio size={19} className="text-[#caff00]"/> Νέοι σταθμοί <Badge tone="amber">{queue.pending.total}</Badge></h3>
        <div className="space-y-3">{newStations.length?newStations.map(s=><div key={s._id} className={panel+' flex flex-wrap items-center justify-between gap-4 p-5'}>
          <div className="flex min-w-0 items-center gap-3">
            {s.logo&&<img src={s.logo} alt="" className="size-14 shrink-0 rounded-xl border border-white/10 bg-black/20 object-contain p-1"/>}
            <div className="min-w-0"><p className="truncate font-black text-white">{s.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{s.genre} · {s.city||'Χωρίς πόλη'}</p>
              <p className="mt-1 truncate text-[11px] text-zinc-500">{s.slug?'/station/'+s.slug:'Χωρίς slug'}</p></div>
          </div>
          <div className="flex flex-wrap gap-2"><Link className={buttonSecondary} to={'/backoffice/stations/'+s._id+'/edit'}>Έλεγχος <ArrowRight size={14}/></Link>
            <button onClick={()=>work(s,'approve',true)} disabled={Boolean(busy)} className={buttonPrimary}>Έγκριση σταθμού</button>
            <button type="button" onClick={()=>requestDelete(s)} disabled={Boolean(busy)}
              className={buttonSecondary+' !border-rose-500/20 !text-rose-300 hover:!bg-rose-500/10'}>
              <Trash2 size={15}/> Διαγραφή</button></div>
        </div>):!queueLoading&&<div className={panel+' p-7 text-sm text-zinc-500'}>Δεν υπάρχουν νέοι σταθμοί προς έγκριση.</div>}</div>
        {pager(queue.pending,setPendingPage)}
      </section>
    </div>
  </div>;
}
function Team({data,notify}){
  const [people,setPeople]=useState([]),[loading,setLoading]=useState(true),[sending,setSending]=useState(false);
  const [form,setForm]=useState({email:'',fname:'',lname:'',
    stationId:data.stations.find(s=>s.status==='approved')?._id||''});
  const refresh=useCallback(async()=>{
    const result=await api('/producers');
    setPeople(result.producers||[]);
  },[]);
  useEffect(()=>{let alive=true;refresh().catch(error=>{if(alive)notify(error.message,'error');})
    .finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[refresh]);
  const invite=async(e)=>{
    e.preventDefault();setSending(true);
    try{
      const response=await api('/producers/invite',{method:'POST',body:JSON.stringify(form)});
      notify(response.message);setForm(prev=>({...prev,email:'',fname:'',lname:''}));
      await refresh();
    }catch(error){notify(error.message,'error');}finally{setSending(false);}
  };
  const revoke=async(person)=>{
    if(!window.confirm('Να ανακληθεί η πρόσβαση του παραγωγού '+person.email+';'))return;
    try{
      const response=await api('/producers/'+person._id,{method:'DELETE'});
      notify(response.message);await refresh();
    }catch(error){notify(error.message,'error');}
  };
  if(data.user.role!=='broadcaster')return <Navigate to="/backoffice" replace/>;
  return <div><SectionTitle eyebrow="Your team" title="Οι άνθρωποι του σταθμού."
    description="Προσκάλεσε παραγωγούς με email. Κάθε συνεργάτης βλέπει μόνο τον σταθμό που του αναθέτεις και μπορεί να ενημερώνει το πρόγραμμα."/>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <section className={panel+' p-5 md:p-7'}>
        <div className="mb-5 flex items-center justify-between"><h3 className="text-xl font-black text-white">Συνεργάτες</h3><Badge tone="lime">{people.length} παραγωγοί</Badge></div>
        {loading?<p className="py-8 text-sm text-zinc-500">Φόρτωση ομάδας…</p>:
          people.length?people.map(person=><div key={person._id} className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-4 last:border-b-0">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#caff00]/10 text-[#caff00]"><Mic2 size={18}/></div>
              <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{person.fname} {person.lname}</p>
                <p className="mt-1 truncate text-xs text-zinc-500">{person.email}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{person.assignedStation?.name||'Χωρίς σταθμό'}</p>
              </div></div>
            <div className="flex items-center gap-3"><Badge tone={person.isVerified?'lime':'amber'}>
              {person.isVerified?'Ενεργός':'Πρόσκληση σε εκκρεμότητα'}</Badge>
              <button type="button" aria-label="Ανάκληση πρόσβασης" onClick={()=>revoke(person)}
                className="rounded-xl border border-rose-400/20 p-2 text-rose-300 hover:bg-rose-400/10"><Trash2 size={16}/></button></div>
          </div>):<div className="py-12 text-center text-sm text-zinc-500">Δεν υπάρχουν ακόμη προσκεκλημένοι παραγωγοί.</div>}
      </section>
      <form onSubmit={invite} className={panel+' space-y-5 p-5 md:p-7'}>
        <div className="mb-5 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-[#caff00]/10 text-[#caff00]"><Plus size={20}/></div>
          <div><h3 className="font-black text-white">Νέα πρόσκληση</h3><p className="mt-1 text-xs text-zinc-500">Αποστολή σύνδεσμου ενεργοποίησης</p></div></div>
        <Field label="Όνομα *"><input required maxLength={70} className={inputClass} value={form.fname} onChange={e=>setForm(p=>({...p,fname:e.target.value}))}/></Field>
        <Field label="Επώνυμο *"><input required maxLength={70} className={inputClass} value={form.lname} onChange={e=>setForm(p=>({...p,lname:e.target.value}))}/></Field>
        <Field label="Email *"><input required type="email" maxLength={254} className={inputClass} value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))}/></Field>
        <Field label="Σταθμός *"><select required className={inputClass} value={form.stationId} onChange={e=>setForm(p=>({...p,stationId:e.target.value}))}>
          <option value="">Επίλεξε σταθμό</option>
          {data.stations.filter(s=>s.status==='approved').map(station=><option key={station._id} value={station._id}>{station.name}</option>)}</select></Field>
        <button disabled={sending||!form.stationId} type="submit" className={buttonPrimary+' w-full'}>
          {sending?<RefreshCw size={17} className="animate-spin"/>:<ArrowRight size={16}/>}
          Αποστολή πρόσκλησης</button>
        <p className="text-[11px] leading-5 text-zinc-500">Ο σύνδεσμος λήγει σε 7 ημέρες, ενεργοποιείται μία φορά και ο παραγωγός ορίζει δικό του κωδικό.</p>
      </form>
    </div>
  </div>;
}
function BroadcasterInsights({data}){
  const stations=[...data.stations].sort((a,b)=>(b.plays||0)-(a.plays||0));
  const total=stations.reduce((sum,station)=>sum+(Number(station.plays)||0),0);
  const top=stations[0];
  return <div>
    <SectionTitle eyebrow="iRadios insights" title="Η πορεία του ήχου σου."
      description="Συγκεντρωτικά στοιχεία από τους σταθμούς του λογαριασμού σου. Οι μετρήσεις είναι ιστορικά plays, όχι ταυτόχρονοι live ακροατές."/>
    <div className="mb-8 grid gap-4 md:grid-cols-3">
      <Metric icon={Headphones} label="Συνολικές ακροάσεις" value={shortNumber(total)} caption="Καταγεγραμμένα plays στο iRadios"/>
      <Metric icon={Radio} label="Σταθμοί" value={stations.length} caption="Που έχεις δικαίωμα προβολής"/>
      <Metric icon={BarChart3} label="Πρώτος σταθμός" value={top?.name||'—'} caption="Σύμφωνα με τα συνολικά plays" rose/>
    </div>
    <section className={panel+' p-5 md:p-8'}>
      <h3 className="mb-6 text-xl font-black text-white">Ακροάσεις ανά σταθμό</h3>
      {stations.length?stations.map((station,index)=><div key={station._id} className="mb-6 last:mb-0">
        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
          <span className="truncate font-bold text-zinc-200">{index+1}. {station.name}</span>
          <span className="shrink-0 font-black tabular-nums text-[#caff00]">{shortNumber(station.plays)}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[.07]">
          <div className="h-full rounded-full bg-[#caff00]" style={{width:Math.max(0,Math.min(100,100*(Number(station.plays)||0)/Math.max(1,Number(top?.plays)||1)))+'%'}}/>
        </div></div>):
        <p className="text-sm text-zinc-500">Δεν υπάρχουν ακόμη σταθμοί.</p>}
    </section>
  </div>;
}
const ADMIN_TOOLS=[
  {id:'analytics',name:'Αναλύσεις',desc:'Στοιχεία δικτύου και απόδοση',icon:BarChart3,group:'Δίκτυο'},
  {id:'users',name:'Χρήστες & ρόλοι',desc:'Λογαριασμοί, άδειες και πρόσβαση',icon:Users,group:'Δίκτυο'},
  {id:'radioset',name:'Αναθέσεις σταθμών',desc:'Σύνδεσε σταθμούς με broadcasters',icon:Radio,group:'Δίκτυο'},
  {id:'boost',name:'Προβολή σταθμών',desc:'Προτεραιότητες και boost σταθμών',icon:Sparkles,group:'Δίκτυο'},
  {id:'promoted',name:'Promoted Stations',desc:'Επίλεξε σταθμό δίπλα στα slides ανά Περιοχή ή Είδος',icon:Sparkles,group:'Δίκτυο'},
  {id:'ads',name:'Audio διαφημίσεις',desc:'Διαχείριση ηχητικών καμπανιών',icon:Activity,group:'Διαφημίσεις'},
  {id:'banners',name:'Banners',desc:'Οπτικές διαφημίσεις και θέσεις',icon:Image,group:'Διαφημίσεις'},
  {id:'adcontrol',name:'Τοπικές διαφημίσεις',desc:'Ρυθμίσεις διαφημίσεων ανά σταθμό',icon:SlidersHorizontal,group:'Διαφημίσεις'},
  {id:'slides',name:'Slides & καμπάνιες',desc:'Πολλαπλές θέσεις προβολής ανά slide',icon:LayoutDashboard,group:'Περιεχόμενο'},
  {id:'newsfeed',name:'Newsfeed RSS',desc:'XML πηγή και συγχρονισμός ειδήσεων',icon:Image,group:'Περιεχόμενο'},
  {id:'push',name:'Push ειδοποιήσεις',desc:'Μηνύματα σε συνδεδεμένες συσκευές',icon:Bell,group:'Επικοινωνία'},
  {id:'emails',name:'Emails',desc:'Επικοινωνία και ιστορικό μηνυμάτων',icon:Globe2,group:'Επικοινωνία'},
  {id:'billing',name:'Πληρωμές',desc:'Συναλλαγές και στοιχεία τιμολόγησης',icon:FileCheck2,group:'Οικονομικά'}
];
function AdminWorkspace({data}){
  const [search,setSearch]=useState('');
  if(data.user.role!=='admin')return <Navigate to="/backoffice" replace/>;
  const filtered=ADMIN_TOOLS.filter(item=>(item.name+' '+item.desc+' '+item.group)
    .toLocaleLowerCase('el').includes(search.toLocaleLowerCase('el')));
  const pending=(Number(data.counts?.pendingApproval)||0)+(Number(data.counts?.pendingEdits)||0);
  return <div>
    <SectionTitle eyebrow="Admin Control" title="Κέντρο διαχείρισης."
      description="Όλα τα εργαλεία του δικτύου, οργανωμένα ανά εργασία. Επίλεξε τι θέλεις να διαχειριστείς."/>
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Link to="/backoffice/review" className={panel+' group flex items-center gap-4 p-5 hover:border-[#caff00]/35'}>
        <FileCheck2 className="shrink-0 text-[#caff00]" size={24}/>
        <span className="flex-1"><strong className="block text-base text-white">{pending}</strong>
          <span className="text-xs text-zinc-400">Αιτήματα προς έλεγχο</span></span><ArrowRight size={17}/></Link>
      <Link to="/backoffice/stations" className={panel+' group flex items-center gap-4 p-5 hover:border-[#caff00]/35'}>
        <Radio className="shrink-0 text-[#caff00]" size={24}/>
        <span className="flex-1"><strong className="block text-base text-white">{shortNumber(data.counts?.total)}</strong>
          <span className="text-xs text-zinc-400">Σταθμοί δικτύου</span></span><ArrowRight size={17}/></Link>
      <Link to="/backoffice/schedules" className={panel+' group flex items-center gap-4 p-5 hover:border-[#caff00]/35'}>
        <CalendarDays className="shrink-0 text-[#caff00]" size={24}/>
        <span className="flex-1"><strong className="block text-sm text-white">Πρόγραμμα</strong>
          <span className="text-xs text-zinc-400">Εβδομαδιαίες εκπομπές</span></span><ArrowRight size={17}/></Link>
    </div>
    <div className={panel+' mb-6 p-4'}>
      <label className="relative block"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/>
        <input aria-label="Αναζήτηση εργαλείου Admin" value={search} onChange={e=>setSearch(e.target.value)}
          className={inputClass+' pl-11'} placeholder="Τι θέλεις να διαχειριστείς; π.χ. χρήστες, διαφημίσεις…"/></label>
    </div>
    {['Δίκτυο','Διαφημίσεις','Περιεχόμενο','Επικοινωνία','Οικονομικά'].map(group=>{
      const tools=filtered.filter(item=>item.group===group);
      if(!tools.length)return null;
      return <section key={group} className="mb-7"><h3 className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-400">{group}</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{tools.map(item=><Link
          key={item.id} to={'/backoffice/admin/'+item.id}
          className={panel+' group flex min-h-28 items-center gap-4 p-5 transition hover:border-[#caff00]/40 hover:bg-[#161b1b]'}>
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#caff00]/10 text-[#caff00]">
            <item.icon size={22}/></div>
          <div className="min-w-0 flex-1"><p className="font-black text-white">{item.name}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{item.desc}</p></div>
          <ArrowRight size={16} className="shrink-0 text-zinc-500 group-hover:text-[#caff00]"/>
        </Link>)}</div></section>;
    })}
    {!filtered.length&&<div className={panel+' p-10 text-center text-sm text-zinc-400'}>Δεν βρέθηκαν εργαλεία με αυτή την αναζήτηση.</div>}
  </div>;
}
class AdminToolErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={failed:false};}
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){console.error('Backoffice Admin module unavailable:',error?.message);}
  render(){
    if(!this.state.failed)return this.props.children;
    return <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[.05] p-8 text-center">
      <CircleAlert className="mx-auto mb-3 text-rose-300" size={28}/>
      <h3 className="text-lg font-black text-white">Δεν φορτώθηκε το εργαλείο.</h3>
      <p className="mt-2 text-sm text-zinc-400">Δοκίμασε ανανέωση ή επίλεξε άλλο εργαλείο.
        Πριν επαναλάβεις κάποια ενέργεια, έλεγξε αν αποθηκεύτηκε.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" className={buttonPrimary} onClick={()=>window.location.reload()}>
          <RefreshCw size={15}/> Επανάληψη</button>
        <Link className={buttonSecondary} to="/backoffice/admin">Άλλα εργαλεία</Link>
      </div>
    </div>;
  }
}
const ADMIN_GUIDES={
  analytics:{intro:'Τα βασικά στοιχεία του δικτύου και τα αποτελέσματα των καμπανιών σε μία εικόνα.',
    steps:['Δες τις βασικές μετρήσεις','Έλεγξε τα γραφήματα','Άνοιξε το εργαλείο που χρειάζεται ενέργεια']},
  users:{intro:'Διαχειρίσου τους λογαριασμούς με αναζήτηση, φίλτρα και αλλαγές ρόλων.',
    steps:['Βρες τον χρήστη','Επίλεξε επεξεργασία ή δικαιώματα','Έλεγξε τα στοιχεία πριν αποθηκεύσεις']},
  radioset:{intro:'Σύνδεσε έναν σταθμό με τον σωστό Broadcaster χωρίς επιπλέον διαδικασίες.',
    steps:['Αναζήτησε τον σταθμό','Άνοιξε ανάθεση','Επίλεξε Broadcaster και αποθήκευσε']},
  boost:{intro:'Ρύθμισε προβολές και προτεραιότητες σταθμών. Η σειρά αποθηκεύεται χωριστά.',
    steps:['Βρες τον σταθμό','Ρύθμισε boost ή σειρά','Αποθήκευσε τη σειρά χωρίς φίλτρα']},
  promoted:{intro:'Πρόβαλε έναν εγκεκριμένο σταθμό δεξιά από το editorial slide σε κάθε Περιοχή ή Είδος.',
    steps:['Επίλεξε Περιοχή ή Είδος','Διάλεξε τον σταθμό','Ενεργοποίησε και αποθήκευσε']},
  ads:{intro:'Βρες, δημιούργησε και έλεγξε τις ηχητικές διαφημίσεις του δικτύου.',
    steps:['Έλεγξε τα ενεργά σποτ','Πρόσθεσε ή επεξεργάσου','Επιβεβαίωσε στόχευση και κατάσταση']},
  banners:{intro:'Διαχειρίσου τις οπτικές διαφημίσεις ανά θέση και κατάσταση.',
    steps:['Φίλτραρε ανά τοποθέτηση','Άνοιξε banner','Έλεγξε εικόνα και στόχευση']},
  adcontrol:{intro:'Έλεγξε τους σταθμούς χωρίς network ads και τις τοπικές καμπάνιες.',
    steps:['Έλεγξε τις εξαιρέσεις','Βρες το τοπικό σποτ','Επιβεβαίωσε πριν αλλάξεις ρυθμίσεις']},
  newsfeed:{intro:'Διαχείριση RSS.app XML ειδήσεων.',steps:['Πέρασε RSS XML','Αποθήκευσε','Πάτησε Συγχρονισμός τώρα']},
  slides:{intro:'Δημιούργησε editorial slides με προεπισκόπηση πριν τη δημοσίευση.',
    steps:['Επίλεξε σημείο προβολής','Συμπλήρωσε εικόνα και σύνδεσμο','Αποθήκευσε και έλεγξε την προεπισκόπηση']},
  push:{intro:'Σύνταξε ειδοποίηση και έλεγξε τα στοιχεία πριν την τελική αποστολή.',
    steps:['Γράψε σύντομο τίτλο','Συμπλήρωσε το μήνυμα','Έλεγξε και επιβεβαίωσε αποστολή']},
  emails:{intro:'Αναζήτησε αποστολές και σύνταξε νέα επικοινωνία για συγκεκριμένο παραλήπτη ή ομάδα.',
    steps:['Βρες προηγούμενες αποστολές','Διάλεξε παραλήπτες','Έλεγξε θέμα και περιεχόμενο πριν στείλεις']},
  billing:{intro:'Παρακολούθησε συναλλαγές και έκδοση παραστατικών από ένα σημείο.',
    steps:['Αναζήτησε συναλλαγή','Έλεγξε τιμολόγηση','Άνοιξε το διαθέσιμο παραστατικό']}
};
function AdminGuide({section}){
  const guide=ADMIN_GUIDES[section];
  if(!guide)return null;
  return <details className="bo-operation-note mb-6 group p-4 md:p-5">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#caff00]/10 text-[#caff00]"><ShieldCheck size={18}/></div>
        <div><p className="text-xs font-black text-white">Γρήγορος οδηγός</p>
          <p className="mt-1 text-xs leading-5 text-zinc-400">{guide.intro}</p></div>
      </div>
      <ChevronDown size={19} className="shrink-0 text-[#caff00] transition-transform group-open:rotate-180"/>
    </summary>
    <div className="mt-5 grid gap-3 border-t border-white/10 pt-4 md:grid-cols-3">
      {guide.steps.map((step,i)=><div key={step} className="bo-step">
        <span className="bo-step-count">{i+1}</span>
        <span className="text-xs leading-5 text-zinc-200">{step}</span>
      </div>)}
    </div>
  </details>;
}
function Operations({data,section,reload}){
  if(data.user.role!=='admin')return <Navigate to="/backoffice" replace/>;
  const current=ADMIN_TOOLS.find(item=>item.id===section);
  const common={API_URL:'/api',currentUser:data.user,stations:data.stations,
    refreshStations:reload,refreshGlobalAds:()=>{}};
  const views={
    analytics:<AdminDashboard {...common}/>,users:<AdminUsers {...common}/>,
    ads:<AdminAds {...common}/>,banners:<AdminBanners {...common}/>,
    slides:<AdminHomeSlides {...common}/>,newsfeed:<AdminNewsFeed {...common}/>,promoted:<AdminPromotedStations stations={data.stations}/>,
    emails:<AdminEmails {...common}/>,
    billing:<AdminPaid {...common}/>,radioset:<AdminRadioSet {...common}/>,
    adcontrol:<AdminAdControl {...common}/>,boost:<Boost {...common}/>,
    push:<NewPush {...common}/>
  };
  if(!current)return <Navigate to="/backoffice/admin" replace/>;
  const related=ADMIN_TOOLS.filter(item=>item.group===current.group);
  return <div className="ir-admin-workspace">
    <div className="mb-6">
      <Link to="/backoffice/admin" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-[#caff00]">
        <ArrowLeft size={15}/> Όλα τα εργαλεία Admin</Link>
    </div>
    <SectionTitle eyebrow={'Admin / '+current.group} title={current.name}
      description={current.desc+'. Οι λειτουργίες παραμένουν διαθέσιμες μόνο σε διαχειριστές.'}/>
    <nav aria-label="Σχετικά εργαλεία" className="mb-6 flex flex-wrap gap-2">
      {related.map(item=><NavLink key={item.id} to={'/backoffice/admin/'+item.id}
        className={({isActive})=>(isActive?
          'bg-[#caff00] text-[#131800]':'border border-white/10 bg-white/[.035] text-zinc-300 hover:border-[#caff00]/40')+
          ' inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold'}>
        <item.icon size={15}/>{item.name}</NavLink>)}
      <Link to="/backoffice/admin" className={buttonSecondary+' !py-2'}><LayoutDashboard size={15}/> Όλα</Link>
    </nav>
    <AdminGuide section={section}/>
    <div className="min-w-0">
      <AdminToolErrorBoundary key={section}>
        <Suspense fallback={<div className={panel+' p-10 text-center text-[#caff00]'}>
          <RefreshCw size={20} className="mx-auto mb-3 animate-spin"/>Φόρτωση εργαλείου…</div>}>
          {views[section]}
        </Suspense>
      </AdminToolErrorBoundary>
    </div>
  </div>;
}
export default function Backoffice(){
  const location=useLocation(),navigate=useNavigate();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(null);
  const [notice,setNotice]=useState(null),[sidebarOpen,setSidebarOpen]=useState(false);
  const [deleteTarget,setDeleteTarget]=useState(null);
  const requestDelete=useCallback(station=>setDeleteTarget(station),[]);
  const closeDelete=useCallback(()=>setDeleteTarget(null),[]);
  const [navFilter,setNavFilter]=useState('');
  const notify=useCallback((message,type='success')=>{
    setNotice({message,type});
  },[]);
  const reload=useCallback(async()=>{
    const next=await api('/overview');
    setData(next);return next;
  },[]);
  useEffect(()=>{
    let alive=true;
    setLoading(true);
    reload().then(next=>{if(alive){setData(next);setError(null);}})
      .catch(err=>{if(alive)setError(err);})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[reload]);
  useEffect(()=>{setSidebarOpen(false);setNotice(null);setNavFilter('');},[location.pathname]);
  const admin=data?.user.role==='admin',producer=data?.user.role==='producer';
  const logout=()=>{localStorage.removeItem('iluma_token');window.location.assign('/login');};
  const nav=[
    {section:'Ο ΧΩΡΟΣ ΜΟΥ',items:[
      {to:'/backoffice',label:'Αρχική',icon:LayoutDashboard,end:true},
      {to:'/backoffice/stations',label:admin?'Σταθμοί δικτύου':'Οι σταθμοί μου',icon:Radio},
      ...(admin?[{to:'/backoffice/admin/promoted',label:'Promoted Stations',icon:Sparkles}]:[]),
      {to:'/backoffice/schedules',label:'Πρόγραμμα εκπομπών',icon:CalendarDays},
      ...(!admin?[{to:'/backoffice/insights',label:'Στατιστικά σταθμών',icon:BarChart3}]:[]),
      ...(data?.user.role==='broadcaster'?[{to:'/backoffice/team',label:'Παραγωγοί & ομάδα',icon:Users}]:[]),
      ...(!producer?[{to:'/backoffice/stations/new',label:'Προσθήκη σταθμού',icon:Plus}]:[])
    ]},
    ...(admin?[
      {section:'ΔΙΑΧΕΙΡΙΣΗ',items:[
        {to:'/backoffice/admin',label:'Όλα τα εργαλεία',icon:LayoutDashboard,end:true},
        {to:'/backoffice/review',label:'Εγκρίσεις',icon:FileCheck2},
        {to:'/backoffice/admin/analytics',label:'Αναλύσεις',icon:BarChart3},
        {to:'/backoffice/admin/users',label:'Χρήστες & ρόλοι',icon:Users},
        {to:'/backoffice/admin/radioset',label:'Αναθέσεις σταθμών',icon:Radio},
        {to:'/backoffice/admin/boost',label:'Προβολή σταθμών',icon:Sparkles},
        {to:'/backoffice/admin/promoted',label:'Promoted Stations',icon:Sparkles}
      ]},
      {section:'ΔΙΑΦΗΜΙΣΕΙΣ',items:[
        {to:'/backoffice/admin/ads',label:'Audio διαφημίσεις',icon:Activity},
        {to:'/backoffice/admin/banners',label:'Banners',icon:Image},
        {to:'/backoffice/admin/adcontrol',label:'Τοπικές διαφημίσεις',icon:SlidersHorizontal}
      ]},
      {section:'ΠΕΡΙΕΧΟΜΕΝΟ & ΛΕΙΤΟΥΡΓΙΑ',items:[
        {to:'/backoffice/admin/slides',label:'Slides & καμπάνιες',icon:Sparkles},
        {to:'/backoffice/admin/newsfeed',label:'Newsfeed RSS',icon:Image},
        {to:'/backoffice/admin/push',label:'Push ειδοποιήσεις',icon:Bell},
        {to:'/backoffice/admin/emails',label:'Emails',icon:Globe2},
        {to:'/backoffice/admin/billing',label:'Πληρωμές',icon:FileCheck2}
      ]}
    ]:[])
  ];
  if(loading)return <div className="flex min-h-screen items-center justify-center bg-[#080a0b] text-[#caff00]">
    <RefreshCw className="animate-spin" size={28}/><span className="ml-3 text-sm font-black">iRadios Business Console</span></div>;
  if(error){
    if(error.status===409||error.code==='BROADCASTER_TERMS')return <AuthGate title="Όροι Broadcaster"
      description="Για να συνεχίσεις στο Backoffice, πρέπει να αποδεχτείς την ισχύουσα έκδοση των όρων συνεργασίας."
      href="/broadcaster-terms" label="Προβολή όρων"/>;
    return <AuthGate title={error.status===401?'Ασφαλής σύνδεση':'Δεν είναι διαθέσιμο το Backoffice'}
      description={error.status===401?'Συνδέσου με λογαριασμό Admin, Broadcaster ή Producer.':
        error.status===403?'Δεν έχεις δικαίωμα πρόσβασης σε αυτόν τον χώρο.':error.message}
      href={error.status===403?'/':'/login'}
      label={error.status===403?'Επιστροφή στο iRadios':'Σύνδεση'}/>;
  }
  return <div className="flex min-h-screen bg-[#090b0d] font-sans text-white">
    <Helmet><title>iRadiosGR Business Console | Backoffice</title><meta name="robots" content="noindex,nofollow"/></Helmet>
    {sidebarOpen&&<button onClick={()=>setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/80 lg:hidden" aria-label="Κλείσιμο μενού"/>}
    <aside className={'fixed inset-y-0 left-0 z-50 flex w-[272px] shrink-0 flex-col overflow-y-auto border-r border-white/[.08] bg-[#0e1112] p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 '+(sidebarOpen?'translate-x-0':'-translate-x-full')}>
      <Link to="/backoffice" onClick={()=>setSidebarOpen(false)} className="mb-9 block px-2 pt-3"><Logo/></Link>
      <div className="mb-8 rounded-2xl border border-[#caff00]/15 bg-[#caff00]/[.045] p-4">
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#caff00] shadow-[0_0_12px_#caff00]"/>
          <span className="text-[10px] font-black uppercase tracking-[.13em] text-[#caff00]">Private workspace</span></div>
        <p className="mt-3 truncate text-sm font-black text-white">{data.user.fname||data.user.username||roleLabels[data.user.role]}</p>
        <p className="mt-1 text-[11px] text-zinc-500">{roleLabels[data.user.role]}</p>
      </div>
      {admin&&<label className="relative mb-5 block">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
        <input aria-label="Αναζήτηση στο μενού" placeholder="Αναζήτηση εργαλείου…"
          value={navFilter} onChange={e=>setNavFilter(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#090b0d] py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-[#caff00]/50"/>
      </label>}
      <nav className="flex-1 space-y-7">{nav.map(group=>{
        const items=group.items.filter(item=>item.label.toLocaleLowerCase('el')
          .includes(navFilter.toLocaleLowerCase('el')));
        if(!items.length)return null;
        return <div key={group.section}>
        <p className="mb-3 px-4 text-[9px] font-black tracking-[.24em] text-zinc-600">{group.section}</p>
        <div className="space-y-1">{items.map(item=><NavItem key={item.to} {...item} close={()=>setSidebarOpen(false)}/>)}</div></div>;})}</nav>
      <div className="mt-7 space-y-2 border-t border-white/10 pt-5">
        <a href="/" className="flex items-center gap-3 rounded-xl px-4 py-3 text-[12px] font-bold text-zinc-400 hover:bg-white/5 hover:text-white"><ExternalLink size={17}/> Άνοιγμα iRadios App</a>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[12px] font-bold text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300"><LogOut size={17}/> Αποσύνδεση</button>
      </div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex h-[75px] items-center justify-between border-b border-white/[.075] bg-[#090b0d]/95 px-5 backdrop-blur-xl md:px-9">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={()=>setSidebarOpen(v=>!v)} aria-label="Μενού" className="rounded-xl border border-white/10 p-2.5 text-zinc-400 lg:hidden"><Menu size={19}/></button>
          <div><p className="text-[9px] font-black uppercase tracking-[.24em] text-zinc-600">IRADIOS / BACKOFFICE</p>
            <p className="mt-1 truncate text-sm font-black text-white">{admin?'Network Control':producer?'Producer Workspace':'Broadcaster Portal'}</p></div>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="lime"><span className="size-1.5 rounded-full bg-[#caff00]"/> STAGING</Badge>
          <div className="hidden text-right sm:block"><p className="max-w-44 truncate text-xs font-bold text-white">{data.user.email}</p>
            <p className="mt-1 text-[10px] text-zinc-500">{roleLabels[data.user.role]}</p></div>
          <div className="flex size-9 items-center justify-center rounded-full border border-[#caff00]/20 bg-[#caff00]/10 font-black text-[#caff00]">{(data.user.fname||data.user.username||'I')[0]?.toUpperCase()}</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1500px] px-5 pb-24 pt-8 md:px-9 md:pt-10">
        {notice&&<div role="status" className={'mb-6 flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-[12px] '+(notice.type==='error'?
          'border-rose-400/20 bg-rose-400/[.07] text-rose-200':'border-[#caff00]/25 bg-[#caff00]/[.06] text-[#d7ff88]')}>
          <div className="flex items-center gap-2"><CheckCircle2 size={16}/>{notice.message}</div>
          <button aria-label="Κλείσιμο ειδοποίησης" onClick={()=>setNotice(null)}><X size={16}/></button>
        </div>}
        <Routes>
          <Route path="/backoffice" element={<Dashboard data={data}/>}/>
          <Route path="/backoffice/stations" element={<Stations data={data} requestDelete={requestDelete}/>}/>
          <Route path="/backoffice/stations/new" element={<StationEditor data={data} reload={reload} notify={notify} requestDelete={requestDelete}/>}/>
          <Route path="/backoffice/stations/:id/edit" element={<StationEditor data={data} reload={reload} notify={notify} requestDelete={requestDelete}/>}/>
          <Route path="/backoffice/schedules" element={<Scheduler data={data} reload={reload} notify={notify}/>}/>
          <Route path="/backoffice/insights" element={<BroadcasterInsights data={data}/>}/>
          <Route path="/backoffice/team" element={<Team data={data} notify={notify}/>}/>
          <Route path="/backoffice/review" element={<Review data={data} reload={reload} notify={notify} requestDelete={requestDelete}/>}/>
          <Route path="/backoffice/admin" element={<AdminWorkspace data={data}/>}/>
          {['analytics','users','ads','banners','slides','newsfeed','promoted','emails','billing','radioset','boost','adcontrol','push'].map(section=>
            <Route key={section} path={'/backoffice/admin/'+section} element={<Operations data={data} section={section} reload={reload}/>}/>)}
          <Route path="/backoffice/*" element={<Navigate to="/backoffice" replace/>}/>
        </Routes>
        {admin&&<DeleteStationDialog station={deleteTarget} onClose={closeDelete}
          onDeleted={async()=>{await reload();navigate('/backoffice/stations');}} notify={notify}/>}
      </main>
      <footer className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-6 text-[10px] text-zinc-600 md:px-9">
        <span>© 2026 iRadiosGR · Powered by ILUMA</span><span>PRIVATE BUSINESS CONSOLE · SECURE ROLE ACCESS</span>
      </footer>
    </div>
  </div>;
}
