'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {PREVIEW_TTL_MS,validRequest,mintWidgetPreviewToken,verifyWidgetPreviewToken}=
  require('../services/widgetPreviewTokens');

const secret='unit-test-preview-key-is-at-least-24-characters-long';
const stationId='0123456789abcdef01234567';
const otherStation='0123456789abcdef01234568';
const variant='player-square';
const now=Date.parse('2026-11-12T17:00:00Z');
const mint=(options={})=>mintWidgetPreviewToken({
  stationId,variant,secret,now,...options
});
const verify=(token,options={})=>verifyWidgetPreviewToken({
  token,stationId,variant,secret,now,...options
});
test('temporary preview requires valid station and exact widget type',()=>{
  assert.ok(validRequest(stationId,'hero'));
  assert.equal(validRequest('station-slug',variant),false);
  assert.equal(validRequest(stationId,'admin'),false);
  assert.throws(()=>mint({variant:'admin'}));
  assert.throws(()=>mint({secret:''}));
});
test('preview lasts exactly 180 seconds and stops at expiration',()=>{
  assert.equal(PREVIEW_TTL_MS,180000);
  const token=mint();
  assert.equal(verify(token),true);
  assert.equal(verify(token,{now:now+179999}),true);
  assert.equal(verify(token,{now:now+180000}),false);
  assert.equal(verify(token,{now:now+180001}),false);
});
test('token is bound to station, variant and signing key and cannot be edited',()=>{
  const token=mint();
  assert.equal(verify(token,{stationId:otherStation}),false);
  assert.equal(verify(token,{variant:'program-square'}),false);
  assert.equal(verify(token,{secret:'another-test-secret-with-sufficient-length'}),false);
  const [payload,mac]=token.split('.');
  const modifiedPayload=Buffer.from(JSON.stringify({
    ...JSON.parse(Buffer.from(payload,'base64url').toString('utf8')),
    sid:otherStation
  })).toString('base64url');
  assert.equal(verify(modifiedPayload+'.'+mac,{stationId:otherStation}),false);
  assert.equal(verify(token.slice(0,-4)+'aaaa'),false);
});
test('malformed and artificially extended tokens fail closed',()=>{
  assert.equal(verify(null),false);
  assert.equal(verify('a.b'),false);
  assert.equal(verify('x'.repeat(2000)),false);
  assert.equal(verify(mint({now:now+3600000}),{now}),false);
});
