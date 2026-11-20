#!/usr/bin/env node
// Read-only guard for the fast, single-logo iRadios splash.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../frontend/src/components');
const jsx = fs.readFileSync(path.join(root, 'Preloader.jsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'preloader.css'), 'utf8');
const brand = fs.readFileSync(path.join(root, 'BrandLogo.jsx'), 'utf8');
const timing = fs.readFileSync(path.resolve(__dirname, '../frontend/src/utils/preloaderTimeline.js'), 'utf8');
const seoRender = fs.readFileSync(path.resolve(__dirname, '../backend/services/seo2Render.js'), 'utf8');

assert.equal((jsx.match(/<BrandLogo\b/g) || []).length, 1, 'The preloader must render exactly one logo');
assert.match(jsx, /<BrandLogo variant="full"/, 'Use the original complete app logo');
assert.doesNotMatch(jsx, /variant="icon"|ir-splash__track|ir-splash__orbit/, 'No second logo or legacy progress track');
assert.match(timing, /SPLASH_DURATION_MS = 1400/, 'Preloader must last 1400ms from first paint');
assert.match(timing, /SPLASH_FADE_MS = 250/, 'Final 250ms belong to fade');
assert.match(jsx, /preloaderTimeline\(startedAt, now\)/, 'React must use the shared remaining-time calculation');
assert.match(jsx, /Number\.isFinite\(window\.__irSeoSplashStart\)/, 'React must adopt the HTML splash clock');
assert.match(jsx, /if \(hasHtmlSplash \|\| phase === 'removed'\) return null;/, 'Never render a second React overlay');
assert.match(jsx, /htmlSplash\.classList\.add\('ir-splash--exit'\)/, 'Fade the same HTML element');
assert.match(seoRender, /id="ir-seo-bootstrap"/, 'SEO markup must have a single identified bootstrap');
assert.match(seoRender, /class="ir-splash ir-splash--enter"/, 'SEO bootstrap must be the identical branded splash');
assert.match(seoRender, /__irSeoSplashStart/, 'Timestamp must begin in original HTML');
assert.doesNotMatch(seoRender, /ir-seo-boot-inner/, 'No legacy secondary black splash UI');
assert.match(css, /\.ir-splash__logo\s*\{[^}]*height:\s*auto/s, 'Logo must preserve aspect ratio');
assert.match(css, /\.ir-splash__logo-wrap\s*\{[^}]*340px/s, 'Logo needs a controlled desktop width');
assert.doesNotMatch(css, /@keyframes\s+ir-splash-logo-in\s*\{[^}]*scale\(/s, 'Never scale the logo animation');
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'Respect reduced-motion accessibility');
// The official brand master changed from hand-traced SVG to designer PNG.
const publicDir=path.resolve(__dirname,'../frontend/public');
for(const asset of ['iradios-app-logo.png','noicon-iradios-app-logo.png','icon-tr.png']){
  assert.ok(fs.existsSync(path.join(publicDir,asset)),asset+' must exist');
}
assert.ok(brand.includes("full: '/iradios-app-logo.png'"), 'Use the approved full PNG master');
assert.ok(brand.includes('<img'), 'Render the supplied logo as an image');
assert.ok(brand.includes("objectFit: 'contain'"), 'Preserve original artwork proportions');
assert.ok(!brand.includes('<svg')&&!brand.includes('shapeRendering='), 'Do not trace the supplied PNG masters');
console.log('OK: single-logo premium preloader, supplied artwork proportions and reduced motion');
