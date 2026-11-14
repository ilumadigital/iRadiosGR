import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, Check, ChevronDown, ChevronUp, Disc3, Heart, Loader2,
  Music2, Pause, Play, Radio, RadioTower, RefreshCw, Share2, X
} from 'lucide-react';
import { useStationAmbient } from '../hooks/useStationAmbient';
import { activeStationShow } from '../utils/liveBroadcast';
import { getAthensClock, minutes, scheduleDayBase, toCanonical } from '../utils/schedule';
import { parseMusicMetadata } from '../utils/musicMetadata';
import './RadioDiscovery.css';

const stationId = station => String(station?._id || station?.id || '');
const stationUrl = station => '/station/' + encodeURIComponent(station?.slug || stationId(station));
const nextScheduledShow = (station, clock) => {
  const entries = Array.isArray(station?.schedule) ? station.schedule : [];
  if (!entries.length) return null;
  const canonical = toCanonical(entries, scheduleDayBase(entries, station.scheduleDayBase));
  const future = canonical.map(show => {
    const day = Number(show.day);
    const start = minutes(show.startTime);
    if (day < 1 || day > 7 || !Number.isFinite(start)) return null;
    const delay = ((day - clock.day + 7) % 7) * 1440 + start - clock.minute;
    return delay > 0 ? { ...show, delay } : null;
  }).filter(Boolean).sort((a, b) => a.delay - b.delay);
  return future[0] || null;
};

