import React, {useEffect, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {ArrowLeft, Check, Image as ImageIcon, Music2, RefreshCw, ShieldAlert} from 'lucide-react';
import {LOCATION_DATA} from '../utils/stationLocations';
import DynamicAdCreative from '../components/DynamicAdCreative';
import ProtectedAudioPreview from '../components/ProtectedAudioPreview';
import {deriveCreativeAccent} from '../utils/creativePalette';
import {adDesignFor} from '../utils/adVisualDesign';
import VisualAdStudioControls from '../components/VisualAdStudioControls';
import '../styles/ad-campaign-console.css';

const box = 'rounded-2xl border border-white/10 bg-[#14161c] p-5 sm:p-6';
const input = 'mt-2 w-full min-w-0 rounded-xl border border-white/10 bg-[#08090d] px-4 py-3 text-sm text-white outline-none focus:border-purple-400';
const placements = [
  ['hero','Hero · αρχική'],['home','Home · ανάμεσα στα sections'],
  ['radio_feed','Radio Grid · κατηγορίες, περιοχές και lists'],
  ['news_feed','News Feed'],['station_profile','Station Profile']
];
const frequencies = [
  ['entry','Στην πρώτη ακρόαση'],['every_2_stations','Κάθε 2 αλλαγές'],['every_4_stations','Κάθε 4 αλλαγές'],
  ...[5,10,15,20,30].map(n=>['every_'+n+'_stations','Κάθε '+n+' αλλαγές']),
  ['every_1_hour','Κάθε ώρα'],['every_2_hours','Κάθε 2 ώρες'],['every_6_hours','Κάθε 6 ώρες'],
  ['once_a_day','Μία φορά ημερησίως'],['twice_a_day','Δύο φορές ημερησίως'],
  ['four_times_a_day','Τέσσερις φορές ημερησίως'],['once_a_week','Μία φορά την εβδομάδα']
];
const defaults = {
  title:'',client:'',description:'',imageUrl:'',squareImageUrl:'',logoUrl:'',
  ctaLabel:'Μάθε περισσότερα',brandColor:'#a855f7',focalX:50,focalY:50,
  targetUrl:'',linkUrl:'',audioUrl:'',frequency:'entry',dspPreset:'OFF',designConfig:{},
  placement:['home'],targetLocations:['Ελλάδα'],targetCountry:'Ελλάδα',targetRegion:'All',
  duration:'month',expiresAt:'',status:'active'
};
const flatAreas = Object.entries(LOCATION_DATA).flatMap(([country,regions])=>
  Object.entries(regions).flatMap(([region,prefectures])=>
    Object.entries(prefectures).flatMap(([prefecture,cities])=>
      [{value:country,country,region:'All',prefecture:'All'},
       {value:region,country,region,prefecture:'All'},
       {value:prefecture,country,region,prefecture},
       ...cities.map(value=>({value,country,region,prefecture}))])));
function normalize(item) {
  const value=(item?.targetLocations||[])[0]||'All';
  const cityArea=Object.entries(LOCATION_DATA).flatMap(([country,regions])=>Object.entries(regions)
    .flatMap(([region,prefs])=>Object.entries(prefs).flatMap(([prefecture,cities])=>
      cities.map(city=>({city,country,region,prefecture}))))).find(row=>row.city===value);
  const canonicalValue=cityArea?.prefecture||value;
  const inferred=flatAreas.find(a=>a.value===canonicalValue);
  return {...defaults,...item,
    targetCountry:item?.targetCountry&&item.targetCountry!=='All'?item.targetCountry:(inferred?.country||'All'),
    targetRegion:item?.targetRegion&&item.targetRegion!=='All'?item.targetRegion:(inferred?.region||'All'),
    designConfig:item?.designConfig&&typeof item.designConfig==='object'?item.designConfig:{},
    targetLocations:[canonicalValue],
    placement:Array.isArray(item?.placement)?item.placement:(item?.placement?[item.placement]:['home']),
    brandColor:/^#[0-9a-f]{6}$/i.test(item?.brandColor||'')?item.brandColor:'#a855f7',
    expiresAt:item?.expiresAt?new Date(item.expiresAt).toISOString().slice(0,16):'',
    duration:item?.duration||'month'
  };
}
function useFilePreview(file) {
  const [url,setUrl]=useState('');
  useEffect(()=>{
    if(!file){setUrl('');return;}
    const object=URL.createObjectURL(file);
    setUrl(object);
    return ()=>URL.revokeObjectURL(object);
  },[file]);
  return url;
}
function Field({label,children,help}){return <label className="block text-xs font-bold text-zinc-300">{label}{children}{help&&<span className="mt-1 block text-[11px] font-normal text-zinc-500">{help}</span>}</label>;}
function getEndpoint(scope,kind,user,id) {
  const root=scope==='agency'?'/api/agency':kind==='audio'?'/api/admin/ads':'/api/banners/admin';
  if(scope==='agency')return {
    list:root+'/'+user._id+'/'+(kind==='audio'?'audio-ads':'banners'),
    save:root+'/'+(kind==='audio'?'audio-ads':'banners')+(id?'/'+id:'')
  };
  return {list:root,save:root+(id?'/'+id:'')};
}
export default function CampaignEditor({scope='admin',kind='banners',currentUser,refreshGlobalAds}) {
  const {id}=useParams();
  const navigate=useNavigate();
  const banner=kind!=='audio';
  const path=scope==='agency'?'/agency/dashboard':'/backoffice/admin/'+(banner?'banners':'ads');
  const stage=typeof window!=='undefined'&&window.location.hostname==='stage.iradios.gr';
  const [form,setForm]=useState(defaults);
  const [files,setFiles]=useState({});
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(Boolean(id));
  const [error,setError]=useState('');
  const [preview,setPreview]=useState('strip');
  const [designPlacement,setDesignPlacement]=useState('home');
  const [previewDevice,setPreviewDevice]=useState('desktop');
  const [autoColor,setAutoColor]=useState(true);
  const [imported,setImported]=useState(false);
  const change=(name,value)=>setForm(old=>({...old,[name]:value}));
  const variantByPlacement={hero:'hero',home:'strip',station_profile:'profile',news_feed:'news'};
  const setDesignerPlacement=value=>{
    setDesignPlacement(value);
    setPreview(variantByPlacement[value]);
  };
  const design=adDesignFor(form,designPlacement);
  const updateDesigner=next=>setForm(old=>({...old,
    designConfig:{...(old.designConfig||{}),[designPlacement]:next}}));

  const route=getEndpoint(scope,kind,currentUser,id);
  const auth=()=>({Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')});
  useEffect(()=>{
    if(!id){setForm({...defaults, status:scope==='agency'?'pending':'active'});return;}
    let mounted=true;
    (async()=>{
      try {
        setLoading(true);
        const response=await fetch(route.list,{headers:auth()});
        const data=await response.json();
        if(!response.ok)throw Error(data.error||'Δεν φορτώθηκε η καμπάνια.');
        const item=Array.isArray(data)?data.find(row=>String(row._id)===String(id)):null;
        if(!item)throw Error('Δεν βρέθηκε η καμπάνια ή δεν έχεις πρόσβαση.');
        if(mounted){setForm(normalize(scope==='agency'&&item.pendingRevision?.patch?{...item,...item.pendingRevision.patch}:item));setImported(stage&&!item.isStageCreative);}
      }catch(e){if(mounted)setError(e.message);}
      finally{if(mounted)setLoading(false);}
    })();
    return ()=>{mounted=false;};
  },[id,kind,scope,currentUser?._id]);
  const target=form.targetLocations?.[0]||'All';
  const geo=flatAreas.find(a=>a.value===target&&a.country===form.targetCountry&&a.region===form.targetRegion);
  const prefecture=geo?.prefecture||'All';
  const regions=form.targetCountry==='All'?{}:(LOCATION_DATA[form.targetCountry]||{});
  const prefectures=form.targetRegion==='All'?{}:(regions[form.targetRegion]||{});
  const selectCountry=value=>setForm(old=>({...old,targetCountry:value,targetRegion:'All',targetLocations:[value==='All'?'All':value]}));
  const selectRegion=value=>setForm(old=>({...old,targetRegion:value,targetLocations:[value==='All'?old.targetCountry:value]}));
  const selectPrefecture=value=>change('targetLocations',[value==='All'?form.targetRegion:value]);
  const previewImage=useFilePreview(files.imageFile);
  const previewSquare=useFilePreview(files.squareImageFile);
  const previewLogo=useFilePreview(files.logoFile);
  const previewAudio=useFilePreview(files.audioFile);
  const previewBanner={...form,imageUrl:previewImage||form.imageUrl||'/iradios-app-logo.png',
    squareImageUrl:previewSquare||form.squareImageUrl,logoUrl:previewLogo||form.logoUrl};
  useEffect(()=>{
    if(!autoColor||!files.imageFile)return;
    let live=true;
    deriveCreativeAccent(files.imageFile).then(value=>{
      if(live&&value)setForm(old=>({...old,brandColor:value}));
    }).catch(()=>{});
    return ()=>{live=false;};
  },[files.imageFile,autoColor]);
  const editable=true; // Active agency creative changes are submitted as pending revisions.
  const upload=async(file,endpoint,field)=>{
    const body=new FormData();body.append(field,file);
    const response=await fetch('/api/uploads/'+endpoint,{method:'POST',headers:auth(),body});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.url)throw Error(data.error||'Αποτυχία ανεβάσματος αρχείου.');
    return data.url;
  };
  const submit=async event=>{
    event.preventDefault();
    if(!editable||busy)return;
    if(banner&&(!form.placement?.length||(!files.imageFile&&!form.imageUrl))){setError('Επίλεξε placement και εικόνα.');return;}
    if(!banner&&!files.audioFile&&!form.audioUrl){setError('Επίλεξε αρχείο ήχου.');return;}
    setBusy(true);setError('');
    try {
      const patch={...form};
      if(files.imageFile)patch.imageUrl=await upload(files.imageFile,'upload-banner','imageFile');
      if(files.squareImageFile)patch.squareImageUrl=await upload(files.squareImageFile,'upload-banner','imageFile');
      if(files.logoFile)patch.logoUrl=await upload(files.logoFile,'upload-logo','logoFile');
      if(files.audioFile)patch.audioUrl=await upload(files.audioFile,'upload-ad','audioFile');
      if(patch.expiresAt)patch.expiresAt=new Date(patch.expiresAt).toISOString();
      else patch.expiresAt=null;
      if(scope==='agency')patch.status='pending';
      const response=await fetch(route.save,{method:id?'PUT':'POST',
        headers:{...auth(),'Content-Type':'application/json'},body:JSON.stringify(patch)});
      const saved=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(saved.error||'Δεν αποθηκεύτηκε η καμπάνια.');
      refreshGlobalAds?.();
      navigate(path);
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  const clone=async()=>{
    if(!id||!stage||scope!=='admin')return;
    setBusy(true);setError('');
    try{
      const response=await fetch(route.save+'/clone-stage',{method:'POST',headers:auth()});
      const saved=await response.json();
      if(!response.ok)throw Error(saved.error||'Αποτυχία δοκιμαστικού αντιγράφου.');
      navigate('/backoffice/admin/'+(banner?'banners':'ads')+'/'+saved._id+'/edit');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const setFile=(field,file)=>setFiles(old=>({...old,[field]:file}));
  return <div className="ad-console mx-auto w-full max-w-[1500px] space-y-6 pb-20">
    <Link to={path} className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-[#ccff00]"><ArrowLeft size={15}/> Επιστροφή στις καμπάνιες</Link>
    <header className="ad-console-hero flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-black uppercase tracking-[.2em] text-purple-300">{scope==='admin'?'Admin Ad Studio':'Agency Ad Studio'}</p>
        <h1 className="mt-2 text-2xl font-black text-white sm:text-4xl">{id?'Επεξεργασία':'Νέα'} {banner?'διαφήμιση banner':'ηχητική διαφήμιση'}</h1>
        <p className="mt-2 text-sm text-zinc-400">Αποθήκευση όλων των πεδίων · πραγματικά creatives · καθαρή κατάσταση προβολής</p></div>
      {!id&&<div className="flex gap-2">
        <Link to={scope==='agency'?'/agency/campaigns/banners/new':'/backoffice/admin/banners/new'} className="ad-console-filter">Banner</Link>
        <Link to={scope==='agency'?'/agency/campaigns/audio/new':'/backoffice/admin/ads/new'} className="ad-console-filter">Audio</Link>
      </div>}
    </header>
    {imported&&<div role="status" className={box+' border-purple-500/40'}>
      <div className="flex items-center gap-2 text-purple-200"><ShieldAlert size={18}/> Εισαγμένη καμπάνια παραγωγής — δεν προβάλλεται στο staging.</div>
      <p className="mt-2 text-xs text-zinc-400">Δημιούργησε ανεξάρτητο δοκιμαστικό αντίγραφο. Η αρχική καμπάνια δεν αλλάζει.</p>
      <button type="button" disabled={busy} onClick={clone} className="mt-3 rounded-xl bg-purple-600 px-4 py-2 text-xs font-black text-white">Δοκιμή στο Staging</button>
    </div>}
    {error&&<div role="alert" className="rounded-xl border border-red-500/30 bg-red-900/20 p-4 text-sm text-red-200">{error}</div>}
    {loading?<p role="status" className="flex items-center gap-2 text-sm text-zinc-300"><RefreshCw size={16} className="animate-spin"/>Φόρτωση όλων των στοιχείων…</p>:
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(310px,1fr)]">
      <form id="campaign-editor" onSubmit={submit} className="space-y-5">
        <section className={box+' space-y-4'}>
          <h2 className="text-base font-black text-white">01 · Στοιχεία καμπάνιας</h2>
          <Field label="Τίτλος *"><input required className={input} value={form.title} onChange={e=>change('title',e.target.value)}/></Field>
          {banner?<Field label="Περιγραφή *"><textarea required rows={3} className={input} value={form.description} onChange={e=>change('description',e.target.value)}/></Field>:
            <Field label="Πελάτης / Brand *"><input required className={input} value={form.client} onChange={e=>change('client',e.target.value)}/></Field>}
          <Field label="URL προορισμού" help={banner?'Απαραίτητο για τη διαφήμιση.':'Προαιρετικό companion link.'}>
            <input required={banner} type="url" placeholder="https://" className={input} value={banner?form.targetUrl:form.linkUrl} onChange={e=>change(banner?'targetUrl':'linkUrl',e.target.value)}/></Field>
          {banner&&<div className="grid gap-4 sm:grid-cols-2">
            <Field label="Κείμενο κουμπιού"><input className={input} maxLength={45} value={form.ctaLabel} onChange={e=>change('ctaLabel',e.target.value)}/></Field>
            <Field label="Χρώμα brand"><div className="mt-2 flex items-center gap-3"><input aria-label="Χρώμα" type="color" value={form.brandColor} onChange={e=>{setAutoColor(false);change('brandColor',e.target.value);}} className="h-11 w-16 cursor-pointer rounded-lg"/><input className={input+' !mt-0'} pattern="#[0-9a-fA-F]{6}" value={form.brandColor} onChange={e=>change('brandColor',e.target.value)}/></div></Field>
          </div>}
          {banner&&<button type="button" className="text-left text-xs font-bold text-purple-300 hover:text-white" onClick={()=>setAutoColor(true)}>Αυτόματο χρώμα από την ανεβασμένη cover εικόνα {autoColor?'✓':''}</button>}
        </section>
        <section className={box+' space-y-4'}>
          <h2 className="text-base font-black text-white">02 · Creative assets</h2>
          {banner?<Field label="Cover 16:9 *"><input type="file" accept="image/jpeg,image/png,image/webp" className={input} onChange={e=>setFile('imageFile',e.target.files?.[0])}/>{form.imageUrl&&<span className="mt-1 block break-all text-[10px] text-zinc-500">{form.imageUrl}</span>}</Field>:
            <Field label="Audio MP3/WAV *"><input type="file" accept="audio/mpeg,audio/wav,audio/mp3" className={input} onChange={e=>setFile('audioFile',e.target.files?.[0])}/>{form.audioUrl&&<span className="mt-1 block break-all text-[10px] text-zinc-500">{form.audioUrl}</span>}</Field>}
          {banner&&<Field label="Square crop (προαιρετικό)" help="Αν δεν υπάρχει, το grid χρησιμοποιεί αυτόματα την κεντρική εικόνα."><input type="file" accept="image/jpeg,image/png,image/webp" className={input} onChange={e=>setFile('squareImageFile',e.target.files?.[0])}/></Field>}
          <Field label="Λογότυπο brand (προαιρετικό)"><input type="file" accept="image/jpeg,image/png,image/webp" className={input} onChange={e=>setFile('logoFile',e.target.files?.[0])}/>{form.logoUrl&&<img alt="Τρέχον λογότυπο" src={form.logoUrl} className="mt-3 h-16 max-w-40 rounded-lg bg-white p-1 object-contain"/>}</Field>
          {banner&&<div className="grid gap-4 sm:grid-cols-2">
            <Field label={'Εστίαση εικόνας οριζόντια · '+form.focalX+'%'}><input type="range" min="0" max="100" value={form.focalX} onChange={e=>change('focalX',Number(e.target.value))} className="mt-3 w-full accent-purple-500"/></Field>
            <Field label={'Εστίαση εικόνας κάθετα · '+form.focalY+'%'}><input type="range" min="0" max="100" value={form.focalY} onChange={e=>change('focalY',Number(e.target.value))} className="mt-3 w-full accent-purple-500"/></Field>
          </div>}
        </section>
        {banner&&<section className={box+' space-y-5'}>
          <div><h2 className="text-base font-black text-white">03 · Visual Ad Studio</h2>
            <p className="mt-2 text-xs text-zinc-400">Προσαρμόζεις κάθε θέση ξεχωριστά, χωρίς να χαλάει η διάταξη σταθμών ή των κινητών.</p></div>
          <Field label="Placement που σχεδιάζεις">
            <select className={input} value={designPlacement} onChange={e=>setDesignerPlacement(e.target.value)}>
              <option value="hero">Home Hero</option>
              <option value="home">Home section banner</option>
              <option value="station_profile">Station Profile</option>
              <option value="news_feed">News Feed</option>
            </select>
          </Field>
          <VisualAdStudioControls placement={designPlacement} design={design} onChange={updateDesigner}/>
          <p className="text-xs text-zinc-500">Οι διαφημίσεις Radio Grid και List παραμένουν στο ακριβές μέγεθος των καρτών σταθμών.</p>
        </section>}
        <section className={box+' space-y-4'}>
          <h2 className="text-base font-black text-white">{banner?'04':'03'} · Delivery & στόχευση</h2>
          {banner?<fieldset><legend className="mb-3 text-xs font-bold text-zinc-300">Placements *</legend><div className="grid gap-2 sm:grid-cols-2">
            {placements.map(([value,label])=><label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-3 text-xs text-zinc-200">
              <input type="checkbox" checked={form.placement?.includes(value)||false} onChange={e=>change('placement',e.target.checked?[...(form.placement||[]),value]:form.placement.filter(p=>p!==value))} className="accent-purple-500"/>{label}
            </label>)}</div></fieldset>:
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Συχνότητα αναπαραγωγής"><select className={input} value={form.frequency} onChange={e=>change('frequency',e.target.value)}>{frequencies.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Audio processing"><select className={input} value={form.dspPreset} onChange={e=>change('dspPreset',e.target.value)}><option value="OFF">Bypass</option><option value="NORMALIZE">Normalize</option></select></Field>
            </div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Χώρα"><select className={input} value={form.targetCountry} onChange={e=>selectCountry(e.target.value)}><option value="All">Όλες οι χώρες</option>{Object.keys(LOCATION_DATA).map(v=><option value={v} key={v}>{v}</option>)}</select></Field>
            <Field label="Περιφέρεια"><select className={input} value={form.targetRegion} disabled={form.targetCountry==='All'} onChange={e=>selectRegion(e.target.value)}><option value="All">Όλες οι περιφέρειες</option>{Object.keys(regions).map(v=><option value={v} key={v}>{v}</option>)}</select></Field>
            <Field label="Νομός / Περιφερειακή Ενότητα"><select className={input} value={prefecture} disabled={form.targetRegion==='All'} onChange={e=>selectPrefecture(e.target.value)}><option value="All">Όλοι οι νομοί</option>{Object.keys(prefectures).map(v=><option value={v} key={v}>{v}</option>)}</select></Field>
            <Field label="Πόλη"><select className={input} value={cities.includes(target)?target:'All'} disabled={prefecture==='All'} onChange={e=>change('targetLocations',[e.target.value==='All'?prefecture:e.target.value])}><option value="All">Όλες οι πόλεις</option>{cities.map(v=><option value={v} key={v}>{v}</option>)}</select></Field>
          </div>
          <p className="text-xs text-purple-200">Στόχευση: {form.targetLocations?.join(', ')||'All'}</p>
          {scope==='admin'&&<div className="grid gap-3 sm:grid-cols-2">
            <Field label="Κατάσταση"><select className={input} value={form.status} onChange={e=>change('status',e.target.value)}><option value="active">Ενεργή</option><option value="pending">Προς έγκριση</option><option value="expired">Ανενεργή / έληξε</option><option value="rejected">Απορρίφθηκε</option></select></Field>
            <Field label="Διάρκεια"><select className={input} value={form.duration} onChange={e=>change('duration',e.target.value)}><option value="day">24 ώρες</option><option value="month">Μήνας</option><option value="year">Έτος</option></select></Field>
            <Field label="Λήξη (προαιρετικό)"><input type="datetime-local" className={input} value={form.expiresAt} onChange={e=>change('expiresAt',e.target.value)}/></Field>
          </div>}
          {scope==='agency'&&<p className="text-xs text-amber-200">Κάθε αλλαγή υποβάλλεται για έγκριση Admin. Η ενεργή έκδοση παραμένει διαθέσιμη μέχρι την έγκριση · καμία δοκιμαστική χρέωση.</p>}
        </section>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link to={path} className="rounded-xl border border-white/10 px-6 py-3 text-sm font-bold text-zinc-300">Ακύρωση</Link>
          <button type="submit" disabled={busy||!editable} className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-7 py-3 text-sm font-black text-black disabled:opacity-40">
            {busy?<RefreshCw size={17} className="animate-spin"/>:<Check size={17}/>} Αποθήκευση
          </button>
        </div>
      </form>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
        <section className={box+' space-y-4'}>
          <div><p className="text-xs font-black uppercase tracking-widest text-purple-300">Live preview</p><h2 className="mt-1 text-xl font-black text-white">Ακριβώς όπως στο App</h2></div>
          {banner?<><div className="flex flex-wrap gap-2">
            {['hero','strip','profile','card','list','news'].map(v=><button key={v} type="button" onClick={()=>{
              setPreview(v);
              const id=Object.keys(variantByPlacement).find(p=>variantByPlacement[p]===v);
              if(id)setDesignPlacement(id);
            }}
              className={'rounded-lg px-3 py-2 text-xs font-bold '+(preview===v?'bg-purple-600 text-white':'border border-white/10 text-zinc-300')}>{v}</button>)}
          </div>
          <div className="flex gap-2" role="group" aria-label="Μέγεθος προεπισκόπησης">
            {['desktop','mobile'].map(device=><button key={device} type="button"
              onClick={()=>setPreviewDevice(device)}
              aria-pressed={previewDevice===device}
              className={'rounded-lg border px-3 py-2 text-xs font-bold '+(previewDevice===device?'border-purple-400 bg-purple-500/20 text-purple-200':'border-white/10 text-zinc-400')}>
              {device==='desktop'?'Desktop':'Mobile'}
            </button>)}
          </div>
          <div className={preview==='card'?'max-w-[245px]':previewDevice==='mobile'?'mx-auto max-w-[380px] w-full':'w-full'}>
            <DynamicAdCreative banner={{...previewBanner,targetUrl:form.targetUrl||'https://example.com'}} variant={preview} placement={form.placement?.[0]||'home'} slotKey="editor-preview" preview previewMobile={previewDevice==='mobile'} />
          </div><p className="text-[11px] text-zinc-500">Το preview δεν καταγράφει προβολές όταν το δημιουργικό δεν έχει αποθηκευμένο ID.</p></>:
            <div className="space-y-3"><div className="rounded-2xl bg-purple-950/30 p-5"><Music2 className="mb-3 text-purple-300"/><p className="font-black text-white">{form.title||'Τίτλος Audio Spot'}</p><p className="mt-1 text-xs text-zinc-400">{form.client||'Brand'}</p></div>
            {previewAudio?<audio src={previewAudio} controls preload="metadata" className="w-full"/>:
              form.audioUrl?<ProtectedAudioPreview adId={id} scope={scope} sourceUrl={form.audioUrl}/>:
              <p className="text-xs text-zinc-500">Επίλεξε MP3/WAV για προεπισκόπηση πριν την αποθήκευση.</p>}</div>}
          <div className="flex gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400"><ImageIcon size={18}/> Οι εικόνες, τα κείμενα και το CTA αποτελούν responsive HTML — όχι flattened banner.</div>
        </section>
      </aside>
    </div>}
  </div>;
}
