'use strict';
const assert = require('node:assert/strict');
const Module = require('node:module');

const fakeStation={_id:'0123456789abcdef01234567',status:'approved',stream:'https://radio.example.com/stream.mp3'};
let sampleType='audio/mpeg',sampleSize=120000,failSample=false,acrReply={status:{code:0,msg:'Success'},metadata:{music:[{artists:[{name:'Artist'}],title:'Song'}]}};
let outboundCalls=0,sampledUrls=[],outboundHost='';
class FakeFormData {
  constructor(){this.fields=new Map();}
  append(k,v,o){this.fields.set(k,{value:v,options:o});}
  getHeaders(){return {'content-type':'multipart/form-data; boundary=TEST'};}
}
const orig=Module._load;
Module._load=function(name,parent,isMain){
  const file=String(parent?.filename||'');
  if(file.endsWith('stageAcrcloud.js')){
    if(name==='../models/Station')return {findOne:query=>{
      assert.equal(query._id,fakeStation._id);
      assert.equal(query.status,'approved');
      return {select:()=>({lean:async()=>fakeStation})};
    }};
    if(name==='./stageSafeRadioFetch')return {readPublicUrl:async(raw,options)=>{
      sampledUrls.push(raw);
      assert.equal(raw,fakeStation.stream,'never capture caller-provided URLs');
      assert.equal(options.allowPartialOnDeadline,true);
      assert.ok(options.timeoutMs<=15000);
      if(failSample)throw new Error('Network failure');
      return {headers:{'content-type':sampleType},buffer:Buffer.alloc(sampleSize,0x41)};
    }};
    if(name==='axios')return {post:async(url,form)=>{
      outboundCalls++;outboundHost=url;
      assert.ok(url.endsWith('/v1/identify'));
      assert.equal(form.fields.get('sample_bytes').value,sampleSize);
      assert.equal(form.fields.get('data_type').value,'audio');
      assert.equal(form.fields.get('sample').options.contentType,'audio/mpeg');
      if(acrReply instanceof Error)throw acrReply;
      return {data:acrReply};
    }};
    if(name==='form-data')return FakeFormData;
    if(name==='./stageSmartTracks')return {publishAI:async(station,payload,kind)=>{
      assert.equal(station._id,fakeStation._id);
      assert.equal(kind,'manual');
      assert.equal(payload.status.code,0);
      return {foundWithAI:true};
    }};
  }
  return orig.call(this,name,parent,isMain);
};
const acr=require('../backend/utils/stageAcrcloud');
Module._load=orig;
const saved={};
for(const key of ['STAGE_ENABLE_ACRCLOUD','ACRCLOUD_HOST','ACRCLOUD_ACCESS_KEY','ACRCLOUD_ACCESS_SECRET']){
  saved[key]=process.env[key];
}
const response=()=>({
  code:200,body:null,headers:{},
  status(n){this.code=n;return this;},
  setHeader(k,v){this.headers[k]=v;return this;},
  json(body){this.body=body;return this;}
});
async function recognize(userId='tester',body={stationId:fakeStation._id,streamUrl:'http://127.0.0.1/secrets'}){
  const res=response();
  await acr.stageRecognizeProxy({body,user:{_id:userId}},res);
  return res;
}
(async()=>{
  try{
    delete process.env.STAGE_ENABLE_ACRCLOUD;
    let r=await recognize('disabled');
    assert.equal(r.code,503);assert.equal(r.body.code,'ACR_DISABLED');
    assert.equal(outboundCalls,0);

    process.env.STAGE_ENABLE_ACRCLOUD='1';
    delete process.env.ACRCLOUD_HOST;
    r=await recognize('no-config');
    assert.equal(r.code,503);assert.equal(r.body.code,'ACR_CONFIG');

    process.env.ACRCLOUD_HOST='identify-eu-west-1.acrcloud.com';
    process.env.ACRCLOUD_ACCESS_KEY='test-placeholder-key';
    process.env.ACRCLOUD_ACCESS_SECRET='test-placeholder-secret';
    r=await recognize('bad-station',{stationId:'http://127.0.0.1'});
    assert.equal(r.code,400);assert.equal(r.body.code,'STATION_INVALID');
    assert.equal(outboundCalls,0);

    sampleType='text/html';
    r=await recognize('bad-type');
    assert.equal(r.code,502);assert.equal(r.body.code,'STREAM_FORMAT');
    assert.equal(outboundCalls,0);

    sampleType='audio/mpeg';sampleSize=100;
    r=await recognize('short');
    assert.equal(r.code,502);assert.equal(r.body.code,'STREAM_SHORT');
    sampleSize=120000;

    failSample=true;
    r=await recognize('unreachable');
    assert.equal(r.code,502);assert.equal(r.body.code,'STREAM_UNAVAILABLE');
    failSample=false;

    r=await recognize('success');
    assert.equal(r.code,200);assert.equal(r.body.status.code,0);
    assert.equal(outboundHost,'https://identify-eu-west-1.acrcloud.com/v1/identify');
    assert.equal(outboundCalls,1);
    assert.ok(sampledUrls.every(url=>url===fakeStation.stream));

    acrReply={status:{code:1001,msg:'No result'},metadata:{}};
    r=await recognize('no-result');
    assert.equal(r.code,200);assert.equal(r.body.status.code,1001);

    acrReply={status:{code:3001,msg:'Wrong Access Key'}};
    r=await recognize('bad-key');
    assert.equal(r.code,502);assert.equal(r.body.code,'ACR_AUTH');

    acrReply={status:{code:3014,msg:'Invalid Signature'}};
    r=await recognize('bad-signature');
    assert.equal(r.code,502);assert.equal(r.body.code,'ACR_AUTH');

    acrReply={status:{code:3003,msg:'Limit exceeded'}};
    r=await recognize('quota');
    assert.equal(r.code,429);assert.equal(r.body.code,'ACR_QUOTA');
    assert.equal(r.headers['Retry-After'],'900');

    acrReply={status:{code:1001,msg:'No result'}};
    await recognize('rate-limit');await recognize('rate-limit');await recognize('rate-limit');
    r=await recognize('rate-limit');
    assert.equal(r.code,429);assert.equal(r.body.code,'ACR_RATE_LIMIT');

    assert.equal(acr.validAcrHost('identify-eu-west-1.acrcloud.com'),true);
    assert.equal(acr.validAcrHost('evil.acrcloud.com.attacker.org'),false);
    assert.equal(acr.acrFailure(3001),'ACR_AUTH');
    assert.equal(acr.acrFailure(3015),'ACR_QUOTA');

    const fs=require('node:fs'),path=require('node:path');
    const ui=fs.readFileSync(path.resolve(__dirname,'../frontend/src/App.jsx'),'utf8');
    assert.ok(ui.includes('ACR_DISABLED:')&&ui.includes('STREAM_UNAVAILABLE:'));
    assert.ok(ui.includes('Number(data?.status?.code)===0'));
    assert.ok(ui.includes('res.json().catch(() => null)'));
    assert.ok(ui.includes('body: JSON.stringify({stationId:'),'frontend sends approved station ID only');
    assert.ok(!ui.includes('streamUrl: currentStation.stream'),'do not send caller-supplied stream URL to recognizer');
    console.log('Staging ACRCloud diagnostics, user-safe errors, sample capture and rate limiter passed.');
  }finally{
    for(const [key,val] of Object.entries(saved)){
      if(val===undefined)delete process.env[key];
      else process.env[key]=val;
    }
  }
})().catch(e=>{console.error(e);process.exitCode=1});
