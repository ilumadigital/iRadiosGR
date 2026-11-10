import React,{useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {CheckCircle2,MailCheck,Loader2,AlertTriangle} from 'lucide-react';
import AuthShell,{AuthIntro} from '../components/AuthShell';

export default function VerifyEmail({API_URL='/api',setCurrentUser}){
  const [state,setState]=useState({status:'loading',message:''});
  const used=useRef(false);
  const navigate=useNavigate();
  useEffect(()=>{
    if(used.current)return;
    used.current=true;
    const token=new URLSearchParams(window.location.hash.slice(1)).get('token')||'';
    // Keep the single-use secret out of the address bar, browser requests and referrers.
    window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
    if(!/^[a-f0-9]{64}$/i.test(token)){
      setState({status:'error',message:'Ο σύνδεσμος δεν είναι έγκυρος.'});return;
    }
    (async()=>{
      try{
        const res=await fetch(API_URL+'/auth/verify-email',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({token})
        });
        const data=await res.json().catch(()=>({}));
        if(!res.ok){setState({status:'error',message:data.error||'Ο σύνδεσμος δεν ισχύει.'});return;}
        const session=localStorage.getItem('iluma_token');
        if(session){
          const me=await fetch(API_URL+'/auth/me',{headers:{Authorization:'Bearer '+session},cache:'no-store'});
          if(me.ok)setCurrentUser?.(await me.json());
        }
        setState({status:'success',message:'Το email επιβεβαιώθηκε! Μπορείς πλέον να βλέπεις τα playlists των σταθμών.'});
      }catch{
        setState({status:'error',message:'Η επιβεβαίωση δεν ολοκληρώθηκε. Άνοιξε ξανά το link από το email σου.'});
      }
    })();
  },[API_URL,setCurrentUser]);
  return <AuthShell><div className="ir-auth-card my-auto w-full max-w-md rounded-[32px] border border-white/10 bg-zinc-900/70 p-8 text-center">
    <AuthIntro icon={MailCheck} eyebrow="ACCOUNT SECURITY" title="Επιβεβαίωση email" description="Ένα τελευταίο βήμα για την playlist των αγαπημένων σου σταθμών."/>
    {state.status==='loading'?<p role="status" className="mt-6 flex items-center justify-center gap-2 text-sm text-zinc-300"><Loader2 size={17} className="animate-spin"/> Ελέγχουμε το link σου…</p>:
      <div role="status" className="mt-6 space-y-3">
        {state.status==='success'?<CheckCircle2 size={36} className="mx-auto text-[#ccff00]"/>:<AlertTriangle size={36} className="mx-auto text-amber-300"/>}
        <p className="text-sm text-zinc-200">{state.message}</p>
        <button type="button" onClick={()=>navigate('/')} className="mt-4 w-full rounded-xl bg-[#ccff00] px-5 py-3 font-bold text-black">Συνέχεια στο iRadios</button>
        {state.status==='error'&&<p className="text-xs text-zinc-400">Αν έχει λήξει, κάνε <Link to="/login" className="text-[#ccff00] underline">σύνδεση</Link> και πάτησε «Επαναποστολή link» στο επάνω banner.</p>}
      </div>}
  </div></AuthShell>;
}
