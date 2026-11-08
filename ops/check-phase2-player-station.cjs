'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const nav = read('frontend/src/components/MobileNav.jsx');
const mini = read('frontend/src/components/MobileMiniPlayer.jsx');
const station = read('frontend/src/pages/StationProfile.jsx');
const home = read('frontend/src/pages/PlayingNow.jsx');
const css = read('frontend/src/styles/design-system.css');
const app = read('frontend/src/App.jsx');

for (const token of ['.ir-station-hero', '.ir-station-now', '.ir-full-player',
  '.ir-full-player-art', '.ir-player-transport', '.ir-recognize-button',
  '.ir-mini-player', '.ir-live-visualizer', '.ir-mobile-bottom-dock']) {
  assert.ok(css.includes(token), 'missing shared CSS '+token);
}
assert.ok(css.includes('prefers-reduced-motion'), 'visualizer must support reduced motion');
assert.ok(css.includes('safe-area-inset-bottom'), 'mobile nav must honor bottom inset');
assert.match(nav, /aria-label="Βασική πλοήγηση"/);
assert.ok(nav.includes('onClick={onOpenDiscovery}'), 'discovery modal remains functional');
assert.ok(nav.includes("to=\"/favorites\""), 'favorites route retained');
assert.ok(nav.includes('aria-current='), 'active page must be accessible');

for(const handler of ['togglePlayPause()', 'handlePrevStation()', 'handleNextStation()',
  'handleRadarClick', 'setIsMaximized(true)', 'setIsMaximized(false)']) {
  assert.ok(mini.includes(handler), 'player must preserve '+handler);
}
assert.ok(mini.includes('Boolean(currentUser&&!isRecognizing&&!isPlayingAd&&currentTrack)'),
  'guest metadata must remain gated and only real songs qualify');
assert.ok(mini.includes('ir-recognize-button'), 'recognition CTA');
assert.ok(mini.includes('aria-label={isPlaying ?'), 'player controls accessible');
assert.ok(!mini.includes('audioRef = useRef'), 'do not duplicate audio node in UI');

assert.ok(station.includes('ir-station-hero'), 'station hero');
assert.ok(station.includes('ir-station-now'), 'factual metadata panel');
assert.ok(station.includes('!station?._id || !currentUser'), 'station metadata stays authenticated and follows the playing station');
assert.ok(station.includes("localStorage.getItem('iluma_token')"), 'station metadata sends the signed-in listener token');
assert.ok(station.includes('controller.abort();clearInterval(intervalId);'), 'station metadata must abort stale requests');
assert.ok(station.includes('onClick={handlePlayClick}'), 'original play callback preserved');

assert.ok(home.includes('aria-label={`Άνοιγμα σταθμού'), 'now-playing cards keyboard accessible');
assert.ok(home.includes('{item.name}'), 'show actual station name');
assert.ok(!home.includes('w-[75%]'), 'no fake song seek/progress bar');
assert.ok(home.includes('localStorage.getItem(\'iluma_token\')'), 'metadata request carries JWT');
assert.ok(app.includes('ref={audioRef}'), 'keep central audio element mounted in App');

console.log('Phase 2 player/station UI contract checks passed.');
