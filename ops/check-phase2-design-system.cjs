'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');

const css = read('frontend/src/styles/design-system.css');
const global = read('frontend/src/index.css');
const html = read('frontend/index.html');
assert.match(global, /@import "\.\/styles\/design-system\.css";/);
for (const token of [
  '--ir-color-bg','--ir-color-accent','--ir-color-text','--ir-color-muted',
  '--ir-glass-border','--ir-radius-card','--ir-radius-control'
]) assert.ok(css.includes(token), 'Missing theme token: '+token);
for (const klass of [
  '.ir-glass','.ir-app-topbar','.ir-app-sidebar','.ir-app-mobile-nav',
  '.ir-search-field','.ir-nav-item','.ir-now-playing-card',
  '.ir-station-image','.ir-action-primary'
]) assert.ok(css.includes(klass), 'Missing UI class: '+klass);
assert.ok(css.includes('prefers-reduced-motion'), 'Reduced-motion fallback missing');
assert.ok(css.includes('prefers-contrast: more'), 'High-contrast fallback missing');
assert.ok(css.includes('safe-area-inset-bottom'), 'Mobile bottom safe area missing');
assert.match(html, /<html lang="el">/);
assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);

for(const [file,classes] of [
  ['frontend/src/components/TopBar.jsx',['ir-app-topbar','ir-search-field','ir-action-primary']],
  ['frontend/src/components/Sidebar.jsx',['ir-app-sidebar','ir-nav-item--active']],
  ['frontend/src/components/MobileNav.jsx',['ir-app-mobile-nav']],
  ['frontend/src/pages/PlayingNow.jsx',['ir-now-playing-card']],
  ['frontend/src/pages/Home.jsx',['ir-station-image']]
]){
  const contents=read(file);
  for (const klass of classes) assert.ok(contents.includes(klass),file+' must use '+klass);
}
console.log('Phase 2 design-system contract checks passed.');
