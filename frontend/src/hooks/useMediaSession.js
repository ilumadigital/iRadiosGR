import { useEffect } from 'react';

export default function useMediaSession({
  currentStation,
  nowPlaying,
  isPlayingAd,
  currentAdInfo,
  togglePlayPause,
  handleNextStation,
  handlePrevStation,
  globalCoverArt, 
  currentUser     
}) {
  useEffect(() => {
    if ('mediaSession' in navigator && currentStation) {
      
      // 1. Έλεγχος Premium
      const isPremium = currentUser?.isPremium || currentUser?.broadcasterProfile?.tier === 'premium';
      
      // Λίστες μηνυμάτων
      const RADAR_MESSAGES = [
        "Ανάλυση ήχου...", 
        "Ψάχνω στο Cloud...", 
        "Επαλήθευση συχνοτήτων...", 
        "Σχεδόν έτοιμο...", 
        "Σύνδεση στο stream... 📡"
      ];
      
      const LOADING_MESSAGES = [...RADAR_MESSAGES, "ΠΑΙΖΕΙ ΤΩΡΑ"];
      
      // Έλεγχος αν είναι πραγματικό τραγούδι (όχι loading και όχι κενό)
      const isRealSong = nowPlaying && !LOADING_MESSAGES.includes(nowPlaying);
      const isRadarSearching = RADAR_MESSAGES.includes(nowPlaying);

      // 2. Δυναμική επιλογή Εικόνας
      let finalImage = currentStation.logo || 'https://iradios.gr/favicon.png';
      
      if (isPlayingAd && currentAdInfo?.logoUrl) {
          finalImage = currentAdInfo.logoUrl;
      } else if (isPremium && globalCoverArt && isRealSong) {
          finalImage = globalCoverArt;
      }
      
      // 3. Δυναμική επιλογή Τίτλου
      let displayTitle = '';
      if (isPlayingAd) {
        displayTitle = currentAdInfo?.title || 'Sponsored Content';
      } else if (isRadarSearching) {
        displayTitle = "📡 Το AI Radar ψάχνει..."; // Το μήνυμα που ζήτησες
      } else {
        displayTitle = isRealSong ? nowPlaying : 'Τώρα Ακούς';
      }
        
      // 4. Δυναμική επιλογή Καλλιτέχνη
      const displayArtist = isPlayingAd 
        ? (currentAdInfo?.client || 'iRadios Ads') 
        : (currentStation.name || 'iRadios Live');

      // 5. Ενημέρωση Metadata
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: displayTitle,
          artist: displayArtist,
          album: 'iRadios',
          artwork: [
            { src: finalImage, sizes: '96x96', type: 'image/png' },
            { src: finalImage, sizes: '128x128', type: 'image/png' },
            { src: finalImage, sizes: '256x256', type: 'image/png' },
            { src: finalImage, sizes: '512x512', type: 'image/png' }
          ]
        });
      } catch (e) {
        console.error("MediaSession Metadata Error:", e);
      }

      // 6. Action Handlers
      navigator.mediaSession.setActionHandler('play', togglePlayPause);
      navigator.mediaSession.setActionHandler('pause', togglePlayPause);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevStation);
      navigator.mediaSession.setActionHandler('nexttrack', handleNextStation);
      
      try {
        navigator.mediaSession.setActionHandler('stop', () => {
          togglePlayPause();
        });
      } catch (error) {}
    }
  }, [
    currentStation, 
    nowPlaying, 
    isPlayingAd, 
    currentAdInfo, 
    togglePlayPause, 
    handleNextStation, 
    handlePrevStation,
    globalCoverArt,
    currentUser
  ]);
}
