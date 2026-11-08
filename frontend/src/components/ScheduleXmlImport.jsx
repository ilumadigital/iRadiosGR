import React, {useEffect,useState} from 'react';
import {CalendarClock,Check,ChevronDown,CloudDownload,FileCode2,
  Link2Off,RefreshCw,ShieldCheck,TriangleAlert} from 'lucide-react';

const FIELD_LABELS={
  title:'Τίτλος εκπομπής',producer:'Παραγωγός / DJ',day:'Ημέρα',
  start:'Ώρα έναρξης',end:'Ώρα λήξης',imageurl:'URL εικόνας',description:'Περιγραφή'
};
const REQUIRED=['day','start','end'];
const DEFAULT={url:'',rowTag:'',mapping:{},dayFormat:'iso'};
const INPUT='w-full min-w-0 rounded-xl border border-white/10 bg-[#090b0d] px-4 py-3 text-xs text-zinc-100 outline-none focus:border-[#caff00]/60';
const BTN='inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50';
const localeDate=value=>value?new Date(value).toLocaleString('el-GR',{
  timeZone:'Europe/Athens',day:'2-digit',month:'2-digit',year:'numeric',
  hour:'2-digit',minute:'2-digit'}):'—';
export default function ScheduleXmlImport({station,api,notify,reload,canManage=true,onImported}){
  const [expanded,setExpanded]=useState(false);
  const [form,setForm]=useState(DEFAULT);
  const [preview,setPreview]=useState(null);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    const f=station?.scheduleFeed||{};
    setForm({url:f.url||'',rowTag:f.rowTag||'',mapping:f.mapping||{},dayFormat:f.dayFormat||'iso'});
    setPreview(null);setError('');setExpanded(Boolean(f.enabled));
  },[station?._id]);
  if(!station)return null;
  const connected=Boolean(station.scheduleFeed?.enabled);
  const status=station.scheduleFeed||{};
  const change=(key,value)=>{
    setForm(prev=>({...prev,[key]:value}));
    setPreview(null);setError('');
  };
  const changeMapping=(key,value)=>{
    setForm(prev=>({...prev,mapping:{...prev.mapping,[key]:value}}));
    setPreview(null);setError('');
  };
  const action=async(name,path,options)=>{
    setBusy(name);setError('');
    try{
      const result=await api(path,options);
      notify(result.message||'Ολοκληρώθηκε.');
      if(result.station)onImported?.(result.station);
      await reload();
      return result;
    }catch(e){setError(e.message||'Δεν ήταν δυνατή η εισαγωγή.');return null;}
    finally{setBusy('');}
  };
  const check=async()=>{
    if(!form.url.trim()){setError('Βάλε πρώτα ένα δημόσιο XML URL.');return;}
    setBusy('preview');setError('');
    try{
      const data=await api('/stations/'+station._id+'/schedule-feed/preview',
        {method:'POST',body:JSON.stringify(form)});
      if(!data?.preview)throw new Error('Το XML δεν επέστρεψε εκπομπές.');
      setPreview(data.preview);
      setForm(prev=>({...prev,rowTag:data.preview.rowTag,
        mapping:data.preview.mapping}));
    }catch(e){setError(e.message||'Αποτυχία ελέγχου XML.');}
    finally{setBusy('');}
  };
  const connect=async()=>{
    if(!preview)return;
    if(!window.confirm('Το XML θα αντικαταστήσει το υπάρχον εβδομαδιαίο πρόγραμμα αυτού του σταθμού και θα συγχρονίζεται καθημερινά στις 03:00 ώρα Ελλάδας. Συνέχεια;'))return;
    const result=await action('connect','/stations/'+station._id+'/schedule-feed',
      {method:'POST',body:JSON.stringify(form)});
    if(result)setPreview(null);
  };
  const refresh=()=>action('refresh','/stations/'+station._id+'/schedule-feed/sync',{method:'POST'});
  const disable=()=>{
    if(!window.confirm('Να σταματήσει ο καθημερινός συγχρονισμός XML; Το τελευταίο αποθηκευμένο πρόγραμμα θα παραμείνει.'))return;
    action('disable','/stations/'+station._id+'/schedule-feed',{method:'DELETE'});
  };
  return <section className="mb-6 overflow-hidden rounded-[25px] border border-[#caff00]/15 bg-gradient-to-br from-[#111a19] to-[#101316]">
    <div className="flex flex-wrap items-center justify-between gap-3 p-5 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[#caff00]/10 text-[#caff00]"><FileCode2 size={21}/></div>
        <div><h3 className="font-black text-white">XML πρόγραμμα & αυτόματος συγχρονισμός</h3>
          <p className="mt-1 text-xs text-zinc-400">Αντιστοίχιση πεδίων, προεπισκόπηση και ενημέρωση κάθε μέρα στις 03:00 (Europe/Athens).</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={'rounded-full px-3 py-1.5 text-[10px] font-black '+(connected?
          'bg-[#caff00]/10 text-[#caff00]':'bg-white/5 text-zinc-400')}>
          {connected?'● ΕΝΕΡΓΟ XML':'ΧΕΙΡΟΚΙΝΗΤΟ ΠΡΟΓΡΑΜΜΑ'}</span>
        {canManage&&<button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}
          className={BTN+' border border-white/10 text-white hover:bg-white/5'}>
          {expanded?'Κλείσιμο':'Ρύθμιση XML'} <ChevronDown size={15} className={expanded?'rotate-180':''}/></button>}
      </div>
    </div>
    {connected&&<div className="grid gap-3 border-t border-white/5 px-5 py-4 text-[11px] text-zinc-300 sm:grid-cols-3">
      <div><span className="block text-zinc-500">Τελευταίος έλεγχος</span><strong className="mt-1 block text-white">{localeDate(status.lastCheckedAt)}</strong></div>
      <div><span className="block text-zinc-500">Τελευταίος επιτυχής συγχρονισμός</span><strong className="mt-1 block text-white">{localeDate(status.lastSuccessAt)}</strong></div>
      <div><span className="block text-zinc-500">Εγγραφές</span><strong className="mt-1 block text-white">{Number(status.lastCount||0)} εκπομπές</strong></div>
      {status.lastError&&<div role="alert" className="sm:col-span-3 flex items-start gap-2 text-rose-300"><TriangleAlert size={15}/>{status.lastError}</div>}
    </div>}
    {expanded&&canManage&&<div className="space-y-5 border-t border-white/10 p-5 md:p-6">
      <p className="text-xs leading-6 text-zinc-400">1. Βάλε δημόσιο XML link. 2. Πάτησε «Έλεγχος XML». 3. Διάλεξε το σωστό mapping. 4. Επιβεβαίωσε την προεπισκόπηση και ενεργοποίησε. Το πρόγραμμα που υπάρχει τώρα δεν αλλάζει πριν το τελευταίο βήμα.</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <label className="space-y-2"><span className="text-xs font-bold text-zinc-200">XML feed URL *</span>
          <input className={INPUT} type="url" spellCheck={false} placeholder="https://radio.example.com/schedule.xml"
            value={form.url} onChange={e=>change('url',e.target.value)} maxLength={1600}/>
        </label>
        <label className="space-y-2"><span className="text-xs font-bold text-zinc-200">XML row tag (προαιρετικό)</span>
          <input className={INPUT} value={form.rowTag} placeholder="π.χ. show / programme / item"
            list="ir-schedule-rowtags" onChange={e=>change('rowTag',e.target.value)} maxLength={100}/>
          <datalist id="ir-schedule-rowtags">{preview?.rowTags?.map(item=><option key={item.tag} value={item.tag}/>)}</datalist>
        </label>
      </div>
      <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="space-y-2"><span className="text-xs font-bold text-zinc-200">Αρίθμηση ημερών στο XML</span>
          <select className={INPUT} value={form.dayFormat} onChange={e=>change('dayFormat',e.target.value)}>
            <option value="iso">1=Δευτέρα έως 7=Κυριακή (προτεινόμενο)</option>
            <option value="monday0">0=Δευτέρα έως 6=Κυριακή (legacy)</option>
            <option value="sunday0">0=Κυριακή έως 6=Σάββατο (JavaScript)</option>
          </select>
        </label>
        <button type="button" className={BTN+' bg-white/10 text-white hover:bg-white/15'}
          disabled={Boolean(busy)||!form.url.trim()} onClick={check}>
          {busy==='preview'?<RefreshCw size={15} className="animate-spin"/>:<CloudDownload size={15}/>}
          Έλεγχος XML</button>
      </div>
      {preview&&<>
        <div className="border-t border-white/10 pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-black text-white">Αντιστοίχιση πεδίων (Mapping)</h4>
            <span className="rounded-full bg-[#caff00]/10 px-3 py-1 text-[11px] text-[#caff00]">{preview.sourceCount} γραμμές XML, {preview.count} εγγραφές μετά τον διαχωρισμό</span>
          </div>
          <p className="mb-4 text-xs leading-5 text-zinc-400">Αν η αυτόματη επιλογή δεν είναι σωστή, άλλαξέ την από τις λίστες και πάτησε ξανά «Έλεγχος XML». Τα πεδία με * είναι υποχρεωτικά. Τίτλος ή παραγωγός πρέπει να υπάρχει.</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(FIELD_LABELS).map(([name,label])=><label key={name} className="space-y-2">
              <span className="text-[11px] font-bold text-zinc-300">{label}{REQUIRED.includes(name)?' *':''}</span>
              <select className={INPUT} value={form.mapping[name]||''}
                onChange={e=>changeMapping(name,e.target.value)}>
                <option value="">Δεν υπάρχει / παράλειψη</option>
                {preview.fields.map(field=><option value={field} key={field}>{field}</option>)}
              </select>
            </label>)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <h4 className="mb-3 text-xs font-black text-white">Προεπισκόπηση εβδομαδιαίου προγράμματος</h4>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {preview.sample.map((show,i)=><div key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[.025] p-2.5">
              <img src={show.imageUrl||station.logo} alt="" loading="lazy"
                onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=station.logo;}}
                className="size-12 shrink-0 rounded-lg bg-white object-cover"/>
              <div className="min-w-0">
                <p className="text-xs font-black text-zinc-100">{show.title}</p>
                <p className="mt-1 truncate text-[11px] text-zinc-400">
                  {['','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'][show.day]}
                  {' · '+show.startTime+'–'+show.endTime}{show.host?' · '+show.host:''}</p>
              </div>
            </div>)}
            {preview.count>preview.sample.length&&<p className="py-2 text-center text-xs text-zinc-500">…και άλλες {preview.count-preview.sample.length} εγγραφές</p>}
          </div>
          {preview.split>0&&<p className="mt-3 text-[11px] text-[#caff00]">{preview.split} νυχτερινές εκπομπές χωρίστηκαν αυτόματα στα μεσάνυχτα.</p>}
        </div>
      </>}
      {error&&<p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3 text-xs text-rose-300"><TriangleAlert size={16}/>{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <p className="flex items-center gap-2 text-[11px] text-zinc-500"><ShieldCheck size={15} className="text-[#caff00]"/> Σε αποτυχία XML το τελευταίο έγκυρο πρόγραμμα διατηρείται.</p>
        <div className="flex flex-wrap gap-2">
          {connected&&<button type="button" className={BTN+' border border-white/10 text-zinc-200 hover:bg-white/5'}
            onClick={refresh} disabled={Boolean(busy)}>
            <RefreshCw size={15} className={busy==='refresh'?'animate-spin':''}/> Συγχρονισμός τώρα</button>}
          {connected&&<button type="button" className={BTN+' border border-rose-500/20 text-rose-300 hover:bg-rose-500/10'}
            onClick={disable} disabled={Boolean(busy)}><Link2Off size={15}/> Απενεργοποίηση</button>}
          <button type="button" className={BTN+' bg-[#caff00] text-black hover:bg-[#e5ff80]'}
            disabled={!preview||Boolean(busy)} onClick={connect}>
            <Check size={15}/>{busy==='connect'?'Αποθήκευση…':'Ενεργοποίηση XML & εισαγωγή'}</button>
        </div>
      </div>
    </div>}
  </section>;
}
