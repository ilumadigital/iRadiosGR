import React, { useState } from 'react';
import { Instagram, Loader2 } from 'lucide-react';
import { useAlert } from '../context/AlertContext';
import { generateStationStory, shareStationStory } from '../utils/storyShare';

// One shared action for mini player, fullscreen player and station profiles.
// The image renderer never depends on a working remote image service to finish.
export default function ShareStory({
  currentStation, nowPlaying, artworkUrl, show, showImageUrl,
  label = null, className = '', iconSize = 20
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { showAlert } = useAlert();

  const handleShare = async (event) => {
    event.stopPropagation(); // Do not open the fullscreen mini player when tapping Story.
    if (!currentStation?.name || isGenerating) return;
    setIsGenerating(true);
    try {
      const file = await generateStationStory({
        station: currentStation, nowPlaying, artworkUrl, show, showImageUrl
      });
      const outcome = await shareStationStory(file, currentStation.name);
      if (outcome === 'downloaded') {
        showAlert('Το Story αποθηκεύτηκε ως εικόνα 9:16. Άνοιξε το Instagram και επίλεξέ την από τα Stories.');
      }
    } catch (error) {
      console.error('iRadios Story:', error);
      showAlert('Δεν ήταν δυνατή η δημιουργία Story. Δοκίμασε ξανά.');
    } finally {
      setIsGenerating(false);
    }
  };

  const accessibleLabel = label || 'Κάνε Story με τον ' + (currentStation?.name || 'σταθμό');
  return (
    <button
      type="button"
      data-story-share="instagram"
      onClick={handleShare}
      disabled={isGenerating || !currentStation?.name}
      className={'inline-flex items-center justify-center gap-2 transition-colors active:scale-95 disabled:opacity-50 ' +
        (label ? '' : 'p-2 rounded-full ') + className}
      title={accessibleLabel}
      aria-label={accessibleLabel}
    >
      {isGenerating ? <Loader2 size={iconSize} className="animate-spin" aria-hidden="true" /> :
        <Instagram size={iconSize} aria-hidden="true" />}
      {label && <span>{label}</span>}
    </button>
  );
}
