'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {nextPlaybackState}=require('../services/playbackControlPolicy');
test('Pause preserves owner session and sets remote view paused',()=>{
 assert.equal(nextPlaybackState('playing','pause'),'paused');
 assert.equal(nextPlaybackState('pending','pause'),'paused');
});
test('Resume returns to pending until actual audio onPlaying confirms',()=>{
 assert.equal(nextPlaybackState('paused','resume'),'pending');
 assert.equal(nextPlaybackState('playing','resume'),'playing');
});
test('Changing station on a paused or playing device keeps the owner and restarts',()=>{
 for(const state of ['playing','paused','pending'])
   assert.equal(nextPlaybackState(state,'station'),'pending');
});
test('Unknown commands or states are rejected',()=>{
 assert.throws(()=>nextPlaybackState('playing','transfer'),TypeError);
 assert.throws(()=>nextPlaybackState('unknown','pause'),TypeError);
});
