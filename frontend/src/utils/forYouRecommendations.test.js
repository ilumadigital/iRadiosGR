import test from 'node:test';
import assert from 'node:assert/strict';
import {selectForYouStations,buildListeningInterests} from './forYouRecommendations.js';

const station=(n,genre,secondaryGenre='')=>({
  _id:String(n).padStart(24,'0'),name:'Radio '+n,genre,secondaryGenre,
  status:'approved',position:n,isOffline:false
});
const stations=[
  station(1,'Dance','Dance Pop'),station(2,'Dance','EDM'),
  station(3,'Dance','Disco'),station(4,'Ηλεκτρονική','Deep House'),
  station(5,'Ηλεκτρονική','Tech House'),station(6,'Εναλλακτικά','Indie Dance'),
  station(7,'Ελληνικά Επιτυχίες','Ελληνική Pop'),
  station(8,'Διεθνή Mainstream','Pop'),
  station(9,'Ροκ','Classic Rock'),station(10,'Ειδησεογραφικά','Πολιτική'),
  station(11,'Ελληνικά Λαϊκά','Ρεμπέτικα'),station(12,'Παραδοσιακά','Κρητικά')
];
const profile=id=>({stations:{
  [stations[id-1]._id]:{seconds:12_000,sessions:9,lastPlayedAt:Date.now()}
},categories:{}});

test('cold-start profiles show several different genres and no duplicates',()=>{
  const result=selectForYouStations(stations,{listeningProfile:{stations:{}}});
  assert.equal(new Set(result.map(s=>s._id)).size,stations.length);
  assert.ok(new Set(result.slice(0,6).map(s=>s.genre)).size>=4);
});
test('Dance preference keeps Dance prominent but introduces electronic and adjacent discovery',()=>{
  const result=selectForYouStations(stations,{listeningProfile:profile(1)});
  assert.equal(result[0].genre,'Dance');
  assert.ok(result.slice(0,9).some(s=>s.genre==='Ηλεκτρονική'));
  assert.ok(result.slice(0,10).some(s=>s.genre==='Εναλλακτικά'));
});
test('secondary genres distinguish Deep House from generic dance tastes',()=>{
  const profileData=profile(4);
  const weights=buildListeningInterests(stations,{listeningProfile:profileData});
  assert.ok(weights.get('Deep House')>weights.get('Ηλεκτρονική'));
  const result=selectForYouStations(stations,{listeningProfile:profileData});
  assert.equal(result[0]._id,stations[3]._id);
});
test('Greek preferences can discover international Pop without becoming random news',()=>{
  const result=selectForYouStations(stations,{listeningProfile:profile(7)});
  assert.equal(result[0].genre,'Ελληνικά Επιτυχίες');
  assert.ok(result.findIndex(s=>s._id===stations[7]._id)<result.findIndex(s=>s._id===stations[9]._id));
});
test('offline station is always last, regardless of personal score',()=>{
  const input=stations.map(s=>({...s,isOffline:s._id===stations[0]._id}));
  const result=selectForYouStations(input,{listeningProfile:profile(1)});
  assert.equal(result.at(-1)._id,stations[0]._id);
});
test('filtering candidates never re-adds stations excluded by category or search',()=>{
  const input=stations.filter(s=>s.genre==='Dance');
  const result=selectForYouStations(input,{listeningProfile:profile(7)});
  assert.deepEqual(new Set(result.map(s=>s._id)),new Set(input.map(s=>s._id)));
});
