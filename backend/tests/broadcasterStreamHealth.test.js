'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {checkBroadcasterStream}=require('../services/broadcasterStreamHealth');

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
