'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rss=require('../backend/utils/rssNews');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
assert.equal(rss.validateUrl(rss.DEFAULT_FEED_URL),rss.DEFAULT_FEED_URL);
for(const url of [
  'http://rss.app/feeds/a.xml','http://www.newsbeast.gr/feed',
  'https://rss.app.evil.test/feeds/a.xml','https://rss.app@evil.test/feeds/a.xml',
  'https://rss.app/feeds/../admin','https://rss.app/feeds/a.xml?callback=x'
])assert.throws(()=>rss.validateUrl(url),'RSS source SSRF guard rejects '+url);
const xml=`<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel><title>iRadios &amp; News</title>
<item><title><![CDATA[Ειδήσεις &amp; Νέα]]></title><link>https://news.example/a</link>
<pubDate>Sun, 08 Nov 2026 17:00:00 GMT</pubDate>
<description><![CDATA[<p>Πρώτο &amp; δεύτερο</p>]]></description>
<media:content url="https://news.example/photo.jpg" medium="image"/></item>
<item><title>Διπλό</title><link>https://news.example/a</link></item>
<item><title>Νεότερο</title><link>https://news.example/b</link>
<pubDate>Sun, 08 Nov 2026 17:20:00 GMT</pubDate>
<description><![CDATA[<img src="https://news.example/fallback.webp"><p>Σύνοψη</p>]]></description></item>
</channel></rss>`;
const parsed=rss.parse(xml);
assert.equal(parsed.articles.length,2,'duplicate links must be removed');
assert.equal(parsed.articles[0].title,'Νεότερο');
assert.equal(parsed.articles[0].imageUrl,'https://news.example/fallback.webp');
assert.equal(parsed.articles[1].title,'Ειδήσεις & Νέα');
assert.equal(parsed.articles[1].summary,'Πρώτο & δεύτερο');
assert.equal(parsed.articles[1].imageUrl,'https://news.example/photo.jpg');
assert.equal(parsed.articles[1].publishedAt.toISOString(),'2026-11-08T17:00:00.000Z');
assert.throws(()=>rss.parse('<html>not RSS</html>'));
const newsbeastSources=require('../backend/utils/newsbeastSources');
const sectionSlugs=['greece','world','politiki','financial','sports','society',
  'environment','media','entertainment','travel','lifestyle','technology','car','moto'];
const sectionNames=['Ελλάδα','Κόσμος','Πολιτική','Οικονομία','Αθλητικά','Κοινωνία',
  'Περιβάλλον','Media','Διασκέδαση','Ταξίδι','Lifestyle','Τεχνολογία','Auto','Μότο'];
assert.equal(newsbeastSources.feeds.length,14,'all 14 requested sections are seeded');
assert.deepEqual(newsbeastSources.feeds.map(f=>f.slug),sectionSlugs);
assert.deepEqual(newsbeastSources.feeds.map(f=>f.category),sectionNames);
assert.equal(newsbeastSources.sources().length,14);
for(let i=0;i<14;i++){
  const feed=newsbeastSources.feeds[i];
  assert.equal(feed.url,'https://www.newsbeast.gr/'+sectionSlugs[i]+'/feed');
  assert.equal(newsbeastSources.categoryOfUrl(feed.url),sectionNames[i]);
  assert.equal(rss.normalizeSource(feed.url).type,'direct_rss');
  const sectionXml='<rss><channel><title>Newsbeast</title><item>'+
    '<title>Αυτόματη αναγνώριση</title><link>https://www.newsbeast.gr/'+sectionSlugs[i]+'/article</link>'+
    '</item></channel></rss>';
  assert.equal(rss.parse(sectionXml,{feedUrl:feed.url}).articles[0].category,sectionNames[i],
    'section category inferred even when RSS article has no category tag');
}
assert.equal(newsbeastSources.categoryOfUrl('https://different-publisher.gr/greece/feed'),'');
assert.ok(read('backend/controllers/newsFeedController.js').includes("process.env.APP_ENV==='staging'&&doc.bootstrapVersion!==initialPreset.VERSION"),
  'one-time migration is staging-only');
assert.ok(read('backend/controllers/newsFeedController.js').includes('$inc:{configRevision:1}'),
  'source bootstrap increments config revision');
