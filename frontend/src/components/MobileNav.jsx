import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Heart, User, Radio, Newspaper } from 'lucide-react';

// Listener dock with Newsfeed immediately after Home.
// Discovery still opens the existing modal; do not introduce a new route.
export default function MobileNav({ currentUser, onOpenDiscovery }) {
  const { pathname } = useLocation();
  const profilePath = currentUser ? '/profile' : '/login';
  const isProfile = pathname === '/profile' || pathname === '/login';

  const navItemClass = active =>
    `group flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors ${active ? 'text-[#ccff00]' : 'text-zinc-400 hover:text-white'}`;

  return (
    <nav
      aria-label="Βασική πλοήγηση"
      className="ir-app-mobile-nav ir-mobile-bottom-dock fixed bottom-0 left-0 right-0 z-[100] flex h-[76px] items-center justify-around gap-1 px-2 lg:hidden"
    >
      <Link to="/" className={navItemClass(pathname === '/')} aria-current={pathname === '/' ? 'page' : undefined}>
        <Home size={21} fill={pathname === '/' ? 'currentColor' : 'none'} aria-hidden="true" />
        <span>Αρχική</span>
      </Link>
      <Link to="/newsfeed" className={navItemClass(pathname === '/newsfeed')} aria-current={pathname === '/newsfeed' ? 'page' : undefined}>
        <Newspaper size={21} aria-hidden="true" />
        <span>Ειδήσεις</span>
      </Link>
      <button
        type="button"
        onClick={onOpenDiscovery}
        className={navItemClass(false)}
        aria-label="Εξερεύνηση ραδιοφωνικών σταθμών"
      >
        <Radio size={21} aria-hidden="true" />
        <span>Σταθμοί</span>
      </button>
      <Link
        to="/favorites"
        className={navItemClass(pathname === '/favorites')}
        aria-current={pathname === '/favorites' ? 'page' : undefined}
      >
        <Heart size={21} fill={pathname === '/favorites' ? 'currentColor' : 'none'} aria-hidden="true" />
        <span>Αγαπημένα</span>
      </Link>
      <Link to={profilePath} className={navItemClass(isProfile)} aria-current={isProfile ? 'page' : undefined}>
        <span className="relative">
          <User size={21} aria-hidden="true" />
          {currentUser?.isPremium && (
            <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-[#ccff00]" aria-label="Premium" />
          )}
        </span>
        <span>Προφίλ</span>
      </Link>
    </nav>
  );
}
