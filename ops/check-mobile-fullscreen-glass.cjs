'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const player = read('frontend/src/components/MobileMiniPlayer.jsx');
const artwork = read('frontend/src/components/FullscreenArtwork.jsx');
const sharedCss = read('frontend/src/styles/fullscreen-player.css');
const glass = read('frontend/src/styles/mobile-player-glass.css');
const music = read('frontend/src/components/MusicServiceLinks.jsx');
const story = read('frontend/src/components/ShareStory.jsx');
const app = read('frontend/src/App.jsx');

for(const text of [
  'showCoverArt ? globalCoverArt : null',
  'showProducer={showProducerArt}',
  'onStationClick={openStationProfile}',
  'onTouchStart={handleTouchStart}',
  'onTouchMove={handleTouchMoveMaximized}',
  'onTouchEnd={handleTouchEndMaximized}',
  'handlePrevStation()', 'handleNextStation()',
  'togglePlayPause', 'ir-glass-transport',
  'openCarMode', 'openDevices', 'onRequestDevices?.()',
  'onTransferPlayback?.(device.deviceId)',
  'ir-glass-sheet-layer', 'ir-glass-more-grid',
  'setShowChat(true)', 'onUserDSPChange(currentStation._id, preset.id)',
  'label="Κοινοποίηση Story"', 'handleRadarClick',
  'MusicServiceLinks song={nowPlaying}', 'ir-mini-player'
]) assert.ok(player.includes(text), 'mobile player lost: '+text);

assert.ok(artwork.includes('onStationClick'), 'station logo must open station profile');
assert.ok(artwork.includes('ir-showcase-art__brand--link'), 'logo must be a proper button');
assert.ok(sharedCss.includes('transition: opacity'), 'RDS crossfade remains smooth');
assert.ok(sharedCss.includes('.ir-showcase-art__dj.is-active'), 'live DJ RDS fade retained');
assert.ok(music.includes("Αναβαθμίστε σε Premium"), 'Spotify / Apple premium gate retained');
assert.ok(story.includes('label = null'), 'sharing tile remains fully tappable');
assert.ok(app.includes('ref={audioRef}'), 'no new audio engine');
assert.ok(!player.includes('<audio'), 'fullscreen must remain a visual layer');

for(const text of [
  'safe-area-inset-top', 'safe-area-inset-bottom', 'backdrop-filter',
  'max-height:750px', 'max-height:620px', 'max-width:360px',
  'prefers-reduced-motion', 'focus-visible', 'ir-glass-device-row'
]) assert.ok(glass.includes(text), 'missing responsive/glass behaviour: '+text);

console.log('Mobile fullscreen glass player contracts passed.');
