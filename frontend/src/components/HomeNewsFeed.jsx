import React, {useEffect, useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ArrowRight, Headphones, Newspaper, Pause, Play, Radio, RefreshCw} from 'lucide-react';
import {Article} from '../pages/NewsFeed';
import {compareCatalogPopularity} from '../utils/catalogLive';
import {stationIsPlaying} from './StationListenButton';

// Public editorial content is already curated and cached by /api/newsfeed.
// The homepage never parses RSS feeds or launches another backend refresh.
const NEWS_GENRES = new Set(['Ειδησεογραφικά', 'Ειδήσεις', 'Ειδησεογραφικό', 'News']);
const NEWS_SECONDARY = new Set(['Τοπικές Ειδήσεις', 'Πολιτική', 'Οικονομία']);
const STATION_GRADIENTS = [
  'from-[#4a155f] via-[#38194a] to-[#16121f]',
  'from-[#182e64] via-[#252a55] to-[#11151e]',
  'from-[#03493f] via-[#164942] to-[#131b22]',
  'from-[#4b164e] via-[#352051] to-[#15131f]'
];
const isNewsStation = station =>
  NEWS_GENRES.has(String(station?.genre || '').trim()) ||
  NEWS_SECONDARY.has(String(station?.secondaryGenre || '').trim());

