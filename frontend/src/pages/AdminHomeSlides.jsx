import {adminFetch as fetch} from '../utils/adminFetch';
import React, { useEffect, useState } from 'react';
import { Image, Plus, Save, Trash2, Pencil, ArrowUp, ArrowDown, Upload, ExternalLink, EyeOff, Eye } from 'lucide-react';
import AdminPromotedStations from '../components/AdminPromotedStations';

const emptySlide = () => ({
  title:'', subtitle:'', eyebrow:'ΠΡΟΤΕΙΝΟΥΜΕ', imageUrl:'', ctaLabel:'Άκου τώρα',
  placement:'home', placementValue:'', placements:[{placement:'home',placementValue:''}], targetType:'station', stationId:'', genre:'', externalUrl:'', audience:'all',
  priority:100, status:'draft', startsAt:'', endsAt:''
});
const fieldClass='w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-[#ccff00]/70';
const labelClass='mb-1 block text-xs font-bold text-zinc-300';
const toLocal = value => { if(!value)return ''; const d=new Date(value); return Number.isFinite(d.getTime()) ? new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16) : ''; };
const credential = () => ({Authorization:`Bearer ${localStorage.getItem('iluma_token') || ''}`});
// Uploads are saved in actual 1200×630 resolution; remote images retain their
// original bytes but are displayed through the same fixed-ratio cover frame.
async function normalizeSlideUpload(file){
  if(typeof createImageBitmap!=='function')throw new Error('Ο browser δεν υποστηρίζει μετατροπή εικόνας. Χρησιμοποίησε JPG 1200×630.');
  const image=await createImageBitmap(file);
  try{
    if(image.width>8192||image.height>8192||image.width<200||image.height<105)
      throw new Error('Η εικόνα έχει μη υποστηριζόμενες διαστάσεις.');
    const canvas=document.createElement('canvas');
    canvas.width=1200;canvas.height=630;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Δεν είναι δυνατή η προετοιμασία της εικόνας.');
    const sourceRatio=40/21, ratio=image.width/image.height;
    const sw=ratio>sourceRatio?image.height*sourceRatio:image.width;
    const sh=ratio>sourceRatio?image.height:image.width/sourceRatio;
    const sx=(image.width-sw)/2,sy=(image.height-sh)/2;
    ctx.fillStyle='#10161b';ctx.fillRect(0,0,1200,630);
    ctx.drawImage(image,sx,sy,sw,sh,0,0,1200,630);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(
      value=>value?resolve(value):reject(new Error('Αποτυχία επεξεργασίας εικόνας.')),
      'image/jpeg',0.9));
    return new File([blob],'slide-1200x630.jpg',{type:'image/jpeg'});
  }finally{image.close?.();}
}

