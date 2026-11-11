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
  const [promotedId,setPromotedId]=useState(null);
  const [hasEditorial,setHasEditorial]=useState(false);
  useEffect(()=>{setHasPromoted(false);setHasEditorial(false);setPromotedId(null);},[placement,value]);
  const updatePromoted=useCallback(id=>{
    setHasPromoted(Boolean(id));
    setPromotedId(id||null);
    onPromotedStationChange?.(id);
  },[onPromotedStationChange]);
  // Editorial slides are independent from paid promotions and rankings.
  // Reserve the 70/30 split only when both CMS placements are actually present.
  return (
    <div className={`ir-catalog-feature-row mb-8 grid min-w-0 items-stretch gap-4 empty:hidden ${hasEditorial&&hasPromoted?'xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]':''}`}>
      <HomeHeroSlider placement={placement} value={value} fallbackStation={fallbackStation}
        currentUser={currentUser} stations={stations} currentStation={currentStation}
        isPlaying={isPlaying} onPlayStation={onPlayStation} onPlayPause={onPlayPause}
        onAvailabilityChange={setHasEditorial} excludeStationId={promotedId}/>
      <PromotedStationCard placement={placement} value={value}
        stations={stations} currentStation={currentStation} isPlaying={isPlaying}
        onPlayStation={onPlayStation} onPlayPause={onPlayPause}
        onAvailabilityChange={updatePromoted}/>
    </div>
  );
}
