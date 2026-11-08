'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const normalize=require('../backend/utils/scheduleNormalization').normalize;
const script=fs.readFileSync(path.join(root,'backend/services/stationScheduleFeed.js'),'utf8');
const sandbox={module:{exports:{}},exports:{},URL,Buffer,console,setTimeout,clearTimeout};
const factory=vm.runInNewContext('(function(require,module,exports){\n'+script+'\n})',sandbox,
  {filename:'stationScheduleFeed.js'});
factory(name=>{
  if(name==='../models/Station')return {};
  if(name==='../utils/scheduleNormalization')return {normalize};
  return require(name);
},sandbox.module,sandbox.exports);
const {parseXml,rowsFromXml,mapRows,dayNumber,timeString}=sandbox.module.exports.__testing;
const {publicHttpUrl}=sandbox.module.exports;

const example='<?xml version="1.0" encoding="UTF-8"?>'+
  '<schedule><show><producer>DJ Maria</producer><title>Night Sessions</title>'+
  '<day>7</day><start>23:00</start><end>02:00</end>'+
  '<imageurl>https://radio.example.com/images/night.jpg</imageurl>'+
  '<description>House &amp; electronic</description></show></schedule>';
const rows=rowsFromXml(parseXml(example));
assert.equal(rows.rowTag,'show');
assert.equal(rows.rows.length,1);
const mapped=mapRows(rows,{dayFormat:'iso'});
assert.equal(mapped.sourceCount,1);
assert.equal(mapped.split,1);
assert.equal(mapped.schedule.length,2);
assert.equal(mapped.schedule[0].day,1);
assert.equal(mapped.schedule[0].startTime,'00:00');
assert.equal(mapped.schedule[0].endTime,'02:00');
assert.equal(mapped.schedule[1].day,7);
assert.equal(mapped.schedule[1].endTime,'24:00');
assert.equal(mapped.schedule[0].imageUrl,'https://radio.example.com/images/night.jpg');
assert.equal(mapped.schedule[1].description,'House & electronic');
assert.equal(mapped.schedule[0].title,'Night Sessions');

const custom=rowsFromXml(parseXml('<guide><slot day="0" from="07:00" to="09:00" dj="Alex"><name>Morning</name></slot></guide>'),'slot');
const imported=mapRows(custom,{dayFormat:'monday0',mapping:{day:'day',start:'from',end:'to',producer:'dj',title:'name'}});
assert.equal(imported.schedule[0].day,1);
assert.equal(imported.schedule[0].title,'Morning');
assert.equal(imported.schedule[0].host,'Alex');
assert.equal(dayNumber('Sunday','iso'),7);
assert.equal(dayNumber('Κυριακή','iso'),7);
assert.equal(dayNumber('0','sunday0'),7);
assert.equal(dayNumber('0','monday0'),1);
assert.equal(timeString('9:05',false),'09:05');
assert.equal(timeString('24:00',true),'24:00');
assert.equal(timeString('24:00',false),'');
assert.throws(()=>parseXml('<!DOCTYPE x [<!ENTITY a "xyz">]><root/>'),/DTD/);
assert.throws(()=>parseXml('<schedule><show></schedule>'),/closing/);
assert.throws(()=>mapRows(rowsFromXml(parseXml('<schedule><show><day>1</day><start>11:00</start><end>12:00</end></show></schedule>'))),/mapping/);
assert.throws(()=>mapRows(rowsFromXml(parseXml(
  '<schedule><show><title>A</title><day>1</day><start>12:00</start><end>14:00</end></show>'+
  '<show><title>B</title><day>1</day><start>13:00</start><end>15:00</end></show></schedule>'))),/επικαλύπτονται/);
assert.equal(publicHttpUrl('https://radio.example.com/schedule.xml'),true);
for(const blocked of ['file:///etc/passwd','http://localhost/foo','http://127.0.0.1/feed',
  'http://169.254.169.254/latest/meta-data/','http://192.168.1.5/a',
  'http://example.com:6379/','http://[::1]/feed']){
  assert.equal(publicHttpUrl(blocked),false,blocked);
}
assert.match(script,/0 3 \* \* \*/);
assert.match(script,/Europe\/Athens/);
const profile=fs.readFileSync(path.join(root,'frontend/src/pages/StationProfile.jsx'),'utf8');
assert.match(profile,/ir-station-top-grid/);
assert.match(profile,/StationScheduleTimeline/);
console.log('PASS: XML mapping, midnight splits, artwork, weekdays, SSRF URL guard, station profile');
