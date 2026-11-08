'use strict';
// Offline-only manual SonoVault contract and spending guard tests.
// No network, provider credits, MongoDB or frontend redesign.
const assert=require('node:assert/strict');
const Module=require('node:module');
const orig=Module._load;
const station={_id:'0123456789abcdef01234567',status:'approved',
  name:'Test Radio',stream:'https://radio.example.com/live.mp3'};
let sampleType='audio/mpeg',sampleSize=120000,failCapture=false;
let reply={matched:true,results:[{title:'Song',artists:[{name:'Artist'}],confidence:0.97}]};
let errorStatus=0,calls=0,publishes=0,captured=[],requestHeader;
Module._load=function(name,parent,isMain){
  if(String(parent?.filename||'').endsWith('stageSonovault.js')){
    if(name==='../models/Station')return {findOne:query=>{
      assert.equal(query.status,'approved');
      assert.equal(query._id,station._id);
      return {select:()=>({lean:async()=>station})};
    }};
    if(name==='./stageSafeRadioFetch')return {readPublicUrl:async(url,options)=>{
      assert.equal(url,station.stream,'only DB-approved station streams');
      assert.ok(options.timeoutMs>=25000&&options.timeoutMs<=35000,
        'capture needs about 30 seconds of radio audio');
      assert.ok(options.maxBytes<=1048576&&options.maxBytes>=800000,
        'upstream sample stays within one billed MB');
      captured.push(url);
      if(failCapture)throw new Error('Offline stream');
      return {headers:{'content-type':sampleType},buffer:Buffer.alloc(sampleSize,65)};
    }};
    if(name==='axios')return {post:async(url,audio,options)=>{
      calls++;
      assert.equal(url,'https://api.sonovault.now/v1/tracks/identify');
      assert.ok(Buffer.isBuffer(audio),'raw bytes, NOT JSON or multipart');
      assert.equal(audio.length,sampleSize);
      assert.equal(options.headers['Content-Type'],'application/octet-stream');
      assert.equal(options.headers['x-api-key'],'test-api-key');
      assert.equal(options.maxRedirects,0);
      assert.ok(options.timeout>=45000 && options.timeout<=60000,
        'fingerprint service must have enough time to return a billed match');
      requestHeader=options.headers;
      if(errorStatus)throw {response:{status:errorStatus}};
      return {data:reply};
    }};
    if(name==='./stageSmartTracks')return {publishAI:async(s,data,kind)=>{
      assert.equal(s._id,station._id);
      assert.equal(kind,'manual');
      assert.equal(data.status.code,0);
      publishes++;
      return {foundWithAI:true};
    }};
  }
  return orig.call(this,name,parent,isMain);
};
const recognizer=require('../backend/utils/stageSonovault');
Module._load=orig;
const keys=['STAGE_ENABLE_SONOVAULT','SONOVAULT_API_KEY'];
const prev=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const response=()=>({
  code:200,body:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},
  json(value){this.body=value;return this;}
});
async function recognize(user='listener',body={stationId:station._id,streamUrl:'http://127.0.0.1/private'}){
  const res=response();
  await recognizer.stageRecognizeProxy({user:{_id:user},body},res);
  return res;
}
async function run(){
  try{
    delete process.env.STAGE_ENABLE_SONOVAULT;
    let r=await recognize('disabled');
    assert.equal(r.code,503);
    assert.equal(r.body.code,'ACR_DISABLED','legacy public codes keep the UI untouched');
    assert.equal(calls,0);

    process.env.STAGE_ENABLE_SONOVAULT='1';
    delete process.env.SONOVAULT_API_KEY;
    r=await recognize('unconfigured');
    assert.equal(r.body.code,'ACR_CONFIG');
    process.env.SONOVAULT_API_KEY='test-api-key';

    r=await recognize('invalid',{stationId:'http://127.0.0.1'});
    assert.equal(r.code,400);assert.equal(r.body.code,'STATION_INVALID');
    sampleType='text/html';
    r=await recognize('bad-content');
    assert.equal(r.code,502);assert.equal(r.body.code,'STREAM_FORMAT');
    sampleType='audio/mpeg';
    sampleSize=120;
    r=await recognize('short');
    assert.equal(r.body.code,'STREAM_SHORT');
    sampleSize=120000;failCapture=true;
    r=await recognize('offline');
    assert.equal(r.body.code,'STREAM_UNAVAILABLE');
    failCapture=false;

    r=await recognize('success');
    assert.equal(r.code,200);
    assert.equal(r.body.status.code,0);
    assert.equal(r.body.metadata.music[0].artists[0].name,'Artist');
    assert.equal(r.body.metadata.music[0].title,'Song');
    assert.equal(calls,1);assert.equal(publishes,1);
    assert.ok(captured.every(url=>url===station.stream));
    assert.equal(requestHeader['x-api-key'],'test-api-key');

    reply={matched:false,results:[]};
    r=await recognize('no-match');
    assert.equal(r.body.status.code,1001);
    assert.equal(publishes,1,'no-match never becomes playlist song');

    reply={matched:true,results:[{title:'Song',artists:[{name:'Artist'}],confidence:0.12}]};
    r=await recognize('uncertain');
    assert.equal(r.code,502);
    assert.equal(r.body.code,'ACR_UPSTREAM',
      'malformed provider match is not mislabeled as a genuine no-match');

    reply={matched:true,results:[
      {title:'Incomplete',artists:[]},
      {title:'Second Ranked Song',artists:[{name:'Second Artist'}],confidence:0.91}
    ]};
    r=await recognize('ranked-fallback');
    assert.equal(r.code,200);
    assert.equal(r.body.metadata.music[0].title,'Second Ranked Song');
    assert.equal(publishes,2,'usable ranked match must still be published');

    reply={matched:true,results:[{id:123,title:'No artist',artists:[]}]};
    r=await recognize('malformed-result');
    assert.equal(r.code,502);
    assert.equal(r.body.code,'ACR_UPSTREAM');
    reply='Not JSON';
    r=await recognize('invalid-provider-response');
    assert.equal(r.code,502);
    assert.equal(r.body.code,'ACR_UPSTREAM');

    errorStatus=403;
    r=await recognize('free-tier');
    assert.equal(r.code,502);
    assert.equal(r.body.code,'ACR_AUTH','free tier must not be reported as a song');
    errorStatus=429;
    r=await recognize('credit-limit');
    assert.equal(r.code,429);assert.equal(r.body.code,'ACR_QUOTA');
    assert.equal(r.headers['Retry-After'],'900');
    errorStatus=0;
    reply={matched:false,results:[]};
    await recognize('rate-limited');
    await recognize('rate-limited');
    await recognize('rate-limited');
    r=await recognize('rate-limited');
    assert.equal(r.code,429);
    assert.equal(r.body.code,'ACR_RATE_LIMIT');
    const before=calls;
    reply={matched:true,results:[{title:'New song',artists:[{name:'New artist'}],confidence:0.98}]};
    const both=await Promise.all([recognize('listener-a'),recognize('listener-b')]);
    assert.equal(both[0].code,200);
    assert.equal(both[1].code,200);
    assert.equal(calls,before+1,'concurrent listeners share one vendor request');
    assert.equal(publishes,3,'concurrent listeners share one playlist publication');
    assert.equal(recognizer.readyForSonoVault(),true);
    console.log('Manual SonoVault: approved stream, raw audio, legacy metadata compatibility, rate limits and in-flight dedup passed.');
  }finally{
    for(const [k,value] of Object.entries(prev))
      value===undefined?delete process.env[k]:process.env[k]=value;
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
