import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {LOCATION_DATA} from '../utils/stationLocations';
const bg='rounded-2xl border border-white/10 bg-[#151321] p-5';
const input='w-full rounded-xl border border-white/10 bg-[#090910] p-3 text-sm text-white focus:border-purple-400 outline-none';
const button='rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40';
const headers=()=>({Authorization:'Bearer '+(localStorage.getItem('iluma_token')||''),
 'Content-Type':'application/json'});
const money=micros=>(Number(micros||0)/1000000).toFixed(2);
const toLocal=millis=>{
 const date=new Date(millis);
 return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
export default function AgencyAdvertisingV2(){
 const [campaigns,setCampaigns]=useState([]),[pricing,setPricing]=useState(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [activeId,setActiveId]=useState(null),[budget,setBudget]=useState('100.00');
 const [quote,setQuote]=useState(null),[finance,setFinance]=useState(null);
 const [draft,setDraft]=useState({title:'',brand:'',description:'',
  country:'Ελλάδα',region:'All',prefecture:'Ελλάδα',
  startsAt:toLocal(Date.now()+3600000),endsAt:toLocal(Date.now()+10*86400000+3600000)});
 const reload=useCallback(async()=>{
  try{
   const [a,b]=await Promise.all([
    fetch('/api/advertising/campaigns',{headers:headers()}),
    fetch('/api/advertising/pricing',{headers:headers()})]);
   const [ca,pr]=await Promise.all([a.json(),b.json()]);
   if(!a.ok||!b.ok)throw Error(ca.error||pr.error||'Δεν φορτώθηκαν οι καμπάνιες.');
   setCampaigns(ca);setPricing(pr);
  }catch(e){setNotice(e.message);}
 },[]);
 useEffect(()=>{reload();},[reload]);
 const current=campaigns.find(c=>c._id===activeId);
 const regions=LOCATION_DATA[draft.country]||{};
 const prefectures=regions[draft.region]||{};
 const create=async e=>{
  e.preventDefault();setBusy(true);setNotice('');
  try{
   const r=await fetch('/api/advertising/campaigns',{method:'POST',headers:headers(),
    body:JSON.stringify({...draft,startsAt:new Date(draft.startsAt).toISOString(),
     endsAt:new Date(draft.endsAt).toISOString()})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Δεν δημιουργήθηκε η καμπάνια.');
   setActiveId(data._id);setNotice('Η ενιαία καμπάνια δημιουργήθηκε ως draft.');
   await reload();
  }catch(error){setNotice(error.message);}finally{setBusy(false);}
 };
 const toggle=async c=>{
  setBusy(true);setNotice('');
  try{
   const r=await fetch('/api/advertising/campaigns/'+c._id+'/enabled',{
    method:'PATCH',headers:headers(),body:JSON.stringify({enabled:!c.agencyEnabled})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Δεν άλλαξε η κατάσταση.');
   await reload();
  }catch(e){setNotice(e.message);}finally{setBusy(false);}
 };
 const requestQuote=async()=>{
  if(!current)return;
  const amountCents=Math.round(Number(budget)*100);
  if(!Number.isSafeInteger(amountCents)||amountCents<100){setNotice('Μη έγκυρο budget.');return;}
  setBusy(true);setNotice('');setQuote(null);
  try{
   const kind=current.budget.fundedMicros>0?'topup':'initial';
   const r=await fetch('/api/advertising/campaigns/'+current._id+'/quotes',{
    method:'POST',headers:headers(),body:JSON.stringify({kind,budgetCents:amountCents})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Δεν δημιουργήθηκε quote.');
   setQuote(data);
  }catch(e){setNotice(e.message);}finally{setBusy(false);}
 };
 const checkout=async()=>{
  if(!quote)return;
  setBusy(true);setNotice('');
  try{
   const r=await fetch('/api/advertising/quotes/'+quote._id+'/checkout',{
    method:'POST',headers:headers()});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'Η πληρωμή δεν ξεκίνησε.');
   if(data.checkoutUrl){
    window.location.assign(data.checkoutUrl);
   }else setNotice('Gateway: '+data.status+' · αναμονή επιβεβαίωσης.');
  }catch(e){setNotice(e.message);}finally{setBusy(false);}
 };
 const recover=async intent=>{
  setBusy(true);setNotice('');
  try{
   const r=await fetch('/api/advertising/payments/'+intent._id,{headers:headers()});
   const d=await r.json();
   if(!r.ok)throw Error(d.error||'Η ανάκτηση πληρωμής δεν ολοκληρώθηκε.');
   setNotice(d.status==='paid'?'Η πληρωμή έχει πιστωθεί.':
     'Η απάντηση του Nexi δεν αποτελεί απόδειξη πληρωμής. Αναμονή υπογεγραμμένης επιβεβαίωσης.');
   if(activeId)await openFinance(activeId);
  }catch(e){setNotice(e.message);}finally{setBusy(false);}
 };
 const openFinance=async id=>{
  setActiveId(id);setQuote(null);
  try{
   const r=await fetch('/api/advertising/campaigns/'+id+'/finance',{headers:headers()});
   const d=await r.json();if(r.ok)setFinance(d);else setNotice(d.error);
  }catch(e){setNotice(e.message);}
 };
 return <div className="mx-auto w-full max-w-6xl space-y-5 pb-20 text-white">
  <header className={bg+' flex flex-wrap justify-between gap-3'}>
   <div><p className="text-xs font-black uppercase tracking-widest text-purple-300">Advertising Network v2</p>
    <h1 className="mt-2 text-3xl font-black">Οι ενιαίες καμπάνιες μου</h1>
    <p className="mt-2 text-sm text-zinc-400">Visual + Audio · κοινό προπληρωμένο budget · έγκριση Admin.</p></div>
   <Link to="/agency/dashboard" className="self-start rounded-xl border border-white/20 px-4 py-2.5 text-sm text-zinc-200">Επιστροφή</Link>
  </header>
  {typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('gateway_return')&&
   <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-100">
    Η επιστροφή από τη Nexi δεν επιβεβαιώνει μόνη της την πληρωμή. Το budget πιστώνεται μόνο μετά από υπογεγραμμένο webhook.
   </div>}
  {notice&&<div role="status" className="rounded-xl border border-purple-400/30 bg-purple-400/10 p-4 text-sm text-purple-100">{notice}</div>}
  <form className={bg+' space-y-4'} onSubmit={create}>
   <h2 className="text-lg font-black">Νέα καμπάνια</h2>
   <div className="grid gap-3 sm:grid-cols-2">
    <input className={input} required placeholder="Τίτλος καμπάνιας" value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))}/>
    <input className={input} required placeholder="Brand" value={draft.brand} onChange={e=>setDraft(d=>({...d,brand:e.target.value}))}/>
    <input className={input} type="datetime-local" value={draft.startsAt} onChange={e=>setDraft(d=>({...d,startsAt:e.target.value}))}/>
    <input className={input} type="datetime-local" value={draft.endsAt} onChange={e=>setDraft(d=>({...d,endsAt:e.target.value}))}/>
   </div>
   <textarea className={input} placeholder="Περιγραφή" rows={2} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))}/>
   <div className="grid gap-3 sm:grid-cols-3">
    <select className={input} value={draft.country} onChange={e=>setDraft(d=>({...d,country:e.target.value,region:'All',prefecture:e.target.value}))}>
     {Object.keys(LOCATION_DATA).map(k=><option key={k} value={k}>{k}</option>)}</select>
    <select className={input} value={draft.region} onChange={e=>setDraft(d=>({...d,region:e.target.value,prefecture:e.target.value==='All'?d.country:e.target.value}))}>
     <option value="All">Όλη η χώρα</option>{Object.keys(regions).map(k=><option key={k}>{k}</option>)}</select>
    <select className={input} value={draft.prefecture} disabled={draft.region==='All'}
     onChange={e=>setDraft(d=>({...d,prefecture:e.target.value}))}>
     <option value={draft.region==='All'?draft.country:draft.region}>Όλη η Περιφέρεια</option>
     {Object.keys(prefectures).map(k=><option key={k}>{k}</option>)}</select>
   </div>
   <p className="text-xs text-purple-200">Στόχευση μόνο Χώρα / Περιφέρεια / Νομός. Δεν επιλέγονται πόλεις.</p>
   <button className={button} disabled={busy}>Δημιουργία draft</button>
  </form>
  <section className="space-y-3">
   <h2 className="text-lg font-black">Καμπάνιες</h2>
   {!campaigns.length&&<p className="text-sm text-zinc-400">Δεν υπάρχουν καμπάνιες.</p>}
   {campaigns.map(c=><div className={bg+' space-y-3'} key={c._id}>
    <div className="flex flex-wrap justify-between gap-3">
     <div><h3 className="font-black">{c.title}</h3>
      <p className="text-xs text-zinc-400">{c.brand} · {c.region} / {c.prefecture}</p></div>
     <span className="text-sm text-purple-300">{c.approvalStatus}</span>
    </div>
    <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-3">
     <span>Προπληρωμένο: €{money(c.budget.fundedMicros)}</span>
     <span>Υπόλοιπο: €{money(c.budget.remainingMicros)}</span>
     <span>{c.agencyEnabled?'Agency ON':'Agency OFF'}{c.adminSuspended?' · Αναστολή Admin':''}</span>
    </div>
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={()=>openFinance(c._id)} className={button}>Budget / Top-up</button>
     <button type="button" disabled={busy} onClick={()=>toggle(c)} className="rounded-xl border border-purple-300/30 px-4 py-2 text-sm text-purple-200">{c.agencyEnabled?'Απενεργοποίηση':'Ενεργοποίηση'}</button>
     <Link className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white" to={'/agency/campaigns/banners/new?campaignId='+c._id}>Νέο Visual</Link>
     <Link className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white" to={'/agency/campaigns/audio/new?campaignId='+c._id}>Νέο Audio</Link>
    </div>
   </div>)}
  </section>
  {current&&<section className={bg+' space-y-4'}>
   <h2 className="text-lg font-black">Χρηματοδότηση: {current.title}</h2>
   <p className="text-sm text-zinc-400">Το top-up πιστώνει την ίδια καμπάνια. Δεν αντικαθιστά παλαιές πληρωμές ή CPM snapshots.</p>
   <label className="block text-sm">Budget (€)
    <input type="number" min="1" step="0.01" className={input+' mt-2'} value={budget} onChange={e=>setBudget(e.target.value)}/></label>
   <button type="button" onClick={requestQuote} disabled={busy||!pricing?.enabled} className={button}>Υπολογισμός ασφαλούς quote</button>
   {!pricing?.enabled&&<p className="text-xs text-amber-200">Οι πληρωμές δεν είναι ακόμη ενεργές. Αναμένεται οριστικοποίηση τιμολογιακής και φορολογικής πολιτικής.</p>}
   {quote&&<div className="rounded-xl bg-purple-500/10 p-4 text-sm space-y-2">
    <p>Budget: €{(quote.budgetCents/100).toFixed(2)} · Φόρος: €{(quote.taxCents/100).toFixed(2)}</p>
    <p className="font-black">Πληρωτέο: €{(quote.paymentCents/100).toFixed(2)}</p>
    <p>Τιμοκατάλογος v{quote.priceVersion} · Ισχύς quote έως {new Date(quote.expiresAt).toLocaleString('el-GR')}</p>
    <button type="button" className={button} disabled={busy} onClick={checkout}>Συνέχεια σε Nexi Sandbox</button>
   </div>}
   {finance&&finance.campaignId===current._id&&<div className="space-y-2 text-sm text-zinc-400">
    <p>Πληρωμές: {finance.intents.length} · Funding lots: {finance.lots.length}</p>
    {finance.affordability&&<p role="status" className="rounded-xl border border-purple-400/20 bg-purple-500/5 p-3 text-sm text-purple-100">
     {({
      funded:'Υπάρχει διαθέσιμο budget για την επόμενη επιλέξιμη προβολή.',
      exhausted:'Το διαθέσιμο budget έχει εξαντληθεί. Μπορείς να προσθέσεις νέο budget.',
      below_minimum_event_cost:'Το υπόλοιπο δεν επαρκεί για νέα χρέωση CPM. Χρειάζεται top-up.',
      receipt_capacity_blocked:'Η εκκαθάριση απαιτεί τεχνικό έλεγχο. Δεν επιτρέπεται νέα χρέωση.',
      needs_financial_review:'Το οικονομικό υπόλοιπο απαιτεί επαλήθευση από τον Admin.',
      not_funded:'Δεν υπάρχει ακόμη επιβεβαιωμένο budget.',
      no_active_creatives:'Δεν υπάρχουν εγκεκριμένα ενεργά δημιουργικά για εκκαθάριση.'
     })[finance.affordability.status]||'Η κατάσταση budget ελέγχεται.'}
    </p>}
    {finance.intents.map(intent=><div className="flex flex-wrap items-center gap-2" key={intent._id}><span>{new Date(intent.createdAt).toLocaleString('el-GR')} · €{(intent.amountCents/100).toFixed(2)} · {intent.status}</span>{['creating','redirect','unknown'].includes(intent.status)&&<button className="rounded-lg border border-purple-400/40 px-3 py-1 text-xs text-purple-100 disabled:opacity-40" type="button" disabled={busy} onClick={()=>recover(intent)}>Έλεγχος Gateway (μόνο ανάγνωση)</button>}</div>)}
   </div>}
  </section>}
 </div>;
}
