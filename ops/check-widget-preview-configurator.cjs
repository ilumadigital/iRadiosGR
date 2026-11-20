'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const config=read('frontend/src/pages/StationWidgetConfigurator.jsx');
const gate=read('frontend/src/components/WidgetEmbedAccess.jsx');
const embed=read('frontend/src/components/StationEmbed.jsx');
const routes=read('backend/routes/backofficeRoutes.js');
const verifier=read('backend/routes/widgetPreviewRoutes.js');
const stage=read('backend/utils/stagePublicAccess.js');
const app=read('frontend/src/App.jsx');

assert.match(config,/id="widget-width"[^>]*type="range"|type="range" id="widget-width"/,
  'width uses an actual slider');
assert.match(config,/type="range" id="widget-height"/,'height uses an actual slider');
assert.match(config,/checked=\{widthAuto\}/);
assert.match(config,/checked=\{heightAuto\}/);
assert.match(config,/checked=\{autoplay\}/);
assert.match(config,/const code=previewUrl\?embedSnippet/);
assert.match(config,/autoplay\?'\?autoplay=1'/,'autoplay config affects iframe src');
assert.match(config,/height:auto;aspect-ratio:1\/1/,'square uses fluid height');
assert.match(config,/height:100vh;height:100dvh/,'hero Auto uses viewport height');
assert.match(config,/max-width:100%/,'fixed width respects the page container');
assert.match(config,/window\.open\('about:blank','_blank'\)/,
  'preview tab opens on a direct user click');
assert.match(config,/\/api\/backoffice\/widget-previews/);
assert.doesNotMatch(config,/<a href=\{previewUrl\}/,
  'no naked direct top-level preview link remains');
assert.match(gate,/window\.self!==window\.top/,
  'iframes are public and do not need the preview token');
assert.match(gate,/\/api\/widget-previews\/verify/);
assert.match(gate,/window\.sessionStorage\.setItem/);
assert.match(gate,/window\.history\.replaceState/);
assert.match(gate,/if\(access==='allowed'\)return <StationEmbed\/>/,
  'station player is not mounted for unverified top-level navigation');
assert.match(gate,/window\.setTimeout\(revoke,result\.expiresInMs\)/,
  'stop playback as soon as capability expires');
assert.match(embed,/params\.get\('autoplay'\)==='1'/);
assert.match(embed,/const autoplayAttempted=useRef\(''\)/,
  'autoplay only attempts once per mounted station');
assert.match(embed,/reason\?\.name==='NotAllowedError'/,
  'browser autoplay restrictions remain respected');
assert.match(routes,/router\.post\('\/backoffice\/widget-previews',authorizeRoles\('admin','broadcaster'\)/);
assert.match(routes,/status:'approved'/);
assert.match(routes,/scope\.broadcasterId=req\.user\._id/,
  'a broadcaster cannot mint a preview for another broadcaster station');
assert.match(verifier,/verifyWidgetPreviewToken/);
assert.match(stage,/req\.method === 'POST' && path === '\/api\/widget-previews\/verify'/);
assert.match(app,/element=\{<WidgetEmbedAccess\/>\}/);
console.log('Widget size sliders, autoplay browser fallback and secure 3-minute preview contracts: OK');
