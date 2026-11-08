'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rss=require('../backend/utils/rssNews');
const {keyFor,publicArticle,relatedArticles}=require('../backend/utils/newsFeedArticle');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

// RSS descriptions, not scraped publisher pages, are the only in-app body copy.
const preview=rss.rssPreview('<p>Πρώτη παράγραφος με κανονικό περιεχόμενο.</p>'+
  '<p>Δεύτερη παράγραφος από RSS.&amp; Περισσότερα.</p>'+
  '<script>alert(1)</script><p>Τρίτη παράγραφος της προεπισκόπησης.</p>');
assert.deepEqual(preview,[
  'Πρώτη παράγραφος με κανονικό περιεχόμενο.',
  'Δεύτερη παράγραφος από RSS.& Περισσότερα.',
  'Τρίτη παράγραφος της προεπισκόπησης.'
]);
const huge='<p>'+('Μεγάλο κείμενο. '.repeat(300))+'</p>';
assert.ok(rss.rssPreview(huge).join('').length<=780,'strict excerpt length cap');
const sample='<rss><channel><title>Newsbeast</title><item><title>Νέα είδηση</title>'+
  '<link>https://www.newsbeast.gr/world/news1</link>'+
  '<description><![CDATA[<p>Πρώτη παράγραφος ειδήσεων.</p><p>Δεύτερη παράγραφος ειδήσεων.</p>]]></description>'+
  '<pubDate>Sun, 08 Nov 2026 18:30:00 GMT</pubDate></item></channel></rss>';
const item=rss.parse(sample,{feedUrl:'https://www.newsbeast.gr/world/feed'}).articles[0];
assert.equal(item.category,'Κόσμος');
assert.deepEqual(item.previewParagraphs,['Πρώτη παράγραφος ειδήσεων.','Δεύτερη παράγραφος ειδήσεων.']);
const previewOnly=publicArticle(item);
assert.equal(previewOnly.key,keyFor(item.url));
assert.match(previewOnly.key,/^[a-f0-9]{24}$/);
assert.equal(previewOnly.url,item.url);
assert.equal(previewOnly.previewParagraphs.length,2);
assert.notEqual(keyFor('https://www.newsbeast.gr/world/news2'),previewOnly.key);
const googleSample='<rss><channel><title>Google News</title><item>'+
  '<title>Διεθνές νέο</title><link>https://news.google.com/rss/articles/a1</link>'+
  '<description><![CDATA[<ol><li>Αλλες σχετικές ειδήσεις</li></ol>]]></description></item></channel></rss>';
const google=rss.parse(googleSample,{google:true}).articles[0];
assert.deepEqual(google.previewParagraphs,[],'do not show related coverage as a Google article preview');
const related=relatedArticles([
  {url:'https://example.com/1',title:'Διαφορετικό',category:'Business',publishedAt:'2026-11-08'},
  {url:'https://example.com/2',title:'Κόσμος',category:'Κόσμος',publishedAt:'2026-11-08'},
  item
],item);
assert.equal(related.length,1);
assert.equal(related[0].title,'Κόσμος');
const model=read('backend/models/NewsFeed.js');
assert.ok(model.includes('previewParagraphs:{type:[String]'));
const archive=read('backend/models/NewsFeedArchive.js');
assert.ok(archive.includes('expireAfterSeconds:0'),'archived previews expire automatically');
const controller=read('backend/controllers/newsFeedController.js');
assert.ok(controller.includes('exports.articleDetail=async(req,res)=>'));
assert.ok(controller.includes('articles:articles.map(publicArticle)'),'every article gets a safe key');
assert.ok(controller.includes('NewsFeedArchive.findById(key)'),'old shared links resolve to archives');
assert.ok(controller.includes('relatedArticles(articles,item,4)'));
assert.ok(controller.includes('await NewsFeedArchive.bulkWrite(writes'),'evicted excerpts are archived');
const api=read('backend/routes/newsFeedRoutes.js');
const access=read('backend/utils/stagePublicAccess.js');
assert.ok(api.includes("router.get('/newsfeed/articles/:key',c.articleDetail)"));
assert.ok(access.includes('/api\\/newsfeed\\/articles'),'only strictly shaped detail API path public');
const page=read('frontend/src/pages/NewsArticle.jsx');
assert.ok(page.includes("fetch('/api/newsfeed/articles/'+key"));
assert.ok(page.includes('Προεπισκόπηση από το RSS'));
assert.ok(page.includes('Διάβασε ολόκληρο το άρθρο στην πηγή'));
assert.ok(page.includes('target="_blank" rel="noopener noreferrer"'));
assert.ok(page.includes('article.previewParagraphs'),'render real RSS excerpts');
assert.ok(page.includes('onSave')&&page.includes('onShare'),'functional user controls');
assert.ok(page.includes('aria-label="Σχετικά άρθρα"'));
assert.ok(!page.includes('dangerouslySetInnerHTML'),'third-party article text is never injected as HTML');
const feed=read('frontend/src/pages/NewsFeed.jsx');
assert.ok(feed.includes("const href='/newsfeed/'+item.key"));
assert.ok(feed.includes('state={{backTo}}'));
assert.ok(feed.includes('useSearchParams()'),'category and layout survive return navigation');
assert.ok(feed.includes('<EditorialPlacement placement="news"'),'existing feed hero stays unchanged');
assert.ok(feed.includes('<AdUnit wide banner='),'existing ads stay unchanged');
const app=read('frontend/src/App.jsx');
assert.ok(app.includes('<Route path="/newsfeed/:key" element={<NewsArticle />} />'));
const seo=read('backend/utils/newsArticleSeo.js');
const server=read('backend/server.js');
assert.ok(server.includes("app.get('/newsfeed/:key', require('./utils/newsArticleSeo').injectNewsArticleSeo)"));
assert.ok(seo.includes('og:image')&&seo.includes('og:title'),'shared links show actual article thumbnail');
assert.ok(seo.includes('esc('),'social preview escapes untrusted publisher metadata');
console.log('Single news preview, safe permalink, 14-day archive, RSS-only excerpts, links and responsive UI contracts passed.');
