import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AudioLines, ChevronLeft, ChevronRight, Loader2, Radio } from 'lucide-react';
import { parseMusicMetadata } from '../utils/musicMetadata';

const PER_PASS = 36;
const BATCH = 6;

export default function PlayingNow({ stations = [], API_URL, currentUser, onPlayStation }) {
  const navigate = useNavigate();
  const [liveStations, setLiveStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const cursor = useRef(0);
  const stripRef = useRef(null);

  useEffect(() => {
    // Song titles are a logged-in feature. A guest never attempts to fetch metadata.
    if (!currentUser || !stations.length) {
      setLiveStations([]);
      setIsLoading(false);
      return;
    }
    let alive = true;
    let controller = new AbortController();
    const eligible = stations.filter(s => (s.status === 'approved' || !s.status) && s._id && s.stream);

    const poll = async () => {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      if (!eligible.length) { if (alive) { setLiveStations([]); setIsLoading(false); } return; }

      // Rotate through the approved stations rather than selecting random stations.
      const offset = cursor.current % eligible.length;
      const sampled = Array.from({ length: Math.min(PER_PASS, eligible.length) }, (_,i) =>
        eligible[(offset + i) % eligible.length]);
      cursor.current = (offset + sampled.length) % eligible.length;
      const token = localStorage.getItem('iluma_token');
      if (!token) { if (alive) { setLiveStations([]); setIsLoading(false); } return; }
      const detected = [];

      for (let i=0; i<sampled.length && alive && !signal.aborted; i+=BATCH) {
        const found = await Promise.all(sampled.slice(i,i+BATCH).map(async station => {
          try {
            const res = await fetch(`${API_URL}/metadata?stationId=${encodeURIComponent(station._id)}`, {
              headers:{Authorization:`Bearer ${token}`}, signal
            });
            if (!res.ok) return null;
            const data = await res.json();
            const music = parseMusicMetadata(data?.title);
            if (!music) return null;
            return { ...station, music, coverArt: station.logo };
          } catch { return null; }
        }));
        detected.push(...found.filter(Boolean));
      }

      if (signal.aborted || !alive) return;
      // A station disappears immediately when it no longer reports valid artist-title metadata.
      // Do not keep stale songs in the list after a failed/empty refresh.
      setLiveStations(detected);
      setIsLoading(false);

      // Artwork is optional and fetched only for a few visible cards, after music was verified.
      await Promise.all(detected.slice(0,12).map(async item => {
        try {
          const res = await fetch(`${API_URL}/cover-art?term=${encodeURIComponent(item.music.raw)}`,{signal});
          if (!res.ok) return;
          const data = await res.json();
          if (!data?.artworkUrl || !/^https:\/\//.test(data.artworkUrl) || !alive || signal.aborted) return;
          setLiveStations(prev => prev.map(s => s._id===item._id && s.music.raw===item.music.raw ?
            {...s,coverArt:data.artworkUrl} : s));
        } catch { /* station logo is the honest fallback */ }
      }));
    };

    poll();
    const timer = setInterval(() => { if (!document.hidden) poll(); }, 90000);
    return () => { alive=false; controller.abort(); clearInterval(timer); };
  }, [stations, API_URL, currentUser?._id]);

  if (!currentUser) return null;
  return (
    <section className="ir-home-now-playing min-w-0" aria-label="Σταθμοί που μεταδίδουν τραγούδια με metadata">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl">
            <AudioLines className="text-[#ccff00]" size={23}/> Τώρα παίζουν
            {isLoading && <Loader2 size={16} className="animate-spin text-[#ccff00]"/>}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">Μόνο σταθμοί με επιβεβαιωμένα μουσικά metadata</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-[#ccff00]/20 bg-[#ccff00]/10 px-3 py-1.5 text-[11px] font-bold text-[#ccff00] sm:inline">
            {liveStations.length} με metadata
          </span>
          <button type="button" aria-label="Προηγούμενοι σταθμοί που παίζουν" disabled={!liveStations.length}
            onClick={()=>stripRef.current?.scrollBy({left:-330,behavior:'smooth'})}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-zinc-300 hover:border-[#ccff00]/40 hover:text-[#ccff00] disabled:opacity-30">
            <ChevronLeft size={17}/>
          </button>
          <button type="button" aria-label="Επόμενοι σταθμοί που παίζουν" disabled={!liveStations.length}
            onClick={()=>stripRef.current?.scrollBy({left:330,behavior:'smooth'})}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-zinc-300 hover:border-[#ccff00]/40 hover:text-[#ccff00] disabled:opacity-30">
            <ChevronRight size={17}/>
          </button>
        </div>
      </div>
      {isLoading && !liveStations.length &&
        <div className="flex gap-3 overflow-hidden" aria-label="Φόρτωση">
          {Array.from({length:5},(_,i)=><div key={i} className="h-44 w-36 shrink-0 animate-pulse rounded-2xl bg-white/5"/>)}
        </div>
      }
      {!isLoading && !liveStations.length &&
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center">
          <Radio size={27} className="mx-auto text-[#ccff00]/60"/>
          <p className="mt-3 text-sm text-zinc-300">Δεν εντοπίστηκαν σταθμοί με έγκυρα μουσικά metadata αυτή τη στιγμή.</p>
          <p className="mt-1 text-xs text-zinc-500">Οι μεταδόσεις συνεχίζουν κανονικά. Η λίστα ενημερώνεται αυτόματα.</p>
        </div>
      }
      {!!liveStations.length &&
        <div ref={stripRef} className="ir-now-playing-scroll flex snap-x gap-3 overflow-x-auto pb-3" aria-live="polite">
          {liveStations.map(item=>
            <article key={item._id} className="group w-[132px] shrink-0 snap-start sm:w-[154px]">
              <button type="button" onClick={() => navigate(`/station/${item.slug || item._id}`)}
                aria-label={`${item.name}: ${item.music.artist} - ${item.music.title}`}
                className="relative block aspect-square w-full overflow-hidden rounded-2xl border border-white/15 bg-zinc-900 text-left transition-all hover:border-[#ccff00]/60 hover:shadow-[0_0_20px_rgba(204,255,0,0.13)]">
                <img src={item.coverArt||item.logo} alt="" loading="lazy"
                  onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=item.logo||'/iradios-app-logo.png';}}
                  className="h-full w-full bg-white object-cover transition-transform duration-500 group-hover:scale-105"/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"/>
                <span className="absolute bottom-2 left-2 rounded-full border border-black/20 bg-[#ccff00] px-2 py-1 text-[9px] font-black uppercase text-black">LIVE</span>
                {item.coverArt!==item.logo&&item.logo&&
                  <img src={item.logo} alt="" className="absolute right-2 top-2 h-9 w-9 rounded-lg border border-white/20 bg-white object-contain p-1"/>}
              </button>
              <p className="mt-2 truncate text-[11px] font-bold text-white">{item.name}</p>
              <p className="truncate text-[11px] text-[#ccff00]">{item.music.title}</p>
              <p className="truncate text-[10px] text-zinc-500">{item.music.artist}</p>
            </article>
          )}
        </div>
      }
    </section>
  );
}
