import React,{useEffect,useState} from 'react';
import {Newspaper,Save,RefreshCw,ExternalLink,Clock3,CheckCircle2,AlertTriangle,Image as ImageIcon,Plus,Trash2,Link2,Globe2} from 'lucide-react';
import {adminFetch} from '../utils/adminFetch';

const EXAMPLE='https://www.newsbeast.gr/feed';
const fmt=value=>value&&Number.isFinite(new Date(value).getTime())?
  new Intl.DateTimeFormat('el-GR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
const isGoogle=url=>{try{return new URL(url).hostname==='news.google.com';}catch{return false;}};
const isRssnews=url=>{try{return new URL(url).hostname==='rssnews.io';}catch{return false;}};
const isDirect=url=>{try{return !['rss.app','rssnews.io','news.google.com'].includes(new URL(url).hostname);}catch{return false;}};
const rssCategories=url=>{try{return new URL(url).searchParams.get('c')?.split(',')||[];}catch{return [];}};
const selectedPublishers=url=>{try{return new URL(url).searchParams.get('s')?.split(',').filter(Boolean)||[];}catch{return [];}};
const MAX_SOURCES=32;
const field='w-full min-w-0 rounded-xl border border-white/15 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-[#ccff00]';
const fresh=url=>({url,enabled:true,label:'',domain:'',category:'',id:''});
function sourceName(item){
  if(item.label)return item.label;
  if(item.feedTitle)return item.feedTitle;
  if(item.domain)return item.domain;
  if(isRssnews(item.url))return 'Επιλογή κατηγοριών rssnews.io';
  if(isGoogle(item.url))return 'Google News Publisher';
  if(isDirect(item.url))return new URL(item.url).hostname.replace(/^www\./,'');
  return 'RSS.app';
}
export default function AdminNewsFeed(){
  const [sources,setSources]=useState([]),[enabled,setEnabled]=useState(true);
  const [newLinks,setNewLinks]=useState(''),[data,setData]=useState(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [articleSearch,setArticleSearch]=useState(''),[articleLimit,setArticleLimit]=useState(30);
  useEffect(()=>{
    let active=true;
    adminFetch('/api/admin/newsfeed').then(async r=>{
      const response=await r.json();if(!r.ok)throw Error(response.error||'Δεν φορτώθηκαν οι πηγές.');
      return response;
    }).then(response=>{
      if(!active)return;
      setData(response);
      setSources((response.sources||[]).map(s=>({...s})));
      setEnabled(Boolean(response.enabled));
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  const read=async (url,options={})=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await adminFetch(url,{...options,signal:controller.signal});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||'Η ενέργεια απέτυχε. Δοκίμασε ξανά.');
      return body;
    }catch(e){
      if(e.name==='AbortError')throw new Error('Η σύνδεση άργησε. Έλεγξε τη ροή και δοκίμασε ξανά.');
      throw e;
    }finally{clearTimeout(timeout);}
  };
  useEffect(()=>{
    if(!data?.syncing)return;
    let active=true,polling=false;
    const timer=setInterval(async()=>{
      if(polling)return;
      polling=true;
      try{
        const latest=await read('/api/admin/newsfeed');
        if(!active)return;
        setData(latest);
        if(!latest.syncing){
          // Refresh diagnostics without overwriting unsaved edits to feed fields.
          setSources(current=>(latest.sources||[]).map(server=>{
            const local=current.find(item=>item.id===server.id);
            if(!local)return server;
            return {...local,feedTitle:server.feedTitle,lastSyncedAt:server.lastSyncedAt,
              lastAttemptAt:server.lastAttemptAt,lastError:server.lastError,
              fetchedCount:server.fetchedCount,retrievalMode:server.retrievalMode,
              publisherReports:server.publisherReports};
          }));
          setNotice('Ο συγχρονισμός ολοκληρώθηκε. '+(latest.articles?.length||0)+' / 500 άρθρα.');
        }
      }catch(e){if(active)setError(e.message);}
      finally{polling=false;}
    },3000);
    return()=>{active=false;clearInterval(timer);};
  },[data?.syncing]);
  const update=(index,patch)=>setSources(previous=>previous.map((s,i)=>i===index?{...s,...patch}:s));
  const persist=async(next,active=enabled,message='Οι πηγές αποθηκεύτηκαν.')=>{
    setBusy(true);setError('');setNotice('');
    try{
      const response=await read('/api/admin/newsfeed',{method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({enabled:active,sources:next.map(item=>({
          id:item.id||undefined,url:item.url,enabled:item.enabled!==false,
          label:item.label||'',domain:item.domain||'',category:item.category||''
        }))})});
      setData(response);setSources(response.sources||[]);setEnabled(Boolean(response.enabled));
      setNotice(message);
      return true;
    }catch(e){setError(e.message);return false;}
    finally{setBusy(false);}
  };
  const add=async()=>{
    if(busy||loading)return;
    const urls=newLinks.split(/[\n\r]+/).map(u=>u.trim()).filter(Boolean);
    if(!urls.length){setError('Επικόλλησε έναν ή περισσότερους συνδέσμους.');return;}
    const existing=new Set(sources.map(s=>s.url));
    const added=[];
    for(const url of urls)if(!existing.has(url)){existing.add(url);added.push(fresh(url));}
    if(existing.size>MAX_SOURCES){setError('Μέχρι '+MAX_SOURCES+' πηγές.');return;}
    if(!added.length){setError('Αυτοί οι σύνδεσμοι υπάρχουν ήδη.');return;}
    if(await persist([...sources,...added],enabled,'Προστέθηκαν και αποθηκεύτηκαν '+added.length+' πηγές.'))setNewLinks('');
  };
  const remove=async(index)=>{
    if(busy||loading)return;
    await persist(sources.filter((_,i)=>i!==index),enabled,'Η πηγή αφαιρέθηκε οριστικά από τη ροή.');
  };
  const save=async e=>{e.preventDefault();if(!busy)await persist(sources);};
  const sync=async()=>{
    if(busy||loading||data?.syncing)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await read('/api/admin/newsfeed/refresh',{method:'POST'});
      setData(response);setNotice('Ο συγχρονισμός ξεκίνησε στο παρασκήνιο του server. Η σελίδα παραμένει διαθέσιμη.');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  const removeArticle=async(item)=>{
    if(busy||loading)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await read('/api/admin/newsfeed/articles',{method:'DELETE',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({url:item.url})});
      setData(response);setNotice('Το άρθρο αφαιρέθηκε. Δεν θα ξαναεισαχθεί αυτόματα.');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  const restoreHidden=async()=>{
    if(busy||loading)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await read('/api/admin/newsfeed/hidden/restore',{method:'POST'});
      setData(response);setNotice('Ο αποκλεισμός άρθρων καθαρίστηκε. Μπορούν να εισαχθούν ξανά στον επόμενο συγχρονισμό.');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  const matches=(data?.articles||[]).filter(item=>{
    const q=articleSearch.trim().toLocaleLowerCase('el-GR');
    return !q||[item.title,item.source,item.category].some(value=>String(value||'').toLocaleLowerCase('el-GR').includes(q));
  });
  return <div className="admin-legacy-page space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#ccff00]">iRadios GR / Newsroom</p>
        <h1 className="mt-2 flex items-center gap-3 text-3xl font-black text-white"><Newspaper size={29} className="text-[#ccff00]"/> Publishers & Newsfeed</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">Πρόσθεσε απευθείας RSS/XML από ειδησεογραφικά sites (π.χ. Newsbeast), μαζί με επιλογές rssnews.io, Google News και RSS.app. Τίτλοι, κατηγορίες, εικόνες και ημερομηνίες αναγνωρίζονται αυτόματα. Χωρίς XML mapping ή ξεχωριστές καμπάνιες. Τα άρθρα μπαίνουν με βάση τη δημοσίευση, με όνομα πηγής και αυτόματη απομάκρυνση διπλών εγγραφών.</p>
      </div>
      <a href="/newsfeed" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-bold text-white hover:border-[#ccff00]">Δες το Newsfeed <ExternalLink size={16}/></a>
    </header>
    {error&&<p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertTriangle size={17} className="shrink-0"/>{error}</p>}
    {notice&&<p role="status" className="flex items-center gap-2 rounded-xl border border-[#ccff00]/30 bg-[#ccff00]/10 p-4 text-sm text-[#ccff00]"><CheckCircle2 size={17} className="shrink-0"/>{notice}</p>}
    <section className="ir-glass space-y-4 p-5 sm:p-7">
      <div><h2 className="text-lg font-black text-white">Πρόσθεσε publishers</h2>
        <p className="mt-1 text-xs leading-6 text-zinc-400">Δέχεται πραγματικά RSS/XML links οποιουδήποτε δημόσιου εκδότη, όπως https://www.newsbeast.gr/feed ή /greece/feed, καθώς και Google News, RSS.app ή «Η ροή μου» rssnews.io — ένα link ανά γραμμή. Οι κατηγορίες και οι φωτογραφίες διαβάζονται από το ίδιο το RSS και, όπου λείπει εικόνα, από το Open Graph του άρθρου.</p></div>
      <textarea value={newLinks} onChange={e=>setNewLinks(e.target.value)} rows={3} disabled={busy||loading}
        placeholder={EXAMPLE} className={field+' resize-y'} aria-label="Νέα RSS XML links εκδοτών, rssnews.io, Google News ή RSS.app"/>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy||loading} onClick={add}
          className="inline-flex items-center gap-2 rounded-xl border border-[#ccff00]/40 px-5 py-3 text-sm font-bold text-[#ccff00] hover:bg-[#ccff00]/10 disabled:opacity-40">
          <Plus size={17}/> Προσθήκη publishers
        </button>
        <span className="text-xs text-zinc-500">{sources.length}/{MAX_SOURCES} πηγές</span>
      </div>
    </section>
    <form onSubmit={save} className="ir-glass space-y-5 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-white">Οι πηγές σου</h2>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} className="size-4 accent-[#ccff00]"/> Newsfeed ενεργό</label>
      </div>
      <div className="space-y-3">
        {!sources.length&&<p className="rounded-xl border border-dashed border-white/20 p-5 text-sm text-zinc-400">Δεν υπάρχουν ενεργές πηγές. Πρόσθεσε μία παραπάνω για να ξεκινήσει η ροή.</p>}
        {sources.map((source,index)=><div key={source.id||index} className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-black text-white">{isGoogle(source.url)||isRssnews(source.url)?<Globe2 className="text-[#ccff00]" size={16}/>:<Link2 className="text-[#ccff00]" size={16}/>} {sourceName(source)}</p>
              <p className="mt-1 text-xs text-zinc-500">{isDirect(source.url)?'Direct RSS/XML':isRssnews(source.url)?'RSS εκδοτών / κατηγορίες rssnews.io':isGoogle(source.url)?'Google News':'RSS.app'} · {source.fetchedCount||0} άρθρα · {fmt(source.lastSyncedAt)}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={source.enabled!==false} onChange={e=>update(index,{enabled:e.target.checked})} className="accent-[#ccff00]"/> Ενεργό</label>
              <button type="button" aria-label={'Αφαίρεση πηγής '+(index+1)} disabled={busy||loading}
                onClick={()=>remove(index)} className="rounded-lg border border-white/10 p-2.5 text-rose-300 hover:border-rose-400/50 disabled:opacity-30"><Trash2 size={16}/></button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="min-w-0 md:col-span-2"><span className="mb-1 block text-xs font-semibold text-zinc-400">Link πηγής</span>
              <input required type="url" value={source.url} onChange={e=>update(index,{url:e.target.value})} className={field}/></label>
            <label><span className="mb-1 block text-xs font-semibold text-zinc-400">Όνομα (προαιρετικό)</span>
              <input value={source.label||''} maxLength={80} onChange={e=>update(index,{label:e.target.value})} className={field} placeholder="π.χ. Ειδησεογραφικό Μέσο"/></label>
            {isDirect(source.url)&&<label><span className="mb-1 block text-xs font-semibold text-zinc-400">Κατηγορία άρθρων</span>
              <input value={source.category||''} maxLength={50} onChange={e=>update(index,{category:e.target.value})} className={field} placeholder="Αυτόματη αναγνώριση από RSS"/></label>}
            {isGoogle(source.url)&&<label><span className="mb-1 block text-xs font-semibold text-zinc-400">Publisher domain (προαιρετικό fallback)</span>
              <input value={source.domain||''} onChange={e=>update(index,{domain:e.target.value})}
                className={field} placeholder="π.χ. iefimerida.gr"/></label>}
          </div>
          {isRssnews(source.url)&&<div className="mt-3 space-y-2"><div className="flex flex-wrap gap-1.5">{rssCategories(source.url).map(category=><span key={category} className="rounded-full border border-[#ccff00]/20 bg-[#ccff00]/[.05] px-2.5 py-1 text-[11px] font-bold text-[#ccff00]">{category}</span>)}</div><p className="text-xs leading-5 text-zinc-500">Το link αποθηκεύει τις κατηγορίες και, εφόσον έχει s=, τους συγκεκριμένους εκδότες. Επειδή δεν είναι XML/API, αναζητούνται τα δημόσια RSS των επιλεγμένων μέσων. Η ακριβής λίστα του rssnews.io μπορεί να διαφέρει. Οι φωτογραφίες προέρχονται από RSS ή Open Graph.</p></div>}
          {isRssnews(source.url)&&selectedPublishers(source.url).length>0&&
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              <span className="font-black text-[#ccff00]">{selectedPublishers(source.url).length} επιλεγμένοι εκδότες:</span>{' '}
              {selectedPublishers(source.url).join(' · ')}
              <span className="mt-1 block text-zinc-500">Οι εκδότες με διαθέσιμο δημόσιο RSS επιστρέφουν άρθρα. Οι υπόλοιποι εμφανίζονται στην αναλυτική κατάσταση.</span>
            </p>}
          {source.publisherReports?.length>0&&<details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
            <summary className="cursor-pointer font-bold text-[#ccff00]">Κατάσταση {source.publisherReports.length} εκδοτών · {source.publisherReports.filter(r=>r.status==='ok').length} διαθέσιμοι</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{source.publisherReports.map(report=><div key={report.domain} className="min-w-0 rounded-lg border border-white/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2"><strong className="truncate text-white">{report.domain}</strong><span className={report.status==='ok'?'text-[#ccff00]':'text-amber-300'}>{report.status==='ok'?report.count+' άρθρα':'Μη διαθέσιμο'}</span></div>
              {report.error&&<p title={report.error} className="mt-1 line-clamp-2 text-zinc-500">{report.error}</p>}
            </div>)}</div>
          </details>}
          {source.retrievalMode==='domain-search'&&<p className="mt-3 text-xs leading-5 text-amber-200">Εναλλακτική λειτουργία: Google News αναζήτηση με το domain του εκδότη, επειδή δεν ήταν διαθέσιμο publisher RSS. Τα αποτελέσματα μπορεί να μην ταυτίζονται απόλυτα με τη σελίδα του publisher.</p>}
          {source.lastError&&<p className={'mt-3 rounded-xl border p-3 text-xs '+(source.fetchedCount>0?'border-amber-400/20 bg-amber-500/10 text-amber-200':'border-rose-400/20 bg-rose-500/10 text-rose-200')}>{source.fetchedCount>0?'Μερικές πηγές δεν απάντησαν: ':'Αποτυχία εισαγωγής: '}{source.lastError}</p>}
        </div>)}
      </div>
      <div className="flex flex-wrap gap-3">
        <button disabled={busy||loading} type="submit" className="ir-action-primary px-5"><Save size={17}/> Αποθήκευση πηγών</button>
        <button disabled={busy||loading||data?.syncing||!sources.some(s=>s.enabled)} type="button" onClick={sync}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-5 text-sm font-bold text-white hover:border-[#ccff00] disabled:opacity-50">
          <RefreshCw size={16} className={data?.syncing?'animate-spin':''}/> {data?.syncing?'Συγχρονισμός σε εξέλιξη':'Συγχρονισμός τώρα'}
        </button>
      </div>
      <p className="text-xs leading-5 text-[#ccff00]">Οι προσθήκες και διαγραφές πηγών αποθηκεύονται αμέσως. Η επεξεργασία ονόματος, URL και κατηγορίας αποθηκεύεται με «Αποθήκευση πηγών».</p>
      <p className="text-xs leading-5 text-zinc-500">Ο συγχρονισμός γίνεται server-side με κοινή cache. Τα απευθείας feeds επιτρέπονται από δημόσια HTTPS domains, με έλεγχο DNS, χωρίς εσωτερικές διευθύνσεις ή redirects. Τα rssnews.io, Google News και RSS.app παραμένουν συμβατά. Τα απευθείας RSS εκδοτών επιλέγονται από ασφαλή λίστα και όπου δεν υπάρχει φωτογραφία εξετάζεται το Open Graph του άρθρου. Τα Google News feeds από μόνα τους συχνά δεν δίνουν φωτογραφία. Πριν τη δημόσια χρήση Google News περιεχομένου επιβεβαίωσε τους όρους και τα δικαιώματα προβολής.</p>
    </form>
    {data&&<section className="ir-glass p-5 sm:p-7">
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Άρθρα / όριο 500</p><strong className="mt-2 block text-2xl text-white">{data.articles?.length||0} / 500</strong></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Πηγές</p><strong className="mt-2 block text-2xl text-white">{data.sources?.length||0}</strong></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Συγχρονίστηκε</p><strong className="mt-2 flex items-center gap-2 text-sm text-white"><Clock3 size={16}/>{fmt(data.lastSyncedAt)}</strong></div>
        <div className="rounded-xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-400">Ανανέωση</p><strong className="mt-2 block text-lg text-[#ccff00]">Κάθε 10 λεπτά</strong></div>
      </div>
      {data.lastError&&<p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">{data.lastError}</p>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black text-white">Διαχείριση άρθρων</h2>
        {data.hiddenArticleCount>0&&<button type="button" disabled={busy} onClick={restoreHidden} className="rounded-xl border border-white/20 px-3 py-2 text-xs text-zinc-300 hover:text-white">Επαναφορά {data.hiddenArticleCount} κρυμμένων</button>}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3"><input type="search" value={articleSearch} onChange={e=>{setArticleSearch(e.target.value);setArticleLimit(30);}} placeholder="Αναζήτηση τίτλου, πηγής ή κατηγορίας" aria-label="Αναζήτηση άρθρων" className={field+' max-w-lg'}/><span className="text-xs text-zinc-400">{matches.length} αποτελέσματα</span></div>
      <div className="grid gap-3 md:grid-cols-2">
        {matches.slice(0,articleLimit).map(item=><div key={item.url} className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 hover:border-[#ccff00]/40">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 gap-3">
          {item.imageUrl?<img src={item.imageUrl} alt="" loading="lazy" className="h-20 w-24 shrink-0 rounded-xl object-cover"/>:
            <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-zinc-900"><ImageIcon className="text-zinc-600"/></div>}
          <div className="min-w-0"><p className="line-clamp-2 text-sm font-bold text-white">{item.title}</p>
            <p className="mt-2 text-xs text-zinc-400">{item.source||'Ειδήσεις'} · {fmt(item.publishedAt)}</p></div></a>
          <button type="button" disabled={busy} onClick={()=>removeArticle(item)} title="Διαγραφή άρθρου" aria-label={'Διαγραφή '+item.title} className="shrink-0 rounded-xl border border-rose-500/20 p-2.5 text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"><Trash2 size={16}/></button>
        </div>)}
        {!data.articles?.length&&<p className="text-sm text-zinc-400">Δεν υπάρχουν άρθρα ακόμη. Πρόσθεσε μία πηγή και πάτησε «Συγχρονισμός τώρα».</p>}
      </div>
      {matches.length>articleLimit&&<button type="button" onClick={()=>setArticleLimit(value=>value+30)} className="mt-5 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold text-white hover:border-[#ccff00]">Περισσότερα άρθρα ({matches.length-articleLimit})</button>}
    </section>}
  </div>;
}
