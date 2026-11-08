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
  const recent=[...stations].sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,4);
  const cards=[
    {to:'/backoffice/stations',icon:Radio,name:'Ραδιοφωνικοί σταθμοί',desc:'Όλοι οι σταθμοί, οι πληροφορίες και τα stream σου.',number:'01'},
    {to:'/backoffice/schedules',icon:CalendarDays,name:'Πρόγραμμα εκπομπών',desc:'Οργάνωσε το εβδομαδιαίο πρόγραμμα και τους παραγωγούς.',number:'02'},
    ...(admin?[{to:'/backoffice/review',icon:FileCheck2,name:'Εγκρίσεις σταθμών',desc:'Έλεγξε αιτήματα και αλλαγές με ένα κλικ.',number:'03'},
      {to:'/backoffice/admin/users',icon:Users,name:'Χρήστες & ρόλοι',desc:'Πρόσβαση, λογαριασμοί και διαχείριση.',number:'04'}]:[])
  ];
  return <div className="space-y-9">
    <div className="relative overflow-hidden rounded-[32px] border border-[#caff00]/15 bg-[#11181a] px-7 py-9 md:px-11 md:py-11">
      <div className="absolute -right-20 -top-32 size-96 rounded-full bg-[#caff00]/[.12] blur-[95px]"/>
      <div className="absolute bottom-0 right-0 hidden text-[#caff00]/[.055] md:block"><Radio size={280} strokeWidth={.7}/></div>
      <div className="relative max-w-2xl">
        <Badge tone="lime"><Sparkles size={12}/> iRadios Business v6.1</Badge>
        <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-[-.075em] text-white md:text-6xl">
          Ο ήχος σου.<br/><span className="text-[#caff00]">Ο έλεγχός σου.</span></h1>
        <p className="mt-5 max-w-xl text-[14px] leading-7 text-zinc-300">
          {admin?'Το κέντρο ελέγχου ολόκληρου του δικτύου iRadios.':
            producer?'Ο χώρος σου για να οργανώνεις την παρουσία σου στον αέρα.':
              'Καλωσόρισες στο δικό σου broadcaster portal. Όλα τα ραδιόφωνά σου σε ένα μέρος.'}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/backoffice/stations" className={buttonPrimary}>Διαχείριση σταθμών<ArrowRight size={16}/></Link>
          {!producer&&<Link to={admin?'/backoffice/review':'/backoffice/stations/new'} className={buttonSecondary}>
            {admin?'Εκκρεμότητες':'Νέος σταθμός'}<ChevronRight size={16}/></Link>}
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
      <Metric icon={Radio} label="Σταθμοί" value={shortNumber(counts.total)} caption="Στο δικό σου επίπεδο πρόσβασης"/>
      <Metric icon={BadgeCheck} label="Ενεργοί" value={shortNumber(counts.approved)} caption="Εγκεκριμένοι σταθμοί"/>
      <Metric icon={Clock3} label="Αιτήματα αλλαγών" value={shortNumber(counts.pendingEdits)} caption="Αναμένουν διαχειριστή" rose/>
      <Metric icon={admin?Users:Headphones} label={admin?'Χρήστες δικτύου':'Συνολικές ακροάσεις'}
        value={shortNumber(admin?counts.users:stations.reduce((a,s)=>a+(s.plays||0),0))}
        caption={admin?'Εγγεγραμμένοι λογαριασμοί':'Μετρική καταλόγου, όχι live ακροατές'}/>
    </div>
    <div><SectionTitle eyebrow="Quick actions" title="Όλα στη θέση τους." description="Οι βασικές εργασίες χωρίς περιττά μενού."/>
      <div className="grid gap-3 md:grid-cols-2">{cards.map(c=><Link key={c.to} to={c.to}
        className={panel+' group flex items-center gap-5 p-5 transition hover:border-[#caff00]/30 hover:bg-[#151b19]'}>
        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#caff00]/10 bg-[#caff00]/[.07] text-[#caff00]"><c.icon size={25}/></div>
        <div className="min-w-0 flex-1"><h3 className="font-black text-white">{c.name}</h3>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{c.desc}</p></div>
        <ArrowRight size={18} className="shrink-0 text-zinc-500 transition group-hover:translate-x-1 group-hover:text-[#caff00]"/>
      </Link>)}</div></div>
    <div><SectionTitle eyebrow="Your network" title={admin?'Κορυφαίοι σταθμοί':'Οι σταθμοί σου'}
      aside={<Link to="/backoffice/stations" className={buttonSecondary}>Προβολή όλων <ArrowRight size={14}/></Link>}/>
      {recent.length?<div className="space-y-3">{recent.map(s=><StationCard key={s._id} station={s} role={user.role}/>)}</div>:
        <div className={panel+' p-10 text-center text-zinc-400'}>Δεν υπάρχουν ακόμη σταθμοί στον λογαριασμό.</div>}</div>
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
  const navigate=useNavigate();
  const [selected,setSelected]=useState(data.stations[0]?._id||'');
  const station=data.stations.find(s=>String(s._id)===String(selected));
  const [schedule,setSchedule]=useState([]);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{setSchedule((station?.schedule||[]).map(s=>({
    day:Number(s.day),startTime:s.startTime,endTime:s.endTime,title:s.title,host:s.host||''
  })));},[station?._id]);
  const add=()=>setSchedule(prev=>[...prev,{day:1,startTime:'10:00',endTime:'12:00',title:'',host:''}]);
  const edit=(i,key,value)=>setSchedule(prev=>prev.map((s,j)=>j===i?{...s,[key]:value}:s));
  const remove=i=>setSchedule(prev=>prev.filter((_,j)=>j!==i));
  async function save(){
    if(!station)return;
    setSaving(true);
    try{const result=await api('/stations/'+station._id+'/schedule',
      {method:'PUT',body:JSON.stringify({schedule})});
      notify(result.message);await reload();
    }catch(error){notify(error.message,'error');}
    finally{setSaving(false);}
  }
  return <div><SectionTitle eyebrow="On air programming" title="Εβδομαδιαίο πρόγραμμα."
    description="Πρόσθεσε εκπομπές, ώρες και παραγωγούς. Οι αλλαγές προγράμματος αποθηκεύονται απευθείας."
    aside={station&&<button onClick={save} disabled={saving} className={buttonPrimary}><Save size={16}/>{saving?'Αποθήκευση…':'Αποθήκευση προγράμματος'}</button>}/>
    <div className={panel+' mb-5 p-5'}><Field label="Επίλεξε σταθμό"><select className={inputClass} value={selected} onChange={e=>setSelected(e.target.value)}>
      {data.stations.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}</select></Field></div>
    {!station?<div className={panel+' p-12 text-center text-zinc-400'}>Δεν έχεις εκχωρημένο σταθμό.</div>:
      <div className="space-y-4">
        {schedule.map((show,i)=><div key={i} className={panel+' grid gap-3 p-4 md:grid-cols-[125px_108px_108px_minmax(0,1fr)_minmax(0,1fr)_40px] md:items-end'}>
          <Field label="Ημέρα"><select className={inputClass} value={show.day} onChange={e=>edit(i,'day',Number(e.target.value))}>{DAY_NAMES.slice(1).map((day,d)=><option key={day} value={d+1}>{day}</option>)}</select></Field>
          <Field label="Από"><input type="time" className={inputClass} value={show.startTime} onChange={e=>edit(i,'startTime',e.target.value)}/></Field>
          <Field label="Έως"><input type="time" className={inputClass} value={show.endTime} onChange={e=>edit(i,'endTime',e.target.value)}/></Field>
          <Field label="Τίτλος εκπομπής"><input required maxLength={120} className={inputClass} value={show.title} onChange={e=>edit(i,'title',e.target.value)}/></Field>
          <Field label="Παραγωγός"><input maxLength={100} className={inputClass} value={show.host} onChange={e=>edit(i,'host',e.target.value)}/></Field>
          <button type="button" onClick={()=>remove(i)} className="flex h-11 items-center justify-center rounded-xl border border-rose-400/15 text-rose-300 transition hover:bg-rose-400/10" title="Διαγραφή εκπομπής"><Trash2 size={16}/></button>
        </div>)}
        {!schedule.length&&<div className={panel+' p-12 text-center text-sm text-zinc-500'}>Δεν έχει καταχωρηθεί πρόγραμμα.</div>}
        <button onClick={add} className={buttonSecondary+' w-full border-dashed'}><Plus size={17}/> Προσθήκη εκπομπής</button>
        <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {DAY_NAMES.slice(1).map((day,d)=>{
            const shows=schedule.filter(x=>x.day===d+1).sort((a,b)=>a.startTime.localeCompare(b.startTime));
            return <div className={panel+' p-5'} key={day}><p className="mb-4 text-sm font-black text-white">{day}</p>
              {shows.length?shows.map((s,i)=><div key={i} className="mb-3 border-l-2 border-[#caff00] pl-3">
                <p className="text-[11px] font-extrabold text-[#caff00]">{s.startTime} – {s.endTime}</p>
                <p className="mt-1 text-[12px] font-bold text-white">{s.title||'Χωρίς τίτλο'}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{s.host}</p>
              </div>):<p className="text-xs text-zinc-600">Χωρίς εκπομπές</p>}
            </div>;
          })}
        </div>
      </div>}
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
function Operations({data,section,reload}){
  if(data.user.role!=='admin')return <Navigate to="/backoffice" replace/>;
  const common={API_URL:'/api',currentUser:data.user,stations:data.stations,refreshStations:reload,refreshGlobalAds:()=>{}};
  const views={
    analytics:<AdminDashboard {...common}/>,users:<AdminUsers {...common}/>,
    ads:<AdminAds {...common}/>,banners:<AdminBanners {...common}/>,
    slides:<AdminHomeSlides {...common}/>,emails:<AdminEmails {...common}/>,
    billing:<AdminPaid {...common}/>,radioset:<AdminRadioSet {...common}/>,
    adcontrol:<AdminAdControl {...common}/>,boost:<Boost {...common}/>,push:<NewPush {...common}/>
  };
  return <Suspense fallback={<div className={panel+' p-10 text-center text-[#caff00]'}>Φόρτωση εργαλείου…</div>}>
    {views[section]||<Navigate to="/backoffice" replace/>}
  </Suspense>;
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
          <Route index element={<Dashboard data={data}/>}/>
          <Route path="stations" element={<Stations data={data}/>}/>
          <Route path="stations/new" element={<StationEditor data={data} reload={reload} notify={notify}/>}/>
          <Route path="stations/:id/edit" element={<StationEditor data={data} reload={reload} notify={notify}/>}/>
          <Route path="schedules" element={<Scheduler data={data} reload={reload} notify={notify}/>}/>
          <Route path="review" element={<Review data={data} reload={reload} notify={notify}/>}/>
          {['analytics','users','ads','banners','slides','emails','billing','radioset','boost','adcontrol','push'].map(section=>
            <Route key={section} path={'admin/'+section} element={<Operations data={data} section={section} reload={reload}/>}/>)}
          <Route path="*" element={<Navigate to="/backoffice" replace/>}/>
        </Routes>
      </main>
      <footer className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-6 text-[10px] text-zinc-600 md:px-9">
        <span>© 2026 iRadiosGR · Powered by ILUMA</span><span>PRIVATE BUSINESS CONSOLE · SECURE ROLE ACCESS</span>
      </footer>
    </div>
  </div>;
}
