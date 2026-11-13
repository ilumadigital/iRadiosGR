import React from 'react';
import AdSkipControl from './AdSkipControl';
import { Play, Pause, SkipBack, SkipForward, X, Radio, AudioLines, ScanSearch, Loader2 } from 'lucide-react';

export default function CarMode({ 
  station, 
  isPlaying, 
  onPlayPause, 
  onNext, 
  onPrev,
  onClose,
  nowPlaying,
  isRecognizing,
  handleRecognizeTrack,
  spotifyUrl,
  isPlayingAd=false,currentAdInfo,adSkipCountdown,onSkipAd
}) {
  if (!station) return null;

  const isActualSong = 
    !isPlayingAd && !isRecognizing &&
    nowPlaying && 
    nowPlaying !== "LIVE NOW" && 
    nowPlaying !== "ΠΑΙΖΕΙ ΤΩΡΑ" && 
    !nowPlaying.toLowerCase().includes("αναζήτηση");

  const finalSpotifyUrl = spotifyUrl || (isActualSong ? `https://open.spotify.com/search/${encodeURIComponent(nowPlaying)}` : null);

  return (
    <div className="fixed inset-0 z-[9999] bg-black text-white flex flex-col items-center justify-between p-8 sm:p-12 animate-in fade-in zoom-in-95 duration-500">
      
      {/* TOP BAR - CLOSE BUTTON */}
      <div className="w-full flex justify-end">
        <button 
          onClick={onClose}
          className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/20 transition-all active:scale-90"
        >
          <X size={32} />
        </button>
      </div>

      {/* CENTER - STATION INFO */}
      <div className="flex flex-col items-center text-center w-full max-w-md mt-4">
        <div className={`relative w-48 h-48 sm:w-64 sm:h-64 rounded-[40px] overflow-hidden shadow-2xl mb-8 border-2 ${isPlaying ? 'border-[#ccff00] shadow-[0_0_50px_rgba(204,255,0,0.3)]' : 'border-white/10'}`}>
          <img 
            src={station.logo} 
            alt={station.name} 
            className="w-full h-full object-cover bg-zinc-900"
          />
          <div className="absolute inset-0 bg-black/20"></div>
        </div>
        
        <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter italic truncate w-full mb-2">
          {station.name}
        </h2>
        <div className="flex items-center gap-2 text-zinc-400 font-bold uppercase tracking-widest text-sm sm:text-base">
          <Radio size={18} className="text-[#ccff00]" /> {station.genre}
        </div>
      </div>

      {/* 🟢 AI MUSIC RADAR & METADATA SECTION */}
      <div className="w-full max-w-md mt-8">
        <div className={`relative w-full border rounded-[32px] p-6 flex flex-col items-center justify-center gap-4 text-center transition-colors ${isRecognizing ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'bg-zinc-900/50 border-white/10'}`}>
          
          <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-zinc-400">
            {isPlayingAd ? <span className="text-purple-300">ΔΙΑΦΗΜΙΣΤΙΚΟ ΔΙΑΛΕΙΜΜΑ</span> : isRecognizing ? (
              <span className="text-blue-400 flex items-center gap-2"><AudioLines size={16} className="animate-pulse" /> Το Music Radar Ψαχνει...</span>
            ) : (
              <span>NOW PLAYING</span>
            )}
          </div>
          
          <h3 className={`text-xl sm:text-2xl font-bold truncate w-full px-2 ${isRecognizing ? 'text-blue-300' : 'text-white'}`}>
            {isPlayingAd?(currentAdInfo?.title||'Διαφήμιση'):(nowPlaying||' ')}
          </h3>

          {/* ACTION BUTTONS (SHAZAM OR SPOTIFY) */}
          <div className="mt-2 h-14">
            {isPlayingAd ? (
              <AdSkipControl isPlayingAd={isPlayingAd} secondsUntilSkip={adSkipCountdown} onSkip={onSkipAd}/>
            ) : !isActualSong ? (
              <button 
                onClick={handleRecognizeTrack}
                disabled={isRecognizing || !isPlaying}
                className="flex items-center gap-3 bg-blue-500 hover:bg-blue-400 text-black px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
              >
                {isRecognizing ? <Loader2 size={18} className="animate-spin" /> : <ScanSearch size={18} />}
                Ψαξε Αυτο το Τραγουδι
              </button>
            ) : (
              <a 
                href={finalSpotifyUrl}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-[0_0_15px_rgba(29,185,84,0.4)]"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.48-1.02.659-1.56.3z"/>
                </svg>
                Αναζητηση
              </a>
            )}
          </div>
        </div>
      </div>

        {/* BOTTOM CONTROLS */}
        <div className="w-full max-w-md flex items-center justify-center gap-5 sm:gap-8 pb-6 mt-8">
        
        {/* PREVIOUS BUTTON */}
        <button 
            onClick={onPrev} disabled={isPlayingAd}
            className="w-24 h-24 sm:w-28 sm:h-28 bg-white/10 text-white rounded-[32px] flex items-center justify-center active:scale-95 transition-transform border border-white/5 hover:bg-white/20"
        >
            <SkipBack size={40} fill="currentColor" />
        </button>

        {/* PLAY / PAUSE */}
        <button 
            onClick={onPlayPause} disabled={isPlayingAd}
            className="w-32 h-32 sm:w-40 sm:h-40 bg-[#ccff00] text-black rounded-[40px] flex items-center justify-center shadow-[0_20px_40px_rgba(204,255,0,0.2)] active:scale-95 transition-transform"
        >
            {isPlaying ? (
            <Pause size={64} fill="currentColor" />
            ) : (
            <Play size={64} fill="currentColor" className="ml-4" />
            )}
        </button>

        {/* NEXT BUTTON */}
        <button 
            onClick={onNext} disabled={isPlayingAd}
            className="w-24 h-24 sm:w-28 sm:h-28 bg-white/10 text-white rounded-[32px] flex items-center justify-center active:scale-95 transition-transform border border-white/5 hover:bg-white/20"
        >
            <SkipForward size={40} fill="currentColor" />
        </button>

        </div>

    </div>
  );
}
