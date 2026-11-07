'use strict';
// Network fetch for stage radio metadata and short recognition samples.
// Every URL (including redirect targets) is parsed, public IPv4 checked, and
// DNS pinned before connecting. Nothing here can fetch localhost/VPS services.
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const net = require('node:net');
const { parseRadioUrl, isPublicIPv4, createPinnedLookup } = require('./stageStreamProxy');

async function pinnedPublicIPv4(hostname) {
  if (net.isIP(hostname) === 4) {
    if (!isPublicIPv4(hostname)) throw new Error('Non-public IPv4');
    return hostname;
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(a => a.family === 4 && !isPublicIPv4(a.address))) {
    throw new Error('Non-public DNS target');
  }
  const entry = addresses.find(a => a.family === 4 && isPublicIPv4(a.address));
  if (!entry) throw new Error('No public IPv4 target');
  return entry.address;
}

async function readPublicUrl(raw, options = {}) {
  const {
    headers = {}, maxBytes = 65536, timeoutMs = 4500, redirects = 3,
    allowPartialOnDeadline = false
  } = options;
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 1048576) {
    throw new Error('Invalid byte limit');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 15000) {
    throw new Error('Invalid timeout');
  }

  const url = parseRadioUrl(raw);
  const ip = await pinnedPublicIPv4(url.hostname);
  return new Promise((resolve, reject) => {
    let settled = false;
    let receivedBytes = 0;
    let completePartial = null;
    let req;
    // A true wall-clock deadline is necessary for never-ending radio streams.
    const deadline = setTimeout(() => {
      if (allowPartialOnDeadline && receivedBytes >= 16000 && completePartial) {
        completePartial();
        req?.destroy();
      } else {
        req?.destroy(new Error('Upstream deadline exceeded'));
      }
    }, timeoutMs);
    const finish = (error, value) => {
      clearTimeout(deadline);
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };

    const transport = url.protocol === 'https:' ? https : http;
    req = transport.get(url, {
      family: 4,
      autoSelectFamily: false,
      lookup: createPinnedLookup(ip),
      headers: {
        'User-Agent': 'iRadiosGR-stage-metadata/1.0',
        'Accept': '*/*',
        ...headers
      }
    }, remote => {
      const status = remote.statusCode || 0;
      if (status >= 300 && status < 400 && remote.headers.location) {
        remote.resume();
        if (redirects <= 0) return finish(new Error('Too many redirects'));
        let next;
        try { next = new URL(remote.headers.location, url).toString(); }
        catch { return finish(new Error('Invalid redirect')); }
        readPublicUrl(next, { ...options, redirects: redirects - 1 })
          .then(value => finish(null, value), finish);
        return;
      }

      if (status !== 200 && status !== 206) {
        remote.resume();
        return finish(new Error('Upstream HTTP ' + status));
      }

      const chunks = [];
      const completed = () => finish(null, {
        buffer: Buffer.concat(chunks),
        headers: remote.headers,
        status
      });
      completePartial = completed;
      remote.on('data', chunk => {
        if (settled) return;
        const room = maxBytes - receivedBytes;
        if (room > 0) {
          const segment = chunk.subarray(0, room);
          chunks.push(segment);
          receivedBytes += segment.length;
        }
        if (receivedBytes >= maxBytes) {
          completed();
          req.destroy();
        }
      });
      remote.once('end', completed);
      remote.once('error', error => finish(error));
      remote.once('aborted', () => finish(new Error('Upstream aborted')));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Upstream timed out')));
    req.once('error', error => finish(error));
  });
}

module.exports = { readPublicUrl, pinnedPublicIPv4 };
