import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {CheckCircle2,Loader2,Megaphone} from 'lucide-react';
import LegalLayout from '../components/legal/LegalLayout';
import {agencies} from './legalDocuments';

export default function TermsAgency({API_URL='/api',currentUser}){
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const eligible=currentUser?.role==='agency';
  const accepted=eligible&&currentUser.hasAcceptedTerms===true;
  const accept=async event=>{
    event.preventDefault();
    if(!eligible||!checked||busy)return;
    const token=localStorage.getItem('iluma_token');
    if(!token){setError('Απαιτείται σύνδεση.');return;}
    setBusy(true);setError('');
    try{
      const response=await fetch(API_URL+'/users/me/accept-terms',{method:'PUT',headers:{
        'Content-Type':'application/json',Authorization:'Bearer '+token
      }});
      if(!response.ok)throw new Error('Η αποδοχή δεν αποθηκεύτηκε. Δοκίμασε ξανά.');
      window.location.assign('/backoffice');
    }catch(problem){setError(problem.message);}
    finally{setBusy(false);}
  };
  return <LegalLayout document={agencies}>
    <section id="acceptance" className="mt-8 rounded-[26px] border border-purple-400/25 bg-[#211b2b] p-6 sm:p-8">
      <h2 className="flex items-center gap-3 text-xl font-black"><Megaphone size={24} className="text-purple-300"/> Σύμβαση διαφημιστικής συνεργασίας</h2>
      {!currentUser?<p className="mt-4 text-sm leading-7 text-zinc-300">Η ανάγνωση είναι δημόσια. Για αποδοχή από Agency απαιτείται <Link to="/login" className="font-bold text-purple-200 underline">σύνδεση</Link>.</p>:
      !eligible?<p className="mt-4 text-sm leading-7 text-zinc-300">Μόνο λογαριασμός Agency μπορεί να αποδεχτεί τους ειδικούς όρους διαφήμισης.</p>:
      accepted?<div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="inline-flex items-center gap-2 text-sm font-bold text-purple-200"><CheckCircle2 size={20}/> Η συμφωνία έχει γίνει αποδεκτή.</p><Link to="/backoffice" className="rounded-xl bg-purple-500 px-5 py-3 text-sm font-black text-white">Agency Backoffice</Link></div>:
      <form onSubmit={accept} className="mt-5 space-y-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-7 text-zinc-200"><input type="checkbox" required checked={checked} onChange={e=>setChecked(e.target.checked)} className="mt-1.5 size-5 accent-purple-500"/><span>Δηλώνω ότι εκπροσωπώ νόμιμα τον διαφημιζόμενο και αποδέχομαι τους ειδικούς Όρους Χρήσης Agencies.</span></label>
        {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={!checked||busy} className="inline-flex items-center gap-2 rounded-xl bg-purple-500 px-6 py-3.5 text-sm font-black text-white disabled:opacity-40">{busy&&<Loader2 size={17} className="animate-spin"/>} Αποδοχή & συνέχεια</button>
      </form>}
    </section>
  </LegalLayout>;
}
