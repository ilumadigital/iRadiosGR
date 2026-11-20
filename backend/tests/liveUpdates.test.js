'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {areasForMutation, publish, captureSuccessfulMutation} = require('../services/liveUpdates');

test('catalog and editorial mutations notify only the relevant public areas', () => {
  assert.deepEqual(areasForMutation('PUT','/api/admin/stations/reorder'),['stations','backoffice']);
  assert.deepEqual(areasForMutation('POST','/api/backoffice/stations'),['stations','backoffice']);
  assert.deepEqual(areasForMutation('POST','/api/backoffice/stations/123/approve'),['stations','backoffice']);
  assert.deepEqual(areasForMutation('PUT','/api/admin/home-slides/123'),['slides','backoffice']);
  assert.deepEqual(areasForMutation('DELETE','/api/admin/newsfeed/articles'),['news','backoffice']);
  assert.deepEqual(areasForMutation('PUT','/api/admin/promoted-stations'),['stations','ads','backoffice']);
  assert.deepEqual(areasForMutation('PUT','/api/admin/advertising/campaigns/123/approval'),['ads','backoffice']);
  assert.deepEqual(areasForMutation('PUT','/api/admin/users/123/role'),['backoffice']);
});
test('public read requests and telemetry never emit invalidations', () => {
  assert.deepEqual(areasForMutation('GET','/api/admin/stations'),[]);
  assert.deepEqual(areasForMutation('POST','/api/ads/abcdefabcdefabcdefabcdef/impression'),[]);
  assert.deepEqual(areasForMutation('POST','/api/backoffice/stream-diagnostics'),[]);
  assert.deepEqual(areasForMutation('POST','/api/admin/home-slides/upload'),[]);
  assert.deepEqual(areasForMutation('POST','/api/auth/login'),[]);
  assert.equal(publish(['not-a-topic']),null);
});
test('middleware broadcasts only after a successful response finishes', () => {
  const {EventEmitter} = require('node:events');
  const failed = new EventEmitter(); failed.statusCode = 403;
  let called = false;
  captureSuccessfulMutation({baseUrl:'/api', path:'/admin/stations/reorder', method:'PUT'}, failed, ()=>{called=true;});
  assert.equal(called, true);
  failed.emit('finish');
  const successful = new EventEmitter();successful.statusCode=200;
  captureSuccessfulMutation({baseUrl:'/api',path:'/admin/stations/reorder',method:'PUT'},successful,()=>{});
  successful.emit('finish');
  assert.equal(publish(['news','news','unsafe']).areas.join(','),'news');
});
