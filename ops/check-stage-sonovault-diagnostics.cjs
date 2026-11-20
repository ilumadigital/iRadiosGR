'use strict';
// SonoVault Identify contract and user-cost controls. Strictly offline, no API key,
// radio network, MongoDB or frontend needed to run this test in CI.
const assert=require('node:assert/strict');
const Module=require('node:module');
const original=Module._load;
const station={_id:'0123456789abcdef01234567',status:'approved',
  name:'Test Radio',stream:'https://radio.example.com/live.mp3'};
let sampleType='audio/mpeg',sampleSize=120000,captureFails=false;
let vendorReply={matched:true,results:[{title:'Song',artists:[{name:'Artist'}],confidence:0.96}],
  credits_charged:11};
let providerStatus=0,outboundCalls=0,publishes=0,samples=0;
Module._load=function(name,parent,isMain){
  if(String(parent?.filename||'').endsWith('stageSonovault.js')){
    if(name==='../models/Station')return {findOne:q=>{
      assert.equal(q.status,'approved');
      assert.equal(q._id,station._id);
      return {select:()=>({lean:async()=>station})};
    }};
    if(name==='./stageSonovaultAudio')return {captureAudio:async approved=>{
      assert.equal(approved.stream,station.stream,'only approved station stream used');
      samples++;
      const error=code=>Object.assign(new Error(code),{code});
      if(captureFails)throw error('STREAM_UNAVAILABLE');
      if(sampleType==='text/html')throw error('STREAM_FORMAT');
      if(sampleSize<16000)throw error('STREAM_SHORT');
      return Buffer.alloc(sampleSize,65);
    }};
    if(name==='axios')return {post:async(url,audio,options)=>{
      outboundCalls++;
      assert.equal(url,'https://api.sonovault.now/v1/tracks/identify');
      assert.ok(Buffer.isBuffer(audio),'raw audio bytes, never JSON/multipart');
      assert.equal(audio.length,sampleSize);
      assert.equal(options.headers['Content-Type'],'application/octet-stream');
      assert.equal(options.headers['x-api-key'],'svk_live_fixture123');
      assert.equal(options.maxRedirects,0);
      assert.ok(options.timeout>=50000&&options.timeout<=60000);
      if(providerStatus)throw {response:{status:providerStatus,headers:{
        'ratelimit-reset':'23'
      }}};
      return {data:vendorReply};
    }};
    if(name==='./stageSmartTracks')return {publishAI:async(s,data,kind)=>{
      assert.equal(s._id,station._id);
      assert.equal(kind,'manual');
      assert.equal(data.status.code,0);
      publishes++;
      return {foundWithAI:true};
    }};
  }
  return original.call(this,name,parent,isMain);
};
const moduleUnderTest=require('../backend/utils/stageSonovault');
Module._load=original;
const saved=Object.fromEntries(['STAGE_ENABLE_SONOVAULT','SONOVAULT_API_KEY']
  .map(k=>[k,process.env[k]]));
