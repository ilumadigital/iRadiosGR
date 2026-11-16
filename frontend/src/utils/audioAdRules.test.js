import test from 'node:test';
import assert from 'node:assert/strict';
import {dueOnStationChange,dueOnClock,canServeAudioAd,selectStationBreak,placementsForAd,stationBreakCandidates,timedBreakCandidates} from './audioAdRules.js';
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
test('a burst of matching campaigns results in at most three spots ordered by daily budget',()=>{
  const list=[ad('entry',{_id:'1'}),ad('entry',{_id:'2'}),ad('entry',{_id:'3'}),ad('every_5_stations',{_id:'4'})];
  assert.deepEqual(selectStationBreak(list,1,station,null,null).map(x=>x._id),['1','2','3']);
  assert.deepEqual(selectStationBreak(list,5,station,null,null).map(x=>x._id),['4']);
});

test('only the eight priced placements are eligible for a billable audio break',()=>{
 assert.deepEqual(placementsForAd(ad('every_2_stations')),[]);
 assert.deepEqual(placementsForAd(ad('every_1_hour')),[]);
 assert.deepEqual(placementsForAd(ad('entry',{frequencies:['every_4_stations','entry','every_5_stations','once_a_day']})),['entry','every_5_stations']);
 assert.deepEqual(stationBreakCandidates([ad('every_2_stations')],10,station,null,null),[]);
});
test('ten campaigns yield the top three by daily budget, with distinct fallback candidates',()=>{
 const ads=Array.from({length:10},(_,i)=>ad('entry',{
  _id:String(i),campaignId:'campaign-'+i,dailyBudgetCents:(i+1)*100
 }));
 const ordered=stationBreakCandidates(ads,1,station,null,null);
 assert.equal(ordered.length,10);
 assert.deepEqual(ordered.slice(0,3).map(x=>x._id),['9','8','7']);
 assert.deepEqual(ordered.slice(3,5).map(x=>x._id),['6','5']);
 assert.equal(selectStationBreak(ads,1,station,null,null).length,3);
 assert.equal(stationBreakCandidates([...ads,ad('entry',{_id:'duplicate',
  campaignId:'campaign-9',dailyBudgetCents:100000})],1,station,null,null).length,10);
});
test('station 10 with placements 5/10 authorizes only the deterministic 5-frequency ticket',()=>{
 const creative=ad('every_10_stations',{frequencies:['every_10_stations','every_5_stations']});
 assert.equal(stationBreakCandidates([creative],10,station,null,null)[0].selectedPlacement,'every_5_stations');
 assert.equal(stationBreakCandidates([creative],5,station,null,null)[0].selectedPlacement,'every_5_stations');
 assert.equal(stationBreakCandidates([creative],11,station,null,null).length,0);
});
test('clock queue excludes legacy intervals and respects per-placement last-served time',()=>{
 const now=Date.UTC(2026,10,16,18,15);
 const candidate=ad('twice_a_day',{_id:'timed-1',
  frequencies:['twice_a_day','every_1_hour'],dailyBudgetCents:1000});
 assert.equal(timedBreakCandidates([candidate],station,null,null,{},now).length,1);
 assert.equal(timedBreakCandidates([candidate],station,null,null,
  {'timed-1:twice_a_day':now-1000},now).length,0);
 assert.equal(timedBreakCandidates([ad('every_1_hour')],station,null,null,{},now).length,0);
});
