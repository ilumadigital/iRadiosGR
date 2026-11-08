import React,{useEffect,useState} from 'react';
import {Newspaper,Save,RefreshCw,ExternalLink,Clock3,CheckCircle2,AlertTriangle,Image as ImageIcon} from 'lucide-react';
import {adminFetch} from '../utils/adminFetch';
const DEFAULT='https://rss.app/feeds/k4AEhunSwl50WyaC.xml';
const fmt=value=>value&&Number.isFinite(new Date(value).getTime())?new Intl.DateTimeFormat('el-GR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
export default function AdminNewsFeed(){
  const [feedUrl,setFeedUrl]=useState(DEFAULT),[enabled,setEnabled]=useState(true);
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{
    let active=true;
    adminFetch('/api/admin/newsfeed').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Δεν φορτώθηκαν οι ρυθμίσεις.');return d;})
      .then(d=>{if(active){setData(d);setFeedUrl(d.feedUrl||DEFAULT);setEnabled(Boolean(d.enabled));}})
      .catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  const save=async e=>{
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const r=await adminFetch('/api/admin/newsfeed',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({feedUrl,enabled})});
      const d=await r.json();if(!r.ok)throw Error(d.error||'Δεν αποθηκεύτηκε.');
      setData(d);setNotice('Η πηγή αποθηκεύτηκε. Μπορείς να συγχρονίσεις αμέσως.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const sync=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      const r=await adminFetch('/api/admin/newsfeed/refresh',{method:'POST'});
      const d=await r.json();if(!r.ok)throw Error(d.error||'Ο συγχρονισμός απέτυχε.');
      setData(d);setNotice('Ο συγχρονισμός ολοκληρώθηκε: '+d.articles.length+' ειδήσεις.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  return <div className="admin-legacy-page space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ccff00]">iRadios GR / Content</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-white"><Newspaper size={29} className="text-[#ccff00]"/> Newsfeed RSS</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Ειδήσεις από RSS XML με τίτλο, φωτογραφία, πηγή και χρόνο δημοσίευσης. Server cache 5 λεπτών.</p>
      </div>
      <a href="/newsfeed" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-bold text-white hover:border-[#ccff00]">Δες το Newsfeed <ExternalLink size={16}/></a>
    </header>
    {error&&<p role="alert" className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200"><AlertTriangle size={17}/>{error}</p>}
    {notice&&<p role="status" className="flex items-center gap-2 rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/10 p-4 text-sm text-[#ccff00]"><CheckCircle2 size={17}/>{notice}</p>}
    <form onSubmit={save} className="ir-glass space-y-5 p-5 sm:p-7">
      <label className="block"><span className="mb-2 block text-xs font-black text-zinc-300">RSS.app XML URL</span>
        <input required type="url" value={feedUrl} disabled={busy||loading} onChange={e=>setFeedUrl(e.target.value)}
          placeholder={DEFAULT} className="w-full rounded-xl border border-white/15 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-[#ccff00]"/>
      </label>
      <label className="inline-flex items-center gap-3 text-sm font-semibold text-white"><input type="checkbox" className="size-4 accent-[#ccff00]" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Ενεργό Newsfeed</label>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy||loading} type="submit" className="ir-action-primary px-5"><Save size={17}/> Αποθήκευση XML</button>
        <button disabled={busy||loading} type="button" onClick={sync} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-bold text-white hover:border-[#ccff00] disabled:opacity-50"><RefreshCw size={16} className={busy?'animate-spin':''}/> Συγχρονισμός τώρα</button>
      </div>
      <p className="text-xs text-zinc-500">Επιτρέπονται HTTPS XML feeds του rss.app. Αν η πηγή διακοπεί, οι τελευταίες αποθηκευμένες ειδήσεις παραμένουν διαθέσιμες.</p>
    </form>
    {data&&<section className="ir-glass p-5 sm:p-7">
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Άρθρα</p><strong className="mt-2 block text-2xl text-white">{data.articles?.length||0}</strong></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Συγχρονισμός</p><strong className="mt-2 flex items-center gap-2 text-sm text-white"><Clock3 size={16}/>{fmt(data.lastSyncedAt)}</strong></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Κατάσταση</p><strong className="mt-2 block text-sm text-white">{data.enabled?'Ενεργό':'Ανενεργό'}</strong></div>
      </div>
      {data.lastError&&<p className="mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-200">Τελευταίο σφάλμα: {data.lastError}</p>}
      <h2 className="mb-4 text-xl font-black text-white">Προεπισκόπηση ειδήσεων</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {(data.articles||[]).slice(0,8).map(item=><a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 hover:border-[#ccff00]/40">
          {item.imageUrl?<img src={item.imageUrl} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-xl object-cover"/>:<div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-zinc-900"><ImageIcon className="text-zinc-600"/></div>}
          <div className="min-w-0"><p className="line-clamp-2 text-sm font-bold text-white">{item.title}</p><p className="mt-2 text-xs text-zinc-400">{item.source||data.feedTitle} · {fmt(item.publishedAt)}</p></div>
        </a>)}
        {!data.articles?.length&&<p className="text-sm text-zinc-400">Δεν έχουν εισαχθεί ακόμη ειδήσεις. Πάτησε «Συγχρονισμός τώρα».</p>}
      </div>
    </section>}
  </div>;
}
