import {geoAllowsAd} from './adPlacements.js';
export const ZAPPING_INTERVALS=Object.freeze({
  every_2_stations:2,every_4_stations:4,every_5_stations:5,
  every_10_stations:10,every_15_stations:15,every_20_stations:20,every_30_stations:30
});
export const TIME_INTERVALS=Object.freeze({
  every_1_hour:1,every_2_hours:2,every_6_hours:6,
  once_a_day:24,twice_a_day:12,four_times_a_day:6,once_a_week:168
});
export function dueOnStationChange(frequency,count) {
  if(!Number.isSafeInteger(count)||count<1)return false;
  if(frequency==='entry'||frequency==='first_station')return count===1;
  const n=ZAPPING_INTERVALS[frequency];
  return Boolean(n&&count%n===0);
}
export function dueOnClock(frequency,lastPlayedAt,now=Date.now()) {
  const hours=TIME_INTERVALS[frequency];
  return Boolean(hours&&now>=lastPlayedAt&&now-lastPlayedAt>=hours*60*60*1000);
}
export function canServeAudioAd(ad,station,location,geoMatch,now=Date.now()) {
  if(!ad?.audioUrl||!station||ad.status!=='active')return false;
  if(ad.expiresAt&&new Date(ad.expiresAt).getTime()<=now)return false;
  if(!geoAllowsAd(ad.targetLocations,location,geoMatch))return false;
  return ad.isGlobal!==false?!station.disableNetworkAds:
    String(ad.stationId?._id||ad.stationId)===String(station._id);
}
export function selectStationBreak(ads,count,station,location,geoMatch,maxSpots=2) {
  if(!Array.isArray(ads))return [];
  return ads.filter(ad=>dueOnStationChange(ad.frequency,count)&&
    canServeAudioAd(ad,station,location,geoMatch)).slice(0,maxSpots);
}
