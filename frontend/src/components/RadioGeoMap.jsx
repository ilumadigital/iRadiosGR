import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Globe2, MapPin, Play, RadioTower, SortDesc, X } from 'lucide-react';
import { formatFMFrequency } from '../utils/stationFrequency';
import {catalogStationInfo,compareCatalogPopularity,compareCatalogStations} from '../utils/catalogLive';
import { locationMapCenter, stationMapLocation } from '../utils/mapLocations';
import './RadioGeoMap.css';

// Ο renderer φορτώνεται μόνο όταν ο χρήστης ανοίγει προβολή χάρτη.
// Pinned open-source MapLibre ESM: δεν αλλάζουμε τις υπάρχουσες npm εξαρτήσεις/lockfile.
const MAPLIBRE_ESM = 'https://unpkg.com/maplibre-gl@6.17.0/dist/maplibre-gl.mjs';
const OPENFREEMAP_DARK = 'https://tiles.openfreemap.org/styles/dark';
let maplibrePromise;
function loadMapLibre() {
  if (!maplibrePromise) {
    maplibrePromise = import(/* @vite-ignore */ MAPLIBRE_ESM).catch(error => {
      maplibrePromise = null; // Επιτρέπει ξανά φόρτωση μετά από προσωρινή αποτυχία.
      throw error;
    });
  }
  return maplibrePromise;
}

function sortRadioStations(stations, sortBy, nowPlayingById, catalogClock, rankingScope, rankingValue) {
  return [...(stations || [])].sort((a,b)=>sortBy==='popularity'
    ? compareCatalogPopularity(a,b,nowPlayingById,catalogClock,rankingScope,rankingValue)
    : compareCatalogStations(a,b,nowPlayingById,catalogClock,sortBy,rankingScope,rankingValue));
}

