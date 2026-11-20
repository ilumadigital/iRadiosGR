'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sendSeoHtml,stationBody}=require('../services/seo2Render');
const {stationSeo}=require('../services/seo2Core');
const st={
  _id:'507f1f77bcf86cd799439011',slug:'seo-test',status:'approved',name:'Radio & <Example>',
  description:'Αληθινή περιγραφή με <script>alert("unsafe")</script>.',
  genre:'Rock',city:'Αθήνα',scheduleDayBase:1,
  schedule:[{day:1,startTime:'12:00',endTime:'13:00',title:'Rock Hour'}]
};
function fakeResponse(){
  return {
    headers:{},code:0,body:null,
    set(name,value){this.headers[name]=value;return this;},
    status(value){this.code=value;return this;},
    send(value){this.body=value;return this;}
  };
}
test('SEO page merges one authoritative head with the real SPA bootstrap',async()=>{
  const previous=global.fetch,env=process.env.APP_ENV;
  global.fetch=async()=>({ok:true,text:async()=>[
    '<!doctype html><html><head><title>Generic Title</title>',
    '<meta name="robots" content="noindex,nofollow">',
    '<meta name="description" content="old">',
    '<meta property="og:title" content="old">',
    '<link rel="canonical" href="/old">',
    '</head><body><div id="root"></div>',
    '<noscript>Generic filler</noscript>',
    '<script type="module" src="/assets/app.js"></script></body></html>'
  ].join('')});
  try{
    process.env.APP_ENV='staging';
    const seo=stationSeo(st);
    seo.ld['@graph'][0].description='<script>alert("unsafe")</script>';
    const res=fakeResponse();
    await sendSeoHtml(res,seo,stationBody(st,seo,[]));
    assert.equal(res.code,200);
    assert.match(res.body,/name="robots" content="noindex, nofollow, noarchive"/);
    assert.equal((res.body.match(/<title>/g)||[]).length,1);
    assert.equal((res.body.match(/<meta name="description"/g)||[]).length,1);
    assert.equal((res.body.match(/<link rel="canonical"/g)||[]).length,1);
    assert.equal((res.body.match(/<script type="application\/ld\+json">/g)||[]).length,1);
    assert.match(res.body,/<script type="module" src="\/assets\/app.js"><\/script>/);
    assert.match(res.body,/<main class="seo-prerender"/);
    assert.match(res.body,/id="ir-seo-critical"/);
    assert.match(res.body,/id="ir-seo-bootstrap"/);
    assert.match(res.body,/ir-seo-js/);
    // SSR now paints the SAME complete branded React preloader, and React
    // retains its DOM/timing rather than switching from a black screen.
    assert.match(res.body,/id="ir-seo-bootstrap" class="ir-splash ir-splash--enter"/);
    assert.match(res.body,/class="ir-splash__ambient"/);
    assert.match(res.body,/class="ir-splash__waves"/);
    assert.match(res.body,/class="ir-splash__glint"/);
    assert.match(res.body,/class="ir-splash__equalizer"/);
    assert.equal((res.body.match(/class="ir-splash__logo"/g)||[]).length,1);
    assert.equal((res.body.match(/class="ir-splash__wave ir-splash__wave--/g)||[]).length,4);
    assert.equal((res.body.match(/--bar-height:/g)||[]).length,9);
    assert.match(res.body,/window\.__irSeoSplashStart=window\.performance\?performance\.now\(\):Date\.now\(\)/);
    assert.match(res.body,/#ir-seo-bootstrap\{display:none\}/);
    assert.match(res.body,/html\.ir-seo-js #ir-seo-bootstrap\{/);
    assert.match(res.body,/html\.ir-seo-js #ir-seo-bootstrap\.ir-splash--exit\{/);
    assert.match(res.body,/},10000\);/); // no-bundle fallback to readable SSR content
    assert.doesNotMatch(res.body,/ir-seo-boot-inner/);
    assert.match(res.body,/faq|FAQPage/i);
    assert.match(res.body,/Συχνές ερωτήσεις/);
    assert.match(res.body,/Πώς βλέπω τα πρόσφατα τραγούδια στην playlist/);
    assert.doesNotMatch(res.body,/<script>alert\("unsafe"\)<\/script>/);
    assert.match(res.body,/\\u003cscript\\u003e/);
    assert.doesNotMatch(res.body,/Generic filler|Generic Title/);
  } finally {global.fetch=previous; process.env.APP_ENV=env;}
});
