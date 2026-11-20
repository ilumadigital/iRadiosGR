'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rss=require('../backend/utils/rssNews');
const preset=require('../backend/utils/rssNewsPreset');
const selection=require('../backend/utils/rssnewsPublisherSelection');
const transport=require('../backend/utils/publicRssTransport');
const cats=['Ελλάδα','Business','Κόσμος','Αθλητικά','Τεχνολογία','Πολιτική','Lifestyle'];
const publishers=[
  'cnn.gr','capital.gr','greeco.gr','greekonomics.gr','greenbusiness.gr',
  'in.gr','naftemporiki.gr','newsbeast.gr','newpost.gr','newsit.gr',
  'protothema.gr','real.gr','rthess.gr','skai.gr','tanea.gr',
  'thenewspaper.gr','thepressproject.gr','tovima.gr','unboxholics.com',
  'zougla.gr','enikos.gr','enginepower.gr','eleftherostypos.gr',
  'ertnews.gr','feeds.feedburner.com'
];
const userUrl='https://rssnews.io/?feed=my&c='+encodeURIComponent(cats.join(','))+
  '&s='+encodeURIComponent(publishers.join(','));
const normalized=rss.normalizeSource(userUrl);
assert.equal(normalized.type,'rssnews_preset');
assert.deepEqual(normalized.categories,cats);
assert.deepEqual(normalized.publishers,publishers);
assert.equal(new URL(normalized.url).searchParams.get('s'),publishers.join(','));
assert.equal(rss.normalizeSource(normalized.url).url,normalized.url);
assert.equal(selection.publisherPlans(normalized,preset.CATEGORIES).length,25);
const newsbeast=selection.publisherPlans(normalized,preset.CATEGORIES).find(p=>p.domain==='newsbeast.gr');
assert.equal(newsbeast.sectioned,true);
assert.equal(newsbeast.candidates.length,7);
assert.equal(selection.publisherPlans(normalized,preset.CATEGORIES).find(p=>
  p.domain==='feeds.feedburner.com').candidates.length,0);
assert.equal(preset.normalizePreset('https://rssnews.io/?feed=my&c=Ελλάδα').publishers.length,0);
for(const bad of [
  'https://rssnews.io/?feed=my&c=Ελλάδα&s=localhost',
  'https://rssnews.io/?feed=my&c=Ελλάδα&s=127.0.0.1',
  'https://rssnews.io/?feed=my&c=Ελλάδα&s=foo.local',
  'https://rssnews.io/?feed=my&c=Ελλάδα&s=foo.com:8080',
  'https://rssnews.io/?feed=my&c=Ελλάδα&s=https://evil.com',
  'https://rssnews.io/?feed=my&c=Ελλάδα&s=foo.com&redirect=http://127.0.0.1',
  'https://rssnews.io/?feed=my&c=Ελλάδα&s=foo.com&s=bar.com'
])assert.throws(()=>rss.normalizeSource(bad),'malformed publisher selection is rejected: '+bad);
const original=transport.requestText,calls=[];
transport.requestText=async (url,{feed,html}={})=>{
  calls.push({url,feed,html});
  if(html)return '<html><head><meta content="https://img.newsbeast.gr/cover.jpg" property="og:image"/></head></html>';
  const u=new URL(url),host=u.hostname.replace(/^www\./,'');
  if(host!=='newsbeast.gr'&&host!=='in.gr'&&host!=='cnn.gr')
    throw new Error('Δεν υπάρχει προσβάσιμο RSS για το συγκεκριμένο domain.');
  if(host==='cnn.gr'&&u.pathname!=='/rss')throw new Error('RSS not found.');
  if(host==='in.gr'&&u.pathname!=='/feed/')throw new Error('RSS not found.');
  const category=u.pathname.includes('financial')?'Business':
    u.pathname.includes('world')?'Κόσμος':
    u.pathname.includes('sports')?'Αθλητικά':
    u.pathname.includes('technology')?'Τεχνολογία':
    u.pathname.includes('politiki')?'Πολιτική':
    u.pathname.includes('lifestyle')?'Lifestyle':
    host==='cnn.gr'?'Πολιτική':host==='in.gr'?'Κόσμος':'Ελλάδα';
  const slug=u.pathname.replace(/[^a-zA-Z0-9]+/g,'-');
  const link='https://www.'+host+'/'+slug+'-article';
  return '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>'+
    '<title>'+host+'</title><item><title>Demo article '+slug+'</title>'+
    '<link>'+link+'</link><category>'+category+'</category>'+
    (host==='newsbeast.gr'?'':'<media:thumbnail url="https://img.example.net/image.jpg"/>')+
    '<pubDate>Sun, 08 Nov 2026 18:30:00 GMT</pubDate>'+
    '</item></channel></rss>';
};
(async()=>{
  try{
    const imported=await rss.download({id:'preset-1',url:userUrl});
    assert.equal(imported.retrievalMode,'selected-publisher-rss');
    assert.equal(imported.publisherReports.length,25,'diagnostic status for every configured publisher');
    assert.ok(imported.publisherReports.some(r=>r.domain==='feeds.feedburner.com'&&r.status==='error'));
    assert.ok(imported.publisherReports.some(r=>r.domain==='newsbeast.gr'&&r.status==='ok'));
    assert.ok(selection.publisherPlans(normalized,preset.CATEGORIES).find(p=>
      p.domain==='capital.gr').candidates.some(c=>c.url.includes('/api/tags/all')),
      'known Capital.gr RSS endpoint is discovered');

    assert.equal(imported.articles.length,9,'7 Newsbeast sections plus CNN and in.gr RSS');
    assert.ok(imported.articles.every(a=>cats.includes(a.category)));
    assert.ok(imported.articles.every(a=>
      ['newsbeast.gr','cnn.gr','in.gr'].includes(new URL(a.url).hostname.replace(/^www\./,''))),
      'output only contains selected, verified publishers');
    assert.ok(imported.warnings.some(a=>a.includes('feeds.feedburner.com')),
      'missing Feedburner feed ID surfaces clear warning');
    assert.ok(imported.articles.some(a=>a.imageUrl==='https://img.newsbeast.gr/cover.jpg'),
      'OG metadata image restored on publisher articles');
    assert.ok(calls.some(a=>a.feed&&a.url.includes('/politiki/feed')));
    assert.ok(calls.every(a=>new URL(a.url).hostname!=='rssnews.io'),
      'never fetch rssnews.io share page as if it were XML');
    const coverMap=new Map(imported.articles.filter(a=>a.imageUrl).map(a=>
      ['preset-1|'+a.url,a.imageUrl]));
    calls.length=0;
    const second=await rss.download({id:'preset-1',url:userUrl},{existingImages:coverMap});
    assert.equal(second.articles.length,9);
    assert.equal(calls.filter(a=>a.html).length,0,'reuse already-known cover metadata');
    const ui=fs.readFileSync(path.join(__dirname,'../frontend/src/pages/AdminNewsFeed.jsx'),'utf8');
    assert.ok(ui.includes('selectedPublishers(source.url).length'));
    const controller=fs.readFileSync(path.join(__dirname,'../backend/controllers/newsFeedController.js'),'utf8');
    assert.ok(controller.includes('MAX_SOURCES=32'));
    console.log('rssnews.io categories + 25 publisher domains, RSS imports, cover art, safe fallback, and admin UI passed.');
  }finally{transport.requestText=original;}
})().catch(e=>{console.error(e);process.exitCode=1;});
