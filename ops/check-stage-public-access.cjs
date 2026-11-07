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
 return {res,reached,result};
}
for(const p of ['/stations','/stations/discovery','/proxy-stream','/health','/cover-art']) {
 const result=call('GET',p);
 assert.equal(result.reached,true,'allow public '+p);
}
for(const p of ['/admin/users','/stations/all','/auth/me','/agency/test','/payments']) {
 const result=call('GET',p);
 assert.equal(result.reached,false,'block private '+p);
 assert.equal(result.res.code,401);
}
const blocked=call('POST','/stations');
assert.equal(blocked.res.code,401);
(async()=>{
 const result=call('POST','/auth/login',{identifier:'not-an-admin'});
 await result.result;
 assert.equal(result.res.code,403);
 console.log('Public stage route authorization tests passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
