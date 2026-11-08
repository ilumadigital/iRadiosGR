'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rss=require('../backend/utils/rssNews');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
assert.equal(rss.validateUrl(rss.DEFAULT_FEED_URL),rss.DEFAULT_FEED_URL);
for(const url of [
  'http://rss.app/feeds/a.xml','https://example.com/feeds/a.xml',
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
assert.ok(read('backend/utils/stagePublicAccess.js').includes("'/api/newsfeed'"));
assert.ok(read('backend/routes/newsFeedRoutes.js').includes("authorizeRoles('admin')"));
const ui=read('frontend/src/pages/NewsFeed.jsx');
assert.ok(ui.includes("new Intl.RelativeTimeFormat('el-GR'"),'client-local relative age');
assert.ok(ui.includes("view==='grid'")&&ui.includes("view==='list'"),'grid and list');
assert.ok(!ui.includes('MapMode'),'news has no map');
assert.ok(ui.includes('<EditorialPlacement placement="news"'),'existing slide and promoted presentation');
assert.ok(read('frontend/src/pages/AdminNewsFeed.jsx').includes('Συγχρονισμός τώρα'));
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
  const model=read('backend/models/NewsFeed.js');
  assert.ok(model.includes('sources:{type:[source]')&&model.includes('sourceId:')&&model.includes("'rssnews_preset'"));
  const controller=read('backend/controllers/newsFeedController.js');
  assert.ok(controller.includes('Promise.all(sources.map'),'sources sync independently');
  assert.ok(controller.includes('configRevision'),'changed source sets cannot be overwritten by old import');
  assert.ok(read('frontend/src/pages/AdminNewsFeed.jsx').includes('Προσθήκη publishers'));
  console.log('Google News publication URL, fallback, source attribution, image and security regression checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