function NewsRadioCard({station, index, currentStation, isPlaying, onPlayStation, onPlayPause}) {
  const navigate = useNavigate();
  const active = stationIsPlaying(station, currentStation, isPlaying);
  const offline = station.isOffline === true;
  const same = String(station._id) === String(currentStation?._id);
  const toggle = () => {
    if (offline) return;
    if (same && onPlayPause) onPlayPause();
    else onPlayStation?.(station);
  };

  return (
    <article className={'group relative isolate min-h-[144px] min-w-0 overflow-hidden rounded-[20px] border border-white/15 bg-gradient-to-br p-3 shadow-[0_12px_28px_rgba(0,0,0,.2)] transition-colors hover:border-white/30 sm:min-h-[154px] sm:p-4 ' + STATION_GRADIENTS[index % STATION_GRADIENTS.length]}>
      <span className="pointer-events-none absolute -right-8 -top-9 size-28 rounded-full bg-white/10 blur-2xl" />
      <button type="button" onClick={() => navigate('/station/' + (station.slug || station._id))}
        aria-label={'Προφίλ σταθμού ' + station.name}
        className="relative z-10 flex max-w-full flex-col items-start text-left">
        <img src={station.logo || '/iradios-logo.png'} alt="" loading="lazy"
          className="size-12 rounded-xl border border-white/15 bg-white object-contain p-1 shadow-lg sm:size-14" />
        <span className="mt-3 block max-w-full truncate text-[10px] font-semibold text-zinc-200">Ειδησεογραφικά</span>
        <span className="mt-1 block max-w-full truncate pr-10 text-xs font-black text-white group-hover:text-[#ccff00] sm:text-sm">{station.name}</span>
      </button>
      <button type="button" disabled={offline} onClick={toggle}
        aria-label={offline ? 'OFFLINE: ' + station.name : active ? 'Παύση: ' + station.name : 'Άκου τώρα: ' + station.name}
        title={offline ? 'OFFLINE' : active ? 'Παύση' : 'Άκου τώρα'}
        className={offline
          ? 'absolute bottom-3 right-3 z-20 cursor-not-allowed rounded-lg bg-red-600 px-2 py-1.5 text-[9px] font-black text-white'
          : 'absolute bottom-3 right-3 z-20 flex size-10 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white transition-colors hover:border-[#ccff00] hover:bg-[#ccff00] hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ccff00]'}>
        {offline ? 'OFFLINE' : active ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>
    </article>
  );
}

export default function HomeNewsFeed({
  stations = [], currentStation, isPlaying, onPlayStation, onPlayPause
}) {
  const [articles, setArticles] = useState([]);
  const [feedCategories, setFeedCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        const response = await fetch('/api/newsfeed', {signal: controller.signal});
        if (!response.ok) throw new Error('Οι ειδήσεις δεν είναι προσωρινά διαθέσιμες.');
        const data = await response.json();
        if (!controller.signal.aborted) {
          setArticles(Array.isArray(data.articles) ? data.articles : []);
          setFeedCategories(Array.isArray(data.categories)
            ? data.categories.filter(value => typeof value === 'string' && value.trim()) : []);
          setError('');
        }
      } catch {
        if (!controller.signal.aborted) setError('Οι ειδήσεις δεν είναι προσωρινά διαθέσιμες.');
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    refresh();
    // Same lightweight polling cadence as the complete Newsfeed page.
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 120000);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reloadKey]);

  const latest = useMemo(() => [...articles]
    .filter(article => article && article.key && article.title)
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)),
  [articles]);

  const categories = useMemo(() => {
    const result = new Set(feedCategories);
    latest.forEach(article => { if (article.category) result.add(article.category); });
    return [...result];
  }, [feedCategories, latest]);

  useEffect(() => {
    if (!loading && selectedCategory !== 'all' && !categories.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [categories, loading, selectedCategory]);

  const counts = useMemo(() => {
    const result = {};
    latest.forEach(article => {
      if (article.category) result[article.category] = (result[article.category] || 0) + 1;
    });
    return result;
  }, [latest]);

  // Always display at most ten real, most recent articles for the chosen category.
  const filtered = useMemo(() =>
    (selectedCategory === 'all' ? latest : latest.filter(item => item.category === selectedCategory))
      .slice(0, 10), [latest, selectedCategory]);

  // Respect existing admin position/popularity ranking and put offline radios last.
  const topNewsStations = useMemo(() => [...stations]
    .filter(station => station?._id &&
      (station.status === 'approved' || !station.status) && isNewsStation(station))
    .sort(compareCatalogPopularity)
    .slice(0, 4), [stations]);

  const allNewsLink = selectedCategory === 'all' ? '/newsfeed' :
    '/newsfeed?category=' + encodeURIComponent(selectedCategory);

  return (
    <section id="home-news" aria-labelledby="home-news-heading" className="min-w-0 scroll-mt-24 py-5 sm:py-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.17em] text-[#ccff00]">
            <Newspaper size={16} /> iRadiosGR News
          </p>
          <h2 id="home-news-heading" className="text-2xl font-black tracking-tight text-white sm:text-3xl">Οι τελευταίες ειδήσεις</h2>
          <p className="mt-2 text-sm text-zinc-400">Η επικαιρότητα με μια ματιά · Ανανέωση κάθε 10′</p>
        </div>
        <Link to="/newsfeed" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-black text-white transition-colors hover:border-[#ccff00]/50 hover:text-[#ccff00]">
          Όλες οι ειδήσεις <ArrowRight size={16} />
        </Link>
      </header>

      {topNewsStations.length > 0 && (
        <div className="mb-8 rounded-[26px] border border-white/10 bg-[#11151b] p-4 sm:p-5 md:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ccff00]/10 text-[#ccff00]">
              <Headphones size={21} />
            </span>
            <div>
              <h3 className="text-base font-black text-white sm:text-xl">Μήπως κουράστηκες να διαβάζεις;</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">
                Άκου την είδηση από τους {topNewsStations.length === 4 ? '4 κορυφαίους' : 'κορυφαίους'} ειδησεογραφικούς σταθμούς του iRadiosGR.
              </p>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
            {topNewsStations.map((station, index) => (
              <NewsRadioCard key={station._id} station={station} index={index}
                currentStation={currentStation} isPlaying={isPlaying}
                onPlayStation={onPlayStation} onPlayPause={onPlayPause} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-white sm:text-base">Κατηγορίες ειδήσεων</h3>
        <span className="text-xs font-semibold text-zinc-500">
          {filtered.length} {filtered.length === 1 ? 'άρθρο' : 'άρθρα'} από {selectedCategory === 'all' ? latest.length : counts[selectedCategory] || 0}
        </span>
      </div>
      <div className="-mx-4 mb-5 flex min-w-0 gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        role="group" aria-label="Φίλτρα κατηγοριών ειδήσεων στην αρχική">
        {[{name: 'all', label: 'Όλα', count: latest.length},
          ...categories.map(name => ({name, label: name, count: counts[name] || 0}))].map(option => {
          const active = selectedCategory === option.name;
          return <button key={option.name} type="button" aria-pressed={active}
            onClick={() => setSelectedCategory(option.name)}
            className={'inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-black transition-colors sm:text-sm ' +
              (active ? 'border-[#ccff00] bg-[#ccff00] text-black' : 'border-white/15 bg-white/[.045] text-zinc-300 hover:border-[#ccff00]/50 hover:text-white')}>
            <span>{option.label}</span>
            <span className={'rounded-full px-2 py-0.5 text-[10px] tabular-nums ' +
              (active ? 'bg-black/15 text-black' : 'bg-white/10 text-zinc-400')}>{option.count}</span>
          </button>;
        })}
      </div>

      {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-950/20 p-4 text-sm text-red-200">
        <span>{error}</span>
        <button type="button" onClick={() => {setLoading(true); setReloadKey(key => key + 1);}}
          className="inline-flex items-center gap-2 font-black text-white hover:text-[#ccff00]"><RefreshCw size={15} /> Επανάληψη</button>
      </div>}
      {loading && !latest.length ? (
        <div role="status" className="flex min-h-40 items-center justify-center gap-3 rounded-2xl border border-white/10 text-sm text-zinc-400">
          <RefreshCw size={20} className="animate-spin text-[#ccff00]" /> Φόρτωση ειδήσεων…
        </div>
      ) : !latest.length ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#12171b] p-5 text-center text-sm text-zinc-400">
          <Radio size={24} className="text-[#ccff00]/50" /> Δεν υπάρχουν διαθέσιμες ειδήσεις αυτή τη στιγμή.
        </div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-white/10 bg-[#12171b] p-8 text-center text-sm text-zinc-400">
          Δεν υπάρχουν ακόμη ειδήσεις στην κατηγορία «{selectedCategory}».
          <button type="button" onClick={() => setSelectedCategory('all')}
            className="mx-auto mt-3 block text-xs font-black text-[#ccff00]">Προβολή όλων</button>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {filtered.map(item => (
            <Article key={item.key} item={item} view="grid" now={now} source="" backTo="/" />
          ))}
        </div>
      )}
      {latest.length > 0 && <div className="mt-5 flex justify-center">
        <Link to={allNewsLink} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-[#151b21] px-6 text-xs font-black text-white transition-colors hover:border-[#ccff00]/50 hover:text-[#ccff00]">
          Περισσότερες ειδήσεις <ArrowRight size={16} />
        </Link>
      </div>}
    </section>
  );
}
