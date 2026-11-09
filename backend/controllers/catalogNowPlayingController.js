'use strict';
// Public, read-only snapshots from the shared playlist store; never read upstream streams.
const Station=require('../models/Station');
const Playlist=require('../models/StationPlaylist');
const {snapshotSong}=require('../utils/stageNativeNow');
const {parseTrack}=require('../utils/recordStationTrack');
let cached=null,cacheUntil=0,pending=null;
async function load(){
  const now=Date.now();
  const approved=await Station.find({status:'approved'}).select('_id').lean();
  if(!approved.length)return {stations:{}};
  const docs=await Playlist.find({stationId:{$in:approved.map(s=>s._id)}})
    .select('stationId nativeNow nativeShow currentAI').lean();
  const stations=Object.create(null);
  for(const doc of docs){
    const snapshot=snapshotSong(doc,now);
    if(!snapshot)continue;
    const song=parseTrack(snapshot.title||'');
    const broadcastHint=typeof snapshot.broadcastHint==='string'?snapshot.broadcastHint.slice(0,300):'';
    if(!song&&!broadcastHint)continue;
    stations[String(doc.stationId)]={
      ...(song?{song:{artist:song.artist,title:song.title},source:snapshot.source,
        foundWithAI:snapshot.foundWithAI===true,
        ...(snapshot.source==='acrcloud'&&snapshot.expiresAt?
          {expiresAt:snapshot.expiresAt}:{})}:{}),
      ...(broadcastHint?{broadcastHint}:{})
    };
  }
  return {stations};
}
exports.publicCatalogNowPlaying=async(_req,res)=>{
  try{
    if(!cached||Date.now()>=cacheUntil){
      if(!pending)pending=load().then(value=>{
        cached=value;cacheUntil=Date.now()+20000;return value;
      }).finally(()=>{pending=null;});
      await pending;
    }
    res.setHeader('Cache-Control','public, max-age=20, stale-while-revalidate=15');
    return res.json(cached);
  }catch{
    return res.status(503).json({error:'Τα ζωντανά στοιχεία δεν είναι προσωρινά διαθέσιμα.'});
  }
};
