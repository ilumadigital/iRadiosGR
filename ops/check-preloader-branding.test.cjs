#!/usr/bin/env node
// Read-only guard for the fast, single-logo iRadios splash.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../frontend/src/components');
const jsx = fs.readFileSync(path.join(root, 'Preloader.jsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'preloader.css'), 'utf8');
const brand = fs.readFileSync(path.join(root, 'BrandLogo.jsx'), 'utf8');

assert.equal((jsx.match(/<BrandLogo\b/g) || []).length, 1, 'The preloader must render exactly one logo');
assert.match(jsx, /<BrandLogo variant="full"/, 'Use the original complete app logo');
assert.doesNotMatch(jsx, /variant="icon"|ir-splash__track|ir-splash__orbit/, 'No second logo or legacy progress track');
assert.match(jsx, /setPhase\('removed'\).*830/, 'Normal splash must unmount in under a second');
assert.match(css, /\.ir-splash__logo\s*\{[^}]*height:\s*auto/s, 'Logo must preserve aspect ratio');
assert.match(css, /\.ir-splash__logo-wrap\s*\{[^}]*340px/s, 'Logo needs a controlled desktop width');
assert.doesNotMatch(css, /@keyframes\s+ir-splash-logo-in\s*\{[^}]*scale\(/s, 'Never scale the logo animation');
assert.match(css, /prefers-reduced-motion:\s*reduce/, 'Respect reduced-motion accessibility');
assert.match(brand, /shapeRendering="geometricPrecision"/, 'Use precision rendering for all brand SVG variants');
console.log('OK: single-logo premium preloader, responsive vector sizing and reduced motion');
