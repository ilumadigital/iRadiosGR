'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../services/seo2Core');

const station=()=>({
  _id:'507f1f77bcf86cd799439011',
  slug:'example-fm',
  status:'approved',
  name:'Παράδειγμα FM',
  slogan:'Η μουσική σου',
  description:'Αληθινές μουσικές επιλογές, ενημέρωση και εκπομπές από την Αθήνα.',
  genre:'Ελληνική μουσική',
  secondaryGenres:['Έντεχνα'],
  city:'Αθήνα',
  region:'Αττική',
  country:'Ελλάδα',
  logo:'/media/logo/example.png',
  scheduleDayBase:1,
  schedule:[{day:1,startTime:'09:00',endTime:'11:00',title:'Πρωινή Ζώνη',
    host:'Δοκιμαστικός Παραγωγός',description:'Μουσική και ειδήσεις'}]
});
test('station metadata uses actual approved profile and stable canonical',()=>{
  const st=station(),seo=core.stationSeo(st);
  assert.match(seo.title,/Παράδειγμα FM.*Άκου ζωντανά/);
  assert.match(seo.description,/Αληθινές μουσικές/);
  assert.match(seo.url,/\/station\/example-fm$/);
  assert.match(seo.image,/\/og-image\/example-fm\.png\?v=[a-f0-9]{12}$/);
  assert.equal(seo.ld['@graph'][0].description,seo.description);
  assert.equal(seo.ld['@graph'].find(node=>node['@type']==='RadioStation').name,st.name);
});
test('never publishes a private playlist or ephemeral now-playing metadata',()=>{
  const st=station();
  st.privatePlaylist=[{artist:'PRIVATE ARTIST',title:'PRIVATE TRACK'}];
  st.nowPlaying='TRANSIENT SONG';
  const seo=core.stationSeo(st);
  assert.doesNotMatch(JSON.stringify(seo),/PRIVATE ARTIST|PRIVATE TRACK|TRANSIENT SONG/);
});
test('schedule aligns ISO weekdays and correct Athens calendar dates',()=>{
  const st=station();
  const events=core.upcomingEvents(st,new Date('2026-11-16T10:00:00Z'));
  assert.equal(events.length,1);
  assert.match(events[0].startDate,/^2026-11-16T09:00:00\+02:00$/);
  assert.match(events[0].endDate,/^2026-11-16T11:00:00\+02:00$/);
});
test('legacy untagged Monday-zero schedules remain understood without writes',()=>{
  const st=station();
  delete st.scheduleDayBase;
  st.schedule=[{day:0,startTime:'09:00',endTime:'10:00',title:'Παλιό πρόγραμμα'}];
  assert.equal(core.normalizedSchedule(st)[0].day,1);
  assert.equal(core.upcomingEvents(st,new Date('2026-11-16T10:00:00Z')).length,1);
});
test('split midnight stays valid and never creates a time-only schema date',()=>{
  const st=station();
  st.schedule=[{day:1,startTime:'23:00',endTime:'24:00',title:'Νυχτερινή εκπομπή'}];
  const [event]=core.upcomingEvents(st,new Date('2026-11-16T10:00:00Z'));
  assert.equal(event.endDate,'2026-11-17T00:00:00+02:00');
});
test('summer date uses daylight saving zone and winter uses standard time',()=>{
  const st=station();
  const winter=core.upcomingEvents(st,new Date('2026-11-16T10:00:00Z'));
  const summer=core.upcomingEvents(st,new Date('2026-07-13T10:00:00Z'));
  assert.match(winter[0].startDate,/\+02:00$/);
  assert.match(summer[0].startDate,/\+03:00$/);
});
test('FAQ JSON-LD is grounded in visible station facts',()=>{
  const st=station(),seo=core.stationSeo(st);
  const faq=seo.ld['@graph'].find(x=>x['@type']==='FAQPage');
  assert.equal(faq.mainEntity.length,3);
  assert.match(faq.mainEntity[1].acceptedAnswer.text,/Αθήνα/);
  delete st.city;
  st.schedule=[];
  assert.equal(core.stationSeo(st).faq.length,1);
});
test('escapes HTML, attributes and XML safely',()=>{
  assert.equal(core.escapeHtml('<script>" & \'test'), '&lt;script&gt;&quot; &amp; &#39;test');
  assert.equal(core.escapeXml('&city=Θεσσαλονίκη'),'&amp;city=Θεσσαλονίκη');
});
test('OG image URL is revisioned when branding or profile facts change',()=>{
  const st=station(),old=core.stationSeo(st).image;
  st.cover='/media/radioassets/example/cover.png';
  assert.notEqual(core.stationSeo(st).image,old);
});
test('directory item lists contain only supplied genuine stations',()=>{
  const seo=core.directorySeo({type:'genre',name:'Ελληνική μουσική',stations:[station()]});
  assert.match(seo.url,/\/genre\/.+$/);
  const items=seo.ld['@graph'].find(x=>x['@type']==='ItemList').itemListElement;
  assert.equal(items.length,1);
  assert.equal(items[0].name,station().name);
});
