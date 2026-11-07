'use strict';
// Offline tests; no radio network traffic, DB, API key, or ACRCloud usage.
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const station = {
  _id: '0123456789abcdef01234567',
  status: 'approved',
  stream: 'https://radio.example.com/live',
  metadata: 'https://meta.example.com/now.json'
};
const upstreamUrls = [];

Module._load = function(name, parent, isMain) {
  const from = String(parent?.filename || '');
  if (name === '../models/Station' &&
      /stage(StreamProxy|Metadata|Acrcloud)\.js$/.test(from)) {
    return { findOne: () => ({
      select: () => ({ lean: async () => station })
    }), exists: async () => true };
  }
  if (name === './recordStationTrack' && from.endsWith('stageMetadata.js')) {
    return { recordStationTrack: async () => true };
  }
  if (name === './stageSafeRadioFetch' && from.endsWith('stageMetadata.js')) {
    return { readPublicUrl: async url => {
      upstreamUrls.push(url);
      return { headers: { 'content-type': 'application/json' },
        buffer: Buffer.from('{"artist":"Artist","title":"Track"}') };
    } };
  }
  if (name === './stageSafeRadioFetch' && from.endsWith('stageAcrcloud.js')) {
    return { readPublicUrl: async () => { throw new Error('Network calls forbidden'); } };
  }
  if (from.endsWith('stageAcrcloud.js') && name === 'axios')
    return { post: async () => { throw new Error('ACRCloud calls forbidden'); } };
  if (from.endsWith('stageAcrcloud.js') && name === 'form-data')
    return class FakeFormData {};
  return originalLoad.call(this, name, parent, isMain);
};
const meta = require('../backend/utils/stageMetadata');
const { readPublicUrl } = require('../backend/utils/stageSafeRadioFetch');
const acr = require('../backend/utils/stageAcrcloud');
Module._load = originalLoad;

assert.equal(meta.cleanTitle('  Foo [Wz] - Bar  '), 'Foo - Bar');
assert.equal(meta.cleanTitle('<html>Oops</html>'), '');
assert.equal(meta.titleFromText('{"songtitle":"Test Artist - Test Song"}'), 'Test Artist - Test Song');
assert.equal(meta.titleFromText('{"artist":"An Artist","title":"A Track"}'), 'An Artist - A Track');
assert.equal(meta.titleFromText('updateStats_abc({"songtitle":"JSONP Song"});'), 'JSONP Song');
assert.equal(meta.titleFromText('<!doctype html><html>blocked</html>'), '');
assert.equal(meta.titleFromText('{"icestats":{"source":{"title":"Ice Artist - Ice Track"}}}'), 'Ice Artist - Ice Track');
const headerBuffer = Buffer.alloc(130);
headerBuffer[10] = 3;
Buffer.from("StreamTitle='Artist - Song';").copy(headerBuffer,11);
assert.equal(meta.titleFromIcy(headerBuffer, { 'icy-metaint': '10' }), 'Artist - Song');

const urls = meta.metadataUrls(station);
assert.equal(urls[0], station.metadata);
assert.ok(urls.some(x => x.endsWith('/status-json.xsl')));

assert.equal(acr.validAcrHost('identify-eu-west-1.acrcloud.com'),true);
assert.equal(acr.validAcrHost('https://identify-eu-west-1.acrcloud.com'),false);
assert.equal(acr.validAcrHost('localhost'),false);
assert.equal(acr.validAcrHost('evil.acrcloud.com.attacker.test'),false);
assert.equal(acr.validAcrHost('127.0.0.1'),false);

(async () => {
  await assert.rejects(readPublicUrl('http://127.0.0.1/private'), /Non-public|Private|Invalid/);
  await assert.rejects(readPublicUrl('file:///etc/passwd'), /Unsupported|Invalid/);
  await assert.rejects(readPublicUrl('http://169.254.169.254/latest'), /Non-public|Private|Invalid/);

  const req = { query: { stream: station.stream, customMeta: 'http://127.0.0.1/private' } };
  const response = {code:200,status(n){this.code=n;return this;},
    setHeader(){},json(body){this.body=body;return this;} };
  await meta.stageMetadata(req, response);
  assert.equal(response.code, 200);
  assert.equal(response.body.title,'Artist - Track');
  assert.deepEqual(upstreamUrls,[station.metadata],
    'ignore client-supplied customMeta; only the DB-owned metadata URL may be fetched');

  const previous = process.env.STAGE_ENABLE_ACRCLOUD;
  delete process.env.STAGE_ENABLE_ACRCLOUD;
  const acrResponse = {status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
  await acr.stageRecognizeProxy({body:{stationId: station._id}},acrResponse);
  assert.equal(acrResponse.code, 503,'ACRCloud disabled by default');
  if (previous === undefined) delete process.env.STAGE_ENABLE_ACRCLOUD;
  else process.env.STAGE_ENABLE_ACRCLOUD = previous;
  console.log('Stage metadata and guarded ACRCloud offline tests passed.');
})().catch(error => { console.error(error); process.exitCode=1; });
