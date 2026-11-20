'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {catalogEntryForViewer,snapshotForViewer,liveTrackForViewer,historyTrackForViewer}
  =require('../services/nowPlayingVisibility');
const guest={signedIn:false,canSeeAI:false};
const free={signedIn:true,canSeeAI:false};
const premium={signedIn:true,canSeeAI:true};
const ai={song:{artist:'SECRET ARTIST',title:'SECRET TITLE'},source:'acrcloud',
  foundWithAI:true,expiresAt:'2026-11-11T15:15:00Z',broadcastHint:'Live DJ show'};
const native={song:{artist:'Public Artist',title:'Public Song'},source:'station',
  foundWithAI:false,broadcastHint:'Live DJ show'};
function containsSecrets(obj){return JSON.stringify(obj).includes('SECRET');}
test('Guest catalog sees only schedule/broadcast, no native or AI tracks',()=>{
  assert.deepEqual(catalogEntryForViewer(native,guest),{broadcastHint:'Live DJ show'});
  assert.deepEqual(catalogEntryForViewer(ai,guest),{broadcastHint:'Live DJ show'});
  assert.equal(catalogEntryForViewer({song:native.song},guest),null);
});
test('Free and unverified Free see native metadata but AI teaser, never track metadata',()=>{
  assert.deepEqual(catalogEntryForViewer(native,free),native);
  const teaser=catalogEntryForViewer(ai,free);
  assert.equal(teaser.premiumOnly,true);
  assert.equal(teaser.foundWithAI,true);
  assert.equal(containsSecrets(teaser),false);
  assert.equal(teaser?.song,undefined);
});
test('Premium and an authorized Admin projection see complete AI results',()=>{
  assert.deepEqual(catalogEntryForViewer(ai,premium),ai);
  assert.deepEqual(catalogEntryForViewer(native,premium),native);
});
test('Station metadata never reveals ACR song to Free after purchase expiry',()=>{
  const snapshot={title:'SECRET ARTIST - SECRET TITLE',source:'acrcloud',
    foundWithAI:true,recognizedAt:'2026-11-11T15:11:00Z',expiresAt:ai.expiresAt};
  assert.equal(containsSecrets(snapshotForViewer(snapshot,free)),false);
  assert.equal(snapshotForViewer(snapshot,free).premiumOnly,true);
  assert.deepEqual(snapshotForViewer(snapshot,premium),snapshot);
  assert.equal(snapshotForViewer(snapshot,guest).title,'');
});
test('Live feed has station-scoped teaser without track title, artist or raw',()=>{
  const item={stationId:'station123',title:'SECRET ARTIST - SECRET TITLE',
    source:'acrcloud',foundWithAI:true,expiresAt:ai.expiresAt};
  const teaser=liveTrackForViewer(item,free);
  assert.equal(teaser.stationId,'station123');
  assert.equal(containsSecrets(teaser),false);
  assert.equal(teaser.premiumOnly,true);
  assert.deepEqual(liveTrackForViewer(item,premium),item);
});
test('Playlist history hides saved AI titles even AFTER 4-minute recognition expiry',()=>{
  const track={raw:'SECRET ARTIST - SECRET TITLE',artist:'SECRET ARTIST',
    title:'SECRET TITLE',source:'acrcloud',playedAt:'2026-11-11T15:11:00Z'};
  const teaser=historyTrackForViewer(track,free);
  assert.equal(containsSecrets(teaser),false);
  assert.equal(teaser.premiumOnly,true);
  assert.deepEqual(historyTrackForViewer(track,premium),track);
  assert.deepEqual(historyTrackForViewer({...track,source:'station'},free),
    {...track,source:'station'});
});
