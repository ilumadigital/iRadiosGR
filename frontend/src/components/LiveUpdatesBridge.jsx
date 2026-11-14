import {useEffect} from 'react';
import {startLiveUpdates} from '../utils/liveUpdates';

// Separate from MainApp/Backoffice so live data never remounts the audio player.
export default function LiveUpdatesBridge() {
  useEffect(() => startLiveUpdates(), []);
  return null;
}
