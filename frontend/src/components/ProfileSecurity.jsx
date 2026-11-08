import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {AlertTriangle,ArrowRight,Loader2,LockKeyhole,ShieldCheck,Trash2,X} from 'lucide-react';
const auth=()=>({'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')});
export default function ProfileSecurity({API_URL='/api',onLogout,user,actionsAvailable=true}){
  const [open,setOpen]=useState(false);
  const [confirm,setConfirm]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const deleteAccount=async()=>{
    if(confirm!=='ΔΙΑΓΡΑΦΗ'||loading)return;
    setLoading(true);setError('');
    try{
      const response=await fetch(API_URL+'/users/me',{method:'DELETE',headers:auth()});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Η διαγραφή λογαριασμού δεν ολοκληρώθηκε.');
      onLogout?.();
    }catch(e){setError(e.message||'Η διαγραφή απέτυχε.');}
    finally{setLoading(false);}
  };
  return <section className="ir-profile-panel p-5" id="profile-security">
    <div className="mb-4 flex items-start gap-3">
      <span className="ir-profile-section-icon"><LockKeyhole size={19}/></span>
      <div><h2 className="text-lg font-black text-white">Ασφάλεια & απόρρητο</h2>
        <p className="mt-1 text-xs leading-6 text-zinc-400">Οι σημαντικές ρυθμίσεις του λογαριασμού σου, χωρίς ξεχωριστή σελίδα Settings.</p></div>
    </div>
    <Link to="/privacy" className="ir-profile-link mt-5"><ShieldCheck size={17}/> Πολιτική απορρήτου <ArrowRight size={15} className="ml-auto"/></Link>
    <div className="mt-5 border-t border-white/10 pt-5">
      <p className="flex items-center gap-2 text-xs font-bold text-rose-300"><AlertTriangle size={15}/> Διαγραφή λογαριασμού</p>
      <p className="mt-2 text-xs leading-6 text-zinc-400">Μόνιμη διαγραφή των προσωπικών δεδομένων και των αποθηκευμένων ακολουθήσεων. Η ενεργή συνδρομή πρέπει πρώτα να σταματήσει να ανανεώνεται.</p>
      {user?.role==='admin'?<p className="mt-3 text-xs text-zinc-500">Οι λογαριασμοί διαχειριστή δεν διαγράφονται από το Profile.</p>
        :!actionsAvailable?<p className="mt-3 text-xs text-amber-200">Η οριστική διαγραφή είναι απενεργοποιημένη στο staging για την προστασία των δεδομένων.</p>
        :<button type="button" onClick={()=>setOpen(true)} className="ir-profile-icon-action ir-profile-icon-action--danger mt-4"><Trash2 size={16}/> Αίτημα διαγραφής</button>}
    </div>
    {open&&<div role="presentation" className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 p-4 backdrop-blur-lg">
      <div role="dialog" aria-modal="true" aria-labelledby="ir-delete-title" className="w-full max-w-md rounded-[26px] border border-rose-500/30 bg-[#141b1f] p-6 shadow-[0_30px_120px_rgba(0,0,0,.7)] sm:p-8">
        <div className="flex items-center justify-between">
          <span className="ir-profile-section-icon text-rose-300"><Trash2 size={20}/></span>
          <button className="ir-profile-icon-action" aria-label="Κλείσιμο" onClick={()=>{setOpen(false);setConfirm('');setError('');}}><X size={18}/></button>
        </div>
        <h2 id="ir-delete-title" className="mt-5 text-xl font-black text-white">Οριστική διαγραφή λογαριασμού</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">Η ενέργεια δεν μπορεί να αναιρεθεί. Για επιβεβαίωση, πληκτρολόγησε <strong className="text-rose-300">ΔΙΑΓΡΑΦΗ</strong>.</p>
        <input className="ir-profile-input mt-5" aria-label="Επιβεβαίωση διαγραφής"
          autoComplete="off" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="ΔΙΑΓΡΑΦΗ"/>
        {error&&<p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button className="ir-profile-secondary flex-1" onClick={()=>setOpen(false)} type="button">Άκυρο</button>
          <button type="button" onClick={deleteAccount} disabled={confirm!=='ΔΙΑΓΡΑΦΗ'||loading}
            className="ir-profile-icon-action ir-profile-icon-action--danger min-h-11 flex-1 justify-center">
            {loading?<Loader2 className="animate-spin" size={16}/>:<Trash2 size={16}/>} Διαγραφή
          </button>
        </div>
      </div>
    </div>}
  </section>;
}
