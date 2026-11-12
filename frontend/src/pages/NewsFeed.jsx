import DynamicAdCreative from '../components/DynamicAdCreative';
import {geoAllowsAd} from '../utils/adPlacements';
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Helmet} from 'react-helmet-async';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {Newspaper,LayoutGrid,List,ExternalLink,RefreshCw,Clock3,Megaphone} from 'lucide-react';
import EditorialPlacement from '../components/EditorialPlacement';

export function newsAge(value,now=Date.now()){
  const date=new Date(value);
  if(!value||!Number.isFinite(date.getTime()))return null;
  const age=Math.max(0,now-date.getTime());
  const units=[['year',31536000000],['month',2592000000],['week',604800000],['day',86400000],['hour',3600000],['minute',60000],['second',1000]];
  const [unit,ms]=units.find(([,duration])=>age>=duration)||units[units.length-1];
  const number=Math.max(1,Math.floor(age/ms));
  return {relative:new Intl.RelativeTimeFormat('el-GR',{numeric:'always'}).format(-number,unit),
    absolute:new Intl.DateTimeFormat(undefined,{dateStyle:'long',timeStyle:'short'}).format(date),iso:date.toISOString()};
}
export function Article({item,view,now,source,backTo}){
  const [broken,setBroken]=useState(false),time=newsAge(item.publishedAt,now);
  const href='/newsfeed/'+item.key;
  // The entire article tile is one internal navigation target, including the
  // image and whitespace. External publisher links exist only in single view.
  return <Link to={href} state={{backTo}} aria-label={'Προεπισκόπηση: '+item.title}
    className={'group min-w-0 overflow-hidden rounded-[24px] border border-white/10 bg-[#12171b] shadow-[0_16px_32px_rgba(0,0,0,.16)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#ccff00]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ccff00] '+(view==='list'?'flex flex-col sm:flex-row':'flex h-full flex-col')}>
    <div className={'relative block shrink-0 overflow-hidden bg-[#202628] '+(view==='list'?'aspect-[16/9] sm:aspect-auto sm:w-[235px] lg:w-[290px]':'aspect-[16/10]')}>
      {item.imageUrl&&!broken?<img src={item.imageUrl} alt="" loading="lazy" onError={()=>setBroken(true)} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"/>:
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1d292b] to-[#0a1213] px-4 text-center">
          <Newspaper size={42} className="text-[#ccff00]/45"/>
          <span className="max-w-full truncate text-[10px] font-black uppercase tracking-[.15em] text-zinc-400">{item.source||source||'News'}</span>
        </div>}
      <span className="absolute bottom-3 left-3 max-w-[90%] truncate rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#ccff00] backdrop-blur">{item.source||source||'Ειδήσεις'}</span>
    </div>
    <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-zinc-400">
        <Clock3 size={13} className="shrink-0 text-[#ccff00]"/>
        {time?<time dateTime={time.iso} title={time.absolute}>{time.relative}</time>:<span>Χωρίς ημερομηνία</span>}
        <span className="text-white/25">•</span><span className="max-w-[160px] truncate">{item.source||source||'iRadios'}</span>
        {item.category&&<span className="rounded-full border border-[#ccff00]/20 px-2 py-0.5 text-[10px] text-[#ccff00]">{item.category}</span>}
      </div>
      <h2 className={'line-clamp-3 font-black leading-snug tracking-tight text-white transition-colors group-hover:text-[#ccff00] '+(view==='list'?'text-lg sm:text-xl':'text-base sm:text-lg')}>
        {item.title}
      </h2>
      {item.summary&&<p className="mt-3 line-clamp-3 text-xs leading-6 text-zinc-400 sm:text-sm">{item.summary}</p>}
      <span className="mt-auto inline-flex w-fit items-center gap-1.5 pt-5 text-xs font-black text-[#ccff00] group-hover:text-white">Δες την προεπισκόπηση <ExternalLink size={14}/></span>
    </div>
  </Link>;
}
function AdUnit({banner,wide=false,view='grid',slotKey=''}) {
  return <DynamicAdCreative banner={banner} placement="news_feed"
    variant={wide?'strip':view==='list'?'list':'card'} slotKey={slotKey}/>;
}
export default function NewsFeed({stations=[],currentUser,userLocation,checkGeoMatch,currentStation,isPlaying,onPlayStation,onPlayPause}){
  const location=useLocation();
  const [searchParams,setSearchParams]=useSearchParams();
  const view=searchParams.get('view')==='list'?'list':'grid';
  const selectedCategory=searchParams.get('category')||'all';
  const setView=next=>setSearchParams(current=>{
    const params=new URLSearchParams(current);
    if(next==='list')params.set('view','list');else params.delete('view');
    return params;
  },{replace:true});
  const setSelectedCategory=next=>setSearchParams(current=>{
    const params=new URLSearchParams(current);
    if(next==='all')params.delete('category');else params.set('category',next);
    return params;
  },{replace:true});
  const [items,setItems]=useState([]),[source,setSource]=useState('');
  const [categories,setCategories]=useState([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[now,setNow]=useState(Date.now()),[banners,setBanners]=useState([]);
  const premium=Boolean(currentUser&&(currentUser.role==='admin'||currentUser.role==='agency'||currentUser.isPremium===true||currentUser.broadcasterProfile?.tier==='premium'));
  const refresh=useCallback(async signal=>{
    const r=await fetch('/api/newsfeed',{signal});if(!r.ok)throw Error('Δεν είναι διαθέσιμες οι ειδήσεις αυτή τη στιγμή.');
    const data=await r.json();setItems(Array.isArray(data.articles)?data.articles:[]);
    setCategories(Array.isArray(data.categories)?data.categories.filter(c=>typeof c==='string'&&c.trim()):[]);
    setSource(data.feedTitle||'');setError('');
  },[]);
  useEffect(()=>{
    const controller=new AbortController();let live=true;
    refresh(controller.signal).catch(e=>{if(live&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(live)setLoading(false);});
    // The backend imports at ten-minute intervals. Revalidate this lightweight
    // shared cache while the page is open and immediately on returning to the tab.
    const poll=()=>{if(!document.hidden)refresh(controller.signal).catch(()=>{});};
    const interval=setInterval(poll,120000);
    const onVisibility=()=>{if(!document.hidden)poll();};
    document.addEventListener('visibilitychange',onVisibility);
    const clock=setInterval(()=>setNow(Date.now()),30000);
    return()=>{
      live=false;controller.abort();clearInterval(interval);clearInterval(clock);
      document.removeEventListener('visibilitychange',onVisibility);
    };
  },[refresh]);
  useEffect(()=>{
    if(premium)return;
    const controller=new AbortController();
    fetch('/api/banners/active',{signal:controller.signal}).then(r=>r.ok?r.json():[])
      .then(data=>{if(!controller.signal.aborted)setBanners((Array.isArray(data)?data:[]).filter(b=>
        b.status==='active'&&Array.isArray(b.placement)&&b.placement.includes('news_feed')&&
        (!b.expiresAt||new Date(b.expiresAt)>new Date())&&
        geoAllowsAd(b.targetLocations,userLocation,checkGeoMatch)));}).catch(()=>{});
    return()=>controller.abort();
  },[premium,userLocation,checkGeoMatch]);
  const ordered=useMemo(()=>[...items].sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0)),[items]);
  const categoryOptions=useMemo(()=>{
    const all=new Set(categories);
    ordered.forEach(item=>{if(item.category)all.add(item.category);});
    return [...all];
  },[categories,ordered]);
  useEffect(()=>{
    if(!loading&&selectedCategory!=='all'&&!categoryOptions.includes(selectedCategory))
      setSelectedCategory('all');
  },[selectedCategory,categoryOptions,loading]);
  const categoryCounts=useMemo(()=>{
    const counts={};
    for(const item of ordered)if(item.category)counts[item.category]=(counts[item.category]||0)+1;
    return counts;
  },[ordered]);
  const filtered=useMemo(()=>selectedCategory==='all'?ordered:ordered.filter(item=>item.category===selectedCategory),
    [ordered,selectedCategory]);
  return <div className="ir-catalog-page min-w-0 animate-fade-in px-4 pb-40 pt-6 md:px-8 md:pt-9">
    <Helmet><title>Ειδήσεις τώρα | iRadios GR</title><meta name="description" content="Τελευταίες ειδήσεις και νέα από το Newsfeed του iRadios GR, με φωτογραφίες και συνεχή ενημέρωση."/></Helmet>
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-[11px] font-black uppercase tracking-[.2em] text-[#ccff00]">iRadios GR / News</p>
        <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white md:text-5xl"><Newspaper size={35} className="text-[#ccff00]"/> Ειδήσεις</h1>
        <p className="mt-2 text-xs font-semibold text-zinc-500 md:text-sm">{ordered.length?ordered.length+' πρόσφατα άρθρα':'Οι τελευταίες ειδήσεις'} {source?'· '+source:''} · Ανανέωση κάθε 10′</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Ανανέωση ειδήσεων" onClick={()=>{setLoading(true);refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));}} className="rounded-xl border border-white/10 bg-zinc-900 p-2.5 text-zinc-400 hover:text-[#ccff00]"><RefreshCw size={17} className={loading?'animate-spin':''}/></button>
        <div className="flex items-center rounded-xl border border-white/10 bg-zinc-900 p-1" role="group" aria-label="Προβολή ειδήσεων">
          <button type="button" aria-label="Πλέγμα" aria-pressed={view==='grid'} onClick={()=>setView('grid')} className={'rounded-lg p-1.5 '+(view==='grid'?'bg-[#ccff00] text-black':'text-zinc-500 hover:text-white')}><LayoutGrid size={16}/></button>
          <button type="button" aria-label="Λίστα" aria-pressed={view==='list'} onClick={()=>setView('list')} className={'rounded-lg p-1.5 '+(view==='list'?'bg-[#ccff00] text-black':'text-zinc-500 hover:text-white')}><List size={16}/></button>
        </div>
      </div>
    </header>
    <EditorialPlacement placement="news" value="" viewMode={view} currentUser={currentUser} stations={stations}
      currentStation={currentStation} isPlaying={isPlaying} onPlayStation={onPlayStation} onPlayPause={onPlayPause}/>
    <section aria-label="Φίλτρα κατηγοριών ειδήσεων" className="mb-6 min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black text-white sm:text-base">Κατηγορίες ειδήσεων</h2>
        <span className="text-xs font-semibold text-zinc-500">{filtered.length} {filtered.length===1?'άρθρο':'άρθρα'}</span>
      </div>
      <div className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        role="group" aria-label="Επιλογή κατηγορίας">
        {[{name:'all',label:'Όλα',count:ordered.length},
          ...categoryOptions.map(name=>({name,label:name,count:categoryCounts[name]||0}))].map(option=>{
          const active=selectedCategory===option.name;
          return <button key={option.name} type="button" aria-pressed={active}
            onClick={()=>setSelectedCategory(option.name)}
            className={'inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-black transition-colors sm:text-sm '+
              (active?'border-[#ccff00] bg-[#ccff00] text-black':'border-white/15 bg-white/[.045] text-zinc-300 hover:border-[#ccff00]/50 hover:text-white')}>
            <span>{option.label}</span>
            <span className={'rounded-full px-2 py-0.5 text-[10px] tabular-nums '+(active?'bg-black/15 text-black':'bg-white/10 text-zinc-400')}>{option.count}</span>
          </button>;
        })}
      </div>
    </section>
    {error&&<div role="alert" className="mb-5 rounded-xl border border-red-400/25 bg-red-950/20 p-4 text-sm text-red-200">{error}</div>}
    {loading&&!ordered.length?<div className="rounded-2xl border border-white/10 p-12 text-center text-zinc-400"><RefreshCw size={24} className="mx-auto mb-3 animate-spin text-[#ccff00]"/>Φόρτωση ειδήσεων…</div>:
    !ordered.length?<div className="rounded-2xl border border-white/10 bg-white/[.025] p-12 text-center text-zinc-400"><Newspaper className="mx-auto mb-4 text-[#ccff00]" size={35}/>Δεν υπάρχουν διαθέσιμες ειδήσεις αυτή τη στιγμή.</div>:
    !filtered.length?<div className="rounded-2xl border border-white/10 bg-white/[.025] p-10 text-center text-zinc-400">
      <Newspaper className="mx-auto mb-3 text-[#ccff00]" size={30}/>
      Δεν υπάρχουν ακόμη ειδήσεις στην κατηγορία «{selectedCategory}».
      <button type="button" onClick={()=>setSelectedCategory('all')} className="mx-auto mt-4 block rounded-full border border-[#ccff00]/40 px-5 py-2 text-xs font-black text-[#ccff00]">Προβολή όλων</button>
    </div>:
    <section aria-label="Ροή ειδήσεων" className={view==='grid'?'grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 md:gap-5':'flex min-w-0 flex-col gap-4'}>
      {filtered.map((item,index)=><React.Fragment key={item.id||item.url}>
        {banners.length>0&&index>0&&index%12===0&&view==='grid'&&<div className="col-span-full py-4 md:py-8"><AdUnit wide slotKey={"news-wide-"+index} banner={banners[Math.floor(index/12)%banners.length]}/></div>}
        {banners.length>0&&index>0&&index%5===0&&<AdUnit banner={banners[Math.floor(index/5)%banners.length]} slotKey={"news-card-"+index} view={view}/>}
        <Article item={item} view={view} now={now} source={source} backTo={location.pathname+location.search}/>
      </React.Fragment>)}
    </section>}
  </div>;
}
