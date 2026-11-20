import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,Headphones,Heart,Loader2,Mic2,RefreshCw,Radio,Trash2} from 'lucide-react';
const auth=()=>({Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')});
export default function ProfileFollows({API_URL='/api'}){
  const [follows,setFollows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const response=await fetch(API_URL+'/users/me/follows',{headers:auth(),cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Δεν φορτώθηκαν οι παρακολουθήσεις.');
      setFollows(data.follows||[]);
    }catch(err){setError(err.message||'Σφάλμα σύνδεσης.');}
    finally{setLoading(false);}
  },[API_URL]);
  useEffect(()=>{load();},[load]);
  const remove=async id=>{
    if(busy)return;
    setBusy(id);setError('');
    try{
      const response=await fetch(API_URL+'/users/me/follows/'+encodeURIComponent(id),{
        method:'DELETE',headers:auth()
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Η διαγραφή δεν αποθηκεύτηκε.');
      setFollows(data.follows||[]);
    }catch(err){setError(err.message||'Αποτυχία ενημέρωσης.');}
    finally{setBusy('');}
  };
  return <section className="ir-profile-panel p-4 sm:p-7" aria-label="Οι παραγωγοί και οι εκπομπές που ακολουθείς">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="ir-profile-section-icon"><Heart size={20}/></span>
        <div><h2 className="text-lg font-black text-white sm:text-xl">Follow DJs & Shows</h2>
          <p className="mt-1 text-xs text-zinc-400">{follows.length} παραγωγοί & εκπομπές · Μόνο όσα επιλέγεις εσύ</p>
        </div>
      </div>
      <button className="ir-profile-icon-action" type="button" disabled={loading||Boolean(busy)} onClick={load}><RefreshCw size={15}/> Ανανέωση</button>
    </div>
    {error&&<p role="alert" className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>}
    {['dj','show'].map(kind=>{
      const rows=follows.filter(f=>f.kind===kind);
      if(!rows.length)return null;
      return <div className="mb-5" key={kind}>
        <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-[#ccff00]">
          {kind==='dj'?<Mic2 size={17}/>:<Radio size={17}/>}
          {kind==='dj'?'Οι παραγωγοί μου':'Οι εκπομπές μου'} <span className="text-zinc-500">({rows.length})</span>
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(follow=><div className="ir-profile-follow-card" key={follow.id}>
            <span className="ir-profile-topic-icon">{kind==='dj'?<Mic2 size={19}/>:<Headphones size={19}/>}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">{follow.label}</p>
              <p className="mt-1 truncate text-xs text-zinc-400">{kind==='dj'?'Παραγωγός · ':'Εκπομπή · '}{follow.stationName}</p>
              <Link to={'/station/'+encodeURIComponent(follow.stationSlug||follow.stationId)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#ccff00]">
                Δες τον σταθμό <ArrowRight size={12}/></Link>
            </div>
            <button type="button" aria-label={'Διακοπή παρακολούθησης '+follow.label}
              className="ir-profile-inbox-remove" disabled={Boolean(busy)} onClick={()=>remove(follow.id)}>
              {busy===follow.id?<Loader2 size={15} className="animate-spin"/>:<Trash2 size={15}/>}
            </button>
          </div>)}
        </div>
      </div>;
    })}
    {!follows.length&&!loading&&!error&&<div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
      <Mic2 size={32} className="text-[#ccff00]"/>
      <h3 className="font-black text-white">Ακολούθησε ό,τι αγαπάς.</h3>
      <p className="max-w-lg text-xs leading-6 text-zinc-400">Άνοιξε το πρόγραμμα ενός σταθμού και πάτησε «Ακολούθησε Εκπομπή» ή «Ακολούθησε Παραγωγό». Θα εμφανιστούν αυτόματα εδώ.</p>
      <Link to="/favorites" className="ir-profile-primary mt-2"><Heart size={15}/> Άνοιξε τα αγαπημένα μου</Link>
    </div>}
    {loading&&<div className="flex justify-center p-6"><Loader2 size={22} className="animate-spin text-[#ccff00]"/></div>}
    <p className="mt-5 text-xs leading-6 text-zinc-400">Οι υπενθυμίσεις εκπομπών αποστέλλονται σύμφωνα με τις επιλογές σου στην καρτέλα «Ειδοποιήσεις». Η παρακολούθηση παραγωγού ισχύει και σε άλλους σταθμούς με το ίδιο όνομα παραγωγού.</p>
  </section>;
}
