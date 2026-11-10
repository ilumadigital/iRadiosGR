import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft,RefreshCw,ShieldCheck,ReceiptText} from 'lucide-react';

const money=n=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format((n||0)/100);
const date=s=>s?new Intl.DateTimeFormat('el-GR',{timeZone:'Europe/Athens',
 dateStyle:'short',timeStyle:'short'}).format(new Date(s)):'—';
const tone={
 active:'text-lime-300',expired:'text-zinc-400',
 redirect:'text-amber-300',unknown:'text-orange-300',creating:'text-amber-300',
 failed:'text-red-300',canceled:'text-zinc-400',pending:'text-amber-300'
};
export default function AdminSandboxPayments({API_URL='/api'}){
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(true);
 const [error,setError]=useState(''),[selected,setSelected]=useState(null);
 const [filter,setFilter]=useState('all');
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{
   const res=await fetch(API_URL+'/admin/billing/sandbox-orders?limit=100',{
    headers:{Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`},
    cache:'no-store'});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw Error(data.error||'Τα sandbox payments δεν φορτώθηκαν.');
   setRows(data.orders||[]);
  }catch(e){setError(e.message);}
  finally{setBusy(false);}
 },[API_URL]);
 useEffect(()=>{load();},[load]);
 const items=filter==='all'?rows:rows.filter(x=>x.status===filter);
 return <main className="max-w-7xl mx-auto text-white p-4 lg:p-9 pb-40">
  <Link to="/backoffice/admin/billing" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
   <ArrowLeft size={16}/> Πίσω στις πληρωμές</Link>
  <div className="mt-6 flex flex-col sm:flex-row justify-between gap-4 sm:items-center">
   <div><h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3"><ReceiptText className="text-[#ccff00]"/> Nexi Sandbox Payments</h1>
    <p className="text-sm text-zinc-400 mt-2">Αρχικές χρεώσεις Listener Premium 3,99 €, webhook status και ιστορικό γεγονότων.</p>
   </div>
   <button onClick={load} disabled={busy}
     className="inline-flex items-center gap-2 px-4 py-3 border border-white/15 rounded-xl text-sm font-semibold disabled:opacity-50">
    <RefreshCw size={16}/> Ανανέωση</button>
  </div>
  <div className="my-6 flex items-center gap-3 text-xs text-zinc-400 border border-[#ccff00]/20 bg-[#ccff00]/5 rounded-xl p-4">
   <ShieldCheck size={18} className="text-[#ccff00] shrink-0"/>
   Sandbox μόνο · Οι συναλλαγές εμφανίζονται ως πληρωμένες αποκλειστικά μετά από υπογεγραμμένο Gateway webhook. Δεν εκτελείται αυτόματη ανανέωση.
  </div>
  {error&&<p role="alert" className="text-red-300 p-4 rounded-xl border border-red-500/30">{error}</p>}
  <div className="flex gap-3 items-center mb-4">
   <label htmlFor="billing-filter" className="text-xs text-zinc-400">Κατάσταση</label>
   <select id="billing-filter" value={filter} onChange={e=>setFilter(e.target.value)}
    className="bg-zinc-900 border border-white/15 rounded-lg px-3 py-2 text-sm text-white">
    <option value="all">Όλες</option>
    {['active','pending','redirect','unknown','failed','canceled','expired'].map(x=><option key={x} value={x}>{x}</option>)}
   </select>
   <span className="text-xs text-zinc-500">{items.length} / {rows.length}</span>
  </div>
  {busy&&<p className="text-zinc-400 p-6">Φόρτωση...</p>}
  {!busy&&<div className="overflow-x-auto border border-white/10 rounded-2xl bg-zinc-950/70">
   <table className="w-full text-left text-sm">
    <thead className="text-[11px] uppercase text-zinc-400 tracking-wider bg-white/5">
     <tr><th className="p-4">Χρήστης</th><th className="p-4">Προϊόν</th>
      <th className="p-4">Ποσό</th><th className="p-4">Κατάσταση</th>
      <th className="p-4">Ημερομηνία</th><th className="p-4">Logs</th></tr>
    </thead>
    <tbody className="divide-y divide-white/10">
    {items.map(o=><React.Fragment key={o.id}>
      <tr className="hover:bg-white/[.03]">
       <td className="p-4"><strong className="block">{o.account?.username||'Χρήστης'}</strong>
        <span className="block text-xs text-zinc-500">{o.account?.email||''}</span></td>
       <td className="p-4 font-semibold">{o.sku}</td>
       <td className="p-4">{money(o.amountCents)}</td>
       <td className={'p-4 font-bold '+(tone[o.status]||'text-white')}>{o.status}</td>
       <td className="p-4 text-xs text-zinc-400 whitespace-nowrap">{date(o.createdAt)}</td>
       <td className="p-4"><button type="button" onClick={()=>setSelected(selected===o.id?null:o.id)}
        className="border border-white/15 rounded-lg px-3 py-2 text-xs hover:bg-white/10">
        {selected===o.id?'Κλείσιμο':'Λεπτομέρειες'}</button></td>
      </tr>
      {selected===o.id&&<tr><td colSpan={6} className="p-4 lg:p-6 bg-black/70">
       <div className="grid md:grid-cols-2 gap-3 text-xs text-zinc-400">
        <div>Payment ID: <code className="text-zinc-200 break-all">{o.gatewayPaymentId||'Δεν έχει εκδοθεί'}</code></div>
        <div>Order ID: <code className="text-zinc-200 break-all">{o.gatewayOrderId||'Δεν έχει εκδοθεί'}</code></div>
        <div>Provider status: <strong className="text-white">{o.providerStatus||'—'}</strong></div>
        <div>Περίοδος μέχρι: <strong className="text-white">{date(o.periodEndsAt)}</strong></div>
       </div>
       <h3 className="mt-5 mb-2 text-xs font-bold">Υπογεγραμμένα Gateway Events</h3>
       {(o.events||[]).length===0?<p className="text-xs text-zinc-500">Δεν έχει ληφθεί ακόμη επιβεβαιωμένο webhook.</p>:
        <div className="space-y-2">{o.events.map(e=><div key={e.id} className="flex flex-wrap gap-3 justify-between bg-white/5 rounded-lg p-3 text-xs">
         <strong>{e.type}</strong><span>{date(e.at)}</span><code className="text-zinc-500">{e.id}</code>
        </div>)}</div>}
      </td></tr>}
     </React.Fragment>)}
    {items.length===0&&<tr><td colSpan={6} className="p-10 text-center text-zinc-500">Δεν υπάρχουν δοκιμαστικές συναλλαγές με αυτά τα φίλτρα.</td></tr>}
    </tbody>
   </table>
  </div>}
 </main>;
}
