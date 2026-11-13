import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveListenerAdGeo,geoAllowsCanonicalArea} from './adGeoTargeting.js';
test('Athens resolves to nationwide, Attica, not Peloponnese',()=>{
 const loc={city:'Athens',region:'Attica',country:'GR',countryName:'Greece'};
 assert.deepEqual(resolveListenerAdGeo(loc),{country:'Ελλάδα',region:'Αττική',prefecture:'Αττική'});
 for(const area of ['Ελλάδα','Αττική'])assert.equal(geoAllowsCanonicalArea([area],loc),true);
 assert.equal(geoAllowsCanonicalArea(['Κορινθία'],loc),false);
});
test('Loutraki resolves to Corinthia and Peloponnese',()=>{
 const loc={city:'Loutraki',region:'Peloponnese',country:'GR'};
 assert.deepEqual(resolveListenerAdGeo(loc),{country:'Ελλάδα',region:'Πελοπόννησος',prefecture:'Κορινθία'});
 for(const area of ['Ελλάδα','Πελοπόννησος','Κορινθία'])
   assert.equal(geoAllowsCanonicalArea([area],loc),true);
 assert.equal(geoAllowsCanonicalArea(['Αργολίδα'],loc),false);
});
test('region-only location never matches unknown county',()=>{
 const loc={city:'Unknown',region:'Peloponnese',country:'GR'};
 assert.equal(geoAllowsCanonicalArea(['Κορινθία'],loc),false);
 assert.equal(geoAllowsCanonicalArea(['Πελοπόννησος'],loc),true);
});
test('missing location permits only global inventory',()=>{
 assert.equal(geoAllowsCanonicalArea(['Κορινθία'],null),false);
 assert.equal(geoAllowsCanonicalArea(['Ελλάδα'],null),false);
 assert.equal(geoAllowsCanonicalArea(['All'],null),true);
});
