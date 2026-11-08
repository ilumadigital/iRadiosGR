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
const {parseXml,rowsFromXml,rowsFromJson,mapRows,previewRows,dayNumber,timeString}=sandbox.module.exports.__testing;
const {publicHttpUrl,publicPreview}=sandbox.module.exports;

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
const unmapped=rowsFromXml(parseXml(
  '<schedule><slot><label>Morning</label><weekday_number>1</weekday_number>'+
  '<begins>09:00</begins><finishes>10:00</finishes></slot></schedule>'),'slot');
const inspect=previewRows(unmapped,{dayFormat:'iso'});
assert.equal(inspect.valid,false);
assert.ok(inspect.fields.includes('weekday_number'));
assert.ok(inspect.validationError.includes('mapping'));
assert.equal(publicPreview(inspect).sample.length,0);
const repaired=previewRows(unmapped,{dayFormat:'iso',
  mapping:{title:'label',day:'weekday_number',start:'begins',end:'finishes'}});
assert.equal(repaired.valid,true);
assert.equal(repaired.schedule[0].title,'Morning');
assert.equal(publicPreview(repaired).count,1);
// Real published Deseo CMS data shape: ISO days, nested shows and title/time fields.
const deseoFeed=JSON.stringify({ok:true,timezone:'Europe/Athens',days:[
  {day_of_week:1,shows:[{name:'Noir',start_time:'00:00',end_time:'03:00'}]},
  {day_of_week:7,shows:[{name:'Rokhai',start_time:'23:00',end_time:'23:59'}]}
]});
const deseoRows=rowsFromJson(deseoFeed);
assert.equal(deseoRows.format,'json');
assert.equal(deseoRows.dayFormat,'iso');
const deseoPreview=previewRows(deseoRows,{dayFormat:'monday0'});
assert.equal(deseoPreview.valid,true);
assert.equal(deseoPreview.schedule.length,2);
assert.equal(deseoPreview.schedule[0].day,1);
assert.equal(deseoPreview.schedule[1].day,7);
assert.equal(deseoPreview.mapping.title,'name');
assert.equal(deseoPreview.mapping.day,'day_of_week');
assert.equal(deseoPreview.mapping.start,'start_time');
assert.equal(deseoPreview.mapping.end,'end_time');
assert.equal(publicPreview(deseoPreview).format,'json');
assert.throws(()=>rowsFromJson('{"days": [}'),/JSON/);
assert.throws(()=>rowsFromJson('{"days": []}'),/160/);

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
const routes=fs.readFileSync(path.join(root,'backend/routes/backofficeRoutes.js'),'utf8');
assert.match(routes,/router\.delete\('\/backoffice\/stations\/:id\/schedule',feedRoles/);
assert.match(routes,/await previewFeed\(feedSettings\(req\.body\)\)/);
assert.match(routes,/schedule:parsed\.schedule,scheduleDayBase:1/);
const xmlUI=fs.readFileSync(path.join(root,'frontend/src/components/ScheduleXmlImport.jsx'),'utf8');
assert.match(xmlUI,/setPreviewReady\(Boolean\(data\.preview\.valid\)\)/);
const backoffice=fs.readFileSync(path.join(root,'frontend/src/pages/Backoffice.jsx'),'utf8');
assert.match(backoffice,/Διαγραφή όλου του προγράμματος/);
const profile=fs.readFileSync(path.join(root,'frontend/src/pages/StationProfile.jsx'),'utf8');
assert.match(profile,/ir-station-top-grid/);
assert.match(profile,/StationScheduleTimeline/);
console.log('PASS: XML/JSON discovery, Deseo ISO days, mapping, atomic replacement, scoped clear, SSRF guard, station profile');
