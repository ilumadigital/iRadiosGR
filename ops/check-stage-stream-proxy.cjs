'use strict';
// Pure smoke tests for the staging proxy URL and network safety guard.
// No network requests, database access, live stations, or secrets.
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (name === '../models/Station' && parent?.filename?.endsWith('stageStreamProxy.js'))
    return { exists: async () => false };
  return originalLoad.call(this, name, parent, isMain);
};
const { isPublicIPv4, parseRadioUrl } = require('../backend/utils/stageStreamProxy');
Module._load = originalLoad;

for (const address of [
  '0.0.0.0','10.0.0.1','127.0.0.1','169.254.169.254',
  '172.16.0.1','172.31.255.255','192.168.10.10',
  '100.64.0.1','192.0.2.1','198.51.100.1','203.0.113.1',
  '198.19.1.1','224.0.0.1','255.255.255.255'
]) assert.equal(isPublicIPv4(address), false, 'private/special-use '+address);
for (const address of ['8.8.8.8','1.1.1.1','185.230.64.89'])
  assert.equal(isPublicIPv4(address), true, 'public '+address);
for (const url of [
  'http://127.0.0.1:8000/','http://10.0.0.1:8000/',
  'http://192.168.1.5/','http://169.254.169.254/latest/',
  'http://localhost:8000/','http://host.local/audio',
  'http://radio.example:22/','http://radio.example:27017/',
  'file:///etc/passwd','ftp://example.com/music',
  'http://user:pass@example.com/','http://[::1]:8000/'
]) assert.throws(() => parseRadioUrl(url), undefined, 'block '+url);
assert.equal(parseRadioUrl('http://radio.example:8000/stream').port, '8000');
assert.equal(parseRadioUrl('https://radio.example/live').protocol, 'https:');
console.log('Safe staging stream proxy URL checks passed.');
