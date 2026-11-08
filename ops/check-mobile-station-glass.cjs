'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const page = read('frontend/src/pages/StationProfile.jsx');
const mobile = read('frontend/src/components/MobileStationShowcase.jsx');
const playlist = read('frontend/src/components/StationPlaylistPanel.jsx');
const css = read('frontend/src/styles/station-profile.css');
const header = read('frontend/src/components/TopBar.jsx');
const mini = read('frontend/src/components/MobileMiniPlayer.jsx');

assert.match(page, /<MobileStationShowcase\b/, 'mobile hero is mounted');
assert.match(page, /useStationAmbient\(station\?\.logo\)/, 'palette comes from the real station logo');
assert.match(page, /stationSongCover \? globalCoverArt/, 'now-playing uses the shared cover when available');
assert.match(page, /<StationPlaylistPanel[\s\S]*?mobileShowcase\s*\/>/, 'playlist is reused, not fetched by a new widget');
assert.match(mobile, /station\.cover \|\| station\.logo/, 'registered station cover is preferred');
assert.match(mobile, /onClick=\{onPlay\}/, 'playback remains delegated to the shared player');
assert.match(mobile, /onClick=\{onFavorite\}/, 'favorite action is functional');
assert.match(mobile, /onClick=\{onShare\}/, 'native sharing is preserved');
assert.match(mobile, /onRecognize\(event\)/, 'manual recognition is preserved');
assert.ok(!/new Audio\(|<audio\b|fetch\(/.test(mobile), 'mobile shell must not create a second player or metadata fetch');
assert.match(playlist, /Τελευταία 12 τραγούδια/, 'history label matches the brief');
assert.match(css, /\.ir-playlist-tracks>\.ir-station-playlist-track:nth-child\(n\+13\)/, 'only 12 songs are displayed on mobile');
assert.match(css, /@media \(max-width:767px\)/, 'glass hero is restricted to phones');
assert.match(css, /backdrop-filter:blur/, 'glassmorphism uses translucent blur');
assert.match(header, /ir-header--station-page/, 'no duplicate main header');
assert.match(mini, /ir-mini-player--station-page/, 'no duplicate mini player over the details');

console.log('Mobile station glass layout, data reuse and audio safety: OK');
