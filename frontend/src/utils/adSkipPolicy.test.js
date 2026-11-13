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
test('a single spot becomes skippable after 15 audible seconds only when longer than 15',()=>{
  assert.equal(AD_SKIP_SECONDS,15);
  for(const duration of [5,10,15]){
    const {clock}=play(duration,duration);
    assert.equal(canSkipAd(clock,duration),false);
    assert.equal(secondsUntilAdSkip(clock,duration),null);
  }
  for(const duration of [16,20,30,45,60,120]){
    const before=play(14,duration).clock;
    const after=play(15,duration).clock;
    assert.equal(canSkipAd(before,duration),false);
    assert.equal(secondsUntilAdSkip(before,duration),1);
    assert.equal(canSkipAd(after,duration),true);
    assert.equal(secondsUntilAdSkip(after,duration),0);
  }
});
test('a multi-spot break unlocks skip after 15 audible seconds total, even with short spots',()=>{
  // First ad finishes after 8 seconds. Source changes do not reset accrued time.
  let clock=play(8,8).clock;
  assert.equal(canSkipAd(clock,8,true),false);
  clock=suspendAdListenClock(clock);
  clock=resumeAdListenClock(clock,0,8000);
  for(let i=1;i<=6;i++){
    clock=sampleAdListenClock(clock,{position:i,now:8000+i*1000});
  }
  assert.equal(secondsUntilAdSkip(clock,8,true),1);
  assert.equal(canSkipAd(clock,8,true),false);
  clock=sampleAdListenClock(clock,{position:7,now:15000});
  assert.equal(secondsUntilAdSkip(clock,8,true),0);
  assert.equal(canSkipAd(clock,8,true),true);
  // Standalone short spots must not become skippable.
  assert.equal(canSkipAd(clock,8),false);
  assert.equal(secondsUntilAdSkip(clock,8),null);
});
test('three consecutive spots share the same 15-second listening threshold',()=>{
  let clock=newAdListenClock();
  let now=0;
  for(const duration of [5,6]){
    clock=resumeAdListenClock(clock,0,now);
    for(let second=1;second<=duration;second++)
      clock=sampleAdListenClock(clock,{position:second,now:now+second*1000});
    now+=duration*1000;
    clock=suspendAdListenClock(clock);
    assert.equal(canSkipAd(clock,duration,true),false);
  }
  clock=resumeAdListenClock(clock,0,now);
  for(let second=1;second<=4;second++)
    clock=sampleAdListenClock(clock,{position:second,now:now+second*1000});
  assert.equal(clock.seconds,15);
  assert.equal(canSkipAd(clock,20,true),true);
  assert.equal(secondsUntilAdSkip(clock,20,true),0);
});
test('skipped media, stalls, and pauses do not inflate a multi-spot break clock',()=>{
  let clock=play(10,10).clock;
  clock=suspendAdListenClock(clock);
  clock=resumeAdListenClock(clock,0,20000);
  clock=sampleAdListenClock(clock,{position:0,now:50000,readyState:1});
  assert.equal(secondsUntilAdSkip(clock,20,true),5);
  clock=sampleAdListenClock(clock,{position:12,now:50100,seeking:true});
  assert.equal(secondsUntilAdSkip(clock,20,true),5);
  clock=suspendAdListenClock(clock);
  clock=resumeAdListenClock(clock,12,51000);
  for(let i=1;i<=5;i++){
    clock=sampleAdListenClock(clock,{position:12+i,now:51000+i*1000});
  }
  assert.equal(canSkipAd(clock,20,true),true);
});
test('buffering or paused playback never advances skip time',()=>{
  let state=play(10).clock;
  state=suspendAdListenClock(state);
  state=sampleAdListenClock(state,{position:10,now:30000,paused:true});
  state=resumeAdListenClock(state,10,30000);
  for(let t=1;t<=4;t++){
    state=sampleAdListenClock(state,{position:10+t,now:30000+t*1000});
  }
  assert.equal(secondsUntilAdSkip(state,60),1);
  state=sampleAdListenClock(state,{position:14,now:49000,readyState:1});
  assert.equal(canSkipAd(state,60),false);
  state=sampleAdListenClock(state,{position:15,now:50000,readyState:4});
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
