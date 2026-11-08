'use strict';
const Playlist=require('../models/StationPlaylist');
const THIRTY_MINUTES=30*60*1000;
const MAX_HISTORY_TRACKS=120;
const noise=/^(?:live(?:\s+(?:now|show|radio))?|on\s*air|now\s*playing|playing\s*now|radio|station|web\s*radio|dj\s*set|unknown|news|talk|streaming|εκπομπή|ραδιόφωνο|δελτίο\s*ειδήσεων|ειδήσεις|μουσική|παίζει\s*τώρα|στον\s*αέρα|σύνδεση|διαφήμιση)$/i;
// Mixed-format streaming titles often look like "Artist - Title" despite
// being a programme, DJ set or show title. Never claim these are Spotify songs.
const broadcastNoise=/(?:\bdj\s*set\b|\bdjset\b|\blive\s*(?:show|session|set|broadcast|stream|radio|mix)\b|\bon\s*air\b|\bradio\s*show\b|\btalk\s*show\b|\bnon[-\s]?stop\s*(?:mix|music)\b|\bpodcast\b|\bplaylist\b|\b(?:mix|set)\s*(?:live|\d{1,2}[:.]\d{2})\b|δελτ[ιί]ο\s*ειδ[ήη]σεων|ραδιοφωνικ[ήη]\s*εκπομπ[ήη])/i;
const compact=s=>String(s||'').toLocaleLowerCase('el')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');
function parseTrack(raw,stationName=''){
  if(typeof raw!=='string'||raw.length>300)return null;
  const value=raw.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  if(!value||noise.test(value)||compact(value)===compact(stationName))return null;
  const match=value.match(/^(.{1,150}?)\s+[-–—]\s+(.{1,150})$/);
  if(!match)return null;
  const artist=match[1].trim(),title=match[2].trim();
  if(!artist||!title||noise.test(artist)||noise.test(title)||
    broadcastNoise.test(artist)||broadcastNoise.test(title))return null;
  if(/(?:radio\s?show|live\s?show|dj\s?set|morning\s?show|evening\s?show|podcast|εκπομπή|δελτίο\s+ειδήσεων)/i.test(title))return null;
  const compactStation=compact(stationName);
  if(compactStation.length>=5 &&
    (compact(artist)===compactStation||compact(title)===compactStation))return null;
  if(/^(?:\d{1,2}[.:]\d{1,2}|\d{2}\.\d{2})$/.test(artist)||
     /^(?:\d{1,2}[.:]\d{1,2}|\d{2}\.\d{2})$/.test(title))return null;
  return {raw:value,artist,title,playedAt:new Date()};
}

// Single MongoDB conditional update prevents simultaneous readers from writing
// duplicate consecutive songs. A repeat after 30 minutes is a new play.
async function recordStationTrack(station,raw,options={}){
  const track=parseTrack(raw,station?.name);
  if(!track||!station?._id)return false;
  track.source=options.source==='acrcloud'?'acrcloud':'station';
  const cutoff=new Date(track.playedAt.getTime()-THIRTY_MINUTES);
  try{
    await Playlist.updateOne({stationId:station._id},
      {$setOnInsert:{stationId:station._id}},{upsert:true});
    if(track.source==='acrcloud'){
      // Confirmed AI provenance must survive an existing identical native entry.
      await Playlist.updateOne({stationId:station._id,'tracks.0.raw':track.raw},
        {$set:{'tracks.0.source':'acrcloud'}});
    }
    const result=await Playlist.updateOne({
      stationId:station._id,
      $or:[{'tracks.0.raw':{$ne:track.raw}},{'tracks.0.playedAt':{$lt:cutoff}}]
    },{$push:{tracks:{$each:[track],$position:0,$slice:MAX_HISTORY_TRACKS}}});
    return Boolean(result.modifiedCount);
  }catch(error){
    console.warn('Station playlist write failed:',error.code||error.name);
    // Recognition must not report a network-wide published song unless
    // its history has been durably checked by MongoDB.
    throw error;
  }
}
module.exports={THIRTY_MINUTES,MAX_HISTORY_TRACKS,parseTrack,recordStationTrack};
