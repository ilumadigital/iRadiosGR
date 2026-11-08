import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Helmet} from 'react-helmet-async';
import {Link,useLocation,useParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,Bookmark,BookmarkCheck,CalendarDays,Check,ChevronRight,Copy,ExternalLink,Newspaper,RefreshCw,Share2} from 'lucide-react';

const validBack=path=>path==='/'?'/':typeof path==='string'&&/^\/newsfeed(?:\?.*)?$/.test(path)?path:'/newsfeed';
const formatDate=value=>{
  const date=new Date(value);
  return value&&Number.isFinite(date.getTime())?
    new Intl.DateTimeFormat('el-GR',{dateStyle:'full',timeStyle:'short'}).format(date):'Χωρίς ημερομηνία';
};
function ArticleCover({item}){
  const [broken,setBroken]=useState(false);
  useEffect(()=>setBroken(false),[item?.imageUrl]);
  return <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[18px] border border-white/10 bg-[#192024] sm:aspect-[16/9] sm:rounded-[26px]">
    {item.imageUrl&&!broken?
      <img src={item.imageUrl} alt={item.title||'Εικόνα άρθρου'} onError={()=>setBroken(true)}
        className="h-full w-full object-cover" loading="eager"/>:
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#253136] via-[#151e22] to-[#0c1114]">
        <Newspaper size={54} className="text-[#ccff00]/50"/>
        <span className="max-w-[90%] truncate text-xs font-bold uppercase tracking-[.16em] text-zinc-400">{item.source||'iRadios News'}</span>
      </div>}
  </div>;
}
function RelatedCard({item}){
  const [broken,setBroken]=useState(false);
  return <Link to={'/newsfeed/'+item.key}
    className="group flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-[#131b20] p-3 transition-colors hover:border-[#ccff00]/40 sm:p-4">
    <div className="aspect-square w-20 shrink-0 overflow-hidden rounded-xl bg-[#1b242a] sm:w-28">
      {item.imageUrl&&!broken?<img src={item.imageUrl} alt="" loading="lazy" onError={()=>setBroken(true)}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/>:
        <div className="flex h-full items-center justify-center"><Newspaper size={24} className="text-[#ccff00]/40"/></div>}
    </div>
    <div className="min-w-0 flex-1">
      <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#ccff00]">{item.category||item.source||'News'}</span>
      <h3 className="mt-1 line-clamp-3 text-sm font-bold leading-snug text-white transition-colors group-hover:text-[#ccff00] sm:text-base">{item.title}</h3>
      <p className="mt-2 truncate text-[11px] text-zinc-500">{item.source||'Ειδήσεις'}</p>
    </div>
  </Link>;
}

export default function NewsArticle(){
  const {key}=useParams(),location=useLocation();
  const [article,setArticle]=useState(null),[related,setRelated]=useState([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const [saved,setSaved]=useState(false),[notice,setNotice]=useState('');
  const backTo=validBack(location.state?.backTo);
  const fetchArticle=useCallback(async signal=>{
    if(!/^[0-9a-f]{24}$/i.test(key||'')){
      setError('Μη έγκυρος σύνδεσμος άρθρου.');setLoading(false);return;
    }
    const response=await fetch('/api/newsfeed/articles/'+key,{signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Το άρθρο δεν είναι διαθέσιμο.');
    setArticle(data.article||null);setRelated(Array.isArray(data.related)?data.related:[]);
    setError('');
  },[key]);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');setArticle(null);setRelated([]);setNotice('');
    fetchArticle(controller.signal).catch(e=>{
      if(!controller.signal.aborted)setError(e.message||'Το άρθρο δεν είναι διαθέσιμο.');
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[fetchArticle]);
  useEffect(()=>{
    if(!article?.key)return;
    try{
      const list=JSON.parse(localStorage.getItem('iradios_news_saved')||'[]');
      setSaved(Array.isArray(list)&&list.includes(article.key));
    }catch{setSaved(false);}
  },[article?.key]);
  const preview=useMemo(()=>{
    if(!article)return [];
    const rows=(Array.isArray(article.previewParagraphs)?article.previewParagraphs:[])
      .filter(row=>typeof row==='string'&&row.trim()).slice(0,4);
    return rows.length?rows:(article.summary?[article.summary]:[]);
  },[article]);
  const onSave=()=>{
    if(!article)return;
    try{
      const old=JSON.parse(localStorage.getItem('iradios_news_saved')||'[]');
      const list=new Set(Array.isArray(old)?old:[]);
      const next=!list.has(article.key);
      if(next)list.add(article.key);else list.delete(article.key);
      localStorage.setItem('iradios_news_saved',JSON.stringify([...list].slice(-200)));
      setSaved(next);setNotice(next?'Το άρθρο αποθηκεύτηκε σε αυτή τη συσκευή.':'Το άρθρο αφαιρέθηκε από τα αποθηκευμένα.');
    }catch{setNotice('Η αποθήκευση δεν είναι διαθέσιμη σε αυτή τη συσκευή.');}
  };
  const onShare=async()=>{
    if(!article)return;
    const url=new URL('/newsfeed/'+article.key,window.location.origin).href;
    try{
      if(navigator.share){
        await navigator.share({title:article.title,url});return;
      }
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(url);
        setNotice('Ο σύνδεσμος της προεπισκόπησης αντιγράφηκε.');return;
      }
      setNotice('Η αυτόματη κοινοποίηση δεν υποστηρίζεται σε αυτό το πρόγραμμα περιήγησης.');
    }catch(e){
      if(e?.name!=='AbortError')setNotice('Δεν ήταν δυνατή η κοινοποίηση του άρθρου.');
    }
  };
  return <main className="ir-catalog-page min-w-0 animate-fade-in px-4 pb-44 pt-5 text-white sm:px-6 md:px-8 md:pt-8">
    <div className="mx-auto w-full max-w-[920px]">
      <nav aria-label="Διαδρομή άρθρου" className="mb-7 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 text-xs font-semibold text-zinc-500">
        <Link to={backTo} className="mr-3 inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-3 text-zinc-200 hover:border-[#ccff00]/50 hover:text-[#ccff00]">
          <ArrowLeft size={14}/> Πίσω
        </Link>
        <Link to="/" className="hover:text-white">Αρχική</Link><ChevronRight size={12}/>
        <Link to="/newsfeed" className="hover:text-white">Ειδήσεις</Link>
        {article?.category&&<><ChevronRight size={12}/><Link to={'/newsfeed?category='+encodeURIComponent(article.category)}
          className="font-bold text-[#ccff00] hover:text-white">{article.category}</Link></>}
      </nav>
      {loading&&<div role="status" className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/[.025] text-zinc-400">
        <RefreshCw className="animate-spin text-[#ccff00]" size={26}/> Φόρτωση άρθρου…
      </div>}
      {!loading&&error&&<div role="alert" className="rounded-2xl border border-white/10 bg-[#12191d] p-8 text-center sm:p-12">
        <Newspaper size={38} className="mx-auto text-[#ccff00]/60"/>
        <h1 className="mt-4 text-xl font-black text-white">Η προεπισκόπηση δεν βρέθηκε</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{error}</p>
        <Link to="/newsfeed" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ccff00] px-5 font-black text-black">
          <ArrowLeft size={16}/> Επιστροφή στις ειδήσεις
        </Link>
      </div>}
      {!loading&&article&&<>
        <Helmet>
          <title>{article.title} | iRadios GR News</title>
          <meta name="description" content={(article.summary||article.title).slice(0,155)}/>
          <link rel="canonical" href={window.location.origin+'/newsfeed/'+article.key}/>
          <meta property="og:type" content="article"/>
          <meta property="og:title" content={article.title}/>
          <meta property="og:description" content={(article.summary||'Διάβασε την προεπισκόπηση στο iRadios News.').slice(0,155)}/>
          <meta property="og:url" content={window.location.origin+'/newsfeed/'+article.key}/>
          {article.imageUrl&&<meta property="og:image" content={article.imageUrl}/>}
        </Helmet>
        <header className="mb-6 sm:mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {article.category&&<Link to={'/newsfeed?category='+encodeURIComponent(article.category)}
              className="rounded-full border border-[#ccff00]/25 bg-[#ccff00]/10 px-3 py-1.5 text-[11px] font-black text-[#ccff00] hover:border-[#ccff00]">{article.category}</Link>}
            <span className="text-[11px] font-black uppercase tracking-[.18em] text-zinc-500">iRadios / News</span>
          </div>
          <h1 className="max-w-[860px] text-[27px] font-black leading-[1.14] tracking-[-.025em] text-white sm:text-[38px] md:text-[44px]">{article.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-zinc-400 sm:text-sm">
            <span>από <strong className="font-bold text-zinc-200">{article.source||'Ειδησεογραφική πηγή'}</strong></span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14}/>{formatDate(article.publishedAt)}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={onSave}
              className={'inline-flex min-h-10 items-center gap-2 rounded-lg border px-3.5 text-xs font-black transition-colors '+
              (saved?'border-[#ccff00]/60 bg-[#ccff00]/10 text-[#ccff00]':'border-white/15 text-zinc-200 hover:border-white/40')}>
              {saved?<BookmarkCheck size={15}/>:<Bookmark size={15}/>}
              {saved?'Αποθηκευμένο':'Αποθήκευση'}
            </button>
            <button type="button" onClick={onShare}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3.5 text-xs font-black text-zinc-200 transition-colors hover:border-white/40">
              <Share2 size={15}/> Κοινοποίηση
            </button>
            <a href={article.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3.5 text-xs font-black text-zinc-200 transition-colors hover:border-[#ccff00]/40 hover:text-[#ccff00]">
              <ExternalLink size={15}/> Άνοιγμα στην πηγή
            </a>
          </div>
          {notice&&<p role="status" className="mt-3 inline-flex items-center gap-2 text-xs text-[#ccff00]">
            <Check size={14}/>{notice}
          </p>}
        </header>
        <ArticleCover item={article}/>
        <section aria-label="Προεπισκόπηση RSS" className="mx-auto mt-7 max-w-[850px] sm:mt-9">
          <p className="mb-4 text-[11px] font-black uppercase tracking-[.14em] text-[#ccff00]">Προεπισκόπηση από το RSS</p>
          {preview.length?preview.map((paragraph,i)=><p key={i}
            className={'mb-5 leading-[1.85] '+(i===0?'text-[16px] font-semibold text-zinc-100 sm:text-lg':'text-[15px] text-zinc-300 sm:text-base')}>
            {paragraph}
          </p>):<p className="text-sm leading-7 text-zinc-400">
            Ο εκδότης δεν παρέχει περιγραφή ή κείμενο προεπισκόπησης στο RSS για αυτό το άρθρο.
          </p>}
          <p className="mt-4 border-l-2 border-[#ccff00]/50 pl-4 text-xs leading-6 text-zinc-500">
            Το iRadios εμφανίζει τη σύντομη προεπισκόπηση του RSS. Το πλήρες άρθρο και τυχόν επιπλέον φωτογραφίες ή βίντεο βρίσκονται στην ιστοσελίδα του εκδότη.
          </p>
          <a href={article.url} target="_blank" rel="noopener noreferrer"
            className="mt-7 inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-xl bg-[#e8eef2] px-5 py-3 text-center text-sm font-black text-[#10151a] transition-colors hover:bg-[#ccff00]">
            Διάβασε ολόκληρο το άρθρο στην πηγή <ExternalLink size={16} className="shrink-0"/>
          </a>
          <p className="mt-3 text-xs text-zinc-500">Πηγή: {article.source||'Ειδήσεις'}</p>
        </section>
        <section className="mt-12 border-t border-white/10 pt-8 sm:mt-14" aria-label="Σχετικά άρθρα">
          {article.category&&<Link to={'/newsfeed?category='+encodeURIComponent(article.category)}
            className="inline-flex items-center gap-2 text-sm font-black text-[#ccff00] hover:text-white">
            Περισσότερα από {article.category}<ArrowRight size={16}/>
          </Link>}
          {related.length>0&&<>
            <h2 className="mt-7 text-lg font-black text-white sm:text-xl">Περισσότερα άρθρα που ίσως σε ενδιαφέρουν</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map(item=><RelatedCard key={item.key} item={item}/>)}
            </div>
          </>}
          <Link to={backTo} className="mt-9 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-xs font-black text-zinc-200 hover:border-[#ccff00]/50 hover:text-white">
            <ArrowLeft size={15}/> Επιστροφή στο Newsfeed
          </Link>
        </section>
      </>}
    </div>
  </main>;
}
