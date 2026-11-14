'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const app=read('frontend/src/App.jsx');
const hook=read('frontend/src/hooks/usePlayDevices.js');
const server=read('backend/services/playDevices.js');
const lease=read('backend/models/PlaybackLease.js');
const footer=read('frontend/src/components/Footer.jsx');
const mobile=read('frontend/src/components/MobileMiniPlayer.jsx');
const desktop=read('frontend/src/components/DesktopFullPlayer.jsx');
const picker=read('frontend/src/components/DevicePicker.jsx');

test('only authenticated account sockets can send playback commands',()=>{
  assert.match(server,/jwt\.verify\(raw,process\.env\.JWT_SECRET\)/);
  assert.match(server,/socket\.data\.accountId=String\(user\._id\)/);
  assert.match(server,/socket\.on\('connect:control'/);
  assert.match(server,/premiumFor\(socket\)/);
  assert.match(server,/serializeGrant\(account,async\(\)=>/);
  assert.match(lease,/enum:\['pending','playing','paused'\]/);
});
test('server controls the existing owner without moving its stream',()=>{
  assert.match(server,/ownerSocket\.emit\('connect:command'/);
  assert.match(server,/action==='station'/);
  assert.match(server,/nextPlaybackState\(lease\.state,action\)/);
  assert.match(server,/socket\.on\('connect:transfer'/);
  assert.match(server,/state:\{\$in:\['pending','playing'\]\}/);
  assert.match(server,/state:\{\$in:\['playing','paused'\]\}/);
});
test('client subscribes to per-account device changes, preserves owner and supports remote pause',()=>{
  assert.match(hook,/socket\.on\('connect:devices'/);
  assert.match(hook,/socket\.on\('connect:command'/);
  assert.match(hook,/onRemoteStation\?\./);
  assert.match(hook,/onRemoteResume\?\./);
  assert.match(hook,/onRemotePause\?\./);
  assert.match(hook,/connect:control/);
});
test('station changes and Pause from a controller never start local Premium audio',()=>{
  assert.match(app,/if\(premiumSync&&activeRemoteDevice\)/);
  assert.match(app,/handlePlaybackControl\('station',String\(station\._id\)\)/);
  assert.match(app,/const displayIsPlaying=shouldShowPause\(isPlaying,remotePlayback\)/);
  assert.match(app,/ownerTransportAction\(playbackOwner\)/);
  assert.match(app,/playbackOwner\?\.stationId/);
  assert.match(app,/deviceCallbacksRef\.current\.resume=/);
  assert.match(app,/deviceCallbacksRef\.current\.pause=/);
});
test('footer, fullscreen, mobile and device picker expose the remote state',()=>{
  for(const view of [footer,mobile,desktop])
    assert.match(view,/remoteLocationLabel\(remotePlayback\.state\)/);
  assert.match(footer,/remotePlayback=\{remotePlayback\}/);
  assert.match(mobile,/remotePlayback/);
  assert.match(picker,/hasOwnerElsewhere/);
  assert.match(picker,/Μεταφορά εδώ/);
});
test('Free listening and advertising remain in the independent local engine',()=>{
  assert.match(app,/selectStationBreak\(ads,clicks,station,userLocation,checkGeoMatch\)/);
  assert.match(app,/if\(premiumSync&&activeRemoteDevice\)/);
  assert.match(server,/freePlayingStationId/);
});
