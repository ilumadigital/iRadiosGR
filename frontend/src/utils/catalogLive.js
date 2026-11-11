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
    foundWithAI:snapshot?.foundWithAI===true,
    premiumOnly:snapshot?.premiumOnly===true};
}

// Availability overrides every other ranking mode.
export const stationIsOffline = station => station?.isOffline === true;
const compareAvailability = (a,b) => Number(stationIsOffline(a))-Number(stationIsOffline(b));
function stationPosition(station,scope='global',scopeValue=''){
  // Saved scope orders override the default global list. New, unranked stations
  // follow the ranked ones until the admin next saves this category/region.
  if(scope!=='global'&&scopeValue){
    const ranked=station?.rankings?.find(item=>item.scope===scope&&item.value===scopeValue);
    const rank=Number(ranked?.position);
    if(ranked&&Number.isInteger(rank)&&rank>0)return rank;
    const fallback=Number(station?.position);
    return 1000000+(Number.isFinite(fallback)&&fallback>=0?fallback:999);
  }
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
// Commercial placement never rewrites editorial positions. Paid Boost
// outranks included Premium Boost only in a matching discovery scope.
export function commercialBoostPriority(station,scope='global'){
 const boost=station?.commercialBoost;
 if(boost?.tier==='purchased'){
  if(boost.placement==='global')return 200;
  if((scope==='genre'||scope==='region')&&boost.placement==='targeted')return 200;
  // A targeted purchased Boost should not suppress a simultaneously
  // entitled Premium Boost in a global placement.
  return boost.premiumIncluded===true?100:0;
 }
 return boost?.tier==='premium'?100:0;
}
// "Δημοτικότητα": a matching commercial placement comes first, followed by saved editorial position. Listener counts
// are only a deterministic tiebreaker (e.g. stations with default position 999).
export function compareCatalogPopularity(a,b,_byId={},_clock=null,scope='global',scopeValue=''){
  const offline=compareAvailability(a,b);
  if(offline)return offline;
  const promotions=commercialBoostPriority(b,scope)-commercialBoostPriority(a,scope);
  if(promotions)return promotions;
  const positions=stationPosition(a,scope,scopeValue)-stationPosition(b,scope,scopeValue);
  if(positions)return positions;
  return popularity(b)-popularity(a)||stationName(a,b);
}
// Apply the post-Boost reward to actual list SLOTS, not numeric rank values:
// manually saved positions may contain gaps (or be absent altogether).
// Expired campaigns never outrank active paid/Premium Boosts or offline radios.
export function applyPostBoostLift(orderedStations,scope='global'){
 const stations=[...(orderedStations||[])];
 const liftFor=station=>{
   if(stationIsOffline(station)||commercialBoostPriority(station,scope)!==0)return 0;
   const reward=station?.commercialBoost?.postBoost;
   const matches=reward?.placement==='global'||
     (reward?.placement==='targeted'&&(scope==='genre'||scope==='region'));
   const lift=Number(reward?.positions);
   return matches&&Number.isInteger(lift)&&lift>=1&&lift<=4?lift:0;
 };
 // Work through the baseline in order, so no station can leapfrog an
 // active commercial placement. The result is stable across re-renders.
 for(const station of [...stations]){
   const lift=liftFor(station);
   if(!lift)continue;
   const current=stations.indexOf(station);
   const firstOrganic=stations.findIndex(item=>!stationIsOffline(item)&&
     commercialBoostPriority(item,scope)===0);
   if(firstOrganic<0)break;
   const target=Math.max(firstOrganic,current-lift);
   if(target<current){
     stations.splice(current,1);
     stations.splice(target,0,station);
   }
 }
 return stations;
}

// Unified list sort for Home, category, region and map. Other explicit
// sort modes remain independent of commercial ranking.
export function sortCatalogStations(stations,byId={},clock=null,sortBy='popularity',
  scope='global',scopeValue=''){
 const ordered=[...(stations||[])].sort((a,b)=>
   compareCatalogStations(a,b,byId,clock,sortBy,scope,scopeValue));
 return sortBy==='popularity'?applyPostBoostLift(ordered,scope):ordered;
}
// "Πληρότητα": independent, live four-tier ranking, then saved position.
export function compareCatalogCompleteness(a,b,byId={},clock,scope='global',scopeValue=''){
  const aTier=catalogStationInfo(a,byId?.[String(a?._id)],clock).tier;
  const bTier=catalogStationInfo(b,byId?.[String(b?._id)],clock).tier;
  return compareAvailability(a,b)||aTier-bTier||
    compareCatalogPopularity(a,b,byId,clock,scope,scopeValue);
}
// Every sort choice is independent; selecting alphabetical, frequency or date
// must not secretly promote a station because of its metadata quality.
export function compareCatalogStations(a,b,byId={},clock,sortBy='popularity',scope='global',scopeValue=''){
  const offline=compareAvailability(a,b);
  if(offline)return offline;
  if(sortBy==='completeness')return compareCatalogCompleteness(a,b,byId,clock,scope,scopeValue);
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
  return compareCatalogPopularity(a,b,byId,clock,scope,scopeValue);
}
