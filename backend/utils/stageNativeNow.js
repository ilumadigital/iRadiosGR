'use strict';
// Fast, durable Now Playing snapshot: safe to query while a listener opens a page.
// Only the background metadata reader touches upstream streams (never API GETs).
const Playlist=require('../models/StationPlaylist');
const {parseTrack}=require('./recordStationTrack');
const VALID_FOR=8*60*1000;
const normTime=value=>new Date(value).getTime();

function nativeSongFromSnapshot(doc,now=Date.now()){
  const item=doc?.nativeNow;
  const checked=normTime(item?.confirmedAt);
  if(!Number.isFinite(checked)||checked>now+30000||now-checked>VALID_FOR)return null;
  const parsed=parseTrack(item.raw);
  return parsed?{raw:parsed.raw,artist:parsed.artist,title:parsed.title,
    changedAt:item.changedAt,confirmedAt:item.confirmedAt}:null;
}

// On an unchanged song only the INTERNAL validation time moves forward.
// The public title, change time and playlist entry remain untouched.
async function rememberNativeSong(station,raw,now=Date.now()){
  const track=parseTrack(raw,station?.name);
  if(!track||!station?._id)return false;
  const at=new Date(now);
  await Playlist.updateOne({stationId:station._id},
    {$setOnInsert:{stationId:station._id}},{upsert:true});
  const changed=await Playlist.updateOne({
    stationId:station._id,
    'nativeNow.raw':{$ne:track.raw},
    $or:[{'nativeNow.confirmedAt':{$lte:at}},{'nativeNow.confirmedAt':{$exists:false}}]
  },{$set:{nativeNow:{raw:track.raw,artist:track.artist,title:track.title,
    changedAt:at,confirmedAt:at}}});
  if(changed.modifiedCount)return true;
  await Playlist.updateOne({
    stationId:station._id,'nativeNow.raw':track.raw,
    'nativeNow.confirmedAt':{$lte:at}
  },{$set:{'nativeNow.confirmedAt':at}});
  return false;
}
async function clearInvalidNativeSong(station,raw){
  // Missing/timeout is NOT evidence that a song stopped: stale snapshots
  // expire after 8 minutes if never reconfirmed. Explicit DJ/radio text is.
  if(!station?._id||!raw?.trim()||parseTrack(raw,station.name))return false;
  const result=await Playlist.updateOne({stationId:station._id,
    'nativeNow.raw':{$exists:true}},{$unset:{nativeNow:''}});
  return Boolean(result.modifiedCount);
}
function snapshotSong(doc,now=Date.now()){
  const native=nativeSongFromSnapshot(doc,now);
  const ai=doc?.currentAI;
  const aiExpiry=normTime(ai?.expiresAt);
  const aiTime=normTime(ai?.recognizedAt);
  const music=ai&&Number.isFinite(aiExpiry)&&aiExpiry>now&&
    Number.isFinite(aiTime)&&aiTime<=now+30000&&parseTrack(ai.raw)
    ?{title:ai.raw,source:'acrcloud',foundWithAI:true,
      recognizedAt:new Date(ai.recognizedAt).toISOString(),
      expiresAt:new Date(ai.expiresAt).toISOString()}:null;
  // Native metadata has priority when it was confirmed more recently than
  // automatic recognition. A short-lived manual AI result always wins.
  if(music&&(ai.kind==='manual'||!native||aiTime>normTime(native.confirmedAt)))
    return music;
  if(native)return {title:native.raw,source:'station',foundWithAI:false,
    changedAt:new Date(native.changedAt).toISOString()};
  return music;
}
module.exports={VALID_FOR,nativeSongFromSnapshot,rememberNativeSong,
  clearInvalidNativeSong,snapshotSong};
