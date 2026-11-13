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
