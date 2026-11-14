// Render-only account playback state: never starts audio on a controller.
// Free listeners intentionally remain independent across devices.
export function findPremiumOwner(devices,premium){
  if(!premium||!Array.isArray(devices))return null;
  return devices.find(device=>device?.online===true &&
    ['playing','paused','pending'].includes(device?.playbackState) &&
    typeof device.stationId==='string' && device.stationId.length>0)||null;
}
export function remotePremiumPlayback(owner,localDeviceId){
  if(!owner||owner.deviceId===localDeviceId)return null;
  return {
    deviceName:owner.deviceName||'Άλλη συσκευή',
    state:owner.playbackState,
    stationId:owner.stationId
  };
}
export function shouldShowPause(localPlaying,remotePlayback){
  return Boolean(localPlaying || (remotePlayback &&
    ['playing','pending'].includes(remotePlayback.state)));
}
export function ownerTransportAction(owner){
  return owner?.playbackState==='paused'?'resume':'pause';
}
