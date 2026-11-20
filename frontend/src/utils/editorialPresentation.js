// Explicit CMS placements take precedence over incidental playback history and ranking.
export function meetsEditorialAudience(slide,user){
  if(slide?.audience==='guest')return !user;
  if(slide?.audience==='member')return Boolean(user);
  if(slide?.audience==='premium')return Boolean(user?.isPremium||user?.role==='admin'||user?.broadcasterProfile?.tier==='premium');
  return true;
}
export function visibleEditorialSlides(slides,user,stations=[],excludeStationId=null){
  const approved=new Set(stations.filter(station=>station?._id &&
    (station.status==='approved'||!station.status) && station.isOffline!==true)
    .map(station=>String(station._id)));
  const seen=new Set();
  return (Array.isArray(slides)?slides:[]).filter(slide=>{
    if(!meetsEditorialAudience(slide,user))return false;
    if(slide.targetType!=='station')return true;
    const id=String(slide.stationId||'');
    if(!approved.has(id)||seen.has(id)||id===String(excludeStationId))return false;
    seen.add(id);
    return true;
  });
}
export function homeFeaturedFallback(stations=[],placement='home'){
  return placement==='home'
    ? stations.find(station=>station?.isFeatured===true &&
        (station.status==='approved'||!station.status) && station.isOffline!==true)||null
    : null;
}
