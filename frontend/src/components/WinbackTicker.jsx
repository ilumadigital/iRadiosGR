import React,{useCallback,useEffect,useState} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {Crown,Gift,ArrowRight} from 'lucide-react';

const formatDate=value=>{
 if(!value)return '';
 const date=new Date(value);
 return Number.isFinite(+date)?new Intl.DateTimeFormat('el-GR',{
  day:'numeric',month:'long',timeZone:'Europe/Athens'
 }).format(date):'';
};

/**
 * Staging-only post-expiry offer ticker in the same upper-page position as
 * email verification. Actual eligibility comes ONLY from authenticated API.
 * ?winback_preview=1 is a visual-only demonstration without checkout rights.
 */
export default function WinbackTicker({currentUser,API_URL='/api'}){
 const location=useLocation();
 const preview=window.location.hostname==='stage.iradios.gr'&&
  new URLSearchParams(location.search).get('winback_preview')==='1';
 const eligibleAccount=window.location.hostname==='stage.iradios.gr'&&
  currentUser?.role==='user'&&currentUser?.isVerified===true;
 const [offer,setOffer]=useState(null);
 const refresh=useCallback(async()=>{
  if(!eligibleAccount){setOffer(null);return;}
  try{
   const response=await fetch(API_URL+'/billing/me/winback',{
    headers:{Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')},
    cache:'no-store'
   });
   if(!response.ok){setOffer(null);return;}
   const data=await response.json();
   setOffer(data.offer?.eligible?data.offer:null);
  }catch{setOffer(null);}
 },[eligibleAccount,API_URL,currentUser?._id]);
 useEffect(()=>{
  if(!eligibleAccount)return;
  void refresh();
  const interval=setInterval(()=>void refresh(),60000);
  window.addEventListener('focus',refresh);
  return()=>{clearInterval(interval);window.removeEventListener('focus',refresh);};
 },[eligibleAccount,refresh]);
 // Never use preview flags to alter billing eligibility or payment requests.
 if(!preview&&!offer)return null;
 if(['/login','/register'].includes(location.pathname))return null;
 const requiresCancellation=!preview&&offer?.requiresCancellation===true;
 const target=preview?'/premium?winback_preview=1':
  requiresCancellation?'/profile?tab=billing':'/premium?winback=1';
 return <div role="status" className="relative z-20 flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-[#ccff00]/25 bg-[#ccff00]/10 px-3 py-2.5 text-center text-xs text-[#f0ffd0] sm:text-sm">
  <Gift size={17} className="shrink-0 text-[#ccff00]" aria-hidden="true"/>
  <span><strong>Επέστρεψε στο Premium με 1,99 € τον πρώτο μήνα!</strong>{' '}
   Αυτόματη ανανέωση 3,99 €/μήνα μετά τον πρώτο μήνα, μέχρι να ακυρώσεις.
   {offer?.offerEndsAt&&!preview?' · Έως '+formatDate(offer.offerEndsAt):''}
  </span>
  {preview&&<span className="rounded-md border border-amber-300/35 px-2 py-0.5 text-[10px] font-black text-amber-200">STAGING PREVIEW · ΧΩΡΙΣ ΧΡΕΩΣΗ</span>}
  <Link to={target} className="inline-flex items-center gap-1 font-black text-[#ccff00] underline underline-offset-2 hover:text-white">
   <Crown size={14}/>
   {requiresCancellation?'Διαχείριση προηγούμενης ανανέωσης':'Δες την προσφορά'}
   <ArrowRight size={14}/>
  </Link>
 </div>;
}
