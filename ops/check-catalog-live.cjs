'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const controller=read('backend/controllers/catalogNowPlayingController.js');
assert.match(controller,/Station\.find\(\{status:'approved'\}\)/);
assert.match(controller,/Playlist\.find/);
assert.match(controller,/snapshotSong\(doc,now\)/);
assert.match(controller,/parseTrack\(snapshot\.title\|\|''\)/);
assert.doesNotMatch(controller,/axios|https?:\/\/|req\.query|streamUrl/);
assert.match(read('backend/routes/catalogNowPlayingRoutes.js'),/router\.get\('\/catalog\/now-playing'/);
assert.match(read('backend/utils/stagePublicAccess.js'),/'\/api\/catalog\/now-playing'/);
const placement=read('frontend/src/components/EditorialPlacement.jsx');
assert.match(placement,/hasEditorial&&hasPromoted/,
  '70/30 split only applies when both Admin CMS placements actually exist');
assert.match(placement,/empty:hidden/,
  'empty editorial sections must collapse instead of showing an unrelated station');
assert.match(placement,/PromotedStationCard/);
const card=read('frontend/src/components/StationCatalogCard.jsx');
assert.match(card,/flex w-full min-w-0 flex-col/);
assert.match(card,/Παίζει τώρα/);
assert.match(card,/Στον αέρα/);
assert.match(card,/catalogStationInfo/);
for(const name of ['Region','Genre']){
 const page=read('frontend/src/pages/'+name+'.jsx');
 assert.match(page,/useCatalogNowPlaying\(currentUser\)/);
 assert.match(page,/sortCatalogStations/);
 assert.match(page,/flex w-full min-w-0 flex-col gap-3/);
 assert.match(page,/nowPlaying=\{catalogNowPlaying\[String\(station\._id\)\]\}/);
}
const map=read('frontend/src/components/RadioGeoMap.jsx');
assert.match(map,/nowPlayingById/);
assert.match(map,/sortCatalogStations/);
console.log('Catalog live, full-width lists, promoted all-mode contracts passed.');
