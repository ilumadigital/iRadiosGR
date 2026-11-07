import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Radio, AudioLines } from 'lucide-react';
import { cleanMetadata } from '../utils/cleanMetadata'; 

export default function PlayingNow({ stations, API_URL }) {
  const navigate = useNavigate(); 
  const [liveStations, setLiveStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const fetchLiveData = async () => {
      if (!stations || stations.length === 0) return;
      if (liveStations.length === 0) setIsLoading(true);
      
      const shuffled = [...stations].sort(() => 0.5 - Math.random()).slice(0, 30);
      const batchSize = 5; 
      let freshResults = [];

      for (let i = 0; i < shuffled.length; i += batchSize) {
        if (!mountedRef.current) break;
        const batch = shuffled.slice(i, i + batchSize);
        
        const promises = batch.map(async (station) => {
          try {
            const metaRes = await fetch(`${API_URL}/metadata?stream=${encodeURIComponent(station.stream)}&customMeta=${encodeURIComponent(station.metadata || '')}`);
            const metaData = await metaRes.json();
            
            if (metaData && metaData.title && metaData.title.trim() !== '') {
              const cleanTitle = cleanMetadata(metaData.title);
              let coverArt = station.logo; 

              if (cleanTitle) {
                try {
                  const myRes = await fetch(`${API_URL}/cover-art?term=${encodeURIComponent(cleanTitle)}`);
                  if (myRes.ok) {
                    const myData = await myRes.json();
                    if (myData && myData.artworkUrl) {
                      coverArt = myData.artworkUrl;
                    }
                  }
                } catch (e) {}
              }

              return {
                ...station,
                nowPlaying: cleanTitle || metaData.title,
                coverArt: coverArt
              };
            }
          } catch (err) {
            return null;
          }
          return null;
        });

        const batchResults = await Promise.all(promises);
        const validResults = batchResults.filter(Boolean);

        if (validResults.length > 0) {
          freshResults = [...freshResults, ...validResults];
        }
      }

      if (mountedRef.current && freshResults.length > 0) {
        setLiveStations(freshResults);
      }
      if (mountedRef.current) setIsLoading(false);
    };

    fetchLiveData();
    const intervalId = setInterval(() => { fetchLiveData(); }, 90000); 

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [stations, API_URL]); 

  if (!isLoading && liveStations.length === 0) return null;

  return (
    <div className="w-full py-6 overflow-hidden animate-fade-in">
      
      <div className="flex items-end justify-between px-6 mb-8 border-t border-white/5 pt-12">
        <h2 className="text-xl md:text-4xl font-black tracking-tighter text-white italic flex items-center gap-3">
          <Radio className="text-[#ccff00]" size={28} /> ΤΩΡΑ ΠΑΙΖΟΥΝ
          {isLoading && <Loader2 size={16} className="text-[#ccff00] animate-spin ml-2" />}
        </h2>
      </div>

      <div className="flex overflow-x-auto gap-4 px-6 pb-6 pt-2 custom-scrollbar snap-x snap-mandatory">
        {liveStations.map((item, index) => {
          const hasCustomCover = item.coverArt !== item.logo;

          return (
            <div 
              key={`${item._id}-${index}`}
              onClick={() => navigate(`/station/${item.slug || item._id || item.id}`)}
              className="relative w-56 h-56 md:w-64 md:h-64 rounded-2xl overflow-hidden shrink-0 group snap-start bg-zinc-900 cursor-pointer transition-all duration-500 border border-[#0055ff]/40 shadow-[0_0_15px_rgba(0,85,255,0.15)] hover:border-[#ccff00] hover:shadow-[0_0_25px_rgba(204,255,0,0.3)] hover:-translate-y-1"
            >
              
              <img 
                src={item.coverArt} 
                alt={item.nowPlaying} 
                className="absolute inset-0 w-full h-full object-cover bg-white transition-transform duration-700 group-hover:scale-105" 
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent group-hover:bg-black/40 transition-colors duration-300"></div>
              
              {/* Εικονίδιο πάνω δεξιά (Μπλε που γίνεται Λαχανί) */}
              <div className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 z-20 bg-black/50 backdrop-blur-md border border-[#0055ff]/50 text-[#0099ff] group-hover:border-[#ccff00] group-hover:text-[#ccff00] shadow-lg">
                 <AudioLines size={18} className="animate-pulse" />
              </div>

              {hasCustomCover && (
                <div className="absolute top-4 left-4 z-10 pointer-events-none">
                  <div className="bg-white p-1 rounded-xl shadow-lg w-12 h-12 flex items-center justify-center border border-black/10 overflow-hidden">
                    <img src={item.logo} alt={item.name} className="w-full h-full object-contain" />
                  </div>
                </div>
              )}

              {/* Πληροφορίες Κάτω */}
              <div className="absolute bottom-4 left-4 right-4 flex flex-col items-start z-10 pointer-events-none">
                <div className="bg-[#ccff00] text-black text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm shadow-md mb-2">
                  LIVE NOW
                </div>
                <h3 className="text-white/95 font-medium text-sm md:text-[15px] leading-snug drop-shadow-md line-clamp-2">
                  {item.nowPlaying}
                </h3>
              </div>

              {/* Γραμμή προόδου στο κάτω μέρος (Μπλε που γίνεται Λαχανί) */}
              <div className="absolute bottom-0 left-0 h-1.5 w-[75%] rounded-r-full transition-all duration-500 ease-in-out z-10 bg-gradient-to-r from-[#0055ff] to-[#0099ff] shadow-[0_0_10px_#0099ff] group-hover:w-full group-hover:from-[#ccff00] group-hover:to-[#a3cc00] group-hover:shadow-[0_0_10px_#ccff00]"></div>
            </div>
          );
        })}
        
        {/* Loading Skeletons */}
        {isLoading && Array.from({ length: 4 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="w-56 md:w-64 shrink-0 snap-start flex flex-col">
            <div className="relative aspect-square w-full rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-900 border border-white/5 animate-pulse"></div>
            <div className="mt-3 h-5 bg-zinc-800 rounded w-3/4 animate-pulse"></div>
            <div className="mt-2 h-4 bg-zinc-800 rounded w-1/2 animate-pulse"></div>
          </div>
        ))}

      </div>
    </div>
  );
}
