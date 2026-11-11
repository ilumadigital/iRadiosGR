'use strict';
// Bounded diagnostics, not a streaming proxy. All destinations (including
// redirects) use the existing public-IP + DNS-pinned radio fetcher.
const {parseRadioUrl}=require('../utils/stageStreamProxy');
const {readPublicUrl}=require('../utils/stageSafeRadioFetch');
function safeTitle(text){
 return typeof text==='string'?text.replace(/[\x00-\x1f\x7f]/g,' ').replace(/<[^>]*>/g,' ').trim().slice(0,250):'';
}
function titleFromObject(value,mount=''){
 if(!value)return '';
 if(Array.isArray(value)){
  for(const part of value){const t=titleFromObject(part,mount);if(t)return t;}
  return '';
 }
 if(typeof value==='string')return safeTitle(value);
 if(typeof value!=='object')return '';
 if(value.icestats?.source){
  const sources=Array.isArray(value.icestats.source)?value.icestats.source:[value.icestats.source];
  const item=sources.find(s=>String(s.listenurl||'').includes(mount)&&mount)||sources[0];
  const title=safeTitle(item?.title||'');if(title)return title;
 }
 if(value.data?.length){
  const title=titleFromObject(value.data[0]?.rawmeta||value.data[0]?.track||value.data[0]?.song,mount);
  if(title)return title;
 }
 const artist=safeTitle(value.artist?.name||value.artist||'');
 const song=safeTitle(value.song?.title||value.song||value.track?.title||
  value.track||value.songtitle||value.title||value.StreamTitle||'');
 if(artist&&song&&!song.toLowerCase().startsWith(artist.toLowerCase()+' - '))
  return safeTitle(artist+' - '+song);
 if(song||artist)return song||artist;
 if(value.now_playing)return titleFromObject(value.now_playing,mount);
 return '';
}
function titleFromText(text,mount=''){
 const raw=String(text||'').trim().slice(0,65536);
 if(!raw)return '';
 try{return titleFromObject(JSON.parse(raw),mount);}
 catch{
  const jsonp=raw.match(/^\s*[\w]+\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/);
  if(jsonp){try{return titleFromObject(JSON.parse(jsonp[1]),mount);}catch{}}
  const xml=raw.match(/<(?:title|song|songtitle|currentSong|StreamTitle)>\s*([^<]{1,250})\s*<\//i);
  if(xml)return safeTitle(xml[1]);
  if(raw.startsWith('<'))return '';
  return safeTitle(raw);
 }
}
function icyTitle(buffer,headers){
 const n=Number(headers?.['icy-metaint']||0);
 if(!Number.isSafeInteger(n)||n<1||n>=buffer.length)return '';
 const length=buffer[n]*16;
 if(!length||n+1+length>buffer.length)return '';
 const meta=buffer.subarray(n+1,n+1+length).toString('utf8');
 return safeTitle(meta.match(/StreamTitle=['"]([^'"]*)['"]/i)?.[1]||'');
}
function codecFromHeaders(headers){
 const type=String(headers['content-type']||'').split(';')[0].trim().toLowerCase();
 if(type==='audio/mpeg'||type==='audio/mp3')return 'MP3';
 if(type==='audio/aac'||type==='audio/aacp'||type==='audio/x-aac')return 'AAC';
 if(type==='audio/ogg'||type==='application/ogg')return 'Ogg';
 if(type==='audio/flac'||type==='audio/x-flac')return 'FLAC';
 if(type==='audio/wav'||type==='audio/x-wav')return 'WAV';
 if(type==='application/vnd.apple.mpegurl'||type==='application/x-mpegurl')return 'HLS/playlist';
 return null;
}
function bitrateFromHeaders(headers){
 const explicit=Number.parseInt(String(headers['icy-br']||''),10);
 if(Number.isSafeInteger(explicit)&&explicit>0&&explicit<100000)return explicit;
 const match=String(headers['ice-audio-info']||'').match(/(?:^|;)\s*bitrate=(\d+)/i);
 if(!match)return null;
 const bit=Number(match[1]);return bit>0&&bit<100000?bit:null;
}
function reason(error){
 const msg=String(error?.message||'');
 if(/^(?:Invalid|Unsupported|Private|Non-public|Disallowed|IPv6|No public)/.test(msg))
  return {code:'UNSAFE_OR_INVALID_URL',message:'Η διεύθυνση δεν επιτρέπεται για ασφαλή έλεγχο.'};
 const status=msg.match(/Upstream HTTP (\d{3})/);
 if(status)return {code:'UPSTREAM_HTTP_'+status[1],httpStatus:Number(status[1]),message:'Ο server απάντησε HTTP '+status[1]+'.'};
 if(/timeout|deadline/i.test(msg))return {code:'UPSTREAM_TIMEOUT',message:'Ο server δεν απάντησε εγκαίρως.'};
 return {code:'UPSTREAM_UNAVAILABLE',message:'Δεν ήταν δυνατή η σύνδεση στον upstream server.'};
}
async function diagnose({stream,metadata}={},fetcher=readPublicUrl){
 if(typeof stream!=='string'||stream.length>1200||
   (metadata!==undefined&&(typeof metadata!=='string'||metadata.length>1200)))
  throw Object.assign(new Error('Μη έγκυρα URLs.'),{status:400});
 // Parse both URLs first: no network traffic for a known forbidden target.
 let mount='';
 try{
  const url=parseRadioUrl(stream);
  mount=url.pathname.replace(/\/$/,'');
  if(metadata)parseRadioUrl(metadata);
 }catch(error){throw Object.assign(new Error('Μη επιτρεπτό stream ή metadata URL.'),{status:400});}
 const started=Date.now();
 const result={
  stream:{reachable:false,likelyPlayable:false,httpStatus:null,responseMs:null,
    contentType:null,codec:null,bitrateKbps:null,channels:null,
    metadataTitle:'',metadataHeaders:{},error:null},
  customMetadata:metadata?{configured:true,httpStatus:null,responseMs:null,title:'',preview:'',error:null}:{configured:false},
  effectiveMetadata:{source:'none',title:''}
 };
 try{
  const response=await fetcher(stream,{headers:{'Icy-MetaData':'1'},maxBytes:65536,
   timeoutMs:7000,allowPartialOnDeadline:true,redirects:2});
  const h=response.headers||{},info=result.stream;
  info.reachable=true;info.httpStatus=response.status;info.responseMs=Date.now()-started;
  info.contentType=String(h['content-type']||'').slice(0,120)||null;
  info.codec=codecFromHeaders(h);
  info.bitrateKbps=bitrateFromHeaders(h);
  info.channels=String(h['ice-audio-info']||'').match(/(?:^|;)\s*channels=(\d+)/i)?.[1]||null;
  info.metadataHeaders={
   name:String(h['icy-name']||'').slice(0,150),
   genre:String(h['icy-genre']||'').slice(0,120),
   description:String(h['icy-description']||'').slice(0,250),
   metaint:Number(h['icy-metaint']||0)||null
  };
  info.metadataTitle=icyTitle(response.buffer||Buffer.alloc(0),h);
  // A successful HTTP ping is NOT proof of playable audio.
  info.likelyPlayable=Boolean(info.codec&&
   info.codec!=='HLS/playlist'&&(response.buffer?.length||0)>0);
 }catch(error){
  result.stream.responseMs=Date.now()-started;
  const fail=reason(error);result.stream.error=fail;
  if(fail.httpStatus)result.stream.httpStatus=fail.httpStatus;
 }
 if(metadata){
  const began=Date.now();
  try{
   const response=await fetcher(metadata,{maxBytes:65536,timeoutMs:5000,redirects:2});
   const contentType=String(response.headers?.['content-type']||'').toLowerCase();
   const raw=(response.buffer||Buffer.alloc(0)).toString('utf8');
   const allowed=!contentType||/json|text|xml|javascript/.test(contentType);
   const title=allowed?titleFromText(raw,mount):'';
   result.customMetadata={configured:true,httpStatus:response.status,
    responseMs:Date.now()-began,title,preview:allowed?safeTitle(raw).slice(0,450):'',
    error:allowed?null:{code:'UNSUPPORTED_METADATA_TYPE',
     message:'Το metadata URL δεν επέστρεψε κείμενο ή JSON.'}};
  }catch(error){
   const fail=reason(error);
   result.customMetadata={configured:true,httpStatus:fail.httpStatus||null,
    responseMs:Date.now()-began,title:'',preview:'',error:fail};
  }
 }
 if(result.customMetadata.title)
  result.effectiveMetadata={source:'custom',title:result.customMetadata.title};
 else if(result.stream.metadataTitle)
  result.effectiveMetadata={source:'stream-icy',title:result.stream.metadataTitle};
 return result;
}
module.exports={diagnose,titleFromText,icyTitle,codecFromHeaders,bitrateFromHeaders};
