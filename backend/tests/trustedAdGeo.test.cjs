'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolveGeo}=require('../utils/trustedAdGeo');
const secret='0123456789abcdef0123456789abcdef';
const trusted=extra=>({'x-iradios-geo-auth':secret,
 'x-iradios-geo-country':'GR',...extra});

test('untrusted visitor headers and invalid signing tokens cannot create geo match',()=>{
 assert.equal(resolveGeo({'x-iradios-geo-country':'GR',
  'x-iradios-geo-region':'Attica','x-iradios-geo-city':'Athens'},secret),null);
 assert.equal(resolveGeo({'x-iradios-geo-auth':'not-secret',
  'x-iradios-geo-country':'GR'},secret),null);
 assert.equal(resolveGeo(trusted({'x-iradios-geo-country':'XX'}),secret),null);
 assert.equal(resolveGeo(trusted({}),''),null);
});
test('trusted Greek administrative names and legacy prefecture remain compatible',()=>{
 assert.deepEqual(resolveGeo(trusted({
  'x-iradios-geo-region':'Πελοπόννησος',
  'x-iradios-geo-prefecture':'Κορινθία'
 }),secret),{country:'Ελλάδα',region:'Πελοπόννησος',prefecture:'Κορινθία'});
 assert.deepEqual(resolveGeo(trusted({
  'x-iradios-geo-region':'Πελοπόννησος',
  'x-iradios-geo-prefecture':'Λουτράκι'
 }),secret),{country:'Ελλάδα',region:'Πελοπόννησος'});
});
test('MaxMind English region Attica resolves catalog region and sole prefecture',()=>{
 assert.deepEqual(resolveGeo(trusted({
  'x-iradios-geo-region':'Attica',
  'x-iradios-geo-city':'Athens'
 }),secret),{country:'Ελλάδα',region:'Αττική',prefecture:'Αττική'});
});
test('MaxMind East Macedonia, Thessaly and Aegean aliases resolve conservatively',()=>{
 for(const [input,expected] of [
  ['Eastern Macedonia and Thrace','Ανατολική Μακεδονία & Θράκη'],
  ['Western Macedonia','Δυτική Μακεδονία'],
  ['Central Macedonia','Κεντρική Μακεδονία'],
  ['Thessaly','Θεσσαλία'],
  ['South Aegean','Νότιο Αιγαίο'],
  ['North Aegean','Βόρειο Αιγαίο'],
  ['Western Greece','Δυτική Ελλάδα'],
  ['Crete','Κρήτη']
 ])assert.deepEqual(resolveGeo(trusted({
   'x-iradios-geo-region':input
  }),secret),{country:'Ελλάδα',region:expected});
});
test('city-to-prefecture needs a genuine matching city and at most 25km accuracy',()=>{
 const base={'x-iradios-geo-region':'Central Macedonia',
   'x-iradios-geo-city':'Thessaloniki'};
 assert.deepEqual(resolveGeo(trusted({...base,
  'x-iradios-geo-accuracy-km':'20'}),secret),
  {country:'Ελλάδα',region:'Κεντρική Μακεδονία',prefecture:'Θεσσαλονίκη'});
 for(const missing of [undefined,'','0','26','100','NaN','-2']){
  const headers=trusted({...base,'x-iradios-geo-accuracy-km':missing});
  assert.deepEqual(resolveGeo(headers,secret),
    {country:'Ελλάδα',region:'Κεντρική Μακεδονία'});
 }
 assert.deepEqual(resolveGeo(trusted({
   'x-iradios-geo-region':'Thessaly',
   'x-iradios-geo-city':'Thessaloniki',
   'x-iradios-geo-accuracy-km':'5'
  }),secret),{country:'Ελλάδα',region:'Θεσσαλία'});
});
test('unknown region never becomes a fabricated regional match',()=>{
 assert.deepEqual(resolveGeo(trusted({
  'x-iradios-geo-region':'unknown'
 }),secret),{country:'Ελλάδα'});
 assert.deepEqual(resolveGeo(trusted({
  'x-iradios-geo-region':'',
  'x-iradios-geo-prefecture':'Αττική'
 }),secret),{country:'Ελλάδα'});
});
test('verified Cyprus Nicosia is mapped only within Cyprus catalog',()=>{
 assert.deepEqual(resolveGeo({
  'x-iradios-geo-auth':secret,'x-iradios-geo-country':'CY',
  'x-iradios-geo-region':'Nicosia',
  'x-iradios-geo-city':'Nicosia',
  'x-iradios-geo-accuracy-km':'15'
 },secret),{country:'Κύπρος',region:'Κύπρος',prefecture:'Λευκωσία'});
});
