/** A radio ad break can be skipped after 15 seconds of actual audible
 * playback, counted across consecutive spots in the same break. Pauses,
 * stalls and seek jumps do not advance the clock.
 */
export const AD_SKIP_SECONDS=15;
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
// Short standalone spots must play in full. In a multi-spot break the
// accumulated audible-time clock can unlock skip even during a short spot.
export function canSkipAd(clock,duration,multiSpotBreak=false){
  return Boolean(clock&&Number.isFinite(duration)&&
    (multiSpotBreak||duration>AD_SKIP_SECONDS)&&
    clock.seconds>=AD_SKIP_SECONDS);
}
export function secondsUntilAdSkip(clock,duration,multiSpotBreak=false){
  if(!Number.isFinite(duration)||(!multiSpotBreak&&duration<=AD_SKIP_SECONDS))return null;
  return Math.max(0,Math.ceil(AD_SKIP_SECONDS-(clock?.seconds||0)));
}
