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
  assert.equal(faq.mainEntity.length,5);
  assert.match(faq.mainEntity[0].acceptedAnswer.text,/Ελληνική μουσική/);
  assert.match(faq.mainEntity[2].acceptedAnswer.text,/Δοκιμαστικός Παραγωγός/);
  assert.match(faq.mainEntity[3].acceptedAnswer.text,/30 λεπτών/);
  assert.match(faq.mainEntity[4].acceptedAnswer.text,/Αθήνα/);
  delete st.city;
  st.schedule=[];
  assert.equal(core.stationSeo(st).faq.length,4);
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

test('station snippets use published description, programme, genre and locality without invented facts',()=>{
  const st=station();
  const seo=core.stationSeo(st);
  assert.match(seo.description,/Αληθινές μουσικές/);
  assert.match(seo.description,/Πρωινή Ζώνη/);
  assert.match(seo.description,/Ελληνική μουσική/);
  assert.ok(seo.description.length<=158);
  st.description='Πρωινή Ζώνη · Ελληνική μουσική · Αθήνα';
  const repeated=core.stationSeo(st).description;
  assert.equal((repeated.match(/Πρωινή Ζώνη/g)||[]).length,1);
  assert.equal((repeated.match(/Ελληνική μουσική/g)||[]).length,1);
  assert.equal((repeated.match(/Αθήνα/g)||[]).length,1);
});
test('schema includes only declared subgenres, frequencies and programme hosts',()=>{
  const st=station();
  st.transmissionType='Επίγειο';
  st.frequency='98.7 FM';
  const radio=core.stationSeo(st).ld['@graph'].find(x=>x['@type']==='RadioStation');
  assert.deepEqual(radio.genre,['Ελληνική μουσική','Έντεχνα']);
  assert.equal(radio.broadcastFrequency,'98.7 FM');
  assert.equal(radio.slogan,'Η μουσική σου');
  assert.equal(core.stationSeo({...st,transmissionType:'Web Radio'}).ld['@graph']
    .find(x=>x['@type']==='RadioStation').broadcastFrequency,undefined);
});
test('only trusted station social URLs are linked in prerender',()=>{
  const st=station();
  st.website='https://example.org/';
  st.facebook='http://insecure.example.org/';
  st.instagram='javascript:alert(1)';
  assert.deepEqual(core.links(st),['https://example.org/']);
});

test('smart FAQ returns at most five distinct verifiable answers, including Athens schedule',()=>{
  const st=station();
  st.schedule=[
    {day:1,startTime:'08:00',endTime:'10:00',title:'Πρωινό',host:'Αλέξης'},
    {day:1,startTime:'10:00',endTime:'11:00',title:'Μουσική Ωρα',host:'Μαρία'},
    {day:3,startTime:'11:00',endTime:'12:00',title:'Τετάρτη Live',host:'Αλέξης'}
  ];
  const monday=core.stationFaq(st,new Date('2026-11-16T09:00:00Z'));
  assert.equal(monday.length,5);
  assert.equal(new Set(monday.map(x=>x.q)).size,5);
  assert.match(monday[1].q,/σήμερα/);
  assert.match(monday[1].a,/Πρωινό.*08:00.*Δευτέρα|Πρωινό.*Δευτέρα 08:00/);
  assert.match(monday[1].a,/Μουσική Ωρα/);
  assert.match(monday[2].a,/Αλέξης/);
  assert.match(monday[2].a,/Μαρία/);
  assert.match(monday[3].a,/επιβεβαιωμένο email/);
  assert.doesNotMatch(JSON.stringify(monday),/PRIVATE SONG|PREMIUM SECRET/);
  assert.deepEqual(core.stationSeo(st).faq.map(x=>x.q),
    core.stationSeo(st).ld['@graph'].find(x=>x['@type']==='FAQPage')
      .mainEntity.map(x=>x.name));
});
test('no schedule does not generate fictional shows or presenter names',()=>{
  const st=station();
  st.genre='';
  st.schedule=[];
  delete st.city;
  delete st.region;
  st.website='https://example.com';
  st.privatePlaylist=[{title:'PRIVATE SONG',artist:'PRIVATE ARTIST'}];
  const faq=core.stationFaq(st);
  assert.equal(faq.length,2);
  assert.ok(faq.every(item=>item.q&&item.a));
  assert.doesNotMatch(JSON.stringify(faq),/Ποιοι παραγωγοί|Ποιες εκπομπές|PRIVATE SONG|PRIVATE ARTIST/);
});
test('FAQ mentions FM only for genuine terrestrial frequency, never web stations',()=>{
  const st=station();
  st.frequency='99.9 FM';
  st.transmissionType='Επίγειο';
  assert.match(core.stationFaq(st).at(-1).a,/99.9 FM/);
  st.transmissionType='Web Radio';
  assert.doesNotMatch(JSON.stringify(core.stationFaq(st)),/99.9 FM/);
});
