/** The skip threshold depends on the number of spots originally queued.
 * Count actual audible seconds across the whole break, not wall-clock time.
 * Pauses, stalls and seek jumps do not advance this clock.
 */
export const AD_SKIP_SECONDS=15;
export const AD_SKIP_TWO_SPOTS_SECONDS=40;
export const AD_SKIP_THREE_PLUS_SECONDS=55;

function breakSpotCount(count=1){
  // Compatibility with callers using the legacy multi-spot boolean.
  return typeof count==='boolean'?(count?2:1):
    Number.isInteger(count)&&count>=1?count:1;
}
export function skipThresholdForBreak(count=1){
  const spots=breakSpotCount(count);
  return spots>=3?AD_SKIP_THREE_PLUS_SECONDS:
    spots===2?AD_SKIP_TWO_SPOTS_SECONDS:AD_SKIP_SECONDS;
}
export function newAdListenClock(){
  return {seconds:0,position:0,lastWallMs:0,playing:false};
}
export function resumeAdListenClock(clock,position,now){
  return {...clock,position:Number.isFinite(position)?position:0,lastWallMs:now,playing:true};
}
export function suspendAdListenClock(clock){
  return {...clock,playing:false,lastWallMs:0};
}
export function sampleAdListenClock(clock,{position,now,paused=false,seeking=false,readyState=4}){
  if(!Number.isFinite(position)||!Number.isFinite(now))return clock;
  let seconds=clock.seconds;
  const mediaDelta=position-clock.position;
  const elapsed=(now-clock.lastWallMs)/1000;
  if(clock.playing&&!paused&&!seeking&&readyState>=2&&elapsed>=0&&
     mediaDelta>=0&&mediaDelta<=Math.max(0.25,elapsed*1.15+0.25)){
    seconds+=Math.min(mediaDelta,Math.max(0,elapsed));
  }
  return {seconds,position,lastWallMs:now,playing:clock.playing};
}
// Short single spots finish normally instead of exposing an impossible Skip.
// Multi-spot breaks remain skippable after the threshold even while a later
// spot is buffering and its duration metadata is not yet available.
export function canSkipAd(clock,duration,spotCount=1){
  const spots=breakSpotCount(spotCount);
  const threshold=skipThresholdForBreak(spots);
  if(!Number.isFinite(clock?.seconds)||clock.seconds<threshold)return false;
  return spots>1||(Number.isFinite(duration)&&duration>threshold);
}
export function secondsUntilAdSkip(clock,duration,spotCount=1){
  const spots=breakSpotCount(spotCount);
  const threshold=skipThresholdForBreak(spots);
  if(spots===1&&(!Number.isFinite(duration)||duration<=threshold))return null;
  return Math.max(0,Math.ceil(threshold-(clock?.seconds||0)));
}
