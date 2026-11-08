import React, {useEffect, useMemo, useState} from 'react';
import {useLocation} from 'react-router-dom';
import {Radio, Save, Trash2, Pencil, Star} from 'lucide-react';
import {adminFetch} from '../utils/adminFetch';

const field='w-full rounded-xl border border-white/15 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-[#ccff00]/70';
const label='mb-1 block text-xs font-bold text-zinc-300';

export default function AdminPromotedStations({stations=[]}){
  const location=useLocation();
  const [items,setItems]=useState([]);
  const [placement,setPlacement]=useState('region');
  const [placementValue,setPlacementValue]=useState('');
  const [stationId,setStationId]=useState('');
  const [enabled,setEnabled]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const genres=useMemo(()=>[...new Set(stations.map(s=>s.genre).filter(Boolean))].sort(),[stations]);
  const regions=useMemo(()=>[...new Set(stations.flatMap(s=>[s.region,s.city]).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,'el-GR')),[stations]);
  useEffect(()=>{
    // "Promoted" links from the station directory/editor preselect that radio
    // and its region, so admins don't have to search for it again.
    const id=new URLSearchParams(location.search).get('station');
    if(!id)return;
    const candidate=stations.find(s=>String(s._id)===id&&s.status==='approved');
    if(!candidate)return;
    const homeRegion=candidate.region||candidate.city;
    setPlacement(homeRegion?'region':'genre');
    setPlacementValue(homeRegion||candidate.genre||'');
    setStationId(id);
    setEnabled(true);
  },[location.search,stations]);
  const eligible=useMemo(()=>stations.filter(s=>
    (s.status==='approved'||!s.status)&&
    (placement==='genre'?s.genre===placementValue:
      s.region===placementValue||s.city===placementValue)
  ).sort((a,b)=>a.name.localeCompare(b.name,'el-GR')),[stations,placement,placementValue]);
  const refresh=async()=>{
    const r=await adminFetch('/api/admin/promoted-stations');
    if(!r.ok)throw new Error('Αδυναμία ανάγνωσης προτεινόμενων σταθμών.');
    const data=await r.json();
    setItems(Array.isArray(data)?data:[]);
  };
  useEffect(()=>{
    let live=true;
    adminFetch('/api/admin/promoted-stations')
      .then(async r=>{if(!r.ok)throw new Error('Δεν υπάρχει πρόσβαση στα Promoted Stations.');return r.json();})
      .then(data=>{if(live)setItems(Array.isArray(data)?data:[]);})
      .catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[]);
  const reset=()=>{
    setPlacement('region');setPlacementValue('');setStationId('');setEnabled(true);
    setMessage('');setError('');
  };
  const edit=item=>{
    setPlacement(item.placement);setPlacementValue(item.placementValue);
    setStationId(String(item.stationId));setEnabled(Boolean(item.enabled));
    setError('');setMessage('');
  };
  const save=async(e)=>{
    e.preventDefault();
    setBusy(true);setError('');setMessage('');
    try{
      if(!eligible.some(s=>String(s._id)===String(stationId)))
        throw new Error('Επίλεξε σταθμό που ανήκει στο συγκεκριμένο είδος ή περιοχή.');
      const r=await adminFetch('/api/admin/promoted-stations',{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({placement,placementValue,stationId,enabled})
      });
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Αδυναμία αποθήκευσης.');
      await refresh();
      setMessage('Ο προτεινόμενος σταθμός αποθηκεύτηκε για τη συγκεκριμένη σελίδα.');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  const remove=async item=>{
    if(!window.confirm('Να αφαιρεθεί το Promoted Station από τη σελίδα '+item.placementValue+';'))return;
    setBusy(true);setError('');setMessage('');
    try{
      const r=await adminFetch('/api/admin/promoted-stations/'+item._id,{method:'DELETE'});
      if(!r.ok)throw new Error('Αδυναμία διαγραφής.');
      await refresh();
      setMessage('Ο προτεινόμενος σταθμός αφαιρέθηκε.');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  return (
    <section className="ir-glass space-y-5 p-5 sm:p-7" aria-labelledby="promoted-station-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-[#ccff00]"><Star size={15}/> Featured editorial</p>
          <h2 id="promoted-station-heading" className="mt-2 text-2xl font-black text-white">Promoted Station</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">Ένας επιλεγμένος σταθμός δεξιά από το slider κάθε Είδους ή Περιοχής στο desktop grid. Το τραγούδι και ο παραγωγός ανανεώνονται αυτόματα από τα υπάρχοντα δεδομένα του σταθμού.</p>
        </div>
      </div>
      {error&&<p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
      {message&&<p role="status" className="rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/10 p-3 text-sm text-[#ccff00]">{message}</p>}
      <form className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1.4fr_auto]" onSubmit={save}>
        <label><span className={label}>Σελίδα</span><select value={placement} className={field} onChange={e=>{setPlacement(e.target.value);setPlacementValue('');setStationId('');}}>
          <option value="region">Περιοχή</option><option value="genre">Μουσικό είδος</option>
        </select></label>
        <label><span className={label}>{placement==='region'?'Περιοχή':'Είδος'}</span><select required className={field} value={placementValue}
          onChange={e=>{setPlacementValue(e.target.value);setStationId('');}}>
          <option value="">Επιλογή…</option>
          {(placement==='region'?regions:genres).map(v=><option key={v} value={v}>{v}</option>)}
        </select></label>
        <label><span className={label}>Εγκεκριμένος σταθμός</span><select required className={field} value={stationId} onChange={e=>setStationId(e.target.value)}>
          <option value="">Επιλογή σταθμού…</option>
          {eligible.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
        </select></label>
        <button disabled={busy||!stationId} type="submit" className="ir-action-primary min-h-11 px-5"><Save size={16}/>{busy?'Αποθήκευση…':'Αποθήκευση'}</button>
        <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
          <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} className="accent-[#ccff00]"/> Ενεργό στην εφαρμογή
        </label>
      </form>
      <div>
        <h3 className="mb-3 text-sm font-black text-white">Ρυθμισμένες σελίδες ({items.length})</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {items.map(item=>{
            const station=stations.find(s=>String(s._id)===String(item.stationId));
            return <div key={item._id} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
              {station?.logo?<img src={station.logo} alt="" className="size-12 shrink-0 rounded-lg bg-white p-1 object-contain"/>:<Radio size={30} className="shrink-0 text-zinc-500"/>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{station?.name||'Σταθμός μη διαθέσιμος'}</p>
                <p className="truncate text-xs text-zinc-400">{item.placement==='region'?'Περιοχή':'Είδος'}: {item.placementValue} · {item.enabled?'Ενεργό':'Ανενεργό'}</p>
              </div>
              <button type="button" title="Επεξεργασία" onClick={()=>edit(item)} className="rounded-lg p-2 text-[#ccff00] hover:bg-white/10"><Pencil size={16}/></button>
              <button type="button" title="Διαγραφή" disabled={busy} onClick={()=>remove(item)} className="rounded-lg p-2 text-red-400 hover:bg-white/10"><Trash2 size={16}/></button>
            </div>;
          })}
          {!items.length&&<p className="text-sm text-zinc-400">Δεν έχει οριστεί ακόμα Promoted Station.</p>}
        </div>
      </div>
    </section>
  );
}
