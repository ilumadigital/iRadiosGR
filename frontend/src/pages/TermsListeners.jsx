import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import LegalLayout from '../components/legal/LegalLayout';
import { generalTerms } from './legalDocuments';

export default function TermsListeners({ API_URL='/api', currentUser }) {
  const [checked,setChecked]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const accepted=currentUser?.hasAcceptedTerms===true;
  const eligible=currentUser&&['user','listener','producer','admin'].includes(currentUser.role);

  const accept=async event=>{
    event.preventDefault();
    if(!checked||!eligible||submitting)return;
    const token=localStorage.getItem('iluma_token');
    if(!token){setError('Απαιτείται σύνδεση για να αποθηκευτεί η αποδοχή.');return;}
    setSubmitting(true);setError('');
    try{
      const response=await fetch(API_URL+'/users/me/accept-terms',{
        method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token}
      });
      if(!response.ok)throw new Error('Δεν ήταν δυνατή η αποθήκευση της αποδοχής.');
      window.location.assign('/');
    }catch(problem){setError(problem.message);}
    finally{setSubmitting(false);}
  };

  return <LegalLayout document={generalTerms}>
    <section id="acceptance" className="mt-8 scroll-mt-8 rounded-[26px] border border-[#ccff00]/25 bg-[#18231a] p-6 sm:p-8">
      <h2 className="flex items-center gap-3 text-lg font-black sm:text-xl"><ShieldCheck className="text-[#ccff00]" size={24}/> Αποδοχή όρων</h2>
      {!currentUser?<p className="mt-4 text-sm leading-7 text-zinc-300">Μπορείς να διαβάσεις τους όρους ελεύθερα. <Link to="/login" className="font-bold text-[#ccff00] underline">Συνδέσου</Link> για να αποδεχτείς τους όρους του λογαριασμού σου.</p>:
      !eligible?<p className="mt-4 text-sm leading-7 text-zinc-300">Για τον λογαριασμό σου ισχύουν και οι αντίστοιχοι ειδικοί όροι Broadcaster ή Agency.</p>:
      accepted?<div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm"><span className="inline-flex items-center gap-2 font-bold text-[#ccff00]"><CheckCircle2 size={20}/> Οι όροι έχουν γίνει αποδεκτοί.</span><Link to="/" className="rounded-xl bg-[#ccff00] px-5 py-3 font-black text-black">Συνέχεια στην εφαρμογή</Link></div>:
      <form className="mt-5 space-y-4" onSubmit={accept}>
        <label className="flex items-start gap-3 text-sm leading-7 text-zinc-200"><input type="checkbox" required checked={checked} onChange={event=>setChecked(event.target.checked)} className="mt-1.5 size-5 accent-[#ccff00]"/><span>Διάβασα και αποδέχομαι τους παρόντες Όρους Χρήσης.</span></label>
        {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={!checked||submitting} className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-6 py-3.5 text-sm font-black text-black disabled:opacity-40">{submitting&&<Loader2 size={16} className="animate-spin"/>}Αποδοχή & συνέχεια</button>
      </form>}
    </section>
  </LegalLayout>;
}