const response=()=>({
  code:200,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},
  json(obj){this.body=obj;return this;}
});
async function recognize(userId='u',body={stationId:station._id,streamUrl:'http://127.0.0.1/private'}){
  const res=response();
  await moduleUnderTest.stageRecognizeProxy({user:{_id:userId},body},res);
  return res;
}
async function run(){
  try{
    delete process.env.STAGE_ENABLE_SONOVAULT;
    let r=await recognize('off');
    assert.equal(r.code,503);assert.equal(r.body.code,'ACR_DISABLED');
    process.env.STAGE_ENABLE_SONOVAULT='1';
    delete process.env.SONOVAULT_API_KEY;
    r=await recognize('missing-key');
    assert.equal(r.body.code,'ACR_CONFIG');
    process.env.SONOVAULT_API_KEY='svk_test_fixture123';
    r=await recognize('demo-key');
    assert.equal(r.body.code,'SONO_KEY_TEST','demo key cannot publish mocked tracks');
    process.env.SONOVAULT_API_KEY='wrong-key';
    r=await recognize('wrong-format');
    assert.equal(r.body.code,'SONO_KEY_FORMAT');
    assert.equal(samples,0,'invalid key fails before contacting even the station');

    process.env.SONOVAULT_API_KEY='svk_live_fixture123';
    assert.equal(moduleUnderTest.readyForSonoVault(),true);
    r=await recognize('invalid-id',{stationId:'http://127.0.0.1'});
    assert.equal(r.code,400);assert.equal(r.body.code,'STATION_INVALID');
    sampleType='text/html';
    r=await recognize('bad-type');
    assert.equal(r.body.code,'STREAM_FORMAT');
    sampleType='audio/mpeg';sampleSize=100;
    r=await recognize('too-short');
    assert.equal(r.body.code,'STREAM_SHORT');
    sampleSize=120000;captureFails=true;
    r=await recognize('cannot-reach-radio');
    assert.equal(r.body.code,'STREAM_UNAVAILABLE');
    captureFails=false;
    assert.equal(outboundCalls,0,'failed captures never spend credits');

    r=await recognize('success');
    assert.equal(r.code,200);assert.equal(r.body.status.code,0);
    assert.equal(r.body.metadata.music[0].artists[0].name,'Artist');
    assert.equal(r.body.metadata.music[0].title,'Song');
    assert.equal(outboundCalls,1);assert.equal(publishes,1);

    vendorReply={matched:false,results:[],credits_charged:11};
    r=await recognize('no-match');
    assert.equal(r.code,200);assert.equal(r.body.status.code,1001);
    assert.equal(publishes,1,'true no-match does not create song');
    vendorReply={matched:true,results:[{title:'Low confidence, matched by vendor',
      artists:[{name:'Real Artist'}],confidence:0.12}]};
    r=await recognize('low-confidence');
    assert.equal(r.code,200);assert.equal(r.body.status.code,0,
      'provider matched=true is authoritative; do not impose local 0.5 gate');
    assert.equal(publishes,2);
    vendorReply={matched:true,results:[
      {title:'Incomplete',artists:[]},
      {title:'Second candidate',artists:[{name:'Second Artist'}],confidence:0.92}
    ]};
    r=await recognize('second-candidate');
    assert.equal(r.code,200);
    assert.equal(r.body.metadata.music[0].title,'Second candidate');
    assert.equal(publishes,3);
    for(const bad of [{matched:true,results:[]},{matched:true,results:[{title:'No artist',artists:[]}]},
      {error:'strange response'},'not json']){
      vendorReply=bad;
      r=await recognize('malformed-'+String(publishes)+'-'+String(outboundCalls));
      assert.equal(r.code,502);assert.equal(r.body.code,'SONO_RESPONSE');
    }
    const statuses=[
      [401,'SONO_AUTH',502],
      [402,'SONO_PAYMENT',502],
      [403,'SONO_PLAN',502],
      [400,'SONO_BAD_REQUEST',502],
      [413,'SONO_AUDIO_SIZE',502],
      [415,'SONO_AUDIO_FORMAT',502],
      [410,'SONO_NOT_AVAILABLE',502],
      [429,'SONO_QUOTA',429]
    ];
    for(const [http,code,expected] of statuses){
      providerStatus=http;
      r=await recognize('status-'+http);
      assert.equal(r.code,expected);
      assert.equal(r.body.code,code,'HTTP '+http);
      if(http===429)assert.equal(r.headers['Retry-After'],'23');
    }
    providerStatus=0;
    vendorReply={matched:false,results:[]};
    await recognize('limited');await recognize('limited');await recognize('limited');
    r=await recognize('limited');
    assert.equal(r.code,429);assert.equal(r.body.code,'ACR_RATE_LIMIT');

    vendorReply={matched:true,results:[{title:'New song',
      artists:[{name:'New artist'}],confidence:0.99}]};
    const before=outboundCalls,beforePublished=publishes;
    const both=await Promise.all([recognize('dupe-a'),recognize('dupe-b')]);
    assert.equal(both[0].code,200);assert.equal(both[1].code,200);
    assert.equal(outboundCalls,before+1,'same-station concurrent users share one API cost');
    assert.equal(publishes,beforePublished+1,'shared publication happens once');
    assert.ok(samples>=outboundCalls);
    console.log('SonoVault: live/test key, upstream statuses, matched gate, mapping, cost limits and single network publication passed.');
  }finally{
    for(const [k,value] of Object.entries(saved)){
      if(value===undefined)delete process.env[k];else process.env[k]=value;
    }
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
