import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {Activity,AlertTriangle,ArrowLeft,CheckCircle2,Gift,LockKeyhole,
  Radio,RefreshCw,Search,ShieldCheck,SlidersHorizontal,BarChart3} from 'lucide-react';

const FEATURES=[
  {sku:'ADD-DSP',name:'WebDSP Audio Engine',Icon:SlidersHorizontal},
  {sku:'ADD-AN',name:'Analytics',Icon:BarChart3},
  {sku:'ADD-ADS',name:'iRadios Ad Control',Icon:Activity}
];
const card='rounded-2xl border border-white/10 bg-[#141819] p-5';
const input='w-full min-h-11 rounded-xl border border-white/15 bg-[#0b0f10] px-3 py-2.5 text-sm text-white outline-none focus:border-[#caff00]';
const friendlyDate=value=>value?new Intl.DateTimeFormat('el-GR',{dateStyle:'medium'}).format(new Date(value)):'Χωρίς λήξη';
const id=value=>String(value?._id||value||'');

async function api(url,options={}){
  const token=localStorage.getItem('iluma_token');
  if(!token)throw Error('Χρειάζεται σύνδεση Admin.');
  const response=await fetch(url,{...options,cache:'no-store',headers:{
    Authorization:'Bearer '+token,
    ...(options.body?{'Content-Type':'application/json'}:{}),
    ...(options.headers||{})
  }});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.error||'Αποτυχία επικοινωνίας με το Billing Engine.');
  return body;
}

