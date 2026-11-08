'use strict';
// Metadata is derived exclusively from approved DB stations.
// Client-supplied stream/customMeta URLs are never directly fetched.
const Station = require('../models/Station');
const { recordStationTrack } = require('./recordStationTrack');
const {statusFromNative,hydrateSharedAI} = require('./stageSmartTracks');
const Playlist = require('../models/StationPlaylist');
const {rememberNativeSong,clearInvalidNativeSong,rememberNativeShow,clearNativeShow,broadcastHint,snapshotSong} = require('./stageNativeNow');
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

// Native upstream metadata cache is exclusively for the background workers.
// AI overrides are intentionally NOT cached here: a manual result must appear
// to all listeners immediately and expire on its own four-minute timer.
async function readCachedNativeMetadata(station) {
  const key=String(station?._id||'');
  if(!key)return '';
  const now=Date.now(),existing=cache.get(key);
  if(existing&&existing.until>now)return existing.promise;
  const promise=readStationMetadata(station).then(async raw=>{
    // During a 4-minute manual recognition the AI result is explicitly the
    // on-air song; never move unrelated native metadata ahead of it in history.
    const manual=await hydrateSharedAI(station._id);
    const status=statusFromNative(raw,station.name);
    // Keep the most recently CONFIRMED song for instant home/profile reads.
    // A manual AI match can temporarily take playback precedence without
    // erasing native metadata or adding native rows ahead of that AI song.
    if(status==='valid'){
      await rememberNativeSong(station,raw);
      await clearNativeShow(station);
      if(manual?.kind!=='manual')await recordStationTrack(station,raw,{source:'station'});
    }else if(status==='invalid'){
      await clearInvalidNativeSong(station,raw);
      if(broadcastHint(raw,station.name))await rememberNativeShow(station,raw);
      else await clearNativeShow(station);
    }
    return raw;
  }).catch(()=>'');
  if(cache.size>300)cache.clear();
  cache.set(key,{promise,until:now+CACHE_MS});
  return promise;
}
async function stageMetadata(req,res){
  res.setHeader('Cache-Control','private, no-store');
  try{
    const stream=req.query.stream;
    const stationId=req.query.stationId;
    const validId=typeof stationId==='string'&&/^[a-f0-9]{24}$/i.test(stationId);
    const validStream=typeof stream==='string'&&stream.length>0&&stream.length<=4096;
    if(!validId&&!validStream)return res.status(400).json({error:'Invalid station identifier'});
    const station=await Station.findOne({
      status:'approved',
      ...(validId?{_id:stationId}:{stream})
    }).select('_id name stream metadata status').lean();
    if(!station)return res.status(404).json({title:'',source:'none',foundWithAI:false});
    // Fast path: a single MongoDB read. NEVER contact station/stream/metadata
    // hosts from an API read. Background workers prefetch every two minutes.
    const snapshot=await Playlist.findOne({stationId:station._id})
      .select('nativeNow currentAI nativeShow').lean();
    return res.json(snapshotSong(snapshot)||{title:'',source:'none',foundWithAI:false});
  }catch{
    return res.status(503).json({title:'',source:'none',foundWithAI:false});
  }
}

module.exports = {
  stageMetadata, readCachedNativeMetadata, readStationMetadata, cleanTitle, titleFromObject, titleFromText, titleFromIcy, metadataUrls
};
