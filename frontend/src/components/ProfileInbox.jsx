import React,{useCallback,useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowRight,BellRing,CheckCheck,Clock3,Loader2,Newspaper,Radio,RefreshCw,Trash2,Mic2,ShieldCheck} from 'lucide-react';

const ICONS={news:Newspaper,newStations:Radio,shows:Mic2,favoriteSchedule:Radio,promotions:BellRing,system:ShieldCheck};
const auth=()=>({Authorization:'Bearer '+(localStorage.getItem('iluma_token')||''),
  'Content-Type':'application/json'});
const time=value=>{
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleString('el-GR',{
    day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'
  }):'';
};
const messageFor=async response=>{
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(payload.error||'Η ενέργεια δεν ολοκληρώθηκε.');
  return payload;
};

export default function ProfileInbox({API_URL='/api',onUnread}){
  const navigate=useNavigate();
  const [items,setItems]=useState([]);
  const [unread,setUnread]=useState(0);
  const [cursor,setCursor]=useState(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');

  const load=useCallback(async(append=false,next=null)=>{
    setLoading(true);setError('');
    try{
      const response=await fetch(API_URL+'/users/me/inbox'+(append&&next?'?before='+encodeURIComponent(next):''),{
        headers:auth(),cache:'no-store'});
      const data=await messageFor(response);
      setItems(old=>append?[...old,...(data.items||[]).filter(row=>!old.some(x=>x.id===row.id))]:data.items||[]);
      setUnread(data.unread||0);setCursor(data.nextCursor||null);
      onUnread?.(data.unread||0);
    }catch(err){setError(err.message||'Δεν φορτώθηκαν οι ειδοποιήσεις.');}
    finally{setLoading(false);}
  },[API_URL,onUnread]);

  useEffect(()=>{load();},[load]);

  const action=async(kind,item)=>{
    if(busy)return;
    const uri=API_URL+'/users/me/inbox'+(item?'/'+encodeURIComponent(item.id):'');
    if(kind==='clear'&&!window.confirm('Να διαγραφεί όλο το ιστορικό ειδοποιήσεων;'))return;
    setBusy(kind+(item?.id||''));setError('');
    try{
      const url=kind==='readAll'?uri+'/read-all':kind==='clear'?uri:kind==='read'?uri+'/read':uri;
      await messageFor(await fetch(url,{
        method:kind==='clear'||kind==='delete'?'DELETE':'POST',headers:auth()
      }));
      if(kind==='read'){
        setItems(old=>old.map(row=>row.id===item.id?{...row,readAt:new Date().toISOString()}:row));
        const count=Math.max(0,unread-(item.readAt?0:1));setUnread(count);onUnread?.(count);
      }else if(kind==='delete'){
        setItems(old=>old.filter(row=>row.id!==item.id));
        const count=Math.max(0,unread-(item.readAt?0:1));setUnread(count);onUnread?.(count);
      }else if(kind==='readAll'){
        setItems(old=>old.map(row=>({...row,readAt:row.readAt||new Date().toISOString()})));
        setUnread(0);onUnread?.(0);
      }else if(kind==='clear'){
        setItems([]);setCursor(null);setUnread(0);onUnread?.(0);
      }
      if(kind==='read'&&item?.path?.startsWith('/')&&!item.path.startsWith('//')){
        navigate(item.path);
      }
    }catch(err){setError(err.message||'Η αλλαγή δεν αποθηκεύτηκε.');}
    finally{setBusy('');}
  };

  return <section className="ir-profile-panel p-4 sm:p-7" aria-label="Κέντρο ειδοποιήσεων">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="ir-profile-section-icon"><BellRing size={20}/></span>
        <div><h2 className="text-lg font-black text-white sm:text-xl">Notification Center</h2>
          <p className="mt-1 text-xs text-zinc-400">{unread?unread+' μη αναγνωσμένες':'Είσαι ενημερωμένος!'} · Ειδοποιήσεις των τελευταίων 90 ημερών</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="ir-profile-icon-action" type="button" title="Ανανέωση" aria-label="Ανανέωση ειδοποιήσεων" onClick={()=>load()} disabled={loading||Boolean(busy)}><RefreshCw size={16}/></button>
        <button className="ir-profile-icon-action" type="button" disabled={!unread||Boolean(busy)} onClick={()=>action('readAll')}><CheckCheck size={16}/> Όλα διαβασμένα</button>
        <button className="ir-profile-icon-action ir-profile-icon-action--danger" type="button" disabled={!items.length||Boolean(busy)} onClick={()=>action('clear')}><Trash2 size={16}/> Καθαρισμός</button>
      </div>
    </div>
    {error&&<p role="alert" className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-200">{error}</p>}
    <div className="space-y-2">
      {items.map(item=>{
        const Icon=ICONS[item.topic]||BellRing;
        return <div key={item.id} className={'ir-profile-inbox-item '+(!item.readAt?'ir-profile-inbox-item--unread':'')}>
          <span className="ir-profile-inbox-icon"><Icon size={19}/></span>
          <button type="button" disabled={Boolean(busy)} onClick={()=>action('read',item)}
            className="min-w-0 flex-1 text-left">
            <span className="block text-sm font-black text-white">{item.title}</span>
            {item.body&&<span className="mt-1 block text-xs leading-5 text-zinc-400">{item.body}</span>}
            <span className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500"><Clock3 size={12}/>{time(item.createdAt)}</span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {!item.readAt&&<span className="h-2 w-2 rounded-full bg-[#ccff00]" aria-label="Μη αναγνωσμένη"/>}
            <button type="button" className="ir-profile-inbox-remove" disabled={Boolean(busy)} aria-label={'Διαγραφή ειδοποίησης: '+item.title} onClick={()=>action('delete',item)}><Trash2 size={15}/></button>
            <ArrowRight size={15} className="text-zinc-600"/>
          </div>
        </div>;
      })}
      {!items.length&&!loading&&!error&&<div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
        <BellRing size={30} className="text-[#ccff00]"/>
        <p className="font-bold text-white">Εδώ θα εμφανίζονται οι ειδοποιήσεις σου.</p>
        <p className="max-w-sm text-xs leading-6 text-zinc-400">Ακολούθησε έναν παραγωγό ή μία εκπομπή για να λαμβάνεις ενημερώσεις.</p>
      </div>}
      {loading&&<div className="flex justify-center p-5 text-zinc-400"><Loader2 size={20} className="animate-spin"/></div>}
    </div>
    {cursor&&!loading&&<button className="ir-profile-secondary mt-4 w-full" type="button" onClick={()=>load(true,cursor)}>Παλαιότερες ειδοποιήσεις <ArrowRight size={15}/></button>}
  </section>;
}
