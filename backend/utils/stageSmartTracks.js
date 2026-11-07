'use strict';
// One short-lived, station-scoped song result for all signed-in listeners.
// No audio or album images are written to disk.
const {parseTrack,recordStationTrack}=require('./recordStationTrack');

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
async function publishAI(station,payload,kind='auto',now=Date.now()){
  const song=validTrackFromAcr(payload);
  if(!song||!station?._id)return null;
  const key=String(station._id);
  const existing=getSharedAI(key,now);
  if(kind==='auto' && existing?.kind==='manual')return existing;
  const item={
    ...song,
    source:'acrcloud',
    foundWithAI:true,
    kind:kind==='manual'?'manual':'auto',
    recognizedAt:new Date(now).toISOString(),
    expiresAt:now+(kind==='manual'?FOUR_MINUTES:FIVE_MINUTES)
  };
  if(results.size>512){
    for(const [id,v] of results)if(v.expiresAt<=now)results.delete(id);
    if(results.size>512)results.clear();
  }
  results.set(key,item);
  await recordStationTrack(station,song.raw,{source:'acrcloud'});
  return item;
}
function clearAutomaticAI(stationId){
  const key=String(stationId||'');
  if(results.get(key)?.kind==='auto')results.delete(key);
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
    clearAutomaticAI(station?._id);
    return {title:raw,source:'station',foundWithAI:false};
  }
  if(ai){
    return {title:ai.raw,source:'acrcloud',foundWithAI:true,
      recognizedAt:ai.recognizedAt,expiresAt:new Date(ai.expiresAt).toISOString()};
  }
  return {title:status==='valid'?raw:'',source:status==='valid'?'station':'none',foundWithAI:false};
}
module.exports={FOUR_MINUTES,FIVE_MINUTES,validTrackFromAcr,getSharedAI,publishAI,
  clearAutomaticAI,statusFromNative,resolvedNowPlaying};
