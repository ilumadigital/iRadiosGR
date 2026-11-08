import React, {useCallback,useEffect,useMemo,useState,Suspense,lazy} from 'react';
import {Link,NavLink,Routes,Route,Navigate,useLocation,useNavigate,useParams} from 'react-router-dom';
import {Helmet} from 'react-helmet-async';
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
const AdminEmails=lazy(()=>import('./AdminEmails'));
const AdminPaid=lazy(()=>import('./AdminPaid'));
const AdminRadioSet=lazy(()=>import('./AdminRadioSet'));
const AdminAdControl=lazy(()=>import('./AdminAdControl'));
const Boost=lazy(()=>import('./Boost'));
const NewPush=lazy(()=>import('./NewPush'));
const DAY_NAMES=['','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'];
const EDIT_FIELDS=['name','slogan','description','genre','transmissionType','frequency',
  'region','city','website','email','phone','stream','metadata','facebook','instagram',
  'twitter','tiktok','explicit'];
const BLANK={name:'',slogan:'',description:'',genre:'',transmissionType:'Web Radio',
  frequency:'',region:'',city:'',website:'',email:'',phone:'',stream:'',metadata:'',
  facebook:'',instagram:'',twitter:'',tiktok:'',explicit:false};
const panel='rounded-[26px] border border-white/[0.075] bg-[#111418] shadow-[0_22px_90px_rgba(0,0,0,0.14)]';
const inputClass='w-full rounded-xl border border-white/10 bg-[#090b0d] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-[#caff00]/70 focus:ring-2 focus:ring-[#caff00]/10';
const buttonPrimary='inline-flex items-center justify-center gap-2 rounded-xl bg-[#caff00] px-5 py-3 text-[12px] font-black uppercase tracking-[.08em] text-[#101300] shadow-[0_8px_26px_rgba(202,255,0,.18)] transition hover:bg-[#e5ff83] disabled:opacity-50';
const buttonSecondary='inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-[12px] font-bold text-zinc-200 transition hover:border-white/25 hover:bg-white/[.09]';
const roleLabels={admin:'Administrator',broadcaster:'Broadcaster',producer:'Producer'};
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
function StationCard({station,role}){
  const to=role==='producer'?'/backoffice/schedules':'/backoffice/stations/'+station._id+'/edit';
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
    <Link to={to} className={buttonSecondary+' shrink-0'}>{role==='producer'?'Πρόγραμμα':'Διαχείριση'}<ArrowRight size={15}/></Link>
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
  const nextShows=stations.flatMap(station=>(station.schedule||[])
    .filter(show=>Number(show.day)===day&&show.endTime>currentTime)
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
          <p className="text-xs font-black text-[#caff00]">{show.startTime} – {show.endTime}</p>
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
function Stations({data}){
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
      aside={data.user.role!=='producer'&&<Link to="/backoffice/stations/new" className={buttonPrimary}><Plus size={17}/> Νέος σταθμός</Link>}/>
    <div className={panel+' mb-5 flex flex-wrap gap-3 p-4'}>
      <div className="relative min-w-[200px] flex-1"><Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"/>
        <input className={inputClass+' pl-11'} placeholder="Αναζήτηση σταθμού ή κατηγορίας…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <select className={inputClass+' max-w-52'} value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="all">Όλες οι καταστάσεις</option><option value="approved">Ενεργοί</option>
        <option value="pending">Προς έγκριση</option><option value="pendingEdits">Αλλαγές σε αναμονή</option>
      </select>
    </div>
    <p className="mb-4 text-xs font-semibold text-zinc-500">{filtered.length} σταθμοί</p>
    <div className="space-y-3">{filtered.length?filtered.map(s=><StationCard key={s._id} station={s} role={data.user.role}/>):
      <div className={panel+' p-12 text-center text-zinc-500'}>Δεν βρέθηκαν σταθμοί με αυτά τα κριτήρια.</div>}</div>
  </div>;
}
function StationEditor({data,reload,notify}){
  const {id}=useParams(),navigate=useNavigate();
  const isNew=id===undefined;
  const station=data.stations.find(s=>String(s._id)===String(id));
  const isAdmin=data.user.role==='admin';
  const [form,setForm]=useState(BLANK),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(''),[dirty,setDirty]=useState(false);
  useEffect(()=>{
    const origin=isNew?BLANK:{...BLANK,...station,...(station?.pendingEdits||{})};
    setForm(Object.fromEntries(EDIT_FIELDS.map(k=>[k,origin[k]??BLANK[k]])));
    setDirty(false);
  },[id,isNew,station?._id]); // Refresh by changing station id. Explicit reset after save.
  const update=(field,value)=>{setForm(prev=>({...prev,[field]:value}));setDirty(true);};
  async function save(e){
    e.preventDefault();setBusy(true);
    try{
      const payload=isNew?Object.fromEntries(['name','slogan','description','genre','stream',
        'transmissionType','region','city'].map(k=>[k,form[k]])):form;
      const result=await api(isNew?'/stations':'/stations/'+station._id,
        {method:isNew?'POST':'PATCH',body:JSON.stringify(payload)});
      notify(result.message||'Αποθηκεύτηκε.');setDirty(false);await reload();
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
    }catch(error){notify(error.message,'error');}finally{setUploading('');}
  }
  if(data.user.role==='producer')return <Navigate to="/backoffice/schedules" replace/>;
  if(!isNew&&!station)return <AuthGate title="Ο σταθμός δεν βρέθηκε" description="Δεν έχεις δικαίωμα πρόσβασης σε αυτόν τον σταθμό." href="/backoffice/stations" label="Πίσω στους σταθμούς"/>;
  const actionTitle=isNew?'Νέος σταθμός':'Επεξεργασία σταθμού';
  return <div>
    <div className="mb-6"><Link to="/backoffice/stations" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white"><ArrowLeft size={15}/> Όλοι οι σταθμοί</Link></div>
    <SectionTitle eyebrow={isAdmin?'iRadios Network / Admin':'iRadios Broadcasters'}
      title={actionTitle} description={isAdmin?'Οι αλλαγές σου δημοσιεύονται αμέσως.':
        'Οι αλλαγές προφίλ υποβάλλονται για έγκριση από την ομάδα iRadios.'}
      aside={!isNew&&<StationStatus station={station}/>}/>
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
            <Field label="Μουσική κατηγορία *"><input required maxLength={100} className={inputClass} placeholder="π.χ. Dance & Electronic" value={form.genre} onChange={e=>update('genre',e.target.value)}/></Field>
            <Field label="Slogan" wide><input maxLength={240} className={inputClass} placeholder="Η μουσική σου, ο κόσμος σου." value={form.slogan} onChange={e=>update('slogan',e.target.value)}/></Field>
            <Field label="Περιγραφή" wide><textarea rows={4} maxLength={4000} className={inputClass+' resize-y'} value={form.description} onChange={e=>update('description',e.target.value)}/></Field>
            <Field label="Τύπος μετάδοσης"><select className={inputClass} value={form.transmissionType} onChange={e=>update('transmissionType',e.target.value)}>
              <option>Web Radio</option><option>Επίγειο</option><option>DAB</option></select></Field>
            <Field label="Συχνότητα (αν υπάρχει)"><input className={inputClass} maxLength={30} placeholder="π.χ. 96.3" value={form.frequency} onChange={e=>update('frequency',e.target.value)}/></Field>
            <Field label="Περιφέρεια"><input className={inputClass} maxLength={100} value={form.region} onChange={e=>update('region',e.target.value)}/></Field>
            <Field label="Πόλη"><input className={inputClass} maxLength={100} value={form.city} onChange={e=>update('city',e.target.value)}/></Field>
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
        {!isNew&&<section className={panel+' p-5 md:p-7'}>
          <div className="mb-6 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#caff00]/10 text-[#caff00]"><Globe2 size={19}/></div>
            <div><h3 className="text-lg font-black text-white">Επικοινωνία & Social</h3><p className="text-xs text-zinc-500">Δεσμοί που βλέπει ο ακροατής στο προφίλ</p></div></div>
          <div className="grid gap-5 md:grid-cols-2">
            {[
              ['website','Website URL'],['email','Δημόσιο email'],['phone','Τηλέφωνο'],
              ['facebook','Facebook URL'],['instagram','Instagram URL'],
              ['twitter','X / Twitter URL'],['tiktok','TikTok URL']
            ].map(([key,label])=><Field key={key} label={label}>
              <input className={inputClass} type={key==='email'?'email':'text'} maxLength={key==='email'?254:450}
                value={form[key]} onChange={e=>update(key,e.target.value)}/></Field>)}
          </div>
        </section>}
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
            <p className="mt-2 text-xs text-zinc-400">{form.genre||'Μουσική κατηγορία'}</p>
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
  const [selected,setSelected]=useState(data.stations[0]?._id||'');
  const station=data.stations.find(s=>String(s._id)===String(selected));
  const [schedule,setSchedule]=useState([]);
  const [activeDay,setActiveDay]=useState(1);
  const [copyTarget,setCopyTarget]=useState('2');
  const [saving,setSaving]=useState(false),[dirty,setDirty]=useState(false);
  useEffect(()=>{
    setSchedule((station?.schedule||[]).map(s=>({
      day:Number(s.day),startTime:s.startTime,endTime:s.endTime,title:s.title,host:s.host||''
    })));
    setDirty(false);
  },[station?._id]);
  useEffect(()=>{
    if(!dirty)return;
    const preventLeave=e=>{e.preventDefault();e.returnValue='';};
    window.addEventListener('beforeunload',preventLeave);
    return ()=>window.removeEventListener('beforeunload',preventLeave);
  },[dirty]);
  const updateSchedule=callback=>{
    setSchedule(previous=>callback(previous));
    setDirty(true);
  };
  const errors=useMemo(()=>{
    const found={};
    if(schedule.length>80)found.limit='Το πρόγραμμα δέχεται έως 80 εκπομπές.';
    schedule.forEach((show,index)=>{
      if(!show.title.trim())found[index]='Συμπλήρωσε τίτλο εκπομπής.';
      else if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(show.startTime)||
        !/^([01]\\d|2[0-3]):[0-5]\\d$/.test(show.endTime)||
        show.startTime>=show.endTime)found[index]='Η ώρα λήξης πρέπει να είναι μετά την έναρξη.';
    });
    for(let day=1;day<=7;day++){
      const daily=schedule.map((show,index)=>({...show,index}))
        .filter(show=>show.day===day).sort((a,b)=>a.startTime.localeCompare(b.startTime));
      for(let i=1;i<daily.length;i++){
        if(daily[i].startTime<daily[i-1].endTime){
          found[daily[i].index]='Επικάλυψη με άλλη εκπομπή της ημέρας.';
          found[daily[i-1].index]='Επικάλυψη με άλλη εκπομπή της ημέρας.';
        }
      }
    }
    return found;
  },[schedule]);
  const dailyShows=schedule.map((show,index)=>({...show,index}))
    .filter(show=>show.day===activeDay).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  const add=()=>{
    if(schedule.length>=80){notify('Το πρόγραμμα υποστηρίζει έως 80 εκπομπές.','error');return;}
    const last=dailyShows[dailyShows.length-1];
    const startTime=last&&last.endTime<'22:00'?last.endTime:'10:00';
    const hour=Number(startTime.slice(0,2));
    const endTime=String(Math.min(hour+1,23)).padStart(2,'0')+':'+startTime.slice(3);
    updateSchedule(previous=>[...previous,{day:activeDay,startTime,endTime,title:'',host:''}]);
  };
  const edit=(index,key,value)=>updateSchedule(previous=>previous.map((s,j)=>
    j===index?{...s,[key]:value}:s));
  const remove=index=>updateSchedule(previous=>previous.filter((_,j)=>j!==index));
  const duplicate=show=>{
    if(schedule.length>=80){notify('Το πρόγραμμα υποστηρίζει έως 80 εκπομπές.','error');return;}
    const startTime=show.endTime<'22:00'?show.endTime:show.startTime;
    const endHour=Number(startTime.slice(0,2))+1;
    const endTime=String(Math.min(endHour,23)).padStart(2,'0')+':'+startTime.slice(3);
    updateSchedule(previous=>[...previous,{
      day:activeDay,startTime,endTime,title:show.title,host:show.host
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
    if(schedule.length-existing.length+source.length>80){
      notify('Το πρόγραμμα υποστηρίζει έως 80 εκπομπές.','error');return;
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
  async function save(){
    if(!station||saving||!dirty)return;
    if(Object.keys(errors).length){
      notify('Διόρθωσε τα επισημασμένα πεδία και τις επικαλύψεις πριν αποθηκεύσεις.','error');
      return;
    }
    setSaving(true);
    try{
      const result=await api('/stations/'+station._id+'/schedule',{
        method:'PUT',body:JSON.stringify({schedule:schedule.map(({day,startTime,endTime,title,host})=>
          ({day,startTime,endTime,title:title.trim(),host:host.trim()}))})
      });
      setDirty(false);
      notify(result.message||'Το πρόγραμμα αποθηκεύτηκε.');
      await reload();
    }catch(error){notify(error.message,'error');}finally{setSaving(false);}
  }
  const countDay=day=>schedule.filter(show=>show.day===day).length;
  const totalErrors=Object.keys(errors).length;
  return <div>
    <SectionTitle eyebrow="Εύκολο πρόγραμμα" title="Οργάνωσε τις εκπομπές σου."
      description="Διάλεξε ημέρα, πρόσθεσε εκπομπή και αποθήκευσε. Ισχύει για όλους τους ρόλους με πρόσβαση στο πρόγραμμα."
      aside={<div className="flex flex-wrap items-center gap-3">
        {dirty&&<Badge tone="amber">Μη αποθηκευμένες αλλαγές</Badge>}
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
        <Badge tone="lime">{schedule.length} εκπομπές / εβδομάδα</Badge>
        <Badge tone={totalErrors?'rose':'neutral'}>{totalErrors?totalErrors+' προβλήματα':'Χωρίς συγκρούσεις'}</Badge>
      </div>
    </div>
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
function Review({data,reload,notify}){
  if(data.user.role!=='admin')return <Navigate to="/backoffice" replace/>;
  const changed=data.stations.filter(s=>s.pendingEdits&&Object.keys(s.pendingEdits).length);
  const newStations=data.stations.filter(s=>s.status==='pending');
  const [busy,setBusy]=useState('');
  const work=async(s,action,isApproval=false)=>{
    setBusy(s._id);
    try{const response=await api('/stations/'+s._id+(isApproval?'/approve':'/review'),
      {method:'POST',body:JSON.stringify({action})});notify(response.message);await reload();}
    catch(error){notify(error.message,'error');}
    finally{setBusy('');}
  };
  return <div><SectionTitle eyebrow="Moderation queue" title="Εγκρίσεις με ένα κλικ."
    description="Τα νέα αιτήματα εμφανίζονται συγκεντρωμένα. Κάθε αλλαγή broadcaster περνά από έλεγχο."/>
    <div className="space-y-8">
      <section><h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Clock3 size={19} className="text-[#caff00]"/> Αιτήματα αλλαγών <Badge tone="amber">{changed.length}</Badge></h3>
        <div className="space-y-3">{changed.length?changed.map(s=><div key={s._id} className={panel+' p-5'}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h4 className="font-black text-white">{s.name}</h4>
              <p className="mt-1 text-[11px] text-zinc-500">Πεδία: {Object.keys(s.pendingEdits).join(', ')}</p></div>
            <div className="flex flex-wrap gap-2">
              <Link to={'/backoffice/stations/'+s._id+'/edit'} className={buttonSecondary}>Προβολή <ArrowRight size={13}/></Link>
              <button className={buttonSecondary+' text-rose-300'} disabled={Boolean(busy)} onClick={()=>work(s,'reject')}>Απόρριψη</button>
              <button className={buttonPrimary} disabled={Boolean(busy)} onClick={()=>work(s,'approve')}><Check size={15}/> Έγκριση</button>
            </div></div></div>):<div className={panel+' p-7 text-sm text-zinc-500'}>Δεν υπάρχουν αλλαγές σε αναμονή.</div>}</div>
      </section>
      <section><h3 className="mb-4 flex items-center gap-2 text-lg font-black text-white"><Radio size={19} className="text-[#caff00]"/> Νέοι σταθμοί <Badge tone="amber">{newStations.length}</Badge></h3>
        <div className="space-y-3">{newStations.length?newStations.map(s=><div key={s._id} className={panel+' flex flex-wrap items-center justify-between gap-4 p-5'}>
          <div><p className="font-black text-white">{s.name}</p><p className="mt-1 text-xs text-zinc-500">{s.genre} · {s.city}</p></div>
          <div className="flex gap-2"><Link className={buttonSecondary} to={'/backoffice/stations/'+s._id+'/edit'}>Έλεγχος <ArrowRight size={14}/></Link>
            <button onClick={()=>work(s,'approve',true)} disabled={Boolean(busy)} className={buttonPrimary}>Έγκριση σταθμού</button></div>
        </div>):<div className={panel+' p-7 text-sm text-zinc-500'}>Δεν υπάρχουν νέοι σταθμοί προς έγκριση.</div>}</div>
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
  {id:'ads',name:'Audio διαφημίσεις',desc:'Διαχείριση ηχητικών καμπανιών',icon:Activity,group:'Διαφημίσεις'},
  {id:'banners',name:'Banners',desc:'Οπτικές διαφημίσεις και θέσεις',icon:Image,group:'Διαφημίσεις'},
  {id:'adcontrol',name:'Τοπικές διαφημίσεις',desc:'Ρυθμίσεις διαφημίσεων ανά σταθμό',icon:SlidersHorizontal,group:'Διαφημίσεις'},
  {id:'slides',name:'Slides αρχικής',desc:'Προβολές και περιεχόμενο αρχικής',icon:LayoutDashboard,group:'Περιεχόμενο'},
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
function Operations({data,section,reload}){
  if(data.user.role!=='admin')return <Navigate to="/backoffice" replace/>;
  const current=ADMIN_TOOLS.find(item=>item.id===section);
  const common={API_URL:'/api',currentUser:data.user,stations:data.stations,
    refreshStations:reload,refreshGlobalAds:()=>{}};
  const views={
    analytics:<AdminDashboard {...common}/>,users:<AdminUsers {...common}/>,
    ads:<AdminAds {...common}/>,banners:<AdminBanners {...common}/>,
    slides:<AdminHomeSlides {...common}/>,emails:<AdminEmails {...common}/>,
    billing:<AdminPaid {...common}/>,radioset:<AdminRadioSet {...common}/>,
    adcontrol:<AdminAdControl {...common}/>,boost:<Boost {...common}/>,
    push:<NewPush {...common}/>
  };
  if(!current)return <Navigate to="/backoffice/admin" replace/>;
  const related=ADMIN_TOOLS.filter(item=>item.group===current.group);
  return <div>
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
          ' inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold'}>
        <item.icon size={15}/>{item.name}</NavLink>)}
      <Link to="/backoffice/admin" className={buttonSecondary+' !py-2'}><LayoutDashboard size={15}/> Όλα</Link>
    </nav>
    <div className="min-w-0">
      <Suspense fallback={<div className={panel+' p-10 text-center text-[#caff00]'}>
        <RefreshCw size={20} className="mx-auto mb-3 animate-spin"/>Φόρτωση εργαλείου…</div>}>
        {views[section]}
      </Suspense>
    </div>
  </div>;
}
export default function Backoffice(){
  const location=useLocation(),navigate=useNavigate();
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(null);
  const [notice,setNotice]=useState(null),[sidebarOpen,setSidebarOpen]=useState(false);
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
  useEffect(()=>{setSidebarOpen(false);setNotice(null);},[location.pathname]);
  const admin=data?.user.role==='admin',producer=data?.user.role==='producer';
  const logout=()=>{localStorage.removeItem('iluma_token');window.location.assign('/login');};
  const nav=[
    {section:'WORKSPACE',items:[{to:'/backoffice',label:'Επισκόπηση',icon:LayoutDashboard,end:true},
      {to:'/backoffice/stations',label:admin?'Δίκτυο σταθμών':'Οι σταθμοί μου',icon:Radio},
      {to:'/backoffice/schedules',label:'Πρόγραμμα εκπομπών',icon:CalendarDays},
      ...(!admin?[{to:'/backoffice/insights',label:'Insights σταθμών',icon:BarChart3}]:[]),
      ...(data?.user.role==='broadcaster'?[{to:'/backoffice/team',label:'Παραγωγοί & ομάδα',icon:Users}]:[]),
      ...(!producer?[{to:'/backoffice/stations/new',label:'Προσθήκη σταθμού',icon:Plus}]:[])]},
    ...(admin?[{section:'ADMIN CONTROL',items:[
      {to:'/backoffice/review',label:'Εγκρίσεις',icon:FileCheck2},
      {to:'/backoffice/admin/analytics',label:'Αναλύσεις',icon:BarChart3},
      {to:'/backoffice/admin/users',label:'Χρήστες & ρόλοι',icon:Users},
      {to:'/backoffice/admin/ads',label:'Διαφημίσεις',icon:Activity},
      {to:'/backoffice/admin/banners',label:'Banners',icon:Image},
      {to:'/backoffice/admin/slides',label:'Slides αρχικής',icon:Sparkles},
      {to:'/backoffice/admin/radioset',label:'Radio Set',icon:SlidersHorizontal},
      {to:'/backoffice/admin/boost',label:'Boost σταθμών',icon:Sparkles},
      {to:'/backoffice/admin/adcontrol',label:'Local Ad Control',icon:Activity},
      {to:'/backoffice/admin/push',label:'Push ειδοποιήσεις',icon:Bell},
      {to:'/backoffice/admin/billing',label:'Πληρωμές',icon:FileCheck2},
      {to:'/backoffice/admin/emails',label:'Emails',icon:Bell}
    ]}]:[])
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
      <nav className="flex-1 space-y-7">{nav.map(group=><div key={group.section}>
        <p className="mb-3 px-4 text-[9px] font-black tracking-[.24em] text-zinc-600">{group.section}</p>
        <div className="space-y-1">{group.items.map(item=><NavItem key={item.to} {...item} close={()=>setSidebarOpen(false)}/>)}</div></div>)}</nav>
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
          <Route path="/backoffice/stations" element={<Stations data={data}/>}/>
          <Route path="/backoffice/stations/new" element={<StationEditor data={data} reload={reload} notify={notify}/>}/>
          <Route path="/backoffice/stations/:id/edit" element={<StationEditor data={data} reload={reload} notify={notify}/>}/>
          <Route path="/backoffice/schedules" element={<Scheduler data={data} reload={reload} notify={notify}/>}/>
          <Route path="/backoffice/insights" element={<BroadcasterInsights data={data}/>}/>
          <Route path="/backoffice/team" element={<Team data={data} notify={notify}/>}/>
          <Route path="/backoffice/review" element={<Review data={data} reload={reload} notify={notify}/>}/>
          {['analytics','users','ads','banners','slides','emails','billing','radioset','boost','adcontrol','push'].map(section=>
            <Route key={section} path={'/backoffice/admin/'+section} element={<Operations data={data} section={section} reload={reload}/>}/>)}
          <Route path="/backoffice/*" element={<Navigate to="/backoffice" replace/>}/>
        </Routes>
      </main>
      <footer className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-6 text-[10px] text-zinc-600 md:px-9">
        <span>© 2026 iRadiosGR · Powered by ILUMA</span><span>PRIVATE BUSINESS CONSOLE · SECURE ROLE ACCESS</span>
      </footer>
    </div>
  </div>;
}
