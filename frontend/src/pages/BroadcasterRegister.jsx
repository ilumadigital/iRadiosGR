import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff,
  Loader2, MailCheck, Radio, ShieldCheck, User } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import useTurnstileSiteKey from '../hooks/useTurnstileSiteKey';

const API='/api';
const countries=[{code:'EL',name:'Ελλάδα'},{code:'CY',name:'Κύπρος'},{code:'DE',name:'Γερμανία'},
  {code:'FR',name:'Γαλλία'},{code:'IT',name:'Ιταλία'},{code:'BG',name:'Βουλγαρία'}];
const prefixes=[{code:'EL',prefix:'+30'},{code:'CY',prefix:'+357'},{code:'DE',prefix:'+49'},
  {code:'UK',prefix:'+44'},{code:'IT',prefix:'+39'}];
const field='mt-2 w-full min-w-0 rounded-xl border border-white/15 bg-[#0b1011] px-4 py-3.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#ccff00]/70';
const caption='block text-xs font-bold text-zinc-300';
const initial={businessType:'individual',countryCode:'EL',vatNumber:'',companyName:'',
  username:'',email:'',password:'',fname:'',lname:'',phonePrefix:'+30',phone:''};

function BrandHeader({back='/broadcast'}){
  return <header className="border-b border-white/10 bg-[#0d1212]"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
    <Link to="/broadcast" className="flex items-center gap-3" aria-label="iRadios Broadcaster"><img src="/iradios-app-logo.png" className="h-11 w-11 object-contain" alt=""/><span className="text-sm font-black">iRadios<span className="text-[#ccff00]">GR</span><span className="block text-[9px] uppercase tracking-[.2em] text-zinc-400">Broadcaster Network</span></span></Link>
    <Link to={back} className="flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-white"><ArrowLeft size={16}/> Πίσω</Link>
  </div></header>;
}
function Message({data}){return data?<p role="status" aria-live="polite" className={'mb-6 rounded-xl border p-4 text-sm leading-6 '+(data.type==='error'?'border-red-400/30 bg-red-400/10 text-red-200':'border-[#ccff00]/30 bg-[#ccff00]/10 text-[#e6ffb1]')}>{data.text}</p>:null;}
function FeaturesSide(){
  return <aside className="lg:sticky lg:top-10 lg:self-start"><span className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/25 bg-[#ccff00]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.15em] text-[#ccff00]"><Radio size={16}/> Broadcaster Network</span>
    <h1 className="mt-7 text-4xl font-black leading-tight tracking-[-.05em] sm:text-5xl">Ο σταθμός σου ξεκινά εδώ.</h1>
    <p className="mt-6 text-sm leading-8 text-zinc-400">Φτιάξε δωρεάν λογαριασμό Broadcaster, επιβεβαίωσε το email σου και συνέχισε στο Backoffice για να καταχωρίσεις τον σταθμό σου.</p>
    <div className="mt-9 space-y-4 text-sm text-zinc-300">{['Χωρίς πιστωτική κάρτα','Πρόγραμμα, εκπομπές και διαχείριση σταθμών','Προαιρετικά Premium, Add-ons & Boost'].map(item=><p key={item} className="flex items-start gap-3"><CheckCircle2 className="shrink-0 text-[#ccff00]" size={19}/>{item}</p>)}</div>
    <div className="mt-12 rounded-3xl border border-white/10 bg-[#121919] p-6"><ShieldCheck size={25} className="text-[#ccff00]"/><h2 className="mt-4 font-black">Ασφαλής εγγραφή</h2><p className="mt-2 text-xs leading-6 text-zinc-400">Cloudflare Turnstile και σύνδεσμος επιβεβαίωσης μίας χρήσης. Το Backoffice ανοίγει μόνο μετά την επιβεβαίωση email.</p></div>
  </aside>;
}
export default function BroadcasterRegister(){
  const navigate=useNavigate();
  const [query]=useSearchParams();
  const inviteToken=query.get('invite')||'';
  const [form,setForm]=useState(initial);
  const [lockedEmail,setLockedEmail]=useState(false);
  const [loading,setLoading]=useState(false);
  const [checkingVat,setCheckingVat]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [cfToken,setCfToken]=useState('');
  const [notice,setNotice]=useState(null);
  const turnstileRef=useRef(null);
  const {siteKey,turnstileError,retryTurnstile}=useTurnstileSiteKey(API);
  const update=(name,value)=>setForm(previous=>({...previous,[name]:value}));
  const resetCaptcha=()=>{setCfToken('');turnstileRef.current?.reset();};
  useEffect(()=>{
    if(!inviteToken)return;
    let alive=true;
    fetch(API+'/broadcaster-invitations/preview?token='+encodeURIComponent(inviteToken),{cache:'no-store'})
      .then(async res=>{const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||'Η πρόσκληση δεν ισχύει.');return data;})
      .then(data=>{if(!alive)return;setLockedEmail(true);update('email',data.email||'');})
      .catch(error=>{if(alive)setNotice({type:'error',text:error.message});});
    return ()=>{alive=false;};
  },[inviteToken]);

  const verifyVAT=async()=>{
    if(form.businessType!=='company'||form.vatNumber.length<8)return;
    setCheckingVat(true);
    try{
      const res=await fetch(API+'/auth/verify-vat/'+encodeURIComponent(form.countryCode)+'/'+encodeURIComponent(form.vatNumber));
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!(data.valid||data.isValid))throw Error('Το ΑΦΜ δεν επαληθεύτηκε στο VIES.');
      const name=String(data.name||'').split('||')[0].replace(/\n/g,' ').trim();
      if(name)update('companyName',name);
      setNotice({type:'success',text:'Το ΑΦΜ επαληθεύτηκε.'});
    }catch(error){setNotice({type:'error',text:error.message});}
    finally{setCheckingVat(false);}
  };
  const submit=async event=>{
    event.preventDefault();if(loading)return;setNotice(null);
    if(!cfToken){setNotice({type:'error',text:'Ολοκλήρωσε πρώτα το Cloudflare Turnstile.'});return;}
    if(!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%*]).{6,128}$/.test(form.password)){
      setNotice({type:'error',text:'Ο κωδικός χρειάζεται κεφαλαίο, πεζό, αριθμό και σύμβολο (!@#$%*).'});return;
    }
    setLoading(true);
    try{
      const res=await fetch(API+'/auth/register-broadcaster',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...form,phone:form.phonePrefix+form.phone,cfToken,...(inviteToken?{inviteToken}:{})})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error||'Η εγγραφή δεν ολοκληρώθηκε.');
      if(!data.token||data.user?.role!=='broadcaster')throw Error('Ο λογαριασμός δημιουργήθηκε. Συνδέσου για να ζητήσεις επιβεβαίωση email.');
      localStorage.setItem('iluma_token',data.token);
      localStorage.setItem('iluma_user',JSON.stringify(data.user));
      if(inviteToken)localStorage.setItem('iradios_broadcaster_invite',inviteToken);
      navigate('/broadcast/pending',{replace:true});
    }catch(error){setNotice({type:'error',text:error.message});resetCaptcha();}
    finally{setLoading(false);}
  };
  return <div className="min-h-screen bg-[#080c0c] text-white selection:bg-[#ccff00] selection:text-black">
    <Helmet><title>Εγγραφή Broadcaster | iRadiosGR</title><meta name="description" content="Εγγράψου δωρεάν ως Broadcaster και επιβεβαίωσε το email σου για να διαχειριστείς τον σταθμό σου."/></Helmet>
    <BrandHeader/>
    <main className="mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:py-20"><FeaturesSide/>
      <div className="rounded-[32px] border border-white/10 bg-[#141a1a] p-6 shadow-[0_35px_90px_rgba(0,0,0,.3)] sm:p-9">
        <div className="mb-8 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ccff00]">Δωρεάν εγγραφή</p><h2 className="mt-2 text-2xl font-black">Στοιχεία λογαριασμού</h2></div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ccff00]/10 text-[#ccff00]"><User size={24}/></span></div>
        {inviteToken&&<p className="mb-6 rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-200">Εγγραφή μέσω πρόσκλησης σταθμού. Χρησιμοποίησε το email της πρόσκλησης.</p>}
        <Message data={notice}/>
        <form onSubmit={submit} className="space-y-6">
          <fieldset><legend className={caption}>Τύπος λογαριασμού</legend><div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/25 p-1"><button type="button" onClick={()=>update('businessType','individual')} className={'flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-bold '+(form.businessType==='individual'?'bg-white text-black':'text-zinc-300 hover:text-white')}><User size={16}/> Ιδιώτης</button><button type="button" onClick={()=>update('businessType','company')} className={'flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-bold '+(form.businessType==='company'?'bg-[#ccff00] text-black':'text-zinc-300 hover:text-white')}><Building2 size={16}/> Εταιρεία</button></div></fieldset>
          {form.businessType==='company'&&<div className="space-y-4 rounded-2xl border border-[#ccff00]/15 bg-[#ccff00]/[.04] p-5"><div className="grid grid-cols-[100px_1fr] gap-3"><label className={caption}>Χώρα<select value={form.countryCode} onChange={e=>update('countryCode',e.target.value)} className={field}>{countries.map(x=><option key={x.code} value={x.code}>{x.code}</option>)}</select></label><label className={caption}>ΑΦΜ<input required value={form.vatNumber} onBlur={()=>void verifyVAT()} onChange={e=>update('vatNumber',e.target.value.replace(/[^0-9]/g,''))} className={field} placeholder="ΑΦΜ"/></label></div>{checkingVat&&<p className="flex items-center gap-2 text-xs text-[#ccff00]"><Loader2 size={14} className="animate-spin"/> Έλεγχος VIES…</p>}<label className={caption}>Επωνυμία εταιρείας<input required value={form.companyName} onChange={e=>update('companyName',e.target.value)} className={field}/></label></div>}
          <div className="grid gap-4 sm:grid-cols-2"><label className={caption}>Όνομα<input required autoComplete="given-name" maxLength={120} value={form.fname} onChange={e=>update('fname',e.target.value)} className={field}/></label><label className={caption}>Επώνυμο<input required autoComplete="family-name" maxLength={120} value={form.lname} onChange={e=>update('lname',e.target.value)} className={field}/></label></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className={caption}>Username<input required minLength={3} maxLength={60} autoComplete="username" value={form.username} onChange={e=>update('username',e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g,''))} className={field}/></label><label className={caption}>Τηλέφωνο<div className="flex min-w-0 gap-2"><select aria-label="Πρόθεμα χώρας" value={form.phonePrefix} onChange={e=>update('phonePrefix',e.target.value)} className={field+' !w-[105px]'}>{prefixes.map(x=><option key={x.code} value={x.prefix}>{x.code} {x.prefix}</option>)}</select><input type="tel" required autoComplete="tel-national" value={form.phone} onChange={e=>update('phone',e.target.value.replace(/[^0-9]/g,''))} className={field}/></div></label></div>
          <label className={caption}>Email<input type="email" required autoComplete="email" readOnly={lockedEmail} value={form.email} onChange={e=>update('email',e.target.value)} className={field+(lockedEmail?' opacity-70':'')}/></label>
          <label className={caption}>Κωδικός πρόσβασης<div className="relative"><input required minLength={6} maxLength={128} type={showPassword?'text':'password'} autoComplete="new-password" value={form.password} onChange={e=>update('password',e.target.value)} className={field+' pr-12'} /><button type="button" aria-label={showPassword?'Απόκρυψη κωδικού':'Εμφάνιση κωδικού'} onClick={()=>setShowPassword(!showPassword)} className="absolute bottom-3 right-4 text-zinc-400 hover:text-white">{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div><span className="mt-2 block text-[11px] font-normal text-zinc-500">Τουλάχιστον 6 χαρακτήρες, κεφαλαίο, πεζό, αριθμός και σύμβολο (!@#$%*).</span></label>
          <div className="flex min-h-16 items-center justify-center">{siteKey?<Turnstile key={siteKey} ref={turnstileRef} siteKey={siteKey} options={{action:'register-broadcaster'}} onSuccess={setCfToken} onError={()=>setCfToken('')} onExpire={()=>setCfToken('')} theme="dark"/>:<div role="status" className="text-center text-xs text-amber-300">{turnstileError||'Φόρτωση Cloudflare Turnstile…'}{turnstileError&&<button type="button" onClick={retryTurnstile} className="mt-2 block w-full font-bold text-[#ccff00] underline">Επανάληψη</button>}</div>}</div>
          <button type="submit" disabled={loading||!siteKey||!cfToken} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#ccff00] px-6 py-4 font-black text-black hover:bg-[#dcff58] disabled:cursor-not-allowed disabled:opacity-50">{loading?<Loader2 size={21} className="animate-spin"/>:<><Radio size={19}/> Δημιουργία λογαριασμού <ArrowRight size={18}/></>}</button>
          <p className="text-center text-xs leading-6 text-zinc-500">Με την εγγραφή αποδέχεσαι τους <Link to="/terms" className="font-bold text-white underline hover:text-[#ccff00]">όρους χρήσης</Link>. Η πρόσβαση στο Backoffice ενεργοποιείται μόνο μετά την επιβεβαίωση email.</p>
          <p className="text-center text-sm text-zinc-400">Έχεις ήδη λογαριασμό; <Link to={'/login'+(inviteToken?'?invite='+encodeURIComponent(inviteToken):'')} className="font-bold text-[#ccff00] hover:text-white">Σύνδεση</Link></p>
        </form>
      </div>
    </main>
  </div>;
}

export function BroadcasterPending(){
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [notice,setNotice]=useState(null);
  const navigate=useNavigate();
  useEffect(()=>{
    let active=true;
    const token=localStorage.getItem('iluma_token');
    if(!token){navigate('/login',{replace:true});return;}
    fetch(API+'/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
      .then(async res=>{if(!res.ok)throw Error('Συνδέσου ξανά για να συνεχίσεις.');return res.json();})
      .then(user=>{
        if(!active)return;
        if(user.role!=='broadcaster'){navigate('/',{replace:true});return;}
        if(user.isVerified){navigate('/broadcaster-terms',{replace:true});return;}
        setProfile(user);
      })
      .catch(error=>{if(active)setNotice({type:'error',text:error.message});})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[navigate]);
  const resend=async()=>{
    if(sending)return;setSending(true);setNotice(null);
    try{
      const res=await fetch(API+'/auth/resend-verification',{method:'POST',
        headers:{Authorization:'Bearer '+(localStorage.getItem('iluma_token')||''),'Content-Type':'application/json'}});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error||'Δεν στάλθηκε νέο link.');
      setNotice({type:'success',text:data.message||'Στάλθηκε νέο link επιβεβαίωσης.'});
    }catch(error){setNotice({type:'error',text:error.message});}
    finally{setSending(false);}
  };
  return <div className="min-h-screen bg-[#080c0c] text-white"><Helmet><title>Επιβεβαίωση email Broadcaster | iRadiosGR</title></Helmet><BrandHeader/>
    <main className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-8 sm:py-24"><div className="rounded-[35px] border border-white/10 bg-[#141a1a] p-7 sm:p-12"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#ccff00]/10 text-[#ccff00]"><MailCheck size={39}/></span><p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-[#ccff00]">Ένα τελευταίο βήμα</p><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Έλεγξε το email σου.</h1><p className="mt-5 text-sm leading-8 text-zinc-300">Στείλαμε έναν σύνδεσμο επιβεβαίωσης στο <strong className="break-all text-white">{profile?.email||'email εγγραφής σου'}</strong>. Άνοιξε το link για να ενεργοποιηθεί ο λογαριασμός σου. Δεν χρειάζεται κωδικός OTP.</p><p className="mt-4 text-xs leading-6 text-zinc-500">Ο σύνδεσμος λήγει σε 24 ώρες και μπορεί να χρησιμοποιηθεί μόνο μία φορά. Το Backoffice παραμένει κλειδωμένο μέχρι να επιβεβαιώσεις.</p><div className="mt-8"><Message data={notice}/></div><button type="button" disabled={loading||sending||!profile} onClick={resend} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#ccff00] px-6 py-4 font-black text-black hover:bg-[#ddff67] disabled:opacity-50">{sending?<Loader2 size={20} className="animate-spin"/>:'Επαναποστολή link επιβεβαίωσης'}</button><Link to="/login" className="mt-5 inline-block text-xs font-semibold text-zinc-400 underline underline-offset-4 hover:text-white">Σύνδεση με άλλο λογαριασμό</Link></div></main>
  </div>;
}
