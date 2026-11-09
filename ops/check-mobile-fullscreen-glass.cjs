'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const player = read('frontend/src/components/MobileMiniPlayer.jsx');
const artwork = read('frontend/src/components/FullscreenArtwork.jsx');
const onAirShow = read('frontend/src/components/OnAirShowCard.jsx');
const sharedCss = read('frontend/src/styles/fullscreen-player.css');
const glass = read('frontend/src/styles/mobile-player-glass.css');
const music = read('frontend/src/components/MusicServiceLinks.jsx');
const story = read('frontend/src/components/ShareStory.jsx');
const app = read('frontend/src/App.jsx');
const stationPage = read('frontend/src/pages/StationProfile.jsx');
const mobileStation = read('frontend/src/components/MobileStationShowcase.jsx');
const storyUtility = read('frontend/src/utils/storyShare.js');
const mobileStationCss = read('frontend/src/styles/station-profile.css');

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
  'ir-glass-sheet-layer', 'ir-glass-primary-actions',
  'onClick={openStationProfile}',
  'ir-glass-primary-actions', 'onShuffleToggle', 'handleRadarClick',
  'MusicServiceLinks song={nowPlaying}', 'ir-mini-player'
]) assert.ok(player.includes(text), 'mobile player lost: '+text);

assert.match(mobileStationCss, /\.ir-mobile-station-logo-frame\s*\{[^}]*border-radius:20px/s,
  'mobile station logo frame uses a 20px corner radius');
assert.match(mobileStationCss, /\.ir-mobile-station-logo-frame img\s*\{[^}]*border-radius:inherit/s,
  'mobile station logo image follows its frame corners');
assert.doesNotMatch(mobileStationCss, /\.ir-mobile-station-logo-frame img\s*\{[^}]*border-radius:50%/s,
  'late CSS rules must not make the mobile logo circular again');
assert.ok(artwork.includes('onStationClick'), 'station logo must open station profile');
assert.match(player, /<OnAirShowCard[\s\S]*?showArtwork=\{false\}[\s\S]*?ir-glass-on-air/,
  'mobile fullscreen on-air card hides duplicate show image');
assert.match(onAirShow, /showArtwork=true/, 'desktop on-air shows still retain their images');
assert.match(onAirShow, /showArtwork&&<div className="ir-onair-show__avatar">/,
  'avatar DOM is omitted for the compact mobile on-air card');
assert.match(glass, /\.ir-full-player--glass \.ir-glass-on-air \.ir-onair-show__body/,
  'mobile fullscreen on-air card uses compact centered copy');
assert.ok(player.includes('producerImage={canShowDj ? liveBroadcast.imageUrl : null}'),
  'show artwork continues to appear in the main RDS stage');
assert.ok(artwork.includes('ir-showcase-art__brand--link'), 'logo must be a proper button');
assert.ok(sharedCss.includes('transition: opacity'), 'RDS crossfade remains smooth');
assert.ok(sharedCss.includes('.ir-showcase-art__dj.is-active'), 'live DJ RDS fade retained');
assert.ok(music.includes("Αναβαθμίστε σε Premium"), 'Spotify / Apple premium gate retained');
assert.ok(story.includes('label = null'), 'sharing tile remains fully tappable');
assert.ok(app.includes('ref={audioRef}'), 'no new audio engine');
assert.ok(app.includes('shuffleEnabled={stationShuffle}') && app.includes('shuffleHistoryRef'), 'shuffle must be backed by station navigation');
assert.ok(!player.includes('ir-live-visualizer') && !player.includes('ir-glass-visualizer'), 'fullscreen may not show visualizer');
assert.ok(player.includes('onClick={openDevices}') && player.includes('<Shuffle'), 'right transport devices and left shuffle required');
assert.ok(player.includes('ir-mini-story-button') && player.includes('ir-glass-story-tile'), 'Story must be reachable from mini and fullscreen players');
assert.ok(player.includes('label="Ανέβασε Story"'), 'fullscreen Story action has explicit label');
assert.ok(player.includes('Προφίλ {currentStation.name}'), 'direct mobile station profile link is named');
assert.ok(!player.includes('ir-glass-quality-tile') && !player.includes('ir-glass-broadcast-pill'),
  'defunct quality tile and upper-right frequency pill removed');
assert.ok(!player.includes('showMoreMenu'), 'profile link does not open redundant More sheet');
assert.ok(player.indexOf('MusicServiceLinks song={nowPlaying}') < player.indexOf('aria-label="Βρες ποιο τραγούδι παίζει"'),
  'Spotify and Apple Music must appear before song recognition');
assert.match(glass, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'only two bare primary actions');
assert.match(glass, /\.ir-glass-primary-tile\s*\{[^}]*border:0;border-radius:0;background:transparent/s,
  'primary actions have no border or tile background');
assert.match(glass, /\.ir-glass-header__close\s*\{[^}]*border:0;border-radius:0;background:transparent/s,
  'header collapse chevron has no glass frame');
assert.ok(mobileStation.includes("'στο iRadiosGR'") && player.includes("'στο iRadiosGR'"),
  'mobile fallback copy uses iRadiosGR');
assert.ok(stationPage.includes('<ShareStory') && mobileStation.includes('<ShareStory'), 'Story must work on desktop/mobile station profiles');
for(const value of ['width: 1080', 'height: 1920', 'Powered by ILUMA Digital Agency', "loadImage('/iradios-app-logo.png')", 'downloadStory(file)', 'navigator.share']) {
  assert.ok(storyUtility.includes(value), 'missing branded 9:16 story contract: '+value);
}

assert.ok(!player.includes('<audio'), 'fullscreen must remain a visual layer');
assert.ok(!player.includes('LiveChat') && !player.includes('showChat') && !player.includes('Live chat'), 'legacy chat must not return to mobile player');

for(const text of [
  'safe-area-inset-top', 'safe-area-inset-bottom', 'backdrop-filter',
  'max-height:750px', 'max-height:620px', 'max-width:360px',
  'prefers-reduced-motion', 'focus-visible', 'ir-glass-device-row'
]) assert.ok(glass.includes(text), 'missing responsive/glass behaviour: '+text);

console.log('Mobile fullscreen glass player contracts passed.');
