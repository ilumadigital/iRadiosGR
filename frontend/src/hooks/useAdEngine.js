import { useState, useEffect, useRef } from 'react';

export default function useAdEngine(API_URL) {
  const [ads, setAds] = useState([]);
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [currentAdInfo, setCurrentAdInfo] = useState(null); 
  const [adTimeRemaining, setAdTimeRemaining] = useState(0);
  const [adWarning, setAdWarning] = useState(null); 
  
  const adQueue = useRef([]); 
  const adSchedules = useRef({}); 
  const stationSwitches = useRef(0); 
  const pendingStation = useRef(null); 

  const loadGlobalAds = async () => {
    try {
      // !!! Η ΜΑΓΙΚΗ ΑΛΛΑΓΗ ΕΙΝΑΙ ΕΔΩ: Τραβάμε πλέον από το /ads/public !!!
      const res = await fetch(`${API_URL}/ads/public?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setAds(data);
      }
    } catch (err) { 
      console.error("Σφάλμα φόρτωσης ads:", err); 
    }
  };

  useEffect(() => {
      loadGlobalAds(); // Φόρτωση τώρα
      
      const interval = setInterval(() => {
          loadGlobalAds();
          console.log("Ads refreshed from server...");
      }, 120000); 

      return () => clearInterval(interval);
  }, [API_URL]);

  return {
    ads,
    isPlayingAd,
    setIsPlayingAd,
    currentAdInfo,
    setCurrentAdInfo,
    adTimeRemaining,
    setAdTimeRemaining,
    adWarning,
    setAdWarning,
    adQueue,
    adSchedules,
    stationSwitches,
    pendingStation,
    loadGlobalAds
  };
}
