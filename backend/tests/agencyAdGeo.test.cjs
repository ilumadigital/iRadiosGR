'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateAgencyGeo}=require('../services/agencyAdGeo');
test('Athens can be targeted by Greece or Attica, not individual cities',()=>{
  assert.deepEqual(validateAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'Αττική',
    targetLocations:['Αττική']}),{
    targetCountry:'Ελλάδα',targetRegion:'Αττική',targetLocations:['Αττική']});
  assert.deepEqual(validateAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'All',
    targetLocations:['Ελλάδα']}),{
    targetCountry:'Ελλάδα',targetRegion:'All',targetLocations:['Ελλάδα']});
  assert.throws(()=>validateAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'Αττική',
    targetLocations:['Αθήνα']}),/όχι πόλη/);
});
test('Loutraki belongs to Corinthia in Peloponnese, not city-targeted',()=>{
  assert.deepEqual(validateAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'Πελοπόννησος',
    targetLocations:['Κορινθία']}),{
    targetCountry:'Ελλάδα',targetRegion:'Πελοπόννησος',targetLocations:['Κορινθία']});
  assert.throws(()=>validateAgencyGeo({targetCountry:'Ελλάδα',targetRegion:'Πελοπόννησος',
    targetLocations:['Λουτράκι']}),/όχι πόλη/);
});
test('unknown location cannot become narrower than country',()=>{
  assert.deepEqual(validateAgencyGeo({targetCountry:'All',targetRegion:'All',
    targetLocations:['All']}),{
    targetCountry:'All',targetRegion:'All',targetLocations:['All']});
  assert.throws(()=>validateAgencyGeo({targetCountry:'All',targetRegion:'Αττική',
    targetLocations:['Αττική']}),/πανελλαδική/);
});
