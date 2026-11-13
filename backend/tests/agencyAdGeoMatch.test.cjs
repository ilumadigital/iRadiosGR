'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {matchesAgencyGeo}=require('../services/agencyAdGeoMatch');
const campaign=(country,region,target)=>({
  targetCountry:country,targetRegion:region,targetLocations:[target]
});
const athens={country:'Ελλάδα',region:'Αττική',prefecture:'Αττική'};
const loutraki={country:'Ελλάδα',region:'Πελοπόννησος',prefecture:'Κορινθία'};
test('Athens matches national and Attica, but not Corinthia',()=>{
  assert.equal(matchesAgencyGeo(campaign('Ελλάδα','All','Ελλάδα'),athens),true);
  assert.equal(matchesAgencyGeo(campaign('Ελλάδα','Αττική','Αττική'),athens),true);
  assert.equal(matchesAgencyGeo(campaign('Ελλάδα','Πελοπόννησος','Κορινθία'),athens),false);
});
test('Loutraki matches Greece, Peloponnese, Corinthia not Attica',()=>{
  assert.equal(matchesAgencyGeo(campaign('Ελλάδα','All','Ελλάδα'),loutraki),true);
  assert.equal(matchesAgencyGeo(campaign('Ελλάδα','Πελοπόννησος','Πελοπόννησος'),loutraki),true);
  assert.equal(matchesAgencyGeo(campaign('Ελλάδα','Πελοπόννησος','Κορινθία'),loutraki),true);
  assert.equal(matchesAgencyGeo(campaign('Ελλάδα','Αττική','Αττική'),loutraki),false);
});
test('unknown region never unlocks prefecture campaigns',()=>{
  assert.equal(matchesAgencyGeo(campaign('Ελλάδα','Πελοπόννησος','Κορινθία'),null),false);
  assert.equal(matchesAgencyGeo(campaign('Ελλάδα','All','Ελλάδα'),null),true);
});
