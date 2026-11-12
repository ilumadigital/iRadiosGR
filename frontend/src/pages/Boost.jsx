import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Check,
  GripVertical, Info, Layers3, MapPin, Music2, Radio, RotateCcw,
  Rocket, Save, Search, SlidersHorizontal, Zap
} from 'lucide-react';
import { adminFetch } from '../utils/adminFetch';

const control = 'w-full min-w-0 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none transition focus:border-[#ccff00]/60 focus:ring-2 focus:ring-[#ccff00]/10';
const miniButton = 'inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:border-[#ccff00]/45 hover:text-[#ccff00] disabled:cursor-not-allowed disabled:opacity-25';
const durations = [
  [1, '1 ημέρα'], [3, '3 ημέρες'], [7, '7 ημέρες'], [14, '14 ημέρες'],
  [30, '1 μήνας'], [90, '3 μήνες'], [180, '6 μήνες'], [365, '1 έτος']
];
const stationId = station => String(station._id);
const matchesScope = (station, scope, value) => scope === 'global' ||
  (scope === 'genre' && (station.genre === value || station.secondaryGenre === value)) ||
  (scope === 'region' && (station.region === value || station.city === value));
const orderOf = (station, scope, value) => {
  const scopePosition = scope !== 'global' && station.rankings?.find(rank =>
    rank.scope === scope && rank.value === value)?.position;
  if (scopePosition != null && Number.isFinite(Number(scopePosition)) &&
      Number(scopePosition) > 0) return Number(scopePosition);
  const global = Number(station.position);
  return (scope === 'global' ? 0 : 1000000) +
    (Number.isFinite(global) && global >= 0 ? global : 999);
};
const initialOrder = (stations, scope, value) => [
  ...stations.filter(s => matchesScope(s, scope, value)).sort((a, b) =>
    orderOf(a, scope, value) - orderOf(b, scope, value) ||
    a.name.localeCompare(b.name, 'el')),
  ...stations.filter(s => !matchesScope(s, scope, value))
];
const boostSource= (station,now=Date.now()) => {
  const boost=station?.commercialBoost||{};
  const manualEndsAt=Date.parse(station?.boostExpiresAt);
  const manual=station?.boostStatus===true&&Number.isFinite(manualEndsAt)&&manualEndsAt>now;
  const purchased=boost.tier==='purchased'&&Number.isFinite(Date.parse(boost.endsAt))&&
    Date.parse(boost.endsAt)>now;
  const premium=boost.tier==='premium'||boost.premiumIncluded===true;
  return {manual,purchased,premium,active:manual||purchased||premium,
    manualExpired:station?.boostStatus===true&&!manual};
};
const exactTime=date=>date?new Intl.DateTimeFormat('el-GR',{
  dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Athens'
}).format(new Date(date)):'—';
const remaining = date => {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'Έληξε';
  const days = Math.floor(diff / 86400000);
  if (days) return `${days} ημέρ.`;
  return `${Math.max(1, Math.ceil(diff / 3600000))} ώρ.`;
};

