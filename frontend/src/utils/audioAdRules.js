import {geoAllowsAd} from './adPlacements.js';
export const MAX_AD_BREAK_SPOTS=3;
export const ZAPPING_INTERVALS=Object.freeze({
 every_2_stations:2,every_4_stations:4,every_5_stations:5,
 every_10_stations:10,every_15_stations:15,every_20_stations:20,
 every_30_stations:30
});
export const TIME_INTERVALS=Object.freeze({
 every_1_hour:1,every_2_hours:2,every_6_hours:6,
 once_a_day:24,twice_a_day:12,four_times_a_day:6,
 six_times_a_day:4,once_a_week:168
});
const PRIORITY=Object.freeze(['entry','every_5_stations','every_10_stations',
 'every_20_stations','every_30_stations','twice_a_day',
 'four_times_a_day','six_times_a_day']);
export function placementsForAd(ad){
 const all=Array.isArray(ad?.frequencies)&&ad.frequencies.length?
  ad.frequencies:[ad?.frequency];
 return [...new Set(all.filter(p=>PRIORITY.includes(p)))];
}
export function dueOnStationChange(frequency,count){
 if(!Number.isSafeInteger(count)||count<1)return false;
 if(frequency==='entry'||frequency==='first_station')return count===1;
 const n=ZAPPING_INTERVALS[frequency];
 return Boolean(n&&count%n===0);
}
export function dueOnClock(frequency,lastPlayedAt,now=Date.now()){
 const hours=TIME_INTERVALS[frequency];
 return Boolean(hours&&now>=lastPlayedAt&&now-lastPlayedAt>=hours*60*60*1000);
}
export function canServeAudioAd(ad,station,location,geoMatch,now=Date.now()){
 if(!ad?.audioUrl||!station||ad.status!=='active')return false;
 if(ad.expiresAt&&new Date(ad.expiresAt).getTime()<=now)return false;
 if(!geoAllowsAd(ad.targetLocations,location,geoMatch,ad.serverGeoEligible===true))
  return false;
 return ad.isGlobal!==false?!station.disableNetworkAds:
  String(ad.stationId?._id||ad.stationId)===String(station._id);
}
export function orderAudioCandidates(candidates){
 return [...candidates].sort((a,b)=>
  Number(b.dailyBudgetCents||0)-Number(a.dailyBudgetCents||0)||
  String(a.campaignId||a._id).localeCompare(String(b.campaignId||b._id))||
  String(a._id).localeCompare(String(b._id)));
}
export function stationBreakCandidates(ads,count,station,location,geoMatch){
 if(!Array.isArray(ads))return [];
 const candidates=ads.map(ad=>{
  const placements=placementsForAd(ad);
  const matching=placements.filter(p=>dueOnStationChange(p,count));
  if(!matching.length||!canServeAudioAd(ad,station,location,geoMatch))return null;
  // At count 10, an ad configured for 5 and 10 is billed for its most
  // frequent matching placement, not twice in the same break.
  const selectedPlacement=matching.sort((a,b)=>PRIORITY.indexOf(a)-PRIORITY.indexOf(b))[0];
  return {...ad,selectedPlacement};
 }).filter(Boolean);
 const used=new Set();
 return orderAudioCandidates(candidates).filter(ad=>{
  const key=String(ad.campaignId||ad._id);
  if(used.has(key))return false;
  used.add(key);return true;
 });
}
export function selectStationBreak(ads,count,station,location,geoMatch,maxSpots=MAX_AD_BREAK_SPOTS){
 return stationBreakCandidates(ads,count,station,location,geoMatch)
  .slice(0,Math.min(MAX_AD_BREAK_SPOTS,Math.max(1,maxSpots)));
}
export function timedBreakCandidates(ads,station,location,geoMatch,lastPlayed,now=Date.now()){ 
 if(!Array.isArray(ads))return [];
 const candidates=ads.map(ad=>{
  if(!canServeAudioAd(ad,station,location,geoMatch,now))return null;
  const options=placementsForAd(ad).filter(p=>
   dueOnClock(p,lastPlayed[ad._id+':'+p]||0,now));
  if(!options.length)return null;
  return {...ad,selectedPlacement:options.sort((a,b)=>
   PRIORITY.indexOf(a)-PRIORITY.indexOf(b))[0]};
 }).filter(Boolean);
 const used=new Set();
 return orderAudioCandidates(candidates).filter(ad=>{
  const key=String(ad.campaignId||ad._id);
  if(used.has(key))return false;
  used.add(key);return true;
 });
}
export function selectTimedBreak(ads,station,location,geoMatch,lastPlayed,now=Date.now(),maxSpots=MAX_AD_BREAK_SPOTS){
 return timedBreakCandidates(ads,station,location,geoMatch,lastPlayed,now)
  .slice(0,Math.min(MAX_AD_BREAK_SPOTS,Math.max(1,maxSpots)));
}
