import React,{useEffect,useState} from 'react';
import {Newspaper,Save,RefreshCw,ExternalLink,Clock3,CheckCircle2,AlertTriangle,Image as ImageIcon,Plus,Trash2,Link2,Globe2} from 'lucide-react';
import {adminFetch} from '../utils/adminFetch';

const DEFAULT='https://rss.app/feeds/k4AEhunSwl50WyaC.xml';
const EXAMPLE='https://rssnews.io/?feed=my&c=%CE%95%CE%BB%CE%BB%CE%AC%CE%B4%CE%B1%2CBusiness%2CEducation%2C%CE%9A%CF%8C%CF%83%CE%BC%CE%BF%CF%82%2C%CE%91%CE%B8%CE%BB%CE%B7%CF%84%CE%B9%CE%BA%CE%AC%2C%CE%A4%CE%B5%CF%87%CE%BD%CE%BF%CE%BB%CE%BF%CE%B3%CE%AF%CE%B1';
const fmt=value=>value&&Number.isFinite(new Date(value).getTime())?
  new Intl.DateTimeFormat('el-GR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
const isGoogle=url=>{try{return new URL(url).hostname==='news.google.com';}catch{return false;}};
const isRssnews=url=>{try{return new URL(url).hostname==='rssnews.io';}catch{return false;}};
const rssCategories=url=>{try{return new URL(url).searchParams.get('c')?.split(',')||[];}catch{return [];}};
const field='w-full min-w-0 rounded-xl border border-white/15 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-[#ccff00]';
const fresh=url=>({url,enabled:true,label:'',domain:'',id:''});
function sourceName(item){
  if(item.label)return item.label;
  if(item.feedTitle)return item.feedTitle;
  if(item.domain)return item.domain;
  if(isRssnews(item.url))return 'Επιλογή κατηγοριών rssnews.io';
  if(isGoogle(item.url))return 'Google News Publisher';
  return 'RSS.app';
}
export default function AdminNewsFeed(){
  const [sources,setSources]=useState([fresh(DEFAULT)]),[enabled,setEnabled]=useState(true);
  const [newLinks,setNewLinks]=useState(''),[data,setData]=useState(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{
    let active=true;
    adminFetch('/api/admin/newsfeed').then(async r=>{
      const response=await r.json();if(!r.ok)throw Error(response.error||'Δεν φορτώθηκαν οι πηγές.');
      return response;
    }).then(response=>{
      if(!active)return;
      setData(response);
      setSources(response.sources?.length?response.sources.map(s=>({...s})):
        [fresh(response.feedUrl||DEFAULT)]);
      setEnabled(Boolean(response.enabled));
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  const update=(index,patch)=>setSources(previous=>previous.map((s,i)=>i===index?{...s,...patch}:s));
  const add=()=>{
    setError('');setNotice('');
    const urls=newLinks.split(/[\n\r]+/).map(s=>s.trim()).filter(Boolean);
    if(!urls.length){setError('Επικόλλησε έναν ή περισσότερους συνδέσμους.');return;}
    const existing=new Set(sources.map(s=>s.url));
    const added=[];
    for(const url of urls)if(!existing.has(url)){existing.add(url);added.push(fresh(url));}
    if(existing.size>12){setError('Μέχρι 12 πηγές μπορούν να είναι ενεργές στη λίστα.');return;}
    if(!added.length){setError('Οι σύνδεσμοι έχουν ήδη προστεθεί.');return;}
    setSources(old=>[...old,...added]);setNewLinks('');
    setNotice('Προστέθηκαν '+added.length+' πηγές. Πάτησε «Αποθήκευση πηγών» και μετά «Συγχρονισμός τώρα».');
  };
  const save=async e=>{
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      if(!sources.length)throw Error('Πρόσθεσε τουλάχιστον μία πηγή.');
      const r=await adminFetch('/api/admin/newsfeed',{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({enabled,sources:sources.map(s=>({
          id:s.id||undefined,url:s.url,enabled:s.enabled!==false,label:s.label||'',domain:s.domain||''
        }))})});
      const response=await r.json();if(!r.ok)throw Error(response.error||'Αποτυχία αποθήκευσης.');
      setData(response);setSources(response.sources||[]);
      setNotice('Αποθηκεύτηκαν '+response.sources.length+' πηγές. Επίλεξε «Συγχρονισμός τώρα» για εισαγωγή.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const sync=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      const r=await adminFetch('/api/admin/newsfeed/refresh',{method:'POST'});
      const response=await r.json();if(!r.ok)throw Error(response.error||'Αδυναμία συγχρονισμού.');
      setData(response);
      setSources(response.sources||[]);
      const count=(response.sources||[]).filter(s=>s.lastError).length;
      setNotice('Ο συγχρονισμός ολοκληρώθηκε με '+response.articles.length+' άρθρα.'+
        (count?' '+count+' πηγές εμφάνισαν σφάλμα — δες τις λεπτομέρειες παρακάτω.':''));
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="admin-legacy-page space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ccff00]">iRadios GR / Newsroom</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-white"><Newspaper size={29} className="text-[#ccff00]"/> Publishers & Newsfeed</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Συνδύασε επιλογές κατηγοριών rssnews.io, RSS εκδοτών και Google News publishers σε μία ροή. Χωρίς XML mapping ή ξεχωριστές καμπάνιες. Τα άρθρα μπαίνουν με βάση τη δημοσίευση, με όνομα πηγής και αυτόματη απομάκρυνση διπλών εγγραφών.</p>
      </div>
      <a href="/newsfeed" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-bold text-white hover:border-[#ccff00]">Δες το Newsfeed <ExternalLink size={16}/></a>
    </header>
    {error&&<p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertTriangle size={17} className="shrink-0"/>{error}</p>}
    {notice&&<p role="status" className="flex items-center gap-2 rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/10 p-4 text-sm text-[#ccff00]"><CheckCircle2 size={17} className="shrink-0"/>{notice}</p>}
    <section className="ir-glass space-y-4 p-5 sm:p-7">
      <div><h2 className="text-lg font-black text-white">Πρόσθεσε publishers</h2>
        <p className="mt-1 text-xs leading-6 text-zinc-400">Επικόλλησε το «Η ροή μου» link από το rssnews.io, Google News publishers ή RSS.app feeds — ένα link ανά γραμμή. Οι επιλογές rssnews.io αντιστοιχίζονται στις ίδιες κατηγορίες και συγκεντρώνονται από RSS εκδοτών, με εικόνες όπου διατίθενται.</p></div>
      <textarea value={newLinks} onChange={e=>setNewLinks(e.target.value)} rows={3} disabled={busy||loading}
        placeholder={EXAMPLE} className={field+' resize-y'} aria-label="Νέοι σύνδεσμοι rssnews.io, Google News ή RSS"/>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy||loading} onClick={add}
          className="inline-flex items-center gap-2 rounded-xl border border-[#ccff00]/40 px-5 py-3 text-sm font-bold text-[#ccff00] hover:bg-[#ccff00]/10 disabled:opacity-40">
          <Plus size={17}/> Προσθήκη publishers
        </button>
        <span className="text-xs text-zinc-500">{sources.length}/12 πηγές</span>
      </div>
    </section>
    <form onSubmit={save} className="ir-glass space-y-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-white">Οι πηγές σου</h2>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} className="size-4 accent-[#ccff00]"/> Newsfeed ενεργό</label>
      </div>
      <div className="space-y-3">
        {sources.map((source,index)=><div key={source.id||index} className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-black text-white">{isGoogle(source.url)||isRssnews(source.url)?<Globe2 className="text-[#ccff00]" size={16}/>:<Link2 className="text-[#ccff00]" size={16}/>} {sourceName(source)}</p>
              <p className="mt-1 text-xs text-zinc-500">{isRssnews(source.url)?'RSS εκδοτών / κατηγορίες rssnews.io':isGoogle(source.url)?'Google News':'RSS.app'} · {source.fetchedCount||0} άρθρα · {fmt(source.lastSyncedAt)}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={source.enabled!==false} onChange={e=>update(index,{enabled:e.target.checked})} className="accent-[#ccff00]"/> Ενεργό</label>
              <button type="button" aria-label={'Αφαίρεση πηγής '+(index+1)} disabled={busy||sources.length===1}
                onClick={()=>setSources(old=>old.filter((_,i)=>i!==index))} className="rounded-lg border border-white/10 p-2.5 text-rose-300 hover:border-rose-400/50 disabled:opacity-30"><Trash2 size={16}/></button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="min-w-0 md:col-span-2"><span className="mb-1 block text-xs font-semibold text-zinc-400">Link πηγής</span>
              <input required type="url" value={source.url} onChange={e=>update(index,{url:e.target.value})} className={field}/></label>
            <label><span className="mb-1 block text-xs font-semibold text-zinc-400">Όνομα (προαιρετικό)</span>
              <input value={source.label||''} maxLength={80} onChange={e=>update(index,{label:e.target.value})} className={field} placeholder="π.χ. Ειδησεογραφικό Μέσο"/></label>
            {isGoogle(source.url)&&<label><span className="mb-1 block text-xs font-semibold text-zinc-400">Publisher domain (προαιρετικό fallback)</span>
              <input value={source.domain||''} onChange={e=>update(index,{domain:e.target.value})}
                className={field} placeholder="π.χ. iefimerida.gr"/></label>}
          </div>
          {isRssnews(source.url)&&<div className="mt-3 space-y-2"><div className="flex flex-wrap gap-1.5">{rssCategories(source.url).map(category=><span key={category} className="rounded-full border border-[#ccff00]/20 bg-[#ccff00]/[.05] px-2.5 py-1 text-[11px] font-bold text-[#ccff00]">{category}</span>)}</div><p className="text-xs leading-5 text-zinc-500">Το link αποθηκεύει τις κατηγορίες. Επειδή δεν είναι XML/API, τα άρθρα αντλούνται από απευθείας RSS ελληνικών εκδοτών. Η ακριβής λίστα του rssnews.io μπορεί να διαφέρει. Οι πραγματικές φωτογραφίες εντοπίζονται από το RSS ή το Open Graph της πηγής.</p></div>}
          {source.retrievalMode==='domain-search'&&<p className="mt-3 text-xs leading-5 text-amber-200">Εναλλακτική λειτουργία: Google News αναζήτηση με το domain του εκδότη, επειδή δεν ήταν διαθέσιμο publisher RSS. Τα αποτελέσματα μπορεί να μην ταυτίζονται απόλυτα με τη σελίδα του publisher.</p>}
          {source.lastError&&<p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">{source.lastError}</p>}
        </div>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy||loading} type="submit" className="ir-action-primary px-5"><Save size={17}/> Αποθήκευση πηγών</button>
        <button disabled={busy||loading} type="button" onClick={sync}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-bold text-white hover:border-[#ccff00] disabled:opacity-50">
          <RefreshCw size={16} className={busy?'animate-spin':''}/> Συγχρονισμός τώρα
        </button>
      </div>
      <p className="text-xs leading-5 text-zinc-500">Ο συγχρονισμός γίνεται server-side με κοινή cache. Επιτρέπονται μόνο ελεγμένες μορφές URL από rssnews.io, Google News και RSS.app. Τα απευθείας RSS εκδοτών επιλέγονται από ασφαλή λίστα και όπου δεν υπάρχει φωτογραφία εξετάζεται το Open Graph του άρθρου. Τα Google News feeds από μόνα τους συχνά δεν δίνουν φωτογραφία. Πριν τη δημόσια χρήση Google News περιεχομένου επιβεβαίωσε τους όρους και τα δικαιώματα προβολής.</p>
    </form>
    {data&&<section className="ir-glass p-5 sm:p-7">
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Άρθρα</p><strong className="mt-2 block text-2xl text-white">{data.articles?.length||0}</strong></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Πηγές</p><strong className="mt-2 block text-2xl text-white">{data.sources?.length||0}</strong></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Συγχρονίστηκε</p><strong className="mt-2 flex items-center gap-2 text-sm text-white"><Clock3 size={16}/>{fmt(data.lastSyncedAt)}</strong></div>
      </div>
      {data.lastError&&<p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">{data.lastError}</p>}
      <h2 className="mb-4 text-lg font-black text-white">Προεπισκόπηση άρθρων</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {(data.articles||[]).slice(0,10).map(item=><a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
          className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 hover:border-[#ccff00]/40">
          {item.imageUrl?<img src={item.imageUrl} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-xl object-cover"/>:
            <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-zinc-900"><ImageIcon className="text-zinc-600"/></div>}
          <div className="min-w-0"><p className="line-clamp-2 text-sm font-bold text-white">{item.title}</p>
            <p className="mt-2 text-xs text-zinc-400">{item.source||'Ειδήσεις'} · {fmt(item.publishedAt)}</p></div>
        </a>)}
        {!data.articles?.length&&<p className="text-sm text-zinc-400">Δεν υπάρχουν συγχρονισμένες ειδήσεις ακόμη. Πάτησε «Συγχρονισμός τώρα».</p>}
      </div>
    </section>}
  </div>;
}