export default function AdminHomeSlides() {
  const [slides,setSlides]=useState([]);
  const [stations,setStations]=useState([]);
  const [draft,setDraft]=useState(emptySlide());
  const [editingId,setEditingId]=useState(null);
  const [upload,setUpload]=useState(null);
  const [previewUrl,setPreviewUrl]=useState('');
  useEffect(()=>{
    if(!upload){setPreviewUrl('');return;}
    const url=URL.createObjectURL(upload);
    setPreviewUrl(url);
    return ()=>URL.revokeObjectURL(url);
  },[upload]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const refresh=async()=>{
    const response=await fetch('/api/admin/home-slides',{headers:credential()});
    if(!response.ok) throw new Error('Αδυναμία φόρτωσης slides (ελέγξτε τα δικαιώματα).');
    setSlides(await response.json());
  };
  useEffect(()=>{
    let live=true;
    Promise.all([
      fetch('/api/admin/home-slides',{headers:credential()}).then(r=>r.ok?r.json():Promise.reject(new Error('Δεν υπάρχει πρόσβαση στα slides.'))),
      fetch('/api/stations').then(r=>r.ok?r.json():[])
    ]).then(([items,radio])=>{
      if(live){setSlides(items);setStations(Array.isArray(radio)?radio:[]);}
    }).catch(e=>{if(live)setError(e.message);});
    return ()=>{live=false;};
  },[]);

  const edit=item=>{
    setEditingId(item._id);
    setDraft({...emptySlide(),...item,
      placements:Array.isArray(item.placements)&&item.placements.length?item.placements.map(p=>({placement:p.placement,placementValue:p.placementValue||''})):[{placement:item.placement||'home',placementValue:item.placementValue||''}],
      stationId:item.stationId||'',
      startsAt:toLocal(item.startsAt),endsAt:toLocal(item.endsAt)});
    setUpload(null);setError('');setNotice('');
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const reset=()=>{setDraft(emptySlide());setEditingId(null);setUpload(null);setError('');setNotice('');};
  const change=(key,value)=>setDraft(prev=>({...prev,[key]:value}));
  const updatePlace=(index,key,value)=>setDraft(prev=>({...prev,placements:prev.placements.map((p,i)=>i===index?{...p,[key]:value,...(key==='placement'?{placementValue:''}:{})}:p)}));
  const removePlace=index=>setDraft(prev=>({...prev,placements:prev.placements.filter((_,i)=>i!==index)}));

  const save=async(e)=>{
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      let imageUrl=draft.imageUrl;
      if(upload){
        if(upload.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(upload.type))
          throw new Error('Η εικόνα πρέπει να είναι JPG, PNG ή WebP έως 8MB.');
        const optimized=await normalizeSlideUpload(upload);
        const form=new FormData();form.append('imageFile',optimized);
        const response=await fetch('/api/admin/home-slides/upload',{method:'POST',headers:credential(),body:form});
        const data=await response.json();
        if(!response.ok) throw new Error(data.error||'Αποτυχία ανεβάσματος εικόνας.');
        imageUrl=data.url;
      }
      const first=draft.placements[0];
      if(!first)throw new Error('Επίλεξε τουλάχιστον μία θέση προβολής.');
      const payload={...draft,imageUrl,placement:first.placement,placementValue:first.placementValue||'',placements:draft.placements,priority:Number(draft.priority),
        startsAt:draft.startsAt||null,endsAt:draft.endsAt||null};
      const response=await fetch(`/api/admin/home-slides${editingId?'/'+editingId:''}`,{
        method:editingId?'PUT':'POST',
        headers:{...credential(),'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||'Αποτυχία αποθήκευσης.');
      await refresh();reset();setNotice('Το slide αποθηκεύτηκε σε όλες τις επιλεγμένες θέσεις προβολής.');
    } catch(e){setError(e.message);} finally{setBusy(false);}
  };
  const remove=async(item)=>{
    if(!window.confirm(`Διαγραφή slide «${item.title}»;`))return;
    setBusy(true);setError('');
    try{
      const r=await fetch('/api/admin/home-slides/'+item._id,{method:'DELETE',headers:credential()});
      if(!r.ok)throw new Error('Αποτυχία διαγραφής slide.');
      await refresh();if(editingId===item._id)reset();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const reorder=async(item,amount)=>{
    setBusy(true);setError('');
    try{
      const payload={...item,priority:Math.max(0,Math.min(1000,(item.priority||0)+amount))};
      const r=await fetch('/api/admin/home-slides/'+item._id,{
        method:'PUT',headers:{...credential(),'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok)throw new Error((await r.json()).error||'Αποτυχία αλλαγής σειράς.');
      await refresh();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const genres=[...new Set(stations.map(s=>s.genre).filter(Boolean))].sort();
  const regions=[...new Set(stations.flatMap(s=>[s.region,s.city]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el-GR'));
  return (
    <div className="admin-legacy-page space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-widest text-[#ccff00]">iRadiosGR CMS</p>
          <h1 className="mt-2 text-3xl font-black text-white">Slides και προτάσεις</h1>
          <p className="mt-2 text-sm text-zinc-400">Μία καμπάνια για Αρχική, Ειδήσεις, μουσικά είδη και περιοχές — επέλεξε όσες θέσεις θέλεις.</p>
        </div>
        <button type="button" onClick={reset} className="ir-action-primary px-5"><Plus size={17}/> Δημιουργία slide</button>
      </header>
      {error&&<p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-sm text-red-200">{error}</p>}
      {notice&&<p role="status" className="rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/10 p-4 text-sm text-[#ccff00]">{notice}</p>}
      <AdminPromotedStations stations={stations}/>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <form onSubmit={save} className="ir-glass space-y-5 p-5 sm:p-7">
          <h2 className="text-xl font-bold">{editingId?'Επεξεργασία slide':'Δημιουργία slide'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Τίτλος *</span><input required maxLength={100} className={fieldClass} value={draft.title} onChange={e=>change('title',e.target.value)}/></label>
            <label><span className={labelClass}>Μικρή ετικέτα</span><input maxLength={60} className={fieldClass} value={draft.eyebrow} onChange={e=>change('eyebrow',e.target.value)}/></label>
          </div>
          <div className="space-y-3 rounded-2xl border border-[#ccff00]/25 bg-[#ccff00]/[0.035] p-4">
            <p className="text-xs font-black uppercase tracking-wider text-[#ccff00]">Πού θα εμφανιστεί το slide;</p>
            <div className="space-y-3" role="group" aria-label="Θέσεις προβολής slide">
              {draft.placements.map((p,index)=><div key={index} className="flex flex-wrap items-center gap-2">
                <select aria-label={'Τύπος θέσης '+(index+1)} className={fieldClass+' min-w-[140px] flex-1'} value={p.placement}
                  onChange={e=>updatePlace(index,'placement',e.target.value)}>
                  <option value="home">Αρχική</option><option value="news">Ειδήσεις</option>
                  <option value="genre">Μουσικό είδος</option><option value="region">Περιοχή</option>
                </select>
                {['genre','region'].includes(p.placement)&&<select required aria-label={'Συγκεκριμένη σελίδα '+(index+1)}
                  className={fieldClass+' min-w-[150px] flex-1'} value={p.placementValue}
                  onChange={e=>updatePlace(index,'placementValue',e.target.value)}>
                  <option value="">Επιλογή…</option>
                  {(p.placement==='genre'?genres:regions).map(v=><option key={v} value={v}>{v}</option>)}
                </select>}
                <button type="button" disabled={draft.placements.length===1} onClick={()=>removePlace(index)}
                  aria-label={'Αφαίρεση θέσης '+(index+1)} className="rounded-xl border border-white/15 p-3 text-red-300 disabled:opacity-30"><Trash2 size={16}/></button>
              </div>)}
              <button type="button" disabled={draft.placements.length>=12}
                onClick={()=>change('placements',[...draft.placements,{placement:'news',placementValue:''}])}
                className="inline-flex items-center gap-2 rounded-xl border border-[#ccff00]/35 px-4 py-2 text-xs font-bold text-[#ccff00]"><Plus size={15}/> Προσθήκη ακόμη μίας θέσης</button>
            </div>
            <p className="text-[11px] text-zinc-400">Η ίδια εικόνα, οι ίδιες ημερομηνίες και το ίδιο CTA θα εμφανίζονται σε όλες τις θέσεις. Δεν χρειάζεται δεύτερη καμπάνια.</p>
          </div>
          <label><span className={labelClass}>Περιγραφή</span><textarea rows={3} maxLength={220} className={fieldClass} value={draft.subtitle} onChange={e=>change('subtitle',e.target.value)}/></label>
          <label><span className={labelClass}>Εικόνα 1200×630 (HTTPS URL ή ανεβάστε νέα)</span>
            <input className={fieldClass} value={draft.imageUrl} onChange={e=>change('imageUrl',e.target.value)} placeholder="https://.../hero.webp"/></label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 text-sm text-zinc-300 hover:border-[#ccff00]/70">
            <Upload size={18}/>{upload?upload.name:'Ανέβασμα JPG / PNG / WebP, έως 8MB · Αυτόματο crop 1200×630'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>setUpload(e.target.files?.[0]||null)}/>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Τύπος σύνδεσης</span><select className={fieldClass} value={draft.targetType} onChange={e=>change('targetType',e.target.value)}>
              <option value="none">Χωρίς σύνδεση</option><option value="station">Σταθμός</option><option value="genre">Κατηγορία</option><option value="external">Εξωτερικό HTTPS</option>
            </select></label>
            <label><span className={labelClass}>Κείμενο κουμπιού</span><input maxLength={48} className={fieldClass} value={draft.ctaLabel} onChange={e=>change('ctaLabel',e.target.value)}/></label>
          </div>
          {draft.targetType==='station'&&<label><span className={labelClass}>Εγκεκριμένος σταθμός *</span><select required className={fieldClass} value={draft.stationId} onChange={e=>change('stationId',e.target.value)}>
            <option value="">Επιλογή σταθμού…</option>{stations.filter(x=>x.status==='approved'||!x.status).map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
          </select></label>}
          {draft.targetType==='genre'&&<label><span className={labelClass}>Κατηγορία *</span><select required className={fieldClass} value={draft.genre} onChange={e=>change('genre',e.target.value)}><option value="">Επιλογή…</option>{genres.map(g=><option key={g} value={g}>{g}</option>)}</select></label>}
          {draft.targetType==='external'&&<label><span className={labelClass}>Σύνδεσμος HTTPS *</span><input required className={fieldClass} value={draft.externalUrl} onChange={e=>change('externalUrl',e.target.value)} placeholder="https://..." /></label>}
          <div className="grid gap-4 sm:grid-cols-3">
            <label><span className={labelClass}>Κατάσταση</span><select className={fieldClass} value={draft.status} onChange={e=>change('status',e.target.value)}><option value="draft">Πρόχειρο</option><option value="published">Δημοσιευμένο</option></select></label>
            <label><span className={labelClass}>Κοινό</span><select className={fieldClass} value={draft.audience} onChange={e=>change('audience',e.target.value)}><option value="all">Όλοι</option><option value="guest">Επισκέπτες</option><option value="member">Συνδεδεμένοι</option><option value="premium">Premium</option></select></label>
            <label><span className={labelClass}>Προτεραιότητα (0–1000)</span><input type="number" min={0} max={1000} className={fieldClass} value={draft.priority} onChange={e=>change('priority',e.target.value)}/></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={labelClass}>Αρχή (προαιρετικά)</span><input type="datetime-local" className={fieldClass} value={draft.startsAt} onChange={e=>change('startsAt',e.target.value)}/></label>
            <label><span className={labelClass}>Λήξη (προαιρετικά)</span><input type="datetime-local" className={fieldClass} value={draft.endsAt} onChange={e=>change('endsAt',e.target.value)}/></label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="ir-action-primary px-6"><Save size={17}/>{busy?'Αποθήκευση…':'Αποθήκευση'}</button>
            <button type="button" onClick={reset} className="rounded-xl border border-white/15 px-5 py-2 text-zinc-200">Καθαρισμός</button>
          </div>
        </form>
        <div className="space-y-4">
          <div className="ir-glass overflow-hidden">
            <div className="relative aspect-[40/21] bg-zinc-900">
              {(upload||draft.imageUrl)?<img src={previewUrl||draft.imageUrl} alt="Προεπισκόπηση slide" className="absolute inset-0 h-full w-full object-cover"/>:<div className="absolute inset-0 flex items-center justify-center text-zinc-500"><Image size={48}/></div>}
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent"/>
              <div className="absolute bottom-0 left-0 w-full p-6">
                <span className="text-xs font-black uppercase tracking-widest text-[#ccff00]">{draft.eyebrow}</span>
                <h3 className="mt-2 text-2xl font-black text-white">{draft.title||'Προεπισκόπηση τίτλου'}</h3>
                <p className="mt-2 max-w-sm text-sm text-zinc-200">{draft.subtitle}</p>
                <p className="mt-3 text-[10px] font-bold text-[#ccff00]">Προβολή: {draft.placements.map(p=>p.placement==='home'?'Αρχική':p.placement==='news'?'Ειδήσεις':(p.placement==='genre'?'Είδος: ':'Περιοχή: ')+p.placementValue).join(' · ')}</p>
              </div>
            </div>
          </div>
          <div className="ir-glass p-5">
            <h3 className="mb-4 text-base font-bold">Όλα τα slides ({slides.length})</h3>
            <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1">
              {slides.map(item=><div key={item._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <img className="h-14 w-20 shrink-0 rounded-lg object-cover bg-zinc-800" src={item.imageUrl} alt=""/>
                <div className="min-w-0 flex-1"><h4 className="truncate text-sm font-bold">{item.title}</h4>
                  <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">{item.status==='published'?<Eye size={12}/>:<EyeOff size={12}/>} {item.status==='published'?'Δημοσιευμένο':'Πρόχειρο'} · {(item.placements?.length?item.placements:[{placement:item.placement||'home',placementValue:item.placementValue}]).map(p=>p.placement==='home'?'Αρχική':p.placement==='news'?'Ειδήσεις':(p.placement==='genre'?'Είδος: ':'Περιοχή: ')+p.placementValue).join(' · ')} · Σειρά {item.priority||0}</p>
                </div>
                <div className="flex gap-1">
                  <button disabled={busy} onClick={()=>reorder(item,10)} title="Ανέβασμα σειράς" className="rounded-lg p-2 hover:bg-white/10"><ArrowUp size={15}/></button>
                  <button disabled={busy} onClick={()=>reorder(item,-10)} title="Κατέβασμα σειράς" className="rounded-lg p-2 hover:bg-white/10"><ArrowDown size={15}/></button>
                  <button onClick={()=>edit(item)} title="Επεξεργασία" className="rounded-lg p-2 text-[#ccff00] hover:bg-white/10"><Pencil size={15}/></button>
                  <button disabled={busy} onClick={()=>remove(item)} title="Διαγραφή" className="rounded-lg p-2 text-red-400 hover:bg-white/10"><Trash2 size={15}/></button>
                </div>
              </div>)}
              {!slides.length&&<p className="text-sm text-zinc-400">Δεν υπάρχουν slides. Δημιούργησε το πρώτο από τη φόρμα.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
