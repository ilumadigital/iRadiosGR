import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock3, Disc3, Heart, Loader2, MoreHorizontal, Pause, Play, Radio, ScanSearch, Share2, Check, SignalHigh } from 'lucide-react';
import { formatFMFrequency } from '../utils/stationFrequency';
import FoundWithAI from './FoundWithAI';
import MusicServiceLinks from './MusicServiceLinks';

/**
 * The mobile-only station introduction. Playback, favorite state, recognition
 * and sharing are handled by StationProfile; this component never owns audio.
 */
export default function MobileStationShowcase({
  station, ambient, playing, onPlay, favorite, onFavorite, onShare, copied,
  currentUser, song, songText, foundWithAI, loadingMetadata, artwork,
  show, recognizing, onRecognize
}) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef(null);
  const offline = station.isOffline === true;
  const backgroundImage = station.cover || station.logo;
  const isActualCover = Boolean(station.cover);
  const title = song?.title || (!loadingMetadata && songText ? songText : '');
  const secondary = song?.artist || '';
  const showTitle = show?.title || '';
  const image = song?.title && artwork ? artwork : (show?.imageUrl || station.logo);

  useEffect(() => { setMoreOpen(false); }, [station._id]);
  useEffect(() => {
    if (!moreOpen) return undefined;
    const dismiss = event => {
      if (event.key === 'Escape' || (event.type === 'pointerdown' && !menuRef.current?.contains(event.target))) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [moreOpen]);

  const jumpToSchedule = () => {
    setMoreOpen(false);
    document.getElementById('ir-station-program')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="ir-station-mobile-showcase" style={{ '--ir-station-ambient': ambient }}
      aria-label={'Προφίλ σταθμού ' + station.name}>
      <div className={'ir-mobile-station-backdrop' + (isActualCover ? ' has-cover' : ' is-logo')} aria-hidden="true">
        <img src={backgroundImage} alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />
        <span className="ir-mobile-station-backdrop-glow" />
      </div>

      <div className="ir-mobile-station-toolbar">
        <button type="button" className="ir-mobile-station-nav-button" aria-label="Πίσω"
          onClick={() => navigate(-1)}><ArrowLeft size={21} /></button>
        <Link to="/" className="ir-mobile-station-brand" aria-label="iRadiosGR - Αρχική">
          <Radio size={18} strokeWidth={2.5} aria-hidden="true" />
          <span>iRadios<strong>GR</strong></span>
        </Link>
        <div className="ir-mobile-station-more-wrap" ref={menuRef}>
          <button type="button" className="ir-mobile-station-nav-button" aria-label="Περισσότερες ενέργειες"
            aria-expanded={moreOpen} aria-controls="ir-mobile-station-more"
            onClick={() => setMoreOpen(value => !value)}><MoreHorizontal size={22} /></button>
          {moreOpen && <div className="ir-mobile-station-more-menu" id="ir-mobile-station-more">
            <button type="button" onClick={jumpToSchedule}><Clock3 size={16} /> Πρόγραμμα σταθμού</button>
            <button type="button" onClick={event => { setMoreOpen(false); onRecognize(event); }} disabled={recognizing}>
              {recognizing ? <Loader2 className="animate-spin" size={16} /> : <ScanSearch size={16} />} Βρες το τραγούδι
            </button>
            <button type="button" onClick={() => { setMoreOpen(false); onShare(); }}><Share2 size={16} /> Κοινοποίηση</button>
          </div>}
        </div>
      </div>

      <div className="ir-mobile-station-identity">
        <div className="ir-mobile-station-logo-frame">
          <img src={station.logo} alt={'Λογότυπο ' + station.name}
            onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/iradios-app-logo.png'; }} />
        </div>
        <span className={'ir-mobile-station-status' + (offline ? ' is-offline' : '')}>
          <span aria-hidden="true" />{offline ? 'OFFLINE' : 'LIVE'}
        </span>
        <h1>{station.name}</h1>
        <p className="ir-mobile-station-slogan">{station.slogan || 'Άκου ζωντανά στο iRadiosGR'}</p>
        <div className="ir-mobile-station-genres">
          {station.genre && <span><Disc3 size={12} aria-hidden="true" />{station.genre}</span>}
          {station.secondaryGenre && <span>{station.secondaryGenre}</span>}
          {!station.secondaryGenre && station.frequency && <span>
            <SignalHigh size={12} aria-hidden="true" />{formatFMFrequency(station.frequency)}
          </span>}
        </div>
      </div>

      <div className="ir-mobile-station-actions">
        <button type="button" className={'ir-mobile-station-side-action' + (favorite ? ' is-active' : '')}
          aria-label={favorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
          aria-pressed={favorite} onClick={onFavorite}>
          <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
          <span>{favorite ? 'Αγαπημένο' : 'Αγαπημένα'}</span>
        </button>
        <button type="button" className={'ir-mobile-station-main-play' + (offline ? ' is-offline' : '')}
          onClick={onPlay} disabled={offline} aria-label={offline ? 'Ο σταθμός είναι εκτός σύνδεσης' : playing ? 'Παύση σταθμού' : 'Αναπαραγωγή σταθμού'}>
          {offline ? <span>OFF</span> : playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ir-mobile-station-play-symbol" />}
        </button>
        <button type="button" className="ir-mobile-station-side-action" onClick={onShare}
          aria-label="Κοινοποίηση σταθμού">
          {copied ? <Check size={18} /> : <Share2 size={18} />}
          <span>{copied ? 'Αντιγράφηκε' : 'Κοινοποίηση'}</span>
        </button>
      </div>

      <div className="ir-mobile-station-now-card">
        <img src={image} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = station.logo; }} />
        <div className="ir-mobile-station-now-text">
          <div className="ir-mobile-station-now-label">
            <span aria-hidden="true" className="ir-mobile-station-equalizer"><i/><i/><i/></span>
            {loadingMetadata ? 'Αναγνώριση…' : title ? 'Τώρα παίζει' : (showTitle ? 'Στον αέρα' : 'Ζωντανό ραδιόφωνο')}
            {foundWithAI && song && <FoundWithAI compact />}
          </div>
          {title ? <>
            <h2 title={title}>{title}</h2>
            {secondary && <p title={secondary}>{secondary}</p>}
          </> : showTitle ? <>
            <h2 title={showTitle}>{showTitle}</h2>
            {show?.host && <p>{show.host}</p>}
          </> : !currentUser ? (
            <button type="button" onClick={() => navigate('/login')} className="ir-mobile-station-login">
              Συνδέσου για NowPlaying
            </button>
          ) : <h2>{offline ? 'Προσωρινά εκτός σύνδεσης' : 'Συντονίσου για να ακούσεις'}</h2>}
        </div>
      </div>
      {song?.raw && !loadingMetadata && (
        <MusicServiceLinks raw={song.raw} stationName={station.name} compact/>
      )}
      {showTitle && title && <p className="ir-mobile-station-live-show">
        <Radio size={13} aria-hidden="true" /> Στον αέρα: <strong>{showTitle}</strong>
      </p>}
    </section>
  );
}
