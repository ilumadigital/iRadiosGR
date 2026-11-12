import test from 'node:test';
import assert from 'node:assert/strict';
import {dueOnStationChange,dueOnClock,canServeAudioAd,selectStationBreak} from './audioAdRules.js';
const station={_id:'a',disableNetworkAds:false};
const ad=(freq,overrides={})=>({
  _id:freq,frequency:freq,audioUrl:'/media/audio/demo.mp3',
  status:'active',isGlobal:true,targetLocations:['All'],...overrides
});
test('only the first station selection runs entry pre-roll',()=>{
  assert.equal(dueOnStationChange('entry',1),true);
  assert.equal(dueOnStationChange('entry',2),false);
  assert.equal(dueOnStationChange('every_5_stations',5),true);
  assert.equal(dueOnStationChange('every_5_stations',6),false);
  assert.equal(dueOnStationChange('every_2_stations',10),true);
  assert.equal(dueOnStationChange('every_2_stations',0),false);
});
test('clock rule honors frequency since most recent attempt',()=>{
  const now=Date.UTC(2026,10,13,16,15);
  assert.equal(dueOnClock('every_1_hour',now-3600000,now),true);
  assert.equal(dueOnClock('every_2_hours',now-3600000,now),false);
  assert.equal(dueOnClock('once_a_week',now-7*86400000,now),true);
  assert.equal(dueOnClock('every_1_hour',now+1000,now),false);
});
test('delivery excludes missing media, expired status, geo mismatch and disabled networks',()=>{
  const geo=(a,loc)=>a===loc;
  assert.equal(canServeAudioAd(ad('entry'),station,null,geo),true);
  assert.equal(canServeAudioAd(ad('entry',{audioUrl:''}),station,null,geo),false);
  assert.equal(canServeAudioAd(ad('entry',{status:'pending'}),station,null,geo),false);
  assert.equal(canServeAudioAd(ad('entry',{expiresAt:'2020-01-01'}),station,null,geo),false);
  assert.equal(canServeAudioAd(ad('entry',{targetLocations:['Αθήνα']}),station,'Θεσσαλονίκη',geo),false);
  assert.equal(canServeAudioAd(ad('entry',{targetLocations:['Αθήνα']}),station,'Αθήνα',geo),true);
  assert.equal(canServeAudioAd(ad('entry'),{...station,disableNetworkAds:true},null,geo),false);
  assert.equal(canServeAudioAd(ad('entry',{isGlobal:false,stationId:'a'}),station,null,geo),true);
});
test('a burst of matching campaigns results in at most two spots, preserving order',()=>{
  const list=[ad('entry',{_id:'1'}),ad('entry',{_id:'2'}),ad('entry',{_id:'3'}),ad('every_5_stations',{_id:'4'})];
  assert.deepEqual(selectStationBreak(list,1,station,null,null).map(x=>x._id),['1','2']);
  assert.deepEqual(selectStationBreak(list,5,station,null,null).map(x=>x._id),['4']);
});
