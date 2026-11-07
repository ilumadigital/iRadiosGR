import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Play, Pause, Heart, Radio } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import CircularVU from '../components/CircularVU'; // ΝΕΟ: Εισαγωγή του Visualizer

export default function Favorites({ stations, currentUser, currentStation, setCurrentStation, isPlaying, onPlayPause, analyser }) {
  const navigate = useNavigate();

  // Φιλτράρουμε τους σταθμούς
  const favoriteStations = stations.filter(station =>
    currentUser?.favorites?.includes(station._id || station.id)
  );

  const formatGenre = (text) => text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  return (
    <div className="w-full px-4 md:px-8 py-6 md:py-10 space-y-10 md:space-y-16">

      {/* ΝΕΟ: SEO HELMET */}
      <Helmet>
        <title>Τα Αγαπημένα μου | iRadios</title>
        <meta name="description" content="Η προσωπική σας λίστα με τους αγαπημένους web ραδιοφωνικούς σταθμούς στο iRadios." />
      </Helmet>

      <section>
        {/* HEADER */}
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div>
            <h2 className="text-xl md:text-4xl font-black tracking-tighter text-white italic flex items-center gap-3">
              <Heart className="text-[#ccff00] fill-[#ccff00]" size={28} /> My Favorites
            </h2>
            <p className="text-[11px] md:text-sm text-zinc-500 mt-1 font-bold tracking-widest">
              Οι σταθμοί που αγαπάτε
            </p>
          </div>
        </div>

        {favoriteStations.length > 0 ? (
          /* GRID: Ίδιο ακριβώς με το Home.jsx */
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-6">
            {favoriteStations.map((station) => {
              const isCurrent = currentStation && (currentStation._id === station._id);
              const isCurrentlyPlaying = isCurrent && isPlaying;

              const handlePlayBtnClick = (e) => {
                e.preventDefault(); // Αποτρέπει το Link να ανοίξει αν πατηθεί το Play
                e.stopPropagation();
                if (isCurrent) {
                  onPlayPause();
                } else {
                  setCurrentStation(station);
                }
              };

              return (
                <div key={station._id} className="group flex flex-col">
                  {/* ΣΗΜΑΝΤΙΚΟ: Τυλίγουμε με Link για SEO & UX */}
                  <div
                    key={station._id}
                    className="group cursor-pointer flex flex-col relative"
                    onClick={() => {
                      // Αν ο σταθμός παίζει ήδη, πήγαινε στο profile
                      if (currentStation?._id === station._id && isPlaying) {
                        navigate(`/station/${station.slug || station._id}`);
                      } else {
                        // Αν δεν παίζει, ξεκίνα το play
                        setCurrentStation(station);
                      }
                    }}
                  >
                    <div className="relative aspect-square w-full rounded-2xl md:rounded-3xl overflow-hidden bg-white shadow-lg border border-[#000000] transition-all duration-500 group-hover:-translate-y-1 group-hover:border-[#ccff0088]">
                      <img
                        src={station.logo}
                        alt={station.name}
                        className="w-full h-full object-contain bg-white transition-transform duration-700 group-hover:scale-105"
                      />

                      {/* Overlay: Πάντα ορατό στο mobile όταν παίζει */}
                      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>

                      {/* CONTAINER ΓΙΑ VISUALIZER & PLAY BUTTON */}
                      <div className={`
      absolute transition-all duration-500 z-10
      ${isCurrentlyPlaying
                          ? 'inset-0 flex items-center justify-center md:inset-auto md:bottom-4 md:right-4 md:w-12 md:h-12'
                          : 'bottom-2 right-2 md:bottom-4 md:right-4 w-9 h-9 md:w-12 md:h-12 opacity-0 group-hover:opacity-100'
                        }
    `}>

                        {/* Το Visualizer στο κέντρο για Mobile / στη γωνία για Desktop */}
                        <CircularVU analyser={analyser} isPlaying={isCurrentlyPlaying} />

                        <div
                          className={`
          relative z-20 bg-[#ccff00] rounded-full flex items-center justify-center shadow-xl 
          transition-all text-black
          ${isCurrentlyPlaying ? 'w-14 h-14 md:w-full md:h-full' : 'w-full h-full'}
        `}
                        >
                          {isCurrentlyPlaying ? (
                            <Pause size={20} className="md:w-5 md:h-5" fill="currentColor" />
                          ) : (
                            <Play size={20} className="md:w-5 md:h-5 ml-0.5" fill="currentColor" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Info Section - Και εδώ το κλικ ακολουθεί την ίδια λογική */}
                    <div className="mt-2 md:mt-4 px-1">
                      <h3 className={`font-bold text-[14px] md:text-[18px] truncate transition-colors ${isCurrentlyPlaying ? 'text-[#ccff00]' : 'text-white'}`}>
                        {station.name}
                      </h3>
                      <p className="text-[9px] md:text-[12px] text-zinc-500 font-black tracking-widest mt-0.5 uppercase">
                        {station.genre}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-32 text-center bg-zinc-900/20 border border-white/5 rounded-[40px] mt-10">
            <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-2xl relative">
              <Heart size={32} className="text-zinc-600" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2 italic tracking-tighter">Άδεια Λίστα</h3>
            <p className="text-zinc-500 text-sm font-medium max-w-sm mx-auto mb-10 leading-relaxed">
              Δεν έχετε προσθέσει αγαπημένα ακόμα. Πατήστε την καρδιά σε οποιονδήποτε σταθμό για να τον βλέπετε εδώ.
            </p>
            <Link to="/" className="bg-white text-black px-8 py-4 rounded-2xl font-black text-xs tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl">
              Ανακαλυψτε Σταθμους
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
