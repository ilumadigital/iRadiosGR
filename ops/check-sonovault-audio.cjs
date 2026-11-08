'use strict';
// Zero-network test for safe, 45s server-side SonoVault capture/downsampling.
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Module=require('node:module');
const original=Module._load;
let calls=0,ffmpegCalls=0,mime='audio/mpeg',failure=false,encoderFailure=false;
const source=Buffer.alloc(1900000,65);
Module._load=function(name,parent,isMain){
  if(String(parent?.filename||'').endsWith('stageSonovaultAudio.js')){
    if(name==='./stageSafeRadioFetch')return {readPublicUrl:async(url,options)=>{
      calls++;
      assert.equal(url,'https://stream.example.com/live.mp3');
      assert.equal(options.maxBytes,4*1024*1024,'more source audio, no bill for capture');
      assert.equal(options.timeoutMs,45000);
      assert.equal(options.allowPartialOnDeadline,true);
      if(failure)throw new Error('radio refused connection');
      return {buffer:source,headers:{'content-type':mime}};
    }};
    if(name==='node:child_process')return {spawn:(exe,args,options)=>{
      ffmpegCalls++;
      assert.equal(exe,'ffmpeg');
      assert.ok(args.includes('16000'),'SonoVault safe sample rate');
      assert.ok(args.includes('libmp3lame'),'output must be decoded MP3');
      assert.ok(args.includes('64k'),'bounded file size');
      assert.ok(args.includes('pipe:1'),'audio must stay in memory');
      assert.deepEqual(options.stdio,['pipe','pipe','ignore']);
      const child=new EventEmitter();
      child.stdout=new EventEmitter();
      child.stdin=new EventEmitter();
      child.stdin.end=(input)=>{
        assert.equal(input.length,source.length);
        queueMicrotask(()=>{
          if(encoderFailure)return child.emit('close',1);
          child.stdout.emit('data',Buffer.alloc(350000,65));
          child.emit('close',0);
        });
      };
      child.kill=()=>{};
      return child;
    }};
  }
  return original.call(this,name,parent,isMain);
};
const audio=require('../backend/utils/stageSonovaultAudio');
Module._load=original;
const station={stream:'https://stream.example.com/live.mp3'};
async function main(){
  const payload=await audio.captureAudio(station);
  assert.ok(Buffer.isBuffer(payload));
  assert.equal(payload.length,350000,'file should fit under one billed MB');
  assert.equal(calls,1);assert.equal(ffmpegCalls,1);
  mime='application/vnd.apple.mpegurl';
  await assert.rejects(audio.captureAudio(station),e=>e.code==='STREAM_FORMAT');
  assert.equal(ffmpegCalls,1,'never transcode playlists');
  mime='audio/mpeg';failure=true;
  await assert.rejects(audio.captureAudio(station),e=>e.code==='STREAM_UNAVAILABLE');
  failure=false;encoderFailure=true;
  await assert.rejects(audio.captureAudio(station),e=>e.code==='STREAM_FORMAT');
  assert.equal(ffmpegCalls,2);
  console.log('SonoVault 45s safe radio sample -> mono 16k MP3 within one MB, no filesystem, no billing passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
