'use strict';
// Offline regression checks: never contact staging or production data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');

async function main(){
  const {compareCatalogPopularity,compareCatalogStations} =
    await import(pathToFileURL(path.join(__dirname,'../frontend/src/utils/catalogLive.js')).href);
  const a={_id:'a',name:'Alpha',position:2,rankings:[
    {scope:'genre',value:'Dance',position:1},
    {scope:'region',value:'Αθήνα',position:2}]};
  const b={_id:'b',name:'Beta',position:1,rankings:[
    {scope:'genre',value:'Dance',position:2},
    {scope:'region',value:'Αθήνα',position:1}]};
  const arrange=(scope,value)=>[a,b].sort((first,second)=>
    compareCatalogPopularity(first,second,{},null,scope,value)).map(s=>s._id);
  assert.deepEqual(arrange('global',''),['b','a'],'saved network position');
  assert.deepEqual(arrange('genre','Dance'),['a','b'],'genre order is independent');
  assert.deepEqual(arrange('region','Αθήνα'),['b','a'],'region order is independent');
  assert.deepEqual(arrange('genre','Rock'),['b','a'],'unspecified genre falls back to global');
  const c={_id:'c',name:'Charlie',position:0,rankings:[]};
  assert.deepEqual([c,a,b].sort((first,second)=>
    compareCatalogPopularity(first,second,{},null,'genre','Dance')).map(s=>s._id),
    ['a','b','c'],'new, unranked scoped station follows explicit positions');
  assert.ok(compareCatalogPopularity({...a,isOffline:true},b,{},null,'genre','Dance')>0,
    'offline stations stay at the bottom despite a manual ranking');
  assert.ok(compareCatalogStations(a,b,{},null,'completeness','genre','Dance')<0,
    'the saved genre position breaks ties when metadata completeness is equal');

  const model=read('backend/models/Station.js');
  const routes=read('backend/routes/stationRoutes.js');
  const controller=read('backend/controllers/stationController.js');
  const api=read('backend/routes/backofficeRoutes.js');
  const frontend=read('frontend/src/pages/Boost.jsx');
  const genre=read('frontend/src/pages/Genre.jsx');
  const region=read('frontend/src/pages/Region.jsx');

  assert.match(model,/rankings:\s*\[\{/,'scoped rankings persisted on stations');
  assert.match(routes,/router\.put\('\/admin\/stations\/reorder', protect, authorizeRoles\('admin'\)/,
    'only authenticated admins may reorder');
  assert.ok(routes.includes('ids.length !== expected.size')&&
    routes.includes('new Set(ids).size !== ids.length'),
    'reorder API refuses incomplete or duplicate lists');
  assert.ok(routes.includes('scope === \'genre\'')&&routes.includes('scope === \'region\''),
    'separate server-side filters for category and region');
  assert.ok(api.includes("router.get('/backoffice/admin/station-ranking',authorizeRoles('admin')")&&
    api.includes("select('_id name genre secondaryGenre region city frequency logo status position rankings"),
    'backoffice must load complete rankings including boost data');
  assert.ok(controller.includes('position rankings isFeatured'),
    'public stage catalog must receive scoped ordering');
  assert.ok(!controller.includes('boostStatus: false, position: 999'),
    'boost expiry must not reset manual global position');
  for(const token of ['type="number"','commitPosition','onDrop','ArrowUpToLine',
    'ArrowDownToLine','chooseScope','scopeValue','admin/stations/reorder',
    'backoffice/admin/station-ranking','boostChanged']){
    assert.ok(frontend.includes(token),'ranking editor missing '+token);
  }
  assert.ok(genre.includes("'genre',genreName")&&region.includes("'region',regionName"),
    'catalog pages must consume their individual scoped ranking');
  console.log('Boost: editable global/category/region ordering, security, and public sort fallbacks passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
