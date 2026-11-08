import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Check, ChevronRight, Clock3, Cloud, CloudRain, CloudSun,
  MapPin, Menu, Mic, MicOff, Music2, Newspaper, Radio, Search, Snowflake,
  Sparkles, Sun, UserRound, X
} from 'lucide-react';
import { createSearchIndex, directVoiceMatch, groupedSearch, SEARCH_TYPES, spokenQuery } from '../utils/smartSearch';
import './smart-header.css';

const ICONS = { station: Radio, region: MapPin, genre: Music2, news: Newspaper };
const WEATHER_ICONS = { Sun, Cloud, CloudRain, Snowflake, CloudSun };
const equalizer = [1, 2, 3, 4, 5];

export default function TopBar({
  setIsMobileMenuOpen, stations = [], handleSearchResultClick,
  openSmartSearchRequest = 0, currentUser, weather = {}, onLogout
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [articles, setArticles] = useState([]);
  const [newsError, setNewsError] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechMessage, setSpeechMessage] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const [unreadCount,setUnreadCount]=useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const speechRef = useRef(null);
  const indexRef = useRef([]);
  const newsFetchAt = useRef(0);

  const index = useMemo(() => createSearchIndex(stations, articles), [stations, articles]);
  indexRef.current = index;
  const results = useMemo(() => groupedSearch(index, query, scope), [index, query, scope]);
  const visibleResults = results.visible;
  const suggestionCount = results.matches.length;
  const WeatherIcon = WEATHER_ICONS[weather?.icon] || CloudSun;
  const formattedTime = new Intl.DateTimeFormat('el-GR', { hour: '2-digit', minute: '2-digit' }).format(clock);
  const formattedDate = new Intl.DateTimeFormat('el-GR', { weekday: 'short', day: 'numeric', month: 'short' }).format(clock);
  const speechSupported = typeof window !== 'undefined'
    && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const close = (restoreFocus = false) => {
    speechRef.current?.abort();
    speechRef.current = null;
    setListening(false);
    setSpeechMessage('');
    setExpanded(false);
    setQuery('');
    setScope('all');
    setActiveIndex(-1);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const selectResult = item => {
    if (!item) return;
    close();
    if (item.type === 'station' && handleSearchResultClick) {
      handleSearchResultClick(item.stationId);
      return;
    }
    navigate(item.path);
  };

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(()=>{
    if(!currentUser?._id){setUnreadCount(0);return undefined;}
    let alive=true;
    const refresh=async()=>{
      try{
        const response=await fetch('/api/users/me/inbox/count',{
          headers:{Authorization:'Bearer '+(localStorage.getItem('iluma_token')||'')},
          cache:'no-store'});
        if(!response.ok)return;
        const data=await response.json();
        if(alive)setUnreadCount(Number(data.unread)||0);
      }catch{/* A notification outage must never affect playback. */}
    };
    refresh();
    const timer=setInterval(refresh,60000);
    const onVisibility=()=>{if(document.visibilityState==='visible')refresh();};
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('ir-inbox-changed',refresh);
    return()=>{
      alive=false;clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('ir-inbox-changed',refresh);
    };
  },[currentUser?._id,location.pathname,location.search]);

  useEffect(() => {
    if (!expanded) return undefined;
    inputRef.current?.focus();
    const outside = event => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [expanded]);

  useEffect(() => {
    if (!expanded || (articles.length && Date.now() - newsFetchAt.current < 120000)) return undefined;
    const controller = new AbortController();
    fetch('/api/newsfeed', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Newsfeed unavailable');
        return response.json();
      })
      .then(data => {
        if (controller.signal.aborted) return;
        setArticles(Array.isArray(data.articles) ? data.articles : []);
        newsFetchAt.current = Date.now();
        setNewsError(false);
      })
      .catch(error => {
        if (!controller.signal.aborted && error.name !== 'AbortError') setNewsError(true);
      });
    return () => controller.abort();
  }, [expanded, articles.length]);

  useEffect(() => {
    if (!expanded) return;
    setActiveIndex(-1);
  }, [query, scope, expanded]);

  useEffect(() => {
    if (expanded) close();
    // Reset the search whenever another page is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => () => {
    speechRef.current?.abort();
  }, []);

  const open = () => {
    setExpanded(true);
    setSpeechMessage('');
  };

  const startSpeech = () => {
    if (listening) {
      speechRef.current?.stop();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || !window.isSecureContext) {
      setSpeechMessage('Η φωνητική αναζήτηση απαιτεί συμβατό browser και ασφαλή σύνδεση HTTPS.');
      return;
    }
    speechRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = 'el-GR';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    speechRef.current = recognition;
    recognition.onstart = () => { setListening(true); setSpeechMessage('Σε ακούω…'); };
    recognition.onresult = event => {
      const heard = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim();
      if (!heard) return;
      const cleaned = spokenQuery(heard) || heard;
      setQuery(cleaned);
      setScope('all');
      const direct = directVoiceMatch(indexRef.current, heard);
      if (direct) {
        selectResult(direct);
      } else {
        setSpeechMessage('Επίλεξε το σωστό αποτέλεσμα από τη λίστα.');
        setExpanded(true);
      }
    };
    recognition.onerror = event => {
      const messages = {
        'not-allowed': 'Δεν δόθηκε άδεια μικροφώνου. Ενεργοποίησέ την από τον browser.',
        'service-not-allowed': 'Η αναγνώριση φωνής δεν επιτρέπεται σε αυτή τη συσκευή.',
        'no-speech': 'Δεν ακούστηκε ομιλία. Δοκίμασε ξανά.',
        'audio-capture': 'Δεν βρέθηκε διαθέσιμο μικρόφωνο.',
        network: 'Η υπηρεσία φωνής δεν είναι διαθέσιμη αυτή τη στιγμή.'
      };
      setSpeechMessage(messages[event.error] || 'Η φωνητική αναζήτηση δεν ολοκληρώθηκε.');
    };
    recognition.onend = () => {
      if (speechRef.current === recognition) speechRef.current = null;
      setListening(false);
    };
    try { recognition.start(); }
    catch { setSpeechMessage('Το μικρόφωνο δεν ξεκίνησε. Δοκίμασε ξανά.'); setListening(false); }
  };

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' && visibleResults.length) {
      event.preventDefault();
      setActiveIndex(old => (old + 1) % visibleResults.length);
    } else if (event.key === 'ArrowUp' && visibleResults.length) {
      event.preventDefault();
      setActiveIndex(old => (old <= 0 ? visibleResults.length - 1 : old - 1));
    } else if (event.key === 'Enter' && visibleResults.length) {
      event.preventDefault();
      selectResult(visibleResults[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  return (
    <header className={'ir-app-topbar ir-header sticky top-0 z-50 flex h-[70px] items-center gap-2 px-3 sm:px-5 lg:px-6 ' +
      (expanded ? 'ir-header--searching' : '')}>
      <div className="ir-header__left flex min-w-0 items-center gap-2">
        <button type="button" onClick={() => setIsMobileMenuOpen(true)} aria-label="Άνοιγμα μενού πλοήγησης"
          className="ir-header__mobile-menu ir-header__icon-button lg:hidden"><Menu size={21}/></button>
        <Link to="/" className="ir-header__mobile-brand flex min-w-0 items-center gap-2 lg:hidden" aria-label="iRadiosGR αρχική">
          <span className="ir-header__equalizer flex h-6 shrink-0 items-end gap-[3px]" aria-hidden="true">
            {equalizer.map(i => <span className={'ir-header__eq-bar ir-header__eq-bar--' + i} key={i}/>)}
          </span>
          <img src="/noicon-iradios-app-logo.png" alt="iRadiosGR" className="ir-header__brand-image h-6 w-auto max-w-[118px] object-contain"/>
        </Link>
        <div className="ir-header__desktop-intro hidden min-w-0 items-center gap-3 2xl:flex">
          <span className="ir-header__live-dot" aria-hidden="true"/>
          <span className="whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[.17em] text-zinc-400">Discover live radio</span>
        </div>
      </div>

      <div ref={wrapperRef} className={'ir-smart-search relative flex min-w-0 items-center ' + (expanded ? 'ir-smart-search--open' : '')}>
        <button ref={triggerRef} type="button" onClick={() => expanded ? close(true) : open()}
          aria-label={expanded ? 'Κλείσιμο αναζήτησης' : 'Άνοιγμα έξυπνης αναζήτησης'} aria-expanded={expanded}
          aria-controls="ir-smart-search-panel" className="ir-smart-search__trigger ir-header__icon-button">
          {expanded ? <X size={19}/> : <><Search size={20}/><Sparkles size={10} className="ir-smart-search__spark"/></>}
        </button>
        <div className="ir-smart-search__field-wrap">
          <div className="ir-smart-search__field">
            <Sparkles size={17} className="ir-smart-search__field-spark" aria-hidden="true"/>
            <input ref={inputRef} type="search" autoComplete="off" autoCorrect="off" spellCheck={false}
              value={query} onChange={event => setQuery(event.target.value)}
              onKeyDown={handleKeyDown} aria-label="Αναζήτηση σταθμών, περιοχών, μουσικής και ειδήσεων"
              aria-autocomplete="list" aria-controls="ir-smart-search-panel"
              aria-expanded={expanded && Boolean(query.trim())}
              aria-activedescendant={activeIndex >= 0 ? 'ir-smart-search-option-' + activeIndex : undefined}
              placeholder="Σταθμοί, περιοχές, μουσική, ειδήσεις…"/>
            <span className="ir-smart-search__ai-label" aria-hidden="true">AI</span>
            <button type="button" onClick={startSpeech} title={listening ? 'Διακοπή ακρόασης' : 'Φωνητική αναζήτηση'}
              aria-label={listening ? 'Διακοπή φωνητικής αναζήτησης' : 'Φωνητική αναζήτηση'}
              className={'ir-smart-search__mic ' + (listening ? 'ir-smart-search__mic--listening' : '')}>
              {listening ? <MicOff size={17}/> : <Mic size={17}/>}
            </button>
            {query && <button type="button" aria-label="Καθαρισμός" onClick={() => { setQuery(''); setSpeechMessage(''); inputRef.current?.focus(); }}
              className="ir-smart-search__clear"><X size={16}/></button>}
          </div>
        </div>

        {expanded && (
          <div id="ir-smart-search-panel" className="ir-smart-search__panel" role="region" aria-label="Έξυπνη αναζήτηση">
            <div className="ir-smart-search__panel-head">
              <span className="inline-flex items-center gap-2 text-xs font-black tracking-wide text-white"><Sparkles size={15} className="text-[#ccff00]"/> Smart Search</span>
              <span className="text-[10px] font-semibold text-zinc-500">{query.trim() ? suggestionCount + ' αποτελέσματα' : 'iRadiosGR'}</span>
            </div>
            <div className="ir-smart-search__scopes" role="group" aria-label="Φίλτρα αναζήτησης">
              {SEARCH_TYPES.map(type => (
                <button type="button" key={type.id} onClick={() => { setScope(type.id); inputRef.current?.focus(); }}
                  aria-pressed={scope === type.id} className={'ir-smart-search__scope ' + (scope === type.id ? 'ir-smart-search__scope--active' : '')}>
                  {type.label}
                </button>
              ))}
            </div>
            <div role="status" aria-live="polite" className="ir-smart-search__speech-status">
              {listening && <span className="ir-smart-search__listening-dot"/>}{speechMessage}
              {!speechMessage && !query && 'Γράψε τι ψάχνεις ή μίλησε στο μικρόφωνο.'}
            </div>
            {query.trim() ? (
              <div role="listbox" aria-label="Αποτελέσματα αναζήτησης" className="ir-smart-search__scroll custom-scrollbar">
                {results.groups.length ? results.groups.map(group => {
                  const GroupIcon = ICONS[group.id];
                  return (
                    <section key={group.id} aria-label={group.label} className="ir-smart-search__group">
                      <div className="ir-smart-search__group-label">
                        <span className="flex items-center gap-2"><GroupIcon size={14}/>{group.label}</span>
                        <span>{group.total}</span>
                      </div>
                      {group.items.map(item => {
                        const index = visibleResults.findIndex(entry => entry.id === item.id);
                        const SelectedIcon = ICONS[item.type];
                        return (
                          <button type="button" role="option" id={'ir-smart-search-option-' + index}
                            aria-selected={index === activeIndex} key={item.id}
                            onMouseEnter={() => setActiveIndex(index)} onClick={() => selectResult(item)}
                            className={'ir-smart-search__result ' + (activeIndex === index ? 'ir-smart-search__result--active' : '')}>
                            {item.image ? <img src={item.image} alt="" loading="lazy" className="ir-smart-search__result-image"/>
                              : <span className="ir-smart-search__result-icon"><SelectedIcon size={18}/></span>}
                            <span className="min-w-0 flex-1">
                              <span className="ir-smart-search__result-title">{item.label}</span>
                              <span className="ir-smart-search__result-subtitle">{item.subtitle}{item.offline ? ' · OFFLINE' : ''}</span>
                            </span>
                            <ChevronRight size={16} className="shrink-0 text-zinc-500"/>
                          </button>
                        );
                      })}
                    </section>
                  );
                }) : (
                  <p className="p-7 text-center text-xs leading-6 text-zinc-400">
                    Δεν βρέθηκε αντιστοιχία. Δοκίμασε διαφορετικό όνομα ή κατηγορία.
                    {scope === 'news' && newsError && <span className="mt-2 block text-amber-300">Οι ειδήσεις δεν φορτώθηκαν. Δοκίμασε ξανά.</span>}
                  </p>
                )}
              </div>
            ) : (
              <div className="ir-smart-search__empty">
                <span className="ir-smart-search__empty-icon"><Search size={24}/></span>
                <p>Βρες ακριβώς αυτό που θέλεις να ακούσεις ή να διαβάσεις.</p>
                <span className="text-[11px] text-zinc-500">Ραδιόφωνα · Πόλεις · Μουσικά είδη · Ειδήσεις</span>
              </div>
            )}
            <div className="ir-smart-search__footer"><Check size={13}/> Αποτελέσματα από το iRadiosGR · χωρίς εικασίες</div>
          </div>
        )}
      </div>

      <div className="ir-header__right ml-auto flex shrink-0 items-center gap-2 lg:gap-3">
        {currentUser&&<Link to="/profile?tab=inbox" aria-label={'Κέντρο ειδοποιήσεων'+(unreadCount?' · '+unreadCount+' μη αναγνωσμένες':'')}
          title="Notification Center" className="ir-header__icon-button ir-header__inbox-shortcut">
          <Bell size={18} className={unreadCount?'text-[#ccff00]':'text-zinc-200'}/>
          {unreadCount>0&&<span className="ir-header__inbox-count">{unreadCount>99?'99+':unreadCount}</span>}
        </Link>}
        <div className="ir-header__weather" title="Τοπικός καιρός">
          <WeatherIcon size={18} className="shrink-0 text-[#ccff00]"/>
          <span className="ir-header__weather-text">
            <span className="ir-header__weather-city">{weather?.city || 'Καιρός'}</span>
            <span className="ir-header__weather-temp">{Number.isFinite(weather?.temp) ? weather.temp + '°C' : '—°C'}</span>
          </span>
        </div>
        <div className="ir-header__clock" title={formattedDate}>
          <Clock3 size={15} className="text-[#ccff00]"/>
          <span className="ir-header__clock-time">{formattedTime}</span>
          <span className="ir-header__clock-date">{formattedDate}</span>
        </div>

        <div className="ir-header__account hidden items-center gap-2 lg:flex">
          {currentUser ? (
            <>

              <Link to="/profile" className="ir-header__profile" title="Το προφίλ μου">
                <UserRound size={17}/>
                <span className="hidden max-w-24 truncate 2xl:inline">{currentUser.fname || currentUser.username || 'Προφίλ'}</span>
              </Link>
              <button type="button" onClick={onLogout} className="ir-header__logout">Έξοδος</button>
            </>
          ) : (
            <>
              <Link to="/login" className="ir-header__login">Σύνδεση</Link>
              <Link to="/register" className="ir-header__register">Εγγραφή</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
