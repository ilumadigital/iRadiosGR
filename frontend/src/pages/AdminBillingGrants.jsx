import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,Gift,Search,ShieldCheck,RefreshCw,AlertCircle} from 'lucide-react';

// Phase 1 only: complimentary grants are recorded separately from financial transactions.
// Paid subscriptions and the legacy premium flags are NOT changed by this screen.
const tokenHeaders=()=>({
  'Content-Type':'application/json',
  Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')
});
async function request(url,options={}){
  const res=await fetch(url,{...options,headers:{...tokenHeaders(),...(options.headers||{})},cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Αποτυχία επικοινωνίας');
  return data;
}
const fmtDate=x=>x?new Intl.DateTimeFormat('el-GR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(x)):'Χωρίς λήξη';
const byRole=(p,role)=>p.complimentaryEligible && (
  (role==='user' && p.sku==='L-PREM')||
  (role==='admin' && p.sku==='L-PREM')||
  (role==='broadcaster' && (p.sku==='B-PREM'||p.sku.startsWith('ADD-')))||
  (role==='agency' && p.sku.startsWith('AG-'))
);

export default function AdminBillingGrants({API_URL='/api'}){
  const [search,setSearch]=useState('');
  const [found,setFound]=useState([]);
  const [account,setAccount]=useState(null);
  const [catalog,setCatalog]=useState([]);
  const [sku,setSku]=useState('');
  const [resources,setResources]=useState([]);
  const [resourceId,setResourceId]=useState('');
  const [reason,setReason]=useState('');
  const [expiry,setExpiry]=useState('');
  const [grants,setGrants]=useState([]);
  const [busy,setBusy]=useState(false);
  const grantAttempt=useRef(null); // stable Idempotency-Key across network retries
  const [message,setMessage]=useState(null);

  useEffect(()=>{request(API_URL+'/billing/catalog')
    .then(r=>setCatalog(r.products||[]))
    .catch(e=>setMessage({error:true,text:e.message}));},[API_URL]);

  const plans=useMemo(()=>catalog.filter(p=>byRole(p,account?.role)),[catalog,account]);
  const product=plans.find(p=>p.sku===sku)||null;

  const loadGrants=useCallback(async(id)=>{
    const r=await request(API_URL+'/admin/billing/grants?accountId='+encodeURIComponent(id));
    setGrants(r.grants||[]);
  },[API_URL]);

  useEffect(()=>{
    setSku('');setResourceId('');setResources([]);
    if(!account){setGrants([]);return;}
    loadGrants(account._id).catch(e=>setMessage({error:true,text:e.message}));
  },[account,loadGrants]);

  useEffect(()=>{
    let canceled=false;
    setResources([]);setResourceId('');
    if(!account||!product||product.scopeType==='account')return;
    request(API_URL+'/admin/billing/resources/'+account._id+'?sku='+encodeURIComponent(product.sku))
      .then(r=>{if(!canceled)setResources(r.resources||[]);})
      .catch(e=>{if(!canceled)setMessage({error:true,text:e.message});});
    return ()=>{canceled=true;};
  },[API_URL,account,product?.sku]);

  const findUsers=async()=>{
    if(search.trim().length<2){setMessage({error:true,text:'Πληκτρολόγησε τουλάχιστον 2 χαρακτήρες.'});return;}
    setBusy(true);setMessage(null);
    try{
      const r=await request(API_URL+'/admin/billing/subjects?q='+encodeURIComponent(search.trim()));
      setFound(r.users||[]);
    }catch(e){setMessage({error:true,text:e.message});}
    finally{setBusy(false);}
  };
  const createGrant=async(e)=>{
    e.preventDefault();
    if(!account||!product)return;
    if(product.scopeType!=='account'&&!resourceId){setMessage({error:true,text:'Επίλεξε σταθμό ή καμπάνια.'});return;}
    if(reason.trim().length<4){setMessage({error:true,text:'Χρειάζεται αιτιολογία τουλάχιστον 4 χαρακτήρων.'});return;}
    setBusy(true);setMessage(null);
    try{
      const body={
        accountId:account._id,sku:product.sku,
        resourceId:product.scopeType==='account'?null:resourceId,
        expiresAt:expiry?new Date(expiry+'T23:59:59').toISOString():null,
        reason:reason.trim()
      };
      const serialized=JSON.stringify(body);
      if(!grantAttempt.current||grantAttempt.current.body!==serialized)
        grantAttempt.current={body:serialized,key:crypto.randomUUID()};
      await request(API_URL+'/admin/billing/grants',{
        method:'POST',headers:{'Idempotency-Key':grantAttempt.current.key},
        body:serialized
      });
      grantAttempt.current=null;
      setMessage({error:false,text:'Η δωρεάν παραχώρηση καταχωρίστηκε. Δεν δημιουργήθηκε συναλλαγή.'});
      setReason('');setExpiry('');
      await loadGrants(account._id);
    }catch(e){setMessage({error:true,text:e.message});}
    finally{setBusy(false);}
  };
  const revoke=async(g)=>{
    const why=window.prompt('Αιτιολογία ανάκλησης (τουλάχιστον 4 χαρακτήρες):','');
    if(why===null)return;
    if(why.trim().length<4){setMessage({error:true,text:'Η αιτιολογία είναι υποχρεωτική.'});return;}
    setBusy(true);setMessage(null);
    try{
      await request(API_URL+'/admin/billing/grants/'+g._id+'/revoke',{
        method:'POST',body:JSON.stringify({reason:why.trim()})
      });
      setMessage({error:false,text:'Η δωρεάν παραχώρηση ανακλήθηκε.'});
      await loadGrants(account._id);
    }catch(e){setMessage({error:true,text:e.message});}
    finally{setBusy(false);}
  };
  return <div className="admin-legacy-page max-w-6xl mx-auto p-4 lg:p-8 pb-32 text-white space-y-6">
    <Link to="/admin/billing" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16}/> Συναλλαγές & παραστατικά</Link>
    <div className="flex items-start gap-4">
      <div className="p-3 rounded-2xl bg-[#ccff00]/10 text-[#ccff00]"><Gift/></div>
      <div><h1 className="text-2xl lg:text-3xl font-black">Δωρεάν συνδρομές</h1>
        <p className="mt-2 text-sm text-zinc-400">Διαχειριστική παραχώρηση ανά ακροατή, broadcaster, σταθμό ή agency campaign. Χωρίς Nexi checkout και χωρίς καταχώριση ως πληρωμένη συναλλαγή.</p>
      </div>
    </div>
    <div className="rounded-2xl border border-amber-600/30 p-4 bg-amber-950/10 text-amber-200 text-xs flex gap-2">
      <AlertCircle size={17} className="shrink-0"/>
      Πρώτη φάση: οι παραχωρήσεις αποθηκεύονται στο νέο Billing Engine. Η ενεργοποίησή τους στα υπάρχοντα premium features θα γίνει μετά τους ελέγχους entitlements. Τα υπάρχοντα χειροκίνητα Premium δικαιώματα παραμένουν ανέπαφα.
    </div>
    {message&&<div role="status" className={'rounded-xl p-4 text-sm border '+(message.error?'border-red-500/30 bg-red-950/20 text-red-200':'border-lime-500/30 bg-lime-950/20 text-lime-200')}>{message.text}</div>}
    <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 space-y-4">
      <h2 className="font-bold text-lg">1. Επιλογή λογαριασμού</h2>
      <div className="flex gap-2">
        <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')findUsers();}}
          placeholder="Email, username ή ονοματεπώνυμο" className="w-full rounded-xl bg-black border border-white/15 px-4 py-3 text-sm outline-none focus:border-lime-400"/>
        <button disabled={busy} onClick={findUsers} className="rounded-xl bg-white text-black px-4 font-bold inline-flex items-center gap-2"><Search size={16}/> Αναζήτηση</button>
      </div>
      {found.length>0&&<div className="max-h-60 overflow-auto divide-y divide-white/10 rounded-xl border border-white/10">
        {found.map(u=><button key={u._id} onClick={()=>{setAccount(u);setFound([]);}} className="w-full text-left p-3 hover:bg-white/5 flex items-center justify-between gap-2">
          <span className="min-w-0"><strong>{u.fname} {u.lname}</strong><span className="block text-xs text-zinc-400">{u.username} · {u.email}</span></span>
          <span className="text-xs text-zinc-400 uppercase">{u.role}</span>
        </button>)}
      </div>}
      {account&&<div className="rounded-xl bg-black/50 p-4 flex items-center justify-between gap-3">
        <span><strong>{account.fname} {account.lname}</strong><span className="block text-xs text-zinc-400">{account.email} · {account.role}</span></span>
        <button onClick={()=>setAccount(null)} className="text-xs text-lime-300">Αλλαγή</button>
      </div>}
    </section>
    {account&&<section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 space-y-4">
      <h2 className="font-bold text-lg">2. Νέα παραχώρηση</h2>
      <form onSubmit={createGrant} className="grid md:grid-cols-2 gap-4">
        <label className="text-xs text-zinc-400 space-y-2">Συνδρομή
          <select value={sku} required onChange={e=>setSku(e.target.value)} className="block w-full rounded-xl bg-black border border-white/15 px-4 py-3 text-white text-sm">
            <option value="">Επιλογή συνδρομής</option>{plans.map(p=><option key={p.sku} value={p.sku}>{p.title} ({p.sku})</option>)}
          </select>
        </label>
        {product?.scopeType!=='account' && product&&<label className="text-xs text-zinc-400 space-y-2">{product.scopeType==='station'?'Σταθμός':'Καμπάνια'}
          <select value={resourceId} required onChange={e=>setResourceId(e.target.value)} className="block w-full rounded-xl bg-black border border-white/15 px-4 py-3 text-white text-sm">
            <option value="">Επίλεξε {product.scopeType==='station'?'εγκεκριμένο σταθμό':'καμπάνια'}</option>
            {resources.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>}
        <label className="text-xs text-zinc-400 space-y-2">Λήξη (προαιρετικό)
          <input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}
            className="block w-full rounded-xl bg-black border border-white/15 px-4 py-3 text-white text-sm"/>
        </label>
        <label className="text-xs text-zinc-400 space-y-2 md:col-span-2">Αιτιολογία / σημείωση Admin
          <textarea required minLength={4} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}
            className="block w-full min-h-24 rounded-xl bg-black border border-white/15 px-4 py-3 text-white text-sm" placeholder="Π.χ. Δωρεάν Premium βάσει συμφωνίας συνεργασίας"/>
        </label>
        <div className="md:col-span-2 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-zinc-400">{product?('Τυπική τιμή: '+(product.priceCents/100).toLocaleString('el-GR',{style:'currency',currency:'EUR'})+' · Παραχώρηση: 0,00 €'):'Δεν εκτελείται πληρωμή.'}</p>
          <button disabled={busy||!product} type="submit" className="rounded-xl bg-[#ccff00] disabled:opacity-40 text-black px-5 py-3 font-black inline-flex items-center gap-2"><Gift size={17}/> Καταχώριση δωρεάν</button>
        </div>
      </form>
    </section>}
    {account&&<section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between"><h2 className="font-bold text-lg">3. Ιστορικό παραχωρήσεων</h2>
        <button onClick={()=>loadGrants(account._id)} className="text-zinc-400 hover:text-white" aria-label="Ανανέωση"><RefreshCw size={17}/></button></div>
      {grants.length===0?<p className="text-sm text-zinc-500">Δεν υπάρχουν καταχωρισμένες δωρεάν συνδρομές στο νέο Billing Engine.</p>:
        <div className="space-y-2">{grants.map(g=><div key={g._id} className="rounded-xl bg-black/50 border border-white/10 p-4 flex justify-between gap-3 items-center flex-wrap">
          <div><strong>{g.sku}</strong><span className="ml-2 text-xs text-zinc-400">{g.active?'Ενεργή':'Ανενεργή'}</span>
            <p className="text-xs text-zinc-400 mt-1">{g.scopeType}{g.resourceId?' · '+g.resourceId:''} · Λήξη: {fmtDate(g.expiresAt)}</p>
            <p className="text-xs text-zinc-500 mt-1">{g.reason}</p>
            {g.revokedAt&&<p className="text-xs text-orange-300 mt-1">Ανάκληση: {fmtDate(g.revokedAt)} · {g.revokeReason}</p>}
          </div>
          {!g.revokedAt&&<button disabled={busy} onClick={()=>revoke(g)} className="rounded-lg px-3 py-2 text-xs border border-red-600/40 text-red-300">Ανάκληση</button>}
        </div>)}</div>}
      <p className="text-xs text-zinc-500 flex items-center gap-2"><ShieldCheck size={14}/> Κάθε παραχώρηση φέρει Admin ID, ημερομηνία και λόγο. Δεν εκδίδεται αυτόματα παραστατικό πληρωμής.</p>
    </section>}
  </div>;
}
