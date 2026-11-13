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
const categories=read('frontend/src/components/HomeCategories.jsx');
const app=read('frontend/src/App.jsx');
assert.ok(explorer.includes('<CatalogFilterPopover label="Κατηγορία"'),
  'home explorer has a compact category dropdown');
assert.ok(explorer.includes('<CatalogFilterPopover label="Περιοχή"'),
  'home explorer has a compact region dropdown');
assert.ok(!explorer.includes('ir-genre-tile'),
  'large genre tiles must not interrupt search results');
assert.ok(categories.includes("'/genre/' + encodeURIComponent(category)"),
  'category cards navigate directly to the genre page');
assert.ok(categories.includes("gridTemplateColumns"),
  'category cards share responsive compact sizing with For You');
assert.ok(home.includes('<HomeCategories stations={stations} currentUser={currentUser}/>') &&
  home.indexOf('<HomeCategories') < home.indexOf('<HomeRecommendationDeck'),
  'category cards appear before personalized recommendations');
assert.ok(app.includes('path="/categories"'),
  'all genres has a dedicated category directory route');

const sidebar=read('frontend/src/components/Sidebar.jsx');
assert.ok(sidebar.includes('ir-sidebar-categories') && sidebar.includes('toggleSubmenu(\'categories\')'),
  'sidebar preserves direct category navigation');
assert.ok(sidebar.includes('to="/?explore=playlist"'));
assert.ok(sidebar.includes('to="/?explore=recent"'));
assert.ok(sidebar.includes('label="Για Σένα"') && sidebar.includes('label="Playlist"'));
assert.ok(sidebar.includes('<BrandLogo variant="full"'), 'expanded sidebar uses the inline full vector logo');
assert.ok(sidebar.includes('<BrandLogo variant="icon"'), 'collapsed sidebar uses inline transparent vector icon');
for(const logo of ['noicon-iradios-app-logo.svg', 'icon-tr.svg'])
  assert.ok(fs.existsSync(path.resolve(__dirname, '../frontend/public', logo)), 'Docker source must include '+logo);
const frontendDockerfile=read('frontend/Dockerfile');
assert.ok(frontendDockerfile.includes('COPY . .') && frontendDockerfile.includes('COPY --from=builder /app/dist /usr/share/nginx/html'),
  'Vite public logos must reach the nginx frontend container');
assert.ok(sidebar.includes('CITY_SHORTCUTS.filter'), 'Athens and Thessaloniki remain highlighted above regional links');
for(const id of ['ir-sidebar-categories','ir-sidebar-regions']){
  const match=sidebar.match(new RegExp('id="'+id+'" className=\\{\\`([^\\`]*)\\`\\}'));
  assert.ok(match, 'accordion panel must exist: '+id);
  assert.ok(!/max-h-|overflow-y-auto|overflow-y-scroll|custom-scrollbar/.test(match[1]),
    'accordion must expand naturally with no nested scrollbar: '+id);
}
assert.ok(!sidebar.includes('Μεγάλες πόλεις'), 'popular cities are highlighted without heading');
assert.ok(!sidebar.includes('label="Προτάσεις για σένα"'),
  'recommendations remain in Home but no longer clutter sidebar');
assert.ok(sidebar.includes('to="/?explore=live"') && home.includes('id="home-live-now"'), 'Live link goes to the on-air home section');
assert.ok(!sidebar.includes('{regions.map('),'sidebar must not repeat all regions');
assert.ok(!sidebar.includes('{genres.map('),'sidebar must not repeat all genres');
assert.ok(sidebar.includes('to="/admin/home-slides"'),'Admin feature kept');
const css=read('frontend/src/styles/design-system.css');
assert.ok(css.includes('ir-home-feature-grid')&&css.includes('ir-app-sidebar .ir-nav-item--active'));

console.log('iRadios home categories, compact discovery filters and station navigation contracts passed.');
