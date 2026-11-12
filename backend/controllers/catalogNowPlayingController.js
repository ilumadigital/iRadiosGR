'use strict';
// Public, read-only snapshots from the shared playlist store; never read upstream streams.
const Station=require('../models/Station');
const Playlist=require('../models/StationPlaylist');
const {snapshotSong}=require('../utils/stageNativeNow');
const {publicWidgetNativeSnapshot}=require('../services/widgetNativeNow');
const {parseTrack}=require('../utils/recordStationTrack');
const {catalogViewer,catalogEntryForViewer}=require('../services/nowPlayingVisibility');
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
exports.publicCatalogNowPlaying=async(req,res)=>{
  try{
    if(!cached||Date.now()>=cacheUntil){
      if(!pending)pending=load().then(value=>{
        cached=value;cacheUntil=Date.now()+20000;return value;
      }).finally(()=>{pending=null;});
      await pending;
    }
    const viewer=await catalogViewer(req);
    const stations={};
    for(const [id,value] of Object.entries(cached.stations)){
      const item=catalogEntryForViewer(value,viewer);
      if(item)stations[id]=item;
    }
    // Never let a shared CDN or browser cache a Premium response for a guest.
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Vary','Authorization');
    return res.json({stations});
  }catch{
    return res.status(503).json({error:'Τα ζωντανά στοιχεία δεν είναι προσωρινά διαθέσιμα.'});
  }
};

// Public station-widget RDS: verified *native* station stream metadata only.
// Premium ACRCloud matches remain private even if a manual result is current.
exports.publicWidgetNowPlaying=async(req,res)=>{
  res.setHeader('Cache-Control','public, max-age=15');
  const id=req.params.stationId;
  if(!/^[a-f0-9]{24}$/i.test(id))return res.status(400).json({error:'Invalid station identifier'});
  try{
    const approved=await Station.findOne({_id:id,status:'approved'}).select('_id').lean();
    if(!approved)return res.status(404).json({error:'Station not found'});
    const snapshot=await Playlist.findOne({stationId:approved._id})
      .select('nativeNow nativeShow').lean();
    return res.json(publicWidgetNativeSnapshot(snapshot));
  }catch{
    return res.status(503).json({error:'Widget RDS unavailable'});
  }
};
