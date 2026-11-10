'use strict';

// This version identifies the existing B2B agreement displayed by TermsBroadcasters.
// Increase CURRENT when the legal text changes; NEVER change LEGACY (historic records).
const LEGACY_BROADCASTER_TERMS_VERSION = 'broadcaster-b2b-v1';
const CURRENT_BROADCASTER_TERMS_VERSION = 'broadcaster-b2b-v1';

function hasAcceptedCurrentBroadcasterTerms(user) {
  if (!user || user.role !== 'broadcaster' || user.hasAcceptedTerms !== true) {
    return false;
  }
  // Historical accepted accounts have no version because the old UI saved
  // hasAcceptedTerms and termsAcceptedAt only. Keep their original consent.
  const acceptedVersion = user.termsAcceptedVersion ?? LEGACY_BROADCASTER_TERMS_VERSION;
  return acceptedVersion === CURRENT_BROADCASTER_TERMS_VERSION;
}

function withBroadcasterTermsStatus(user) {
  if (!user) return user;
  const data = typeof user.toObject === 'function' ? user.toObject() : { ...user };

  // Never leak authentication/recovery secrets in /auth/me or consent responses.
  delete data.password;
  delete data.verificationOtp;
  delete data.otpExpires;
  delete data.verificationTokenHash;
  delete data.verificationTokenExpires;
  delete data.verificationEmailLastSentAt;
  delete data.resetPasswordToken;
  delete data.resetPasswordExpires;

  if (data.role === 'broadcaster') {
    data.requiredBroadcasterTermsVersion = CURRENT_BROADCASTER_TERMS_VERSION;
    data.hasAcceptedCurrentBroadcasterTerms = hasAcceptedCurrentBroadcasterTerms(data);
  }
  return data;
}

module.exports = {
  LEGACY_BROADCASTER_TERMS_VERSION,
  CURRENT_BROADCASTER_TERMS_VERSION,
  hasAcceptedCurrentBroadcasterTerms,
  withBroadcasterTermsStatus
};
