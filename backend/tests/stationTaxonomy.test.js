'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {
  PRIMARY_CATEGORIES,SECONDARY_CATEGORIES,SECONDARY_BY_PRIMARY,normalizePrimaryCategory,
  secondaryForPrimary,isValidSecondarySelection,normalizeStationCategoryPayload,validateStationCategories
}=require('../utils/stationCategories');

test('all 13 primary groups and requested music styles are available',()=>{
  assert.equal(PRIMARY_CATEGORIES.length,13);
  assert(PRIMARY_CATEGORIES.includes('Διάφορα'));
  assert(PRIMARY_CATEGORIES.includes('Έντεχνη'));
  assert(!SECONDARY_CATEGORIES.includes('Έντεχνο'));
  assert.equal(normalizePrimaryCategory('Έντεχνα'),'Έντεχνη');
  for(const name of ['Ελληνική Μουσική','Adult Hits','Top40','Eclectic','Cosmopolitan',
    'Classic Rock','Metal','Πανηγυριώτικα','House','Afro House','Deep House','Indie Dance',
    'Soul','Funk','Hip Hop','Rap','Trap','Αθλητικές Μεταδόσεις','Downtempo','Easy Listening'])
    assert(SECONDARY_CATEGORIES.includes(name),name);
});
test('every secondary category belongs to a visible primary category',()=>{
  assert.deepEqual([...new Set(Object.values(SECONDARY_BY_PRIMARY).flat())],SECONDARY_CATEGORIES);
  for(const value of PRIMARY_CATEGORIES)assert(secondaryForPrimary(value).length>0,value);
});
test('dependent styles must match the primary and must be 1 to 3 unique values',()=>{
  assert(isValidSecondarySelection('Εναλλακτικά',['Cosmopolitan','Soul','Easy Listening']));
  assert(!isValidSecondarySelection('Εναλλακτικά',['Cosmopolitan','House']));
  assert(!isValidSecondarySelection('Ροκ',[]));
  assert(!isValidSecondarySelection('Ροκ',['Metal','Metal']));
  assert(!isValidSecondarySelection('Ροκ',['Metal','Punk','Classic Rock','Blues']));
});
test('a new station requires an explicit commercial advertising answer',()=>{
  const entry={genre:'Εναλλακτικά',secondaryGenres:['Cosmopolitan','Soul']};
  assert.match(validateStationCategories(entry,{required:true}),/διαφημίσεις/);
  assert.equal(validateStationCategories({...entry,hasCommercialAds:false},{required:true}),null);
  assert.equal(validateStationCategories({...entry,hasCommercialAds:true},{required:true}),null);
  assert.match(validateStationCategories({...entry,hasCommercialAds:null},{required:true}),/διαφημίσεις/);
});
test('multipart payloads convert safely and keep the legacy first genre',()=>{
  const data=normalizeStationCategoryPayload({genre:'Έντεχνα',
    secondaryGenres:'["Ελληνική Μουσική","Ακουστική"]',hasCommercialAds:'false'});
  assert.equal(data.genre,'Έντεχνη');
  assert.deepEqual(data.secondaryGenres,['Ελληνική Μουσική','Ακουστική']);
  assert.equal(data.secondaryGenre,'Ελληνική Μουσική');
  assert.equal(data.hasCommercialAds,false);
  assert.equal(validateStationCategories(data,{required:true}),null);
  assert.match(validateStationCategories(normalizeStationCategoryPayload({
    genre:'Dance',secondaryGenres:'not-json',hasCommercialAds:'false'
  }),{required:true}),/δευτερεύουσες/);
});
