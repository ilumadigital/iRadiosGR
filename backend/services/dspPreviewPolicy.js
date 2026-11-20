'use strict';

// The preview is an invitation/onboarding sales tool, not a public station API.
// An approved, owned station with NO current right is the only eligible case.
function isDSPPreviewCandidate(user,station){
  return Boolean(user&&user.role==='broadcaster'&&user._id&&station&&
    station.status==='approved'&&station.broadcasterId&&
    String(station.broadcasterId)===String(user._id));
}
async function eligibleDSPPreviewStations(user,stations,hasRight){
  if(!Array.isArray(stations)||typeof hasRight!=='function')return [];
  const candidates=stations.filter(station=>isDSPPreviewCandidate(user,station));
  const checked=await Promise.all(candidates.map(async station=>
    await hasRight(user,station,'broadcaster.webdsp')?null:station));
  return checked.filter(Boolean);
}
module.exports={isDSPPreviewCandidate,eligibleDSPPreviewStations};
