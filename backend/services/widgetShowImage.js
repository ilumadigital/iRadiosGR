'use strict';
const LIMIT_BYTES=3*1024*1024;

// An image fetched for a public widget MUST already belong to a scheduled
// broadcast on an approved station. Never proxy arbitrary browser-supplied URLs.
function approvedShowImage(schedule,requested){
  if(typeof requested!=='string'||!requested||requested.length>800||
    !Array.isArray(schedule))return null;
  const match=schedule.find(s=>s&&typeof s.imageUrl==='string'&&
    s.imageUrl.trim()===requested);
  if(!match)return null;
  try{
    const url=new URL(requested);
    const host=url.hostname.toLowerCase();
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||
       url.port&&!['80','443'].includes(url.port)||
       host==='localhost'||host.endsWith('.local')||host.endsWith('.internal')||
       /^(?:127|10|0|169\.254|192\.168)\./.test(host)||
       /^172\.(?:1[6-9]|2\d|3[01])\./.test(host))return null;
    return url.toString();
  }catch{return null;}
}
function imageContentType(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<16||buffer.length>=LIMIT_BYTES)return null;
  if(buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff&&
    buffer[buffer.length-2]===0xff&&buffer[buffer.length-1]===0xd9)
    return 'image/jpeg';
  if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&
    buffer.toString('ascii',buffer.length-8,buffer.length-4)==='IEND')
    return 'image/png';
  if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'&&
    buffer.readUInt32LE(4)+8===buffer.length)
    return 'image/webp';
  const head=buffer.toString('ascii',0,6);
  if((head==='GIF87a'||head==='GIF89a')&&buffer[buffer.length-1]===0x3b)
    return 'image/gif';
  return null; // HTML, SVG (scriptable), unsupported types and oversized data.
}
module.exports={LIMIT_BYTES,approvedShowImage,imageContentType};
