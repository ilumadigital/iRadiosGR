import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Search as SearchIcon, X, Menu, Bell, BellOff, Sun, Cloud, CloudRain, Snowflake } from 'lucide-react';

export default function TopBar({
  setIsMobileMenuOpen,
  searchTerm,
  setSearchTerm,
  showSearchResults,
  setShowSearchResults,
  filteredSearch,
  handleSearchResultClick,
  currentUser,
  weather,
  onLogout
}) {
  // --- NOTIFICATION STATUS LOGIC ---
  const [notifStatus, setNotifStatus] = useState("Notification" in window ? Notification.permission : 'default');

  useEffect(() => {
    if (!("Notification" in window)) return;
    const interval = setInterval(() => {
      if (Notification.permission !== notifStatus) {
        setNotifStatus(Notification.permission);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [notifStatus]);

  const handleNotificationClick = async (e) => {
    // Αν δεν έχουμε ρωτήσει ακόμα, ζητάμε άδεια επί τόπου αντί να αλλάξουμε σελίδα
    if (notifStatus === 'default' && "Notification" in window) {
      e.preventDefault();
      const permission = await Notification.requestPermission();
      setNotifStatus(permission);
    }
    // Αν είναι ήδη granted/denied, το Link θα συνεχίσει κανονικά προς το /profile
  };

  // --- CLOCK LOGIC ---
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  // Δυναμική επιλογή εικονιδίου
  const WeatherIcon = {
    Sun: Sun,
    Cloud: Cloud,
    CloudRain: CloudRain,
    Snowflake: Snowflake
  }[weather.icon];

  return (
    <>
      {/* 💡 CSS για το Equalizer Animation */}
      <style>
        {`
          @keyframes eq-bar {
            0% { height: 4px; }
            50% { height: 16px; }
            100% { height: 4px; }
          }
          .eq-bar-1 { animation: eq-bar 0.6s infinite ease-in-out alternate; }
          .eq-bar-2 { animation: eq-bar 0.9s infinite ease-in-out alternate 0.2s; }
          .eq-bar-3 { animation: eq-bar 0.7s infinite ease-in-out alternate 0.4s; }
          .eq-bar-4 { animation: eq-bar 0.5s infinite ease-in-out alternate 0.1s; }
          .eq-bar-5 { animation: eq-bar 0.8s infinite ease-in-out alternate 0.3s; }
        `}
      </style>

      <header className="h-[72px] sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 lg:px-8">
        
        {/* LEFT: MOBILE MENU & LOGO */}
        <div className="flex items-center gap-4">
          <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden text-white">
            <Menu size={24} />
          </button>

          <Link to="/" className="lg:hidden flex items-center gap-2 shrink-0 group">
            <div className="flex items-end gap-[3px] h-[20px]">
              <div className="w-[4px] bg-[#ccff00] rounded-full eq-bar-1" />
              <div className="w-[4px] bg-white rounded-full eq-bar-2" />
              <div className="w-[4px] bg-[#ccff00] rounded-full eq-bar-3" />
              <div className="w-[4px] bg-white rounded-full eq-bar-4" />
              <div className="w-[4px] bg-[#ccff00] rounded-full eq-bar-5" />
            </div>
            <img 
              src="/noicon-iradios-app-logo.png" 
              alt="iRadios" 
              className="h-[22px] w-auto object-contain mt-1 group-hover:opacity-80 transition-opacity" 
            />
          </Link>
        </div>
        
        {/* CENTER: SEARCH BAR */}
        <div className="relative w-full max-w-[180px] sm:max-w-md ml-4 lg:ml-0">
          <div className="relative group">
            <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#ccff00]" />
            <input 
              type="text" 
              placeholder="Αναζήτηση..." 
              value={searchTerm} 
              onFocus={() => setShowSearchResults(true)} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full bg-zinc-900/50 border border-white/5 h-10 sm:h-11 rounded-xl sm:rounded-2xl pl-12 pr-10 text-sm focus:outline-none focus:border-[#ccff00]/30 transition-all text-white" 
            />
            {searchTerm && (
              <X 
                size={16} 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 cursor-pointer hover:text-white" 
              />
            )}
          </div>

          {showSearchResults && searchTerm && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[300px] overflow-y-auto custom-scrollbar">
              {filteredSearch.map(s => (
                <div key={s._id} onClick={() => handleSearchResultClick(s._id)} className="flex items-center gap-4 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors">
                  <img src={s.logo} className="w-10 h-10 rounded-lg object-cover bg-white" alt="" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{s.name}</div>
                    <div className="text-[10px] text-zinc-500 font-bold tracking-wider">{s.genre}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: USER ACTIONS & NOTIFICATIONS */}
        <div className="hidden lg:flex items-center gap-4">
          
          {/* 🟢 WEATHER & CLOCK WIDGET */}
          <div className="flex items-center gap-5 pr-4">
            
            {/* Καιρός */}
            <div className="flex items-center gap-2.5">
              <WeatherIcon size={22} className="text-[#ccff00] drop-shadow-[0_0_8px_rgba(204,255,0,0.3)]" />
              <div className="flex flex-col justify-center">
                <span className="text-[13px] text-white font-medium leading-tight">{weather.city}</span>
                <span className="text-[11px] text-zinc-400 font-bold leading-tight">{weather.temp !== null ? `${weather.temp}°C` : '...'}</span>
              </div>
            </div>

            {/* Διαχωριστικό */}
            <div className="h-6 w-px bg-white/10"></div>

            {/* Ρολόι */}
            <div className="text-lg font-black text-white tracking-wider tabular-nums">
              {formattedTime}
            </div>

          </div>

          {currentUser ? (
            <div className="flex items-center gap-4 pl-4 border-l border-white/10">
              
              {/* NOTIFICATION INDICATOR */}
              <Link 
                to="/profile"
                onClick={handleNotificationClick}
                className="flex items-center justify-center p-2.5 rounded-xl bg-zinc-900/50 border border-white/5 shadow-inner hover:bg-white/5 transition-all group"
                title={notifStatus === 'granted' ? 'Ειδοποιήσεις Ενεργές (Ρυθμίσεις)' : 'Ειδοποιήσεις Ανενεργές (Ρυθμίσεις)'}
              >
                {notifStatus === 'granted' ? (
                  <Bell size={18} className="text-[#ccff00] drop-shadow-[0_0_8px_rgba(204,255,0,0.4)] animate-pulse-slow group-hover:scale-110 transition-transform" />
                ) : (
                  <BellOff size={18} className="text-zinc-600 group-hover:text-white transition-colors" />
                )}
              </Link>

              {/* USER INFO */}
              <Link to="/profile" className="flex flex-col items-end mr-2 group cursor-pointer">
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest leading-none mb-1 group-hover:text-zinc-400 transition-colors">
                  Το Προφιλ σου,
                </span>
                <span className="text-sm font-bold text-white leading-none group-hover:text-[#ccff00] transition-colors">
                  {currentUser?.fname || currentUser?.username || 'User'}
                </span>
              </Link>

              {/* LOGOUT */}
              <button 
                onClick={onLogout} 
                className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-colors bg-red-500/5 px-4 py-2 rounded-lg border border-red-500/10 hover:border-red-500/30"
              >
                LOGOUT
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="bg-[#ccff00] text-black text-xs font-black px-6 py-2.5 rounded-full hover:brightness-110 transition-all shadow-lg">Σύνδεση</Link>
              <Link to="/register" className="bg-white text-black text-xs font-black px-6 py-2.5 rounded-full hover:bg-zinc-200 transition-all">Εγγραφή</Link>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
