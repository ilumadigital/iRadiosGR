'use strict';
const Playlist=require('../models/StationPlaylist');
const seen=new Map();
const noise=/^(?:live(?:\s+(?:now|show|radio))?|on\s*air|now\s*playing|playing\s*now|radio|station|web\s*radio|dj\s*set|unknown|news|talk|streaming|εκπομπή|ραδιόφωνο|δελτίο\s*ειδήσεων|ειδήσεις|μουσική|παίζει\s*τώρα|στον\s*αέρα|σύνδεση|διαφήμιση)$/i;
const compact=s=>String(s||'').toLocaleLowerCase('el')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]/gu,'');
function parseTrack(raw,stationName=''){
  if(typeof raw!=='string'||raw.length>300)return null;
  const value=raw.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  if(!value||noise.test(value)||compact(value)===compact(stationName))return null;
  const match=value.match(/^(.{1,150}?)\s+[-–—]\s+(.{1,150})$/);
  if(!match)return null;
  const artist=match[1].trim(),title=match[2].trim();
  if(!artist||!title||noise.test(artist)||noise.test(title))return null;
  // A DJ/radio programme label is not proof of a real artist/title pair.
  if(/(?:radio\s?show|live\s?show|dj\s?set|morning\s?show|evening\s?show|podcast|εκπομπή|δελτίο\s+ειδήσεων)/i.test(title))return null;
  const compactStation=compact(stationName);
  if(compactStation.length>=5 &&
    (compact(artist)===compactStation||compact(title)===compactStation))return null;
  if(/^(?:\d{1,2}[.:]\d{1,2}|\d{2}\.\d{2})$/.test(artist)||
     /^(?:\d{1,2}[.:]\d{1,2}|\d{2}\.\d{2})$/.test(title))return null;
  return {raw:value,artist,title,playedAt:new Date()};
}
async function recordStationTrack(station,raw,options={}){
  const track=parseTrack(raw,station?.name);
  if(!track||!station?._id)return false;
  const id=String(station._id);
  const source=options.source==='acrcloud'?'acrcloud':'station';
  track.source=source;
  if(seen.size>500)seen.clear();
  try{
    // A track can be confirmed by ACRCloud without creating a duplicate history entry.
    if(source==='acrcloud'){
      await Playlist.updateOne({stationId:station._id,'tracks.0.raw':track.raw},
        {$set:{'tracks.0.source':'acrcloud'}});
    }
    if(seen.get(id)===track.raw)return false;
    await Playlist.updateOne({stationId:station._id},
      {$setOnInsert:{stationId:station._id}},{upsert:true});
    await Playlist.updateOne(
      {stationId:station._id,'tracks.0.raw':{$ne:track.raw}},
      {$push:{tracks:{$each:[track],$position:0,$slice:12}}}
    );
    seen.set(id,track.raw);
    return true;
  }catch(error){
    console.warn('Station playlist write skipped:',error.code||error.name);
    return false;
  }
}
module.exports={parseTrack,recordStationTrack};
