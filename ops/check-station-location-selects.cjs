'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const LOCATION_DATA = require('../backend/utils/stationLocationData.json');
const frontendData = require('../frontend/src/utils/stationLocationData.json');
const {validateStationLocation, normalizeStationCity, inferPrefecture} = require('../backend/utils/stationLocations');
const read = relative => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

assert.deepEqual(frontendData, LOCATION_DATA, 'frontend/backend location catalogs must match');
const greekRegions = LOCATION_DATA['Ελλάδα'];
assert.equal(Object.keys(greekRegions).length, 13, 'all 13 Greek regions');
const allPrefectures = Object.entries(greekRegions).flatMap(([region, prefectures]) =>
  Object.entries(prefectures).map(([prefecture, cities]) => ({region, prefecture, cities})));
assert.equal(allPrefectures.length, 51, 'all 51 Greek prefectures');
assert.equal(new Set(allPrefectures.map(x => x.prefecture)).size, 51, 'each prefecture is present once');
for (const {region, prefecture, cities} of allPrefectures) {
  const capital = cities[0];
  assert.ok(capital, 'missing capital for ' + prefecture);
  const valid = validateStationLocation(
    {country:'Ελλάδα', region, prefecture, city:capital}, {required:true});
  assert.equal(valid.error, undefined, prefecture + ' capital must be accepted');
  const wrong = validateStationLocation(
    {country:'Ελλάδα', region, prefecture, city:'Άλλη Πόλη'}, {required:true});
  assert.match(wrong.error, /πρωτεύουσα/, prefecture + ' must reject non-capital');
  if (cities.length > 1) {
    const alias = validateStationLocation(
      {country:'Ελλάδα', region, prefecture, city:cities[1]}, {required:true});
    assert.match(alias.error, /πρωτεύουσα/, 'legacy city is never selectable for ' + prefecture);
  }
}
assert.equal(greekRegions['Νότιο Αιγαίο']['Κυκλάδες'][0], 'Ερμούπολη');
assert.equal(inferPrefecture('Ελλάδα', 'Αττική', 'Παλαιό Φάληρο'), 'Αττική');
assert.equal(normalizeStationCity({country:'Ελλάδα',region:'Αττική',city:'Παλαιό Φάληρο'}).data.city,'Αθήνα');
assert.equal(validateStationLocation({country:'Ελλάδα',region:'Αττική',prefecture:'Αττική',city:'Πειραιάς'},{required:true}).error.includes('πρωτεύουσα'),true);
assert.match(validateStationLocation({country:'Ελλάδα',region:'Κρήτη',prefecture:'Αττική',city:'Αθήνα'},{required:true}).error,/έγκυρη/);
assert.match(validateStationLocation({country:'Ελλάδα',region:'Αττική',prefecture:'Αττική',city:''},{required:true}).error,/Επέλεξε/);
assert.deepEqual(validateStationLocation({name:'Radio'},{current:{region:'Αττική',city:'Πειραιάς'}}).data,{name:'Radio'},'unrelated edits retain legacy locations');
const backoffice = read('frontend/src/pages/Backoffice.jsx');
for (const field of ['country','region','prefecture','city']) {
  assert.ok(backoffice.includes("value={form."+field+"}"), 'backoffice select for '+field);
  assert.ok(backoffice.includes("'"+field+"'"), 'backoffice payload includes '+field);
}
assert.ok(backoffice.includes("disabled={!form.prefecture}"), 'city dropdown disabled until prefecture is selected');
assert.ok(backoffice.includes("stationCityOptions(form.country,form.region,form.prefecture)"), 'city choices are scoped to prefectural capitals');
assert.ok(backoffice.includes("if(field==='country'){next.region='';next.prefecture='';next.city='';}"), 'country resets children');
assert.ok(backoffice.includes("if(field==='region'){next.prefecture='';next.city='';}"), 'region resets children');
assert.ok(backoffice.includes("if(field==='prefecture')next.city=''"), 'prefecture resets city');
const api = read('backend/routes/backofficeRoutes.js');
assert.ok(api.includes('checkedStationLocation(cleanEdits(req.body),{required:true})'), 'creation validates location');
assert.ok(api.includes('checkedStationLocation(cleanEdits(req.body),{current:station})'), 'editing validates location');
assert.ok(api.includes('checkedStationLocation(cleanEdits(station.pendingEdits,{ignoreUnknown:true}),{current:station})'), 'approval validates location');
for (const page of ['Admin.jsx','MyRadios.jsx']) {
  const source=read('frontend/src/pages/'+page);
  assert.ok(source.includes("prefecture: e.target.value, city: ''"), page+' forces an explicit capital selection');
  assert.ok(source.includes('stationCityOptions('), page+' filters cities');
}
console.log('Station location QA passed: 13 regions, 51 prefectures, capitals only, cascading selectors and API validation.');
