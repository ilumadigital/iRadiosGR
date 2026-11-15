import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newAdListenClock, resumeAdListenClock, suspendAdListenClock,
  sampleAdListenClock, canSkipAd, secondsUntilAdSkip,
  skipThresholdForBreak
} from './adSkipPolicy.js';
import {dueOnStationChange, selectStationBreak} from './audioAdRules.js';

test('First Play is tied to the first station-start event, not station history',()=>{
  assert.equal(dueOnStationChange('entry',1),true);
  assert.equal(dueOnStationChange('first_station',1),true);
  assert.equal(dueOnStationChange('entry',2),false);
  // With or without an initially restored player station, App sends the first
  // valid playback attempt through selectStationBreak with switch count 1.
  const station={_id:'station-1',disableNetworkAds:false};
  const ads=[{_id:'spot-1',audioUrl:'/api/ads/spot-1/media',status:'active',
    frequency:'entry',isGlobal:true,targetLocations:['All']}];
  assert.equal(selectStationBreak(ads,1,station,{},()=>true).length,1);
  assert.equal(selectStationBreak(ads,2,station,{},()=>true).length,0);
});

test('1/2/3+ spots have exact 15/40/55-second thresholds',()=>{
  assert.equal(skipThresholdForBreak(1),15);
  assert.equal(skipThresholdForBreak(2),40);
  assert.equal(skipThresholdForBreak(3),55);
  assert.equal(skipThresholdForBreak(10),55);
});

test('a single spot is skippable only after 15 audible seconds',()=>{
  assert.equal(canSkipAd({seconds:14.9},46,1),false);
  assert.equal(secondsUntilAdSkip({seconds:14},46,1),1);
  assert.equal(canSkipAd({seconds:15},46,1),true);
  assert.equal(secondsUntilAdSkip({seconds:15},46,1),0);
  assert.equal(canSkipAd({seconds:30},10,1),false);
  assert.equal(secondsUntilAdSkip({seconds:0},10,1),null);
});

test('two-spot break uses 40 accumulated seconds and accepts buffering metadata',()=>{
  assert.equal(canSkipAd({seconds:39.9},NaN,2),false);
  assert.equal(secondsUntilAdSkip({seconds:30},NaN,2),10);
  assert.equal(canSkipAd({seconds:40},NaN,2),true);
  assert.equal(secondsUntilAdSkip({seconds:40},NaN,2),0);
});

test('three or more spots require 55 accumulated audible seconds',()=>{
  assert.equal(canSkipAd({seconds:54.9},30,3),false);
  assert.equal(secondsUntilAdSkip({seconds:52},30,3),3);
  assert.equal(canSkipAd({seconds:55},30,3),true);
  assert.equal(canSkipAd({seconds:55},30,5),true);
});

test('stalls and seeking do not advance the listening clock',()=>{
  let clock=resumeAdListenClock(newAdListenClock(),0,0);
  clock=sampleAdListenClock(clock,{position:5,now:5000,readyState:4});
  assert.equal(clock.seconds,5);
  clock=suspendAdListenClock(clock);
  clock=sampleAdListenClock(clock,{position:7,now:8000,paused:true});
  assert.equal(clock.seconds,5);
  clock=resumeAdListenClock(clock,7,8000);
  clock=sampleAdListenClock(clock,{position:100,now:9000,seeking:true});
  assert.equal(clock.seconds,5);
});

test('clock carries audible time into the next spot',()=>{
  let clock=resumeAdListenClock(newAdListenClock(),0,0);
  clock=sampleAdListenClock(clock,{position:25,now:25000});
  clock=resumeAdListenClock(suspendAdListenClock(clock),0,26000);
  clock=sampleAdListenClock(clock,{position:15,now:41000});
  assert.equal(clock.seconds,40);
  assert.equal(canSkipAd(clock,46,2),true);
});
