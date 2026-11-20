import test from 'node:test';
import assert from 'node:assert/strict';
import {findPremiumOwner,remotePremiumPlayback,shouldShowPause,ownerTransportAction,remoteLocationLabel}
  from './playbackPresentation.mjs';
const deseo='507f1f77bcf86cd799439011';
const device={deviceId:'iphone',deviceName:'iPhone',stationId:deseo,
  online:true,playbackState:'playing'};
test('Premium laptop shows iPhone station and Pause without owning audio',()=>{
  const owner=findPremiumOwner([device],true);
  const remote=remotePremiumPlayback(owner,'laptop');
  assert.equal(remote.stationId,deseo);
  assert.equal(remote.deviceName,'iPhone');
  assert.equal(shouldShowPause(false,remote),true);
  assert.equal(ownerTransportAction(owner),'pause');
});
test('After remote pause, laptop displays Play and resume targets iPhone',()=>{
  const owner=findPremiumOwner([{...device,playbackState:'paused'}],true);
  const remote=remotePremiumPlayback(owner,'laptop');
  assert.equal(shouldShowPause(false,remote),false);
  assert.equal(ownerTransportAction(owner),'resume');
});
test('While remote station changes, Pending retains Pause presentation',()=>{
  const owner=findPremiumOwner([{...device,playbackState:'pending'}],true);
  assert.equal(shouldShowPause(false,remotePremiumPlayback(owner,'laptop')),true);
});
test('Local owner does not create remote playback, and offline has no owner',()=>{
  assert.equal(remotePremiumPlayback(findPremiumOwner([device],true),'iphone'),null);
  assert.equal(findPremiumOwner([{...device,online:false}],true),null);
});
test('Free accounts have independent playback and no shared owner',()=>{
  assert.equal(findPremiumOwner([device],false),null);
  assert.equal(shouldShowPause(false,null),false);
  assert.equal(shouldShowPause(true,null),true);
});

test('Remote labels distinguish playing, pending and paused',()=>{
  assert.equal(remoteLocationLabel('playing'),'Παίζει στο');
  assert.equal(remoteLocationLabel('pending'),'Σύνδεση στο');
  assert.equal(remoteLocationLabel('paused'),'Σε παύση στο');
});
