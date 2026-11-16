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
// The SSR bootstrap is the SAME visual preloader as React, not a separate black
// loading screen. React adopts this single DOM node until its 1.4s timeline
// completes (or it is safe to reveal the app). The critical CSS keeps its
// artwork/animation stable before Vite CSS loads. With JS disabled, the overlay
// stays hidden and the genuine semantic station page remains visible.
const SEO_BOOT_CSS = '\n<style id="ir-seo-critical">\nhtml,body{margin:0;background:#050707;color:#f5f7f4}\n#ir-seo-bootstrap{display:none}\nhtml.ir-seo-js #ir-seo-bootstrap{position:fixed;inset:0;z-index:99999;\ndisplay:grid;place-items:center;overflow:hidden;isolation:isolate;\nbackground:#050707;color:#f6f8f4;opacity:1;\ntransition:opacity .25s ease-out,visibility .25s ease-out}\nhtml.ir-seo-js #ir-seo-bootstrap.ir-splash--exit{opacity:0;visibility:hidden;pointer-events:none}\n#ir-seo-bootstrap .ir-splash__ambient{position:absolute;inset:0;pointer-events:none;\nbackground:radial-gradient(ellipse 36% 31% at 50% 49%,rgba(125,184,0,.15),transparent 76%),\nradial-gradient(ellipse 54% 40% at 51% 53%,rgba(73,114,12,.065),transparent 79%)}\n#ir-seo-bootstrap .ir-splash__waves{position:absolute;top:50%;left:50%;\nwidth:max(110vw,850px);height:clamp(195px,38vh,330px);\ntransform:translate(-50%,-48%);overflow:visible;pointer-events:none;opacity:.65;\nanimation:ir-splash-waves-in .5s ease-out both}\n#ir-seo-bootstrap .ir-splash__wave{fill:none;stroke:#caff00;stroke-width:1.45;\nstroke-linecap:round;vector-effect:non-scaling-stroke}\n#ir-seo-bootstrap .ir-splash__wave--primary{opacity:.58;filter:drop-shadow(0 0 6px rgba(204,255,0,.48))}\n#ir-seo-bootstrap .ir-splash__wave--secondary{opacity:.21}\n#ir-seo-bootstrap .ir-splash__content{position:relative;z-index:1;display:flex;\nwidth:min(90vw,440px);flex-direction:column;align-items:center;\njustify-content:center;padding:24px 0}\n#ir-seo-bootstrap .ir-splash__logo-wrap{position:relative;width:min(78vw,340px);\nmax-width:100%;line-height:0;overflow:hidden}\n#ir-seo-bootstrap .ir-splash__logo{display:block;width:100%;height:auto;\nmax-width:100%;object-fit:contain;filter:drop-shadow(0 0 9px rgba(204,255,0,.075));\nanimation:ir-splash-logo-in .34s ease-out both}\n#ir-seo-bootstrap .ir-splash__beam{position:absolute;top:8%;left:50%;z-index:2;\nwidth:76%;height:1px;background:linear-gradient(90deg,transparent,rgba(204,255,0,.12) 20%,#eaff9c 51%,rgba(204,255,0,.12) 80%,transparent);\nbox-shadow:0 0 13px rgba(204,255,0,.32);transform:translateX(-50%);opacity:0;\nanimation:ir-splash-beam .66s ease-out .08s both}\n#ir-seo-bootstrap .ir-splash__glint{position:absolute;top:17%;bottom:17%;left:-25%;\nwidth:18%;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(244,255,222,.24),transparent);\ntransform:skewX(-20deg);opacity:0;animation:ir-splash-glint .65s ease-out .06s both}\n#ir-seo-bootstrap .ir-splash__tagline{display:block;margin-top:8px;color:rgba(238,247,229,.65);\nfont-size:9px;font-weight:800;letter-spacing:.27em;line-height:1.6;white-space:nowrap;\nanimation:ir-splash-text-in .36s ease-out .12s both}\n#ir-seo-bootstrap .ir-splash__equalizer{display:flex;height:28px;align-items:center;\njustify-content:center;gap:4px;margin-top:24px;opacity:.86}\n#ir-seo-bootstrap .ir-splash__equalizer span{display:block;flex:0 0 3px;width:3px;\nheight:var(--bar-height);border-radius:999px;\nbackground:linear-gradient(180deg,#ddff3f,#9dcc00);\nbox-shadow:0 0 8px rgba(204,255,0,.25);transform-origin:50% 50%;\nanimation:ir-splash-equalize .42s ease-in-out var(--bar-delay) infinite alternate}\n@keyframes ir-splash-logo-in{from{opacity:0}to{opacity:1}}\n@keyframes ir-splash-waves-in{from{opacity:0}to{opacity:.65}}\n@keyframes ir-splash-text-in{from{opacity:0}to{opacity:1}}\n@keyframes ir-splash-beam{0%{opacity:0}35%{opacity:.75}62%{opacity:1}100%{opacity:.12}}\n@keyframes ir-splash-glint{0%{left:-25%;opacity:0}25%{opacity:.55}65%{opacity:.35}100%{left:110%;opacity:0}}\n@keyframes ir-splash-equalize{from{transform:scaleY(.48);opacity:.65}to{transform:scaleY(1);opacity:1}}\n@media(max-width:480px){\n#ir-seo-bootstrap .ir-splash__logo-wrap{width:min(76vw,270px)}\n#ir-seo-bootstrap .ir-splash__tagline{font-size:8px;letter-spacing:.2em;margin-top:7px}\n#ir-seo-bootstrap .ir-splash__equalizer{gap:3px;margin-top:20px}\n#ir-seo-bootstrap .ir-splash__waves{opacity:.42}\n}\n@media(prefers-reduced-motion:reduce){\n#ir-seo-bootstrap .ir-splash__waves,#ir-seo-bootstrap .ir-splash__logo,\n#ir-seo-bootstrap .ir-splash__tagline,#ir-seo-bootstrap .ir-splash__beam,\n#ir-seo-bootstrap .ir-splash__glint,#ir-seo-bootstrap .ir-splash__equalizer span\n{animation:none!important}\n#ir-seo-bootstrap{transition-duration:.01ms}\n#ir-seo-bootstrap .ir-splash__beam,#ir-seo-bootstrap .ir-splash__glint{display:none}\n#ir-seo-bootstrap .ir-splash__equalizer span{transform:none}\n}\n#root>.seo-prerender{box-sizing:border-box;max-width:1140px;margin:0 auto;\npadding:clamp(28px,5vw,65px);font:16px/1.75 system-ui,-apple-system,sans-serif;\ncolor:#e9efec}\n#root>.seo-prerender a{color:#d4ff62;text-decoration:underline;text-underline-offset:3px}\n#root>.seo-prerender h1{font-size:clamp(28px,5vw,44px);line-height:1.15;\nmargin:28px 0 18px;letter-spacing:-.035em;color:#fff}\n#root>.seo-prerender h2{font-size:clamp(20px,3vw,26px);margin:0 0 12px;color:#fff}\n#root>.seo-prerender section,#root>.seo-prerender article{padding:clamp(18px,3vw,28px);\nborder:1px solid #29352f;border-radius:22px;background:#101714;margin:18px 0}\n#root>.seo-prerender article section{background:#131d17}\n#root>.seo-prerender ul{padding-left:24px;margin:12px 0}\n#root>.seo-prerender li{margin:7px 0;overflow-wrap:anywhere}\n#root>.seo-prerender details{padding:13px 0;border-bottom:1px solid #29352f}\n#root>.seo-prerender summary{cursor:pointer;color:#fff;font-weight:650}\n#root>.seo-prerender nav{font-size:14px}\n</style>\n<script>document.documentElement.classList.add(\'ir-seo-js\');</script>';
// Keep HTML structure and equalizer heights in sync with Preloader.jsx.
const SEO_BOOT_BODY = '<div id="ir-seo-bootstrap" class="ir-splash ir-splash--enter" role="status" aria-label="Φόρτωση iRadios GR"><div class="ir-splash__ambient" aria-hidden="true"></div><svg class="ir-splash__waves" viewBox="0 0 1440 300" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="ir-splash__wave ir-splash__wave--primary" d="M-50 92 C 110 44 220 205 420 166 S 585 106 705 148"></path><path class="ir-splash__wave ir-splash__wave--secondary" d="M-50 109 C 130 67 240 214 413 183 S 578 133 704 158"></path><path class="ir-splash__wave ir-splash__wave--primary" d="M1490 92 C 1330 44 1220 205 1020 166 S 855 106 735 148"></path><path class="ir-splash__wave ir-splash__wave--secondary" d="M1490 109 C 1310 67 1200 214 1027 183 S 862 133 736 158"></path></svg><div class="ir-splash__content"><div class="ir-splash__logo-wrap"><span class="ir-splash__beam" aria-hidden="true"></span><img src="/iradios-app-logo.png" alt="iRadios GR" class="ir-splash__logo" width="200" height="56" loading="eager" decoding="async" fetchpriority="high" draggable="false"><span class="ir-splash__glint" aria-hidden="true"></span></div><span class="ir-splash__tagline">YOUR SOUND. YOUR WORLD.</span><div class="ir-splash__equalizer" aria-hidden="true"><span style="--bar-height:7px;--bar-delay:0s"></span><span style="--bar-height:12px;--bar-delay:-0.075s"></span><span style="--bar-height:18px;--bar-delay:-0.15s"></span><span style="--bar-height:11px;--bar-delay:-0.22499999999999998s"></span><span style="--bar-height:26px;--bar-delay:-0.3s"></span><span style="--bar-height:16px;--bar-delay:-0.375s"></span><span style="--bar-height:22px;--bar-delay:-0.44999999999999996s"></span><span style="--bar-height:12px;--bar-delay:-0.525s"></span><span style="--bar-height:8px;--bar-delay:-0.6s"></span></div></div></div><script>window.__irSeoSplashStart=window.performance?performance.now():Date.now();window.setTimeout(function(){var splash=document.getElementById("ir-seo-bootstrap");if(splash){splash.remove();document.documentElement.classList.remove("ir-seo-js");}},10000);</script>';
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
