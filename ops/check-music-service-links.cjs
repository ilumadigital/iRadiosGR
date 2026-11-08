'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

(async () => {
  const metadata = await import(pathToFileURL(path.join(root, 'frontend/src/utils/musicMetadata.js')).href);
  const song = 'Dua Lipa - Houdini';
  assert.equal(metadata.spotifySongLink(song, 'Sfera 102.2'),
    'https://open.spotify.com/search/Dua%20Lipa%20-%20Houdini');
  assert.equal(metadata.appleMusicSongLink(song, 'Sfera 102.2'),
    'https://music.apple.com/gr/search?term=Dua%20Lipa%20Houdini');
  assert.equal(metadata.appleMusicSongLink('Μαρίνα Σάττι - Μάντισσα', 'Sfera'),
    'https://music.apple.com/gr/search?term='+encodeURIComponent('Μαρίνα Σάττι Μάντισσα'));
  for (const bad of ['DJZONE', 'LIVE DJ - On Air', 'Σταθμός', 'NEWS - Radio Show']) {
    assert.equal(metadata.appleMusicSongLink(bad, 'Sfera'), null, 'No false Apple song: ' + bad);
    assert.equal(metadata.spotifySongLink(bad, 'Sfera'), null, 'No false Spotify song: ' + bad);
  }

  const buttons = read('frontend/src/components/MusicServiceLinks.jsx');
  const styles = read('frontend/src/styles/music-service-links.css');
  const station = read('frontend/src/pages/StationProfile.jsx');
  const mobileStation = read('frontend/src/components/MobileStationShowcase.jsx');
  const mobilePlayer = read('frontend/src/components/MobileMiniPlayer.jsx');
  const desktop = read('frontend/src/components/DesktopFullPlayer.jsx');
  const footer = read('frontend/src/components/Footer.jsx');

  assert.match(buttons, /SiSpotify, SiApplemusic/, 'both authentic brand icons are rendered');
  assert.match(buttons, /parseMusicMetadata\(raw, stationName\)/, 'never render buttons for unverified metadata');
  assert.match(buttons, /target="_blank" rel="noopener noreferrer"/, 'external links use safe attributes');
  assert.match(buttons, /open\\\.spotify\\\.com/, 'validated direct links are constrained to Spotify tracks');
  assert.ok(!/fetch\(|new Audio\(|<audio\b/.test(buttons), 'no player or paid recognition API is added');
  assert.match(styles, /#1ed760/i, 'Spotify green');
  assert.match(styles, /#ff5274/i, 'Apple Music brand pink');
  assert.match(station, /<MusicServiceLinks raw=\{validatedMusic\.raw\}/, 'desktop station hero links');
  assert.match(mobileStation, /<MusicServiceLinks raw=\{song\.raw\}/, 'mobile station hero links');
  assert.match(mobilePlayer, /<MusicServiceLinks raw=\{currentTrack\.raw\}/, 'mobile fullscreen links');
  assert.match(desktop, /<MusicServiceLinks raw=\{music\.raw\}/, 'desktop fullscreen links');
  assert.match(footer, /spotifyUrl=\{spotifyUrl\}/, 'preserve authenticated recognized Spotify ID on desktop');
  assert.ok(!mobilePlayer.includes('handleSpotifyClick'), 'outdated premium-only Spotify icon no longer conflicts');
  assert.ok(!station.includes('onSpotifyClick'), 'outdated station Spotify gating no longer conflicts');
  console.log('Station and fullscreen music search links: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
