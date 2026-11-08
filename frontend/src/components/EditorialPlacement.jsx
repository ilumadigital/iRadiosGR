import React, {useCallback, useEffect, useState} from 'react';
import HomeHeroSlider from './HomeHeroSlider';
import PromotedStationCard from './PromotedStationCard';

// One shared carousel for Home, Region and Genre. Each slide has a 1200×630
// presentation frame. The promoted station is independent of slide rotation.
export default function EditorialPlacement({
  placement,value,currentUser,stations=[],fallbackStation,currentStation,isPlaying,
  onPlayStation,onPlayPause,viewMode='grid',onPromotedStationChange
}){
  const [hasPromoted,setHasPromoted]=useState(false);
  useEffect(()=>setHasPromoted(false),[placement,value]);
  const updatePromoted=useCallback(id=>{
    setHasPromoted(Boolean(id));
    onPromotedStationChange?.(id);
  },[onPromotedStationChange]);
  const showPromoted=viewMode==='grid';
  return (
    <div className={`ir-catalog-feature-row mb-8 grid min-w-0 items-stretch gap-4 ${showPromoted&&hasPromoted?'xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.72fr)]':''}`}>
      <HomeHeroSlider placement={placement} value={value} fallbackStation={fallbackStation}
        currentUser={currentUser} stations={stations} currentStation={currentStation}
        isPlaying={isPlaying} onPlayStation={onPlayStation} onPlayPause={onPlayPause}/>
      {showPromoted&&<PromotedStationCard placement={placement} value={value}
        stations={stations} currentStation={currentStation} isPlaying={isPlaying}
        onPlayStation={onPlayStation} onPlayPause={onPlayPause}
        onAvailabilityChange={updatePromoted}/>}
    </div>
  );
}
