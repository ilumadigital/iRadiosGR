'use strict';
// Shared across clients AND backend instances: the short-lived current AI result
// is stored in MongoDB next to the station playlist (never audio samples).
const Playlist=require('../models/StationPlaylist');
const {parseTrack,recordStationTrack}=require('./recordStationTrack');
const {VALID_FOR,snapshotSong}=require('./stageNativeNow');

const results=new Map();
const FOUR_MINUTES=4*60*1000;
const FIVE_MINUTES=5*60*1000;

function validTrackFromAcr(payload){
  if(Number(payload?.status?.code)!==0)return null;
  const item=Array.isArray(payload?.metadata?.music)?payload.metadata.music[0]:null;
  const artist=item?.artists?.find(a=>typeof a?.name==='string' && a.name.trim())?.name?.trim();
  const title=typeof item?.title==='string'?item.title.trim():'';
  if(!artist||!title||artist.length>150||title.length>150)return null;
  const parsed=parseTrack(artist+' - '+title);
  return parsed ? {raw:parsed.raw,artist:parsed.artist,title:parsed.title}:null;
}
function getSharedAI(stationId,now=Date.now()){
  const key=String(stationId||'');
  const item=results.get(key);
  if(!item)return null;
  if(item.expiresAt<=now){results.delete(key);return null;}
  return item;
}
// Rehydrate on every authorized station read so another Node process or an app
// restart cannot hide a successful recognition. Expired entries are ignored.
async function hydrateSharedAI(stationId,now=Date.now()){
  const key=String(stationId||'');
  if(!key)return null;
  const doc=await Playlist.findOne({stationId}).select('currentAI').lean();
  const value=doc?.currentAI;
  const expiresAt=new Date(value?.expiresAt).getTime();
  if(!value||!Number.isFinite(expiresAt)||expiresAt<=now){
    results.delete(key);
    return null;
  }
  const recognizedAt=new Date(value.recognizedAt);
  const item={
    raw:value.raw,artist:value.artist,title:value.title,
    source:'acrcloud',foundWithAI:true,
    kind:value.kind==='manual'?'manual':'auto',
    recognizedAt:recognizedAt.toISOString(),expiresAt
  };
  results.set(key,item);
  return item;
}

async function publishAI(station,payload,kind='auto',now=Date.now()){
  const song=validTrackFromAcr(payload);
  if(!song||!station?._id)return null;
  const key=String(station._id);
  const previous=typeof Playlist.findOne==='function'
    ?await hydrateSharedAI(key,now):getSharedAI(key,now);
  if(kind==='auto' && previous?.kind==='manual')return previous;
  const item={
    ...song,source:'acrcloud',foundWithAI:true,
    kind:kind==='manual'?'manual':'auto',
    recognizedAt:new Date(now).toISOString(),
    expiresAt:now+(kind==='manual'?FOUR_MINUTES:FIVE_MINUTES)
  };
  // History MUST be saved before advertising the song as network-wide.
  await recordStationTrack(station,song.raw,{source:'acrcloud'});
  const filter={stationId:station._id};
  if(item.kind==='auto')filter.$or=[
    {'currentAI.kind':{$ne:'manual'}},
    {'currentAI.expiresAt':{$lte:new Date(now)}}
  ];
  const write=await Playlist.updateOne(filter,{$set:{currentAI:{
    raw:item.raw,artist:item.artist,title:item.title,kind:item.kind,
    recognizedAt:new Date(item.recognizedAt),expiresAt:new Date(item.expiresAt)
  }}});
  if(item.kind==='auto' && write?.matchedCount===0){
    return typeof Playlist.findOne==='function'?hydrateSharedAI(key,now):getSharedAI(key,now);
  }
  if(results.size>512){
    for(const [id,v] of results)if(v.expiresAt<=now)results.delete(id);
    if(results.size>512)results.clear();
  }
  results.set(key,item);
  return item;
}
function activeSharedAI(now=Date.now()){
  const items=[];
  for(const [stationId,item] of results){
    if(item.expiresAt<=now){results.delete(stationId);continue;}
    if(items.length>=512)break;
    items.push({stationId,title:item.raw,source:'acrcloud',foundWithAI:true,
      recognizedAt:item.recognizedAt,expiresAt:new Date(item.expiresAt).toISOString()});
  }
  return items.sort((a,b)=>b.recognizedAt.localeCompare(a.recognizedAt));
}
async function stageLiveAI(req,res){
  res.setHeader('Cache-Control','private, no-store');
  try{
    // A single database query serves ALL cached native songs + active AI
    // recognitions. No browser scans 36 radio streams or metadata endpoints.
    const now=Date.now();
    const docs=await Playlist.find({$or:[
      {'currentAI.expiresAt':{$gt:new Date(now)}},
      {'nativeNow.confirmedAt':{$gt:new Date(now-VALID_FOR)}}
    ]}).select('stationId nativeNow currentAI').limit(2000).lean();
    const tracks=docs.map(doc=>{
      const item=snapshotSong(doc,now);
      if(!item)return null;
      return {stationId:String(doc.stationId),...item};
    }).filter(Boolean).sort((a,b)=>String(b.recognizedAt||b.changedAt||'')
      .localeCompare(String(a.recognizedAt||a.changedAt||'')));
    return res.json({tracks});
  }catch{
    return res.status(503).json({tracks:[],error:'Now Playing temporarily unavailable'});
  }
}
function clearAutomaticAI(stationId){
  const key=String(stationId||'');
  if(results.get(key)?.kind==='auto')results.delete(key);
  // Do not delete a newer manual recognition. This is also called when valid
  // native metadata comes back and should take precedence over automatic AI.
  if(typeof Playlist.updateOne==='function'){
    return Playlist.updateOne({stationId,'currentAI.kind':'auto'},
      {$unset:{currentAI:''}}).catch(error=>{
        console.warn('[AUTO_ACR] stale_auto_clear_failed',error?.name||'database');
      });
  }
}
function statusFromNative(raw,stationName=''){
  const value=typeof raw==='string'?raw.trim():'';
  if(!value)return 'missing';
  return parseTrack(value,stationName)?'valid':'invalid';
}
function resolvedNowPlaying(raw,station,now=Date.now()){
  const status=statusFromNative(raw,station?.name);
  const ai=getSharedAI(station?._id,now);
  if(status==='valid' && ai?.kind!=='manual'){
    if(ai?.kind==='auto')void clearAutomaticAI(station?._id);
    return {title:raw,source:'station',foundWithAI:false};
  }
  if(ai){
    return {title:ai.raw,source:'acrcloud',foundWithAI:true,
      recognizedAt:ai.recognizedAt,expiresAt:new Date(ai.expiresAt).toISOString()};
  }
  return {title:status==='valid'?raw:'',source:status==='valid'?'station':'none',foundWithAI:false};
}
module.exports={FOUR_MINUTES,FIVE_MINUTES,validTrackFromAcr,getSharedAI,hydrateSharedAI,publishAI,
  clearAutomaticAI,statusFromNative,resolvedNowPlaying,activeSharedAI,stageLiveAI};
