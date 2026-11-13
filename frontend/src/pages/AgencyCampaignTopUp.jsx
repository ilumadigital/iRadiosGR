import React,{useState} from 'react';
import {adminFetch as fetch} from '../utils/adminFetch';
import {CreditCard,RefreshCw,Wallet} from 'lucide-react';

// Top-ups are a separate purchase against the SAME unified campaign and
// never resubmit a previously reviewed creative or reset approval status.
export default function AgencyCampaignTopUp({campaign,pricing,onRefresh}){
 const [amount,setAmount]=useState('50');
 const [quote,setQuote]=useState(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const request=async(path,body)=>{
  const res=await fetch('/api/advertising/'+path,{
   method:body===undefined?'GET':'POST',cache:'no-store',
   headers:body===undefined?{}:{'Content-Type':'application/json'},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(json.error||'Δεν ολοκληρώθηκε η ενέργεια.');
  return json;
 };
 const run=async fn=>{
  setBusy(true);setError('');setNotice('');
  try{await fn();}catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const make=()=>run(async()=>{
  const cents=Math.round(Number(amount)*100);
  if(!Number.isSafeInteger(cents)||cents<Number(pricing.minTopupCents))
   throw Error('Το top-up είναι κάτω από το ελάχιστο του τιμοκαταλόγου.');
  const result=await request('campaigns/'+campaign._id+'/quotes',{kind:'topup',budgetCents:cents});
  setQuote(result);setNotice('Δημιουργήθηκε νέο quote. Το αρχικό budget και οι CPM τιμές του παραμένουν ανέπαφα.');
 });
 const checkout=()=>run(async()=>{
  if(!quote)throw Error('Δημιούργησε πρώτα quote.');
  sessionStorage.setItem('iradios-ad-wizard-last-campaign',campaign._id);
  const result=await request('quotes/'+quote._id+'/checkout',{});
  if(result.checkoutUrl){window.location.assign(result.checkoutUrl);return;}
  setNotice('Η συναλλαγή αναμένει επιβεβαίωση.');
 });
 return <section className="rounded-[24px] border border-purple-400/20 bg-[#171320] p-5 sm:p-7">
  <div className="flex items-center gap-3"><span className="rounded-xl bg-purple-500/15 p-3 text-purple-300"><Wallet size={21}/></span><div>
   <h4 className="text-lg font-black text-white">Προσθήκη budget στην ίδια καμπάνια</h4>
   <p className="mt-1 text-xs text-zinc-400">Νέα πληρωμή, ίδια καμπάνια. Το ιστορικό και τα CPM snapshots διατηρούνται.</p></div></div>
  <div className="mt-5 flex flex-wrap items-end gap-3">
   <label className="text-xs font-bold text-zinc-300">Ποσό top-up (€)
    <input type="number" min={Number(pricing?.minTopupCents||1000)/100} step=".01" value={amount} onChange={e=>{setAmount(e.target.value);setQuote(null);}}
     className="mt-2 block w-48 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-purple-400"/></label>
   <button type="button" disabled={busy||!pricing?.enabled} onClick={make}
    className="rounded-xl border border-purple-400/35 bg-purple-500/15 px-5 py-3 text-sm font-black text-purple-100 disabled:opacity-50">Υπολογισμός top-up</button>
   {quote&&<button type="button" disabled={busy||!pricing?.sandboxCheckoutReady||new Date(quote.expiresAt)<new Date()} onClick={checkout}
    className="inline-flex items-center gap-2 rounded-xl bg-purple-500 px-5 py-3 text-sm font-black text-white disabled:opacity-40"><CreditCard size={16}/> Πληρωμή {new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(quote.paymentCents/100)}</button>}
   <button type="button" disabled={busy} onClick={()=>run(onRefresh)}
    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-zinc-300"><RefreshCw size={16}/> Έλεγχος πληρωμής</button>
  </div>
  {quote&&<p className="mt-3 text-xs text-zinc-400">Quote #{quote.priceVersion} · Budget {(quote.budgetCents/100).toFixed(2)} € · ΦΠΑ {(quote.taxCents/100).toFixed(2)} € · λήξη {new Date(quote.expiresAt).toLocaleString('el-GR')}</p>}
  {!pricing?.sandboxCheckoutReady&&<p className="mt-3 text-xs text-amber-200">Το Nexi Sandbox checkout δεν έχει ενεργοποιηθεί. Δεν θα γίνει χρέωση.</p>}
  {error&&<p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-xs text-purple-200">{notice}</p>}
 </section>;
}
