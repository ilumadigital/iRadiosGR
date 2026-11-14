import {useEffect, useState} from 'react';

// A single public SSE connection per mounted application, including the
// player-free Backoffice. Events carry only invalidation topics, not records.
export const LIVE_UPDATE_EVENT = 'iradios:content-updated';
export const LIVE_AREAS = Object.freeze(['stations', 'slides', 'news', 'ads', 'backoffice']);

function emitAreas(areas) {
  if (typeof window === 'undefined') return;
  const safe = [...new Set((Array.isArray(areas) ? areas : [])
    .filter(area => LIVE_AREAS.includes(area)))];
  if (safe.length) window.dispatchEvent(new CustomEvent(LIVE_UPDATE_EVENT, {detail:{areas:safe}}));
}

export function subscribeLiveUpdates(areas, callback) {
  if (typeof window === 'undefined') return () => {};
  const selected = new Set(Array.isArray(areas) ? areas : [areas]);
  const handle = event => {
    const changed = event.detail?.areas;
    if (Array.isArray(changed) && changed.some(area => selected.has(area))) callback();
  };
  window.addEventListener(LIVE_UPDATE_EVENT, handle);
  return () => window.removeEventListener(LIVE_UPDATE_EVENT, handle);
}

export function useLiveRevision(areas) {
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeLiveUpdates(areas, () => {
    setRevision(current => current + 1);
  }), [Array.isArray(areas) ? areas.join(',') : areas]);
  return revision;
}

export function startLiveUpdates() {
  if (typeof window === 'undefined') return () => {};
  let source = null;
  let previouslyConnected = false;
  let lastRevision = 0;
  let poller = null;
  const checkRevision = async () => {
    try {
      const response = await fetch('/api/live/revision', {cache:'no-store'});
      if (!response.ok) return;
      const data = await response.json();
      if (!Number.isSafeInteger(data?.revision)) return;
      if (data.revision !== lastRevision) {
        lastRevision = data.revision;
        emitAreas(LIVE_AREAS);
      }
    } catch { /* The next retry or SSE reconnect recovers the snapshot. */ }
  };
  const startPoll = () => {
    if (poller !== null) return;
    poller = window.setInterval(checkRevision, 10000);
    void checkRevision();
  };
  const stopPoll = () => {
    if (poller === null) return;
    window.clearInterval(poller);
    poller = null;
  };
  // If a reverse proxy buffers/rejects SSE, revision checks still keep the UI
  // fresh without a browser navigation or restarting the live player.
  startPoll();
  if (typeof EventSource === 'function') {
    // Same-origin, no credentials/tokens in the URL. Native automatic retry.
    source = new EventSource('/api/live/updates');
    source.addEventListener('ready', event => {
      stopPoll();
      try {
        const ready = JSON.parse(event.data);
        if (previouslyConnected) emitAreas(LIVE_AREAS); // Recover missed events.
        lastRevision = Number(ready.revision) || 0;
        previouslyConnected = true;
      } catch {
        emitAreas(LIVE_AREAS);
      }
    });
    source.addEventListener('error', startPoll);
    source.addEventListener('change', event => {
      try {
        const update = JSON.parse(event.data);
        if (!Number.isSafeInteger(update.revision) || update.revision <= lastRevision) return;
        lastRevision = update.revision;
        emitAreas(update.areas);
      } catch { /* Bad event cannot break the listener/player. */ }
    });
  }
  // Tabs suspended by iOS/Android resume with a fresh snapshot. This also
  // covers browsers where EventSource is unavailable.
  const revalidate = () => emitAreas(LIVE_AREAS);
  const onVisible = () => { if (!document.hidden) revalidate(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', revalidate);
  return () => {
    source?.close();
    stopPoll();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', revalidate);
  };
}
