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
// The backoffice offers 51 distinct historical prefectures. Achaia and Ilia are
// selectable under both their administrative region (Western Greece) and their
// geographic region (Peloponnese), without losing any existing station data.
const expectedByRegion = {
  'Αττική': ['Αττική'],
  'Κεντρική Μακεδονία': ['Ημαθία', 'Θεσσαλονίκη', 'Κιλκίς', 'Πέλλα', 'Πιερία', 'Σέρρες', 'Χαλκιδική'],
  'Θεσσαλία': ['Καρδίτσα', 'Λάρισα', 'Μαγνησία', 'Τρίκαλα'],
  'Δυτική Ελλάδα': ['Αιτωλοακαρνανία', 'Αχαΐα', 'Ηλεία'],
  'Πελοπόννησος': ['Αργολίδα', 'Αρκαδία', 'Αχαΐα', 'Ηλεία', 'Κορινθία', 'Λακωνία', 'Μεσσηνία'],
  'Ήπειρος': ['Άρτα', 'Θεσπρωτία', 'Ιωάννινα', 'Πρέβεζα'],
  'Στερεά Ελλάδα': ['Βοιωτία', 'Εύβοια', 'Ευρυτανία', 'Φθιώτιδα', 'Φωκίδα'],
  'Ανατολική Μακεδονία & Θράκη': ['Δράμα', 'Έβρος', 'Καβάλα', 'Ξάνθη', 'Ροδόπη'],
  'Δυτική Μακεδονία': ['Γρεβενά', 'Καστοριά', 'Κοζάνη', 'Φλώρινα'],
  'Ιόνια Νησιά': ['Ζάκυνθος', 'Κέρκυρα', 'Κεφαλληνία', 'Λευκάδα'],
  'Βόρειο Αιγαίο': ['Λέσβος', 'Σάμος', 'Χίος'],
  'Νότιο Αιγαίο': ['Δωδεκάνησα', 'Κυκλάδες'],
  'Κρήτη': ['Ηράκλειο', 'Λασίθι', 'Ρέθυμνο', 'Χανιά'],
};
assert.deepEqual(Object.keys(greekRegions).sort(), Object.keys(expectedByRegion).sort(),
  'no Greek region may be missing');
for (const [region, expected] of Object.entries(expectedByRegion)) {
  assert.deepEqual(Object.keys(greekRegions[region]).sort(), [...expected].sort(),
    'missing or unexpected prefecture in ' + region);
}
assert.equal(allPrefectures.length, 53, '51 historical prefectures plus 2 geographic aliases');
const prefectureCounts = allPrefectures.reduce((counts, entry) => {
  counts[entry.prefecture] = (counts[entry.prefecture] || 0) + 1;
  return counts;
}, {});
assert.equal(Object.keys(prefectureCounts).length, 51, 'all 51 distinct Greek prefectures');
assert.deepEqual(Object.keys(prefectureCounts).filter(name => prefectureCounts[name] !== 1).sort(),
  ['Αχαΐα', 'Ηλεία'], 'only Achaia and Ilia may appear in two regions');
assert.deepEqual(greekRegions['Πελοπόννησος']['Αχαΐα'], greekRegions['Δυτική Ελλάδα']['Αχαΐα']);
assert.deepEqual(greekRegions['Πελοπόννησος']['Ηλεία'], greekRegions['Δυτική Ελλάδα']['Ηλεία']);
assert.equal(greekRegions['Πελοπόννησος']['Αχαΐα'][0], 'Πάτρα');
assert.equal(greekRegions['Πελοπόννησος']['Ηλεία'][0], 'Πύργος');
for (const {region, prefecture, cities} of allPrefectures) {
  assert.ok(cities[0], 'missing prefectural seat for ' + prefecture);
  const isExtendedCityList = prefecture === 'Αττική' || prefecture === 'Θεσσαλονίκη';
  if (!isExtendedCityList) {
    assert.equal(cities.length, 3, 'exactly three city options required for ' + prefecture);
  }
  assert.equal(new Set(cities).size, cities.length, 'duplicate city in ' + prefecture);
  for (const city of cities) {
    const data = {country:'Ελλάδα', region, prefecture, city};
    const validated = validateStationLocation(data, {required:true});
    assert.equal(validated.error, undefined, prefecture + '/' + city + ' must be selectable');
    assert.deepEqual(validated.data, data, 'validation must preserve the selected city');
    assert.equal(normalizeStationCity(data).data.city, city,
      'legacy normalization must retain a known city ' + prefecture + '/' + city);
  }
  const wrong = validateStationLocation(
    {country:'Ελλάδα', region, prefecture, city:'Άλλη Πόλη'}, {required:true});
  assert.match(wrong.error, /διαθέσιμες πόλεις/, prefecture + ' must reject out-of-prefecture cities');
}
assert.equal(greekRegions['Αττική']['Αττική'].length, 47, 'keep existing Attica city list');
assert.equal(greekRegions['Κεντρική Μακεδονία']['Θεσσαλονίκη'].length, 19,
  'keep existing Thessaloniki city list');
