'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
process.env.FRONTEND_URL=process.env.FRONTEND_URL||'https://stage.iradios.gr';
const llms=require('../services/seo2Llms');
const {stationSeo}=require('../services/seo2Core');
const sample=()=>({
  _id:'507f1f77bcf86cd799439011',slug:'sample-fm',status:'approved',
  name:'Sample FM',slogan:'Η μουσική σου',description:'Ελληνική μουσική κάθε μέρα.',
  genre:'Ελληνικά',secondaryGenre:'Έντεχνα',secondaryGenres:['Rock'],
  city:'Αθήνα',prefecture:'Κεντρικός Τομέας Αθηνών',region:'Αττική',
  country:'Ελλάδα',transmissionType:'Επίγειο',frequency:'97.6 FM',
  logo:'/media/logo/test.png',cover:'/media/radioassets/test/cover.png',
  website:'https://example.org',facebook:'https://facebook.com/sample',
  scheduleDayBase:1,schedule:[{day:1,startTime:'09:00',endTime:'11:00',
    title:'Πρωινή Εκπομπή',host:'Μαρία',description:'Πρωινή ενημέρωση.'}]
});
test('allowlist excludes secrets, phone, email, playlist, ads, stream and pending edits',()=>{
  for(const field of ['email','phone','viber','stream','metadata','pendingEdits',
    'scheduleFeed','dspSettings','broadcasterId','currentAI','privatePlaylist',
    'deletionLockToken','billing']) {
    assert.ok(!llms.LLMS_STATION_FIELDS.split(' ').includes(field),field);
  }
  assert.ok(llms.LLMS_STATION_FIELDS.includes('schedule'));
});
test('all approved-station entries can be rendered without 25 or 40 station truncation',()=>{
  const fixtures=Array.from({length:101},(_,i)=>({
    ...sample(),_id:String(i).padStart(24,'0'),slug:'s-'+i,name:'Station '+i
  }));
  const markdown=fixtures.map(llms.stationEntry).join('');
  assert.equal((markdown.match(/Πλήρες προφίλ|Αναλυτικά/g)||[]).length,101);
  assert.match(markdown,/Station 100/);
  assert.match(markdown,/Ελληνική μουσική/);
});
test('full Markdown profile contains profile, schedule, 5 FAQs, canonical, OG and schema',()=>{
  const st=sample(),doc=llms.stationDetails(st);
  assert.match(doc,/## Περιγραφή/);
  assert.match(doc,/97\.6 FM/);
  assert.match(doc,/Πρωινή Εκπομπή/);
  assert.match(doc,/Πρωινή ενημέρωση/);
  assert.match(doc,/Μαρία/);
  assert.match(doc,/Europe\/Athens/);
  assert.match(doc,/## Δημόσιες συχνές ερωτήσεις/);
  assert.match(doc,/\/llms\/schema\/stations\/sample-fm\.jsonld/);
  assert.match(doc,/\/station\/sample-fm/);
  assert.match(doc,/\/og-image\/sample-fm\.png/);
  assert.deepEqual(llms.schemaForStation(st),stationSeo(st).ld);
  assert.equal(llms.schemaForStation(st)['@graph']
    .find(x=>x['@type']==='FAQPage').mainEntity.length,5);
});
test('confidential data is neither emitted in list nor detailed pages nor schema',()=>{
  const st=sample();
  st.stream='https://private.example/secret-stream';
  st.email='hidden-station@example.org';
  st.phone='+306900000000';
  st.pendingEdits={description:'PRIVATE DRAFT'};
  st.privatePlaylist=[{artist:'PRIVATE ARTIST',title:'PRIVATE TRACK'}];
  st.currentAI={title:'PREMIUM SECRET'};
  for(const doc of [llms.stationEntry(st),llms.stationDetails(st),
    JSON.stringify(llms.schemaForStation(st))])
    assert.doesNotMatch(doc,/secret-stream|hidden-station|6900000000|PRIVATE DRAFT|PRIVATE ARTIST|PRIVATE TRACK|PREMIUM SECRET/);
});
test('Markdown injection and invalid media URLs cannot insert arbitrary markup or scripts',()=>{
  const st=sample();
  st.name='Station [bad](https://evil.example) <script>alert(1)</script>';
  st.description='Intro\n# Injected heading <img src=x onerror=alert(1)>';
  st.logo='javascript:alert(1)';st.cover='//intranet.local/private';
  st.website='javascript:alert(1)';
  const doc=llms.stationDetails(st);
  assert.doesNotMatch(doc,/<script|<img|javascript:|intranet.local/);
  assert.match(doc,/\\\[/);
  assert.match(doc,/\\#/);
});
test('directory links point to actual public HTML with encoded Unicode segments',()=>{
  const url=llms.indexes(['Έντεχνα & Rock'],['Δυτική Αττική']);
  assert.match(url,/\/llms\/categories\/%CE%88/);
  assert.match(url,/\/genre\/%CE%88/);
  assert.match(url,/\/llms\/regions\/%CE%94/);
  assert.match(llms.directoryIntro('category','Έντεχνα'),/\/genre\//);
  assert.match(llms.directoryIntro('region','Αττική'),/\/region\//);
});
test('application schema uses same trusted home schema and includes app/website types',()=>{
  const nodes=llms.schemaForApplication([sample()])['@graph'];
  assert.ok(nodes.some(x=>x['@type']==='WebApplication'));
  assert.ok(nodes.some(x=>x['@type']==='WebSite'));
  assert.ok(nodes.some(x=>x['@type']==='Organization'));
  assert.ok(nodes.some(x=>x['@type']==='CollectionPage'));
  assert.match(llms.applicationDocument(),/privacy|δεδομένα|δεδομένων/i);
});
test('routes use approved-only Mongo filters, cursors and do not touch private playlist',()=>{
  const router=fs.readFileSync(path.join(__dirname,'../services/seo2Routes.js'),'utf8');
  const llmsRoutes=router.slice(router.indexOf('// Full dynamic LLMS 2.0:'),router.indexOf("router.get('/sitemap.xml'"));
  assert.match(llmsRoutes,/\.cursor\(\{batchSize:128\}\)/);
  assert.match(llmsRoutes,/Station\.find\(query\)/);
  assert.match(llmsRoutes,/streamStations\(res,ONLY_APPROVED/);
  assert.match(llmsRoutes,/\.select\(LLMS_STATION_FIELDS\)/);
  assert.match(llmsRoutes,/\.{3}ONLY_APPROVED/);
  assert.doesNotMatch(llmsRoutes,/StationPlaylist|privatePlaylist|MAX_HISTORY_TRACKS/);
  assert.match(router,/router\.get\('\/llms-full\.txt'/);
  assert.match(router,/router\.get\('\/llms\/stations\/:slug\.md'/);
  assert.match(router,/router\.get\('\/llms\/schema\/stations\/:slug\.jsonld'/);
  const nginx=fs.readFileSync(path.join(__dirname,'../../ops/nginx-stage.conf'),'utf8');
  assert.match(nginx,/location = \/llms-full\.txt/);
  assert.match(nginx,/location \^~ \/llms\//);
});
