'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {MAX_AUDIO_SPOT_DURATION_SECONDS,TOO_LONG_MESSAGE,isAudioSpotTooLong,
  isPlayableAudioDuration}=require('../services/adAudioDurationRules');

test('46.000 seconds is allowed; longer spots are rejected',()=>{
  assert.equal(MAX_AUDIO_SPOT_DURATION_SECONDS,46);
  assert.equal(isAudioSpotTooLong(45.999),false);
  assert.equal(isAudioSpotTooLong(46),false);
  assert.equal(isAudioSpotTooLong(46.001),true);
  assert.equal(isAudioSpotTooLong(600),true);
  assert.match(TOO_LONG_MESSAGE,/46 δευτερολέπτων/);
});
test('invalid duration cannot pass codec verification',()=>{
  assert.equal(isPlayableAudioDuration(NaN),false);
  assert.equal(isPlayableAudioDuration(Infinity),false);
  assert.equal(isPlayableAudioDuration(0),false);
  assert.equal(isPlayableAudioDuration(0.5),true);
  assert.equal(isPlayableAudioDuration(46),true);
  assert.equal(isPlayableAudioDuration(600),true);
});
