import {parseMusicMetadata} from './musicMetadata.js';

// Deterministic 10-minute RDS slots shared by the profile, players and iOS.
// The view alternates only; it never mutates the real song or playlist history.
export const TEN_MINUTES=10*60*1000;
export function showProducerNow({currentUser,stationName,nowPlaying,liveBroadcast,at=Date.now()}={}){
  if(!currentUser||!liveBroadcast?.recognizedShow||!liveBroadcast.imageUrl)return false;
  if(!parseMusicMetadata(nowPlaying,stationName))return true;
  return Math.floor(at/TEN_MINUTES)%2===1;
}
