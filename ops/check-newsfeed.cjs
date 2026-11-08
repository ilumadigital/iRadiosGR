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
