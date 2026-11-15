import React,{useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {ArrowRight,CheckCircle2,Loader2,MailCheck,Radio,ShieldCheck} from 'lucide-react';
import LegalLayout from '../components/legal/LegalLayout';
import {broadcasters} from './legalDocuments';

export default function TermsBroadcasters({API_URL='/api',currentUser:initialUser=null}){
  const [query]=useSearchParams();
  const inviteToken=query.get('invite')||'';
  const [account,setAccount]=useState(initialUser);
  const [status,setStatus]=useState(initialUser?'ready':'loading');
  const [checked,setChecked]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const broadcaster=account?.role==='broadcaster';
  const verified=broadcaster&&account.isVerified===true;
  const accepted=account?.hasAcceptedCurrentBroadcasterTerms===true;
  const destination=inviteToken?'/broadcaster-invite?token='+encodeURIComponent(inviteToken):'/backoffice';

  useEffect(()=>{
    if(initialUser){setAccount(initialUser);setStatus('ready');return;}
    const token=localStorage.getItem('iluma_token');
    if(!token){setAccount(null);setStatus('guest');return;}
    let active=true;
    fetch(API_URL+'/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Μη ενεργή σύνδεση.');
        return response.json();
      })
      .then(user=>{if(active){setAccount(user);setStatus('ready');}})
      .catch(()=>{if(active){setAccount(null);setStatus('guest');}});
    return ()=>{active=false;};
  },[API_URL,initialUser]);

  async function accept(event){
    event.preventDefault();
    if(!verified||accepted||!checked||saving)return;
    const termsVersion=account?.requiredBroadcasterTermsVersion;
    const token=localStorage.getItem('iluma_token');
    if(!token||!termsVersion){setError('Συνδέσου ξανά για να επιβεβαιώσεις την έκδοση των όρων.');return;}
    setSaving(true);setError('');
    try{
      const response=await fetch(API_URL+'/users/me/accept-terms',{
        method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({termsVersion})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.user?.hasAcceptedCurrentBroadcasterTerms!==true)
        throw new Error(data.error||'Η αποδοχή δεν αποθηκεύτηκε.');
      window.location.assign(destination);
    }catch(problem){setError(problem.message);}
    finally{setSaving(false);}
  }
  return <LegalLayout document={broadcasters}>
    <section id="acceptance" className="mt-8 scroll-mt-8 rounded-[26px] border border-[#ccff00]/30 bg-[#1d2a1b] p-6 sm:p-9">
      <h2 className="flex items-center gap-3 text-xl font-black"><ShieldCheck size={26} className="text-[#ccff00]"/> Αποδοχή συνεργασίας</h2>
      <p className="mt-3 text-sm leading-7 text-zinc-300">Για πρόσβαση στο Broadcaster Backoffice απαιτείται αποδοχή της τρέχουσας έκδοσης της B2B συμφωνίας, συνδεδεμένη με τον λογαριασμό σου.</p>
      {status==='loading'?<p role="status" className="mt-5 flex items-center gap-2 text-sm text-zinc-300"><Loader2 size={17} className="animate-spin"/> Έλεγχος σύνδεσης…</p>:
      !account?<div className="mt-5 flex flex-wrap items-center gap-3 text-sm"><Link to="/broadcast/register" className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-5 py-3 font-black text-black"><Radio size={18}/> Εγγραφή Broadcaster</Link><Link to={'/login'+(inviteToken?'?invite='+encodeURIComponent(inviteToken):'')} className="rounded-xl border border-white/20 px-5 py-3 font-bold text-white">Σύνδεση</Link></div>:
      !broadcaster?<p className="mt-5 text-sm text-zinc-300">Η αποδοχή απαιτεί λογαριασμό Broadcaster.</p>:
      !verified?<div className="mt-5 space-y-4"><p className="text-sm leading-7 text-amber-200">Επιβεβαίωσε πρώτα το email σου.</p><Link to="/broadcast/pending" className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-5 py-3 text-sm font-black text-black"><MailCheck size={18}/> Επιβεβαίωση email</Link></div>:
      accepted?<div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="inline-flex items-center gap-2 text-sm font-bold text-[#ccff00]"><CheckCircle2 size={20}/> Έχεις ήδη αποδεχτεί την ισχύουσα έκδοση.</p><Link to={destination} className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-5 py-3 text-sm font-black text-black">Backoffice <ArrowRight size={16}/></Link></div>:
      <form onSubmit={accept} className="mt-5 space-y-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-black/20 p-4 text-sm leading-7 text-zinc-200"><input type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)} required className="mt-1.5 size-5 accent-[#ccff00]"/><span>Διάβασα και αποδέχομαι τους ειδικούς Όρους Χρήσης Broadcasters της ισχύουσας έκδοσης.</span></label>
        {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
        <button type="submit" disabled={!checked||saving} className="flex items-center justify-center gap-2 rounded-xl bg-[#ccff00] px-6 py-3.5 text-sm font-black text-black disabled:opacity-40">{saving&&<Loader2 size={17} className="animate-spin"/>} Αποδέχομαι & συνεχίζω <ArrowRight size={16}/></button>
      </form>}
    </section>
  </LegalLayout>;
}
