'use strict';
// Prerender the same real station facts for all user agents. React subsequently
// mounts the interactive player into #root; no crawler-specific HTML or cloaking.
const {escapeHtml: e,urlFor,stationUrl,normalizedSchedule,links} = require('./seo2Core');
let cache = {html:null,until:0};
const TEMPLATE_URL = process.env.SEO_FRONTEND_TEMPLATE_URL || 'http://frontend/index.html';

async function frontendShell() {
  if (cache.html && Date.now() < cache.until) return cache.html;
  const response = await fetch(TEMPLATE_URL,{signal:AbortSignal.timeout(3500)});
  if (!response.ok) throw new Error('SEO frontend template unavailable: ' + response.status);
  const html=await response.text();
  if(!html.includes('<div id="root"></div>') || !html.includes('</head>') || html.length>100000)
    throw new Error('Invalid frontend template for SEO');
  cache={html,until:Date.now()+120000};
  return html;
}
function schemaScript(ld){
  // Prevent user-provided station text from closing a JSON-LD script.
  return JSON.stringify(ld).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')
    .replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
}
function pageHead(seo,indexable) {
  const tag=(name,value)=>'<meta name="'+e(name)+'" content="'+e(value)+'">';
  const property=(name,value)=>'<meta property="'+e(name)+'" content="'+e(value)+'">';
  return [
    '<title>'+e(seo.title)+'</title>',
    tag('description',seo.description),
    tag('robots',indexable?'index, follow, max-image-preview:large':'noindex, nofollow, noarchive'),
    '<link rel="canonical" href="'+e(seo.url)+'">',
    property('og:type','website'),property('og:site_name','iRadios'),
    property('og:title',seo.title),property('og:description',seo.description),
    property('og:url',seo.url),property('og:image',seo.image),
    property('og:image:width','1200'),property('og:image:height','630'),
    tag('twitter:card','summary_large_image'),tag('twitter:title',seo.title),
    tag('twitter:description',seo.description),tag('twitter:image',seo.image),
    '<script type="application/ld+json">'+schemaScript(seo.ld)+'</script>'
  ].join('\n');
}
function commonNav() {
  return '<nav aria-label="Πλοήγηση"><a href="'+e(urlFor('/'))+'">iRadios</a> · '+
    '<a href="'+e(urlFor('/map'))+'">Χάρτης ραδιοφώνων</a></nav>';
}
function stationBody(st,seo,similar=[]) {
  const list=seo.schedule.map(show=>'<li><strong>'+e(
    ['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'][show.day-1])+
    ' '+e(show.startTime)+'–'+e(show.endTime)+'</strong> · '+e(show.title)+
    (show.host?' — '+e(show.host):'')+
    (show.description?'<p>'+e(show.description)+'</p>':'')+'</li>').join('');
  const faq=seo.faq.map(x=>'<details><summary>'+e(x.q)+'</summary><p>'+e(x.a)+'</p></details>').join('');
  const categories=[st.genre,st.secondaryGenre,...(st.secondaryGenres||[])].filter(Boolean);
  const categoryLinks=[...new Set(categories)].map(x=>'<a href="'+e(urlFor('/genre/'+encodeURIComponent(x)))+'">'+e(x)+'</a>').join(' · ');
  const location=st.region?'<a href="'+e(urlFor('/region/'+encodeURIComponent(st.region)))+'">'+e(st.region)+'</a>':'';
  const official=links(st).map(url=>'<li><a rel="noopener noreferrer" href="'+e(url)+'">'+
    e(new URL(url).hostname)+'</a></li>').join('');
  return '<main class="seo-prerender" lang="el">'+commonNav()+
    '<article><h1>'+e(seo.h1)+'</h1><p>'+e(seo.description)+'</p>'+
    (st.description?'<section><h2>Σχετικά με τον σταθμό</h2><p>'+e(st.description)+'</p></section>':'')+
    (st.slogan?'<p>'+e(st.slogan)+'</p>':'')+
    (categoryLinks?'<section><h2>Μουσικό είδος</h2><p>'+categoryLinks+'</p></section>':'')+
    (location?'<section><h2>Περιοχή μετάδοσης</h2><p>'+location+'</p></section>':'')+
    (official?'<section><h2>Επίσημοι σύνδεσμοι</h2><ul>'+official+'</ul></section>':'')+
    (list?'<section><h2>Πρόγραμμα εκπομπών (ώρα Ελλάδας)</h2><ul>'+list+'</ul></section>':'')+
    (faq?'<section><h2>Συχνές ερωτήσεις</h2>'+faq+'</section>':'')+
    '</article>'+
    (similar.length?'<section><h2>Παρόμοιοι σταθμοί</h2><ul>'+
      similar.map(x=>'<li><a href="'+e(stationUrl(x))+'">'+e(x.name)+'</a></li>').join('')+
      '</ul></section>':'')+'</main>';
}
function directoryBody(seo,stations) {
  return '<main class="seo-prerender" lang="el">'+commonNav()+'<h1>'+e(seo.h1)+'</h1>'+
    '<p>'+e(seo.description)+'</p><section><h2>Σταθμοί</h2><ul>'+
    stations.map(st=>'<li><a href="'+e(stationUrl(st))+'">'+e(st.name)+'</a>'+
      (st.city?' — '+e(st.city):'')+(st.description?'<p>'+e(st.description.slice(0,260))+'</p>':'')+
      '</li>').join('')+'</ul></section></main>';
}
function homeBody(seo,stations) {
  return '<main class="seo-prerender" lang="el">'+commonNav()+'<h1>'+e(seo.h1)+'</h1><p>'+
    e(seo.description)+'</p><section><h2>Δημοφιλείς διαθέσιμοι σταθμοί</h2><ul>'+
    stations.map(st=>'<li><a href="'+e(stationUrl(st))+'">'+e(st.name)+'</a> — '+
      e(st.genre||'Ραδιόφωνο')+'</li>').join('')+'</ul></section></main>';
}
// Critical CSS makes the semantic, no-JavaScript page readable immediately;
// the temporary branded cover prevents an unstyled crawl-list flash while
// the Vite bundle mounts. Exactly the same document is served to all agents.
const SEO_BOOT_CSS = `
<style id="ir-seo-critical">
html,body{margin:0;background:#050707;color:#f5f7f4}
#ir-seo-bootstrap{display:none}
html.ir-seo-js #ir-seo-bootstrap{position:fixed;inset:0;z-index:100000;
display:grid;place-items:center;background:#050707;color:#f5f7f4}
#ir-seo-bootstrap .ir-seo-boot-inner{display:flex;flex-direction:column;
align-items:center;gap:20px;width:min(78vw,340px);text-align:center}
#ir-seo-bootstrap img{display:block;width:100%;height:auto;object-fit:contain}
#ir-seo-bootstrap small{color:#caff00;font:700 10px system-ui,sans-serif;
letter-spacing:.22em}
#root>.seo-prerender{box-sizing:border-box;max-width:1140px;margin:0 auto;
padding:clamp(28px,5vw,65px);font:16px/1.75 system-ui,-apple-system,sans-serif;
color:#e9efec}
#root>.seo-prerender a{color:#d4ff62;text-decoration:underline;text-underline-offset:3px}
#root>.seo-prerender h1{font-size:clamp(28px,5vw,44px);line-height:1.15;
margin:28px 0 18px;letter-spacing:-.035em;color:#fff}
#root>.seo-prerender h2{font-size:clamp(20px,3vw,26px);margin:0 0 12px;color:#fff}
#root>.seo-prerender section,#root>.seo-prerender article{padding:clamp(18px,3vw,28px);
border:1px solid #29352f;border-radius:22px;background:#101714;margin:18px 0}
#root>.seo-prerender article section{background:#131d17}
#root>.seo-prerender ul{padding-left:24px;margin:12px 0}
#root>.seo-prerender li{margin:7px 0;overflow-wrap:anywhere}
#root>.seo-prerender details{padding:13px 0;border-bottom:1px solid #29352f}
#root>.seo-prerender summary{cursor:pointer;color:#fff;font-weight:650}
#root>.seo-prerender nav{font-size:14px}
@media(prefers-reduced-motion:reduce){#ir-seo-bootstrap *{animation:none!important}}
</style>
<script>
document.documentElement.classList.add('ir-seo-js');
window.setTimeout(function(){var splash=document.getElementById('ir-seo-bootstrap');
if(splash)splash.remove();},10000);
</script>`;
const SEO_BOOT_BODY = '<div id="ir-seo-bootstrap" role="status" '+
  'aria-label="Φόρτωση iRadios"><div class="ir-seo-boot-inner">'+
  '<img src="/iradios-app-logo.png" alt="iRadios" width="340" height="110" '+
  'fetchpriority="high"><small>YOUR SOUND. YOUR WORLD.</small></div></div>';
