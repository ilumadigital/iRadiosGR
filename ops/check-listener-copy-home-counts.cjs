'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

const now=read('frontend/src/pages/PlayingNow.jsx');
assert.ok(now.includes('displayStations.length===1?"σταθμός LIVE":"σταθμοί LIVE"'),
  'Now Playing count must say N σταθμοί LIVE, not a technical metadata label');
assert.ok(now.includes('(!isLoading || displayStations.length>0)'),
  'do not flash an incorrect zero during the initial scan');
assert.ok(!now.includes('0 με metadata') && !now.includes('με επιβεβαιωμένα μουσικά metadata'),
  'remove engineering labels from Now Playing');
assert.ok(!now.includes('Δεν εντοπίστηκαν σταθμοί με έγκυρα μουσικά metadata'),
  'no verbose technical empty-state copy');
assert.ok(now.includes('const music=parseMusicMetadata(entry.title,station?.name)'),
  'music list must still require true artist-title metadata');
assert.ok(now.includes('!station||!music'),
  'never turn a failed check into a fake song');
assert.ok(now.includes('if (!currentUser) return null'),
  'guest song metadata stays hidden');
assert.ok(now.includes('setLiveStations(prev=>{'), 'keep same song cached, replace it on track changes');

const deck=read('frontend/src/components/HomeRecommendationDeck.jsx');
assert.ok(deck.includes('[...moodStations].filter(Boolean)') &&
  deck.includes('.slice(0, 36)') && deck.includes('Number(a.isOffline === true)'),
  'For You supports extra rows of recommendations with offline stations last');
const top=read('frontend/src/components/HomeTopStations.jsx');
assert.ok(top.includes('topStations.filter(Boolean)') && top.includes('.slice(0, 7)') &&
  top.includes('station.isOffline === true'),
  'Guest Top stations must display up to 7 with offline playback disabled');
assert.ok(deck.includes('ResizeObserver') && deck.includes('gridTemplateColumns') &&
  deck.includes('firstRowCount') && deck.includes('forYouExtraRows') &&
  deck.includes('onAirExtraRows') && deck.includes('rows + 2'),
  'For You and On Air use responsive grid and reveal two rows per click');
assert.ok(deck.includes('stationIsPlaying'), 'radio playback state must remain intact');
assert.ok(deck.includes('function OnAirArtwork(') && deck.includes('<OnAirArtwork artworkUrl={backgroundUrl}'),
  'every active programme renders its artwork canvas, even with no programme photo');
assert.ok(deck.includes('flex aspect-square w-full min-w-0') && !deck.includes('h-[160px]'),
  'all on-air cards have a square visual frame at every breakpoint');
assert.ok(deck.includes('object-contain object-center') &&
  deck.includes('scale-110 object-cover opacity-35 blur-2xl'),
  'uncropped artwork is centered above a softly blurred ambient background');
assert.ok(deck.includes('const programmePhoto = hasProducerPhoto ? artworkUrl') &&
  deck.includes('[programmePhoto, stationLogo].find(') &&
  deck.includes('const [failedImages, setFailedImages] = useState([])') &&
  deck.includes('onError={handleImageError}'),
  'missing or broken programme artwork falls back to station logo without repeated image errors');


const home=read('frontend/src/pages/Home.jsx');
assert.ok(home.includes('chosenIds') && home.includes('all.findIndex'),
  'fill For You with real distinct stations if preferred genres are sparse');
assert.ok(home.includes('eligibleTopStations') && home.includes('const topStations') &&
  home.includes('.slice(0,7)') && home.includes('compareCatalogPopularity'),
  'fill Top with up to seven approved stations, ranked by saved position');
assert.ok(!home.includes('Το iRadios AI αναλύει'), 'do not claim AI recommendations');
assert.ok(!home.includes('άσε τον αλγόριθμο'), 'do not use synthetic marketing copy');
assert.ok(!home.includes('DSP Engine</strong>') && !home.includes('LIVE Analytics</strong>'),
  'broadcaster promotion should speak to people rather than software engineers');

const playlist=read('frontend/src/components/StationPlaylistPanel.jsx');
assert.ok(playlist.includes("Τα τραγούδια των τελευταίων 30 λεπτών του {chosen?.name"),
  'retain the explicitly approved station name in the playlist caption');
assert.ok(!playlist.includes('έγκυρα metadata τραγουδιών'), 'history copy should be natural');

const player=read('frontend/src/components/DesktopFullPlayer.jsx');
assert.ok(!player.includes('διαθέσιμα metadata'), 'do not expose technical data labels');
const profile=read('frontend/src/pages/StationProfile.jsx');
assert.ok(!profile.includes('AI Music Radar!') && !profile.includes('>AI RADAR<'),
  'recognition actions must use friendly Greek labels');
assert.ok(profile.includes('ΒΡΕΣ ΤΟ ΤΡΑΓΟΥΔΙ'));

const app=read('frontend/src/App.jsx');
assert.ok(!app.includes('πρόβλημα επικοινωνίας με το Cloud'),
  'errors must not describe backend services');
assert.ok(app.includes('ref={audioRef}'), 'the central stream player must remain unchanged');
assert.ok(app.includes('Συνδέσου στο iRadios για NowPlaying') ||
          read('frontend/src/components/Footer.jsx').includes('Συνδέσου στο iRadios για NowPlaying'),
  'guest messaging stays clear');

console.log('Listener-facing language, responsive recommendations and Top radio contracts passed.');
