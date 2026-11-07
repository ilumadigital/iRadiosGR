import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home as HomeIcon, Heart, User as UserIcon, Crown, Compass } from 'lucide-react';

export default function MobileNav({ currentUser, onOpenDiscovery }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  // Έλεγχος αν ο χρήστης είναι free (ή επισκέπτης)
  const isFreeUser = !currentUser || !currentUser.isPremium;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-black/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around lg:hidden z-[100] px-2 pb-safe">
      
      {/* ΑΡΧΙΚΗ */}
      <Link to="/" className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${isActive('/') ? 'text-[#ccff00]' : 'text-zinc-500 hover:text-zinc-400'}`}>
        <HomeIcon size={22} fill={isActive('/') ? 'currentColor' : 'none'} />
        <span className="text-[9px] font-black uppercase tracking-wider">Dashboard</span>
      </Link>

      {/* 🚀 ΑΝΑΚΑΛΥΨΗ (DISCOVERY) - Έγινε Button */}
      <button 
        onClick={onOpenDiscovery} 
        className="flex flex-col items-center gap-1.5 w-16 transition-all text-zinc-500 hover:text-[#ccff00] active:scale-95"
      >
        <Compass size={22} />
        <span className="text-[9px] font-black uppercase tracking-wider">Ανακαλυψη</span>
      </button>

      {/* 👑 PREMIUM FLOATING BUTTON (ΜΟΝΟ ΓΙΑ FREE/GUESTS) */}
      {isFreeUser && (
        <Link to="/premium" className="relative flex flex-col items-center justify-center -mt-6 group w-16">
          <div className="absolute inset-0 bg-[#ccff00]/20 blur-xl rounded-full scale-150 animate-pulse"></div>
          <div className="relative w-14 h-14 bg-gradient-to-tr from-[#ccff00] to-yellow-400 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(204,255,0,0.3)] border-[4px] border-black transition-transform active:scale-95">
            <Crown size={24} fill="currentColor" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider text-[#ccff00] mt-1">Premium</span>
        </Link>
      )}

      {/* ΑΓΑΠΗΜΕΝΑ */}
      <Link to="/favorites" className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${isActive('/favorites') ? 'text-[#ccff00]' : 'text-zinc-500 hover:text-zinc-400'}`}>
        <Heart size={22} fill={isActive('/favorites') ? 'currentColor' : 'none'} />
        <span className="text-[9px] font-black uppercase tracking-wider">Αγαπημενα</span>
      </Link>

      {/* PROFILE / LOGIN */}
      <Link to={currentUser ? "/profile" : "/login"} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${(isActive('/profile') || isActive('/login')) ? 'text-[#ccff00]' : 'text-zinc-500 hover:text-zinc-400'}`}>
        <div className="relative">
          <UserIcon 
            size={22} 
            fill={(!isFreeUser || isActive('/profile') || isActive('/login')) ? 'currentColor' : 'none'} 
          />
          {!isFreeUser && (
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#ccff00] rounded-full border-2 border-black shadow-[0_0_10px_rgba(204,255,0,0.5)]"></div>
          )}
        </div>
        <span className="text-[9px] font-black uppercase tracking-wider truncate max-w-full px-1">
          {currentUser ? (currentUser.fname || 'Προφιλ') : 'Συνδεση'}
        </span>
      </Link>

    </nav>
  );
}
