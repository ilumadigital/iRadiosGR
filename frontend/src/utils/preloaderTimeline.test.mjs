import test from 'node:test';
import assert from 'node:assert/strict';
import {preloaderTimeline,SPLASH_DURATION_MS,SPLASH_FADE_MS} from './preloaderTimeline.js';

test('normal React page shows a single 1.4-second preloader with 250ms fade',()=>{
  assert.equal(SPLASH_DURATION_MS,1400);
  assert.equal(SPLASH_FADE_MS,250);
  assert.deepEqual(preloaderTimeline(500,500),{fadeInMs:1150,removeInMs:1400});
});
test('SEO HTML splash keeps elapsed time when React mounts; does not restart animation',()=>{
  assert.deepEqual(preloaderTimeline(500,800),{fadeInMs:850,removeInMs:1100});
  assert.deepEqual(preloaderTimeline(500,1500),{fadeInMs:150,removeInMs:400});
  assert.deepEqual(preloaderTimeline(500,1650),{fadeInMs:0,removeInMs:250});
});
test('late bundle mount never restarts the 1.4s intro, just gives existing node a fade',()=>{
  assert.deepEqual(preloaderTimeline(500,5000),{fadeInMs:0,removeInMs:250});
  assert.deepEqual(preloaderTimeline(500,501),{fadeInMs:1149,removeInMs:1399});
});
test('missing/future/invalid initial mark is safely treated as current time',()=>{
  for(const start of [undefined,NaN,Infinity,-5,2000]){
    assert.deepEqual(preloaderTimeline(start,1000),{fadeInMs:1150,removeInMs:1400});
  }
});
