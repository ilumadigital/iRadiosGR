'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {projectBroadcasterDashboard}=require('../services/broadcasterDashboardProjection');
const stations=[
 {_id:'a',name:'Radio A',status:'approved',stream:'https://radio.example/a',
  dspPreset:'ENHANCER',plays:120},
 {_id:'b',name:'Radio B',status:'approved',stream:'https://radio.example/b',
  dspPreset:'FM_MODE',plays:380}
];
function resolve(rights={}){
 return projectBroadcasterDashboard(stations,station=>new Set(rights[String(station._id)]||[]));
}

test('unpaid dashboard returns locked cards without any DSP or App Plays data',()=>{
 const result=resolve();
 assert.deepEqual(result.dsp,{enabled:false});
 assert.deepEqual(result.appPlays,{enabled:false});
 assert.equal(result.stations.length,2);
 for(const station of result.stations){
  assert.equal(Object.hasOwn(station,'plays'),false);
  assert.equal(Object.hasOwn(station,'appPlays'),false);
  assert.equal(Object.hasOwn(station,'dspPreset'),false);
  assert.equal(Object.hasOwn(station,'dspMode'),false);
 }
 assert.equal(JSON.stringify(result).includes('380'),false);
 assert.equal(JSON.stringify(result).includes('FM_MODE'),false);
});

test('WebDSP alone unlocks real DSP mode but never listening data',()=>{
 const result=resolve({b:['broadcaster.webdsp']});
 assert.deepEqual(result.dsp,{enabled:true,stationId:'b',stationName:'Radio B',mode:'FM_MODE'});
 assert.deepEqual(result.appPlays,{enabled:false});
 assert.equal(JSON.stringify(result).includes('380'),false);
});

test('Audience Radar alone unlocks only entitled station plays',()=>{
 const result=resolve({a:['broadcaster.analytics']});
 assert.deepEqual(result.dsp,{enabled:false});
 assert.deepEqual(result.appPlays,{enabled:true,total:120,stationCount:1});
 assert.equal(JSON.stringify(result).includes('ENHANCER'),false);
});

test('Premium on both stations aggregates only genuine plays',()=>{
 const rights=['broadcaster.analytics','broadcaster.webdsp'];
 const result=resolve({a:rights,b:rights});
 assert.equal(result.appPlays.total,500);
 assert.equal(result.appPlays.stationCount,2);
 assert.equal(result.dsp.mode,'ENHANCER');
});

test('OFF is a valid unlocked DSP mode, not a locked state',()=>{
 const result=projectBroadcasterDashboard(
  [{...stations[0],dspPreset:'OFF',plays:0}],
  ()=>new Set(['broadcaster.webdsp','broadcaster.analytics'])
 );
 assert.equal(result.dsp.mode,'OFF');
 assert.deepEqual(result.appPlays,{enabled:true,total:0,stationCount:1});
});
