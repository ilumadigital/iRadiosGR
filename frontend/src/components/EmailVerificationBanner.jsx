import React,{useState} from 'react';
import {AlertTriangle,Mail,RefreshCw} from 'lucide-react';

export default function EmailVerificationBanner({currentUser,API_URL='/api',onUserUpdated}){
  const [sending,setSending]=useState(false);
  const [message,setMessage]=useState('');
  if(currentUser?.role!=='user'||currentUser?.isVerified===true)return null;
  const resend=async()=>{
    if(sending)return;
    setSending(true);setMessage('');
    try{
      const token=localStorage.getItem('iluma_token');
      const res=await fetch(API_URL+'/auth/resend-verification',{
        method:'POST',headers:{Authorization:'Bearer '+(token||'')}
      });
      const data=await res.json().catch(()=>({}));
      if(data.alreadyVerified){
        const fresh=await fetch(API_URL+'/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
        if(fresh.ok)onUserUpdated?.(await fresh.json());
      }
      setMessage(data.message||data.error||(res.ok?'Ο σύνδεσμος στάλθηκε.':'Δεν ήταν δυνατή η επαναποστολή.'));
    }catch{
      setMessage('Δεν έγινε αποστολή. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.');
    }finally{setSending(false);}
  };
  return <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-400/20 bg-amber-400/10 px-3 py-2 text-center text-xs sm:text-sm text-amber-100" role="status">
    <AlertTriangle size={16} className="shrink-0 text-amber-300" aria-hidden="true"/>
    <span>Το email <strong>{currentUser.email}</strong> δεν έχει επιβεβαιωθεί. Έλεγξε τα εισερχόμενά σου για το link.</span>
    <button type="button" disabled={sending} onClick={resend} className="inline-flex items-center gap-1 font-bold text-amber-300 underline underline-offset-2 hover:text-white disabled:opacity-50">
      {sending?<RefreshCw size={13} className="animate-spin"/>:<Mail size={13}/>}
      {sending?'Αποστολή…':'Επαναποστολή link'}
    </button>
    {message&&<span className="w-full text-[11px] text-amber-200" aria-live="polite">{message}</span>}
  </div>;
}
