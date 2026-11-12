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
module.exports={publicWidgetNativeSnapshot};
