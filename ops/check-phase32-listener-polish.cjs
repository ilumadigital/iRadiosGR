'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const formatter=read('frontend/src/utils/stationFrequency.js').replaceAll('export function','function');
const {formatFMFrequency,formatStationTransmission}=vm.runInNewContext(formatter+'\n({formatFMFrequency,formatStationTransmission})');
for(const [raw,expected] of [
  ['104.6','104.6 FM'],['104.6 FM','104.6 FM'],['104.6 fm','104.6 FM'],
  ['104.6 FM FM','104.6 FM'],['FM 104.6','104.6 FM'],['104.6FM','104.6 FM'],
  ['98,6 fm','98,6 FM'],[' FM 88.9 fm ','88.9 FM'],['FM','FM'],[null,'']
]){
  assert.equal(formatFMFrequency(raw),expected,'FM formatter output for '+raw);
}
assert.equal(formatStationTransmission({transmissionType:'Επίγειο',frequency:'104.6 FM'}),'104.6 FM');
assert.equal(formatStationTransmission({transmissionType:'Επίγειο',frequency:'104.6 FM FM'}),'104.6 FM');
assert.equal(formatStationTransmission({transmissionType:'Web Radio',frequency:'104.6 FM'}),'Web Radio');
const catalog=read('frontend/src/components/StationCatalogCard.jsx');
assert.ok(catalog.includes('formatStationTransmission(station)'), 'Home/genre/region/favorites grid and list use the normalized frequency');
assert.ok(!catalog.includes("station.frequency+' FM'"),'never concatenate an FM suffix blindly');
const regionMap=read('frontend/src/pages/Region.jsx');
assert.ok(regionMap.includes('<RadioGeoMap'),'region map must use the shared MapLibre player/marker UI');
const radioMap=read('frontend/src/components/RadioGeoMap.jsx');
assert.ok(radioMap.includes('formatFMFrequency(station.frequency)'),'shared map popup must normalize FM frequency');
assert.ok(radioMap.includes('onPlayStation?.(station)'),'shared map popup must use global playback state');
assert.ok(radioMap.includes('tiles.openfreemap.org/styles/dark'),'shared map must use key-free dark vector basemap');
assert.ok(read('frontend/src/components/MapMode.jsx').includes('<RadioGeoMap'),'global map must use shared engine');
assert.ok(!regionMap.includes('basemaps.cartocdn.com'),'region must not load old CARTO tiles');
for(const p of ['frontend/src/pages/StationProfile.jsx','frontend/src/components/MobileMiniPlayer.jsx']){
  assert.ok(read(p).includes('formatFMFrequency('),p+' must normalize visible frequency');
}
const favorites=read('frontend/src/pages/Favorites.jsx');
for(const x of ['<StationCatalogCard','type="search"','setView','aria-pressed={view===','setGenre','toggleFavorite','currentStation={currentStation}']){
  assert.ok(favorites.includes(x),'favorites needs '+x);
}
assert.ok(favorites.includes('favoriteIds.has(String(station._id))'),'favorites follow saved user station IDs');
assert.ok(favorites.includes('!currentUser?('),'guests receive a clear sign-in invitation');
const search=read('frontend/src/components/TopBar.jsx');
for(const x of ['aria-autocomplete="list"','ArrowDown','ArrowUp','Escape','Enter','role="listbox"','role="option"','pointerdown','Δεν βρήκαμε σταθμό']){
  assert.ok(search.includes(x),'search needs '+x);
}
const sidebar=read('frontend/src/components/Sidebar.jsx');
for(const x of ['aria-label="Κλείσιμο μενού"','bg-black/70','document.body.style.overflow','Escape','overscroll-contain']){
  assert.ok(sidebar.includes(x),'mobile sidebar needs '+x);
}
const mobile=read('frontend/src/components/MobileMiniPlayer.jsx');
for(const x of ['h-[100dvh]','inert={!isMaximized}','aria-modal={isMaximized}','fullscreenRef','document.body.style.overflow','Escape','min-h-0']){
  assert.ok(mobile.includes(x),'mobile full player needs '+x);
}
const station=read('frontend/src/pages/StationProfile.jsx');
assert.ok(station.includes('controller.abort();clearInterval(intervalId);'),'station changes must abort old metadata requests');
assert.ok(station.includes('/metadata?stationId='),'metadata must be scoped to approved station ID');
assert.ok(station.includes('onPlayStation={setCurrentStation}'),'station playlist and recommendations use shared player');
assert.ok(station.includes('relatedStations.map(relStation'),'related station list is retained');
assert.ok(station.includes('<StationCatalogCard'),'related radios use the premium station grid');
const app=read('frontend/src/App.jsx');
assert.ok(app.includes('ref={audioRef}'),'original persistent audio element must remain');
console.log('Phase 3.2 responsive listener QA and single-FM-frequency formatting passed.');
