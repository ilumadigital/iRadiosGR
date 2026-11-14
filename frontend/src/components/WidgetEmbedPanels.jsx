import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {CalendarDays,ListMusic,Loader2,RefreshCw,X} from 'lucide-react';
import {getAthensClock} from '../utils/schedule';
import {widgetShowImageProxy} from '../utils/widgetShowArtwork';

const DAYS=['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'];
const fallback='/icon-tr.png';
const readToken=()=>{
  try{return window.localStorage.getItem('iluma_token')||'';}catch{return '';}
};
function ProgramPhoto({station,image}){
  const [state,setState]=useState({image:null,stage:'direct'});
  const proxy=widgetShowImageProxy(station,image);
  const stage=state.image===image?state.stage:'direct';
  const src=stage==='logo'||!image?station.logo||fallback:
    stage==='proxy'&&proxy?proxy:image;
  return <img src={src} alt="" referrerPolicy="no-referrer"
    className={`size-12 shrink-0 rounded-xl ${(stage==='logo'||!image)?'bg-white object-contain p-1':'object-cover'}`}
    onError={event=>{
      if(stage==='direct'&&proxy)setState({image,stage:'proxy'});
      else if(stage!=='logo'&&image)setState({image,stage:'logo'});
      else{event.currentTarget.onerror=null;event.currentTarget.src=fallback;}
    }}/>;
}
function ProgramRow({station,show,live}){
  return <div className={'ir-widget-drawer__row'+(live?' is-live':'')}>
    <ProgramPhoto station={station} image={show.imageUrl}/>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#caff00]">
        {live?'● ΤΩΡΑ LIVE':show.startTime+' – '+(show.endTime==='24:00'?'00:00':show.endTime)}
      </p>
      <p className="mt-1 font-black leading-tight text-white">{show.title}</p>
      {show.host&&<p className="mt-1 text-xs text-white/65">{show.host}</p>}
      {show.description&&<p className="mt-1 text-[11px] leading-relaxed text-white/55">{show.description}</p>}
    </div>
  </div>;
}
export default function WidgetEmbedPanels({station,shows=[],current,clock,playlist=false,compact=false}){
  const [panel,setPanel]=useState('');
  const [day,setDay]=useState(()=>getAthensClock().day);
  const [tracks,setTracks]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{setPanel('');setTracks([]);setError('');},[station?._id]);
  useEffect(()=>{
    if(!panel)return undefined;
    const onKey=event=>{if(event.key==='Escape')setPanel('');};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[panel]);
  useEffect(()=>{
    if(panel!=='playlist'||!station?._id)return undefined;
    let active=true,abort;
    const load=async()=>{
      abort?.abort();abort=new AbortController();
      setLoading(true);setError('');
      const id=encodeURIComponent(station._id),token=readToken();
      const read=async(url,headers)=>{
        const res=await fetch(url,{headers,cache:'no-store',signal:abort.signal});
        if(!res.ok)throw new Error('Unavailable');
        return res.json();
      };
      try{
        const [native,personal]=await Promise.allSettled([
          read('/api/catalog/widget-native/'+id+'/playlist'),
          token?read('/api/stations/'+id+'/playlist',{Authorization:'Bearer '+token}):Promise.resolve(null)
        ]);
        if(!active||abort.signal.aborted)return;
        const chosen=personal.status==='fulfilled'&&Array.isArray(personal.value?.tracks)?
          personal.value:native.status==='fulfilled'?native.value:null;
        if(!chosen){setTracks([]);setError('Το ιστορικό δεν είναι διαθέσιμο αυτή τη στιγμή.');}
        else setTracks((chosen.tracks||[]).filter(t=>t&&
          (!t.premiumOnly||typeof t.title==='string')).slice(0,30));
      }catch(err){
        if(active&&!abort.signal.aborted){setTracks([]);setError('Δεν ήταν δυνατή η φόρτωση της playlist.');}
      }finally{if(active&&!abort.signal.aborted)setLoading(false);}
    };
    void load();
    const timer=setInterval(()=>void load(),30000);
    return()=>{active=false;abort?.abort();clearInterval(timer);};
  },[panel,station?._id,refresh]);
  const open=kind=>{
    setDay(getAthensClock().day);
    setPanel(prev=>prev===kind?'':kind);
  };
  const today=clock?.day||getAthensClock().day;
  const visible=shows.filter(show=>Number(show.day)===day)
    .sort((a,b)=>a.startTime.localeCompare(b.startTime));
  const dateLabel=date=>new Date(date).toLocaleTimeString('el-GR',{
    timeZone:'Europe/Athens',hour:'2-digit',minute:'2-digit'
  });
  return <>
    <div className={'ir-embed__panel-buttons'+(compact?' is-compact':'')}>
      <button type="button" className="ir-embed__chip" onClick={()=>open('program')}
        aria-haspopup="dialog" aria-expanded={panel==='program'}>
        <CalendarDays size={14}/> Πρόγραμμα
      </button>
      {playlist&&<button type="button" className="ir-embed__chip"
        onClick={()=>open('playlist')} aria-haspopup="dialog" aria-expanded={panel==='playlist'}>
        <ListMusic size={14}/> Playlist
      </button>}
    </div>
    {panel&&createPortal(<section role="dialog" aria-modal="true" aria-label={panel==='program'?'Πρόγραμμα σταθμού':'Playlist σταθμού'}
      className="ir-widget-drawer" id="ir-widget-panel">
      <header className="ir-widget-drawer__header">
        <div className="min-w-0">
          <p className="ir-embed__eyebrow">{station.name}</p>
          <h2 className="mt-1 text-xl font-black">{panel==='program'?'Πρόγραμμα σταθμού':'Πρόσφατα τραγούδια'}</h2>
        </div>
        <div className="flex gap-2">
          {panel==='playlist'&&<button type="button" aria-label="Ανανέωση playlist"
            className="ir-widget-drawer__close" onClick={()=>setRefresh(n=>n+1)}>
            <RefreshCw size={18} className={loading?'animate-spin':''}/>
          </button>}
          <button type="button" aria-label="Κλείσιμο λίστας" className="ir-widget-drawer__close"
            onClick={()=>setPanel('')}><X size={20}/></button>
        </div>
      </header>
      {panel==='program'&&<div className="ir-widget-drawer__days">
        <label className="sr-only" htmlFor="ir-widget-day">Επιλογή ημέρας</label>
        <select id="ir-widget-day" value={day} onChange={e=>setDay(Number(e.target.value))}
          aria-label="Επιλογή ημέρας προγράμματος">
          {DAYS.map((name,index)=><option key={name} value={index+1}>
            {name}{today===index+1?' · Σήμερα':''}
          </option>)}
        </select>
      </div>}
      <div className="ir-widget-drawer__list">
        {panel==='program'&&(
          visible.length?visible.map((show,index)=><ProgramRow
            key={[show.day,show.startTime,show.title,index].join('-')}
            station={station} show={show}
            live={day===today&&Boolean(current)&&
              show.title===current.title&&show.startTime===current.startTime}/>)
          :<p className="p-4 text-sm text-white/70">Δεν υπάρχει πρόγραμμα για {DAYS[day-1]}.</p>
        )}
        {panel==='playlist'&&(
          loading&&!tracks.length?<div className="flex items-center gap-2 p-4 text-sm text-white/70">
            <Loader2 size={18} className="animate-spin"/> Φόρτωση τραγουδιών…
          </div>:error?<p role="status" className="p-4 text-sm text-amber-300">{error}</p>
          :tracks.length?tracks.map((track,index)=><div className="ir-widget-drawer__row" key={(track.raw||track.title||'')+track.playedAt+index}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-white">{track.premiumOnly?'Premium αναγνώριση':track.title}</p>
              <p className="truncate text-xs text-white/65">
                {track.premiumOnly?'Συνδέσου με Premium για λεπτομέρειες':track.artist}
              </p>
            </div>
            <time dateTime={track.playedAt} className="text-[11px] font-bold text-white/50">
              {dateLabel(track.playedAt)}
            </time>
          </div>):<p className="p-4 text-sm text-white/70">
            Δεν υπάρχουν ακόμη επιβεβαιωμένα τραγούδια στα τελευταία 30 λεπτά.
          </p>
        )}
      </div>
    </section>,document.body)}
  </>;
}
