'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
// This is an offline unit test: use injected stream bytes and isolate the
// default network fetcher so its transitive MongoDB model is not loaded.
const Module=require('node:module');
const originalLoad=Module._load;
let checkBroadcasterStream;
try{
 Module._load=function(request,parent,isMain){
  const filename=parent?.filename||'';
  const health=filename.endsWith('/backend/services/broadcasterStreamHealth.js');
  const diagnostics=filename.endsWith('/backend/services/streamDiagnostics.js');
  if((health||diagnostics)&&request==='../utils/stageSafeRadioFetch')
   return {readPublicUrl:async()=>{throw Error('Network disabled in unit test');}};
  if(diagnostics&&request==='../utils/stageStreamProxy')
   return {parseRadioUrl:url=>new URL(url)};
  return originalLoad.call(this,request,parent,isMain);
 };
 ({checkBroadcasterStream}=require('../services/broadcasterStreamHealth'));
}finally{Module._load=originalLoad;}

test('uses safe bounded 1KiB startup probe, not 64KiB of continuous audio',async()=>{
 let options;
 const result=await checkBroadcasterStream('https://radio.example/live',async(url,opts)=>{
  assert.equal(url,'https://radio.example/live');
  options=opts;
  return {status:200,headers:{'content-type':'audio/mpeg','icy-br':'128'},
   buffer:Buffer.from([0xff,0xfb,0,0])};
 });
 assert.equal(options.maxBytes,1024);
 assert.equal(options.timeoutMs,6000);
 assert.equal(options.redirects,2);
 assert.equal(options.headers['Icy-MetaData'],'0');
 assert.equal(result.reachable,true);
 assert.equal(result.likelyPlayable,true);
 assert.equal(result.bitrateKbps,128);
 assert.ok(Number.isFinite(result.responseMs));
});

test('unreachable stream is shown offline without leaking upstream errors',async()=>{
 const result=await checkBroadcasterStream('https://radio.example/live',async()=>{
  throw new Error('internal upstream server credential must stay hidden');
 });
 assert.equal(result.reachable,false);
 assert.equal(result.likelyPlayable,false);
 assert.equal(result.httpStatus,null);
 assert.equal(JSON.stringify(result).includes('credential'),false);
});

test('playlist response is reachable without claiming verified audio playback',async()=>{
 const result=await checkBroadcasterStream('https://radio.example/hls',async()=>({
  status:200,headers:{'content-type':'application/vnd.apple.mpegurl'},
  buffer:Buffer.from('#EXTM3U\n')
 }));
 assert.equal(result.reachable,true);
 assert.equal(result.likelyPlayable,false);
 assert.equal(result.codec,'HLS/playlist');
});
