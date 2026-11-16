import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Check,CheckCircle2,Clock3,FileCheck2,Image as ImageIcon,
 Loader2,Mic2,RefreshCw,Search,ShieldCheck,X,XCircle} from 'lucide-react';
import {adminFetch as fetch} from '../utils/adminFetch';
import {useLiveRevision} from '../utils/liveUpdates';
import ProtectedAudioPreview from '../components/ProtectedAudioPreview';

const styles={
 panel:'rounded-2xl border border-white/10 bg-[#14131f] p-4 sm:p-6',
 secondary:'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-4 py-2.5 text-xs font-bold text-white hover:bg-white/[.08] disabled:opacity-40',
 primary:'inline-flex items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/20 px-4 py-2.5 text-xs font-black text-purple-100 hover:bg-purple-500/30 disabled:opacity-40'
};
const nameOf=agency=>{
 if(!agency)return 'Χωρίς Agency';
 if(typeof agency==='string')return 'Agency '+agency;
 return [agency.fname,agency.lname].filter(Boolean).join(' ')||
  agency.username||agency.email||'Agency '+String(agency._id||'');
};
const statuses={approved:'Εγκρίθηκε',active:'Εγκεκριμένο',rejected:'Απορρίφθηκε',pending:'Σε αναμονή'};
const kindLabels={campaign:'Καμπάνια',audio:'Audio Spot',banner:'Visual / Banner',revision:'Αλλαγή δημιουργικού'};
const kindIcons={campaign:FileCheck2,audio:Mic2,banner:ImageIcon,revision:Clock3};
const timeOf=row=>row.reviewedAt||row.approvedAt||row.updatedAt||row.createdAt;
function flatten(data){
 const row=(kind,item)=>({
  ...item,kind,key:kind+':'+item._id,
  title:kind==='revision'?item.creativeTitleAtSubmission||'Αλλαγές δημιουργικού':item.title||'Χωρίς τίτλο',
  agencyLabel:nameOf(item.agencyId),
  campaignId:kind==='campaign'?item._id:item.campaignId,
  isPending:kind==='campaign'?item.approvalStatus==='pending':item.status==='pending',
  decisionStatus:kind==='campaign'?item.approvalStatus:item.status
 });
 return [
  ...(data.campaigns||[]).map(x=>row('campaign',x)),
  ...(data.audios||[]).map(x=>row('audio',x)),
  ...(data.banners||[]).map(x=>row('banner',x)),
  ...(data.revisions||[]).map(x=>row('revision',x))
 ];
}
async function request(url,options){
 const res=await fetch(url,{cache:'no-store',...options});
 const body=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(body.error||'Η ενέργεια απέτυχε.');
 return body;
}
export default function AdminAdvertisingApprovalCenter(){
 const [data,setData]=useState({campaigns:[],audios:[],banners:[],revisions:[]});
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('all');
 const [reasonTarget,setReasonTarget]=useState(null),[reason,setReason]=useState('');
 const liveRevision=useLiveRevision('ads');
 const reload=useCallback(async()=>{
  setLoading(true);
  try{setData(await request('/api/admin/advertising/approval-center'));}
  catch(e){setError(e.message);}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void reload();},[reload,liveRevision]);
 const all=useMemo(()=>flatten(data),[data]);
 const campaignMap=useMemo(()=>new Map((data.campaigns||[]).map(c=>[String(c._id),c])),[data]);
 const waiting=all.filter(x=>x.isPending);
 const history=all.filter(x=>!x.isPending&&['approved','rejected','active'].includes(x.decisionStatus));
 const shown=useMemo(()=>{
  const query=search.trim().toLocaleLowerCase('el-GR');
  const source=filter==='history'?history:waiting.filter(row=>filter==='all'||row.kind===filter);
  return source.filter(row=>(row.title+' '+row.agencyLabel+' '+row.kind+
   ' '+(row.brand||row.client||'')).toLocaleLowerCase('el-GR').includes(query))
   .sort((a,b)=>new Date(timeOf(b)||0)-new Date(timeOf(a)||0));
 },[all,search,filter]);
 const submitDecision=async(item,decision,rejectionReason='')=>{
  setBusy(item.key);setError('');setNotice('');
  try{
   const parent=campaignMap.get(String(item.campaignId||''));
   let url,payload;
   if(item.kind==='campaign'){
    url='/api/admin/advertising/campaigns/'+item._id+'/approval';
    payload={approval:decision,reason:rejectionReason};
   }else if(item.kind==='revision'){
    url='/api/admin/agency-ad-revisions/'+item._id+'/decision';
    payload={decision:decision==='approved'?'approve':'reject',reason:rejectionReason};
   }else if(decision==='rejected'){
    const campaignPending=parent?.approvalStatus==='pending';
    url=campaignPending?
     '/api/admin/advertising/wizard/campaigns/'+item.campaignId+'/creatives-review/'+item.kind+'/'+item._id:
     '/api/admin/advertising/creatives/'+item.kind+'/'+item._id+'/reject';
    payload=campaignPending?{approval:'rejected',reason:rejectionReason}:{reason:rejectionReason};
   }else if(parent?.approvalStatus==='pending'){
    url='/api/admin/advertising/wizard/campaigns/'+item.campaignId+'/creatives-review/'+item.kind+'/'+item._id;
    payload={approval:'approved'};
   }else if(item.campaignId){
    throw Error('Εκκρεμεί μη υποστηριζόμενη αξιολόγηση δημιουργικού. Χρησιμοποιήστε τη ροή έγκρισης της καμπάνιας.');
   }else{
    url=item.kind==='audio'?'/api/admin/ads/'+item._id+'/approve':
     '/api/admin/banners/'+item._id+'/approve';
    payload={};
   }
   await request(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   setNotice('Η απόφαση αποθηκεύτηκε επιτυχώς.');
   setReasonTarget(null);setReason('');
   await reload();
  }catch(e){setError(e.message);}
  finally{setBusy('');}
 };
 return <main className="space-y-5">
  <section className={styles.panel+' space-y-5'}>
   <div className="flex flex-wrap items-start justify-between gap-4">
    <div><p className="text-xs font-black uppercase tracking-[.2em] text-purple-300">Advertising · Admin</p>
     <h2 className="mt-2 text-2xl font-black text-white">Ενιαίο Κέντρο Εγκρίσεων</h2>
     <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Όλες οι εκκρεμότητες από καμπάνιες, audio, visual και αλλαγές Agency. Κάθε απόφαση εφαρμόζεται από τις ήδη προστατευμένες ροές έγκρισης.</p></div>
    <button type="button" className={styles.secondary} onClick={()=>void reload()} disabled={loading||Boolean(busy)}>
     <RefreshCw size={15} className={loading?'animate-spin':''}/> Ανανέωση
    </button>
   </div>
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
    {[['all','Όλες'],['campaign','Καμπάνιες'],['audio','Audio'],['banner','Visual'],['revision','Αλλαγές']].map(([kind,label])=>{
     const count=waiting.filter(x=>kind==='all'||x.kind===kind).length;
     return <button type="button" key={kind} onClick={()=>setFilter(kind)}
       className={'rounded-xl border p-3 text-left transition '+(filter===kind?'border-purple-400/60 bg-purple-500/20':'border-white/10 bg-black/20 hover:border-purple-300/30')}>
       <span className="block text-xs text-zinc-300">{label}</span>
       <strong className="mt-2 block text-2xl font-black text-white tabular-nums">{count}</strong></button>;
    })}
   </div>
   <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-[#08090d] px-3">
     <Search size={17} className="text-zinc-400"/>
     <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Αναζήτηση Agency, πελάτη ή διαφήμισης"
      aria-label="Αναζήτηση εκκρεμοτήτων" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-white outline-none"/></label>
    <button type="button" onClick={()=>setFilter(filter==='history'?'all':'history')}
     className={styles.secondary+(filter==='history'?' border-purple-400/70':'')}>
     <Clock3 size={16}/> Ιστορικό ({history.length})
    </button>
   </div>
  </section>
  {error&&<p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{notice}</p>}
  {loading?<p role="status" className={styles.panel+' text-sm text-zinc-300'}><Loader2 size={16} className="mr-2 inline animate-spin"/>Ανανέωση εκκρεμοτήτων…</p>:
   shown.length===0?<div className={styles.panel+' py-12 text-center'}><ShieldCheck size={36} className="mx-auto text-purple-300"/>
    <h3 className="mt-4 font-black text-white">Δεν υπάρχουν {filter==='history'?'καταχωρίσεις ιστορικού':'εκκρεμότητες'} σε αυτή την προβολή.</h3>
    <p className="mt-2 text-xs text-zinc-400">Η λίστα ανανεώνεται και από τις ζωντανές αλλαγές διαφημίσεων.</p></div>:
   <div className="grid gap-4 xl:grid-cols-2">
    {shown.map(item=>{
     const Icon=kindIcons[item.kind];
     const parent=campaignMap.get(String(item.campaignId||''));
     const blockedApproval=item.isPending&&item.kind!=='campaign'&&item.kind!=='revision'&&
      Boolean(item.campaignId)&&parent?.approvalStatus!=='pending';
     return <article className={styles.panel+' space-y-4'} key={item.key}>
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div className="flex min-w-0 items-start gap-3"><div className="rounded-xl bg-purple-400/10 p-2 text-purple-200"><Icon size={19}/></div>
        <div className="min-w-0"><p className="text-[11px] font-bold text-purple-300">{kindLabels[item.kind]}</p>
         <h3 className="mt-1 break-words text-base font-black text-white">{item.title}</h3>
         <p className="mt-1 text-xs text-zinc-400">{item.agencyLabel}{item.brand?' · '+item.brand:''}</p></div></div>
       <span className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-1 text-xs text-zinc-200">{statuses[item.decisionStatus]||item.decisionStatus}</span>
      </div>
      {item.kind==='audio'&&item.audioUrl&&<ProtectedAudioPreview adId={item._id} sourceUrl={item.audioUrl} scope="admin"/>}
      {item.kind==='banner'&&item.imageUrl&&<img src={item.imageUrl} alt={'Προεπισκόπηση '+item.title} loading="lazy" className="max-h-44 w-full rounded-xl border border-white/10 bg-black/30 object-contain"/>}
      {item.kind==='revision'&&<div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
       <p>Τύπος: {item.creativeType==='audio'?'Audio':'Banner'} · ID: {String(item.creativeId||'')}</p>
       <p className="mt-2 break-words">Πεδία αλλαγής: {Object.keys(item.patch||{}).join(', ')||'—'}</p>
       {item.processing&&<p className="mt-2 text-amber-200">Η έγκριση είναι σε εξέλιξη. Επαναλάβετε την ίδια ενέργεια για ασφαλή ανάκτηση.</p>}
      </div>}
      {item.kind==='campaign'&&<p className="text-xs text-zinc-400">Πελάτης: {item.brand} · Ημερήσιο budget: {new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format((item.dailyBudgetCents||0)/100)}</p>}
      {item.kind!=='campaign'&&item.campaignId&&<p className="text-xs text-zinc-500">Καμπάνια: {parent?.title||String(item.campaignId)}</p>}
      {!item.isPending&&item.rejectedReason&&<p className="text-xs text-rose-200">Αιτιολογία: {item.rejectedReason}</p>}
      {item.rejectionReason&&<p className="text-xs text-rose-200">Αιτιολογία: {item.rejectionReason}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
       <p className="text-[11px] text-zinc-500">{timeOf(item)?new Date(timeOf(item)).toLocaleString('el-GR'):'—'}</p>
       {item.isPending&&<div className="flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(busy)||blockedApproval} onClick={()=>void submitDecision(item,'approved')} title={blockedApproval?'Η καμπάνια πρέπει να βρίσκεται σε έγκριση':undefined} className={styles.primary}>
         {busy===item.key?<Loader2 size={14} className="animate-spin"/>:<Check size={14}/>} Έγκριση</button>
        <button type="button" disabled={Boolean(busy)} onClick={()=>{setReasonTarget(item);setReason('');}} className={styles.secondary+' border-rose-400/25 text-rose-200'}>
         <XCircle size={15}/> Απόρριψη</button>
       </div>}
      </div>
     </article>;
    })}
   </div>}
  {reasonTarget&&<div role="presentation" className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
   onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setReasonTarget(null);}}>
   <section className="w-full max-w-lg rounded-3xl border border-rose-400/25 bg-[#15141e] p-6" role="dialog" aria-modal="true" aria-label="Αιτιολογία απόρριψης">
    <div className="flex items-center justify-between gap-2"><h3 className="text-lg font-black text-white">Απόρριψη διαφήμισης</h3>
     <button type="button" aria-label="Κλείσιμο" disabled={Boolean(busy)} onClick={()=>setReasonTarget(null)} className={styles.secondary}><X size={16}/></button></div>
    <p className="mt-3 text-sm text-zinc-300">{reasonTarget.title} · {reasonTarget.agencyLabel}</p>
    <label className="mt-4 block text-xs font-bold text-zinc-300">Αιτιολογία (υποχρεωτική, έως 1000 χαρακτήρες)
     <textarea rows={4} maxLength={1000} required value={reason} onChange={event=>setReason(event.target.value)}
      className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 p-3 text-sm text-white outline-none focus:border-rose-400" placeholder="Περιγράψτε τι χρειάζεται διόρθωση."/></label>
    <div className="mt-5 flex justify-end gap-2">
     <button type="button" className={styles.secondary} disabled={Boolean(busy)} onClick={()=>setReasonTarget(null)}>Άκυρο</button>
     <button type="button" className={styles.primary+' border-rose-400/40 bg-rose-500/20 text-rose-100'}
      disabled={reason.trim().length<3||Boolean(busy)}
      onClick={()=>void submitDecision(reasonTarget,'rejected',reason.trim())}>
      {busy?<Loader2 size={14} className="animate-spin"/>:<XCircle size={14}/>} Επιβεβαίωση απόρριψης</button>
    </div>
   </section>
  </div>}
 </main>;
}
