'use strict';
// One stage backend worker, independent of browsers and without Socket.IO.
// Auto ACRCloud is opt-in: Top-10 music radios plus actually listened approved music radios.
const mongoose=require('mongoose');
const Station=require('../models/Station');
const Budget=require('../models/StageAcrDailyBudget');
const {readCachedNativeMetadata}=require('./stageMetadata');
const {statusFromNative,hydrateSharedAI,clearAutomaticAI,publishAI,FIVE_MINUTES}=require('./stageSmartTracks');
const {recognizeApprovedStation,readyForAcr}=require('./stageAcrcloud');

const listeners=new Map(); // session UUID -> station ID and expiry, no user data or IP addresses.
const lastAutomatic=new Map();
const lastNativeProbe=new Map(); // one upstream metadata check per Top-10 station per five minutes
const lastBeat=new Map();
const LISTEN_TTL=155000;
const TICK_MS=30000;
const MAX_LISTENED_PER_TICK=20; // bound queries/vendor exposure beyond the Top 10
let nextTopRefresh=0,top=[],inTick=false,listenedCursor=0;
const excludeGenre=/(?:news|talk|speech|sport|ειδησ|ενημ[εέ]ρ|αθλητ|πολιτικ|θρησκ|ομιλ|οικονομικ|ενημερωτικ|δημοσιογραφ)/i;
const excludeName=/(?:\bnews\b|\bsport(?:s)?\b|ειδησ|ενημερωτικ|αθλητικ)/i;
function isMusicStation(station){
  return Boolean(station?.stream && station._id) &&
    !excludeGenre.test(String(station.genre||'')) &&
    !excludeName.test(String(station.name||''));
}
function currentTop(){return top;}
function cleanupListeners(now=Date.now()){
  for(const [id,entry] of listeners)if(entry.until<=now)listeners.delete(id);
  if(listeners.size>4096)listeners.clear();
  if(lastBeat.size>4096)lastBeat.clear();
}
function listenerPresent(stationId,now=Date.now()){
  cleanupListeners(now);
  return [...listeners.values()].some(item=>item.stationId===String(stationId)&&item.until>now);
}
function heartbeat(req,res){
  const {stationId,sessionId,playing}=req.body||{};
  if(typeof stationId!=='string'||!/^[a-f0-9]{24}$/i.test(stationId)||
     typeof sessionId!=='string'||!/^[a-f0-9-]{36}$/i.test(sessionId)||
     typeof playing!=='boolean'){
    return res.status(400).json({error:'Μη έγκυρα στοιχεία ακρόασης.'});
  }
  const now=Date.now();
  cleanupListeners(now);
  if(playing===false){listeners.delete(sessionId);return res.status(204).end();}
  // Public playback is free. Any station can report a heartbeat. The scheduled
  // worker rechecks approval and music genre BEFORE any billable recognition.
  // A heartbeat by itself never triggers an external request.
  const previous=lastBeat.get(sessionId)||0;
  if(previous && now-previous<20000)return res.status(204).end();
  lastBeat.set(sessionId,now);
  listeners.set(sessionId,{stationId,until:now+LISTEN_TTL});
  return res.status(204).end();
}
async function refreshTop(now=Date.now()){
  if(now<nextTopRefresh)return top;
  nextTopRefresh=now+5*60*1000;
  try{
    const candidates=await Station.find({status:'approved'})
      .select('_id name genre stream metadata plays status').sort({plays:-1,_id:1}).limit(500).lean();
    top=candidates.filter(isMusicStation).slice(0,10);
  }catch(error){console.warn('[AUTO_ACR] top_station_query_failed',error?.name||'query');}
  return top;
}
async function reserveDailyBudget(now=Date.now()){
  const configured=Number(process.env.STAGE_AUTO_ACR_DAILY_LIMIT);
  // Hard billing ceiling: 2,880 calls/day regardless of the number of eligible radios.
  const limit=Number.isInteger(configured)&&configured>=0?Math.min(configured,2880):2880;
  if(limit===0)return false;
  const day=new Date(now).toISOString().slice(0,10);
  const id='stage-auto-acr:'+day;
  const expiry=new Date(Date.parse(day+'T00:00:00.000Z')+4*24*60*60*1000);
  await Budget.updateOne({_id:id},{$setOnInsert:{used:0,expiresAt:expiry}},{upsert:true});
  const reserved=await Budget.findOneAndUpdate({_id:id,used:{$lt:limit}},{$inc:{used:1}},{new:true}).lean();
  return Boolean(reserved);
}
async function inspectAndMaybeIdentify(station,now=Date.now()){
  const id=String(station._id);
  if(lastAutomatic.get(id)>now)return;
  let probe=lastNativeProbe.get(id);
  if(!probe || probe.until<=now){
    const native=await readCachedNativeMetadata(station);
    probe={title:native,until:Date.now()+FIVE_MINUTES};
    if(lastNativeProbe.size>100)lastNativeProbe.clear();
    lastNativeProbe.set(id,probe);
  }
  const status=statusFromNative(probe.title,station.name);
  const shared=await hydrateSharedAI(station._id);
  if(status==='valid'){
    await clearAutomaticAI(station._id);
    return;
  }
  if(status==='missing'&&!listenerPresent(station._id,Date.now()))return;
  if(shared?.kind==='manual')return;

  // Each station's clock starts BEFORE capture; even failures cannot spin.
  lastAutomatic.set(id,Date.now()+FIVE_MINUTES);
  try{
    const result=await recognizeApprovedStation(station,{beforeVendorCall:reserveDailyBudget});
    if(Number(result?.status?.code)===0){
      const published=await publishAI(station,result,'auto');
      if(published)console.info('[AUTO_ACR] recognized',id);
    }else{
      await clearAutomaticAI(id);
      console.info('[AUTO_ACR] no_song',id);
    }
  }catch(error){
    console.warn('[AUTO_ACR] attempt_skipped',id,
      ['ACR_DISABLED','ACR_CONFIG','ACR_QUOTA','ACR_RATE_LIMIT','STREAM_SHORT',
        'STREAM_UNAVAILABLE','STREAM_FORMAT','ACR_AUTH'].includes(error?.code)?error.code:'service_error');
  }
}
async function tick(){
  if(inTick||process.env.APP_ENV!=='staging'||
     process.env.STAGE_ENABLE_AUTO_ACRCLOUD!=='1'||!readyForAcr()||
     mongoose.connection.readyState!==1)return;
  inTick=true;
  try{
    await refreshTop();
    cleanupListeners();
    // Listened non-Top-10 music stations also qualify, even with no/invalid
    // metadata. Top-10 music stations stay first and retain their no-listener
    // invalid-metadata exception. Rotate the bounded remainder for fairness.
    const topIds=new Set(top.map(s=>String(s._id)));
    const activeIds=[...new Set([...listeners.values()]
      .filter(item=>item.until>Date.now()).map(item=>item.stationId))]
      .filter(id=>!topIds.has(id)).sort();
    let chosen=[];
    if(activeIds.length){
      const start=listenedCursor%activeIds.length;
      chosen=Array.from({length:Math.min(MAX_LISTENED_PER_TICK,activeIds.length)},
        (_,i)=>activeIds[(start+i)%activeIds.length]);
      listenedCursor=(start+chosen.length)%activeIds.length;
    }
    const extra=chosen.length?await Station.find({
      _id:{$in:chosen},status:'approved'
    }).select('_id name genre stream metadata plays status').lean():[];
    const worklist=[...top,...extra.filter(isMusicStation)];
    // Concurrency=2, at most 10 Top-10 + 20 actually listened stations.
    let index=0;
    const worker=async()=>{
      while(index<worklist.length){
        const station=worklist[index++];
        await inspectAndMaybeIdentify(station);
      }
    };
    await Promise.all([worker(),worker()]);
  }catch(error){console.warn('[AUTO_ACR] scheduler_failed',error?.name||'worker');}
  finally{inTick=false;}
}
function start(){
  if(process.env.APP_ENV!=='staging')return;
  const timer=setInterval(()=>void tick(),TICK_MS);
  timer.unref?.();
  // Initial delay lets the database and app finish starting.
  const initial=setTimeout(()=>void tick(),30000);
  initial.unref?.();
}
module.exports={start,tick,heartbeat,isMusicStation,listenerPresent,
  reserveDailyBudget,refreshTop,inspectAndMaybeIdentify,currentTop};
