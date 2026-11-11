'use strict';
const assert = require('node:assert/strict');
const {
  CURRENT_BROADCASTER_TERMS_VERSION,
  LEGACY_BROADCASTER_TERMS_VERSION,
  hasAcceptedCurrentBroadcasterTerms,
  withBroadcasterTermsStatus
} = require('../backend/utils/broadcasterTerms');

// Legacy approvals are valid only while the current legal version is the baseline.
// After a legal revision, changing CURRENT must force legacy users to reaccept.
const legacy = {role:'broadcaster',hasAcceptedTerms:true,termsAcceptedAt:new Date('2025-05-01')};
assert.equal(hasAcceptedCurrentBroadcasterTerms(legacy),
 CURRENT_BROADCASTER_TERMS_VERSION === LEGACY_BROADCASTER_TERMS_VERSION,
 'preserve legacy consent for baseline only');
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
assert.equal(response.hasAcceptedCurrentBroadcasterTerms,
 CURRENT_BROADCASTER_TERMS_VERSION === LEGACY_BROADCASTER_TERMS_VERSION,
 'prior agreement consent cannot silently approve changed B2B terms');
assert.equal(response.requiredBroadcasterTermsVersion,CURRENT_BROADCASTER_TERMS_VERSION);
assert.equal(response.termsAcceptedAt.getFullYear(),2025);
console.log('Phase 1 broadcaster consent compatibility tests passed.');

const fs=require('node:fs'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../frontend/src/App.jsx'),'utf8');
const terms=fs.readFileSync(path.join(__dirname,'../frontend/src/pages/TermsBroadcasters.jsx'),'utf8');
assert.ok(app.includes("if(location.pathname==='/broadcaster-terms')return <TermsBroadcasters API_URL=\"/api\"/>;"),
 'Broadcaster agreement loads outside the player MainApp');
assert.ok(terms.includes("window.location.assign(destination)")&&terms.includes("'/backoffice'")&&!terms.includes("navigate('/studio')"),
 'Accepted agreement routes directly to the isolated Backoffice');
assert.ok(terms.includes("requiredBroadcasterTermsVersion")&&terms.includes("'/auth/me'"),
 'Accepting terms requires a signed account and current legal version');
assert.ok(terms.includes('id="term-11"')&&terms.includes('type="checkbox"'),
 'All 11 legal sections and explicit consent control remain visible');
