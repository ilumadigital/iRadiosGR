'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

(async () => {
  const { parseMusicMetadata, spotifySongLink, appleMusicSongLink } =
    await import(pathToFileURL(path.join(root, 'frontend/src/utils/musicMetadata.js')).href);

  const track = 'Daft Punk - One More Time';
  assert.deepEqual(parseMusicMetadata(track, 'Some Radio'), {
    artist: 'Daft Punk', title: 'One More Time', raw: track
  });
  assert.equal(spotifySongLink(track, 'Some Radio'),
    'https://open.spotify.com/search/Daft%20Punk%20-%20One%20More%20Time');
  assert.equal(appleMusicSongLink(track, 'Some Radio'),
    'https://music.apple.com/gr/search?term=Daft%20Punk%20-%20One%20More%20Time');
  for (const invalid of ['LIVE SHOW', 'DJ Zone - live show', 'Artist - Radio Show',
    'Some Radio - On Air', 'Ακούμε τον σταθμό…']) {
    assert.equal(spotifySongLink(invalid, 'Some Radio'), null, 'no Spotify search for '+invalid);
    assert.equal(appleMusicSongLink(invalid, 'Some Radio'), null, 'no Apple search for '+invalid);
  }

  const controls = read('frontend/src/components/MusicServiceLinks.jsx');
  const css = read('frontend/src/components/MusicServiceLinks.css');
  const station = read('frontend/src/pages/StationProfile.jsx');
  const stationMobile = read('frontend/src/components/MobileStationShowcase.jsx');
  const fullscreenMobile = read('frontend/src/components/MobileMiniPlayer.jsx');
  const fullscreenDesktop = read('frontend/src/components/DesktopFullPlayer.jsx');

  assert.match(controls, /if \(!currentUser \|\| !music\) return null/,
    'guest listeners see no buttons and invalid metadata cannot create them');
  assert.match(controls, /currentUser\.isPremium/);
  assert.match(controls, /currentUser\.broadcasterProfile\?\.tier === 'premium'/);
  assert.match(controls, /showAlert\('Αναβαθμίστε σε Premium για αυτή την εμπειρία\.'/);
  assert.ok(controls.indexOf("if (!isPremium)") < controls.indexOf("window.open(url,"),
    'Premium check must execute before external music search');
  assert.match(controls, /'noopener,noreferrer'/, 'safe new-tab navigation');
  assert.match(controls, /SiSpotify/);
  assert.match(controls, /SiApplemusic/);
  assert.match(css, /#1ed760/i, 'Spotify brand color');
  assert.match(css, /#fa243c/i, 'Apple Music brand color');
  for (const [name, source] of Object.entries({
    station, stationMobile, fullscreenMobile, fullscreenDesktop
  })) {
    assert.match(source, /<MusicServiceLinks\b/, name+' contains both service controls');
    assert.match(source, /currentUser=\{currentUser\}/, name+' uses real login state');
  }
  assert.match(fullscreenMobile, /isActualSong && \(/, 'no mobile outbound links on ads or non-songs');
  assert.match(fullscreenDesktop, /!isPlayingAd && !isRecognizing/, 'no desktop outbound links during ads');
  assert.doesNotMatch(controls, /<audio\b|new Audio\(/, 'external search must not alter the radio player');

  console.log('Music service search links: metadata guard, Premium gating, branding and all three surfaces OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
