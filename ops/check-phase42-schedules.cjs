'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const server=require('../backend/utils/scheduleNormalization');
const backend=fs.readFileSync(path.join(__dirname,'../backend/routes/backofficeRoutes.js'),'utf8');
const stationSchema=fs.readFileSync(path.join(__dirname,'../backend/models/Station.js'),'utf8');
const backoffice=fs.readFileSync(path.join(__dirname,'../frontend/src/pages/Backoffice.jsx'),'utf8');
const publicProfile=fs.readFileSync(path.join(__dirname,'../frontend/src/pages/StationProfile.jsx'),'utf8');
const valid=(day,startTime,endTime,title='Night Mix')=>({day,startTime,endTime,title,host:'Host'});
async function main(){
  const client=await import(pathToFileURL(path.join(__dirname,'../frontend/src/utils/schedule.js')).href);
  const examples=[
    [valid(5,'00:00','01:00','Midnight')],
    [valid(5,'23:00','02:00','Late Night')],
    [valid(7,'22:00','01:30','Sunday Session')],
    [valid(3,'23:00','00:00','To Midnight')],
    [valid(1,'00:00','00:00','All Day')],
    [valid(3,'09:00','10:00','A'),valid(3,'10:00','11:00','B')],
    [valid(4,'16:00','17:00','Second'),valid(4,'10:00','11:00','First')]
  ];
  for(const entries of examples){
    const expected=server.normalize(entries);
    assert.deepEqual(client.normalize(entries),expected,'client and server normalization must agree');
  }
  assert.equal(server.normalize(examples[0]).schedule[0].endTime,'01:00',
    '00:00-01:00 must be accepted');
  const friday=server.normalize(examples[1]);
  assert.equal(friday.split,1);
  assert.deepEqual(friday.schedule.map(s=>[s.day,s.startTime,s.endTime]),
    [[5,'23:00','24:00'],[6,'00:00','02:00']]);
  const sunday=server.normalize(examples[2]);
  assert.deepEqual(sunday.schedule.map(s=>[s.day,s.startTime,s.endTime]),
    [[1,'00:00','01:30'],[7,'22:00','24:00']]);
  assert.equal(server.normalize(examples[3]).schedule.length,1,
    '23:00-00:00 ends at next midnight without an empty next-day entry');
  assert.equal(server.normalize(examples[4]).schedule[0].endTime,'24:00',
    '00:00-00:00 is a full day, not an invalid show');
  assert.deepEqual(server.normalize(examples[6]).schedule.map(s=>s.title),
    ['First','Second'],'sort shows chronologically');
  const historical=[valid(0,'09:00','10:00','Monday'),valid(4,'09:00','10:00','Friday'),
    valid(6,'09:00','10:00','Sunday')];
  assert.equal(server.scheduleDayBase(historical,undefined),0);
  assert.deepEqual(server.toCanonical(historical,0).map(x=>x.day),[1,5,7]);
  assert.deepEqual(client.toCanonical(historical,client.scheduleDayBase(historical)),server.toCanonical(historical,0));
  assert.equal(server.scheduleDayBase([valid(7,'10:00','11:00')],undefined),1);
  assert.equal(server.scheduleDayBase([valid(5,'10:00','11:00')],1),1);
  assert.equal(server.scheduleDayBase([valid(5,'10:00','11:00')],undefined),0,
    'untagged ambiguous schedules follow historical convention until reviewed');
  assert.equal(server.toCanonical([valid(7,'10:00','11:00')],1)[0].day,7);
  assert.throws(()=>server.normalize([
    valid(5,'23:00','02:00','Night'),
    valid(6,'01:00','03:00','Collision')
  ]),/επικαλύπτονται/,'detect a next-day collision');
  assert.throws(()=>server.normalize([
    valid(3,'10:00','13:00','Long'),valid(3,'12:00','15:00','Overlapping')
  ]),/επικαλύπτονται/,'do not silently destroy or rewrite conflicting shows');
  assert.throws(()=>server.normalize([valid(8,'10:00','11:00')]),/Έλεγξε/);
  assert.throws(()=>server.normalize([valid(1,'25:00','26:00')]),/Έλεγξε/);
  assert.throws(()=>server.normalize([valid(1,'12:00','12:00')]),/ίδιες/);
  assert.equal(server.minutes('24:00',true),1440);
  assert.ok(Number.isNaN(server.minutes('24:00')),'24:00 is only an ending boundary');
  assert.ok(backend.includes('station.scheduleDayBase=1'),
    'explicit authorized save should mark ISO weekday format');
  assert.ok(backend.includes('normalizeWeeklySchedule(entries)'),'server validates and splits shows');
  assert.ok(stationSchema.includes('scheduleDayBase'),'station holds day-index tag');
  assert.ok(backoffice.includes('scheduleDayBase(existing,station?.scheduleDayBase)'),
    'Backoffice reads both legacy and canonical days');
  assert.ok(publicProfile.includes('const canonicalSchedule = useMemo('),
    'listener station profile reads both weekday formats');
  assert.ok(publicProfile.includes('const currentDayIdx = now.getDay()||7'),
    'listener now/next calculation uses ISO day index');
  assert.ok(!backoffice.includes('!/^([01]\\\\d'),
    'broken doubly-escaped time validation must never return');
  console.log('Schedule Phase 4.2 parity, midnight, legacy weekdays, conflicts, public profile passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
