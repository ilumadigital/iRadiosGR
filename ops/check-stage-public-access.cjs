'use strict';
// Pure, offline unit tests for the public/read-only API middleware.
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(name, parent, isMain) {
  if (parent?.filename?.endsWith('stagePublicAccess.js')) {
    if (name === './authMiddleware')
      return {protect:(req,res,next)=>res.status(401).json({error:'auth required'})};
    if (name === './roleMiddleware')
      return {authorizeRoles:()=>(req,res,next)=>next()};
    if (name === '../models/User')
      return {exists:async()=>false};
    if (name === '../models/BroadcasterInvitation')
      return {findOne:()=>({select:async()=>({_id:'invite-test-id'})})};
  }
  return originalLoad.call(this,name,parent,isMain);
};
const {stagePublicAccess} = require('../backend/utils/stagePublicAccess');
Module._load=originalLoad;
function response() {
 return { code:0, body:null, status(n){this.code=n;return this;},json(o){this.body=o;return this;} };
}
function call(method,path,body) {
 const res=response();let reached=false;
 const result=stagePublicAccess({method,baseUrl:'/api',path,body},res,()=>{reached=true;});
 return {res,get reached(){return reached;},result};
}
for(const p of ['/stations','/stations/discovery','/proxy-stream','/health','/cover-art','/home-slides']) {
 const result=call('GET',p);
 assert.equal(result.reached,true,'allow public '+p);
}
for(const p of ['/admin/users','/stations/all','/auth/me','/metadata','/agency/test','/payments']) {
 const result=call('GET',p);
 assert.equal(result.reached,false,'block private '+p);
 assert.equal(result.res.code,401);
}
const playlistWithoutJwt=call('GET','/stations/0123456789abcdef01234567/playlist');
assert.equal(playlistWithoutJwt.reached,false,'station music history requires login');
assert.equal(playlistWithoutJwt.res.code,401);
const adminSlidesWithoutJwt=call('GET','/admin/home-slides');
assert.equal(adminSlidesWithoutJwt.reached,false,'slide editing requires admin token');
assert.equal(adminSlidesWithoutJwt.res.code,401);
const consentWithoutJwt=call('PUT','/users/me/accept-terms');
assert.equal(consentWithoutJwt.reached,false,'terms acceptance requires JWT');
assert.equal(consentWithoutJwt.res.code,401);
const recognizeWithoutJwt=call('POST','/recognize-proxy',{stationId:'000000000000000000000000'});
assert.equal(recognizeWithoutJwt.reached,false,'cloud recognition requires JWT');
assert.equal(recognizeWithoutJwt.res.code,401);
const inviteWithoutToken=call('POST','/producers/accept-invite',{token:'short',newPassword:'some-long-password'});
assert.equal(inviteWithoutToken.res.code,400,'invite endpoint needs signed token-shaped input');
const validInvite=call('POST','/producers/accept-invite',{
 token:'abc.def.ghi'.padEnd(64,'a'),newPassword:'secure-long-password'
});
assert.equal(validInvite.reached,true,'signed invite verification endpoint is reachable for guests');
const invitationPreview=call('GET','/broadcaster-invitations/preview');
assert.equal(invitationPreview.reached,true,'invite-specific public preview is reachable');
const forbiddenSignup=call('POST','/auth/register-broadcaster',{email:'invalid@example.com'});
assert.equal(forbiddenSignup.res.code,403,'stage must never allow open broadcaster signup');
const badOtp=call('POST','/auth/verify-otp',{email:'invalid@example.com',otp:'bad'});
assert.equal(badOtp.res.code,400,'malformed OTP must be rejected before DB lookup');
const publicOtp=call('POST','/auth/verify-otp',{email:'listener@example.com',otp:'123456'});
assert.equal(publicOtp.reached,true,'Listener OTP must be reachable without admin credentials');
const publicSignup=call('POST','/auth/register',{email:'listener@example.com',username:'listener1'});
assert.equal(publicSignup.reached,true,'Listener registration must reach mandatory Turnstile middleware');
const publicAgency=call('POST','/auth/register-agency',{email:'agency@example.com',username:'agency1'});
assert.equal(publicAgency.reached,true,'Agency registration must reach mandatory Turnstile middleware');
const config=call('GET','/auth/turnstile-config');
assert.equal(config.reached,true,'Public site key must be available without admin JWT');
const blocked=call('POST','/stations');
assert.equal(blocked.res.code,401);
(async()=>{
 const result=call('POST','/auth/login',{identifier:'existing-user',password:'some-password'});
 await result.result;
 assert.equal(result.reached,true,'normal existing users may reach credential validation');
 const validOnboarding=call('POST','/auth/register-broadcaster',{
   email:'broadcaster@example.com',inviteToken:'a'.repeat(64)
 });
 await validOnboarding.result;
 assert.equal(validOnboarding.reached,true,'token-validated registration may reach normal auth controller');
 console.log('Public stage route authorization tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