export default function Boost({ API_URL = '/api', stations = [], refreshStations }) {
  const [scope, setScope] = useState('global');
  const [scopeValue, setScopeValue] = useState('');
  const [localStations, setLocalStations] = useState([]);
  const [rankSource, setRankSource] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [onlyBoosted, setOnlyBoosted] = useState(false);
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>{
    const timer=setInterval(()=>setClock(Date.now()),30000);
    return()=>clearInterval(timer);
  },[]);
  const [shown, setShown] = useState(60);
  const [positionInputs, setPositionInputs] = useState({});
  const [boostChanged, setBoostChanged] = useState(() => new Set());
  const [dirty, setDirty] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const draggedId = useRef(null);
  const approved = useMemo(() => rankSource.filter(s => s.status === 'approved'), [rankSource]);
  const genres = useMemo(() => [...new Set(approved.flatMap(s => [s.genre, s.secondaryGenre])
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el')), [approved]);
  const regions = useMemo(() => [...new Set(approved.flatMap(s => [s.region, s.city])
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el')), [approved]);

  // Overview data is limited and lacks ranking fields. Always load the full
  // authorized catalog from the dedicated backoffice endpoint.
  const reloadRankings = async () => {
    const response = await adminFetch('/api/backoffice/admin/station-ranking');
    const data = await response.json();
    if (!response.ok || !Array.isArray(data)) {
      throw new Error(data?.error || 'Δεν φορτώθηκαν οι σταθμοί κατάταξης.');
    }
    setRankSource(data);
  };
  useEffect(() => {
    let live = true;
    adminFetch('/api/backoffice/admin/station-ranking')
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data))
          throw new Error(data?.error || 'Αποτυχία φόρτωσης κατάταξης.');
        return data;
      }).then(data => { if (live) setRankSource(data); })
      .catch(error => { if (live) setLoadError(error.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  // New paid purchases may become active while the Admin remains on this page.
  // Refresh the read-only status without ever discarding unsaved manual edits.
  const dirtyRef=useRef(dirty);
  dirtyRef.current=dirty;
  useEffect(()=>{
    const timer=setInterval(()=>{
      if(dirtyRef.current)return;
      adminFetch('/api/backoffice/admin/station-ranking')
        .then(response=>response.ok?response.json():null)
        .then(data=>{
          if(!dirtyRef.current&&Array.isArray(data))setRankSource(data);
        }).catch(()=>{/* Preserve last known status on a network error. */});
    },60000);
    return()=>clearInterval(timer);
  },[]);

  // Props refresh and scope changes rebuild the local order from the saved scope.
  useEffect(() => {
    setLocalStations(initialOrder(approved, scope, scopeValue));
    setPositionInputs({});
    setBoostChanged(new Set());
    setDirty(false);
    setOrderDirty(false);
  }, [approved, scope, scopeValue]);

  const scopedStations = useMemo(() => localStations.filter(s =>
    matchesScope(s, scope, scopeValue)), [localStations, scope, scopeValue]);
  const scopePositions = useMemo(() =>
    new Map(scopedStations.map((station, index) => [stationId(station), index])),
    [scopedStations]);
  const searchKey = search.trim().toLocaleLowerCase('el');
  const matches = scopedStations.filter(s =>
    (!searchKey || [s.name, s.genre, s.secondaryGenre, s.region, s.city, s.frequency]
      .some(value => String(value || '').toLocaleLowerCase('el').includes(searchKey))) &&
    (!onlyBoosted || boostSource(s,clock).active));
  const visible = matches.slice(0, shown);
  useEffect(() => { setShown(60); }, [scope, scopeValue, search, onlyBoosted]);
  const boostedCount = scopedStations.filter(s=>boostSource(s,clock).active).length;
  const scopeLabel = scope === 'global' ? 'Όλο το δίκτυο' :
    scope === 'genre' ? `Κατηγορία · ${scopeValue}` : `Περιοχή · ${scopeValue}`;

  const chooseScope = (nextScope, nextValue) => {
    if (scope === nextScope && scopeValue === nextValue) return;
    if (dirty && !window.confirm('Υπάρχουν μη αποθηκευμένες αλλαγές. Να απορριφθούν για να αλλάξεις κατάταξη;')) return;
    setScope(nextScope);
    setScopeValue(nextValue);
    setSearch('');
    setOnlyBoosted(false);
    setNotice(null);
  };
  const reorder = (id, toIndex) => {
    const current = localStations.filter(s => matchesScope(s, scope, scopeValue));
    const source = current.findIndex(s => stationId(s) === String(id));
    const destination = Math.max(0, Math.min(current.length - 1, Number(toIndex)));
    if (source < 0 || !Number.isInteger(destination) || source === destination) return;
    const [selected] = current.splice(source, 1);
    current.splice(destination, 0, selected);
    setLocalStations([...current, ...localStations.filter(s => !matchesScope(s, scope, scopeValue))]);
    setDirty(true);
    setOrderDirty(true);
    setNotice(null);
  };
  const updateStation = (id, changes) => {
    setLocalStations(prev => prev.map(s => stationId(s) === String(id) ? { ...s, ...changes } : s));
    setBoostChanged(prev => new Set(prev).add(String(id)));
    setDirty(true);
    setNotice(null);
  };
  const toggleBoost = station => {
    const enabled = !boostSource(station).manual;
    const future = new Date(station.boostExpiresAt).getTime() > Date.now();
    updateStation(station._id, {
      boostStatus: enabled,
      boostExpiresAt: enabled ? (future ? station.boostExpiresAt :
        new Date(Date.now() + 86400000).toISOString()) : null
    });
  };
  const setDuration = (id, days) => {
    if (!days) return;
    updateStation(id, {
      boostStatus: true,
      boostExpiresAt: new Date(Date.now() + Number(days) * 86400000).toISOString()
    });
  };
  const commitPosition = (id, currentIndex) => {
    const draft = positionInputs[String(id)];
    if (draft === undefined) return;
    const parsed = Number(draft);
    if (!/^\d+$/.test(String(draft)) || !Number.isInteger(parsed) ||
        parsed < 1 || parsed > scopedStations.length) {
      setNotice({ error: true, text: `Η θέση πρέπει να είναι από 1 έως ${scopedStations.length}.` });
    } else if (parsed - 1 !== currentIndex) {
      reorder(id, parsed - 1);
    }
    setPositionInputs(prev => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
  };
  const onDrop = (event, targetId) => {
    event.preventDefault();
    const id = draggedId.current;
    draggedId.current = null;
    if (!id || id === targetId) return;
    // Reorder in the entire scope, never only in the searched subset.
    reorder(id, scopePositions.get(targetId) ?? -1);
  };
  const discard = () => {
    setLocalStations(initialOrder(approved, scope, scopeValue));
    setPositionInputs({});
    setBoostChanged(new Set());
    setDirty(false);
    setOrderDirty(false);
    setNotice(null);
  };
  const save = async () => {
    if (!dirty || saving || loading || loadError) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await adminFetch(`${API_URL}/admin/stations/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          scopeValue: scope === 'global' ? '' : scopeValue,
          updateOrder: orderDirty,
          // Always submit the complete scope. Searching or filtering is view-only.
          stationsData: scopedStations.map((station, index) => ({
            id: station._id, position: index + 1,
            // Do not overwrite boosts from a concurrent admin when only sorting.
            ...(boostChanged.has(stationId(station)) ? {
              boostStatus: Boolean(station.boostStatus),
              boostExpiresAt: station.boostExpiresAt || null
            } : {})
          }))
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Δεν αποθηκεύτηκε η κατάταξη.');
      setDirty(false);
      setOrderDirty(false);
      setBoostChanged(new Set());
      // Read back the server's final persisted order (and boost expirations).
      try { await reloadRankings(); }
      catch { /* The write succeeded; the next visit will reload saved state. */ }
      if (typeof refreshStations === 'function') {
        try { await refreshStations(); }
        catch { /* Backoffice overview refresh is best-effort. */ }
      }
      setNotice({ error: false, text: `Αποθηκεύτηκε η κατάταξη «${scopeLabel}» για ${scopedStations.length} σταθμούς.` });
    } catch (error) {
      setNotice({ error: true, text: error.message || 'Σφάλμα δικτύου.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-legacy-page mx-auto w-full max-w-[1600px] space-y-5 pb-24 text-white">
      {loading && <p role="status" className="text-sm text-zinc-400">Φόρτωση κατάταξης σταθμών…</p>}
      {loadError && <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
        {loadError} <button type="button" onClick={() => {
          setLoadError('');
          setLoading(true);
          reloadRankings().catch(error => setLoadError(error.message)).finally(() => setLoading(false));
        }} className="ml-2 font-bold underline">Επανάληψη</button>
      </div>}
      <header className="ir-glass relative overflow-hidden rounded-[30px] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-14 -top-20 size-64 rounded-full bg-[#ccff00]/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/20 bg-[#ccff00]/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#ccff00]">
              <Rocket size={14} /> Station Ranking Studio
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">Σειρά & Boost σταθμών</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Καθόρισε τη σειρά και δες ξεχωριστά τα πληρωμένα Global / Category,
              Premium και χειροκίνητα Admin Boosts, με την πραγματική διάρκεια.
              Οι χειροκίνητοι διακόπτες δεν αλλάζουν τις αγορές.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Σταθμοί</p>
              <p className="mt-1 text-2xl font-black tabular-nums">{scopedStations.length}</p>
            </div>
            <div className="rounded-2xl border border-[#ccff00]/20 bg-[#ccff00]/5 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ενεργά Boost</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-[#ccff00]">{boostedCount}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="ir-glass space-y-4 rounded-[28px] p-4 sm:p-5" aria-label="Επιλογή κατάταξης">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal size={17} className="text-[#ccff00]" /> Πού θέλεις να αλλάξεις τη σειρά;</h2>
          <span className="text-xs text-zinc-500">{scopeLabel}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/30 p-1.5">
          {[
            { id: 'global', name: 'Γενικά', Icon: Layers3 },
            { id: 'genre', name: 'Κατηγορία', Icon: Music2 },
            { id: 'region', name: 'Περιοχή', Icon: MapPin }
          ].map(({ id, name, Icon }) => (
            <button type="button" key={id} aria-pressed={scope === id}
              onClick={() => chooseScope(id, id === 'genre' ? (scope === id ? scopeValue : genres[0] || '') :
                id === 'region' ? (scope === id ? scopeValue : regions[0] || '') : '')}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-xs font-bold transition sm:text-sm ${scope === id
                ? 'bg-[#ccff00] text-black shadow-[0_8px_30px_rgba(204,255,0,.16)]'
                : 'text-zinc-400 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={16} /> {name}
            </button>
          ))}
        </div>
        {scope !== 'global' && (
          <label className="block max-w-xl">
            <span className="mb-1.5 block text-xs font-semibold text-zinc-400">
              {scope === 'genre' ? 'Επιλογή κατηγορίας' : 'Επιλογή περιοχής'}
            </span>
            <select className={control} value={scopeValue}
              onChange={event => chooseScope(scope, event.target.value)}>
              {(scope === 'genre' ? genres : regions).map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        <p className="flex items-start gap-2 text-xs leading-5 text-zinc-400">
          <Info size={15} className="mt-0.5 shrink-0 text-[#ccff00]" />
          {scope === 'global'
            ? 'Η γενική σειρά ισχύει στο δίκτυο και ως εφεδρική κατάταξη για τις σελίδες που δεν έχουν ειδική ρύθμιση.'
            : 'Οι αλλαγές εδώ επηρεάζουν μόνο τη συγκεκριμένη προβολή. Η γενική σειρά και οι άλλες κατηγορίες/περιοχές παραμένουν ανέπαφες.'}
        </p>
      </section>

      <section className="space-y-4" aria-label="Επεξεργασία σειράς">
        <div className="ir-glass grid gap-3 rounded-[24px] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="relative min-w-0">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Βρες σταθμό με όνομα, είδος ή περιοχή…" aria-label="Αναζήτηση σταθμών"
              className={control + ' pl-11'} />
          </div>
          <button type="button" aria-pressed={onlyBoosted}
            onClick={() => setOnlyBoosted(value => !value)}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-bold transition ${onlyBoosted
              ? 'border-[#ccff00]/40 bg-[#ccff00]/15 text-[#ccff00]'
              : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'}`}>
            <Zap size={16} /> {onlyBoosted ? 'Εμφάνιση όλων' : 'Μόνο Boost'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-xs text-zinc-400">
            <strong className="text-white">{matches.length}</strong> από {scopedStations.length} σταθμούς
            {(search || onlyBoosted) && ' · Η θέση αφορά ολόκληρη την επιλεγμένη κατάταξη.'}
          </p>
          {dirty && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <span className="size-2 rounded-full bg-amber-300" /> Μη αποθηκευμένες αλλαγές
          </span>}
        </div>

        <div className="space-y-2.5">
          {visible.map(station => {
            const index = scopePositions.get(stationId(station)) ?? -1;
            const state=boostSource(station,clock);
            const manualEnabled=Boolean(station.boostStatus);
            const manualTime=state.manual?remaining(station.boostExpiresAt):null;
            const paidTime=state.purchased?remaining(station.commercialBoost.endsAt):null;
            const id = stationId(station);
            return (
              <article key={id} onDragOver={event => event.preventDefault()}
                onDrop={event => onDrop(event, id)}
                className="group grid min-w-0 gap-3 rounded-[22px] border border-white/10 bg-white/[.035] p-3 transition hover:border-white/20 hover:bg-white/[.06] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-4">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <label htmlFor={`boost-position-${id}`} className="sr-only">Θέση του {station.name}</label>
                    <input id={`boost-position-${id}`} type="number" inputMode="numeric"
                      min="1" max={scopedStations.length} step="1"
                      title="Γράψε θέση και πάτησε Enter ή έξοδο από το πεδίο"
                      value={positionInputs[id] ?? index + 1}
                      onChange={event => setPositionInputs(prev => ({ ...prev, [id]: event.target.value }))}
                      onBlur={() => commitPosition(id, index)}
                      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                      className="h-12 w-16 rounded-xl border border-[#ccff00]/25 bg-[#ccff00]/10 text-center text-base font-black tabular-nums text-[#ccff00] outline-none focus:border-[#ccff00] sm:w-[70px]" />
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-500">/ {scopedStations.length}</span>
                </div>

                <div className="flex min-w-0 items-center gap-3">
                  {station.logo
                    ? <img src={station.logo} alt="" loading="lazy"
                        className="size-12 shrink-0 rounded-xl bg-white object-contain p-1 sm:size-14" />
                    : <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-900"><Radio size={23} /></div>}
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-white sm:text-base">{station.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      {[station.genre, station.region || station.city].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {state.purchased && <span className="inline-flex items-center gap-1 rounded-full border border-[#ccff00]/40 bg-[#ccff00]/10 px-2 py-1 text-[10px] font-bold text-[#d9ff70]"
                        title={'Πληρωμένο μέσω Billing · Λήξη: '+exactTime(station.commercialBoost.endsAt)}>
                        <Zap size={11}/> Paid {station.commercialBoost.placement==='global'?'Global':'Category'} · {paidTime}
                      </span>}
                      {state.premium && <span className="inline-flex items-center rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-1 text-[10px] font-bold text-violet-200">
                        Premium Boost
                      </span>}
                      {state.manual && <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-1 text-[10px] font-bold text-sky-200"
                        title={'Χειροκίνητο Admin Boost · Λήξη: '+exactTime(station.boostExpiresAt)}>
                        <Zap size={11}/> Admin Manual · {manualTime}
                      </span>}
                      {state.manualExpired && <span className="inline-flex items-center rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-1 text-[10px] font-bold text-rose-300">
                        Χειροκίνητο Boost ληγμένο / χωρίς λήξη
                      </span>}
                    </div>
                    {state.purchased && <p className="mt-1 text-[10px] text-zinc-400">
                      Λήξη πληρωμένου Boost: {exactTime(station.commercialBoost.endsAt)}
                    </p>}
                    {state.manual && <p className="mt-1 text-[10px] text-sky-200/75">
                      Λήξη χειροκίνητου Boost: {exactTime(station.boostExpiresAt)}
                    </p>}
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 sm:justify-end sm:border-0 sm:pt-0">
                  <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
                    <span className="text-[10px] font-semibold text-zinc-400">Manual</span>
                    <button type="button" role="switch" aria-checked={state.manual}
                      aria-label={`Χειροκίνητο Admin Boost για ${station.name}`}
                      title="Αλλάζει μόνο το χειροκίνητο Boost, ποτέ πληρωμένη αγορά"
                      onClick={() => toggleBoost(station)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${state.manual ? 'bg-[#ccff00]' : 'bg-zinc-700'}`}>
                      <span className={`absolute left-1 top-1 size-4 rounded-full bg-black transition-transform ${state.manual ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <select aria-label={`Διάρκεια χειροκίνητου Boost για ${station.name}`} value=""
                      onChange={event => setDuration(id, event.target.value)}
                      className="max-w-[130px] bg-transparent py-1 text-xs text-zinc-300 outline-none">
                      <option value="">Διάρκεια Boost</option>
                      {durations.map(([days, title]) => <option key={days} value={days}>{title}</option>)}
                    </select>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" className={miniButton} title="Στην κορυφή"
                      aria-label={`Μετακίνηση ${station.name} στην κορυφή`} disabled={!index}
                      onClick={() => reorder(id, 0)}><ArrowUpToLine size={16} /></button>
                    <button type="button" className={miniButton} title="Μία θέση πάνω"
                      aria-label={`Μετακίνηση ${station.name} πάνω`} disabled={!index}
                      onClick={() => reorder(id, index - 1)}><ArrowUp size={16} /></button>
                    <button type="button" className={miniButton} title="Μία θέση κάτω"
                      aria-label={`Μετακίνηση ${station.name} κάτω`}
                      disabled={index === scopedStations.length - 1}
                      onClick={() => reorder(id, index + 1)}><ArrowDown size={16} /></button>
                    <button type="button" className={miniButton} title="Στο τέλος"
                      aria-label={`Μετακίνηση ${station.name} στο τέλος`}
                      disabled={index === scopedStations.length - 1}
                      onClick={() => reorder(id, scopedStations.length - 1)}><ArrowDownToLine size={16} /></button>
                    <span draggable aria-hidden="true"
                      title="Σύρε για αλλαγή θέσης"
                      onDragStart={event => {
                        draggedId.current = id;
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', id);
                      }}
                      onDragEnd={() => { draggedId.current = null; }}
                      className="hidden cursor-grab rounded-lg p-1.5 text-zinc-500 hover:text-white lg:inline-flex">
                      <GripVertical size={19} />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
          {!visible.length && (
            <div className="ir-glass rounded-3xl p-12 text-center text-sm text-zinc-400">
              Δεν βρέθηκαν σταθμοί. Δοκίμασε άλλη αναζήτηση ή κατάταξη.
            </div>
          )}
          {matches.length > shown && <button type="button"
            onClick={() => setShown(value => value + 60)}
            className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:border-[#ccff00]/40 hover:text-[#ccff00]">
            Εμφάνιση περισσότερων ({matches.length - shown} ακόμη)
          </button>}
        </div>
      </section>

      <div className="sticky bottom-3 z-20 rounded-[23px] border border-white/15 bg-zinc-950/90 p-3 shadow-[0_14px_60px_rgba(0,0,0,.6)] backdrop-blur-2xl sm:bottom-5 sm:p-4">
        {notice && <p role={notice.error ? 'alert' : 'status'}
          className={`mb-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${notice.error
            ? 'bg-rose-500/10 text-rose-300' : 'bg-[#ccff00]/10 text-[#ccff00]'}`}>
          {notice.error ? <Info size={15} /> : <Check size={15} />}{notice.text}
        </p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{scopeLabel}</p>
            <p className="text-xs text-zinc-500">{dirty
              ? 'Έχεις αλλαγές που δεν αποθηκεύτηκαν.'
              : 'Όλες οι αλλαγές σε αυτήν την προβολή είναι αποθηκευμένες.'}</p>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <button type="button" onClick={discard} disabled={saving || !dirty}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-3 text-xs font-bold text-zinc-300 transition hover:bg-white/10 disabled:opacity-30 sm:px-4">
              <RotateCcw size={15} /> <span className="hidden sm:inline">Αναίρεση</span>
            </button>
            <button type="button" onClick={save} disabled={!dirty || saving || loading || Boolean(loadError)}
              className="ir-action-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40 sm:px-6">
              <Save size={16} /> {saving ? 'Αποθήκευση…' : 'Αποθήκευση σειράς'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
