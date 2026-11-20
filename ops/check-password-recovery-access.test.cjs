'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function stageMiddleware() {
  const filename = path.join(__dirname, '../backend/utils/stagePublicAccess.js');
  const code = fs.readFileSync(filename, 'utf8');
  const module = { exports: {} };
  const mockedRequire = (name) => {
    if (name === './authMiddleware') return { protect: (_req, res) => res.status(401).json({ error: 'Unauthorized' }) };
    if (name === './roleMiddleware') return { authorizeRoles: () => (_req, _res, next) => next() };
    if (name === '../models/User' || name === '../models/BroadcasterInvitation') return {};
    if (name === 'node:crypto') return require(name);
    throw Error('Unexpected dependency: ' + name);
  };
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', {})(
    mockedRequire, module, module.exports
  );
  return module.exports.stagePublicAccess;
}

function request(middleware, route, body) {
  const req = { method: 'POST', baseUrl: '/api', path: route, body,
    headers: {}, socket: { remoteAddress: 'test-password-recovery' } };
  const res = {
    statusCode: 200, payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
    setHeader() {}
  };
  let reachedController = false;
  middleware(req, res, () => { reachedController = true; });
  return { reachedController, statusCode: res.statusCode };
}

test('staging lets valid forgot/reset requests reach authController without a JWT', () => {
  const middleware = stageMiddleware();
  assert.equal(request(middleware, '/auth/forgot-password', { email: ' User@EXAMPLE.gr ' }).reachedController, true);
  assert.equal(request(middleware, '/auth/reset-password', {
    token: 'a'.repeat(64), newPassword: 'SafePassword123!'
  }).reachedController, true);
});

test('staging still rejects malformed requests and unrelated anonymous endpoints', () => {
  const middleware = stageMiddleware();
  assert.equal(request(middleware, '/auth/forgot-password', { email: 'invalid' }).statusCode, 400);
  assert.equal(request(middleware, '/auth/reset-password', {
    token: 'bad', newPassword: 'SafePassword123!'
  }).statusCode, 400);
  assert.equal(request(middleware, '/auth/admin/secret', {}).statusCode, 401);
});
