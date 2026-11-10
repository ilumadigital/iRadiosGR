'use strict';
const crypto=require('node:crypto');
const EMAIL_VERIFICATION_TTL_MS=24*60*60*1000;
function hashEmailVerificationToken(token){
  return crypto.createHash('sha256').update(token).digest('hex');
}
function createEmailVerification(now=new Date()){
  const token=crypto.randomBytes(32).toString('hex');
  return {token,fields:{
    verificationTokenHash:hashEmailVerificationToken(token),
    verificationTokenExpires:new Date(now.getTime()+EMAIL_VERIFICATION_TTL_MS),
    verificationEmailLastSentAt:now
  }};
}
module.exports={EMAIL_VERIFICATION_TTL_MS,hashEmailVerificationToken,createEmailVerification};