async function sendSeoHtml(res, seo, content, opts={}) {
  const isStage=process.env.APP_ENV === 'staging';
  const shell=await frontendShell();
  const headless=shell.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi,'')
    .replace(/<meta\b[^>]*(?:name=["'](?:description|keywords|robots|twitter:[^"']+)|property=["']og:[^"']+)["'][^>]*\/?>/gi,'')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*\/?>/gi,'')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,'');
  const finalHtml=headless.replace('</head>',SEO_BOOT_CSS+pageHead(seo,!isStage)+'</head>')
    .replace('<body>','<body>'+SEO_BOOT_BODY)
    .replace('<div id="root"></div>','<div id="root">'+content+'</div>'+
      '<noscript><p>Η εφαρμογή ακρόασης χρειάζεται JavaScript. Οι δημόσιες πληροφορίες '+
      'και οι σύνδεσμοι σταθμών εμφανίζονται παραπάνω.</p></noscript>');
  res.set('Content-Type','text/html; charset=utf-8');
  res.set('Cache-Control',isStage?'private, no-store':'public, max-age=60, s-maxage=180, stale-while-revalidate=120');
  res.set('Vary','Accept-Encoding');
  return res.status(200).send(finalHtml);
}
module.exports={frontendShell,pageHead,stationBody,directoryBody,homeBody,sendSeoHtml};
