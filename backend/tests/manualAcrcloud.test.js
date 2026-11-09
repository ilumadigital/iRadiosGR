'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {providerConfig,readyForAcrCloud,signature,normalizeMatch}=require('../utils/stageAcrcloud');
const {snapshotSong}=require('../utils/stageNativeNow');

const withConfig=(env,callback)=>{
  const keys=Object.keys(env),previous=keys.map(key=>process.env[key]);
  keys.forEach(key=>{if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];});
  try{return callback();}
  finally{keys.forEach((key,i)=>{if(previous[i]===undefined)delete process.env[key];
    else process.env[key]=previous[i];});}
};
const credentials={
  STAGE_ENABLE_ACRCLOUD:'1',
  ACRCLOUD_HOST:'identify-eu-west-1.acrcloud.com',
  ACRCLOUD_ACCESS_KEY:'test-access-key',
  ACRCLOUD_ACCESS_SECRET:'test-access-secret'
};

test('ACRCloud is opt-in and rejects URLs/internal hosts',()=>{
  withConfig(credentials,()=>{
    assert.equal(readyForAcrCloud(),true);
    assert.equal(providerConfig().host,credentials.ACRCLOUD_HOST);
  });
  withConfig({...credentials,STAGE_ENABLE_ACRCLOUD:'0'},()=>{
    assert.equal(readyForAcrCloud(),false);
  });
  for(const host of ['localhost','127.0.0.1','https://identify-eu-west-1.acrcloud.com',
    'identify-eu-west-1.acrcloud.com.evil.test','identify-eu-west-1.acrcloud.com:443']){
    withConfig({...credentials,ACRCLOUD_HOST:host},()=>assert.equal(providerConfig(),null));
  }
});

test('ACRCloud Identify Protocol V1 uses signed server-side audio request',()=>{
  const timestamp='1700000000';
  const value=withConfig(credentials,()=>signature(providerConfig(),timestamp));
  const expected=crypto.createHmac('sha1',credentials.ACRCLOUD_ACCESS_SECRET).update(
    ['POST','/v1/identify',credentials.ACRCLOUD_ACCESS_KEY,'audio','1',timestamp].join('\n')
  ).digest('base64');
  assert.equal(value,expected);
});

test('Only provider-confirmed well-formed songs can enter shared Now Playing',()=>{
  assert.deepEqual(normalizeMatch({status:{code:1001}}),{
    status:{code:1001},metadata:{music:[]}
  });
  const recognized=normalizeMatch({
    status:{code:0},metadata:{music:[{title:'Track',artists:[{name:'Artist'}],
      external_metadata:{spotify:{track:{id:'0123456789012345678901'}}}}]}
  });
  assert.equal(recognized.metadata.music[0].title,'Track');
  assert.equal(recognized.metadata.music[0].artists[0].name,'Artist');
  assert.equal(recognized.metadata.music[0].external_metadata.spotify.track.id.length,22);
  assert.throws(()=>normalizeMatch({status:{code:0},metadata:{music:[{title:'Talk',artists:[]}]}}),
    error=>error.code==='ACR_TRACK_FILTERED');
});

test('4-minute Now Playing is manual-only and expires at the stored deadline',()=>{
  const now=Date.now();
  const value=(kind,expiry)=>({currentAI:{
    raw:'Artist - Track',artist:'Artist',title:'Track',kind,
    recognizedAt:new Date(now),expiresAt:new Date(expiry)
  }});
  assert.equal(snapshotSong(value('manual',now+4*60*1000),now)?.source,'acrcloud');
  assert.equal(snapshotSong(value('manual',now-1),now),null);
  assert.equal(snapshotSong(value('auto',now+5*60*1000),now),null);
});
