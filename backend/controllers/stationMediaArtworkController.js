'use strict';
// Generate a real, opaque JPEG for OS-level Now Playing artwork. CSS backgrounds
// cannot affect iOS / Android lock screens or CarPlay's Media Session image.
const fs = require('node:fs/promises');
const path = require('node:path');
const {createCanvas,loadImage} = require('canvas');
const Station = require('../models/Station');
const {readPublicUrl} = require('../utils/stageSafeRadioFetch');
const {imageContentType} = require('../services/widgetShowImage');

const SIZE=512, PADDING=24, MAX_BYTES=2*1024*1024;
const CACHE_MS=20*60*1000, MAX_CACHED=100, MAX_PENDING=8;
const cache=new Map(), inFlight=new Map();
let pending=0;

async function localLogoBytes(raw) {
  // Only resolve our own station logo directory. Never accept a user-supplied
  // pathname or read other private files from the server.
  let url;
  try { url=new URL(raw,'https://stage.iradios.gr'); }
  catch { return null; }
  if (!['stage.iradios.gr','play.iradios.gr'].includes(url.hostname.toLowerCase()) ||
      !['https:','http:'].includes(url.protocol) || url.username || url.password ||
      !url.pathname.startsWith('/media/radioassets/')) return null;

  const relative=url.pathname.slice('/media/radioassets/'.length);
  let decoded;
  try { decoded=decodeURIComponent(relative); }
  catch { return null; }
  if(!decoded || decoded.includes('\\') || decoded.split('/').some(x=>!x||x==='.'||x==='..'))return null;
  const root=path.resolve(process.cwd(),'uploads','radioassets');
  const filename=path.resolve(root,decoded);
  if(!filename.startsWith(root+path.sep))return null;
  try {
    const actual=await fs.realpath(filename);
    if(!actual.startsWith(root+path.sep))return null;
    const stat=await fs.stat(actual);
    if(!stat.isFile() || stat.size<16 || stat.size>=MAX_BYTES)return null;
    return fs.readFile(actual);
  }catch{return null;}
}

async function readLogo(raw){
  if(typeof raw!=='string' || !raw.trim() || raw.length>1200)return null;
  const local=await localLogoBytes(raw.trim());
  if(local)return imageContentType(local)?local:null;
  // Historical station logos may live on other public hosts. Use the existing
  // DNS-pinned public-only fetcher: no SSRF to localhost/private network.
  let remoteUrl;
  try {remoteUrl=new URL(raw,'https://stage.iradios.gr');}
  catch{return null;}
  if(!['https:','http:'].includes(remoteUrl.protocol)||
      remoteUrl.username||remoteUrl.password||!remoteUrl.hostname)return null;
  try {
    const result=await readPublicUrl(remoteUrl.toString(),{
      maxBytes:MAX_BYTES,timeoutMs:6500,redirects:2,allowPartialOnDeadline:true,
      headers:{Accept:'image/png,image/jpeg,image/webp,image/gif',
        'Accept-Encoding':'identity','User-Agent':'Mozilla/5.0 (compatible; iRadiosGR MediaArtwork/1.0)'}
    });
    return imageContentType(result.buffer)?result.buffer:null;
  }catch{return null;}
}

async function renderStationLogo(station){
  const canvas=createCanvas(SIZE,SIZE);
  const context=canvas.getContext('2d');
  context.fillStyle='#ffffff';
  context.fillRect(0,0,SIZE,SIZE);
  try {
    const bytes=await readLogo(station.logo);
    if(!bytes)throw new Error('Logo unavailable');
    const image=await loadImage(bytes);
    if(!(image.width>0 && image.height>0))throw new Error('Invalid logo dimensions');
    const ratio=Math.min((SIZE-PADDING*2)/image.width,(SIZE-PADDING*2)/image.height);
    const width=image.width*ratio,height=image.height*ratio;
    context.drawImage(image,(SIZE-width)/2,(SIZE-height)/2,width,height);
  }catch{
    // An unavailable/broken upstream logo must not make the Media Session
    // artwork URL fail: still return a useful opaque white station identity.
    context.fillStyle='#25252c';
    context.textAlign='center';
    context.textBaseline='middle';
    context.font='bold 32px sans-serif';
    const name=String(station.name||'iRadios').slice(0,36);
    const lines=name.length>20?[name.slice(0,20),name.slice(20)]:[name];
    lines.forEach((line,index)=>context.fillText(line,SIZE/2,SIZE/2+(index-(lines.length-1)/2)*42,SIZE-48));
  }
  return canvas.toBuffer('image/jpeg',{quality:0.92,progressive:false,chromaSubsampling:false});
}

exports.stationMediaArtwork=async (req,res)=>{
  const id=String(req.params.stationId||'');
  if(!/^[a-f0-9]{24}$/i.test(id))return res.status(400).end();
  res.setHeader('X-Content-Type-Options','nosniff');
  try{
    const station=await Station.findOne({_id:id,status:'approved'}).select('name logo').lean();
    if(!station)return res.status(404).end();
    const key=id+'|'+String(station.logo||'');
    const now=Date.now(),hit=cache.get(key);
    let buffer;
    if(hit&&hit.expires>now)buffer=hit.buffer;
    else if(inFlight.has(key))buffer=await inFlight.get(key);
    else{
      if(pending>=MAX_PENDING)return res.status(503).end();
      pending++;
      const task=renderStationLogo(station);
      inFlight.set(key,task);
      try{
        buffer=await task;
        if(cache.size>=MAX_CACHED)cache.delete(cache.keys().next().value);
        cache.set(key,{buffer,expires:Date.now()+CACHE_MS});
      }finally{pending--;inFlight.delete(key);}
    }
    res.setHeader('Content-Type','image/jpeg');
    res.setHeader('Cache-Control','public, max-age=900');
    return res.send(buffer);
  }catch(error){
    console.warn('[MEDIA ARTWORK] Unable to render station logo:',error.message);
    return res.status(503).end();
  }
};
