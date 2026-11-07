'use strict';
const Playlist=require('../models/StationPlaylist');
const seen=new Map();
function parseTrack(raw, stationName='') {
  if(typeof raw!=='string'||raw.length>300) return null;
  const value=raw.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  if(!value||value.toLowerCase()===String(stationName||'').toLowerCase()||
    /^(now playing|live now|on air|unknown|διαφήμιση|παίζει τώρα)$/i.test(value)) return null;
  const match=value.match(/^(.{1,150}?)\s+[-–—]\s+(.{1,150})$/);
  if(!match) return null; // Do not invent artist/title from radio slogans.
  const artist=match[1].trim(), title=match[2].trim();
  if(!artist||!title) return null;
  return { raw:value, artist, title, playedAt:new Date() };
}
async function recordStationTrack(station,raw) {
  const track=parseTrack(raw,station?.name);
  if(!track||!station?._id) return false;
  const id=String(station._id);
  const last=seen.get(id);
  if(last===track.raw) return false;
  if(seen.size>500) seen.clear();
  try {
    await Playlist.updateOne({stationId:station._id},{$setOnInsert:{stationId:station._id}},{upsert:true});
    await Playlist.updateOne(
      {stationId:station._id,'tracks.0.raw':{$ne:track.raw}},
      {$push:{tracks:{$each:[track],$position:0,$slice:12}}}
    );
    seen.set(id,track.raw);
    return true;
  } catch (e) {
    // Logging must never interrupt radio metadata; a single failed write is retried on next poll.
    console.warn('Station playlist write skipped:',e.code||e.name);
    return false;
  }
}
module.exports={parseTrack,recordStationTrack};
