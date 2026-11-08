'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

const parserSource=read('frontend/src/utils/musicMetadata.js').replaceAll('export const ','const ');
const parse=vm.runInNewContext(parserSource+'\nparseMusicMetadata;');
const track=parse('Urban Soul and DJ Roland Clark - Have A Good Time');
assert.equal(track.artist,'Urban Soul and DJ Roland Clark');
assert.equal(track.title,'Have A Good Time');
for(const value of ['',null,undefined,'DESEO RADIO','LIVE NOW','on air','Now Playing','Σταθμός',
  'Radio - Live', 'live - Track', 'Σύνδεση - στον αέρα','Artist', 'Unknown - Test']) {
  assert.equal(parse(value),null,'must not show station slogan/status as a song: '+value);
}

const now=read('frontend/src/pages/PlayingNow.jsx');
assert.ok(now.includes('parseMusicMetadata(entry.title,station?.name)'),
  'show only verified artist-title pairs from shared native/AI feed');
assert.ok(now.includes('!station||!music'), 'non-song metadata must be excluded');
assert.ok(now.includes('setLiveStations(prev=>{'), 'unchanged songs keep their cached UI state');
assert.ok(now.includes('if(!currentUser){'),'never request song metadata for guests');
assert.ok(now.includes('AbortController'),'stop in-flight polling on route changes');
assert.ok(!now.includes('Math.random'),'metadata must not be randomly filtered');
assert.ok(now.includes('scrollBy({left:330'),'Now Playing carousel controls');

const playlist=read('frontend/src/components/StationPlaylistPanel.jsx');
assert.ok(!playlist.includes('<select'),'playlist must not have station dropdown');
assert.ok(playlist.includes('const chosen=station;'),'playlist follows the displayed station');
assert.ok(playlist.includes("'/playlist'")||playlist.includes("+'/playlist'"),'playlist still backed by history API');
assert.ok(playlist.includes('currentUser'),'playlist remains authenticated');

const hero=read('frontend/src/components/HomeHeroSlider.jsx');
const home=read('frontend/src/pages/Home.jsx');
assert.ok(hero.includes('onFeaturedStationChange?.(featuredStation?._id || null)'),'hero reports station to home');
assert.ok(home.includes('onFeaturedStationChange={setHeroStationId}'),'home tracks active slide');
assert.ok(home.includes('station={homeDisplayStation}'),'playlist is pinned to featured station');
assert.ok(home.includes('id="home-playlist"'),'sidebar opens current playlist section');
for (const part of ['<HomeRadioShortlist','<HomeRecommendationDeck','<HomeExplore','<PlayingNow'])
  assert.ok(home.includes(part),'listener dashboard missing '+part);

const explorer=read('frontend/src/components/HomeExplore.jsx');
assert.ok(!explorer.includes('<select'),'no native genre/region dropdowns');
assert.ok(explorer.includes('aria-pressed={genre===g}'),'genre tiles support selection');
assert.ok(explorer.includes('aria-pressed={region===r}'),'regions use accessible chips');
assert.ok(explorer.includes('ir-genre-tile'),'genre discovery uses image-like tiles');

const sidebar=read('frontend/src/components/Sidebar.jsx');
assert.ok(sidebar.includes('to="/?explore=categories"'));
assert.ok(sidebar.includes('to="/?explore=playlist"'));
assert.ok(sidebar.includes('to="/?explore=recent"'));
assert.ok(sidebar.includes('to="/?explore=top"'));
assert.ok(!sidebar.includes('{regions.map('),'sidebar must not repeat all regions');
assert.ok(!sidebar.includes('{genres.map('),'sidebar must not repeat all genres');
assert.ok(sidebar.includes('to="/admin/home-slides"'),'Admin feature kept');
const css=read('frontend/src/styles/design-system.css');
assert.ok(css.includes('ir-home-feature-grid')&&css.includes('ir-app-sidebar .ir-nav-item--active'));

console.log('iRadios mockup home, metadata-only lists and no-dropdown navigation contracts passed.');