assert.deepEqual(greekRegions['Πελοπόννησος']['Κορινθία'],
  ['Κόρινθος', 'Λουτράκι', 'Κιάτο']);
assert.deepEqual(greekRegions['Πελοπόννησος']['Ηλεία'],
  ['Πύργος', 'Κρέστενα', 'Αμαλιάδα']);
assert.deepEqual(greekRegions['Πελοπόννησος']['Αχαΐα'],
  ['Πάτρα', 'Αίγιο', 'Κάτω Αχαΐα']);
assert.equal(greekRegions['Νότιο Αιγαίο']['Κυκλάδες'][0], 'Ερμούπολη');
assert.equal(inferPrefecture('Ελλάδα', 'Αττική', 'Παλαιό Φάληρο'), 'Αττική');
assert.equal(inferPrefecture('Ελλάδα', 'Πελοπόννησος', 'Κρέστενα'), 'Ηλεία');
assert.equal(normalizeStationCity({country:'Ελλάδα',region:'Αττική',city:'Παλαιό Φάληρο'}).data.city,
  'Παλαιό Φάληρο');
assert.equal(normalizeStationCity({country:'Ελλάδα',region:'Πελοπόννησος',city:'Λουτράκι'}).data.city,
  'Λουτράκι');
assert.equal(normalizeStationCity({country:'Ελλάδα',region:'Πελοπόννησος',city:'Αράχωβα',
  prefecture:'Βοιωτία'}).error !== undefined, true, 'cross-region prefecture is rejected');
assert.equal(validateStationLocation({country:'Ελλάδα',region:'Αττική',prefecture:'Αττική',
  city:'Πειραιάς'},{required:true}).error,undefined);
assert.match(validateStationLocation({country:'Κύπρος',region:'Κύπρος',prefecture:'Λευκωσία',
  city:'Στρόβολος'},{required:true}).error,/διαθέσιμες πόλεις/,
  'Cyprus should still retain its capital-only validation');
assert.match(validateStationLocation({country:'Ελλάδα',region:'Κρήτη',prefecture:'Αττική',city:'Αθήνα'},{required:true}).error,/έγκυρη/);
assert.match(validateStationLocation({country:'Ελλάδα',region:'Αττική',prefecture:'Αττική',city:''},{required:true}).error,/Επέλεξε/);
assert.deepEqual(validateStationLocation({name:'Radio'},{current:{region:'Αττική',city:'Πειραιάς'}}).data,{name:'Radio'},'unrelated edits retain legacy locations');
const frontendLocations = read('frontend/src/utils/stationLocations.js');
assert.ok(frontendLocations.includes("actualCountry === 'Ελλάδα' || actualCountry === 'Εξωτερικό'"),
  'frontend must expose all Greek city options');
assert.ok(frontendLocations.includes('cities.find(option => clean(option) === clean(station.city))'),
  'editing must preserve existing non-capital city selections');
const backoffice = read('frontend/src/pages/Backoffice.jsx');
for (const field of ['country','region','prefecture','city']) {
  assert.ok(backoffice.includes("value={form."+field+"}"), 'backoffice select for '+field);
  assert.ok(backoffice.includes("'"+field+"'"), 'backoffice payload includes '+field);
}
assert.ok(backoffice.includes("disabled={!form.prefecture}"), 'city dropdown disabled until prefecture is selected');
assert.ok(backoffice.includes("stationCityOptions(form.country,form.region,form.prefecture)"), 'city choices are scoped to the selected prefecture');
assert.ok(backoffice.includes("if(field==='country'){next.region='';next.prefecture='';next.city='';}"), 'country resets children');
assert.ok(backoffice.includes("if(field==='region'){next.prefecture='';next.city='';}"), 'region resets children');
assert.ok(backoffice.includes("if(field==='prefecture')next.city=''"), 'prefecture resets city');
const api = read('backend/routes/backofficeRoutes.js');
assert.ok(api.includes('checkedStationLocation(cleanEdits(req.body),{required:true})'), 'creation validates location');
assert.ok(api.includes('checkedStationLocation(cleanEdits(req.body),{current:station})'), 'editing validates location');
assert.ok(api.includes('checkedStationLocation(cleanEdits(station.pendingEdits,{ignoreUnknown:true}),{current:station})'), 'approval validates location');
for (const page of ['Admin.jsx','MyRadios.jsx']) {
  const source=read('frontend/src/pages/'+page);
  assert.ok(source.includes("prefecture: e.target.value, city: ''"), page+' forces an explicit city selection');
  assert.ok(source.includes('stationCityOptions('), page+' filters cities');
}
console.log('Station location QA passed: 13 regions, 51 prefectures, 3 city choices (except Attica/Thessaloniki), preserved selection, cascading forms and API validation.');