/** Draw from the shared WebDSP analyser only. Never make a second audio source. */
function DiscoverySpectrum({ analyser, playing }) {
  const barsRef = useRef(null);
  useEffect(() => {
    if (!playing || !analyser || typeof analyser.getByteFrequencyData !== 'function' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const bars = barsRef.current?.children;
    if (!bars?.length) return undefined;
    const samples = new Uint8Array(analyser.frequencyBinCount || 0);
    if (!samples.length) return undefined;
    let frame = 0;
    let lastFrame = 0;
    let running = true;
    const tick = timestamp => {
      if (!running) return;
      if (!document.hidden && timestamp - lastFrame > 45) {
        lastFrame = timestamp;
        try {
          analyser.getByteFrequencyData(samples);
          for (let i = 0; i < bars.length; i++) {
            const bin = Math.min(samples.length - 1, Math.floor((i / bars.length) * samples.length * .6));
            bars[i].style.transform = 'scaleY(' + Math.max(.16, samples[bin] / 255) + ')';
          }
        } catch { running = false; return; }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
    };
  }, [analyser, playing]);
  return <div className="ir-reel-spectrum" ref={barsRef} aria-hidden="true">
    {Array.from({ length: 25 }, (_, i) => <span key={i}/>)}
  </div>;
}

function DiscoveryReel({
  station, currentStation, currentUser, isPlaying, isBuffering,
  isPlayingAd, currentAdInfo, nowPlaying, nowPlayingInfo, coverArt,
  analyser, isFavorite, toggleFavorite, onTogglePlayPause, onSelectStation,
  onViewProfile, onShare, shareCopied, onLikeBurst
}) {
  const [clock, setClock] = useState(() => getAthensClock());
  const id = stationId(station);
  const sameStation = id && stationId(currentStation) === id;
  const tuning = sameStation && isBuffering && !isPlayingAd;
  const live = sameStation && isPlaying && !isPlayingAd;
  const adBreak = isPlayingAd;
  const track = live && !nowPlayingInfo?.premiumOnly
    ? parseMusicMetadata(nowPlaying, station.name) : null;
  const broadcast = live && !track && !nowPlayingInfo?.premiumOnly
    ? String(nowPlayingInfo?.broadcastHint || '').trim() : '';
  const displayedArt = track && coverArt ? coverArt : station.logo;
  const ambientRgb = useStationAmbient(station.logo);
  const favorite = Boolean(isFavorite?.(station._id || station.id));
  const activeShow = useMemo(() => activeStationShow(station, clock), [station, clock]);
  const nextShow = useMemo(() => nextScheduledShow(station, clock), [station, clock]);

  useEffect(() => {
    const update = () => setClock(getAthensClock());
    const timer = setInterval(update, 30000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const toggleLike = () => {
    if (!favorite && currentUser) onLikeBurst();
    toggleFavorite?.(station._id || station.id);
  };
  const togglePlayback = () => {
    if (adBreak) return;
    if (sameStation) onTogglePlayPause?.();
    else onSelectStation?.(station);
  };
  const songText = adBreak ? 'Διαφημιστικό διάλειμμα · συνεχίζεις αμέσως μετά'
    : !sameStation ? 'Συντονισμός στον σταθμό…'
    : nowPlayingInfo?.premiumOnly ? '✦ Αναγνώριση AI διαθέσιμη με Premium'
    : track ? track.title
    : broadcast || (live ? 'Ζωντανή μετάδοση' : 'Έτοιμος για ακρόαση');
  const artistText = track?.artist || '';
  const heroName = station?.name || 'iRadiosGR';

  return <div className="ir-reel-content" style={{ '--ir-reel-rgb': ambientRgb }}>
    <div className="ir-reel-bg" aria-hidden="true">
      {displayedArt && <img src={displayedArt} alt="" className="ir-reel-bg-image"/>}
      <div className="ir-reel-bg-tint"/>
      <div className="ir-reel-bg-vignette"/>
    </div>
    <DiscoverySpectrum analyser={analyser} playing={live}/>

    <div className="ir-reel-visual" aria-hidden="true">
      <div className={'ir-reel-art-halo' + (live ? ' is-live' : '')}/>
      <div className="ir-reel-art-card">
        {displayedArt
          ? <img src={displayedArt} alt="" key={displayedArt}
              className={'ir-reel-art-image ' + (track && coverArt ? 'is-cover' : 'is-logo')}
              onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = station.logo || '/icon-tr.svg'; }}/>
          : <RadioTower size={68} color="#ccff00"/>}
        <span className="ir-reel-art-glint" aria-hidden="true"/>
      </div>
      <div className="ir-reel-art-caption"><span className="ir-reel-live-dot"/> LIVE RADIO</div>
    </div>

    <aside className="ir-reel-actions" aria-label="Ενέργειες σταθμού">
      <div className="ir-reel-action">
        <button type="button" onClick={toggleLike} aria-label={favorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
          aria-pressed={favorite} className={'ir-reel-action-button' + (favorite ? ' is-favorite' : '')}>
          <Heart size={25} fill={favorite ? 'currentColor' : 'none'}/>
        </button><span>Like</span>
      </div>
      <div className="ir-reel-action">
        <button type="button" onClick={onViewProfile} aria-label={'Προφίλ σταθμού ' + heroName}
          className="ir-reel-action-button">
          <Radio size={25}/><ArrowUpRight size={11} className="ir-reel-profile-arrow"/>
        </button><span>Profile</span>
      </div>
      <div className="ir-reel-action">
        <button type="button" onClick={onShare} aria-label={'Κοινοποίηση ' + heroName}
          className="ir-reel-action-button">
          {shareCopied ? <Check size={25}/> : <Share2 size={24}/>}
        </button><span>{shareCopied ? 'Copied' : 'Share'}</span>
      </div>
    </aside>

    <div className="ir-reel-bottom">
      <div className="ir-reel-tags">
        <span className="ir-reel-live-pill"><span className="ir-reel-live-dot"/> LIVE</span>
        {station.genre && <span className="ir-reel-tag">{station.genre}</span>}
        {(station.city || station.region) && <span className="ir-reel-tag">{station.city || station.region}</span>}
      </div>
      <h2 className="ir-reel-station-name">{heroName}</h2>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={id + ':' + songText + ':' + artistText}
          initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -7 }} transition={{ duration: .23 }} className="ir-reel-metadata">
          <div className="ir-reel-meta-label"><Music2 size={13}/> {adBreak ? 'SPONSORED' : 'DYNAMIC RDS · NOW PLAYING'}</div>
          <strong title={songText}>{songText}</strong>
          {artistText && <span>{artistText}</span>}
        </motion.div>
      </AnimatePresence>
      <div className="ir-reel-program">
        {activeShow ? <div className="ir-reel-program-line">
          <span className="ir-reel-program-dot"/> <strong>ΣΤΟΝ ΑΕΡΑ</strong>
          <span className="ir-reel-program-text">{activeShow.title}{activeShow.host ? ' · ' + activeShow.host : ''}</span>
        </div> : <div className="ir-reel-program-line">
          <span className="ir-reel-program-dot is-muted"/> <strong>ΠΡΟΓΡΑΜΜΑ</strong>
          <span className="ir-reel-program-text">Δεν υπάρχει τρέχουσα καταχώριση</span>
        </div>}
        {nextShow && <div className="ir-reel-program-line">
          <span className="ir-reel-program-dot is-muted"/> <strong>ΑΚΟΛΟΥΘΕΙ</strong>
          <span className="ir-reel-program-text">{nextShow.startTime} · {nextShow.title}</span>
        </div>}
      </div>
      <div className="ir-reel-transport">
        <button type="button" onClick={togglePlayback} disabled={adBreak} aria-label={live ? 'Παύση σταθμού' : 'Αναπαραγωγή σταθμού'}
          className="ir-reel-play">
          {tuning ? <Loader2 size={17} className="ir-reel-spin"/> : live ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}
          <span>{adBreak ? 'Διαφημιστικό διάλειμμα' : tuning ? 'Σύνδεση…' : live ? 'Ακούς ζωντανά' : 'Άκου LIVE'}</span>
        </button>
        <span className="ir-reel-swipe-label"><ChevronUp size={15}/> SWIPE</span>
      </div>
      {adBreak && <div className="ir-reel-ad-hint" role="status">
        {currentAdInfo?.title ? 'Παίζει: ' + currentAdInfo.title + ' · ' : ''}
        Η επιλογή σου θα παίξει μετά τη διαφήμιση.
      </div>}
    </div>
  </div>;
}

const slideVariants = {
  enter: dir => ({ y: dir > 0 ? '105%' : '-105%', opacity: .8, scale: .97 }),
  active: { y: '0%', opacity: 1, scale: 1 },
  exit: dir => ({ y: dir > 0 ? '-95%' : '95%', opacity: .55, scale: .98 })
};

export default function RadioDiscovery({
  API_URL, onClose, onSelectStation, catalogStations = [], currentStation,
  currentUser, isPlaying, isBuffering, isPlayingAd, currentAdInfo,
  nowPlaying, nowPlayingInfo, globalCoverArt, analyser, toggleFavorite,
  isFavorite, onTogglePlayPause
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [feed, setFeed] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState(1);
  const [shareCopied, setShareCopied] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const seenRef = useRef(new Set());
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const gestureAtRef = useRef(0);
  const shareTimeoutRef = useRef(null);
  const heartTimeoutRef = useRef(null);

  const catalog = useMemo(() =>
    new Map(catalogStations.map(station => [stationId(station), station])),
  [catalogStations]);
  const stations = useMemo(() => feed.map(item => {
    const full = catalog.get(stationId(item));
    return full ? { ...item, ...full } : item;
  }), [feed, catalog]);
  const selected = stations[activeIndex];
  const activeId = stationId(selected);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || abortRef.current?.signal.aborted || !hasMore) return;
    inFlightRef.current = true;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch(API_URL + '/stations/discovery', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Discovery unavailable');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid discovery feed');
      const fresh = data.filter(station => {
        const id = stationId(station);
        if (!id || seenRef.current.has(id) || station.isOffline === true) return false;
        seenRef.current.add(id);
        return true;
      });
      if (!controller.signal.aborted) {
        if (fresh.length) setFeed(previous => previous.concat(fresh));
        if (!fresh.length || seenRef.current.size >= 90 || data.length === 0) setHasMore(false);
      }
    } catch (err) {
      if (!controller.signal.aborted) setError('Δεν φορτώθηκαν οι νέοι σταθμοί. Δοκίμασε ξανά.');
    } finally {
      inFlightRef.current = false;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [API_URL, hasMore]);

  useEffect(() => {
    void loadMore();
    return () => {
      abortRef.current?.abort();
      clearTimeout(shareTimeoutRef.current);
      clearTimeout(heartTimeoutRef.current);
    };
  }, []); // One initial request per opened Discovery session.

  useEffect(() => {
    if (started && activeIndex >= stations.length - 3 && hasMore && !error) void loadMore();
  }, [started, activeIndex, stations.length, hasMore, error, loadMore]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const activate = useCallback((station) => {
    if (!station) return;
    if (stationId(currentStation) === stationId(station)) {
      if (!isPlaying && !isPlayingAd) onTogglePlayPause?.();
    } else onSelectStation?.(station);
  }, [currentStation, isPlaying, isPlayingAd, onSelectStation, onTogglePlayPause]);

  const start = () => {
    if (!selected) return;
    setStarted(true);
    activate(selected); // Synchronous in the click gesture for iOS audio unlock.
  };

  const changeStation = useCallback(offset => {
    if (!started || !stations.length) return;
    const now = Date.now();
    if (now - gestureAtRef.current < 440) return;
    const next = activeIndex + offset;
    if (next < 0 || next >= stations.length) {
      if (offset > 0 && hasMore) void loadMore();
      return;
    }
    gestureAtRef.current = now;
    setDirection(offset > 0 ? 1 : -1);
    setActiveIndex(next);
    setShareCopied(false);
    activate(stations[next]); // Route every swipe through central ads/DSP/device engine.
    if (navigator.vibrate && !reduceMotion) navigator.vibrate(7);
  }, [started, stations, activeIndex, activate, hasMore, loadMore, reduceMotion]);

  useEffect(() => {
    if (!started) return undefined;
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose?.(); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        changeStation(event.key === 'ArrowDown' ? 1 : -1);
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [started, changeStation, onClose]);

  const share = async () => {
    if (!selected) return;
    const url = window.location.origin + stationUrl(selected);
    try {
      if (navigator.share) {
        await navigator.share({ title: selected.name, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
      } else {
        window.prompt('Αντέγραψε τον σύνδεσμο', url);
      }
      clearTimeout(shareTimeoutRef.current);
      shareTimeoutRef.current = setTimeout(() => setShareCopied(false), 2000);
    } catch (error) {
      if (error?.name !== 'AbortError') setError('Η κοινοποίηση δεν ολοκληρώθηκε.');
    }
  };

  const burstHeart = () => {
    setHeartBurst(true);
    clearTimeout(heartTimeoutRef.current);
    heartTimeoutRef.current = setTimeout(() => setHeartBurst(false), 780);
  };

  const openProfile = () => {
    if (!selected) return;
    onClose?.();
    navigate(stationUrl(selected));
  };

  return <div className="ir-discovery-reels" role="dialog" aria-modal="true" aria-label="iRadios Discovery Radio Reels"
    onWheel={event => { if (started && Math.abs(event.deltaY) > 25) changeStation(event.deltaY > 0 ? 1 : -1); }}>
    <header className="ir-reels-header">
      <div className="ir-reels-brand"><span className="ir-reels-brand-icon"><RadioTower size={18}/></span>
        <span>iRADIOS <b>DISCOVERY</b></span>
      </div>
      {started && <div className="ir-reels-count">{String(activeIndex + 1).padStart(2, '0')} <span>/</span> {String(stations.length).padStart(2, '0')}</div>}
      <button type="button" onClick={onClose} className="ir-reels-close" aria-label="Κλείσιμο Discovery"><X size={21}/></button>
    </header>

    {!started ? <div className="ir-reels-intro">
      <div className="ir-reels-intro-halo" aria-hidden="true"/>
      <div className="ir-reels-intro-mark"><Disc3 size={60}/></div>
      <span className="ir-reels-intro-kicker">RADIO, REINVENTED.</span>
      <h1>Άκου. Σύρε.<br/><em>Ανακάλυψε.</em></h1>
      <p>Το δικό σου radio feed. Live σταθμοί, μουσική και εκπομπές, με ένα swipe.</p>
      {error && <p role="alert" className="ir-reels-intro-error">{error}</p>}
      <button type="button" onClick={start} disabled={!selected} className="ir-reels-enter">
        {loading && !selected ? <Loader2 size={19} className="ir-reel-spin"/> : <Play size={19} fill="currentColor"/>}
        {loading && !selected ? 'Φόρτωση σταθμών…' : selected ? 'ΞΕΚΙΝΑ ΤΟ DISCOVERY' : 'Δεν βρέθηκαν σταθμοί'}
      </button>
      {!selected && error && <button type="button" onClick={() => { setHasMore(true); void loadMore(); }}
        className="ir-reels-retry"><RefreshCw size={16}/> Επανάληψη</button>}
      <div className="ir-reels-intro-hint"><ChevronUp size={16}/> Swipe up για τον επόμενο σταθμό</div>
    </div> : <>
      <div className="ir-reels-stage">
        <AnimatePresence initial={false} custom={direction}>
          {selected && <motion.article key={activeId} className="ir-reels-slide"
            custom={direction} variants={slideVariants}
            initial={reduceMotion ? false : 'enter'} animate="active" exit={reduceMotion ? undefined : 'exit'}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 34, mass: .86 }}
            drag={reduceMotion ? false : 'y'} dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={.2} dragMomentum={false}
            onDragEnd={(_event, info) => {
              if (Math.abs(info.offset.y) > 65 || Math.abs(info.velocity.y) > 600)
                changeStation(info.offset.y < 0 || info.velocity.y < -600 ? 1 : -1);
            }}>
            <DiscoveryReel station={selected} currentStation={currentStation}
              currentUser={currentUser} isPlaying={isPlaying} isBuffering={isBuffering}
              isPlayingAd={isPlayingAd} currentAdInfo={currentAdInfo}
              nowPlaying={nowPlaying} nowPlayingInfo={nowPlayingInfo}
              coverArt={globalCoverArt} analyser={analyser} isFavorite={isFavorite}
              toggleFavorite={toggleFavorite} onTogglePlayPause={onTogglePlayPause}
              onSelectStation={onSelectStation} onViewProfile={openProfile}
              onShare={share} shareCopied={shareCopied} onLikeBurst={burstHeart}/>
          </motion.article>}
        </AnimatePresence>
        <AnimatePresence>{heartBurst && <motion.div className="ir-reel-heart-burst"
          initial={{ opacity: 0, scale: .5 }} animate={{ opacity: 1, scale: 1.15 }}
          exit={{ opacity: 0, scale: 1.5 }} transition={{ duration: .45 }}>
          <Heart size={140} fill="currentColor"/>
        </motion.div>}</AnimatePresence>
      </div>
      {error && <div className="ir-reels-feed-warning" role="status">
        {error} <button type="button" onClick={() => { setError(''); void loadMore(); }}>Ανανέωση</button>
      </div>}
      {activeIndex === stations.length - 1 && !hasMore && <div className="ir-reels-feed-end">
        Είδες όλες τις ανακαλύψεις.
        <button type="button" onClick={() => { setActiveIndex(0); setDirection(-1); activate(stations[0]); }}>Από την αρχή</button>
      </div>}
      <div className="ir-reels-pager" aria-label="Πλοήγηση Discovery">
        <button type="button" aria-label="Προηγούμενος σταθμός" disabled={activeIndex === 0}
          onClick={() => changeStation(-1)}><ChevronUp size={21}/></button>
        <button type="button" aria-label="Επόμενος σταθμός"
          disabled={activeIndex >= stations.length - 1 && !hasMore}
          onClick={() => changeStation(1)}><ChevronDown size={21}/></button>
      </div>
    </>}
  </div>;
}
