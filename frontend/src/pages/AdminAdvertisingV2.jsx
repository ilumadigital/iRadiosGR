import React,{useCallback,useEffect,useState} from 'react';
import {adminFetch as fetch} from '../utils/adminFetch';
import AdvertisingCampaignWizard from './AdvertisingCampaignWizard';
import ProtectedAudioPreview from '../components/ProtectedAudioPreview';

const panel='rounded-2xl border border-white/10 bg-[#14131f] p-5';
const input='mt-1 w-full rounded-xl border border-white/10 bg-[#08090d] p-3 text-white focus:border-purple-400 outline-none';
const primary='rounded-xl bg-purple-600 px-4 py-2.5 font-black text-white disabled:opacity-40';
const euros=cents=>(Number(cents||0)/100).toFixed(2);
const rate=micros=>(Number(micros||0)/1000000).toFixed(3);
function TextField({label,value,onChange,type='number',step='1'}){
 return <label className="block text-xs font-bold text-zinc-300">{label}
  <input className={input} value={value??''} onChange={e=>onChange(
   type==='number'?Number(e.target.value):e.target.value)} type={type} step={step}/>
 </label>;
}
export default function AdminAdvertisingV2({mode='pricing',currentUser}){
 const [pricing,setPricing]=useState(null),[campaigns,setCampaigns]=useState([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [auditByCampaign,setAuditByCampaign]=useState({});
 const [auditBusyId,setAuditBusyId]=useState(null);
 const [mailRows,setMailRows]=useState(null),[mailLoading,setMailLoading]=useState(false);
 const [reviewId,setReviewId]=useState(null),[reviewCreatives,setReviewCreatives]=useState(null);
 const reload=useCallback(async()=>{
  setLoading(true);setNotice('');
  try{
   const endpoint=mode==='pricing'?'/api/advertising/pricing':'/api/advertising/campaigns';
   const r=await fetch(endpoint);
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Αποτυχία φόρτωσης.');
   if(mode==='pricing')setPricing(data);else setCampaigns(data.filter(c=>
    c.workflowVersion!==2||c.createdByRole==='admin'||c.approvalStatus!=='draft'));
  }catch(e){setNotice(e.message);}finally{setLoading(false);}
 },[mode]);
 useEffect(()=>{reload();},[reload]);
 const update=(key,v)=>setPricing(p=>({...p,[key]:v}));
 const updateRate=(key,v)=>setPricing(p=>({...p,cpmMicros:{
  ...p.cpmMicros,[key]:Math.round(v*1000000)}}));
 const save=async()=>{
  setBusy(true);setNotice('');
  try{
   const data={expectedVersion:pricing.version,
    cpmMicros:pricing.cpmMicros,minBudgetCents:pricing.minBudgetCents,
    maxBudgetCents:pricing.maxBudgetCents,minTopupCents:pricing.minTopupCents,
    durationDays:pricing.durationDays,taxMode:pricing.taxMode,
    taxBps:pricing.taxMode==='unconfigured'?null:pricing.taxBps,
    enabled:pricing.enabled};
   const r=await fetch('/api/admin/advertising/pricing',{method:'PUT',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const answer=await r.json();
   if(!r.ok)throw Error(answer.error||'Αποτυχία αποθήκευσης.');
   setPricing(answer);setNotice('Ο νέος τιμοκατάλογος αποθηκεύτηκε ως έκδοση '+answer.version);
  }catch(e){setNotice(e.message);}finally{setBusy(false);}
 };
 const decide=async(id,action)=>{
  const reason=action==='rejected'?window.prompt('Αιτιολογία απόρριψης:',''):'';
  if(action==='rejected'&&!reason?.trim())return;
  setBusy(true);setNotice('');
  try{
   const r=await fetch('/api/admin/advertising/campaigns/'+id+'/approval',{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({approval:action,reason})});
   const answer=await r.json();
   if(!r.ok)throw Error(answer.error||'Η αλλαγή δεν ολοκληρώθηκε.');
   setCampaigns(list=>list.map(c=>c._id===id?{...c,...answer}:c));
  }catch(e){setNotice(e.message);}finally{setBusy(false);}
 };
 const auditCampaign=async(id)=>{
  setAuditBusyId(id);setNotice('');
  try{
   const r=await fetch('/api/admin/advertising/campaigns/'+id+'/reconciliation');
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Αδυναμία οικονομικού ελέγχου.');
   setAuditByCampaign(current=>({...current,[id]:data}));
  }catch(e){setNotice(e.message);}finally{setAuditBusyId(null);}
 };
 const suspend=async(c)=>{
  setBusy(true);setNotice('');
  try{
   const r=await fetch('/api/admin/advertising/campaigns/'+c._id+'/suspend',{
    method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({suspended:!c.adminSuspended})});
   const answer=await r.json();
   if(!r.ok)throw Error(answer.error||'Δεν άλλαξε η αναστολή.');
   setCampaigns(list=>list.map(row=>row._id===c._id?{...row,...answer}:row));
  }catch(e){setNotice(e.message);}finally{setBusy(false);}
 };
 const loadReview=async id=>{
  setNotice('');setReviewId(id);setReviewCreatives(null);
  try{
   const r=await fetch('/api/admin/advertising/wizard/campaigns/'+id+'/creatives-review');
   const data=await r.json();if(!r.ok)throw Error(data.error||'Δεν φορτώθηκαν τα δημιουργικά.');
   setReviewCreatives(data);
  }catch(e){setNotice(e.message);}
 };
 const reviewCreative=async(kind,id,approval)=>{
  setBusy(true);setNotice('');
  try{
   const r=await fetch('/api/admin/advertising/wizard/campaigns/'+reviewId+'/creatives-review/'+kind+'/'+id,{
    method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({approval})});
   const result=await r.json();if(!r.ok)throw Error(result.error||'Η αξιολόγηση απέτυχε.');
   await loadReview(reviewId);await reload();
   setNotice('Η απόφαση για το δημιουργικό αποθηκεύτηκε.');
  }catch(e){setNotice(e.message);}finally{setBusy(false);}
 };
 const loadAgencyMail=async()=>{
  setMailLoading(true);setNotice('');
  try{
   const response=await fetch('/api/admin/agency-ad-notices');
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Αδυναμία ανάκτησης Mailpit outbox.');
   setMailRows(Array.isArray(data)?data:[]);
  }catch(e){setNotice(e.message);}finally{setMailLoading(false);}
 };
 if(loading)return <div className={panel+' text-zinc-300'}>Φόρτωση Advertising v2…</div>;
 return <div className="space-y-5">
  {notice&&<div role="status" className="rounded-xl border border-purple-400/30 bg-purple-400/10 p-4 text-sm text-purple-100">{notice}</div>}
  {mode==='pricing'&&pricing&&<>
   <section className={panel+' space-y-5'}>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <h2 className="text-xl font-black text-white">Τιμολόγηση διαφημίσεων</h2>
     <span className="rounded-full bg-purple-500/15 px-3 py-1 text-sm text-purple-100">Έκδοση {pricing.version}</span>
    </div>
    <p className="text-sm text-zinc-400">Αλλαγές τιμών εφαρμόζονται μόνο σε νέες αγορές και top-ups. Τα παλαιά funding lots κρατούν τις αρχικές CPM τιμές τους.</p>
    <div className="grid gap-4 sm:grid-cols-3">
     {['standard','hero','audio'].map(key=><TextField key={key} label={{standard:'Standard Banner CPM (€)',hero:'Homepage Hero CPM (€)',audio:'Audio CPM (€)'}[key]}
      value={rate(pricing.cpmMicros?.[key])} onChange={v=>updateRate(key,v)} step="0.001"/>)}
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
     {['minBudgetCents','maxBudgetCents','minTopupCents'].map(key=><TextField key={key}
      label={{minBudgetCents:'Ελάχιστο budget (€)',maxBudgetCents:'Μέγιστο budget (€)',minTopupCents:'Ελάχιστο top-up (€)'}[key]}
      value={euros(pricing[key])} onChange={v=>update(key,Math.round(v*100))} step="0.01"/>)}
    </div>
    <label className="block text-xs font-bold text-zinc-300">Επιτρεπόμενες διάρκειες (ημέρες, χωρισμένες με κόμμα)
     <input className={input} value={(pricing.durationDays||[]).join(',')}
      onChange={e=>update('durationDays',e.target.value.split(',').map(v=>Number(v.trim())))}/>
    </label>
    <div className="grid gap-4 sm:grid-cols-2">
     <label className="block text-xs font-bold text-zinc-300">Φορολογική πολιτική (απαιτεί ρητή επιλογή)
      <select className={input} value={pricing.taxMode}
       onChange={e=>{update('taxMode',e.target.value);update('enabled',false);}}>
       <option value="unconfigured">Δεν έχει καθοριστεί — checkout κλειστό</option>
       <option value="budget_net_plus_vat">Καθαρό budget + ΦΠΑ στο πληρωτέο</option>
      </select>
     </label>
     <TextField label="ΦΠΑ %" value={pricing.taxBps==null?'':pricing.taxBps/100}
      onChange={v=>update('taxBps',Math.round(v*100))} step="0.01"/>
    </div>
    <label className="flex items-center gap-3 text-sm text-purple-100">
     <input type="checkbox" checked={pricing.enabled===true}
      disabled={pricing.taxMode==='unconfigured'}
      onChange={e=>update('enabled',e.target.checked)} />
     Ενεργός τιμοκατάλογος για νέα quotes (η πραγματική πληρωμή απαιτεί επιπλέον Gateway sandbox flag)
    </label>
    <button type="button" className={primary} disabled={busy} onClick={save}>Αποθήκευση νέας έκδοσης</button>
   </section>
   <section className={panel}>
    <h3 className="mb-3 font-black text-white">Audit τιμολόγησης</h3>
    <div className="max-h-64 space-y-2 overflow-auto text-sm text-zinc-300">
     {(pricing.history||[]).slice().reverse().map((entry,i)=><p key={i}>Έκδοση {entry.version} · {new Date(entry.at).toLocaleString('el-GR')}</p>)}
     {!pricing.history?.length&&<p>Δεν υπάρχουν προηγούμενες εκδόσεις.</p>}
    </div>
   </section>
  </>}
  {mode==='campaigns'&&<>
   <AdvertisingCampaignWizard role="admin" currentUser={currentUser}/>
   <div className="mt-10 border-t border-white/10 pt-8"><h2 className="text-2xl font-black text-white">Έλεγχος πληρωμένων Agency καμπανιών</h2>
   <p className="mt-2 text-sm text-zinc-400">Οι νέες καμπάνιες εμφανίζονται εδώ μόνο μετά από επιβεβαιωμένη πληρωμή και τελική υποβολή Agency.</p></div>
   <section className={panel+' space-y-3'}>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div>
      <h3 className="font-black text-white">Ειδοποιήσεις Agency · Mailpit Outbox</h3>
      <p className="mt-1 text-xs text-zinc-400">Μόνιμη ουρά ανά παραλήπτη · read-only έλεγχος. Η καταχώριση δεν αποδεικνύει παράδοση στο inbox.</p>
     </div>
     <button type="button" disabled={mailLoading}
      className="rounded-xl border border-purple-400/40 px-4 py-2 text-sm font-bold text-purple-200 disabled:opacity-50"
      onClick={loadAgencyMail}>{mailLoading?'Φόρτωση…':'Ανανέωση ουράς'}</button>
    </div>
    {mailRows!==null&&<>
     <div className="flex flex-wrap gap-2 text-xs font-bold">
      {['pending','sending','sent','superseded'].map(status=>
       <span key={status} className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-zinc-200">
        {({pending:'Εκκρεμούν',sending:'Σε αποστολή',sent:'SMTP accepted',superseded:'Δεν χρειάζονται'})[status]}: {mailRows.filter(row=>row.status===status).length}
       </span>)}
     </div>
     <div className="max-h-72 space-y-2 overflow-y-auto">
      {mailRows.slice(0,20).map(row=><div key={row._id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
       <div className="flex flex-wrap justify-between gap-2">
        <span className="font-bold text-purple-100 break-all">{row.subject}</span>
        <span className="text-zinc-300">{row.status}</span>
       </div>
       <p className="mt-1 text-zinc-400 break-all">{row.recipientEmail} · Προσπάθειες: {row.attempts} · {new Date(row.createdAt).toLocaleString('el-GR')}</p>
       {row.lastError&&<p className="mt-1 text-rose-300">{row.lastError}</p>}
      </div>)}
      {!mailRows.length&&<p className="text-sm text-zinc-500">Δεν υπάρχουν καταχωρημένες ειδοποιήσεις Agency.</p>}
     </div>
    </>}
   </section>

   {!campaigns.length&&<div className={panel+' text-zinc-300'}>Δεν έχουν δημιουργηθεί unified campaigns.</div>}
   {campaigns.map(c=><section className={panel+' space-y-3'} key={c._id}>
    <div className="flex flex-wrap justify-between gap-2">
     <div><h3 className="font-black text-white">{c.title}</h3>
      <p className="text-xs text-zinc-400">{c.brand} · {c.region} / {c.prefecture}</p></div>
     <span className="text-sm text-purple-200">{c.approvalStatus}</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-3 text-sm text-zinc-300">
     <span>Πληρωμένο budget: €{(c.budget.fundedMicros/1000000).toFixed(2)}</span>
     <span>Υπόλοιπο: €{(c.budget.remainingMicros/1000000).toFixed(2)}</span>
     <span>{c.adminSuspended?'Αναστολή Admin':'Χωρίς αναστολή'}</span>
    </div>
    <div className="flex flex-wrap gap-2">
     {c.approvalStatus==='pending'&&<>
      <button type="button" disabled={busy} className="rounded-xl border border-purple-400/40 bg-purple-500/10 px-4 py-2.5 text-sm font-bold text-purple-200" onClick={()=>loadReview(c._id)}>Έλεγχος δημιουργικών</button>
      <button disabled={busy} className={primary} onClick={()=>decide(c._id,'approved')}>Έγκριση</button>
      <button disabled={busy} className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm text-rose-200" onClick={()=>decide(c._id,'rejected')}>Απόρριψη</button>
     </>}
     <button disabled={busy} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-300" onClick={()=>suspend(c)}>
      {c.adminSuspended?'Άρση αναστολής':'Αναστολή καμπάνιας'}</button>
     <button type="button" disabled={auditBusyId===c._id}
      className="rounded-xl border border-purple-400/40 px-4 py-2 text-sm text-purple-200 disabled:opacity-50"
      onClick={()=>auditCampaign(c._id)}>
      {auditBusyId===c._id?'Έλεγχος…':'Οικονομικό audit'}</button>
    </div>
    {reviewId===c._id&&<section className="space-y-3 rounded-2xl border border-purple-400/25 bg-purple-500/[.04] p-4">
     <h4 className="font-black text-white">Δημιουργικά προς έγκριση</h4>
     {reviewCreatives===null?<p className="text-xs text-zinc-400">Φόρτωση δημιουργικών…</p>:<div className="grid gap-3 md:grid-cols-2">{[
      ...(reviewCreatives.banners||[]).map(a=>({...a,kind:'banner'})),
      ...(reviewCreatives.audios||[]).map(a=>({...a,kind:'audio'}))
     ].map(ad=><div key={ad._id} className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3"><p className="font-black text-white">{ad.title}</p><span className="text-xs text-purple-200">{ad.status}</span></div>
      <p className="mt-2 text-xs text-zinc-400">{ad.kind==='banner'?ad.placement?.join(', '):ad.frequency}</p>
      {ad.kind==='banner'&&ad.imageUrl&&<img src={ad.imageUrl} alt={ad.title} className="mt-3 h-32 w-full rounded-xl object-contain"/>}
      {ad.kind==='audio'&&<div className="mt-3"><ProtectedAudioPreview scope="admin" adId={ad._id} sourceUrl={ad.audioUrl}/></div>}
      {ad.status==='pending'&&<div className="mt-4 flex flex-wrap gap-2">
       <button type="button" className={primary} disabled={busy} onClick={()=>reviewCreative(ad.kind,ad._id,'approved')}>Έγκριση</button>
       <button type="button" className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-200" disabled={busy} onClick={()=>reviewCreative(ad.kind,ad._id,'rejected')}>Απόρριψη</button>
      </div>}
     </div>)}</div>}
    </section>}
    {auditByCampaign[c._id]&&<div role="status" className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-200">
     <p className="font-bold text-purple-100">
      {auditByCampaign[c._id].safe?'Οι χρεώσεις συμφωνούν':'Απαιτείται οικονομικός έλεγχος'}
     </p>
     <p className="mt-1 text-zinc-400">Funding lots: {auditByCampaign[c._id].fundedLots}
      {' · '}Χρεωμένα events: {auditByCampaign[c._id].charged}
      {' · '}Εκκρεμή: {auditByCampaign[c._id].pending}</p>
     {auditByCampaign[c._id].issues?.length>0&&
      <div className="mt-2 max-h-32 overflow-auto text-xs text-rose-300">
       {auditByCampaign[c._id].issues.slice(0,20).map((issue,i)=><p key={i}>{issue}</p>)}
      </div>}
     <p className="mt-2 text-xs text-zinc-500">Έλεγχος μόνο για ανάγνωση. Δεν αλλάζει budget ή πληρωμές.</p>
    </div>}
   </section>)}
  </>}
 </div>;
}
