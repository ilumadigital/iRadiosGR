import {activeStationShow} from './liveBroadcast';
// Rank verified information only; expired/unknown titles do not increase rank.
export function catalogStationInfo(station,snapshot,clock){
  const show=activeStationShow(station,clock);
  const data=snapshot?.song;
  const artist=typeof data?.artist==='string'?data.artist.trim():'';
  const title=typeof data?.title==='string'?data.title.trim():'';
  const song=artist&&title?{artist,title}:null;
  const host=typeof show?.host==='string'?show.host.trim():'';
  const showTitle=typeof show?.title==='string'&&show.title.trim()
    ?show.title.trim()
    :(typeof snapshot?.broadcastHint==='string'?snapshot.broadcastHint.trim():'');
  const score=(song?4:0)+(host?3:0)+(showTitle?1:0);
  return {song,host,showTitle,score,foundWithAI:snapshot?.foundWithAI===true};
}
export function compareCatalogPopularity(a,b,byId={},clock){
  const aScore=catalogStationInfo(a,byId[String(a._id)],clock).score;
  const bScore=catalogStationInfo(b,byId[String(b._id)],clock).score;
  if(aScore!==bScore)return bScore-aScore;
  const aPopularity=Number(a.popularity??a.plays??0)||0;
  const bPopularity=Number(b.popularity??b.plays??0)||0;
  if(aPopularity!==bPopularity)return bPopularity-aPopularity;
  return String(a.name||'').localeCompare(String(b.name||''),'el');
}
