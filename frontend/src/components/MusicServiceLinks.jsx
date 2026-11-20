import React from 'react';
import { SiApplemusic, SiSpotify } from 'react-icons/si';
import { useAlert } from '../context/AlertContext';
import { parseMusicMetadata, spotifySongLink, appleMusicSongLink } from '../utils/musicMetadata';
import './MusicServiceLinks.css';

/**
 * Outbound song searches, not automatic track matching or music playback.
 * Every surface shares the same metadata validation and Premium gate.
 * Logged-out listeners do not see these actions.
 */
export default function MusicServiceLinks({
  song, stationName = '', currentUser, compact = false, className = ''
}) {
  const { showAlert } = useAlert();
  const music = parseMusicMetadata(song, stationName);
  if (!currentUser || !music) return null;

  const spotify = spotifySongLink(music.raw, stationName);
  const apple = appleMusicSongLink(music.raw, stationName);
  if (!spotify || !apple) return null;

  const isPremium = Boolean(
    currentUser.isPremium || currentUser.broadcasterProfile?.tier === 'premium'
  );
  const openMusic = (event, url) => {
    event.stopPropagation();
    if (!isPremium) {
      showAlert('Αναβαθμίστε σε Premium για αυτή την εμπειρία.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`ir-music-service-links ${compact ? 'ir-music-service-links--compact' : ''} ${className}`}
      role="group" aria-label="Βρες το τραγούδι σε μουσικές υπηρεσίες">
      <button type="button" className="ir-music-service-link ir-music-service-link--spotify"
        title="Βρες το τραγούδι στο Spotify"
        aria-label="Βρες το τραγούδι στο Spotify"
        onClick={event => openMusic(event, spotify)}>
        <SiSpotify aria-hidden="true" />
        <span>Spotify</span>
      </button>
      <button type="button" className="ir-music-service-link ir-music-service-link--apple"
        title="Βρες το τραγούδι στο Apple Music"
        aria-label="Βρες το τραγούδι στο Apple Music"
        onClick={event => openMusic(event, apple)}>
        <SiApplemusic aria-hidden="true" />
        <span>Apple Music</span>
      </button>
    </div>
  );
}
