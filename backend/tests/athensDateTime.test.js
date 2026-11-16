'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {formatAthensDateTime}=require('../utils/athensDateTime');

test('customer billing emails display stable Athens dates',()=>{
 assert.equal(formatAthensDateTime('2026-11-15T22:30:00Z'),'16/11/2026 00:30');
 assert.equal(formatAthensDateTime('2026-07-15T21:30:00Z'),'16/07/2026 00:30');
 assert.equal(formatAthensDateTime('2026-03-29T01:30:00Z'),'29/03/2026 04:30');
 assert.equal(formatAthensDateTime('invalid'),'—');
 assert.equal(formatAthensDateTime(null),'—');
});
