import test from 'node:test';
import assert from 'node:assert/strict';
import {newAdListenClock,resumeAdListenClock,suspendAdListenClock,
  sampleAdListenClock,canSkipAd,secondsUntilAdSkip,AD_SKIP_SECONDS} from './adSkipPolicy.js';

function play(seconds,duration=60){
  let clock=resumeAdListenClock(newAdListenClock(),0,0);
  for(let i=1;i<=seconds;i++)
    clock=sampleAdListenClock(clock,{position:i,now:i*1000,readyState:4});
  return {clock,duration};
}
test('only spots longer than 30 seconds become skippable after 30 audible seconds',()=>{
  assert.equal(AD_SKIP_SECONDS,30);
  for(const duration of [10,20,30]){
    const {clock}=play(duration,duration);
    assert.equal(canSkipAd(clock,duration),false);
    assert.equal(secondsUntilAdSkip(clock,duration),null);
  }
  for(const duration of [31,45,60,120]){
    const before=play(29,duration).clock;
    const after=play(30,duration).clock;
    assert.equal(canSkipAd(before,duration),false);
    assert.equal(secondsUntilAdSkip(before,duration),1);
    assert.equal(canSkipAd(after,duration),true);
    assert.equal(secondsUntilAdSkip(after,duration),0);
  }
});
test('buffering or paused playback never advances skip time',()=>{
  let state=play(20).clock;
  state=suspendAdListenClock(state);
  state=sampleAdListenClock(state,{position:20,now:30000,paused:true});
  state=resumeAdListenClock(state,20,30000);
  for(let t=1;t<=9;t++){
    state=sampleAdListenClock(state,{position:20+t,now:30000+t*1000});
  }
  assert.equal(secondsUntilAdSkip(state,60),1);
  state=sampleAdListenClock(state,{position:29,now:49000,readyState:1});
  assert.equal(canSkipAd(state,60),false);
  state=sampleAdListenClock(state,{position:30,now:50000,readyState:4});
  assert.equal(canSkipAd(state,60),true);
});
test('seek jumps and invalid timeline samples never unlock skip',()=>{
  let state=play(8).clock;
  state=suspendAdListenClock(state);
  state=sampleAdListenClock(state,{position:48,now:8500,seeking:true});
  state=resumeAdListenClock(state,48,8500);
  state=sampleAdListenClock(state,{position:49,now:9500});
  assert.ok(state.seconds<10);
  state=sampleAdListenClock(state,{position:59,now:9600});
  assert.equal(canSkipAd(state,60),false);
  assert.equal(canSkipAd(state,Infinity),false);
  assert.equal(canSkipAd(state,NaN),false);
});
