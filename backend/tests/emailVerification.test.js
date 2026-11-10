'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEmailVerification,hashEmailVerificationToken,EMAIL_VERIFICATION_TTL_MS}=require('../utils/emailVerification');
test('Link tokens are random, one-time hashes with 24h expiry',()=>{
 const now=new Date('2026-11-10T10:00:00Z');
 const a=createEmailVerification(now),b=createEmailVerification(now);
 assert.match(a.token,/^[a-f0-9]{64}$/);
 assert.notEqual(a.token,b.token);
 assert.notEqual(a.fields.verificationTokenHash,a.token);
 assert.equal(a.fields.verificationTokenHash,hashEmailVerificationToken(a.token));
 assert.notEqual(a.fields.verificationTokenHash,b.fields.verificationTokenHash);
 assert.equal(a.fields.verificationTokenExpires.getTime()-now.getTime(),EMAIL_VERIFICATION_TTL_MS);
});