export default function AdminAddons({API_URL='/api'}){
  const [params]=useSearchParams();
  const linkAccount=params.get('accountId')||'';
  const linkStation=params.get('stationId')||'';
  const [accountId,setAccountId]=useState(linkAccount);
  const [stationId,setStationId]=useState(linkStation);
  const [search,setSearch]=useState('');
  const [results,setResults]=useState([]);
  const [overview,setOverview]=useState(null);
  const [grants,setGrants]=useState([]);
  const [reason,setReason]=useState('');
  const [expires,setExpires]=useState('');
  const [saving,setSaving]=useState(false);
  const [finding,setFinding]=useState(false);
  const [loading,setLoading]=useState(false);
  const [alert,setAlert]=useState(null);
  const [selectedSku,setSelectedSku]=useState('ADD-DSP');
  const requestKey=useRef(null);

  useEffect(()=>{
    if(linkAccount){setAccountId(linkAccount);setStationId(linkStation);return;}
    if(!linkStation)return;
    let alive=true;
    api(API_URL+'/admin/billing/addons/resolve-station?stationId='+encodeURIComponent(linkStation))
      .then(data=>{if(alive){setAccountId(data.accountId);setStationId(data.stationId);}})
      .catch(e=>{if(alive)setAlert({type:'error',text:e.message});});
    return()=>{alive=false;};
  },[API_URL,linkAccount,linkStation]);

  const refresh=useCallback(async(account)=>{
    const [status,history]=await Promise.all([
      api(API_URL+'/admin/billing/addons/overview?accountId='+encodeURIComponent(account)),
      api(API_URL+'/admin/billing/grants?accountId='+encodeURIComponent(account))
    ]);
    return {status,history};
  },[API_URL]);
  useEffect(()=>{
    if(!accountId){setOverview(null);setGrants([]);return;}
    let alive=true;
    setLoading(true);setAlert(null);
    refresh(accountId).then(({status,history})=>{
      if(!alive)return;
      setOverview(status);setGrants(history.grants||[]);
      setStationId(prev=>status.stations.some(station=>station.id===prev)?
        prev:status.stations[0]?.id||'');
    }).catch(e=>{if(alive){setOverview(null);setGrants([]);
      setAlert({type:'error',text:e.message});}})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[accountId,refresh]);

  const selected=useMemo(()=>overview?.stations.find(s=>s.id===stationId),[overview,stationId]);
  const entitlement=selected?.addons?.[selectedSku];
  const giftForSelected=useMemo(()=>grants.find(g=>g.active&&g.sku===selectedSku&&
    g.scopeType==='station'&&id(g.resourceId)===stationId),[grants,selectedSku,stationId]);
  const history=useMemo(()=>grants.filter(g=>
    g.scopeType==='station'&&id(g.resourceId)===stationId&&FEATURES.some(f=>f.sku===g.sku)),
    [grants,stationId]);
  const accountName=(overview?.account?.fname||overview?.account?.lname)?
    [overview.account.fname,overview.account.lname].filter(Boolean).join(' '):
    overview?.account?.username||'Broadcaster';

  const searchAccounts=async()=>{
    if(search.trim().length<2){setAlert({type:'error',text:'Αναζήτησε με τουλάχιστον δύο χαρακτήρες.'});return;}
    setFinding(true);setAlert(null);
    try{
      const data=await api(API_URL+'/admin/billing/subjects?q='+encodeURIComponent(search.trim()));
      setResults((data.users||[]).filter(u=>u.role==='broadcaster'));
    }catch(e){setAlert({type:'error',text:e.message});}
    finally{setFinding(false);}
  };
  const selectAccount=user=>{
    setResults([]);setSearch('');setReason('');setExpires('');
    setAccountId(String(user._id));setStationId('');
  };
  const reload=async()=>{
    if(!accountId)return;
    setLoading(true);setAlert(null);
    try{
      const {status,history}=await refresh(accountId);
      setOverview(status);setGrants(history.grants||[]);
    }catch(e){setAlert({type:'error',text:e.message});}
    finally{setLoading(false);}
  };

  const createGrant=async(event)=>{
    event.preventDefault();
    if(saving||!selected||!entitlement||selected.status!=='approved'||giftForSelected)return;
    if(reason.trim().length<4){setAlert({type:'error',text:'Η αιτιολογία χρειάζεται τουλάχιστον 4 χαρακτήρες.'});return;}
    const payload={
      accountId,sku:selectedSku,resourceId:stationId,
      expiresAt:expires?new Date(expires+'T23:59:59').toISOString():null,
      reason:reason.trim()
    };
    const serialized=JSON.stringify(payload);
    if(!requestKey.current||requestKey.current.body!==serialized)
      requestKey.current={body:serialized,key:crypto.randomUUID()};
    setSaving(true);setAlert(null);
    try{
      await api(API_URL+'/admin/billing/grants',{
        method:'POST',headers:{'Idempotency-Key':requestKey.current.key},body:serialized
      });
      requestKey.current=null;
      const {status,history:updated}=await refresh(accountId);
      setOverview(status);setGrants(updated.grants||[]);
      setReason('');setExpires('');
      setAlert({type:'success',text:'Το δωρεάν Addon ενεργοποιήθηκε για τον συγκεκριμένο σταθμό. Δεν έγινε χρέωση.'});
    }catch(e){setAlert({type:'error',text:e.message});}
    finally{setSaving(false);}
  };

  const revoke=async(grant)=>{
    if(saving||grant.scopeType!=='station'||id(grant.resourceId)!==stationId||!grant.active)return;
    const why=window.prompt('Αιτιολογία ανάκλησης (τουλάχιστον 4 χαρακτήρες):','');
    if(why===null)return;
    if(why.trim().length<4){setAlert({type:'error',text:'Η αιτιολογία είναι υποχρεωτική.'});return;}
    if(!window.confirm('Να ανακληθεί μόνο αυτή η δωρεάν παραχώρηση; Πληρωμένα Addons δεν επηρεάζονται.'))return;
    setSaving(true);setAlert(null);
    try{
      await api(API_URL+'/admin/billing/grants/'+grant._id+'/revoke',{
        method:'POST',body:JSON.stringify({reason:why.trim()})
      });
      const {status,history:updated}=await refresh(accountId);
      setOverview(status);setGrants(updated.grants||[]);
      setAlert({type:'success',text:'Η δωρεάν παραχώρηση ανακλήθηκε. Οι πληρωμένες συνδρομές παραμένουν ανέπαφες.'});
    }catch(e){setAlert({type:'error',text:e.message});}
    finally{setSaving(false);}
  };

  return <div className="mx-auto max-w-[1300px] space-y-5 pb-24 text-white">
    <Link to="/backoffice/admin" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-[#caff00]">
      <ArrowLeft size={15}/> Όλα τα εργαλεία Admin
    </Link>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[11px] font-black uppercase tracking-widest text-[#caff00]">Admin / Entitlements</p>
        <h1 className="mt-2 text-3xl font-black">Διαχείριση Addons</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Πραγματικά δικαιώματα ανά σταθμό. Δωρεάν παραχώρηση ή ανάκληση χωρίς αλλαγή πληρωμής, συνδρομής ή Gateway.</p></div>
      <Link to="/backoffice/admin/billing/grants" className="rounded-xl border border-white/20 px-4 py-3 text-xs font-bold hover:border-[#caff00]/50">
        Όλες οι δωρεάν συνδρομές
      </Link>
    </header>
    <section className={card}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Search size={18}/> 1. Επιλογή Broadcaster</h2>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Αναζήτηση Broadcaster" value={search}
          onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')searchAccounts();}}
          placeholder="Email, username ή όνομα" className={input+' min-w-44 flex-1'}/>
        <button type="button" disabled={finding} onClick={searchAccounts}
          className="rounded-xl bg-[#caff00] px-5 py-2 text-sm font-black text-black disabled:opacity-50">
          {finding?'Αναζήτηση…':'Αναζήτηση'}
        </button>
      </div>
      {!!results.length&&<div className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
        {results.map(user=><button type="button" key={user._id} onClick={()=>selectAccount(user)}
          className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:bg-white/5">
          <span>{[user.fname,user.lname].filter(Boolean).join(' ')||user.username}
            <span className="block text-xs text-zinc-500">{user.email} · @{user.username}</span></span>
          <span className="text-xs text-[#caff00]">Επιλογή</span>
        </button>)}
      </div>}
      {overview&&<div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#caff00]/20 bg-[#caff00]/5 p-4">
        <ShieldCheck className="text-[#caff00]" size={20}/>
        <div className="min-w-0 flex-1"><strong>{accountName}</strong>
          <p className="text-xs text-zinc-400">{overview.account.email} · {overview.stations.length} σταθμοί</p></div>
        <button type="button" disabled={loading} onClick={reload}
          className="flex items-center gap-2 text-xs font-bold text-[#caff00]"><RefreshCw size={14}/> Ανανέωση</button>
      </div>}
    </section>

    {loading&&<p role="status" className="text-sm text-zinc-400">Ενημέρωση δικαιωμάτων από τον server…</p>}
    {overview&&<section className={card}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Radio size={19}/> 2. Επιλογή σταθμού</h2>
      {!overview.stations.length?<p className="text-sm text-zinc-400">Δεν βρέθηκαν σταθμοί για τον Broadcaster.</p>:
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {overview.stations.map(station=><button type="button" key={station.id}
            onClick={()=>{setStationId(station.id);setReason('');setExpires('');setAlert(null);}}
            className={'flex min-h-14 items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm '+
              (stationId===station.id?'border-[#caff00] bg-[#caff00]/10':'border-white/10 bg-black/20 hover:border-white/30')}>
            <span className="font-bold">{station.name}</span>
            {station.status==='approved'?<CheckCircle2 size={16} className="shrink-0 text-[#caff00]"/>:
              <span className="text-[10px] uppercase text-amber-300">{station.status}</span>}
          </button>)}
        </div>}
    </section>}

    {selected&&<section className={card+' space-y-5'}>
      <div><h2 className="text-lg font-bold">3. Δικαιώματα · {selected.name}</h2>
        <p className="mt-1 text-xs text-zinc-400">Οι ενδείξεις προκύπτουν από ενεργές πληρωμές, Premium, δωρεάν παραχωρήσεις και υφιστάμενα δικαιώματα.</p></div>
      <div className="grid gap-3 lg:grid-cols-3">
        {FEATURES.map(({sku,name,Icon})=>{
          const item=selected.addons?.[sku];const active=item?.enabled;
          return <button type="button" key={sku} onClick={()=>setSelectedSku(sku)}
            aria-pressed={selectedSku===sku}
            className={'rounded-2xl border p-4 text-left '+(selectedSku===sku?
              'border-[#caff00] bg-[#caff00]/5':'border-white/10 bg-[#0b0f10]')}>
            <div className="flex items-center justify-between">
              <Icon size={20} className={active?'text-[#caff00]':'text-zinc-500'}/>
              <span className={'text-xs font-bold '+(active?'text-[#caff00]':'text-zinc-400')}>
                {active?'Ενεργό':'Ανενεργό'}</span></div>
            <h3 className="mt-4 text-base font-black">{name}</h3>
            {item?.sources?.length?<div className="mt-3 space-y-2">
              {item.sources.map((source,i)=><p key={i}
                className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-zinc-300">
                {source.label} · {friendlyDate(source.expiresAt)}
              </p>)}
            </div>:<p className="mt-3 text-xs text-zinc-500">Δεν υπάρχει ενεργό δικαίωμα.</p>}
          </button>;
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <form onSubmit={createGrant} className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="flex items-center gap-2 font-bold"><Gift size={18}/> Δωρεάν παραχώρηση</h3>
          <p className="text-xs leading-6 text-zinc-400">
            {entitlement?.name} μόνο στον <strong>{selected.name}</strong>. Δεν εκκινείται checkout, ανανέωση ή χρέωση.</p>
          {entitlement?.enabled&&<p className="rounded-lg border border-amber-400/20 p-3 text-xs text-amber-200">
            Το Addon είναι ήδη ενεργό. Νέα δωρεάν παραχώρηση δεν μετατρέπει ή ακυρώνει την τυχόν πληρωμένη πρόσβαση.</p>}
          {giftForSelected&&<p className="text-xs text-[#caff00]">Υπάρχει ήδη ενεργή δωρεάν παραχώρηση για αυτό το Addon και τον σταθμό.</p>}
          {selected.status!=='approved'&&<p className="text-xs text-amber-300">
            Απαιτείται εγκεκριμένος σταθμός για νέα παραχώρηση.</p>}
          <label className="block space-y-2 text-xs text-zinc-300">Addon
            <select className={input} value={selectedSku} onChange={e=>{setSelectedSku(e.target.value);setAlert(null);}}>
              {FEATURES.map(feature=><option key={feature.sku} value={feature.sku}>{feature.name}</option>)}
            </select>
          </label>
          <label className="block space-y-2 text-xs text-zinc-300">Λήξη (προαιρετική)
            <input className={input} type="date" value={expires} onChange={e=>setExpires(e.target.value)}/>
          </label>
          <label className="block space-y-2 text-xs text-zinc-300">Αιτιολογία Admin
            <textarea className={input+' min-h-24'} required minLength={4} maxLength={500} value={reason}
              onChange={e=>setReason(e.target.value)} placeholder="Αιτία δωρεάν παραχώρησης"/>
          </label>
          <button type="submit" disabled={saving||loading||Boolean(giftForSelected)||selected.status!=='approved'}
            className="rounded-xl bg-[#caff00] px-5 py-3 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40">
            {saving?'Αποθήκευση…':'Ενεργοποίηση δωρεάν Addon'}
          </button>
        </form>
        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="flex items-center gap-2 font-bold"><LockKeyhole size={18}/> Ιστορικό δωρεάν Addons</h3>
          {!history.length?<p className="text-xs text-zinc-400">Δεν υπάρχουν δωρεάν παραχωρήσεις για τον σταθμό.</p>:
            history.map(g=><div key={g._id} className="rounded-xl border border-white/10 p-3 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{FEATURES.find(f=>f.sku===g.sku)?.name||g.sku}</strong>
                <span className={g.active?'text-[#caff00]':'text-zinc-400'}>
                  {g.active?'Ενεργή':'Ανενεργή'}</span></div>
              <p className="mt-2 text-zinc-400">Λήξη: {friendlyDate(g.expiresAt)}</p>
              <p className="mt-1 text-zinc-500">Αιτιολογία: {g.reason}</p>
              {g.revokedAt&&<p className="mt-1 text-amber-300">Ανακλήθηκε: {friendlyDate(g.revokedAt)}</p>}
              {g.active&&<button type="button" disabled={saving}
                className="mt-3 rounded-lg border border-rose-500/30 px-3 py-2 font-bold text-rose-300 disabled:opacity-40"
                onClick={()=>revoke(g)}>Ανάκληση δωρεάν παραχώρησης</button>}
            </div>)}
          <p className="flex items-start gap-2 text-xs leading-6 text-zinc-500">
            <AlertTriangle size={16} className="mt-1 shrink-0"/> Η ανάκληση αφαιρεί μόνο τη συγκεκριμένη δωρεάν παραχώρηση.
            Αν υπάρχει πληρωμένο Addon, ενεργό Premium ή άλλο δικαίωμα, η πρόσβαση παραμένει ενεργή.</p>
          <Link className="inline-block text-xs font-bold text-[#caff00]" to="/backoffice/admin/billing/grants">
            Διαχείριση Premium παραχωρήσεων σε επίπεδο λογαριασμού
          </Link>
        </div>
      </div>
    </section>}
    {alert&&<div role={alert.type==='error'?'alert':'status'}
      className={'rounded-xl border px-4 py-3 text-sm '+(alert.type==='error'?
        'border-rose-500/30 text-rose-300':'border-[#caff00]/30 text-[#caff00]')}>
      {alert.text}</div>}
    {!accountId&&!loading&&<div className="flex items-center gap-3 rounded-xl border border-white/10 p-5 text-sm text-zinc-400">
      <ShieldCheck size={18}/> Επίλεξε Broadcaster για να δεις τα Addons ανά σταθμό.</div>}
  </div>;
}
