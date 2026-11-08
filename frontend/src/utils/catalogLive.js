import {activeStationShow,validShowImage,isBroadcastMetadata} from './liveBroadcast.js';

// All catalogue modes share four strict quality tiers. A title/song is only
// trusted when the shared now-playing endpoint reports a current parsed song.
// A schedule only counts while the programme is actively on air in Athens time.
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
  // A live DJ/radio-show metadata marker also counts as metadata for a
  // complete programme. It must match a real on-air schedule and valid photo.
  const hasBroadcastMetadata=Boolean(broadcastHint&&
    isBroadcastMetadata(broadcastHint,station?.name,show));
  // 0: complete live programme + host + photo + verified song OR broadcast metadata
  // 1: verified song metadata (without a complete programme)
  // 2: active programme without current verified metadata
  // 3: no verified metadata and no active programme
  const tier=liveProgramme&&host&&hasShowPhoto&&(song||hasBroadcastMetadata)
    ?0:song?1:liveProgramme?2:3;
  return {song,host,showTitle:showTitle||broadcastHint,tier,hasShowPhoto,
    foundWithAI:snapshot?.foundWithAI===true};
}

function popularity(station){
  return Number(station?.popularity??station?.plays??0)||0;
}
function frequency(station){
  if(station?.transmissionType!=='Επίγειο'||!station.frequency)return Number.POSITIVE_INFINITY;
  const result=Number.parseFloat(String(station.frequency).replace(',','.'));
  return Number.isFinite(result)?result:Number.POSITIVE_INFINITY;
}
// Tier has absolute priority. UI-selected sorting only breaks ties inside a tier.
export function compareCatalogStations(a,b,byId={},clock,sortBy='popularity'){
  const aTier=catalogStationInfo(a,byId?.[String(a._id)],clock).tier;
  const bTier=catalogStationInfo(b,byId?.[String(b._id)],clock).tier;
  if(aTier!==bTier)return aTier-bTier;
  if(sortBy==='alphabetical'){
    return String(a.name||'').localeCompare(String(b.name||''),'el')||
      String(a._id||'').localeCompare(String(b._id||''));
  }
  if(sortBy==='frequency'){
    const diff=frequency(a)-frequency(b);
    if(Number.isFinite(diff)&&diff!==0)return diff;
    if(frequency(a)!==frequency(b))return Number.isFinite(frequency(a))?-1:1;
  }
  if(sortBy==='date'){
    const d=(new Date(b.createdAt||0).getTime()||0)-(new Date(a.createdAt||0).getTime()||0);
    if(d!==0)return d;
  }
  const popularityDiff=popularity(b)-popularity(a);
  return popularityDiff||String(a.name||'').localeCompare(String(b.name||''),'el')||
    String(a._id||'').localeCompare(String(b._id||''));
}
// Keep the public comparator imported by existing Region/Genre/Map consumers.
export const compareCatalogPopularity=(a,b,byId={},clock)=>
  compareCatalogStations(a,b,byId,clock,'popularity');
