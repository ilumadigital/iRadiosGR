'use strict';
// Stage-only ACRCloud proxy: authenticated, approved station, strict public
// stream fetching, bounded capture, and a small per-user request quota.
const crypto = require('node:crypto');
const axios = require('axios');
const FormData = require('form-data');
const Station = require('../models/Station');
const { readPublicUrl } = require('./stageSafeRadioFetch');

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_CALLS = 3;

function validAcrHost(value) {
  return typeof value === 'string' &&
    value.length <= 253 &&
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.acrcloud\.com$/i.test(value);
}

function allowAcrRequest(userId) {
  const now = Date.now();
  if (attempts.size > 4096) attempts.clear();
  const record = attempts.get(userId);
  const state = !record || now - record.start >= WINDOW_MS
    ? { start: now, count: 0 } : record;
  if (state.count >= MAX_CALLS) return false;
  state.count++;
  attempts.set(userId, state);
  return true;
}

async function stageRecognizeProxy(req, res) {
  if (process.env.STAGE_ENABLE_ACRCLOUD !== '1') {
    return res.status(503).json({ error: 'Το ACRCloud δεν έχει ενεργοποιηθεί στο staging.' });
  }

  const { ACRCLOUD_HOST: host, ACRCLOUD_ACCESS_KEY: key, ACRCLOUD_ACCESS_SECRET: secret } = process.env;
  if (!validAcrHost(host) || !key || !secret) {
    return res.status(503).json({ error: 'Λείπει ασφαλής ρύθμιση ACRCloud στον staging server.' });
  }
  const stationId = req.body?.stationId;
  if (typeof stationId !== 'string' || !/^[a-f0-9]{24}$/i.test(stationId)) {
    return res.status(400).json({ error: 'Επιλέξτε έναν έγκυρο ραδιοφωνικό σταθμό.' });
  }

  try {
    const station = await Station.findOne({ _id: stationId, status: 'approved' })
      .select('stream status').lean();
    if (!station?.stream) {
      return res.status(404).json({ error: 'Ο σταθμός δεν βρέθηκε.' });
    }
    const userId = String(req.user?._id || '');
    if (!userId) return res.status(401).json({ error: 'Απαιτείται σύνδεση.' });
    if (!allowAcrRequest(userId)) {
      res.setHeader('Retry-After', '900');
      return res.status(429).json({ error: 'Πάρα πολλές αναγνωρίσεις. Δοκιμάστε αργότερα.' });
    }

    const sample = await readPublicUrl(station.stream, {
      maxBytes: 600000,
      timeoutMs: 9000,
      allowPartialOnDeadline: true,
      headers: { 'Icy-MetaData': '0', 'Accept': 'audio/*,application/octet-stream' }
    });
    const type = String(sample.headers['content-type'] || 'audio/mpeg').toLowerCase();
    if (!type.startsWith('audio/') &&
        !/^(application\/ogg|application\/octet-stream)(;|$)/.test(type)) {
      return res.status(502).json({ error: 'Ο σταθμός δεν επέστρεψε αναγνωρίσιμο audio.' });
    }
    if (sample.buffer.length < 16000) {
      return res.status(502).json({ error: 'Δεν υπήρχε αρκετό δείγμα ήχου.' });
    }

    const endpoint = '/v1/identify';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha1', secret)
      .update(['POST', endpoint, key, 'audio', '1', timestamp].join('\n'))
      .digest('base64');

    const form = new FormData();
    const ext = type.includes('ogg') ? 'ogg' : type.includes('aac') ? 'aac' : 'mp3';
    form.append('sample', sample.buffer, { filename: 'sample.' + ext });
    form.append('access_key', key);
    form.append('data_type', 'audio');
    form.append('signature_version', '1');
    form.append('signature', signature);
    form.append('sample_bytes', sample.buffer.length);
    form.append('timestamp', timestamp);

    const identified = await axios.post('https://' + host + endpoint, form, {
      headers: form.getHeaders(),
      maxRedirects: 0,
      timeout: 12000,
      maxBodyLength: 1048576,
      maxContentLength: 131072
    });
    return res.json(identified.data);
  } catch (error) {
    const upstreamStatus = error?.response?.status;
    console.warn('[STAGE_ACRCLOUD] Recognition failed', upstreamStatus ? 'upstream HTTP ' + upstreamStatus : 'upstream unavailable');
    return res.status(502).json({ error: 'Η αναγνώριση δεν ολοκληρώθηκε. Ελέγξτε το stream και τις ρυθμίσεις ACRCloud.' });
  }
}

module.exports = { stageRecognizeProxy, validAcrHost };
