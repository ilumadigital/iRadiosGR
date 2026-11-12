'use strict';
const Station=require('../models/Station');
const {readPublicUrl}=require('../utils/stageSafeRadioFetch');
const {LIMIT_BYTES,approvedShowImage,imageContentType}=require('../services/widgetShowImage');

const CACHE_TTL=3*60*1000;
const cache=new Map();
const inflight=new Map();
let pending=0;
const MAX_PARALLEL=6;

async function fetchProducerImage(url){
  const result=await readPublicUrl(url,{
    maxBytes:LIMIT_BYTES,
    timeoutMs:8500,
    redirects:2,
    allowPartialOnDeadline:true,
    headers:{
      Accept:'image/jpeg,image/png,image/webp,image/gif,image/*;q=0.8',
      'Accept-Encoding':'identity',
      'User-Agent':'Mozilla/5.0 (compatible; iRadiosGR Widget/1.0)'
    }
  });
  const mime=imageContentType(result?.buffer);
  if(!mime)throw new Error('Invalid show image');
  return {buffer:result.buffer,mime};
}

async function cachedImage(key,url){
  const hit=cache.get(key);
  if(hit&&hit.expires>Date.now())return hit.value;
  if(inflight.has(key))return inflight.get(key);
  if(pending>=MAX_PARALLEL)throw new Error('Image proxy busy');
  pending++;
  const fetching=fetchProducerImage(url).then(value=>{
    if(cache.size>=60)cache.delete(cache.keys().next().value);
    cache.set(key,{value,expires:Date.now()+CACHE_TTL});
    return value;
  }).finally(()=>{
    pending--;inflight.delete(key);
  });
  inflight.set(key,fetching);
  return fetching;
}

// Source is always taken from the approved station's schedule. The browser
// cannot turn this into an open URL proxy, even using crafted query strings.
exports.publicWidgetShowImage=async(req,res)=>{
  res.setHeader('Cache-Control','public, max-age=30');
  res.setHeader('X-Content-Type-Options','nosniff');
  const id=req.params.stationId;
  const candidate=req.query?.image;
  if(!/^[a-f0-9]{24}$/i.test(String(id))||typeof candidate!=='string'||
    candidate.length>800)return res.status(400).end();
  try{
    const station=await Station.findOne({_id:id,status:'approved'}).select('schedule').lean();
    if(!station)return res.status(404).end();
    const source=approvedShowImage(station.schedule,candidate);
    if(!source)return res.status(404).end();
    const {buffer,mime}=await cachedImage(String(id)+'|'+source,source);
    res.setHeader('Content-Type',mime);
    res.setHeader('Cache-Control','public, max-age=180');
    return res.send(buffer);
  }catch{
    // The frontend keeps station-logo fallback if upstream photo unavailable.
    return res.status(502).end();
  }
};
