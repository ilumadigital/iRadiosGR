'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRecoveryEmail, recoveryEmailQuery, RECOVERY_ACKNOWLEDGEMENT
} = require('../utils/passwordRecovery');

test('email recovery normalizes mixed-case addresses without losing plus tags', () => {
  assert.equal(normalizeRecoveryEmail('  First.Last+Radio@GMAIL.COM  '), 'first.last+radio@gmail.com');
  assert.equal(normalizeRecoveryEmail('station@Example.GR'), 'station@example.gr');
});

test('email recovery rejects invalid input before querying MongoDB', () => {
  for (const value of [null, {}, '', ' @example.gr', 'invalid', 'a b@example.gr', 'a@localhost', `${'a'.repeat(245)}@example.gr`]) {
    assert.equal(normalizeRecoveryEmail(value), null);
  }
});

test('email query matches legacy case and whitespace but never a different mailbox', () => {
  const { email } = recoveryEmailQuery(normalizeRecoveryEmail('  FIRST.LAST+NEWS@GMAIL.COM '));
  assert.ok(email.test('first.last+news@gmail.com'));
  assert.ok(email.test(' First.Last+News@Gmail.com '));
  assert.ok(!email.test('other.first.last+news@gmail.com'));
  assert.ok(!email.test('firstXlast+news@gmail.com'));
  assert.ok(!email.test('first.last+news@gmail.com.attacker.net'));
});

test('public acknowledgement never reveals whether the account exists', () => {
  assert.match(RECOVERY_ACKNOWLEDGEMENT, /Αν υπάρχει λογαριασμός/);
  assert.doesNotMatch(RECOVERY_ACKNOWLEDGEMENT, /δεν βρέθηκε/);
});
