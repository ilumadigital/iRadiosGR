'use strict';
// Metadata is derived exclusively from approved DB stations.
// Client-supplied stream/customMeta URLs are never directly fetched.
const Station = require('../models/Station');
const { readPublicUrl } = require('./stageSafeRadioFetch');

const cache = new Map();
const CACHE_MS = 15000;

function cleanTitle(value) {
  if (typeof value !== 'string') return '';
  const title = value
    .replace(/\[(?:Wz|V7|WD|II)\]/gi, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (!title || title.length > 300 || /^(unknown|[-. ]+)$/i.test(title)) return '';
  if (/<(?:html|head|body|script|!doctype)/i.test(title)) return '';
  return title;
}

function titleFromObject(data, mountPoint = '') {
  if (!data || typeof data !== 'object') return '';
  if (Array.isArray(data)) {
    for (const item of data) {
      const result = titleFromObject(item, mountPoint);
      if (result) return result;
    }
    return '';
  }

  if (Array.isArray(data.data) && data.data.length) {
    const first = data.data[0];
    const raw = cleanTitle(first?.rawmeta || first?.song);
    if (raw) return raw;
    const nested = titleFromObject(first?.track, mountPoint);
    if (nested) return nested;
  }

  if (data.icestats) {
    const source = data.icestats.source || data.icestats[mountPoint];
    if (source) {
      const sources = Array.isArray(source) ? source : [source];
      const matching = sources.find(s => s?.listenurl?.includes(mountPoint) && mountPoint);
      const candidate = matching || sources.find(s => s?.title);
      const found = cleanTitle(candidate?.title);
      if (found) return found;
    }
  }

  const artist = cleanTitle(data.artist?.name || data.artist || '');
  const song = cleanTitle(data.song?.title || data.song || data.track?.title || data.track || data.title || data.songtitle || data.StreamTitle || '');
  if (artist && song && !song.toLowerCase().startsWith(artist.toLowerCase() + ' - ')) {
    return cleanTitle(artist + ' - ' + song);
  }
  return song || artist;
}

function titleFromText(raw, mountPoint = '') {
  if (typeof raw !== 'string' || raw.length > 65536) return '';
  let data;
  try { data = JSON.parse(raw); }
  catch {
    const jsonp = raw.match(/^\s*updateStats_[a-zA-Z0-9_]+\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/);
    if (jsonp) {
      try { data = JSON.parse(jsonp[1]); } catch { /* not valid JSONP */ }
    }
  }
  if (data) return titleFromObject(data, mountPoint);
  if (/<(?:html|head|body|script|!doctype)/i.test(raw)) return '';
  return cleanTitle(raw.replace(/<[^>]{0,500}>/g, ' '));
}

function titleFromIcy(buffer, headers) {
  const interval = Number(headers['icy-metaint'] || 0);
  if (!Number.isSafeInteger(interval) || interval < 1 || interval >= buffer.length) return '';
  const bytes = buffer[interval] * 16;
  if (!bytes || interval + 1 + bytes > buffer.length) return '';
  const meta = buffer.subarray(interval + 1, interval + 1 + bytes).toString('utf8');
  const match = meta.match(/StreamTitle=['"]([^'"]*)['"]/i);
  return match ? cleanTitle(match[1]) : '';
}

function metadataUrls(station) {
  const stream = new URL(station.stream);
  const root = stream.origin;
  const mount = stream.pathname.replace(/\/$/, '');
  const urls = [];
  if (typeof station.metadata === 'string' && station.metadata.trim()) {
    urls.push(station.metadata.trim());
  }
  if (stream.hostname.includes('live24.gr') && mount) {
    urls.push('https://songs.live24.gr/live24stats/songs_list.xsl?mount=' + encodeURIComponent(mount));
  }
  if ((stream.hostname.includes('radiojar.com') || stream.hostname.includes('revma.com')) && mount) {
    urls.push('https://www.radiojar.com/api/stations/' + encodeURIComponent(mount.slice(1)) + '/now_playing/');
  }
  urls.push(root + '/currentsong?sid=1');
  urls.push(root + '/status-json.xsl');
  return [...new Set(urls)];
}

async function readStationMetadata(station) {
  if (!station?.stream) return '';
  let mount = '';
  try { mount = new URL(station.stream).pathname.replace(/\/$/, ''); }
  catch { return ''; }

  for (const url of metadataUrls(station)) {
    try {
      const remote = await readPublicUrl(url, { maxBytes: 65536, timeoutMs: 2500 });
      const type = String(remote.headers['content-type'] || '');
      if (type && !/json|text|xml|javascript|html/i.test(type)) continue;
      const title = titleFromText(remote.buffer.toString('utf8'), mount);
      if (title) return title;
    } catch { /* Missing metadata from one source; try next safely. */ }
  }

  // ICY fallback reads only a bounded part of the approved station stream.
  try {
    const remote = await readPublicUrl(station.stream, {
      headers: { 'Icy-MetaData': '1' },
      maxBytes: 524288, timeoutMs: 5000, allowPartialOnDeadline: true
    });
    return titleFromIcy(remote.buffer, remote.headers);
  } catch {
    return '';
  }
}

async function stageMetadata(req, res) {
  try {
    const stream = req.query.stream;
    const stationId = req.query.stationId;
    const validId = typeof stationId === 'string' && /^[a-f0-9]{24}$/i.test(stationId);
    const validStream = typeof stream === 'string' && stream.length > 0 && stream.length <= 4096;
    if (!validId && !validStream) return res.status(400).json({ error: 'Invalid station identifier' });

    const station = await Station.findOne({
      status: 'approved',
      ...(validId ? { _id: stationId } : { stream })
    }).select('_id stream metadata status').lean();
    if (!station) return res.status(404).json({ title: '' });

    const key = String(station._id);
    const existing = cache.get(key);
    if (existing && existing.until > Date.now()) {
      return res.json({ title: await existing.promise });
    }

    const promise = readStationMetadata(station).catch(() => '');
    if (cache.size > 300) cache.clear();
    cache.set(key, { promise, until: Date.now() + CACHE_MS });
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ title: await promise });
  } catch {
    return res.status(503).json({ title: '' });
  }
}

module.exports = {
  stageMetadata, cleanTitle, titleFromObject, titleFromText, titleFromIcy, metadataUrls
};
