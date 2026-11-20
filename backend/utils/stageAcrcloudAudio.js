'use strict';
// Manual ACRCloud sampling only. Never store audio or accept a client stream URL.
const {spawn}=require('node:child_process');
const {readPublicUrl}=require('./stageSafeRadioFetch');

const CAPTURE_MS=18000;
const CAPTURE_BYTES=2*1024*1024;
const MAX_UPLOAD_BYTES=1024*1024;
const MIN_SAMPLE_BYTES=16000;

function audioFailure(code){
  const error=new Error(code);error.code=code;return error;
}
function encodeForAcrCloud(input){
  return new Promise((resolve,reject)=>{
    let child;
    try{
      child=spawn('ffmpeg',[
        '-hide_banner','-loglevel','error','-nostdin',
        '-i','pipe:0','-map','0:a:0','-vn','-t','15',
        '-ac','1','-ar','16000','-threads','1',
        '-c:a','libmp3lame','-b:a','48k','-f','mp3','pipe:1'
      ],{stdio:['pipe','pipe','ignore']});
    }catch{return reject(audioFailure('STREAM_FORMAT'));}
    let finished=false,total=0;
    const chunks=[];
    const finish=(error,value)=>{
      if(finished)return;
      finished=true;clearTimeout(timer);
      if(error)reject(error);else resolve(value);
    };
    const timer=setTimeout(()=>{
      child.kill('SIGKILL');
      finish(audioFailure('STREAM_FORMAT'));
    },15000);
    timer.unref?.();
    child.once('error',()=>finish(audioFailure('STREAM_FORMAT')));
    child.stdout.on('data',chunk=>{
      if(finished)return;
      total+=chunk.length;
      if(total>MAX_UPLOAD_BYTES){
        child.kill('SIGKILL');
        return finish(audioFailure('STREAM_FORMAT'));
      }
      chunks.push(chunk);
    });
    child.stdin.on('error',()=>{});
    child.once('close',code=>{
      if(finished)return;
      if(code!==0||total<MIN_SAMPLE_BYTES)
        return finish(audioFailure('STREAM_FORMAT'));
      finish(null,Buffer.concat(chunks,total));
    });
    child.stdin.end(input);
  });
}
async function captureAudio(station){
  let sample;
  try{
    sample=await readPublicUrl(station.stream,{
      maxBytes:CAPTURE_BYTES,timeoutMs:CAPTURE_MS,
      allowPartialOnDeadline:true,
      headers:{'Icy-MetaData':'0','Accept':'audio/*,application/octet-stream'}
    });
  }catch{
    throw audioFailure('STREAM_UNAVAILABLE');
  }
  const type=String(sample?.headers?.['content-type']||'audio/mpeg')
    .split(';')[0].trim().toLowerCase();
  if(/(?:mpegurl|m3u8|x-scpls|playlist)/.test(type)||
    (!type.startsWith('audio/')&&
      !['application/ogg','application/octet-stream'].includes(type)))
    throw audioFailure('STREAM_FORMAT');
  if(!Buffer.isBuffer(sample?.buffer)||sample.buffer.length<MIN_SAMPLE_BYTES)
    throw audioFailure('STREAM_SHORT');
  return encodeForAcrCloud(sample.buffer);
}

module.exports={captureAudio,encodeForAcrCloud,CAPTURE_MS,CAPTURE_BYTES,MAX_UPLOAD_BYTES};
