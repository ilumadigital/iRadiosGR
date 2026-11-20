'use strict';
// Manual SonoVault capture: make a longer, decodable radio sample without paying
// for multi-megabyte uploads. No audio is stored on disk or exposed to clients.
const {spawn}=require('node:child_process');
const {readPublicUrl}=require('./stageSafeRadioFetch');

const CAPTURE_MS=45000;
const CAPTURE_BYTES=4*1024*1024;
const MAX_UPLOAD_BYTES=1024*1024;
const MIN_SAMPLE_BYTES=16000;
const ENCODE_TIMEOUT_MS=15000;

function audioFailure(code){
  const error=new Error(code);
  error.code=code;
  return error;
}
function encodeCompactAudio(input){
  return new Promise((resolve,reject)=>{
    let child;
    try{
      // Mono 16 kHz is SonoVault's documented safe floor. Send actual decoded
      // MP3 audio, never a fingerprint or client-selected URL.
      child=spawn('ffmpeg',[
        '-hide_banner','-loglevel','error','-nostdin',
        '-i','pipe:0','-map','0:a:0','-vn',
        '-ac','1','-ar','16000','-threads','1',
        '-c:a','libmp3lame','-b:a','64k','-f','mp3','pipe:1'
      ],{stdio:['pipe','pipe','ignore']});
    }catch{return reject(audioFailure('STREAM_FORMAT'));}
    let done=false,total=0;
    const parts=[];
    const timer=setTimeout(()=>{
      child.kill('SIGKILL');
      finish(audioFailure('STREAM_FORMAT'));
    },ENCODE_TIMEOUT_MS);
    timer.unref?.();
    function finish(error,data){
      if(done)return;
      done=true;
      clearTimeout(timer);
      if(error)reject(error);
      else resolve(data);
    }
    child.once('error',()=>finish(audioFailure('STREAM_FORMAT')));
    child.stdout.on('data',chunk=>{
      if(done)return;
      total+=chunk.length;
      if(total>MAX_UPLOAD_BYTES){
        child.kill('SIGKILL');
        return finish(audioFailure('STREAM_FORMAT'));
      }
      parts.push(chunk);
    });
    // ffmpeg can close the input pipe on a malformed stream. Do not crash Node.
    child.stdin.on('error',()=>{});
    child.once('close',code=>{
      if(done)return;
      if(code!==0||total<MIN_SAMPLE_BYTES)
        return finish(audioFailure('STREAM_FORMAT'));
      finish(null,Buffer.concat(parts,total));
    });
    child.stdin.end(input);
  });
}
async function captureAudio(station){
  let sample;
  try{
    sample=await readPublicUrl(station.stream,{
      maxBytes:CAPTURE_BYTES,
      timeoutMs:CAPTURE_MS,
      allowPartialOnDeadline:true,
      headers:{'Icy-MetaData':'0','Accept':'audio/*,application/octet-stream'}
    });
  }catch(error){
    console.warn('[STAGE_SONOVAULT] capture_failed',
      /^[A-Z][A-Z0-9_]{2,50}$/.test(String(error?.code||''))?error.code:'UPSTREAM');
    throw audioFailure('STREAM_UNAVAILABLE');
  }
  const type=String(sample?.headers?.['content-type']||'audio/mpeg')
    .split(';')[0].trim().toLowerCase();
  if(/(?:mpegurl|m3u8|x-scpls|playlist)/.test(type)||
     (!type.startsWith('audio/') &&
      !['application/ogg','application/octet-stream'].includes(type)))
    throw audioFailure('STREAM_FORMAT');
  if(!Buffer.isBuffer(sample?.buffer)||sample.buffer.length<MIN_SAMPLE_BYTES)
    throw audioFailure('STREAM_SHORT');
  const encoded=await encodeCompactAudio(sample.buffer);
  console.info('[STAGE_SONOVAULT] audio_prepared',
    'capture_bytes',sample.buffer.length,'upload_bytes',encoded.length);
  return encoded;
}
module.exports={captureAudio,encodeCompactAudio,CAPTURE_MS,CAPTURE_BYTES,MAX_UPLOAD_BYTES};
