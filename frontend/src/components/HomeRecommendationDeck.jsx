import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

// A square artwork canvas for every live programme. Its contained foreground
// keeps portrait/wide/square artwork intact; only the blurred ambient layer crops.
// If an artwork URL fails, fall back to the station logo in both layers.
function OnAirArtwork({artworkUrl, stationLogo, hasProducerPhoto}) {
  const [failedImages, setFailedImages] = useState([]);
  const programmePhoto = hasProducerPhoto ? artworkUrl : '';
  const visualUrl = [programmePhoto, stationLogo].find(
    url => typeof url === 'string' && url.trim() && !failedImages.includes(url)
  );
  const showingProgrammePhoto = Boolean(programmePhoto && visualUrl === programmePhoto);
  const handleImageError = () => {
    if (visualUrl) setFailedImages(previous =>
      previous.includes(visualUrl) ? previous : [...previous, visualUrl]);
  };

  return (
    <>
      {visualUrl && (
        <>
          <img src={visualUrl} alt="" loading="lazy" aria-hidden="true"
            onError={handleImageError}
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl"/>
          <img src={visualUrl} alt="" loading="lazy" aria-hidden="true"
            onError={handleImageError}
            className={'pointer-events-none absolute inset-0 h-full w-full object-contain object-center ' +
              (showingProgrammePhoto ? 'p-1 opacity-95 sm:p-2' : 'p-8 opacity-90 sm:p-10')}/>
        </>
      )}
      <span aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/15"/>
    </>
  );
}

export default function HomeRecommendationDeck({
  moodStations = [], stations = [], currentStation, isPlaying, onPlayStation, onPlayPause
}) {
  const navigate = useNavigate();
  const deckRef = useRef(null);
  const [columns, setColumns] = useState(1);
  const [forYouExtraRows, setForYouExtraRows] = useState(0);
  const [onAirExtraRows, setOnAirExtraRows] = useState(0);

  const play = station => {
    if (station.isOffline === true || stationIsPlaying(station, currentStation, isPlaying)) return;
    if (String(station._id) === String(currentStation?._id) && onPlayPause) onPlayPause();
    else onPlayStation(station);
  };
  // The compact recommendations share the responsive column count, but not the on-air card height.
  const picks = [...moodStations].filter(Boolean)
    .sort((a,b) => Number(a.isOffline === true) - Number(b.isOffline === true))
    .slice(0, 36);
  const [clock, setClock] = useState(() => getAthensClock());
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
  // The deck may render null until stations load asynchronously. A mount-only
  // measurement would see a null ref and leave the grid stuck at one giant column.
  const hasDeckItems = picks.length > 0 || onAir.length > 0;
  useLayoutEffect(() => {
    if (!hasDeckItems) return;
    const deck = deckRef.current;
    if (!deck) return;
    const updateColumns = () => {
      // Measure the actual content pane, excluding the desktop sidebar.
      const width = deck.getBoundingClientRect().width || deck.clientWidth;
      if (!Number.isFinite(width) || width <= 0) return;
      const next = width >= 1320 ? 6 : width >= 1080 ? 5 : width >= 780 ? 4
        : width >= 600 ? 3 : width >= 440 ? 2 : 1;
      setColumns(previous => previous === next ? previous : next);
    };
    updateColumns(); // Layout effect avoids flashing huge single-column cards.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateColumns) : null;
    observer?.observe(deck);
    window.addEventListener('resize', updateColumns);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateColumns);
    };
  }, [hasDeckItems]);
  // One starting row on desktop/tablet; keep four vertically on phones.
  // Every arrow click reveals exactly two more rows at the current column count.
  const firstRowCount = columns <= 2 ? 4 : columns;
  const visiblePicks = picks.slice(0, firstRowCount + forYouExtraRows * columns);
  const visibleOnAir = onAir.slice(0, firstRowCount + onAirExtraRows * columns);
  const morePicks = visiblePicks.length < picks.length;
  const moreOnAir = visibleOnAir.length < onAir.length;
  if (!hasDeckItems) return null;

  return (
    <section ref={deckRef} className="min-w-0 space-y-8 sm:space-y-10" aria-label="Ανακάλυψη και ζωντανές εκπομπές">
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-white sm:text-2xl"><Sparkles className="text-[#ccff00]" size={23}/> Για σένα</h2>
            <p className="mt-1 text-xs text-zinc-400">Μουσική που μπορεί να σου αρέσει</p>
          </div>
          {(morePicks || forYouExtraRows > 0) && (
            <button type="button"
              onClick={() => setForYouExtraRows(rows => morePicks ? rows + 2 : 0)}
              title={morePicks ? 'Δύο ακόμα σειρές προτάσεων' : 'Λιγότερες προτάσεις'}
              aria-label={morePicks ? 'Εμφάνιση δύο ακόμα σειρών προτάσεων' : 'Σύμπτυξη προτάσεων'}
              aria-expanded={forYouExtraRows > 0}
              aria-controls="home-for-you-grid"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-[#ccff00] transition-colors hover:border-[#ccff00]/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ccff00]">
              {morePicks ? <ChevronRight size={18}/> : <ChevronUp size={18}/>}
            </button>
          )}
        </div>
        <div id="home-for-you-grid" className="grid min-w-0 gap-3" style={{ gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))' }}>
          {visiblePicks.map((station, index) => (
            <article key={station._id}
              className={`group relative isolate flex w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35 ${columns === 1 ? 'h-[128px]' : 'aspect-[1.85] min-h-[128px]'} ${gradients[index % gradients.length]}`}>
              <img src={station.logo} alt="" aria-hidden="true" loading="lazy" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-15 blur-2xl"/>
              <div className="pointer-events-none absolute -right-8 -top-7 h-28 w-28 rounded-full bg-white/10 blur-[30px]"/>
              <img src={station.logo} alt="" loading="lazy" className="relative z-10 h-11 w-11 rounded-xl bg-white object-contain p-1 shadow-xl sm:h-12 sm:w-12"/>
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
          {(moreOnAir || onAirExtraRows > 0) && (
            <button type="button"
              onClick={() => setOnAirExtraRows(rows => moreOnAir ? rows + 2 : 0)}
              title={moreOnAir ? 'Δύο ακόμα σειρές ζωντανών εκπομπών' : 'Λιγότερες εκπομπές'}
              aria-expanded={onAirExtraRows > 0}
              aria-label={moreOnAir ? 'Εμφάνιση δύο ακόμα σειρών εκπομπών' : 'Σύμπτυξη εκπομπών'}
              aria-controls="home-on-air-grid"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-[#ccff00] transition-colors hover:border-[#ccff00]/40 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ccff00]">
              {moreOnAir ? <ChevronRight size={18}/> : <ChevronUp size={18}/>}
            </button>
          )}
        </div>
        <div id="home-on-air-grid" className="grid min-w-0 gap-3" style={{ gridTemplateColumns: 'repeat(' + columns + ', minmax(0, 1fr))' }}>
          {visibleOnAir.map(({station, host, endLabel, backgroundUrl, hasProducerPhoto}) => (
            <article key={station._id}
              className="group relative isolate flex aspect-square w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#15302b] via-[#161e2b] to-zinc-950 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/35">
              <OnAirArtwork artworkUrl={backgroundUrl} stationLogo={station.logo}
                hasProducerPhoto={hasProducerPhoto}/>
              <div className={`relative z-10 items-start justify-between gap-2 ${hasProducerPhoto && columns === 1 ? 'hidden' : 'flex'}`}>
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
