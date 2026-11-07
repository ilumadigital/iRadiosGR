'use strict';
const assert = require('node:assert/strict');
const {
  CURRENT_BROADCASTER_TERMS_VERSION,
  LEGACY_BROADCASTER_TERMS_VERSION,
  hasAcceptedCurrentBroadcasterTerms,
  withBroadcasterTermsStatus
} = require('../backend/utils/broadcasterTerms');

assert.equal(CURRENT_BROADCASTER_TERMS_VERSION, LEGACY_BROADCASTER_TERMS_VERSION,
  'Baseline should preserve legacy consents; change CURRENT only when terms change');
const legacy = {role:'broadcaster',hasAcceptedTerms:true,termsAcceptedAt:new Date('2025-05-01')};
assert.equal(hasAcceptedCurrentBroadcasterTerms(legacy),true,'retain legacy broadcaster consent');
assert.equal(hasAcceptedCurrentBroadcasterTerms({role:'broadcaster',hasAcceptedTerms:false}),false);
assert.equal(hasAcceptedCurrentBroadcasterTerms({
 role:'broadcaster',hasAcceptedTerms:true,termsAcceptedVersion:CURRENT_BROADCASTER_TERMS_VERSION
}),true);
assert.equal(hasAcceptedCurrentBroadcasterTerms({
 role:'broadcaster',hasAcceptedTerms:true,termsAcceptedVersion:'some-other-version'
}),false,'require consent if version is different');
assert.equal(hasAcceptedCurrentBroadcasterTerms({role:'agency',hasAcceptedTerms:true}),false);

const response = withBroadcasterTermsStatus({
 ...legacy,
 password:'DO-NOT-LEAK',
 verificationOtp:'123456',
 otpExpires:new Date(),
 resetPasswordToken:'DO-NOT-LEAK',
 resetPasswordExpires:new Date()
});
assert.equal(response.password,undefined);
assert.equal(response.verificationOtp,undefined);
assert.equal(response.resetPasswordToken,undefined);
assert.equal(response.hasAcceptedCurrentBroadcasterTerms,true);
assert.equal(response.requiredBroadcasterTermsVersion,CURRENT_BROADCASTER_TERMS_VERSION);
assert.equal(response.termsAcceptedAt.getFullYear(),2025);
console.log('Phase 1 broadcaster consent compatibility tests passed.');
