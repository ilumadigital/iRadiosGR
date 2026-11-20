'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const page=read('frontend/src/pages/StationProfile.jsx');
const css=read('frontend/src/styles/station-profile.css');
const mobile=read('frontend/src/components/MobileStationShowcase.jsx');

// Only the station profile's button is simplified, not the global audio engine.
assert.doesNotMatch(page,/CircularVU/, 'station Play/Pause must never mount a VU meter');
assert.match(page,/ir-station-play-button/, 'the desktop Play/Pause is a plain button');
assert.match(page,/onClick=\{handlePlayClick\}/, 'audio control remains wired');
assert.match(page,/disabled=\{station\?\.isOffline === true\}/, 'offline station is disabled');

// A fixed-height scrolling hero was the regression on small laptop screens.
const laptop=css.slice(css.indexOf('/* A real responsive first fold on laptops'));
assert.match(laptop,/@media \(min-width:1100px\) and \(max-height:960px\)/);
assert.match(laptop,/height:auto;min-height:clamp/, 'hero grows naturally for long station data');
assert.match(laptop,/max-height:none;overflow:visible/, 'hero text cannot become its own scroller');
assert.doesNotMatch(laptop,/\.ir-station-hero-copy\s*\{[^}]*overflow-y:auto/,
  'hero copy must never get a nested scroll track');
assert.match(laptop,/font-size:clamp\([^;]*dvh/, 'laptop typography adapts to viewport height');

// RDS cover, show and logo frames must keep their rounded clipping during animation.
assert.match(page,/ir-station-art-brand-image/, 'logo uses a dedicated rounded image class');
assert.match(css,/\.ir-station-art-brand-wrap\{[^}]*overflow:hidden;border-radius:25%/,
  'logo badge itself must clip rectangular station assets');
assert.match(css,/\.ir-station-art-brand-image\{[^}]*border-radius:inherit/,
  'logo inside badge must respect its outer radius');
assert.match(css,/\.ir-station-profile-hero \.ir-station-hero-art>img,[\s\S]*?border-radius:inherit/,
  'RDS crossfade images keep rounded corners');
assert.match(mobile,/ir-mobile-station-logo-frame/, 'phone identity remains in place');
assert.match(css,/\.ir-mobile-station-logo-frame img\{[\s\S]*?border-radius:50%/,
  'phone logo keeps its circular mask');
console.log('Station hero fluid layout, plain Play/Pause and rounded RDS artwork: OK');
