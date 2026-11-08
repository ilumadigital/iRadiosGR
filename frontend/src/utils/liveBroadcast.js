// One shared source of truth for on-air show/producer artwork.
// No guessing from station genre or arbitrary AI output; a schedule match and
// program-like native metadata can coexist with verified songs (RDS rotation).
import {getAthensClock,minutes,scheduleDayBase,toCanonical} from './schedule.js';
import {parseMusicMetadata} from './musicMetadata.js';

const SHOW_WORDS=/(?:\bdj[\s_-]*zone\b|\bradio[\s_-]*show\b|\bshow[\s_-]*time\b|\bdj[\s_-]*set\b|\bmix[\s_-]*show\b|\blive[\s_-]*(?:dj|show|set|session|mix|broadcast|radio|stream)\b|\bon[\s_-]*air\b|\bin[\s_-]*the[\s_-]*mix\b|\bnon[\s_-]*stop[\s_-]*mix\b|\b(?:now[\s_-]*playing|live|dj|radioshow|djzone)\b|εκπομπ[ήη]|παραγωγ[όο]ς|ζωνταν[άα]|στον\s*α[έε]ρα)/i;
const norm=v=>String(v||'').toLocaleLowerCase('el').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const normalizedContains=(raw,target)=>{
  const needle=norm(target);
  return needle.length>=4&&norm(raw).includes(needle);
};
// Only public http(s) artwork is considered; browsers may fall back to logo on load failure.
export function validShowImage(value){
  if(typeof value!=='string'||value.length>800)return false;
  try{
    const u=new URL(value);
    const host=u.hostname.toLowerCase();
    return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&
      host!=='localhost'&&!host.endsWith('.local')&&!host.endsWith('.internal')&&
      !/^(?:127|10|0|169\.254|192\.168)\./.test(host)&&
      !/^172\.(?:1[6-9]|2\d|3[01])\./.test(host);
  }catch{return false;}
}
export function activeStationShow(station,clock=getAthensClock()){
  const entries=station?.schedule;
  if(!Array.isArray(entries)||!entries.length)return null;
  const base=scheduleDayBase(entries,station?.scheduleDayBase);
  // toCanonical displays 24:00 as 00:00; restore the end-only boundary.
  const canonical=toCanonical(entries,base).map((show,i)=>({
    ...show,endTime:entries[i]?.endTime==='24:00'?'24:00':show.endTime
  }));
  return canonical.find(show=>Number(show.day)===clock.day&&
    Number.isFinite(minutes(show.startTime))&&Number.isFinite(minutes(show.endTime,true))&&
    minutes(show.startTime)<=clock.minute&&minutes(show.endTime,true)>clock.minute)||null;
}
export function isBroadcastMetadata(value,stationName='',show=null){
  if(typeof value!=='string'||!value.trim()||value.length>300)return false;
  // Real Artist - Title is not a DJ show, including DJ artist names.
  if(parseMusicMetadata(value,stationName))return false;
  // Generic program text, including DJZONE, LIVE, DJ, RadioShow and Greek shows.
  if(SHOW_WORDS.test(value))return true;
  // Match a known scheduled title or host only when a station is actively airing.
  return Boolean(show&&(normalizedContains(value,show.title)||
    normalizedContains(value,show.host)));
}
export function resolveLiveShowArtwork({station,nowPlaying,nowPlayingInfo,clock}={}){
  const show=activeStationShow(station,clock||getAthensClock());
  const raw=nowPlayingInfo?.broadcastHint||nowPlaying;
  const isMusic=Boolean(parseMusicMetadata(nowPlaying,station?.name));
  // A verified track and an active scheduled DJ with a photo are two valid
  // presentation sources. Rotation never changes the real playlist/song data.
  const recognizedShow=Boolean(show&&(
    isBroadcastMetadata(raw,station?.name,show)||
    (isMusic&&validShowImage(show.imageUrl))));
  const imageUrl=recognizedShow&&validShowImage(show.imageUrl)?show.imageUrl:null;
  return {show,recognizedShow,imageUrl,
    title:recognizedShow?(show.title||show.host||'Τώρα Ακούς'):null,
    artist:recognizedShow?(show.host||station?.name||'iRadios'):null};
}
