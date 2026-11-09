import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronUp, Mic2, Play, Radio, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { stationIsPlaying } from './StationListenButton';
import { getAthensClock } from '../utils/schedule.js';
import { getOnAirProducers } from '../utils/onAirProducers.js';

const gradients = [
  'from-fuchsia-950 via-purple-900/80 to-zinc-950',
  'from-sky-950 via-indigo-900/80 to-zinc-950',
  'from-rose-950 via-orange-900/70 to-zinc-950',
  'from-emerald-950 via-teal-900/75 to-zinc-950'
];

export default function HomeRecommendationDeck({
  moodStations = [], stations = [], currentStation, isPlaying, onPlayStation, onPlayPause
}) {
  const navigate = useNavigate();
  const play = station => {
    if (station.isOffline === true || stationIsPlaying(station, currentStation, isPlaying)) return;
    if (String(station._id) === String(currentStation?._id) && onPlayPause) onPlayPause();
    else onPlayStation(station);
  };
  // Six square recommendations on larger screens (3 columns × 2 rows), three stacked on phones.
  const picks = [...moodStations].filter(Boolean)
    .sort((a,b) => Number(a.isOffline === true) - Number(b.isOffline === true))
    .slice(0, 6);
  const [clock, setClock] = useState(() => getAthensClock());
  const [showAllProducers, setShowAllProducers] = useState(false);
  useEffect(() => {
    const refresh = () => {
      const next = getAthensClock();
      setClock(prev => prev.day === next.day && prev.minute === next.minute ? prev : next);
    };
    const timer = setInterval(refresh, 30000);
    const onVisibility = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  const onAir = useMemo(() => getOnAirProducers(stations, clock), [stations, clock]);
  const visibleOnAir = showAllProducers ? onAir : onAir.slice(0, 6);
  if (!picks.length && !onAir.length) return null;

  return (
    <section className="grid min-w-0 items-start gap-5 xl:grid-cols-2" aria-label="Ανακάλυψη και ζωντανές εκπομπές">
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl"><Sparkles className="text-[#ccff00]" size={23}/> Για σένα</h2>
            <p className="mt-1 text-xs text-zinc-400">Μουσική που μπορεί να σου αρέσει</p>
          </div>
          <button type="button" onClick={() => navigate('/?explore=for-you')} aria-label="Όλες οι προτάσεις"
            className="rounded-full border border-white/15 p-2 text-[#ccff00] hover:bg-white/10"><ChevronRight size={18}/></button>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {picks.map((station, index) => (
            <article key={station._id}
              className={`group relative isolate aspect-square w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br p-3 ${index >= 3 ? 'hidden sm:flex' : 'flex'} ${gradients[index % gradients.length]}`}>
              <img src={station.logo} alt="" aria-hidden="true" loading="lazy" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-15 blur-2xl"/>
              <div className="pointer-events-none absolute -right-8 -top-7 h-28 w-28 rounded-full bg-white/10 blur-[30px]"/>
              <img src={station.logo} alt="" loading="lazy" className="relative z-10 h-16 w-16 rounded-xl bg-white object-contain p-1.5 shadow-xl"/>
              <div className="relative z-10 mt-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <span className="block line-clamp-1 text-[10px] font-black text-white/75">{station.genre || 'Ραδιόφωνο'}</span>
                  <button type="button" onClick={() => navigate('/station/' + (station.slug || station._id))}
                    className="mt-1 block max-w-full truncate text-left text-sm font-black text-white hover:text-[#ccff00]">{station.name}</button>
                </div>
                <button type="button"
                  disabled={station.isOffline === true || stationIsPlaying(station, currentStation, isPlaying)}
                  onClick={() => play(station)}
                  title={station.isOffline === true ? 'OFFLINE' : 'Άκου τώρα'}
                  aria-label={(station.isOffline === true ? 'OFFLINE: ' : 'Άκου τώρα: ') + station.name}
                  className={station.isOffline === true
                    ? 'flex h-9 w-12 shrink-0 cursor-not-allowed items-center justify-center rounded-lg bg-red-600 text-[9px] font-black text-white'
                    : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white hover:bg-[#ccff00] hover:text-black disabled:opacity-50'}>
                  {station.isOffline === true ? 'OFFLINE' : <Play size={17} fill="currentColor"/>}
                </button>
              </div>
            </article>
          ))}
          {!picks.length && <div className="col-span-full flex min-h-[138px] items-center justify-center rounded-2xl border border-white/10 text-sm text-zinc-400"><Radio size={18}/> Δεν υπάρχουν προτάσεις.</div>}
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl"><Mic2 className="text-[#ccff00]" size={23}/> Στον αέρα τώρα</h2>
            <p className="mt-1 text-xs text-zinc-400">Εκπομπές και παραγωγοί αυτή τη στιγμή</p>
          </div>
          {onAir.length > 3 && (
            <button type="button" onClick={() => setShowAllProducers(v => !v)}
              title={showAllProducers ? 'Λιγότερες εκπομπές' : 'Όλες οι εκπομπές'}
              aria-expanded={showAllProducers}
              aria-label={showAllProducers ? 'Λιγότερες εκπομπές' : 'Όλες οι εκπομπές'}
              className={`rounded-full border border-white/15 p-2 text-[#ccff00] hover:bg-white/10 ${onAir.length <= 6 ? 'sm:hidden' : ''}`}>
              {showAllProducers ? <ChevronUp size={18}/> : <ChevronRight size={18}/>}
            </button>
          )}
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleOnAir.map(({station, host, endLabel, backgroundUrl, hasProducerPhoto}, index) => (
            <article key={station._id}
              className={`group relative isolate aspect-square w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#15302b] via-[#161e2b] to-zinc-950 p-3 ${showAllProducers ? 'flex' : index >= 3 ? 'hidden sm:flex' : 'flex'}`}>
              <img src={backgroundUrl || station.logo} alt="" loading="lazy" aria-hidden="true"
                onError={event => {
                  const image = event.currentTarget;
                  image.onerror = null;
                  image.src = station.logo;
                }}
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"/>
              {hasProducerPhoto && (
                <img src={backgroundUrl} alt="" loading="lazy" aria-hidden="true"
                  onError={event => { event.currentTarget.style.display = 'none'; }}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-90"/>
              )}
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/20"/>
              <div className="relative z-10 flex items-start justify-between gap-2">
                <img src={station.logo} alt="" loading="lazy"
                  className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1 shadow-xl sm:h-14 sm:w-14"/>
                <span className="shrink-0 rounded-full border border-white/20 bg-black/55 px-2 py-1 text-[10px] font-bold text-white/90">έως {endLabel}</span>
              </div>
              <div className="relative z-10 mt-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <span className="block line-clamp-1 text-[10px] font-black text-white/85" title={host}>{host}</span>
                  <button type="button" onClick={() => navigate('/station/' + (station.slug || station._id))}
                    className="mt-1 block max-w-full truncate text-left text-sm font-black text-white hover:text-[#ccff00]">{station.name}</button>
                </div>
                <button type="button" disabled={stationIsPlaying(station, currentStation, isPlaying)}
                  onClick={() => play(station)}
                  title={stationIsPlaying(station, currentStation, isPlaying) ? 'Παίζει τώρα' : 'Άκου τώρα'}
                  aria-label={'Άκου τώρα: ' + station.name + ' – ' + host}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-[#ccff00] hover:text-black disabled:opacity-50">
                  <Play size={17} fill="currentColor"/>
                </button>
              </div>
            </article>
          ))}
          {!onAir.length && (
            <div className="col-span-full flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#11171d] p-6 text-center">
              <Mic2 size={28} className="text-zinc-500"/>
              <p className="text-sm font-semibold text-zinc-300">Δεν υπάρχει ενεργή εκπομπή στο διαθέσιμο πρόγραμμα αυτή τη στιγμή.</p>
              <p className="text-xs text-zinc-500">Η λίστα ανανεώνεται αυτόματα από τα προγράμματα των σταθμών.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
