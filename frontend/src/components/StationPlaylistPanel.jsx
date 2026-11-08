import React, { useEffect, useRef, useState } from 'react';
import { ListMusic, Radio, Play, RefreshCw, Music2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StationListenButton from './StationListenButton';
import FoundWithAI from './FoundWithAI';

const resolveTime = date => {
  const d=new Date(date);
  return Number.isNaN(d.getTime())?'—':d.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'});
};
function TrackCover({track,fallback}) {
  const imgRef=useRef(null);
  const [ready,setReady]=useState(false);
  const [url,setUrl]=useState(fallback);
  useEffect(()=>{setReady(false);setUrl(fallback);},[track.raw,fallback]);
  useEffect(()=>{
    if(!imgRef.current||ready)return;
    if(typeof IntersectionObserver==='undefined'){setReady(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting){setReady(true);observer.disconnect();}},{rootMargin:'120px'});
    observer.observe(imgRef.current);
    return ()=>observer.disconnect();
  },[ready,track.raw]);
  useEffect(()=>{
    if(!ready)return;
    let mounted=true;
    const controller=new AbortController();
    fetch('/api/cover-art?term='+encodeURIComponent(track.raw),{signal:controller.signal})
      .then(r=>r.ok?r.json():null)
      .then(data=>{if(mounted&&typeof data?.artworkUrl==='string'&&/^https:\/\//.test(data.artworkUrl))setUrl(data.artworkUrl);})
      .catch(()=>{});
    return ()=>{mounted=false;controller.abort();};
  },[ready,track.raw]);
  return <img ref={imgRef} src={url||fallback} alt="" loading="lazy"
    onError={e=>{ e.currentTarget.onerror=null; e.currentTarget.src=fallback; }}
    className="h-12 w-12 shrink-0 rounded-xl border border-white/10 bg-white object-cover"/>;
}

export default function StationPlaylistPanel({
  station, currentUser, currentStation, isPlaying, onPlayPause, onPlayStation, compact=false, sidebar=false
}) {
  const navigate=useNavigate();
  const [tracks,setTracks]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  // The playlist always belongs to the station displayed in this panel.
  // No independent station selector can drift away from the home hero or current station.
  const chosen=station;
  useEffect(()=>{
    if(!currentUser||!chosen?._id){setTracks([]);setError('');return;}
    const controller=new AbortController();
    setLoading(true);setTracks([]);setError('');
    fetch('/api/stations/'+encodeURIComponent(chosen._id)+'/playlist',{
      headers:{Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`},signal:controller.signal
    }).then(async r=>{
      const data=await r.json();
      if(!r.ok)throw new Error(data.error||'Δεν μπορέσαμε να φορτώσουμε τα τραγούδια.');
      return data;
    }).then(data=>setTracks(Array.isArray(data.tracks)?data.tracks.slice(0,120):[]))
      .catch(e=>{if(e.name!=='AbortError'){setError(e.message);setTracks([]);}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[currentUser?._id,chosen?._id,refresh]);
  useEffect(()=>{
    if(!currentUser||!chosen?._id)return;
    const timer=setInterval(()=>{if(!document.hidden)setRefresh(x=>x+1);},15000);
    return ()=>clearInterval(timer);
  },[currentUser?._id,chosen?._id]);
  return (
    <section className={`ir-playlist-panel ir-glass flex min-w-0 flex-col overflow-hidden p-4 sm:p-5 ${compact?'ir-playlist-panel--compact h-full':''} ${sidebar?'ir-playlist-panel--station-sidebar':''}`} aria-label="Πρόσφατα τραγούδια σταθμού">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#ccff00]"><Radio size={14}/> ΠΑΙΖΕΙ ΣΤΟ iRADIOS</p>
          <h2 className="mt-1 text-xl font-black text-white">{currentUser?'Playlist σταθμού':'Συνδέσου στο iRadios για NowPlaying'}</h2></div>
        <button type="button" title="Ανανέωση playlist" aria-label="Ανανέωση playlist" onClick={()=>setRefresh(n=>n+1)} disabled={!currentUser||loading} className="rounded-full border border-white/10 p-2 text-zinc-400 hover:text-[#ccff00] disabled:opacity-40"><RefreshCw size={17} className={loading?'animate-spin':''}/></button>
      </div>
      <div className={`mt-4 flex min-w-0 shrink-0 items-center gap-3 rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/[0.045] p-3 ${sidebar?'flex-wrap':''}`}>
        {chosen?.logo&&<img src={chosen.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1"/>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-white">{chosen?.name||'Δεν έχει επιλεγεί σταθμός'}</div>
          <span className="mt-1 block text-[11px] leading-4 text-zinc-400">{sidebar?'Τα τελευταία 30 λεπτά':'Τα τραγούδια των τελευταίων 30 λεπτών του '+(chosen?.name||'σταθμού')}</span>
        </div>
        {onPlayStation&&chosen&&<StationListenButton station={chosen} currentStation={currentStation} isPlaying={isPlaying}
          onPlayStation={onPlayStation} onPlayPause={onPlayPause} compact={sidebar} className={sidebar?'w-full':'shrink-0'}/>}
      </div>
      {!currentUser?(
        <div className="py-10 text-center"><ListMusic size={30} className="mx-auto mb-3 text-[#ccff00]"/>
          <p className="text-sm text-zinc-300">Συνδέσου στο iRadios για NowPlaying</p>
          <button onClick={()=>navigate('/login')} className="mt-4 rounded-xl border border-[#ccff00]/40 px-5 py-2 text-sm font-bold text-[#ccff00]">Σύνδεση</button>
        </div>
      ):error?<p role="alert" className="mt-6 text-sm text-red-300">{error}</p>
      :!loading&&!tracks.length?<div className="py-9 text-center">
        <Music2 size={29} className="mx-auto mb-3 text-zinc-500"/>
        <p className="text-sm text-zinc-300">Δεν υπάρχουν ακόμη τραγούδια στη λίστα.</p>
        <p className="mt-2 text-xs text-zinc-500">Τα τραγούδια θα εμφανιστούν εδώ μόλις τα μάθουμε.</p>
      </div>:null}
      {tracks.length>0&&<div className={`mt-3 min-h-0 divide-y divide-white/5 overflow-y-auto pr-1 ${compact?'flex-1':'max-h-[560px]'}`} aria-live="polite">
        {tracks.map((track,i)=><div key={track.raw+'-'+track.playedAt+'-'+i}
          className={`ir-station-playlist-track flex min-w-0 items-center gap-3 rounded-lg px-2 py-2.5 ${i===0?'bg-[#ccff00]/10':''}`}>
          <TrackCover track={track} fallback={chosen?.logo||'/iradios-app-logo.png'}/>
          <div className="ir-station-playlist-song min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white" title={track.title}>{track.title}</p>
            <p className="truncate text-xs text-zinc-400">{track.artist}</p>
            {track.source==='acrcloud'&&<FoundWithAI compact className="mt-1"/>}
          </div>
          <time dateTime={track.playedAt} className="ir-station-playlist-time shrink-0 text-[11px] tabular-nums text-zinc-500">{resolveTime(track.playedAt)}</time>
          {i===0&&<span className="sr-only">Πιο πρόσφατο τραγούδι</span>}
        </div>)}
      </div>}
      {loading&&!tracks.length&&<p className="mt-6 text-sm text-zinc-400">Φόρτωση τραγουδιών…</p>}
      {chosen&&!sidebar&&<button type="button" onClick={()=>navigate('/station/'+(chosen.slug||chosen._id))}
        className="mt-3 w-full shrink-0 rounded-xl border border-white/10 p-2.5 text-xs font-semibold text-zinc-300 hover:border-[#ccff00]/30 hover:text-[#ccff00]">
        Δες τον σταθμό και το πρόγραμμά του
      </button>}
    </section>
  );
}
