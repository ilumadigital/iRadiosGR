'use strict';
// One small, bounded initial-audio probe rather than a multi-second download
// of 64 KiB: a 128 kbps station needs ~4 seconds to deliver that much audio,
// which would falsely mark a fast-connecting stream as slow.
const {readPublicUrl}=require('../utils/stageSafeRadioFetch');
const {codecFromHeaders,bitrateFromHeaders}=require('./streamDiagnostics');

async function checkBroadcasterStream(stream,fetcher=readPublicUrl){
 const started=Date.now();
 try{
  const reply=await fetcher(stream,{
   headers:{'Icy-MetaData':'0'},maxBytes:1024,timeoutMs:6000,redirects:2
  });
  const headers=reply.headers||{};
  const codec=codecFromHeaders(headers);
  return {
   reachable:true,httpStatus:reply.status||200,
   responseMs:Date.now()-started,
   bitrateKbps:bitrateFromHeaders(headers),
   contentType:String(headers['content-type']||'').slice(0,120)||null,
   codec,likelyPlayable:Boolean(codec&&codec!=='HLS/playlist'&&(reply.buffer?.length||0)>0)
  };
 }catch{
  // Fail closed with no raw upstream exception or server-local information.
  return {reachable:false,httpStatus:null,responseMs:Date.now()-started,
   bitrateKbps:null,contentType:null,codec:null,likelyPlayable:false};
 }
}
module.exports={checkBroadcasterStream};
