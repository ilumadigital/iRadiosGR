'use strict';
// Stage-only, free 2-minute metadata prefetch. Never invokes the paid ACRCloud
// vendor and never requires a listener to be present.
// Bounded round-robin batches prevent a large catalog from exhausting egress.
const mongoose=require('mongoose');
const Station=require('../models/Station');
const {readCachedNativeMetadata}=require('./stageMetadata');

const EVERY_MS=2*60*1000;
const PER_PASS=160;
const CONCURRENCY=20;
let lastId=null,inTick=false;

async function nextBatch(){
  const filter={status:'approved',stream:{$type:'string',$ne:''}};
  const read=cursor=>Station.find(cursor?{...filter,_id:{$gt:cursor}}:filter)
    .select('_id name stream metadata status').sort({_id:1}).limit(PER_PASS).lean();
  let items=await read(lastId);
  if(!items.length&&lastId){
    lastId=null;
    items=await read(null);
  }
  if(items.length)lastId=items[items.length-1]._id;
  return items;
}
async function tick(){
  if(inTick||process.env.APP_ENV!=='staging'||
    process.env.STAGE_ENABLE_NATIVE_SCANNER==='0'||
    mongoose.connection.readyState!==1)return {scanned:0,skipped:true};
  inTick=true;
  let scanned=0,failed=0;
  try{
    const batch=await nextBatch();
    let idx=0;
    const run=async()=>{
      while(idx<batch.length){
        const station=batch[idx++];
        try{
          // Persists only verified native songs. Identical song: internal
          // confirmedAt refresh, no extra playlist entry or song-changed event.
          await readCachedNativeMetadata(station);
          scanned++;
        }catch{failed++;}
      }
    };
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,batch.length)},()=>run()));
    // One privacy-safe operational line every two minutes, no stream URLs.
    console.info('[NATIVE_SCAN] scanned',scanned,'failed',failed,'of',batch.length);
    return {scanned,failed,total:batch.length,rotationCursor:String(lastId||'')};
  }catch(error){
    console.warn('[NATIVE_SCAN] scan_failed',error?.name||'database');
    return {scanned,failed:failed+1};
  }finally{inTick=false;}
}
function start(){
  if(process.env.APP_ENV!=='staging'||process.env.STAGE_ENABLE_NATIVE_SCANNER==='0')return;
  const timer=setInterval(()=>void tick(),EVERY_MS);
  timer.unref?.();
  const initial=setTimeout(()=>void tick(),10000);
  initial.unref?.();
}
module.exports={EVERY_MS,PER_PASS,CONCURRENCY,start,tick,nextBatch};