export default function RadioGeoMap({
  stations = [],
  currentStation,
  onPlayStation,
  isPlaying,
  onPlayPause,
  centerName,
  nowPlayingById,
  catalogClock,
  sortMode,
  rankingScope = 'global',
  rankingValue = '',
  initialZoom = 6,
  showFilters = false,
  className = ''
}) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedPlace, setSelectedPlace] = useState('');
  const [showUnmapped, setShowUnmapped] = useState(false);
  const [sortBy, setSortBy] = useState('popularity');
  // In Region map view, share the parent page's selected sorting mode.
  // On the standalone map, keep the visible local sorting dropdown.
  const effectiveSortBy=showFilters?sortBy:(sortMode||sortBy);
  const sortedStations=useMemo(()=>
    sortRadioStations(stations,effectiveSortBy,nowPlayingById,catalogClock,rankingScope,rankingValue),
    [stations,effectiveSortBy,nowPlayingById,catalogClock,rankingScope,rankingValue]);
  const { places, unlocated } = useMemo(() => {
    const byCoordinates = new Map();
    const unknown = [];
    for (const station of sortedStations) {
      const location = stationMapLocation(station);
      const position = location?.position;
      if (!position) {
        unknown.push(station);
        continue;
      }
      const id = position[0].toFixed(4) + ':' + position[1].toFixed(4);
      if (!byCoordinates.has(id)) {
        byCoordinates.set(id, { id, lat: position[0], lng: position[1], cityNames: new Set(), approximate: false, stations: [] });
      }
      const group = byCoordinates.get(id);
      group.cityNames.add(location.label);
      group.approximate ||= location.precision === 'region';
      group.stations.push(station);
    }
    return {
      places: [...byCoordinates.values()].map(group => ({
        ...group,
        title: [...group.cityNames].join(' · ')
      })),
      unlocated: unknown
    };
  }, [sortedStations]);

  const activeGroup = showUnmapped
    ? { title: 'Σταθμοί χωρίς γεωγραφική θέση', stations: unlocated }
    : places.find(group => group.id === selectedPlace);
  const mappedStationsCount = sortedStations.length - unlocated.length;

  // Κάθε προβολή χρησιμοποιεί τον ίδιο MapLibre renderer και OpenFreeMap dark style.
  useEffect(() => {
    let cancelled = false;
    let map;
    loadMapLibre().then(maplibre => {
      if (cancelled || !canvasRef.current) return;
      const center = locationMapCenter(centerName);
      map = new maplibre.Map({
        container: canvasRef.current,
        style: OPENFREEMAP_DARK,
        center: [center[1], center[0]],
        zoom: initialZoom,
        minZoom: 2,
        maxZoom: 17,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false
      });
      mapRef.current = map;
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-left');
      map.on('load', () => { if (!cancelled) setReady(true); });
      map.on('click', () => {
        setSelectedPlace('');
        setShowUnmapped(false);
      });
    }).catch(() => {
      if (!cancelled) setLoadError('Δεν ήταν δυνατή η φόρτωση του χάρτη. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.');
    });
    return () => {
      cancelled = true;
      markerRefs.current.forEach(item => item.marker.remove());
      markerRefs.current = [];
      if (map) map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  // Ο χάρτης δημιουργείται μία φορά ανά mount. Οι μεταβολές κέντρου γίνονται ξεχωριστά.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const center = locationMapCenter(centerName);
    mapRef.current.flyTo({ center: [center[1], center[0]], zoom: initialZoom, duration: 850, essential: true });
    setSelectedPlace('');
    setShowUnmapped(false);
  }, [centerName, initialZoom, ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    let cancelled = false;
    loadMapLibre().then(maplibre => {
      if (cancelled || !mapRef.current || mapRef.current !== map) return;
      markerRefs.current.forEach(item => item.marker.remove());
      markerRefs.current = [];
      places.forEach(group => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'ir-radio-map-marker';
        element.setAttribute('aria-label', group.title + ': ' + group.stations.length + ' σταθμοί');
        element.title = group.title + ' · ' + group.stations.length + ' σταθμοί' + (group.approximate ? ' · Ενδεικτικό κέντρο περιοχής' : '');
        const dot = document.createElement('span');
        dot.className = 'ir-radio-map-dot';
        element.appendChild(dot);
        if (group.stations.length > 1) {
          const count = document.createElement('span');
          count.className = 'ir-radio-map-count';
          count.textContent = String(group.stations.length);
          element.appendChild(count);
        }
        element.addEventListener('click', event => {
          event.stopPropagation();
          setSelectedPlace(group.id);
          setShowUnmapped(false);
          map.flyTo({
            center: [group.lng, group.lat],
            zoom: Math.max(8, Math.min(12, map.getZoom())),
            duration: 850,
            essential: true
          });
        });
        const marker = new maplibre.Marker({ element, anchor: 'center', subpixelPositioning: true })
          .setLngLat([group.lng, group.lat])
          .addTo(map);
        markerRefs.current.push({ id: group.id, marker, element });
      });
    }).catch(() => {
      if (!cancelled) setLoadError('Η φόρτωση των σημείων στον χάρτη απέτυχε.');
    });
    return () => { cancelled = true; };
  }, [places, ready]);

  useEffect(() => {
    markerRefs.current.forEach(item => {
      item.element.classList.toggle('is-selected', item.id === selectedPlace && !showUnmapped);
    });
  }, [selectedPlace, showUnmapped, places]);

  function selectPlace(id) {
    setSelectedPlace(id);
    setShowUnmapped(false);
    const place = places.find(group => group.id === id);
    if (place && mapRef.current) {
      mapRef.current.flyTo({ center: [place.lng, place.lat], zoom: 9.5, duration: 900, essential: true });
    } else if (!id && mapRef.current) {
      const center = locationMapCenter(centerName);
      mapRef.current.flyTo({ center: [center[1], center[0]], zoom: initialZoom, duration: 900, essential: true });
    }
  }

  return (
    <section className={'ir-radio-geo-map relative isolate w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#0b1016] shadow-2xl sm:rounded-[32px] ' + className}
      aria-label="Διαδραστικός χάρτης ραδιοφωνικών σταθμών">
      <div ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Χάρτης OpenFreeMap" />

      {(!ready && !loadError) && (
        <div role="status" className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-[#0b1016] text-sm font-semibold text-zinc-400">
          Φόρτωση χάρτη…
        </div>
      )}
      {loadError && (
        <div role="alert" className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-[#0b1016] px-6 text-center">
          <MapPin size={26} className="text-[#ccff00]" />
          <p className="max-w-sm text-sm text-zinc-300">{loadError}</p>
          <button type="button" onClick={() => window.location.reload()}
            className="rounded-xl bg-[#ccff00] px-5 py-2.5 text-xs font-black text-black">Επαναφόρτωση</button>
        </div>
      )}

      {showFilters && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-[4] flex items-start justify-between gap-2 sm:inset-x-5 sm:top-5">
          <label className="pointer-events-auto flex min-w-0 max-w-[58%] flex-1 flex-col gap-1.5 rounded-2xl border border-white/15 bg-black/80 p-2.5 shadow-xl backdrop-blur-xl sm:max-w-[290px] sm:p-3">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-white"><Globe2 size={14} className="text-[#ccff00]" /> Radar Map</span>
            <select aria-label="Επιλογή περιοχής στον χάρτη" value={selectedPlace} onChange={event => selectPlace(event.target.value)}
              className="min-h-10 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-900 px-2.5 text-xs font-bold text-white outline-none focus:border-[#ccff00]/60">
              <option value="">Όλες οι περιοχές</option>
              {places.map(group => <option key={group.id} value={group.id}>{group.title} ({group.stations.length})</option>)}
            </select>
          </label>
          <label className="pointer-events-auto flex min-w-0 max-w-[40%] flex-1 flex-col gap-1.5 rounded-2xl border border-white/15 bg-black/80 p-2.5 shadow-xl backdrop-blur-xl sm:max-w-[196px] sm:p-3">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-zinc-300"><SortDesc size={14} /> Ταξινόμηση</span>
            <select aria-label="Ταξινόμηση σταθμών στον χάρτη" value={sortBy} onChange={event => setSortBy(event.target.value)}
              className="min-h-10 w-full min-w-0 rounded-xl border border-white/10 bg-zinc-900 px-2 text-xs font-bold text-white outline-none focus:border-[#ccff00]/60">
              <option value="popularity">Δημοτικότητα</option>
              <option value="completeness">Πληρότητα</option>
              <option value="frequency">Συχνότητα</option>
              <option value="alphabetical">Αλφαβητικά</option>
            </select>
          </label>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-12 left-3 z-[3] flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-2 sm:left-5">
        <span className="rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[10px] font-black text-white shadow-lg backdrop-blur-lg">
          <span className="text-[#ccff00]">{mappedStationsCount}</span> σταθμοί στον χάρτη
        </span>
        {unlocated.length > 0 && (
          <button type="button" onClick={() => { setShowUnmapped(true); setSelectedPlace(''); }}
            className="pointer-events-auto rounded-full border border-white/15 bg-black/75 px-3 py-1.5 text-[10px] font-black text-zinc-200 backdrop-blur-lg hover:border-[#ccff00]/60">
            + {unlocated.length} χωρίς τοποθεσία
          </button>
        )}
      </div>

      {activeGroup && (
        <aside className="ir-radio-map-panel absolute bottom-[80px] left-3 right-3 z-[6] max-h-[54%] overflow-hidden rounded-2xl border border-white/15 bg-[#080d12]/95 text-white shadow-2xl backdrop-blur-2xl sm:bottom-16 sm:left-5 sm:right-auto sm:w-[360px]"
          aria-label={'Ραδιόφωνα: ' + activeGroup.title}>
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#ccff00] px-3.5 py-3 text-black">
            <div className="flex min-w-0 items-center gap-2">
              <MapPin size={16} className="shrink-0" />
              <strong className="truncate text-xs font-black uppercase">{activeGroup.title}</strong>
              <span className="shrink-0 rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold">{activeGroup.stations.length}</span>
            </div>
            <button type="button" aria-label="Κλείσιμο λίστας σταθμών"
              onClick={() => { setSelectedPlace(''); setShowUnmapped(false); }}
              className="rounded-lg p-1.5 hover:bg-black/10"><X size={16} /></button>
          </div>
          {activeGroup.approximate && (
            <p className="border-b border-white/10 px-3 py-2 text-[10px] leading-relaxed text-zinc-400">
              Ενδεικτικό κέντρο περιοχής · δεν αποτελεί ακριβή θέση στούντιο ή πομπού.
            </p>
          )}
          <div className="custom-scrollbar max-h-[min(40vh,330px)] space-y-1 overflow-y-auto p-2">
            {activeGroup.stations.map(station => {
              const isCurrent = String(currentStation?._id) === String(station._id);
              const playing = isCurrent && isPlaying;
               const offline = station.isOffline === true;
              const live=nowPlayingById?catalogStationInfo(station,nowPlayingById[String(station._id)],catalogClock):null;
              return (
                <div key={station._id} className="flex items-center gap-2 rounded-xl p-2 transition-colors hover:bg-white/5">
                  <img alt="" src={station.logo || '/iradios-logo.png'} loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-lg border border-white/10 bg-white object-contain" />
                  <button type="button" onClick={() => navigate('/station/' + (station.slug || station._id))}
                    className="min-w-0 flex-1 text-left">
                    <span className={'block truncate text-xs font-black ' + (playing ? 'text-[#ccff00]' : 'text-white')}>{station.name}</span>
                    <span className="mt-1 block truncate text-[10px] text-zinc-400">
                      {station.transmissionType === 'Επίγειο' && station.frequency
                        ? formatFMFrequency(station.frequency) + ' · ' : ''}
                      {station.genre || station.region || 'Live Radio'}
                    </span>
                    {live?.song&&<span className="mt-1 block truncate text-[10px] text-[#e5f2c9]">
                      {live.song.artist} — {live.song.title}
                    </span>}
                    {(live?.host||live?.showTitle)&&<span className="mt-0.5 block truncate text-[10px] text-zinc-400">
                      Στον αέρα: {live.host||live.showTitle}
                    </span>}
                  </button>
                  <button type="button"
                    disabled={offline}
                     aria-label={(offline ? 'OFFLINE' : playing ? 'Παύση' : 'Αναπαραγωγή') + ' ' + station.name}
                    onClick={() => { if(!offline) (isCurrent ? onPlayPause?.() : onPlayStation?.(station)); }}
                    className={'flex h-10 shrink-0 items-center justify-center rounded-full transition-colors ' +
                      (offline ? 'w-[72px] cursor-not-allowed bg-red-600 text-white' : playing ? 'w-10 bg-[#ccff00] text-black' : 'w-10 bg-white/10 text-white hover:bg-[#ccff00] hover:text-black')}>
                    {offline ? <span className="text-[9px] font-black">OFFLINE</span> : playing ? <Activity size={17} className="animate-pulse" /> : <Play size={16} fill="currentColor" />}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>
      )}
      {!mappedStationsCount && !activeGroup && ready && (
        <div className="pointer-events-none absolute inset-x-4 top-[42%] z-[3] mx-auto max-w-xs rounded-2xl border border-white/15 bg-black/75 p-4 text-center text-xs text-zinc-300 backdrop-blur-lg">
          <RadioTower size={24} className="mx-auto mb-2 text-[#ccff00]" />
          Οι συγκεκριμένοι σταθμοί δεν έχουν δηλωμένη γεωγραφική θέση.
          {unlocated.length > 0 && <span className="mt-1 block">Άνοιξε τη λίστα «χωρίς τοποθεσία» για να τους ακούσεις.</span>}
        </div>
      )}
    </section>
  );
}
