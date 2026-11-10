'use strict';
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const saved={};
for(const key of ['APP_ENV','FRONTEND_URL','TURNSTILE_SITE_KEY','TURNSTILE_SECRET_KEY'])
  saved[key]=process.env[key];
const oldFetch=global.fetch;
process.env.APP_ENV='staging';
process.env.FRONTEND_URL='https://stage.iradios.gr';
process.env.TURNSTILE_SITE_KEY='0x4AAAAAAAAAAAAAAAAAAAAAAAA';
process.env.TURNSTILE_SECRET_KEY='0x4BBBBBBBBBBBBBBBBBBBBBBBB';
const {verifyTurnstileToken,requireTurnstile,isConfigured}=require('../backend/utils/turnstile');

test('stage requires real Turnstile credentials; official test keys are rejected',()=>{
  assert.equal(isConfigured(),true);
  process.env.TURNSTILE_SITE_KEY='1x00000000000000000000AA';
  assert.equal(isConfigured(),false);
  process.env.TURNSTILE_SITE_KEY='0x4AAAAAAAAAAAAAAAAAAAAAAAA';
  process.env.TURNSTILE_SECRET_KEY='1x0000000000000000000000000000000AA';
  assert.equal(isConfigured(),false);
  process.env.TURNSTILE_SECRET_KEY='0x4BBBBBBBBBBBBBBBBBBBBBBBB';
});

test('blank/oversized token is rejected without Siteverify request',async()=>{
  global.fetch=()=>{throw Error('unexpected outbound request')};
  assert.equal((await verifyTurnstileToken('',{action:'register'})).status,400);
  assert.equal((await verifyTurnstileToken('x'.repeat(2049),{action:'register'})).status,400);
});

test('valid token is verified server-side against Cloudflare, matching hostname and action',async()=>{
  let called=false;
  global.fetch=async (url,opts)=>{
    called=true;
    assert.equal(url,'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.equal(opts.method,'POST');
    assert.equal(opts.body.get('secret'),process.env.TURNSTILE_SECRET_KEY);
    assert.equal(opts.body.get('response'),'valid-token');
    return {ok:true,json:async()=>({success:true,hostname:'stage.iradios.gr',action:'register'})};
  };
  assert.equal((await verifyTurnstileToken('valid-token',{action:'register'})).ok,true);
  assert.equal(called,true);
  assert.equal((await verifyTurnstileToken('valid-token',{action:'login'})).status,403);
  global.fetch=async()=>({ok:true,json:async()=>({success:true,hostname:'other.example',action:'register'})});
  assert.equal((await verifyTurnstileToken('valid-token',{action:'register'})).status,403);
});

test('replayed, rejected, unavailable or unconfigured Turnstile never authorizes signup',async()=>{
  global.fetch=async()=>({ok:true,json:async()=>({success:false,'error-codes':['timeout-or-duplicate']})});
  assert.equal((await verifyTurnstileToken('replayed',{action:'register'})).status,403);
  global.fetch=async()=>{throw Error('network unavailable')};
  assert.equal((await verifyTurnstileToken('token',{action:'register'})).status,503);
  process.env.TURNSTILE_SECRET_KEY='';
  assert.equal((await verifyTurnstileToken('token',{action:'register'})).code,'turnstile_not_configured');
  process.env.TURNSTILE_SECRET_KEY='0x4BBBBBBBBBBBBBBBBBBBBBBBB';
  let reached=false;
  const res={status(code){this.code=code;return this},json(json){this.body=json;return this}};
  await requireTurnstile('register')({body:{cfToken:'bad'},headers:{}},res,()=>{reached=true});
  assert.equal(reached,false);
  assert.equal(res.code,503);
});

test('login and all signup actions require Turnstile middleware, with public runtime site key',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../backend/routes/authRoutes.js'),'utf8');
  for(const action of ['register','register-agency','register-broadcaster','login']){
    assert.ok(src.includes("'/auth/"+action+"', requireTurnstile('"+action+"')"));
  }
  assert.ok(src.includes("'/auth/turnstile-config'"));
  const stage=fs.readFileSync(path.join(__dirname,'../backend/utils/stagePublicAccess.js'),'utf8');
  assert.ok(stage.includes("path === '/api/auth/register'"));
  assert.ok(stage.includes("path==='/api/auth/verify-otp'"));
  const frontend=fs.readFileSync(path.join(__dirname,'../frontend/src/hooks/useTurnstileSiteKey.js'),'utf8');
  assert.ok(frontend.includes('/auth/turnstile-config'));
});

after(()=>{
  global.fetch=oldFetch;
  for(const [key,value] of Object.entries(saved)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
