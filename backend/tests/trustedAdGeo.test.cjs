'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolveGeo}=require('../utils/trustedAdGeo');
const secret='0123456789abcdef0123456789abcdef';
test('untrusted visitor headers can never create a geo-targeting match',()=>{
 assert.equal(resolveGeo({'x-iradios-geo-country':'Ελλάδα',
 'x-iradios-geo-region':'Αττική','x-iradios-geo-prefecture':'Αττική'},secret),null);
 assert.equal(resolveGeo({'x-iradios-geo-auth':'not-secret',
 'x-iradios-geo-country':'Ελλάδα'},secret),null);
});
test('trusted normalized Loutraki prefecture resolves Corinthia',()=>{
 assert.deepEqual(resolveGeo({
  'x-iradios-geo-auth':secret,'x-iradios-geo-country':'GR',
  'x-iradios-geo-region':'Πελοπόννησος','x-iradios-geo-prefecture':'Κορινθία'
 },secret),{country:'Ελλάδα',region:'Πελοπόννησος',prefecture:'Κορινθία'});
});
test('unknown region and municipality never escape catalog validation',()=>{
 assert.deepEqual(resolveGeo({
  'x-iradios-geo-auth':secret,'x-iradios-geo-country':'GR',
  'x-iradios-geo-region':'Πελοπόννησος','x-iradios-geo-prefecture':'Λουτράκι'
 },secret),{country:'Ελλάδα',region:'Πελοπόννησος'});
 assert.deepEqual(resolveGeo({
  'x-iradios-geo-auth':secret,'x-iradios-geo-country':'GR',
  'x-iradios-geo-region':'not-real'
 },secret),{country:'Ελλάδα'});
});

test('trusted Cloudflare English region gets only catalog-verified granularity',()=>{
 assert.deepEqual(resolveGeo({
  'x-iradios-geo-auth':secret,'x-iradios-geo-country':'GR',
  'x-iradios-geo-region':'Attica'
 },secret),{country:'Ελλάδα',region:'Αττική',prefecture:'Αττική'});
 assert.deepEqual(resolveGeo({
  'x-iradios-geo-auth':secret,'x-iradios-geo-country':'GR',
  'x-iradios-geo-region':'Peloponnese'
 },secret),{country:'Ελλάδα',region:'Πελοπόννησος'});
 assert.deepEqual(resolveGeo({
  'x-iradios-geo-auth':secret,'x-iradios-geo-country':'GR',
  'x-iradios-geo-region':'Peloponnese',
  'x-iradios-geo-city':'Αθήνα'
 },secret),{country:'Ελλάδα',region:'Πελοπόννησος'});
});
test('trusted exact city mapping can locate a unique prefecture but forged headers cannot',()=>{
 const headers={'x-iradios-geo-country':'GR',
  'x-iradios-geo-region':'Peloponnese',
  'x-iradios-geo-city':'Κόρινθος'};
 assert.equal(resolveGeo(headers,secret),null);
 const actual=resolveGeo({...headers,'x-iradios-geo-auth':secret},secret);
 // The city only qualifies when it is uniquely listed in this region.
 assert.equal(actual?.country,'Ελλάδα');
 assert.equal(actual?.region,'Πελοπόννησος');
 if(actual.prefecture)assert.equal(actual.prefecture,'Κορινθία');
});