assert.ok(read('backend/controllers/newsFeedController.js').includes('category:s.category||article.category'),
  'direct section category is always retained on published articles');
assert.ok(read('backend/controllers/newsFeedController.js').includes("const CACHE_MS=10*60*1000,RETRY_MS=10*60*1000,MAX_SOURCES=32"),
  'up to 32 feeds can be managed with ten-minute refresh cadence');
assert.ok(read('frontend/src/pages/AdminNewsFeed.jsx').includes('const MAX_SOURCES=32;'),
  'admin source limit matches backend');
const directTransport=require('../backend/utils/publicRssTransport');
assert.equal(rss.normalizeSource('https://www.newsbeast.gr/feed').type,'direct_rss');
assert.equal(rss.normalizeSource('https://www.newsbeast.gr/feed').domain,'www.newsbeast.gr');
assert.equal(rss.validateUrl('https://www.newsbeast.gr/greece/feed'),'https://www.newsbeast.gr/greece/feed');
assert.equal(rss.normalizeSource('https://www.example-news.gr/feed.xml').type,'direct_rss');
for(const bad of [
  'https://localhost/feed','https://127.0.0.1/feed','https://169.254.169.254/feed',
  'https://192.168.1.1/rss','https://[::1]/feed','https://newsbeast.gr:8443/feed',
  'https://newsbeast.gr@127.0.0.1/feed','https://newsbeast.gr.evil.local/feed',
  'https://newsbeast.gr/private','ftp://www.newsbeast.gr/feed',
  'https://www.newsbeast.gr/feed#tracking'
])assert.throws(()=>rss.normalizeSource(bad),'external RSS URL is safely constrained: '+bad);
for(const ip of ['127.0.0.1','169.254.169.254','10.0.0.4','172.16.2.3',
  '192.168.1.4','100.100.100.100','0.0.0.0','192.0.2.1','203.0.113.4',
  '::1','fc00::123','fe80::1','::ffff:127.0.0.1','2001:db8::2'])
  assert.equal(directTransport.publicIp(ip),false,'local/reserved DNS IP rejected: '+ip);
