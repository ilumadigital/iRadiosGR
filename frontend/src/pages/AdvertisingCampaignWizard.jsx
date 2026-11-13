import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {adminFetch as fetch} from '../utils/adminFetch';
import {LOCATION_DATA} from '../utils/stationLocations';
import ProtectedAudioPreview from '../components/ProtectedAudioPreview';
import {ArrowLeft,ArrowRight,AudioLines,BadgeCheck,BarChart3,Check,CheckCircle2,
 ChevronRight,CircleAlert,Clock3,CreditCard,FileCheck2,Image as ImageIcon,
 LayoutGrid,Loader2,MapPin,Mic2,Plus,RefreshCw,ShieldCheck,Trash2,
 UploadCloud,Wallet} from 'lucide-react';

const panel='rounded-[24px] border border-white/10 bg-[#16131e] p-5 sm:p-7';
const label='block text-[11px] font-bold tracking-wide text-zinc-300';
const field='mt-2 w-full rounded-xl border border-white/10 bg-[#0b0a11] px-4 py-3.5 text-sm text-white outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/10 disabled:opacity-60';
const primary='inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-500 px-6 py-3 text-sm font-black text-white transition hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-40';
const secondary='inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.035] px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-purple-300/35 hover:bg-white/[.065] disabled:opacity-40';
const card='rounded-2xl border border-white/10 bg-black/25 p-4';
const euro=value=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(Number(value||0));
const num=value=>new Intl.NumberFormat('el-GR',{maximumFractionDigits:0}).format(Number(value||0));
const toLocal=millis=>{
 const d=new Date(millis);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
const initialCampaign=()=>({title:'',brand:'',description:'',country:'Ελλάδα',region:'All',
 prefecture:'Ελλάδα',startsAt:toLocal(Date.now()+86400000),
 endsAt:toLocal(Date.now()+11*86400000)});
const initialCreative=kind=>({kind,title:'',description:'',imageUrl:'',squareImageUrl:'',
 logoUrl:'',targetUrl:'',linkUrl:'',audioUrl:'',brandColor:'#a855f7',
 ctaLabel:'Μάθε περισσότερα',focalX:50,focalY:50,placement:['home'],
 frequency:'entry',designConfig:{}});
const formats=[
 {id:'hero',title:'Homepage Hero'},
 {id:'home',title:'Home Feed'},
 {id:'radio_feed',title:'Radio Grid'},
 {id:'news_feed',title:'News Grid'},
 {id:'station_profile',title:'Station Profile'}
];
const stages=[
 {title:'Καμπάνια',desc:'Στοιχεία & στόχευση',icon:LayoutGrid},
 {title:'Visual / Audio',desc:'Δημιουργικά',icon:ImageIcon},
 {title:'Budget',desc:'Επένδυση',icon:Wallet},
 {title:'Overview',desc:'Έλεγχος & εκτίμηση',icon:BarChart3},
 {title:'Πληρωμή',desc:'Nexi Sandbox',icon:CreditCard},
 {title:'Έγκριση',desc:'Υποβολή στον Admin',icon:ShieldCheck}
];
function Status({status}){
 const dict={draft:['Προσχέδιο','border-zinc-500/25 bg-zinc-500/10 text-zinc-300'],
 pending:['Σε έγκριση','border-amber-400/25 bg-amber-400/10 text-amber-200'],
 approved:['Εγκεκριμένη','border-emerald-400/25 bg-emerald-400/10 text-emerald-200'],
 rejected:['Απορρίφθηκε','border-rose-400/25 bg-rose-400/10 text-rose-200']};
 const [text,style]=dict[status]||dict.draft;
 return <span className={'inline-flex shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black '+style}>{text}</span>;
}
function Stat({title,value,desc,icon:Icon}){
 return <div className={card}><div className="mb-4 flex items-center justify-between"><span className="text-xs text-zinc-400">{title}</span><Icon size={19} className="text-purple-300"/></div>
  <p className="text-2xl font-black text-white">{value}</p><p className="mt-2 text-xs leading-5 text-zinc-500">{desc}</p></div>;
}
async function request(url,options={}){
 const response=await fetch(url,{cache:'no-store',...options,
  headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.error||data.message||'Η ενέργεια απέτυχε.'),{
  status:response.status,details:data});
 return data;
}
function estimatedImpressions({amount,campaign,pricing,creatives}){
 const tiers=new Set();
 creatives?.banners?.forEach(c=>{
  (c.placement||[]).forEach(p=>tiers.add(p==='hero'?'hero':'standard'));
 });
 if(creatives?.audios?.length)tiers.add('audio');
 const cpm=[...tiers].map(t=>Number(pricing?.cpmMicros?.[t]||0)/1000000)
  .filter(x=>x>0);
 if(!cpm.length||!amount)return null;
 const low=Math.floor((amount/Math.max(...cpm))*1000);
 const high=Math.floor((amount/Math.min(...cpm))*1000);
 return {low,high,tiers:[...tiers]};
}
function CreativeEditor({draft,setDraft,uploading,onUpload,submit,cancel,busy}){
 const banner=draft.kind==='banner';
 const update=(key,value)=>setDraft(d=>({...d,[key]:value}));
 return <form className={panel+' space-y-5'} onSubmit={submit}>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><p className="text-xs font-black uppercase tracking-[.2em] text-purple-300">Creative studio</p><h3 className="mt-2 text-xl font-black">{draft._id?'Επεξεργασία':'Νέο'} {banner?'Visual':'Audio'} δημιουργικό</h3></div>
   <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
    {[['banner','Visual',ImageIcon],['audio','Audio',Mic2]].map(([k,t,Icon])=>
     <button type="button" key={k} disabled={Boolean(draft._id)} onClick={()=>setDraft(initialCreative(k))}
      className={'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition '+(draft.kind===k?'bg-purple-500 text-white':'text-zinc-400 hover:text-white')}>
      <Icon size={14}/>{t}</button>)}
   </div>
  </div>
  <label className={label}>Τίτλος δημιουργικού
   <input required minLength={3} className={field} value={draft.title} onChange={e=>update('title',e.target.value)} placeholder="π.χ. Black Friday • Audio / Visual"/></label>
  {banner?<div className="space-y-5">
   <label className={label}>Περιγραφή / μήνυμα
    <textarea required className={field} rows={2} maxLength={1200} value={draft.description} onChange={e=>update('description',e.target.value)} placeholder="Το μήνυμα που θα συνοδεύει τη διαφήμιση"/></label>
   <div><span className={label}>Θέσεις προβολής</span><div className="mt-3 grid gap-2 sm:grid-cols-2">
    {formats.map(p=><label key={p.id} className={'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-xs font-bold transition '+(draft.placement.includes(p.id)?'border-purple-400/45 bg-purple-500/10 text-purple-100':'border-white/10 bg-black/20 text-zinc-400')}>
     <input type="checkbox" checked={draft.placement.includes(p.id)} onChange={e=>update('placement',e.target.checked?[...draft.placement,p.id]:draft.placement.filter(v=>v!==p.id))}/>{p.title}</label>)}
   </div></div>
   <div className="grid gap-4 md:grid-cols-2">
    <label className={label}>Κεντρική εικόνα
     <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={e=>onUpload(e.target.files?.[0],'imageUrl','upload-banner','imageFile')} className={field+' file:mr-4 file:rounded-lg file:border-0 file:bg-purple-500/20 file:p-2 file:text-purple-100'}/></label>
    <label className={label}>Τετράγωνη εικόνα (προαιρετική)
     <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={e=>onUpload(e.target.files?.[0],'squareImageUrl','upload-banner','imageFile')} className={field+' file:mr-4 file:rounded-lg file:border-0 file:bg-purple-500/20 file:p-2 file:text-purple-100'}/></label>
   </div>
   {draft.imageUrl&&<div className="overflow-hidden rounded-xl border border-white/10 bg-black/20"><img src={draft.imageUrl} alt="Προεπισκόπηση Visual" className="max-h-48 w-full object-contain"/></div>}
   <label className={label}>URL προορισμού
    <input type="url" required className={field} value={draft.targetUrl} onChange={e=>update('targetUrl',e.target.value)} placeholder="https://brand.gr/promo"/></label>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className={label}>CTA label
     <input className={field} maxLength={45} value={draft.ctaLabel} onChange={e=>update('ctaLabel',e.target.value)}/></label>
    <label className={label}>Brand color
     <div className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0b0a11] px-3 py-2"><input type="color" value={draft.brandColor} onChange={e=>update('brandColor',e.target.value)} className="size-8 rounded-lg"/><span className="text-xs text-zinc-400">{draft.brandColor}</span></div></label>
   </div>
  </div>:<div className="space-y-5">
   <label className={label}>Ηχητικό spot (MP3, WAV ή OGG, έως 10 λεπτά)
    <input type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" disabled={uploading}
     onChange={e=>onUpload(e.target.files?.[0],'audioUrl','upload-ad','audioFile')}
     className={field+' file:mr-4 file:rounded-lg file:border-0 file:bg-purple-500/20 file:p-2 file:text-purple-100'}/></label>
   {draft.audioUrl&&<p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-200"><Check size={14} className="mr-2 inline"/>Audio spot έχει ανέβει. Η προεπισκόπηση είναι διαθέσιμη μετά την αποθήκευση.</p>}
   <label className={label}>Συχνότητα αναπαραγωγής
    <select className={field} value={draft.frequency} onChange={e=>update('frequency',e.target.value)}>
     {[['entry','Στην πρώτη ακρόαση'],['every_5_stations','Κάθε 5 αλλαγές σταθμού'],
       ['every_10_stations','Κάθε 10 αλλαγές'],['every_1_hour','Κάθε ώρα'],['once_a_day','Μία φορά την ημέρα']].map(([v,t])=><option key={v} value={v}>{t}</option>)}
    </select></label>
   <label className={label}>URL του brand (προαιρετικό)
    <input type="url" className={field} value={draft.linkUrl} onChange={e=>update('linkUrl',e.target.value)} placeholder="https://brand.gr"/></label>
  </div>}
  <div className="grid gap-4 sm:grid-cols-2">
   <label className={label}>Λογότυπο brand (προαιρετικό)
    <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={e=>onUpload(e.target.files?.[0],'logoUrl','upload-logo','logoFile')}
     className={field+' file:mr-4 file:rounded-lg file:border-0 file:bg-purple-500/20 file:p-2 file:text-purple-100'}/></label>
   {draft.logoUrl&&<div className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><img src={draft.logoUrl} alt="Logo" className="size-16 rounded-lg object-contain"/><span className="text-xs text-emerald-300">Το λογότυπο ανέβηκε</span></div>}
  </div>
  <p className="rounded-xl border border-purple-400/20 bg-purple-500/[.06] p-3 text-xs leading-6 text-purple-100">Αποθηκεύεται μόνο ως draft. Δεν αποστέλλεται στον Admin πριν ολοκληρωθεί η πληρωμή και η τελική υποβολή.</p>
  <div className="flex flex-wrap justify-end gap-3"><button type="button" className={secondary} onClick={cancel}>Άκυρο</button>
   <button className={primary} disabled={busy||uploading}>{busy||uploading?<Loader2 size={17} className="animate-spin"/>:<Check size={17}/>} Αποθήκευση δημιουργικού</button></div>
 </form>;
}
export default function AdvertisingCampaignWizard({role='agency',currentUser}){
 const admin=role==='admin';
 const base=admin?'/api/admin/advertising/wizard':'/api/advertising/wizard';
 const [searchParams,setSearchParams]=useSearchParams();
 const [campaigns,setCampaigns]=useState([]),[pricing,setPricing]=useState(null);
 const [detail,setDetail]=useState(null),[campaignId,setCampaignId]=useState('');
 const [step,setStep]=useState(0),[draft,setDraft]=useState(initialCampaign);
 const [creativeDraft,setCreativeDraft]=useState(null),[budget,setBudget]=useState('100');
 const [quote,setQuote]=useState(null),[busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [checkoutAttempt,setCheckoutAttempt]=useState(null);
 const allSteps=admin?[...stages.slice(0,4),{title:'Δημοσίευση',desc:'Χωρίς πληρωμή',icon:CheckCircle2}]:stages;
 const current=detail?.campaign,creatives=detail?.creatives;
 const creativeCount=(creatives?.banners?.length||0)+(creatives?.audios?.length||0);
 const confirmed=Number(detail?.finance?.fundedMicros||0)>=Number(current?.plannedBudgetCents||0)*10000&&
   Number(current?.plannedBudgetCents||0)>0;
 const inProgress=(detail?.intents||[]).find(i=>['creating','redirect','unknown'].includes(i.status));
 const editingLocked=current?.approvalStatus!=='draft'||confirmed||Boolean(inProgress);
 const totalBudget=Number(current?.plannedBudgetCents||0)/100;
 const estimate=useMemo(()=>estimatedImpressions({
  amount:totalBudget,campaign:current,pricing,creatives}),[totalBudget,current,pricing,creatives]);
 const countries=Object.keys(LOCATION_DATA);
 const regions=LOCATION_DATA[draft.country]||{};
 const prefectures=regions[draft.region]||{};
 const loadList=useCallback(async()=>{
  const [list,pr]=await Promise.all([request('/api/advertising/campaigns'),request('/api/advertising/pricing')]);
  if(!Array.isArray(list))throw Error('Μη έγκυρη λίστα καμπανιών.');
  setPricing(pr);
  setCampaigns(list.filter(c=>admin?
   c.createdByRole==='admin'&&String(c.agencyId)===String(currentUser?._id):
   c.createdByRole!=='admin'));
 },[admin,currentUser?._id]);
 const loadDetails=useCallback(async id=>{
  const data=await request(base+'/campaigns/'+id);
  setCampaignId(id);setDetail(data);setQuote(data.quote||null);
  setDraft({...data.campaign,
   startsAt:toLocal(new Date(data.campaign.startsAt)),
   endsAt:toLocal(new Date(data.campaign.endsAt))});
  setBudget(String(Number(data.campaign.plannedBudgetCents||10000)/100));
  if(data.campaign.approvalStatus!=='draft')setStep(admin?4:5);
  else if(admin)setStep(data.campaign.plannedBudgetCents>0?3:data.creatives.banners.length+data.creatives.audios.length>0?2:1);
  else if(data.finance.fundedMicros>=data.campaign.plannedBudgetCents*10000&&data.campaign.plannedBudgetCents>0)setStep(5);
  else setStep(data.campaign.plannedBudgetCents>0?3:data.creatives.banners.length+data.creatives.audios.length>0?2:1);
  return data;
 },[base,admin]);
 const requestedId=searchParams.get('campaignId');
 useEffect(()=>{
  let live=true;setLoading(true);setError('');
  const remembered=typeof sessionStorage!=='undefined'?sessionStorage.getItem('iradios-ad-wizard-last-campaign'):null;
  const id=requestedId||(!admin?remembered:null);
  (async()=>{await loadList();if(id){try{await loadDetails(id);}catch(e){if(live){setError(e.message);setDetail(null);setCampaignId('');}}}})()
   .catch(e=>{if(live)setError(e.message)})
   .finally(()=>{if(live)setLoading(false)});
  return ()=>{live=false;};
 },[loadList,loadDetails,requestedId,admin]);
 const selectCampaign=async id=>{
  setError('');setNotice('');setCreativeDraft(null);
  if(!id){setCampaignId('');setDetail(null);setDraft(initialCampaign());setStep(0);setQuote(null);
   setSearchParams({}, {replace:true});if(!admin)sessionStorage.removeItem('iradios-ad-wizard-last-campaign');return;}
  setSearchParams({campaignId:id},{replace:true});
  if(!admin)sessionStorage.setItem('iradios-ad-wizard-last-campaign',id);
 };
 const work=async action=>{
  setBusy(true);setError('');setNotice('');
  try{await action();}catch(e){setError(e.message||'Η αποθήκευση απέτυχε.');}
  finally{setBusy(false);}
 };
 const saveCampaign=e=>{e.preventDefault();void work(async()=>{
  const data={title:draft.title,brand:draft.brand,description:draft.description,
   country:draft.country,region:draft.region,prefecture:draft.prefecture,
   startsAt:new Date(draft.startsAt).toISOString(),endsAt:new Date(draft.endsAt).toISOString()};
  const result=await request(current?base+'/campaigns/'+campaignId:base+'/campaigns',{
   method:current?'PATCH':'POST',body:JSON.stringify(data)});
  if(!current){await selectCampaign(result._id);}
  else{await loadDetails(campaignId);setStep(1);}
  setNotice('Τα στοιχεία της καμπάνιας αποθηκεύτηκαν.');
 });};
 const onUpload=async(file,key,endpoint,fileName)=>{
  if(!file)return;
  setUploading(true);setError('');
  try{
   const form=new FormData();form.append(fileName,file);
   const data=await request('/api/uploads/'+endpoint,{method:'POST',body:form});
   if(!data.url)throw Error('Το αρχείο δεν ανέβηκε σωστά.');
   setCreativeDraft(d=>({...d,[key]:data.url}));
  }catch(e){setError(e.message);}finally{setUploading(false);}
 };
 const saveCreative=e=>{e.preventDefault();void work(async()=>{
  const id=creativeDraft._id,kind=creativeDraft.kind;
  const url=base+'/campaigns/'+campaignId+'/creatives'+(id?'/'+kind+'/'+id:'');
  await request(url,{method:id?'PUT':'POST',body:JSON.stringify(creativeDraft)});
  await loadDetails(campaignId);setCreativeDraft(null);setStep(1);
  setNotice('Το '+(kind==='banner'?'Visual':'Audio')+' δημιουργικό αποθηκεύτηκε ως draft.');
 });};
 const removeCreative=(kind,id)=>{void work(async()=>{
  await request(base+'/campaigns/'+campaignId+'/creatives/'+kind+'/'+id,{method:'DELETE'});
  await loadDetails(campaignId);setStep(1);setNotice('Το δημιουργικό αφαιρέθηκε.');
 });};
 const saveBudget=()=>{void work(async()=>{
  const budgetCents=Math.round(Number(budget)*100);
  if(!Number.isSafeInteger(budgetCents))throw Error('Μη έγκυρο budget.');
  await request(base+'/campaigns/'+campaignId,{method:'PATCH',
   body:JSON.stringify({step:'budget',budgetCents})});
  await loadDetails(campaignId);setStep(3);
 });};
 const makeQuote=()=>{void work(async()=>{
  const data=await request('/api/advertising/campaigns/'+campaignId+'/quotes',{
   method:'POST',body:JSON.stringify({kind:'initial',budgetCents:current.plannedBudgetCents})});
  setQuote(data);setStep(4);setNotice('Το quote έχει διάρκεια 20 λεπτά.');
 });};
 const checkout=()=>{void work(async()=>{
  if(!quote)throw Error('Πρέπει πρώτα να εκδοθεί quote.');
  sessionStorage.setItem('iradios-ad-wizard-last-campaign',campaignId);
  const data=await request('/api/advertising/quotes/'+quote._id+'/checkout',{method:'POST'});
  setCheckoutAttempt(data.intentId);
  if(data.checkoutUrl){window.location.assign(data.checkoutUrl);return;}
  setNotice('Η πληρωμή αναμένει επιβεβαίωση από το Gateway.');
  await loadDetails(campaignId);setStep(4);
 });};
 const checkPayment=()=>{void work(async()=>{
  const intent=(detail?.intents||[]).find(row=>['redirect','unknown','creating'].includes(row.status));
  if(intent){
   const result=await request('/api/advertising/payments/'+intent._id);
   if(result.checkoutUrl)setNotice('Η πληρωμή παραμένει στο Nexi Sandbox. Επανέλεγξε την πληρωμή μετά την επιστροφή.');
  }
  const updated=await loadDetails(campaignId);
  if(updated.finance.fundedMicros>=updated.campaign.plannedBudgetCents*10000&&
    updated.campaign.plannedBudgetCents>0){
   setStep(5);setNotice('Η πληρωμή επιβεβαιώθηκε μέσω υπογεγραμμένου webhook.');
  }else{
   setStep(4);setNotice('Δεν υπάρχει ακόμη επαληθευμένη πίστωση. Δεν έχει ειδοποιηθεί ο Admin.');
  }
 });};
 const submit=()=>{void work(async()=>{
  if(!admin&&!confirmed)throw Error('Απαιτείται επιβεβαιωμένη πληρωμή πριν από την έγκριση.');
  const result=await request(base+'/campaigns/'+campaignId+'/submit',{method:'POST'});
  await loadDetails(campaignId);setStep(admin?4:5);await loadList();
  setNotice(admin?'Η Admin καμπάνια αποθηκεύτηκε χωρίς πληρωμή.':'Η πληρωμένη καμπάνια υποβλήθηκε στον Admin για έγκριση.');
  if(result?.note)setNotice(result.note);
 });};
 const topStep=(index)=>{
  if(!current)return;
  if(index===0||index===1)return !editingLocked;
  if(index===2)return !editingLocked&&creativeCount>0;
  if(index===3)return current.plannedBudgetCents>0;
  if(!admin&&index===4)return current.plannedBudgetCents>0&&creativeCount>0;
  return Boolean(current);
 };
 if(loading)return <div role="status" className={panel+' flex items-center gap-3 text-sm text-purple-200'}><Loader2 size={20} className="animate-spin"/> Φόρτωση Campaign Studio…</div>;
 return <div className="space-y-6 text-white">
  <header className="relative overflow-hidden rounded-[30px] border border-purple-400/25 bg-gradient-to-br from-[#281b3f] via-[#191321] to-[#121218] p-6 sm:p-9">
   <div className="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full bg-purple-500/20 blur-[90px]"/>
   <div className="relative flex flex-wrap items-end justify-between gap-5">
    <div><span className="text-[11px] font-black uppercase tracking-[.24em] text-purple-300">iRadios · Ad Campaign Studio</span>
     <h2 className="mt-3 text-3xl font-black tracking-[-.055em] sm:text-4xl">{admin?'Admin Campaign Studio':'Φτιάξε την καμπάνια σου.'}</h2>
     <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">Ένα οργανωμένο setup, από το πρώτο δημιουργικό έως την τελική έγκριση.{admin?' Χωρίς χρέωση ή Nexi checkout.':' Ο Admin ενημερώνεται μόνο μετά την επιβεβαιωμένη πληρωμή.'}</p>
    </div>
    {current&&<button type="button" className={secondary} onClick={()=>selectCampaign('')}><ArrowLeft size={16}/> Οι καμπάνιες μου</button>}
   </div>
  </header>
  {error&&<div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"><CircleAlert className="shrink-0" size={18}/><span>{error}</span></div>}
  {notice&&<div role="status" className="flex items-start gap-3 rounded-2xl border border-purple-400/30 bg-purple-400/10 p-4 text-sm text-purple-100"><CheckCircle2 size={18} className="shrink-0"/><span>{notice}</span></div>}
  {!current&&!campaignId&&<section className="space-y-5">
   <div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="text-2xl font-black">Οι καμπάνιες μου</h3><p className="mt-2 text-xs text-zinc-400">Συνέχισε ένα προσχέδιο ή ξεκίνα καινούργια καμπάνια.</p></div>
    <button className={primary} onClick={()=>{setDetail(null);setCampaignId('new');setDraft(initialCampaign());setStep(0);}}><Plus size={17}/> Νέα καμπάνια</button></div>
   {campaigns.length===0&&<div className={panel+' py-12 text-center'}><LayoutGrid size={40} className="mx-auto text-purple-300"/><h4 className="mt-5 text-xl font-black">Ξεκίνα την πρώτη καμπάνια σου.</h4><p className="mt-2 text-sm text-zinc-400">Visual ή Audio, με στόχευση και έλεγχο budget σε έξι βήματα.</p></div>}
   <div className="grid gap-3 lg:grid-cols-2">{campaigns.map(c=><button key={c._id} type="button"
    onClick={()=>c.workflowVersion===2?selectCampaign(c._id):setError('Η παλαιότερη καμπάνια χρησιμοποιεί προηγούμενη ροή. Παραμένει προσβάσιμη από τα δημιουργικά και το ιστορικό της.')}
    className={panel+' flex items-center justify-between gap-4 text-left transition hover:border-purple-400/35'}>
    <div className="min-w-0"><h4 className="truncate text-lg font-black">{c.title}</h4>
     <p className="mt-2 text-xs text-zinc-400">{c.brand} · {c.prefecture||c.region}</p>
     <p className="mt-3 text-sm text-purple-200">Budget: {euro(Number(c.budget?.fundedMicros||0)/1e6)} πληρωμένο · {euro(Number(c.budget?.remainingMicros||0)/1e6)} διαθέσιμο</p>
    </div><div className="flex shrink-0 flex-col items-end gap-3"><Status status={c.approvalStatus}/><ChevronRight size={18} className="text-purple-300"/></div>
   </button>)}</div>
  </section>}
  {campaignId==='new'||current?<div className="space-y-6">
   <nav aria-label="Βήματα νέας διαφημιστικής καμπάνιας" className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
    {allSteps.map((item,index)=>{
     const Icon=item.icon;const canGo=topStep(index);
     return <button type="button" key={item.title} aria-current={index===step?'step':undefined}
      disabled={!canGo||busy||!current&&index!==0} onClick={()=>{setError('');setNotice('');setCreativeDraft(null);setStep(index);}}
      className={'flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition sm:p-4 '+(index===step?'border-purple-400/60 bg-purple-500/15 text-white':canGo?'border-white/10 bg-[#17141e] text-zinc-300 hover:border-purple-400/30':'border-white/[.05] bg-black/15 text-zinc-600')}>
      <span className={'flex size-9 shrink-0 items-center justify-center rounded-xl '+(index===step?'bg-purple-500 text-white':'bg-white/[.06]')}><Icon size={18}/></span>
      <span className="min-w-0"><span className="block truncate text-[11px] font-black">{index+1}. {item.title}</span><span className="mt-1 block truncate text-[9px]">{item.desc}</span></span>
     </button>})}
   </nav>
   {current&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
    <div><p className="text-sm font-black">{current.title}</p><p className="mt-1 text-xs text-zinc-500">{current.brand} · {current.prefecture}</p></div><Status status={current.approvalStatus}/></div>}

   {step===0&&<form className={panel+' space-y-6'} onSubmit={saveCampaign}>
    <div><p className="text-xs font-black uppercase tracking-widest text-purple-300">01 · Καμπάνια</p><h3 className="mt-2 text-2xl font-black">Πες μας για το brand σου.</h3><p className="mt-2 text-sm text-zinc-400">Στοιχεία και γεωγραφική στόχευση μέχρι επίπεδο νομού — όχι πόλη.</p></div>
    <div className="grid gap-5 md:grid-cols-2">
     <label className={label}>Τίτλος καμπάνιας<input required minLength={3} maxLength={180} className={field} disabled={editingLocked&&Boolean(current)} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} placeholder="π.χ. Summer Radio Takeover"/></label>
     <label className={label}>Brand / Διαφημιζόμενος<input required minLength={2} maxLength={150} className={field} disabled={editingLocked&&Boolean(current)} value={draft.brand} onChange={e=>setDraft(d=>({...d,brand:e.target.value}))} placeholder="π.χ. ILUMA"/></label>
    </div>
    <label className={label}>Σύντομη περιγραφή<textarea rows={3} maxLength={3000} disabled={editingLocked&&Boolean(current)} className={field} value={draft.description} onChange={e=>setDraft(d=>({...d,description:e.target.value}))} placeholder="Στόχος της καμπάνιας"/></label>
    <div className="grid gap-4 md:grid-cols-2">
     <label className={label}>Έναρξη<input type="datetime-local" required disabled={editingLocked&&Boolean(current)} className={field} value={draft.startsAt} onChange={e=>setDraft(d=>({...d,startsAt:e.target.value}))}/></label>
     <label className={label}>Λήξη<input type="datetime-local" required disabled={editingLocked&&Boolean(current)} className={field} value={draft.endsAt} onChange={e=>setDraft(d=>({...d,endsAt:e.target.value}))}/></label>
    </div>
    <p className="text-xs text-zinc-400">Επιτρεπόμενη διάρκεια: {(pricing?.durationDays||[7,10,14,30]).join(', ')} ημέρες. Το διάστημα ορίζεται από τον Admin.</p>
    <div className="grid gap-4 sm:grid-cols-3">
     <label className={label}>Χώρα<select disabled={editingLocked&&Boolean(current)} className={field} value={draft.country} onChange={e=>setDraft(d=>({...d,country:e.target.value,region:'All',prefecture:e.target.value}))}>
      {countries.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
     <label className={label}>Περιφέρεια<select disabled={editingLocked&&Boolean(current)} className={field} value={draft.region} onChange={e=>setDraft(d=>({...d,region:e.target.value,prefecture:e.target.value==='All'?d.country:e.target.value}))}>
      <option value="All">Όλη η χώρα</option>{Object.keys(regions).map(k=><option key={k} value={k}>{k}</option>)}</select></label>
     <label className={label}>Νομός<select disabled={editingLocked&&Boolean(current)||draft.region==='All'} className={field} value={draft.prefecture} onChange={e=>setDraft(d=>({...d,prefecture:e.target.value}))}>
      <option value={draft.region==='All'?draft.country:draft.region}>Όλη η {draft.region==='All'?'χώρα':'Περιφέρεια'}</option>
      {Object.keys(prefectures).map(k=><option value={k} key={k}>{k}</option>)}</select></label>
    </div>
    <div className="flex justify-end"><button className={primary} disabled={busy||editingLocked&&Boolean(current)}>{busy?<Loader2 size={17} className="animate-spin"/>:null} Αποθήκευση & Δημιουργικά <ArrowRight size={17}/></button></div>
   </form>}

   {step===1&&<div className="space-y-5">
    {!creativeDraft&&<section className={panel+' space-y-6'}>
     <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-purple-300">02 · Δημιουργικά</p>
      <h3 className="mt-2 text-2xl font-black">Visual, Audio ή και τα δύο.</h3><p className="mt-2 text-sm text-zinc-400">Φτιάξε έως 12 δημιουργικά στο ίδιο campaign. Δεν αποστέλλονται στον Admin ακόμα.</p></div>
      <div className="flex gap-2"><button className={secondary} disabled={editingLocked} onClick={()=>setCreativeDraft(initialCreative('banner'))}><Plus size={16}/> Visual</button>
       <button className={secondary} disabled={editingLocked} onClick={()=>setCreativeDraft(initialCreative('audio'))}><Plus size={16}/> Audio</button></div></div>
     {creativeCount===0&&<div className="rounded-2xl border border-dashed border-purple-400/25 bg-purple-500/[.04] p-10 text-center"><AudioLines size={36} className="mx-auto text-purple-300"/>
      <p className="mt-4 text-base font-black">Δεν υπάρχουν δημιουργικά.</p><p className="mt-2 text-sm text-zinc-400">Πρόσθεσε ένα Visual ή Audio για να προχωρήσεις.</p></div>}
     <div className="grid gap-4 md:grid-cols-2">{[
      ...(creatives?.banners||[]).map(c=>({...c,kind:'banner'})),
      ...(creatives?.audios||[]).map(c=>({...c,kind:'audio'}))
     ].map(c=><div key={c._id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between"><span className="rounded-xl bg-purple-500/10 p-2.5 text-purple-200">{c.kind==='banner'?<ImageIcon size={19}/>:<Mic2 size={19}/>}</span><Status status={c.status}/></div>
      <h4 className="mt-4 truncate text-base font-black">{c.title}</h4><p className="mt-2 text-xs text-zinc-400">{c.kind==='banner'?(c.placement||[]).join(' • '):c.frequency}</p>
      {c.kind==='banner'&&c.imageUrl&&<img className="mt-4 h-28 w-full rounded-xl object-cover" src={c.imageUrl} alt={c.title}/>}
      {c.kind==='audio'&&<div className="mt-4"><ProtectedAudioPreview adId={c._id} scope={admin?'admin':'agency'} sourceUrl={c.audioUrl}/></div>}
      {!editingLocked&&<div className="mt-5 flex gap-2"><button type="button" className={secondary+' flex-1'} onClick={()=>setCreativeDraft({...c})}>Επεξεργασία</button>
       <button type="button" className={secondary} aria-label={'Διαγραφή '+c.title} disabled={busy} onClick={()=>removeCreative(c.kind,c._id)}><Trash2 size={16}/></button></div>}
     </div>)}</div>
     <div className="flex flex-wrap justify-between gap-3"><button className={secondary} onClick={()=>setStep(0)}><ArrowLeft size={17}/> Πίσω</button>
      <button className={primary} disabled={!creativeCount} onClick={()=>setStep(2)}>Συνέχεια στο Budget <ArrowRight size={17}/></button></div>
    </section>}
    {creativeDraft&&<CreativeEditor draft={creativeDraft} setDraft={setCreativeDraft}
     uploading={uploading} onUpload={onUpload} submit={saveCreative} busy={busy}
     cancel={()=>setCreativeDraft(null)}/>}
   </div>}

   {step===2&&<section className={panel+' space-y-6'}>
    <div><p className="text-xs font-black uppercase tracking-widest text-purple-300">03 · Budget</p><h3 className="mt-2 text-2xl font-black">Όρισε τον προϋπολογισμό.</h3>
     <p className="mt-2 text-sm leading-6 text-zinc-400">{admin?'Σχεδιαστικό budget Admin, χωρίς χρέωση Nexi.':'Το αρχικό ποσό που θα προπληρωθεί. Δεν δημιουργείται χρέωση με την αποθήκευση.'}</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
     <Stat title="Ελάχιστο" value={euro((pricing?.minBudgetCents||2000)/100)} desc="Όριο τιμοκαταλόγου" icon={Wallet}/>
     <Stat title="Διάρκεια" value={Math.ceil((new Date(current.endsAt)-new Date(current.startsAt))/86400000)+' ημέρες'} desc="Προγραμματισμένη περίοδος" icon={Clock3}/>
     <Stat title="Δημιουργικά" value={num(creativeCount)} desc="Visual / Audio μαζί" icon={ImageIcon}/>
    </div>
    <label className={label}>Αρχικό budget (€)
     <div className="relative max-w-sm"><input type="number" required min="1" step="0.01" disabled={editingLocked} className={field+' pr-14 text-xl font-black'} value={budget} onChange={e=>setBudget(e.target.value)}/><span className="absolute right-5 top-6 text-sm text-zinc-400">EUR</span></div>
    </label>
    <div className="flex flex-wrap justify-between gap-3"><button className={secondary} onClick={()=>setStep(1)}><ArrowLeft size={17}/> Πίσω</button>
     <button className={primary} onClick={saveBudget} disabled={busy||editingLocked}>Αποθήκευση budget & Overview <ArrowRight size={17}/></button></div>
   </section>}

   {step===3&&<section className="space-y-5">
    <div className={panel+' space-y-6'}>
     <div><p className="text-xs font-black uppercase tracking-widest text-purple-300">04 · Overview & Estimation</p><h3 className="mt-2 text-2xl font-black">Έλεγξε πριν προχωρήσεις.</h3><p className="mt-2 text-sm text-zinc-400">Συγκεντρωμένη εικόνα των επιλογών σου και εκτίμηση βάσει του ενεργού CPM.</p></div>
     <div className="grid gap-3 sm:grid-cols-2">
      {[['Καμπάνια',current.title],['Brand',current.brand],['Στόχευση',[current.country,current.region==='All'?null:current.region,current.prefecture].filter(Boolean).join(' • ')],
       ['Περίοδος',new Date(current.startsAt).toLocaleDateString('el-GR')+' – '+new Date(current.endsAt).toLocaleDateString('el-GR')],
       ['Δημιουργικά',creativeCount+' • '+(creatives.banners.length?'Visual '+creatives.banners.length:'')+' '+(creatives.audios.length?'Audio '+creatives.audios.length:'')],
       ['Αρχικό budget',euro(totalBudget)]].map(([name,value])=><div key={name} className={card}><p className="text-xs text-zinc-500">{name}</p><p className="mt-2 break-words text-sm font-black text-white">{value}</p></div>)}
     </div>
     <div className="rounded-2xl border border-purple-300/20 bg-purple-500/[.07] p-5">
      <div className="flex items-center gap-3"><BarChart3 size={21} className="text-purple-300"/><h4 className="font-black">Ενδεικτικό εύρος προβολών</h4></div>
      <p className="mt-4 text-3xl font-black text-white">{estimate?estimate.low===estimate.high?num(estimate.low):num(estimate.low)+' – '+num(estimate.high):'—'}</p>
      <p className="mt-3 text-xs leading-6 text-zinc-300">Θεωρητικό εύρος αν όλο το budget διατεθεί σε ένα από τα επιλεγμένα CPM tiers. Δεν είναι πρόβλεψη πραγματικών ακροάσεων, guaranteed impressions ή ακριβής κατανομή. Επηρεάζεται από διαθέσιμο inventory, pacing και γεωγραφική στόχευση.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
       {[['standard','Standard'],['hero','Homepage Hero'],['audio','Audio']].map(([key,name])=><p key={key} className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs"><span className="block text-zinc-500">{name} CPM</span><strong className="mt-1 block text-base text-purple-100">{euro(Number(pricing?.cpmMicros?.[key]||0)/1e6)}</strong></p>)}
      </div>
     </div>
     {!admin&&<div className={card+' space-y-3'}>
      <p className="font-bold">Οικονομική σύνοψη</p>
      <p className="flex justify-between text-sm text-zinc-300"><span>Καθαρό budget</span><strong>{euro(totalBudget)}</strong></p>
      <p className="flex justify-between text-sm text-zinc-300"><span>ΦΠΑ {pricing?.taxBps==null?'(δεν έχει οριστεί)':(Number(pricing.taxBps)/100)+'%'}</span><strong>{pricing?.taxBps==null?'—':euro(totalBudget*pricing.taxBps/10000)}</strong></p>
      <div className="flex justify-between border-t border-white/10 pt-4 text-lg"><span>Ενδεικτικό πληρωτέο</span><strong>{pricing?.taxMode==='budget_net_plus_vat'?euro(totalBudget*(1+pricing.taxBps/10000)):'—'}</strong></div>
      <p className="text-xs leading-5 text-zinc-500">Το τελικό πληρωτέο και τα CPM snapshots επιβεβαιώνονται μόνο στο επίσημο, χρονικά περιορισμένο quote της πλατφόρμας.</p>
     </div>}
     <div className="flex flex-wrap justify-between gap-3"><button className={secondary} onClick={()=>setStep(2)}><ArrowLeft size={17}/> Αλλαγή budget</button>
      {admin?<button className={primary} onClick={()=>setStep(4)}>Τελικός έλεγχος Admin <ArrowRight size={17}/></button>:
       <button className={primary} onClick={()=>{if(quote){setStep(4);}else makeQuote();}} disabled={busy||!pricing?.enabled||pricing?.taxMode!=='budget_net_plus_vat'||editingLocked&& !quote}>
        Συνέχεια στην πληρωμή <ArrowRight size={17}/></button>}
     </div>
     {!admin&&!pricing?.enabled&&<p role="status" className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-xs text-amber-200">Ο τιμοκατάλογος δεν έχει ενεργοποιηθεί από τον Admin. Το draft παραμένει ασφαλές, αλλά δεν μπορεί να δημιουργηθεί quote.</p>}
    </div>
   </section>}

   {!admin&&step===4&&<section className={panel+' space-y-6'}>
    <div><p className="text-xs font-black uppercase tracking-widest text-purple-300">05 · Nexi Sandbox Payment</p><h3 className="mt-2 text-2xl font-black">Ολοκλήρωση πληρωμής.</h3>
     <p className="mt-2 text-sm leading-6 text-zinc-400">Μόνο το υπογεγραμμένο webhook της Nexi πιστώνει το budget. Η επιστροφή στην εφαρμογή δεν σημαίνει εξόφληση.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
     <Stat icon={Wallet} title="Budget" value={euro(totalBudget)} desc="Αρχικό budget"/>
     <Stat icon={CreditCard} title="Πληρωτέο quote" value={quote?euro(quote.paymentCents/100):'—'} desc={quote?'Quote v'+quote.priceVersion:'Αναμονή έκδοσης'}/>
     <Stat icon={BadgeCheck} title="Επιβεβαιωμένο" value={euro(Number(detail?.finance?.fundedMicros||0)/1e6)} desc="Μόνο από webhook"/>
    </div>
    {confirmed?<div className="flex items-start gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[.07] p-5 text-sm text-emerald-200"><CheckCircle2 className="shrink-0" size={20}/> Η πληρωμή επιβεβαιώθηκε. Μπορείς πλέον να υποβάλεις την καμπάνια για έγκριση.</div>:
     <div className="space-y-4">
      {!pricing?.sandboxCheckoutReady&&<p role="alert" className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">Το Advertising Nexi Sandbox checkout δεν είναι ενεργό στο περιβάλλον. Απαιτούνται ενεργός τιμοκατάλογος, φορολογική πολιτική και το server-side sandbox payment flag. Δεν υπάρχει εικονική πληρωμή.</p>}
      {quote&&<div className={card+' space-y-2 text-sm'}><p className="font-bold">Επίσημο quote · έκδοση {quote.priceVersion}</p><p className="text-zinc-400">Budget: {euro(quote.budgetCents/100)} · ΦΠΑ: {euro(quote.taxCents/100)}</p>
       <p className="text-xs text-zinc-500">Λήξη: {new Date(quote.expiresAt).toLocaleString('el-GR')}</p></div>}
      {inProgress&&<p className="rounded-xl border border-purple-400/20 bg-purple-400/10 p-4 text-xs text-purple-100">Υπάρχει ήδη πληρωμή σε εξέλιξη. Μην ξεκινήσεις δεύτερη χρέωση. Έλεγξε πρώτα την ίδια συναλλαγή.</p>}
      <div className="flex flex-wrap gap-3">{!quote?<button className={primary} disabled={busy||!pricing?.enabled} onClick={makeQuote}>Δημιουργία quote</button>:
       <button className={primary} onClick={checkout} disabled={busy||!pricing?.sandboxCheckoutReady||Boolean(inProgress)||new Date(quote.expiresAt)<=new Date()}>
        <CreditCard size={17}/> Ασφαλής πληρωμή Nexi</button>}
       <button className={secondary} disabled={busy} onClick={checkPayment}><RefreshCw size={16}/> Έλεγχος επιβεβαίωσης</button></div>
     </div>}
    <div className="flex flex-wrap justify-between gap-3"><button className={secondary} onClick={()=>setStep(3)}><ArrowLeft size={17}/> Overview</button>
     <button className={primary} disabled={!confirmed} onClick={()=>setStep(5)}>Τελική υποβολή <ArrowRight size={17}/></button></div>
   </section>}

   {step===(admin?4:5)&&<section className={panel+' space-y-6'}>
    <div className="text-center"><div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-300"><ShieldCheck size={34}/></div>
     <p className="mt-5 text-xs font-black uppercase tracking-widest text-purple-300">{admin?'05 · Admin publish':'06 · Admin approval'}</p>
     <h3 className="mt-3 text-2xl font-black">{current?.approvalStatus==='draft'?(admin?'Έτοιμο για δημοσίευση.':'Έτοιμο για έγκριση Admin.'):'Η καμπάνια έχει υποβληθεί.'}</h3>
     <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-400">{admin?'Η Admin καμπάνια παρακάμπτει αποκλειστικά την πληρωμή. Δεν δημιουργείται πλασματική χρηματοδότηση.':'Μετά την επαληθευμένη πληρωμή, η τελική υποβολή στέλνει την καμπάνια και τα δημιουργικά στον Admin για έλεγχο και απόφαση.'}</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
     <Stat title="Δημιουργικά" icon={ImageIcon} value={num(creativeCount)} desc="Visual & Audio"/>
     <Stat title="Budget" icon={Wallet} value={euro(totalBudget)} desc={admin?'Χωρίς πληρωμή':confirmed?'Επιβεβαιωμένο':'Ανεπιβεβαίωτο'}/>
     <Stat title="Κατάσταση" icon={FileCheck2} value={current?.approvalStatus==='draft'?'Draft':current?.approvalStatus==='pending'?'Review':'Completed'} desc="Campaign status"/>
    </div>
    {current?.approvalStatus==='draft'?<div className="flex flex-col items-center gap-3">
     {!admin&&!confirmed&&<p role="alert" className="text-sm text-amber-200">Δεν μπορεί να υποβληθεί χωρίς επαληθευμένη πληρωμή.</p>}
     <button className={primary} disabled={busy||!creativeCount||!current?.plannedBudgetCents||!admin&&!confirmed} onClick={submit}>
      {busy?<Loader2 size={17} className="animate-spin"/>:<ShieldCheck size={18}/>}
      {admin?'Οριστική δημοσίευση χωρίς πληρωμή':'Αποστολή στον Admin για έγκριση'}</button>
    </div>:<div className="space-y-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] p-5 text-center">
     <CheckCircle2 size={30} className="mx-auto text-emerald-300"/><h4 className="font-black">{current?.approvalStatus==='pending'?'Αναμονή έγκρισης':'Η διαδικασία ολοκληρώθηκε.'}</h4>
     <p className="text-xs text-zinc-400">{current?.approvalStatus==='pending'?'Ο Admin εξετάζει την πληρωμένη καμπάνια και τα δημιουργικά.':'Η κατάσταση της καμπάνιας ενημερώθηκε.'}</p></div>}
    <div className="flex flex-wrap justify-center gap-3"><button className={secondary} onClick={()=>selectCampaign('')}><ArrowLeft size={16}/> Οι καμπάνιες μου</button>
     {!admin&&current?.approvalStatus==='draft'&&<button className={secondary} onClick={()=>setStep(4)}>Προηγούμενο βήμα</button>}</div>
   </section>}
  </div>:null}
 </div>;
}
