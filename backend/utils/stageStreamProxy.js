'use strict';

// Staging radio streaming only. Never proxy arbitrary user-supplied URLs.
// Only approved stations are eligible; every upstream DNS hop is pinned to
// a verified public IPv4 address, including redirects.
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const Station = require('../models/Station');

const BLOCKED_PORTS = new Set([
  21,22,23,25,53,111,135,139,445,1433,2375,2376,3306,3389,
  5432,5601,5672,5984,6379,6443,8500,9042,9090,9200,9300,
  11211,15672,27017,27018,27019
]);

function isPublicIPv4(value) {
  if (net.isIP(value) !== 4) return false;
  const [a,b,c] = value.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function parseRadioUrl(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 4096)
    throw new Error('Invalid stream URL');
  let u;
  try { u = new URL(raw); } catch { throw new Error('Invalid stream URL'); }
  if (!['http:','https:'].includes(u.protocol)) throw new Error('Unsupported stream protocol');
  if (u.username || u.password || !u.hostname) throw new Error('Invalid stream host');
  if (u.hostname === 'localhost' || u.hostname.endsWith('.localhost') ||
      u.hostname.endsWith('.local') || u.hostname.endsWith('.internal'))
    throw new Error('Private stream hostname');
  const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535 || BLOCKED_PORTS.has(port))
    throw new Error('Disallowed stream port');
  if (net.isIP(u.hostname) === 6 || u.hostname.startsWith('['))
    throw new Error('IPv6 streams not enabled');
  if (net.isIP(u.hostname) === 4 && !isPublicIPv4(u.hostname))
    throw new Error('Non-public stream IP');
  u.hash = '';
  return u;
}

async function pinnedPublicIPv4(hostname) {
  if (net.isIP(hostname) === 4) {
    if (!isPublicIPv4(hostname)) throw new Error('Non-public stream IP');
    return hostname;
  }
  const entries = await dns.lookup(hostname, {all:true,verbatim:true});
  if (!entries.length || entries.some(x => x.family === 4 && !isPublicIPv4(x.address)))
    throw new Error('Non-public stream DNS');
  const ipv4 = entries.find(x => x.family === 4 && isPublicIPv4(x.address));
  if (!ipv4) throw new Error('No public IPv4 for stream');
  return ipv4.address;
}

async function openStream(target, res, redirects) {
  const url = parseRadioUrl(target);
  const pinned = await pinnedPublicIPv4(url.hostname);
  if (res.destroyed || res.writableEnded) return;
  return new Promise((resolve,reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const upstream = transport.get(url, {
      lookup: (_host,_opts,cb) => cb(null,pinned,4),
      headers: {'User-Agent':'iRadiosGR-Staging-Radio/1.0',
                'Icy-MetaData':'0','Accept':'audio/*,application/ogg,*/*;q=0.5'}
    });
    const onClose = () => upstream.destroy();
    res.once('close',onClose);
    upstream.setTimeout(15000,()=>upstream.destroy(new Error('Stream timeout')));
    upstream.once('error',reject);
    upstream.once('response', remote => {
      upstream.setTimeout(30000,()=>upstream.destroy(new Error('Stream stalled')));
      const status = remote.statusCode || 502;
      if (status >= 300 && status < 400 && remote.headers.location) {
        remote.resume();
        res.removeListener('close',onClose);
        if (redirects <= 0) return reject(new Error('Too many redirects'));
        let next;
        try {next = new URL(remote.headers.location,url).toString();}
        catch {return reject(new Error('Invalid redirect'));}
        return resolve(openStream(next,res,redirects-1));
      }
      if (status !== 200 && status !== 206) {
        remote.resume();
        res.removeListener('close',onClose);
        return reject(new Error('Upstream status '+status));
      }
      const type = String(remote.headers['content-type'] || 'audio/mpeg').split(';')[0].trim().toLowerCase();
      const allowed = type.startsWith('audio/') ||
        ['application/ogg','application/octet-stream','application/vnd.apple.mpegurl','application/x-mpegurl'].includes(type);
      if (!allowed) {
        remote.destroy();
        res.removeListener('close',onClose);
        return reject(new Error('Unexpected upstream content type'));
      }
      res.statusCode = 200;
      res.setHeader('Content-Type',type);
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Accel-Buffering','no');
      res.setHeader('X-Content-Type-Options','nosniff');
      remote.pipe(res);
      remote.once('end',resolve);
      remote.once('error',reject);
      res.once('close',resolve);
    });
  });
}

// Log only diagnostic categories, never station URLs or credentials.
function safeFailureCategory(err) {
  const code = String(err && err.code || '');
  if (/^[A-Z][A-Z0-9_]{2,60}$/.test(code)) return code;
  const msg = String(err && err.message || '');
  if (/^Upstream status [0-9]{3}$/.test(msg)) return 'UPSTREAM_HTTP_' + msg.slice(-3);
  if (msg === 'Unexpected upstream content type') return 'UNSUPPORTED_CONTENT_TYPE';
  if (msg === 'Too many redirects') return 'TOO_MANY_REDIRECTS';
  if (msg === 'Invalid redirect') return 'INVALID_REDIRECT';
  if (msg === 'Stream timeout' || msg === 'Stream stalled') return 'UPSTREAM_TIMEOUT';
  if (/Non-public stream|Private stream|Disallowed stream|IPv6 streams/.test(msg)) return 'BLOCKED_PRIVATE_TARGET';
  if (msg === 'No public IPv4 for stream') return 'DNS_NO_PUBLIC_IPV4';
  return 'OTHER_UPSTREAM_FAILURE';
}

async function stageStreamProxy(req,res) {
  const raw = req.query.url;
  try {
    const target = parseRadioUrl(raw);
    const approved = await Station.exists({
      status:'approved', $or:[{stream:raw},{streamUrl:raw}]
    });
    if (!approved) return res.status(403).json({error:'Stream not assigned to an approved station'});
    await openStream(target.toString(),res,4);
  } catch(err) {
    const category = safeFailureCategory(err);
    console.warn('[STAGE_RADIO_PROXY] ' + category);
    if(res.headersSent) return res.destroy();
    const invalid = /Invalid stream|Unsupported stream|Private stream|Disallowed stream|IPv6 streams|Non-public stream|No public IPv4/.test(err.message);
    res.status(invalid?400:502).json({error:invalid?'Disallowed stream target':'Radio stream unavailable'});
  }
}

module.exports = {stageStreamProxy,isPublicIPv4,parseRadioUrl};
