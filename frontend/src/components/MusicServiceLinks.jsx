import React from 'react';
import { SiSpotify, SiApplemusic } from 'react-icons/si';
import { parseMusicMetadata, spotifySongLink, appleMusicSongLink } from '../utils/musicMetadata';
import '../styles/music-service-links.css';

// One consistent set of branded links for station pages and both full-screen players.
// Search links never claim an exact song match. A validated recognized Spotify ID
// can still deep-link to its track when the parent explicitly supplies it.
export default function MusicServiceLinks({
  raw, stationName = '', spotifyUrl = null, compact = false, className = ''
}) {
  const song = parseMusicMetadata(raw, stationName);
  if (!song) return null;

  const recognizedSpotify = typeof spotifyUrl === 'string' &&
    /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}(?:\?[^\s#]*)?$/.test(spotifyUrl)
      ? spotifyUrl : null;
  const spotifyLink = recognizedSpotify || spotifySongLink(song.raw, stationName);
  const appleLink = appleMusicSongLink(song.raw, stationName);
  if (!spotifyLink || !appleLink) return null;

  return (
    <div className={`ir-music-service-links ${compact ? 'ir-music-service-links--compact' : ''} ${className}`}
      role="group" aria-label={`Βρες το τραγούδι ${song.title} σε μουσικές υπηρεσίες`}>
      <a className="ir-music-service ir-music-service--spotify"
        href={spotifyLink} target="_blank" rel="noopener noreferrer"
        aria-label={`Βρες ${song.artist} - ${song.title} στο Spotify`}
        title="Αναζήτηση στο Spotify">
        <SiSpotify aria-hidden="true" />
        <span>Spotify</span>
      </a>
      <a className="ir-music-service ir-music-service--apple"
        href={appleLink} target="_blank" rel="noopener noreferrer"
        aria-label={`Βρες ${song.artist} - ${song.title} στο Apple Music`}
        title="Αναζήτηση στο Apple Music">
        <SiApplemusic aria-hidden="true" />
        <span>Apple Music</span>
      </a>
    </div>
  );
}
