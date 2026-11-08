import {activeStationShow,validShowImage,isBroadcastMetadata} from './liveBroadcast.js';

// Live information is only used when "Πληρότητα" is selected. Never infer it
// from historical/cached data or treat scheduled future shows as currently on-air.
export function catalogStationInfo(station,snapshot,clock){
  const show=activeStationShow(station,clock);
  const data=snapshot?.song;
  const artist=typeof data?.artist==='string'?data.artist.trim():'';
  const title=typeof data?.title==='string'?data.title.trim():'';
  const song=artist&&title?{artist,title}:null;
  const host=typeof show?.host==='string'?show.host.trim():'';
  const liveProgramme=Boolean(show&&typeof show.title==='string'&&show.title.trim());
  const hasShowPhoto=Boolean(liveProgramme&&validShowImage(show.imageUrl));
  const showTitle=liveProgramme?show.title.trim():'';
  const broadcastHint=typeof snapshot?.broadcastHint==='string'?snapshot.broadcastHint.trim():'';
  const hasBroadcastMetadata=Boolean(broadcastHint&&
    isBroadcastMetadata(broadcastHint,station?.name,show));
  // 0: active show with host, image and song or broadcast metadata
  // 1: valid track metadata
  // 2: active show without complete visual/metadata
  // 3: no current metadata or show
  const tier=liveProgramme&&host&&hasShowPhoto&&(song||hasBroadcastMetadata)
    ?0:song?1:liveProgramme?2:3;
  return {song,host,showTitle:showTitle||broadcastHint,tier,hasShowPhoto,
    foundWithAI:snapshot?.foundWithAI===true};
}

function stationPosition(station){
  const raw=station?.position;
  if(raw===null||raw===undefined||raw==='')return 999;
  const value=Number(raw);
  return Number.isFinite(value)&&value>=0?value:999;
}
function popularity(station){
  return Number(station?.popularity??station?.plays??0)||0;
}
function stationName(a,b){
  return String(a?.name||'').localeCompare(String(b?.name||''),'el')||
    String(a?._id||'').localeCompare(String(b?._id||''));
}
function frequency(station){
  if(station?.transmissionType!=='Επίγειο'||!station.frequency)return Number.POSITIVE_INFINITY;
  const result=Number.parseFloat(String(station.frequency).replace(',','.'));
  return Number.isFinite(result)?result:Number.POSITIVE_INFINITY;
}
// "Δημοτικότητα": the saved editorial position comes FIRST. Listener counts
// are only a deterministic tiebreaker (e.g. stations with default position 999).
export function compareCatalogPopularity(a,b){
  const positions=stationPosition(a)-stationPosition(b);
  if(positions)return positions;
  return popularity(b)-popularity(a)||stationName(a,b);
}
// "Πληρότητα": independent, live four-tier ranking, then saved position.
export function compareCatalogCompleteness(a,b,byId={},clock){
  const aTier=catalogStationInfo(a,byId?.[String(a?._id)],clock).tier;
  const bTier=catalogStationInfo(b,byId?.[String(b?._id)],clock).tier;
  return aTier-bTier||compareCatalogPopularity(a,b);
}
// Every sort choice is independent; selecting alphabetical, frequency or date
// must not secretly promote a station because of its metadata quality.
export function compareCatalogStations(a,b,byId={},clock,sortBy='popularity'){
  if(sortBy==='completeness')return compareCatalogCompleteness(a,b,byId,clock);
  if(sortBy==='alphabetical')return stationName(a,b);
  if(sortBy==='frequency'){
    const aFrequency=frequency(a),bFrequency=frequency(b);
    if(aFrequency!==bFrequency)return aFrequency<bFrequency?-1:1;
  }
  if(sortBy==='date'){
    const aDate=new Date(a?.createdAt||0).getTime()||0;
    const bDate=new Date(b?.createdAt||0).getTime()||0;
    if(aDate!==bDate)return bDate-aDate;
  }
  return compareCatalogPopularity(a,b);
}
