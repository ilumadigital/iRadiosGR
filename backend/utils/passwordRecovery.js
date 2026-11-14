'use strict';

const RECOVERY_ACKNOWLEDGEMENT = 'Αν υπάρχει λογαριασμός με αυτό το email, θα λάβετε σύνδεσμο ανάκτησης. Ελέγξτε και τα Spam.';

function normalizeRecoveryEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function recoveryEmailQuery(email) {
  // Legacy accounts may have mixed-case emails or surrounding spaces.
  // Escaping prevents an email from being interpreted as arbitrary regex.
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { email: new RegExp(`^\\s*${escaped}\\s*$`, 'i') };
}

module.exports = { RECOVERY_ACKNOWLEDGEMENT, normalizeRecoveryEmail, recoveryEmailQuery };
