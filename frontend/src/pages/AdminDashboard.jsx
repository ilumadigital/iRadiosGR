import {adminFetch as fetch} from '../utils/adminFetch';
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip as ChartTooltip,PieChart,Pie,Cell} from 'recharts';
import {Activity,ArrowRight,BarChart3,Briefcase,CheckCircle2,Clock3,Crown,Euro,Headphones,
  Image as ImageIcon,LoaderCircle,MousePointerClick,Radio,RefreshCw,TrendingUp,Users} from 'lucide-react';

const panel='rounded-[24px] border border-white/[.085] bg-[#15191b] p-5 md:p-6';
const action='inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.045] px-4 py-2.5 text-xs font-bold text-zinc-100 transition hover:border-[#caff00]/40 hover:bg-white/[.07]';
const fmt=value=>new Intl.NumberFormat('el-GR',{maximumFractionDigits:0}).format(Number(value)||0);
const euros=value=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(Number(value)||0);
const percent=value=>(Number(value)||0).toLocaleString('el-GR',{maximumFractionDigits:2})+'%';
function Empty({message='Δεν υπάρχουν ακόμη δεδομένα για αυτή τη μέτρηση.'}){
  return <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-center text-xs text-zinc-400">{message}</div>;
}
function Metric({icon:Icon,label,value,hint}){
  return <div className={panel+' flex min-w-0 flex-col justify-between gap-5'}>
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold text-zinc-400">{label}</p>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#caff00]/[.075] text-[#caff00]"><Icon size={19}/></div>
    </div>
    <div><p className="break-all text-3xl font-black tracking-[-.05em] text-white md:text-4xl">{value}</p>
      <p className="mt-2 text-[11px] leading-5 text-zinc-500">{hint}</p>
    </div>
  </div>;
}
function RankList({title,icon:Icon,items,label,value,meta,to}){
  return <section className={panel+' min-w-0'}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-base font-black text-white"><Icon size={18} className="text-[#caff00]"/>{title}</h3>
      <Link to={to} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-[#caff00]" aria-label={'Προβολή '+title}><ArrowRight size={18}/></Link>
    </div>
    {items.length?<div className="divide-y divide-white/[.07]">
      {items.slice(0,10).map((item,index)=><div key={String(item._id||item.id||index)} className="flex items-center gap-3 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[.045] text-[11px] font-black text-zinc-400">{index+1}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-zinc-200">{label(item)}</p>
          {meta(item)&&<p className="mt-1 truncate text-[10px] text-zinc-500">{meta(item)}</p>}
        </div>
        <p className="shrink-0 text-xs font-black tabular-nums text-[#caff00]">{value(item)}</p>
      </div>)}
    </div>:<Empty message="Δεν υπάρχουν καταχωρημένες μετρήσεις." />}
  </section>;
}
export default function AdminDashboard({API_URL='/api',globalSocket}){
  const [stats,setStats]=useState(null);
  const [live,setLive]=useState(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const [lastUpdated,setLastUpdated]=useState(null);
  const refresh=useCallback(async({silent=false,signal}={})=>{
    if(!silent)setRefreshing(true);
    try{
      const res=await fetch(API_URL+'/admin/dashboard-stats',{signal});
      if(!res.ok)throw new Error(res.status===403?'Ο λογαριασμός δεν έχει πρόσβαση στις αναλύσεις.':'Δεν μπόρεσαν να φορτωθούν τα στατιστικά.');
      const data=await res.json();
      if(signal?.aborted)return;
      setStats(data);setError('');setLastUpdated(new Date());
    }catch(err){
      if(!signal?.aborted)setError(err.message||'Σφάλμα φόρτωσης αναλύσεων.');
    }finally{
      if(!signal?.aborted){setLoading(false);setRefreshing(false);}
    }
  },[API_URL]);
  const refreshLive=useCallback(async(signal)=>{
    try{
      const res=await fetch(API_URL+'/stats/network',{signal});
      if(!res.ok)return;
      const result=await res.json();
      if(!signal?.aborted&&result.totals?.liveListeners!==undefined)
        setLive(Number(result.totals.liveListeners)||0);
    }catch{/* Live counters are optional; do not replace them with invented data. */}
  },[API_URL]);
  useEffect(()=>{
    const ctl=new AbortController();
    refresh({signal:ctl.signal});refreshLive(ctl.signal);
    const interval=setInterval(()=>refreshLive(ctl.signal),30000);
    return ()=>{clearInterval(interval);ctl.abort();};
  },[refresh,refreshLive]);
  useEffect(()=>{
    if(!globalSocket)return;
    const update=count=>{if(Number.isFinite(Number(count)))setLive(Number(count));};
    globalSocket.on('admin_live_listeners',update);
    globalSocket.on('global_live_listeners',update);
    return ()=>{
      globalSocket.off('admin_live_listeners',update);
      globalSocket.off('global_live_listeners',update);
    };
  },[globalSocket]);
  const totals=stats?.totals||{};
  const rolesFallback=Array.isArray(stats?.roleData)?stats.roleData:[];
  const fromRole=(...labels)=>Number(rolesFallback.find(item=>
    labels.includes(String(item.name||'').toLocaleLowerCase('el')))?.value)||0;
  const role=stats?.roleCounts||{
    broadcasters:fromRole('broadcasters','broadcaster'),
    producers:fromRole('producers','producer'),
    agencies:fromRole('agencies','agency')
  };
  const audio=stats?.adStats?.audio||{};
  const banner=stats?.adStats?.banner||{};
  const revenue=Array.isArray(stats?.revenueData)?stats.revenueData:[];
  const stations=Array.isArray(stats?.topStations)?stats.topStations:[];
  const ads=Array.isArray(stats?.topAds)?stats.topAds:[];
  const banners=Array.isArray(stats?.topBanners)?stats.topBanners:[];
  const premium=Math.min(Number(totals.premiumUsers)||0,Number(totals.users)||0);
  const membership=useMemo(()=>[
    {name:'Δωρεάν',value:Math.max(0,(Number(totals.users)||0)-premium)},
    {name:'Premium',value:premium}
  ],[totals.users,premium]);
  const b2b=useMemo(()=>[
    {name:'Broadcasters',value:Number(role.broadcasters)||0},
    {name:'Producers',value:Number(role.producers)||0},
    {name:'Agencies',value:Number(role.agencies)||0}
  ],[role.broadcasters,role.producers,role.agencies]);
  const totalMembership=membership.reduce((acc,item)=>acc+item.value,0);
  const totalB2B=b2b.reduce((acc,item)=>acc+item.value,0);
  const clickMetrics=[
    {name:'Audio plays',value:fmt(audio.plays),icon:Headphones},
    {name:'Audio clicks',value:fmt(audio.clicks),icon:MousePointerClick},
    {name:'Audio CTR',value:percent(audio.ctr),icon:TrendingUp},
    {name:'Banner views',value:fmt(banner.views),icon:ImageIcon},
    {name:'Banner clicks',value:fmt(banner.clicks),icon:MousePointerClick},
    {name:'Banner CTR',value:percent(banner.ctr),icon:TrendingUp}
  ];
  return <div className="admin-legacy-page space-y-6">
    <section className="relative overflow-hidden rounded-[28px] border border-[#caff00]/15 bg-gradient-to-br from-[#1a2320] via-[#151a1b] to-[#111518] p-6 md:p-8">
      <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-[#caff00]/[.075] blur-[70px]"/>
      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.16em] text-[#caff00]"><Activity size={15}/> Στατιστικά δικτύου</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-.055em] text-white md:text-3xl">Όλο το iRadios σε μία εικόνα.</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">Χρήστες, έσοδα, ακροάσεις και διαφημίσεις — χωρίς περιττά γραφήματα και σύνθετες ενέργειες.</p>
          <p className="mt-3 flex items-center gap-2 text-[11px] text-zinc-400"><Clock3 size={14}/>{lastUpdated?'Ενημερώθηκε '+lastUpdated.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'}):'Δεν έχει γίνει ακόμη ενημέρωση'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[#caff00]/20 bg-black/25 px-5 py-3">
            <span className="size-2.5 rounded-full bg-[#caff00] shadow-[0_0_12px_rgba(202,255,0,.6)]"/>
            <div><p className="text-[10px] font-bold text-zinc-400">Ενεργές συνεδρίες player (εκτίμηση)</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-white">{live===null?'—':fmt(live)}</p></div>
          </div>
          <button type="button" onClick={()=>{refresh();refreshLive();}} disabled={refreshing}
            className={action} aria-label="Ανανέωση στατιστικών">
            {refreshing?<LoaderCircle size={17} className="animate-spin"/>:<RefreshCw size={17}/>} Ανανέωση
          </button>
        </div>
      </div>
    </section>
    {error&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[.07] px-5 py-4 text-xs text-amber-100">
      <span>{error} {stats?'Εμφανίζονται τα τελευταία διαθέσιμα στοιχεία.':''}</span>
      <button type="button" onClick={()=>refresh()} className={action}>Προσπάθησε ξανά</button>
    </div>}
    {loading&&!stats?<div className="flex min-h-60 items-center justify-center gap-3 text-sm text-[#caff00]" role="status">
      <LoaderCircle size={24} className="animate-spin"/> Φόρτωση αναλύσεων…
    </div>:!stats?<Empty message="Τα στατιστικά δεν είναι προσωρινά διαθέσιμα. Χρησιμοποίησε την Ανανέωση για νέα προσπάθεια."/>:
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric icon={Euro} label="Καταγεγραμμένα έσοδα" value={euros(totals.revenue)} hint="Ολοκληρωμένες legacy συναλλαγές και επιβεβαιωμένες πληρωμές Gateway, χωρίς διπλομέτρηση."/>
        <Metric icon={Users} label="Χρήστες" value={fmt(totals.users)} hint="Συνολικοί λογαριασμοί"/>
        <Metric icon={Radio} label="Ενεργοί σταθμοί" value={fmt(stats.stationStats?.activeStations)} hint="Εγκεκριμένοι σταθμοί που δεν είναι offline"/>
        <Metric icon={Crown} label="Legacy Premium flags" value={fmt(totals.premiumUsers)} hint="Καταχωρημένες σημαίες Premium, όχι επιβεβαίωση ενεργών χρεώσεων"/>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className={panel}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-black text-white"><TrendingUp size={19} className="text-[#caff00]"/> Έσοδα ανά μήνα</h3>
            <span className="text-[11px] text-zinc-500">Ημερομηνίες UTC · Legacy + επιβεβαιωμένα paid orders</span>
          </div>
          {revenue.length?<div className="h-64 w-full" role="img" aria-label="Ραβδόγραμμα εσόδων ανά μήνα">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue} margin={{top:10,right:5,left:-18,bottom:5}}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" strokeDasharray="4 4" vertical={false}/>
                <XAxis dataKey="name" fontSize={11} stroke="#9ba3aa" axisLine={false} tickLine={false}/>
                <YAxis fontSize={11} stroke="#9ba3aa" axisLine={false} tickLine={false} tickFormatter={v=>fmt(v)}/>
                <ChartTooltip cursor={{fill:'rgba(202,255,0,.055)'}} contentStyle={{background:'#111618',border:'1px solid rgba(202,255,0,.25)',borderRadius:14,color:'#fff'}} formatter={v=>[euros(v),'Έσοδα']}/>
                <Bar dataKey="amount" name="Έσοδα" fill="#caff00" maxBarSize={42} radius={[7,7,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>:<Empty message="Δεν υπάρχουν ακόμη μηνιαία στοιχεία εσόδων."/>}
        </section>
        <section className={panel}>
          <h3 className="mb-5 flex items-center gap-2 text-base font-black text-white"><Briefcase size={18} className="text-[#caff00]"/> Επαγγελματικοί λογαριασμοί</h3>
          {totalB2B?<div className="grid gap-4 sm:grid-cols-[150px_1fr] sm:items-center">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={b2b} dataKey="value" innerRadius={49} outerRadius={72} stroke="none" paddingAngle={3}>
                {b2b.map((entry,i)=><Cell key={entry.name} fill={['#caff00','#7ed4a0','#62859a'][i]}/>)}
              </Pie><ChartTooltip contentStyle={{background:'#111618',color:'#fff',border:'1px solid #404b43',borderRadius:12}}/></PieChart></ResponsiveContainer>
            </div>
            <div className="space-y-3">{b2b.map((item,i)=><div key={item.name} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-zinc-300"><span className="size-2.5 rounded-full" style={{background:['#caff00','#7ed4a0','#62859a'][i]}}/>{item.name}</span>
              <strong className="tabular-nums text-white">{fmt(item.value)}</strong>
            </div>)}</div>
          </div>:<Empty message="Δεν υπάρχουν ακόμη επαγγελματικοί λογαριασμοί."/>}
        </section>
      </div>
      <section className={panel}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-black text-white"><BarChart3 size={18} className="text-[#caff00]"/> Απόδοση διαφημίσεων</h3>
          <div className="flex flex-wrap gap-2">
            <Link to="/backoffice/admin/ads" className={action}>Audio ads <ArrowRight size={14}/></Link>
            <Link to="/backoffice/admin/banners" className={action}>Banners <ArrowRight size={14}/></Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{clickMetrics.map(item=>
          <div key={item.name} className="rounded-2xl border border-white/[.075] bg-black/15 p-4">
            <item.icon size={16} className="mb-4 text-[#caff00]"/>
            <p className="text-[11px] text-zinc-400">{item.name}</p>
            <p className="mt-2 text-xl font-black tabular-nums text-white">{item.value}</p>
          </div>)}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <RankList title="Κορυφαίοι σταθμοί" icon={Radio} items={stations}
          label={s=>s.name||'Χωρίς όνομα'} value={s=>fmt(s.plays)+' εκκινήσεις'}
          meta={()=>''} to="/backoffice/stations"/>
        <RankList title="Κορυφαία banners" icon={ImageIcon} items={banners}
          label={s=>s.title||'Χωρίς τίτλο'} value={s=>percent(s.ctr)}
          meta={s=>s.company||''} to="/backoffice/admin/banners"/>
        <RankList title="Κορυφαία audio ads" icon={Headphones} items={ads}
          label={s=>s.title||'Χωρίς τίτλο'} value={s=>percent(s.ctr)}
          meta={s=>s.company||''} to="/backoffice/admin/ads"/>
      </div>
      {totalMembership>0&&<div className={panel+' flex flex-wrap items-center justify-between gap-4'}>
        <div><h3 className="text-sm font-black text-white">Σύνθεση λογαριασμών</h3>
          <p className="mt-1 text-xs text-zinc-400">{fmt(membership[0].value)} δωρεάν · {fmt(membership[1].value)} premium</p></div>
        <div className="h-2.5 w-full max-w-80 overflow-hidden rounded-full bg-white/10">
          <div style={{width:(100*premium/Math.max(1,totalMembership))+'%'}} className="h-full rounded-full bg-[#caff00]"/>
        </div>
        <Link to="/backoffice/admin/users" className={action}>Διαχείριση χρηστών <ArrowRight size={15}/></Link>
      </div>}
    </>}
  </div>;
}