for(const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111'])
  assert.equal(directTransport.publicIp(ip),true,'public DNS IP allowed: '+ip);
const newsbeastXml=String.raw`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel><title>Newsbeast</title>
<item><title><![CDATA[Πρώτη είδηση – Ελλάδα]]></title>
<link>https://www.newsbeast.gr/greece/arthro1</link>
<category><![CDATA[ΕΛΛΑΔΑ]]></category>
<description><![CDATA[<p>Το νέο σημαντικό γεγονός.</p>]]></description>
<media:content url="https://www.newsbeast.gr/photos/greece.webp" medium="image" />
<pubDate>Sun, 08 Nov 2026 18:30:00 +0000</pubDate></item>
<item><title><![CDATA[Οικονομικές ειδήσεις]]></title>
<link>https://www.newsbeast.gr/financial/arthro2</link>
<category><![CDATA[ΟΙΚΟΝΟΜΙΑ]]></category>
<content:encoded><![CDATA[<p>Η σημερινή οικονομία</p>]]></content:encoded>
<pubDate>Sun, 08 Nov 2026 18:15:00 +0000</pubDate></item>
<item><title>Νέα στην τεχνολογία</title>
<link>https://www.newsbeast.gr/technology/arthro3</link>
<description><![CDATA[<img data-src="https://www.newsbeast.gr/photos/tech.webp" /><p>Καινοτομία.</p>]]></description>
<pubDate>Sun, 08 Nov 2026 18:00:00 +0000</pubDate></item>
</channel></rss>`;
const extracted=rss.parse(newsbeastXml,{feedUrl:'https://www.newsbeast.gr/feed'});
assert.equal(extracted.feedTitle,'Newsbeast');
assert.deepEqual(extracted.articles.map(a=>a.category),['Ελλάδα','Business','Τεχνολογία']);
assert.deepEqual(extracted.articles.map(a=>a.title),['Πρώτη είδηση – Ελλάδα','Οικονομικές ειδήσεις','Νέα στην τεχνολογία']);
assert.equal(extracted.articles[0].imageUrl,'https://www.newsbeast.gr/photos/greece.webp');
assert.equal(extracted.articles[1].imageUrl,'');
assert.equal(extracted.articles[2].imageUrl,'https://www.newsbeast.gr/photos/tech.webp');
assert.equal(extracted.articles[1].summary,'Η σημερινή οικονομία');
assert.equal(extracted.articles[0].publishedAt.toISOString(),'2026-11-08T18:30:00.000Z');
const atomWithCategory=`<feed xmlns="http://www.w3.org/2005/Atom">
<title>Atom Publisher</title>
<entry><title>Article title</title><link href="https://site.example.com/post"/>
<category term="Sports"/><updated>2026-11-08T18:30:00+02:00</updated></entry>
</feed>`;
assert.equal(rss.parse(atomWithCategory).articles[0].category,'Αθλητικά');

assert.ok(read('backend/utils/stagePublicAccess.js').includes("'/api/newsfeed'"));
assert.ok(read('backend/routes/newsFeedRoutes.js').includes("authorizeRoles('admin')"));
const ui=read('frontend/src/pages/NewsFeed.jsx');
assert.ok(ui.includes("new Intl.RelativeTimeFormat('el-GR'"),'client-local relative age');
assert.ok(ui.includes("view==='grid'")&&ui.includes("view==='list'"),'grid and list');
assert.ok(!ui.includes('MapMode'),'news has no map');
assert.ok(ui.includes('<EditorialPlacement placement="news"'),'existing slide and promoted presentation');
assert.ok(read('frontend/src/pages/AdminNewsFeed.jsx').includes('Συγχρονισμός τώρα'));
// Ten-minute feed scheduling must be independent of listener visits.
const scheduler=read('backend/utils/newsFeedScheduler.js');
const controllerText=read('backend/controllers/newsFeedController.js');
const newsRoutes=read('backend/routes/newsFeedRoutes.js');
assert.ok(scheduler.includes("cron.schedule('*/10 * * * *',run)"),'backend imports every ten minutes');
assert.ok(scheduler.includes('mongoose.connection.asPromise().then(run)'),'initial refresh after MongoDB startup');
assert.ok(newsRoutes.includes("require('../utils/newsFeedScheduler').start()"),'news scheduler wired to backend boot');
assert.ok(controllerText.includes('exports.refreshInBackground=async()=>'),'shared backend refresh action');
assert.ok(controllerText.includes('if(!doc.enabled)return doc'),'disabled newsfeeds are not polled');
assert.ok(controllerText.includes('MAX_ARTICLES=500')&&controllerText.includes('.slice(0,MAX_ARTICLES)'),
  'newsfeed retains at most 500 articles');
assert.ok(controllerText.includes('res.status(202).json({...currentView(doc),syncing:true})'),
  'manual refresh acknowledges work immediately');
assert.ok(controllerText.includes('exports.removeArticle=async(req,res)=>'),
  'admin article moderation is implemented');
const initialPreset=read('backend/utils/newsFeedInitialPreset.js');
assert.ok(initialPreset.includes('rssnews-selected-2026-11-08-v1')&&
  initialPreset.includes('feeds.feedburner.com'),'staging has selected 25 RSS publishers');

assert.ok(controllerText.includes('if(doc.enabled&&!doc.articles.length&&!pending)'),
  'public requests may bootstrap without blocking the browser');
assert.ok(controllerText.includes('sync(doc).catch('),
  'first-ever bootstrap runs asynchronously without blocking the Newsfeed');
assert.ok(!controllerText.includes('if(doc.articles.length)sync(doc)'), 'visitor GETs do not refresh providers');
assert.ok(controllerText.includes('refreshIntervalSeconds:600'),'public API advertises ten-minute schedule');
assert.ok(controllerText.includes("(normalizeSource(source).categories||[]).forEach(add)"),
  'filter options include every configured rssnews.io category, even if an article is unavailable');
assert.ok(controllerText.includes('articles.forEach(a=>add(a.category))'),
  'filter options support categories returned by additional sources');
const heroAt=ui.indexOf('<EditorialPlacement placement="news"');
const filterAt=ui.indexOf('<section aria-label="Φίλτρα κατηγοριών ειδήσεων"');
const articlesAt=ui.indexOf('<section aria-label="Ροή ειδήσεων"');
assert.ok(heroAt>=0&&filterAt>heroAt&&articlesAt>filterAt,'filters positioned below editorial advertisement');
assert.ok(ui.includes("aria-pressed={active}")&&ui.includes("selectedCategory==='all'?ordered:ordered.filter"),
  'accessible interactive filtering');
assert.ok(ui.includes('overflow-x-auto')&&ui.includes('sm:flex-wrap'),'mobile horizontal filters');
assert.ok(ui.includes('{filtered.map((item,index)'),'grid and list render only selected category');
assert.ok(ui.includes("document.addEventListener('visibilitychange',onVisibility)"),
  'returning to an open news tab revalidates the cached snapshot');
console.log('Newsfeed ten-minute backend schedule and accessible category filter contracts passed.');
console.log('Newsfeed RSS parsing, safety, image, dates, deduplication, placements and admin contracts passed.');

(async()=>{
  const publisherUrl='https://news.google.com/publications/CAAqKAgKIiJDQklTRXdnTWFnOEtEV2xsWm1sdFpYSnBaR0V1WjNJb0FBUAE?ceid=GR:el&oc=3';
  const publisher=rss.normalizeSource({url:publisherUrl});
  assert.equal(publisher.type,'google_publisher');
  assert.equal(publisher.domain,'iefimerida.gr','publisher ID can reveal its domain for a safe RSS search fallback');
  assert.equal(publisher.url,'https://news.google.com/publications/CAAqKAgKIiJDQklTRXdnTWFnOEtEV2xsWm1sdFpYSnBaR0V1WjNJb0FBUAE?ceid=GR%3Ael');
  assert.equal(new URL(rss.googleEndpoint(publisher)).pathname,
    '/rss/publications/CAAqKAgKIiJDQklTRXdnTWFnOEtEV2xsWm1sdFpYSnBaR0V1WjNJb0FBUAE');
  const fallback=new URL(rss.googleDomainEndpoint(publisher));
  assert.equal(fallback.hostname,'news.google.com');
  assert.equal(fallback.searchParams.get('q'),'site:iefimerida.gr when:7d');
  const search=rss.normalizeSource('https://news.google.com/search?q=site%3Aexample.gr&ceid=GR%3Ael');
  assert.equal(search.type,'google_rss');
  assert.equal(new URL(search.url).pathname,'/rss/search');
  for(const url of [
    'https://news.google.com/private','http://news.google.com/publications/CAAqKAgKIiJDQklTRXdnTWFnOEtEV2xsWm1sdFpYSnBaR0V1WjNJb0FBUAE',
    'https://news.google.com.evil.test/publications/CAAqKAgKIiJDQklTRXdnTWFnOEtEV2xsWm1sdFpYSnBaR0V1WjNJb0FBUAE',
    'https://news.google.com@evil.test/publications/CAAqKAgKIiJDQklTRXdnTWFnOEtEV2xsWm1sdFpYSnBaR0V1WjNJb0FBUAE',
    'https://news.google.com/rss/search?ceid=GR:el',
    'https://rss.app/feeds/id.xml?redirect=http://localhost'
  ])assert.throws(()=>rss.normalizeSource(url),'unapproved fetch URL must be rejected');

  const googleXml=`<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <title>Ειδήσεις</title><copyright>Personal use only</copyright>
  <item><title>Πρώτη είδηση - iEfimerida</title><link>https://news.google.com/rss/articles/abc</link>
    <source url="https://www.iefimerida.gr">iEfimerida</source>
    <description><![CDATA[<ol><li><a href="https://news.google.com">Related coverage</a></li></ol>]]></description>
    <media:thumbnail url="https://img.example.com/news.jpg"/>
    <pubDate>Sun, 08 Nov 2026 17:20:00 GMT</pubDate></item>
  <item><title>Από άλλον εκδότη</title><link>https://news.google.com/rss/articles/other</link>
    <source url="https://otherpublisher.gr">Other</source><pubDate>Sun, 08 Nov 2026 16:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const parsedGoogle=rss.parse(googleXml,{google:true,publisherDomain:'iefimerida.gr'});
  assert.equal(parsedGoogle.articles.length,1,'publisher-domain fallback must exclude other publishers');
  assert.equal(parsedGoogle.articles[0].title,'Πρώτη είδηση');
  assert.equal(parsedGoogle.articles[0].summary,'','Google related-story listings are not article descriptions');
  assert.equal(parsedGoogle.articles[0].imageUrl,'https://img.example.com/news.jpg');
  assert.equal(parsedGoogle.articles[0].source,'iEfimerida');
  const calls=[],original=global.fetch;
  global.fetch=async url=>{
    calls.push(url);
    return String(url).includes('/rss/publications/')?
      new Response('unavailable',{status:404}):
      new Response(googleXml,{status:200,headers:{'Content-Type':'application/rss+xml'}});
  };
  try{
    const downloaded=await rss.download(publisher);
    assert.equal(downloaded.retrievalMode,'domain-search');
    assert.equal(downloaded.articles.length,1);
    assert.equal(calls.length,2,'publisher RSS failure triggers one domain search fallback');
    assert.ok(calls.every(u=>new URL(u).hostname==='news.google.com'),'no untrusted site is fetched');
  }finally{global.fetch=original;}
  // rssnews.io shares a page/category configuration, not an XML endpoint.
  // The supported adapter maps those categories to fixed publisher RSS feeds.
  const preset=require('../backend/utils/rssNewsPreset');
  const userLink='https://rssnews.io/?feed=my&c=%CE%95%CE%BB%CE%BB%CE%AC%CE%B4%CE%B1%2CBusiness%2CEducation%2C%CE%9A%CF%8C%CF%83%CE%BC%CE%BF%CF%82%2C%CE%91%CE%B8%CE%BB%CE%B7%CF%84%CE%B9%CE%BA%CE%AC%2C%CE%A4%CE%B5%CF%87%CE%BD%CE%BF%CE%BB%CE%BF%CE%B3%CE%AF%CE%B1';
  const normalizedPreset=rss.normalizeSource(userLink);
  assert.equal(normalizedPreset.type,'rssnews_preset');
  assert.deepEqual(normalizedPreset.categories,['Ελλάδα','Business','Education','Κόσμος','Αθλητικά','Τεχνολογία']);
  assert.equal(preset.uniqueFeeds(normalizedPreset).length,11);
  assert.equal(rss.normalizeSource(normalizedPreset.url).url,normalizedPreset.url);
  assert.equal(rss.normalizeSource('https://rssnews.io/?feed=my&c=Παιδεία,Οικονομία').categories.join(','),'Education,Business');
  for(const url of [
    'http://rssnews.io/?feed=my&c=Ελλάδα',
    'https://rssnews.io.evil.net/?feed=my&c=Ελλάδα',
    'https://rssnews.io@localhost/?feed=my&c=Ελλάδα',
    'https://rssnews.io/?feed=my&c=Ελλάδα&redirect=https://localhost',
    'https://rssnews.io/?feed=all&c=Ελλάδα',
    'https://rssnews.io/private?feed=my&c=Ελλάδα',
    'https://rssnews.io/?feed=my&c=not-a-category'
  ])assert.throws(()=>rss.normalizeSource(url),'do not fetch arbitrary or invalid preset links');
  assert.equal(preset.safePublisherPage('https://www.newsbeast.gr/article/1',
    'https://www.newsbeast.gr/greece/feed'),'https://www.newsbeast.gr/article/1');
  for(const url of ['http://www.newsbeast.gr/article','https://127.0.0.1/admin',
    'https://www.newsbeast.gr@evil.net/private','https://www.newsbeast.gr.evil.net/foo',
    'https://www.newsbeast.gr:8443/news','https://localhost/'])assert.equal(
      preset.safePublisherPage(url,'https://www.newsbeast.gr/greece/feed'),'','safe OG image page guard');
  assert.equal(preset.extractImage('<meta content="https://cdn.example.com/photo.jpg" property="og:image"/>',
    'https://www.newsbeast.gr/a'),'https://cdn.example.com/photo.jpg');
  const originalPresetFetch=global.fetch,requests=[];
  global.fetch=async url=>{
    const target=new URL(url),host=target.hostname;
    requests.push(target.href);
    assert.ok(['www.newsbeast.gr','www.pes.gr','www.alfavita.gr','www.esos.gr'].includes(host),
      'preset never fetches another host');
    if(target.pathname.endsWith('/feed')||target.pathname.endsWith('/feed/')||
       target.pathname==='/rss.xml'){
      const slug=target.pathname.replace(/[^a-z0-9]/gi,'-');
      const itemUrl='https://'+host+'/news'+slug;
      return new Response('<rss version="2.0"><channel><title>'+host+'</title><item>'+
        '<title>News from '+slug+'</title><link>'+itemUrl+'</link>'+
        '<pubDate>Sun, 08 Nov 2026 17:00:00 GMT</pubDate></item></channel></rss>',
        {status:200,headers:{'content-type':'application/rss+xml'}});
    }
    return new Response('<html><head><meta property="og:image" '+
      'content="https://cdn.example.com/'+host+'/cover.jpg"/></head></html>',{
      status:200,headers:{'content-type':'text/html'}});
  };
  try{
    const imported=await rss.download(normalizedPreset);
    assert.equal(imported.retrievalMode,'publisher-rss-images');
    assert.equal(imported.articles.length,11,'all 11 publisher feeds combined');
    assert.ok(imported.articles.every(a=>a.imageUrl.startsWith('https://cdn.example.com/')),
      'real og:image from each original publisher, not placeholder');
    assert.ok(imported.articles.some(a=>a.category==='Education'));
    assert.ok(requests.some(u=>u.includes('/news-')),'original publisher article pages used for image metadata');
    assert.ok(!requests.some(u=>new URL(u).hostname==='rssnews.io'),'preset is not falsely fetched as XML');
  }finally{global.fetch=originalPresetFetch;}
  const originalDirectFetch=directTransport.requestText;
  const directCalls=[];
  directTransport.requestText=async (url,options)=>{
    directCalls.push({url,options});
    return options?.feed?newsbeastXml:
      '<html><head><meta property="og:image" content="https://www.newsbeast.gr/photos/finance.webp"/></head></html>';
  };
  try{
    const feed=await rss.download({url:'https://www.newsbeast.gr/feed'});
    assert.equal(feed.retrievalMode,'direct-rss');
    assert.equal(feed.articles.length,3);
    assert.deepEqual(feed.articles.map(a=>a.category),['Ελλάδα','Business','Τεχνολογία']);
    assert.equal(feed.articles[1].imageUrl,'https://www.newsbeast.gr/photos/finance.webp',
      'missing RSS image is fetched from actual publisher OG metadata');
    assert.equal(directCalls.filter(x=>x.options?.html).length,1,'only missing publisher image needs extra fetch');
    assert.ok(directCalls.every(c=>new URL(c.url).hostname==='www.newsbeast.gr'),
      'image source is restricted to the original publisher');
  }finally{directTransport.requestText=originalDirectFetch;}
  const dns=require('node:dns');
  const oldLookup=dns.lookup;
  try{
    dns.lookup=(host,options,callback)=>callback(null,[{address:'127.0.0.1',family:4}]);
    await assert.rejects(new Promise((resolve,reject)=>directTransport.safeLookup('sample-public.com',{},(e,ip)=>e?reject(e):resolve(ip))),
      /DNS.*δημόσια/,'DNS-rebinding to private IP is prevented');
    dns.lookup=(host,options,callback)=>callback(null,[{address:'1.1.1.1',family:4}]);
    const pinned=await new Promise((resolve,reject)=>directTransport.safeLookup('sample-public.com',{},(e,ip)=>e?reject(e):resolve(ip)));
    assert.equal(pinned,'1.1.1.1','public DNS result is explicitly pinned');
  }finally{dns.lookup=oldLookup;}
  const model=read('backend/models/NewsFeed.js');
  assert.ok(model.includes('sources:{type:[source]')&&model.includes('sourceId:')&&model.includes("'rssnews_preset'")&&model.includes("'direct_rss'"));
  const controller=read('backend/controllers/newsFeedController.js');
  assert.ok(controller.includes('Promise.all(sources.map'),'sources sync independently');
  assert.ok(controller.includes('configRevision'),'changed source sets cannot be overwritten by old import');
  assert.ok(read('frontend/src/pages/AdminNewsFeed.jsx').includes('Προσθήκη publishers'));
  console.log('Newsbeast fourteen-section bootstrap, direct RSS category mapping, image and security checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
