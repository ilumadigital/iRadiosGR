'use strict';
// The public embed deliberately omits currentAI, including when ACR is newer
// than native station metadata. Do not use snapshotSong() here.
const {nativeSongFromSnapshot,validNativeShow}=require('../utils/stageNativeNow');
function publicWidgetNativeSnapshot(doc,now=Date.now()){
  const native=nativeSongFromSnapshot(doc,now);
  const hint=validNativeShow(doc,now);
  return {
    title:native?.raw||'',
    source:native?'station':'none',
    foundWithAI:false,
    ...(native?.changedAt?{changedAt:new Date(native.changedAt).toISOString()}:{}),
    ...(hint?{broadcastHint:hint}:{})
  };
}
// Native-only rolling history for public embeds. Never reveal currentAI or
// paid manual ACR matches to an unauthenticated third-party iframe.
function publicWidgetPlaylistSnapshot(doc,now=Date.now()){
  const cutoff=now-30*60*1000;
  const tracks=(Array.isArray(doc?.tracks)?doc.tracks:[]).filter(track=>{
    const at=new Date(track?.playedAt).getTime();
    return track?.source==='station'&&typeof track?.title==='string'&&
      typeof track?.artist==='string'&&Number.isFinite(at)&&at>=cutoff&&at<=now;
  }).slice(0,30).map(track=>({
    title:track.title,artist:track.artist,
    raw:track.artist+' - '+track.title,playedAt:track.playedAt
  }));
  return {tracks};
}
module.exports={publicWidgetNativeSnapshot,publicWidgetPlaylistSnapshot};
