'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const read=relative=>fs.readFileSync(path.join(__dirname,'..',relative),'utf8');

async function main(){
 const {sortCatalogStations,applyPostBoostLift,commercialBoostPriority}=
   await import(pathToFileURL(path.join(__dirname,'../frontend/src/utils/catalogLive.js')).href);
 const stations=Array.from({length:12},(_,i)=>({
   _id:String(i+1),name:'Station '+String(i+1).padStart(2,'0'),position:(i+1)*100,
   rankings:[{scope:'genre',value:'Rock',position:i+1},
     {scope:'region',value:'Αττική',position:i+1}]
 }));
 const ended={tier:'organic',placement:null,priority:0,
   postBoost:{positions:4,placement:'global'}};
 stations[9].commercialBoost=ended;
 assert.deepEqual(sortCatalogStations(stations).map(s=>s._id),
   ['1','2','3','4','5','10','6','7','8','9','11','12'],
   'Expired Boost rises exactly four ACTUAL slots, despite gaps in manual ranks');
 assert.equal(stations[9].position,1000,'public order must not rewrite manual editorial positions');
 assert.equal(sortCatalogStations(stations)[5]._id,'10','ranking must be deterministic on repeat');
 const first={...stations[0],commercialBoost:ended};
 assert.equal(sortCatalogStations([first,stations[1]])[0]._id,'1',
   'a station at the first organic slot cannot rise past the start');
 const active={...stations[0],commercialBoost:{tier:'purchased',placement:'global',priority:200}};
 assert.equal(sortCatalogStations([stations[9],active,stations[3],stations[4]])[0]._id,'1',
   'expired Boost must not outrank an active paid campaign');
 const offline={...stations[9],isOffline:true};
 assert.equal(sortCatalogStations([...stations.slice(0,9),offline])[9]._id,'10',
   'offline station never receives post-Boost promotion');
 const targeted={...stations[9],commercialBoost:{...ended,
   postBoost:{positions:2,placement:'targeted'}}};
 const change=stations.map(s=>s._id==='10'?targeted:s);
 assert.equal(sortCatalogStations(change).findIndex(s=>s._id==='10'),9,
   'targeted Boost has no residual advantage in global catalog');
 assert.equal(sortCatalogStations(change,{},null,'popularity','genre','Rock')
   .findIndex(s=>s._id==='10'),7,
   'targeted Boost advances two positions in matching genre');
 assert.equal(sortCatalogStations(change,{},null,'popularity','region','Αττική')
   .findIndex(s=>s._id==='10'),7,
   'targeted Boost advances two positions in matching region');
 assert.equal(sortCatalogStations(change,{},null,'popularity','genre','Dance')
   .findIndex(s=>s._id==='10'),9,
   'targeted reward cannot grant global scope by accident');
 const premium={...stations[9],commercialBoost:{tier:'premium',placement:'eligible',
   priority:100,postBoost:{positions:4,placement:'global'}}};
 assert.equal(commercialBoostPriority(premium),100,'live Premium priority stays active');
 assert.equal(sortCatalogStations(stations.map(s=>s._id==='10'?premium:s))[0]._id,'10',
   'active Premium Boost remains independent of expired history');
 assert.equal(sortCatalogStations(change,{},null,'alphabetical')
   .findIndex(s=>s._id==='10'),9,'alphabetical choice must not inherit post-Boost');
 assert.equal(sortCatalogStations(change,{},null,'date').length,12,
   'date sort preserves station count');
 assert.equal(applyPostBoostLift(stations).length,12,'reward cannot duplicate cards');
 for(const file of ['frontend/src/pages/Home.jsx','frontend/src/pages/Genre.jsx',
    'frontend/src/pages/Region.jsx','frontend/src/components/RadioGeoMap.jsx']){
   assert.match(read(file),/sortCatalogStations\(/,file+' must use consistent slot sorting');
 }
 assert.match(read('frontend/src/components/HomeExplore.jsx'),/applyPostBoostLift\(/);
 assert.match(read('backend/services/stationBillingProjectionRules.js'),/postPlacements\.size/);
 assert.match(read('backend/services/stationBillingProjection.js'),/maskStationPaidControls/);
 console.log('Expired paid/Premium Boost moves only 1–4 organic slots in Home, genre, region, discovery and map.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
