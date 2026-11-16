import test from 'node:test';
import assert from 'node:assert/strict';
import {formatDate, formatDateTime, formatTime, formatInputDate, parseGreekDate,
  formatLocalDateTime, parseGreekDateTime, toAthensLocalDateTime, toAthensDateKey, athensWallTimeToIso}
  from './dateTime.js';

test('Athens midnight crossing never follows the browser timezone', () => {
  assert.equal(formatDate('2026-11-15T22:30:00Z'), '16/11/2026');
  assert.equal(formatDateTime('2026-11-15T22:30:00Z'), '16/11/2026 00:30');
  assert.equal(formatTime('2026-11-15T22:30:00Z'), '00:30');
  assert.equal(toAthensDateKey('2026-11-15T22:30:00Z'), '2026-11-16');
});
test('Athens DST transition and winter use the correct offsets', () => {
  assert.equal(formatDateTime('2026-03-29T01:30:00Z'), '29/03/2026 04:30');
  assert.equal(formatDateTime('2026-10-25T01:30:00Z'), '25/10/2026 03:30');
  assert.equal(toAthensLocalDateTime('2026-03-29T01:30:00Z'), '2026-03-29T04:30');
  assert.equal(toAthensLocalDateTime('2026-10-25T01:30:00Z'), '2026-10-25T03:30');
});
test('strict DD/MM/YYYY user input round trips without locale-dependent parsing', () => {
  assert.equal(formatDate('2026-11-16'), '16/11/2026');
  assert.equal(formatInputDate('2028-02-29'), '29/02/2028');
  assert.equal(parseGreekDate('29/02/2028'), '2028-02-29');
  assert.equal(parseGreekDate('29/02/2027'), null);
  assert.equal(parseGreekDate('31/04/2026'), null);
  assert.equal(parseGreekDate('11/16/2026'), null);
  assert.equal(formatDate('invalid'), '—');
  assert.equal(formatDate(null), '—');
});
test('DD/MM/YYYY HH:mm form text preserves ISO local protocol values', () => {
  assert.equal(formatLocalDateTime('2026-11-16T14:35'), '16/11/2026 14:35');
  assert.equal(parseGreekDateTime('16/11/2026 14:35'), '2026-11-16T14:35');
  assert.equal(parseGreekDateTime('16/11/2026 24:01'), null);
  assert.equal(parseGreekDateTime('31/02/2026 12:00'), null);
  assert.equal(toAthensLocalDateTime(null), '');
});

test('Athens wall-clock conversions preserve UTC instants across DST', () => {
  assert.equal(athensWallTimeToIso('2026-11-16T14:35'), '2026-11-16T12:35:00.000Z');
  assert.equal(athensWallTimeToIso('2026-07-16T14:35'), '2026-07-16T11:35:00.000Z');
  assert.equal(athensWallTimeToIso('2026-03-29T03:30'), null);
  assert.equal(athensWallTimeToIso('2026-10-25T03:30'), '2026-10-25T00:30:00.000Z');
});
