'use strict';

// Public, payload-free invalidations. This is deliberately independent of the
// legacy Socket.IO device/playback channel, which is blocked on public staging.
// A connected browser refetches its own authorized data after the DB write.
const clients = new Set();
let revision = 0;
const HEARTBEAT_MS = 20_000;
const TOPICS = ['stations', 'slides', 'news', 'ads', 'backoffice'];

function areasForMutation(method, pathname) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return [];
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '');
  // Exclude public impression/click/audio telemetry, uploads, preview or
  // diagnostics: these are not catalog/configuration changes.
  if (/^\/api\/(?:ads|banners)\/[0-9a-f]{24}\/(?:click|impression|completed|skipped)$/i.test(path)) return [];
  if (/^\/api\/backoffice\/(?:stream-diagnostics|widget-previews)(?:\/|$)/.test(path) ||
      /\/schedule-feed\/preview$/.test(path) || /\/home-slides\/upload$/.test(path)) return [];

  if (/^\/api\/(?:admin\/stations(?:\/|$)|stations(?:\/|$)|broadcaster\/stations(?:\/|$)|backoffice\/stations(?:\/|$))/.test(path)) {
    // Station-specific contact / playback metrics are not administrative writes.
    if (/\/contact$|\/recognize(?:-proxy)?$|\/playlist$/.test(path)) return [];
    return ['stations', 'backoffice'];
  }
  if (/^\/api\/admin\/home-slides(?:\/|$)/.test(path)) return ['slides', 'backoffice'];
  if (/^\/api\/admin\/newsfeed(?:\/|$)/.test(path)) return ['news', 'backoffice'];
  if (/^\/api\/admin\/promoted-stations(?:\/|$)/.test(path)) return ['stations', 'ads', 'backoffice'];
  if (/^\/api\/(?:admin\/ads|admin\/banners|banners\/admin|admin\/agency-ad-revisions|admin\/advertising|advertising|agency)(?:\/|$)/.test(path)) return ['ads', 'backoffice'];
  if (/^\/api\/backoffice(?:\/|$)/.test(path)) return ['backoffice'];
  if (/^\/api\/admin(?:\/|$)/.test(path)) return ['backoffice'];
  return [];
}

function publish(areas) {
  const safe = [...new Set((Array.isArray(areas) ? areas : []).filter(area => TOPICS.includes(area)))];
  if (!safe.length) return null;
  const payload = {revision: ++revision, areas: safe};
  const message = 'id: ' + revision + '\nevent: change\ndata: ' + JSON.stringify(payload) + '\n\n';
  for (const client of clients) {
    try { client.write(message); } catch { clients.delete(client); }
  }
  return payload;
}

function stream(req, res) {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff'
  });
  res.flushHeaders?.();
  res.write('retry: 2500\nevent: ready\ndata: ' + JSON.stringify({revision}) + '\n\n');
  clients.add(res);
  const keepalive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch { close(); }
  }, HEARTBEAT_MS);
  keepalive.unref?.();
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    clearInterval(keepalive);
    clients.delete(res);
  }
  req.on('close', close);
  res.on('close', close);
}

function version(_req, res) {
  res.set('Cache-Control','no-store');
  res.json({revision});
}

// Express middleware must precede all mutation routers. 2xx finish is emitted
// only once after the handler has completed (not on rejected/failed requests).
function captureSuccessfulMutation(req, res, next) {
  const path = (req.baseUrl || '') + req.path;
  const areas = areasForMutation(req.method, path);
  if (areas.length) {
    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) publish(areas);
    });
  }
  next();
}

module.exports = {stream, version, publish, areasForMutation, captureSuccessfulMutation};
