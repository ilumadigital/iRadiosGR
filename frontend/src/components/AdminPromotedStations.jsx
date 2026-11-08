import React,{useEffect,useMemo,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {Radio,Save,Trash2,Pencil,Star,Plus,X} from 'lucide-react';
import {adminFetch} from '../utils/adminFetch';

const field='w-full min-w-0 rounded-xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-[#ccff00]/70';
const label='mb-1 block text-xs font-bold text-zinc-300';
const initial=()=>[{placement:'region',placementValue:''}];
const namePlace=p=>p.placement==='news'?'Newsfeed':(p.placement==='region'?'Περιοχή: ':'Είδος: ')+p.placementValue;

export default function AdminPromotedStations({stations=[]}){
  const location=useLocation();
  const [items,setItems]=useState([]),[scopes,setScopes]=useState(initial());
  const [stationId,setStationId]=useState(''),[campaignId,setCampaignId]=useState('');
  const [enabled,setEnabled]=useState(true),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState('');
  const genres=useMemo(()=>[...new Set(stations.map(s=>s.genre).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el-GR')),[stations]);
  const regions=useMemo(()=>[...new Set(stations.flatMap(s=>[s.region,s.city]).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'el-GR')),[stations]);
  const eligible=useMemo(()=>stations.filter(s=>s.status==='approved'||!s.status)
    .sort((a,b)=>a.name.localeCompare(b.name,'el-GR')),[stations]);
  const groups=useMemo(()=>{
    const grouped=new Map();
    items.forEach(item=>{
      const key=item.campaignId||item._id;
      if(!grouped.has(key))grouped.set(key,{key,campaignId:item.campaignId||'',stationId:String(item.stationId),
        enabled:Boolean(item.enabled),placements:[],items:[]});
      grouped.get(key).placements.push({placement:item.placement,placementValue:item.placementValue||''});
      grouped.get(key).items.push(item);
    });
    return [...grouped.values()];
  },[items]);
  useEffect(()=>{
    const id=new URLSearchParams(location.search).get('station');
    if(!id)return;
    const station=stations.find(s=>String(s._id)===id&&s.status==='approved');
    if(!station)return;
    const region=station.region||station.city;
    setScopes([{placement:region?'region':'genre',placementValue:region||station.genre||''}]);
    setStationId(id);setEnabled(true);setCampaignId('');
  },[location.search,stations]);
  const reload=async()=>{
    const r=await adminFetch('/api/admin/promoted-stations');
    const data=await r.json();
    if(!r.ok)throw Error(data.error||'Αδυναμία ανάγνωσης Promoted Stations.');
    setItems(Array.isArray(data)?data:[]);
  };
  useEffect(()=>{
    let live=true;
    adminFetch('/api/admin/promoted-stations').then(async r=>{
      const data=await r.json();if(!r.ok)throw Error(data.error||'Δεν υπάρχει πρόσβαση στα Promoted Stations.');return data;
    }).then(data=>{if(live)setItems(Array.isArray(data)?data:[]);})
      .catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[]);
  const reset=()=>{setScopes(initial());setStationId('');setCampaignId('');setEnabled(true);setError('');setMessage('');};
  const modify=(index,key,value)=>setScopes(old=>old.map((s,i)=>index===i?{...s,[key]:value,...(key==='placement'?{placementValue:''}:{})}:s));
  const edit=group=>{
    setScopes(group.placements.map(p=>({...p})));setStationId(group.stationId);
    setCampaignId(group.campaignId);setEnabled(group.enabled);setError('');setMessage('');
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const save=async e=>{
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      if(!eligible.some(s=>String(s._id)===String(stationId)))throw Error('Επίλεξε εγκεκριμένο σταθμό.');
      if(!scopes.length||scopes.some(s=>s.placement!=='news'&&!s.placementValue))
        throw Error('Επίλεξε τις σελίδες που θέλεις να προβάλλεται.');
      const unique=new Set(scopes.map(p=>p.placement+':'+(p.placementValue||'')));
      if(unique.size!==scopes.length)throw Error('Κάθε σελίδα μπορεί να επιλεγεί μόνο μία φορά.');
      const r=await adminFetch('/api/admin/promoted-stations/campaign',{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({campaignId,stationId,enabled,placements:scopes})
      });
      const result=await r.json();
      if(!r.ok)throw Error(result.error||'Αδυναμία αποθήκευσης καμπάνιας.');
      await reload();setCampaignId(result.campaignId);
      setMessage('Η ίδια promoted καμπάνια αποθηκεύτηκε σε '+scopes.length+' θέσεις.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const remove=async group=>{
    if(!window.confirm('Διαγραφή καμπάνιας Promoted Station από '+group.placements.length+' θέσεις;'))return;
    setBusy(true);setError('');setMessage('');
    try{
      const url=group.campaignId?'/api/admin/promoted-stations/campaign/'+group.campaignId:
        '/api/admin/promoted-stations/'+group.items[0]._id;
      const r=await adminFetch(url,{method:'DELETE'});
      if(!r.ok)throw Error('Αδυναμία διαγραφής.');
      if(group.campaignId===campaignId)reset();
      await reload();setMessage('Η καμπάνια αφαιρέθηκε.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <section className="ir-glass space-y-5 p-5 sm:p-7" aria-labelledby="promoted-station-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-[#ccff00]"><Star size={15}/> Featured editorial</p>
        <h2 id="promoted-station-heading" className="mt-2 text-2xl font-black text-white">Promoted Stations</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">Ο ίδιος σταθμός σε πολλές σελίδες με μία καμπάνια. Η κάρτα, τα live metadata και το slide δίπλα της παραμένουν ακριβώς όπως πριν.</p>
      </div>
      <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-xs font-bold text-zinc-200"><Plus size={15}/> Νέα καμπάνια</button>
    </div>
    {error&&<p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
    {message&&<p role="status" className="rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/10 p-3 text-sm text-[#ccff00]">{message}</p>}
    <form className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5" onSubmit={save}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label><span className={label}>Εγκεκριμένος σταθμός</span><select required className={field} value={stationId} onChange={e=>setStationId(e.target.value)}>
          <option value="">Επιλογή σταθμού…</option>{eligible.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
        </select></label>
        <button type="submit" disabled={busy||!stationId||!scopes.length} className="ir-action-primary min-h-11 px-5"><Save size={16}/>{busy?'Αποθήκευση…':'Αποθήκευση καμπάνιας'}</button>
      </div>
      <div><p className={label}>Πού θα εμφανίζεται; (1 έως 12 θέσεις)</p>
        <div className="space-y-2">{scopes.map((scope,index)=><div key={index} className="flex flex-wrap items-center gap-2">
          <select className={field+' min-w-[140px] flex-1'} aria-label={'Τύπος σελίδας '+(index+1)} value={scope.placement}
            onChange={e=>modify(index,'placement',e.target.value)}>
            <option value="region">Περιοχή</option><option value="genre">Μουσικό είδος</option><option value="news">Newsfeed</option>
          </select>
          {scope.placement!=='news'&&<select required className={field+' min-w-[160px] flex-1'} value={scope.placementValue}
            aria-label={'Σελίδα προβολής '+(index+1)} onChange={e=>modify(index,'placementValue',e.target.value)}>
            <option value="">Επιλογή…</option>
            {(scope.placement==='region'?regions:genres).map(v=><option key={v} value={v}>{v}</option>)}
          </select>}
          <button type="button" disabled={scopes.length===1} onClick={()=>setScopes(old=>old.filter((_,i)=>i!==index))}
            aria-label={'Αφαίρεση τοποθέτησης '+(index+1)} className="rounded-xl border border-white/15 p-3 text-rose-300 disabled:opacity-30"><X size={16}/></button>
        </div>)}</div>
        <button type="button" disabled={scopes.length>=12} onClick={()=>setScopes(old=>[...old,{placement:'news',placementValue:''}])}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#ccff00]/35 px-4 py-2 text-xs font-bold text-[#ccff00]"><Plus size={15}/> Προσθήκη θέσης</button>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} className="accent-[#ccff00]"/> Ενεργό στην εφαρμογή</label>
    </form>
    <div><h3 className="mb-3 text-sm font-black text-white">Καμπάνιες ({groups.length})</h3>
      <div className="grid gap-2 md:grid-cols-2">
        {groups.map(group=>{
          const station=stations.find(s=>String(s._id)===group.stationId);
          return <div key={group.key} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
            {station?.logo?<img src={station.logo} alt="" className="size-12 shrink-0 rounded-lg bg-white p-1 object-contain"/>:<Radio size={30} className="shrink-0 text-zinc-500"/>}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{station?.name||'Σταθμός μη διαθέσιμος'}</p>
              <p className="line-clamp-2 text-xs leading-5 text-zinc-400">{group.placements.map(namePlace).join(' · ')} · {group.enabled?'Ενεργό':'Ανενεργό'}</p>
            </div>
            <button type="button" title="Επεξεργασία" onClick={()=>edit(group)} className="rounded-lg p-2 text-[#ccff00] hover:bg-white/10"><Pencil size={16}/></button>
            <button type="button" title="Διαγραφή καμπάνιας" disabled={busy} onClick={()=>remove(group)} className="rounded-lg p-2 text-red-400 hover:bg-white/10"><Trash2 size={16}/></button>
          </div>;
        })}
        {!groups.length&&<p className="text-sm text-zinc-400">Δεν έχει οριστεί ακόμα Promoted Station.</p>}
      </div>
    </div>
  </section>;
}
