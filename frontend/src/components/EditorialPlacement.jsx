import React, {useCallback, useEffect, useState} from 'react';
import HomeHeroSlider from './HomeHeroSlider';
import PromotedStationCard from './PromotedStationCard';

// Slide assets use 1200×630; the display window is intentionally shorter.
// Home, Region and Genre share the same compact height and live playback.
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
    <div className={`ir-catalog-feature-row mb-8 grid min-w-0 items-stretch gap-4 ${showPromoted&&hasPromoted?'xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]':''}`}>
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
