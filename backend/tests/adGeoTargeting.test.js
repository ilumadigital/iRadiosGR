'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validAgencyGeo}=require('../services/adGeoTargeting');
test('National targeting is valid, country-All is not',()=>{
 assert.equal(validAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'All',targetLocations:['Ελλάδα']}),true);
 assert.equal(validAgencyGeo({targetCountry:'All',targetRegion:'All',targetLocations:['All']}),false);
});
test('Peloponnese / Corinthia is valid, city is rejected',()=>{
 assert.equal(validAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'Πελοπόννησος',targetLocations:['Πελοπόννησος']}),true);
 assert.equal(validAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'Πελοπόννησος',targetLocations:['Κορινθία']}),true);
 assert.equal(validAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'Πελοπόννησος',targetLocations:['Λουτράκι']}),false);
 assert.equal(validAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'Αττική',targetLocations:['Κορινθία']}),false);
});
