import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {PRIMARY_CATEGORY_GROUPS} from '../utils/stationCategories';
import {getAvailableRegionLinks} from '../utils/stationRegions';
import { Compass, LayoutDashboard, LayoutGrid, FileText, Users, Radio, Heart, X, Mail, Disc3, BellRing, Megaphone, Crown, SlidersHorizontal, MapPin, Calendar, Rocket, Target, Lock, Activity, MapPinned, PanelLeftClose, PanelLeftOpen, Image, Newspaper, Navigation, ListMusic, History, Sparkles, Grid2X2, Trophy, ChevronDown } from 'lucide-react';

function SidebarItem({ icon, label, to, state, currentPath, onClick, className = "", isCollapsed }) {
  const active = currentPath === to || decodeURIComponent(currentPath) === to;
  
  return (
    <Link 
      to={to} 
      state={state}
      onClick={onClick}
      title={isCollapsed ? label : ""} 
      className={`ir-nav-item ${active ? 'ir-nav-item--active' : ''} relative flex items-center rounded-xl cursor-pointer transition-all duration-300 overflow-hidden ${
        active ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
      } ${isCollapsed ? 'lg:justify-center lg:px-0 lg:py-3 px-4 py-3' : 'px-4 py-3 gap-4'} ${className}`}
    >
      <div className="shrink-0 flex items-center justify-center relative z-10">
        {icon}
      </div>
      
      <span 
        className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isCollapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-[200px] opacity-100'
        } ${isCollapsed ? 'ml-4 lg:ml-0' : ''}`}
      >
        {label}
      </span>
    </Link>
  );
}

export default function Sidebar({ 
  isMobileMenuOpen, setIsMobileMenuOpen, currentUser, stations
}) {
  const location = useLocation();
  useEffect(()=>{setIsMobileMenuOpen(false);},[location.pathname,location.search]);
  useEffect(()=>{
    if(!isMobileMenuOpen)return;
    const old=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const escape=e=>{if(e.key==='Escape'){setIsMobileMenuOpen(false);document.querySelector('[aria-label="Άνοιγμα μενού πλοήγησης"]')?.focus();}};
    document.addEventListener('keydown',escape);
    return ()=>{document.body.style.overflow=old;document.removeEventListener('keydown',escape);};
  },[isMobileMenuOpen,setIsMobileMenuOpen]);
  const navigate = useNavigate();
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('iradios_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    localStorage.setItem('iradios_sidebar_collapsed', String(newVal));
  };

  const regionLinks = useMemo(() => getAvailableRegionLinks(Array.isArray(stations) ? stations : []), [stations]);

  const [categoriesOpen, setCategoriesOpen] = useState(() => location.pathname.startsWith('/genre/'));
  const [regionsOpen, setRegionsOpen] = useState(() => location.pathname.startsWith('/region/'));

  useEffect(() => {
    if (location.pathname.startsWith('/genre/')) setCategoriesOpen(true);
    if (location.pathname.startsWith('/region/')) setRegionsOpen(true);
  }, [location.pathname]);

  const toggleSubmenu = section => {
    // A collapsed desktop sidebar should expand before revealing its submenu.
    if (isCollapsed) {
      setIsCollapsed(false);
      localStorage.setItem('iradios_sidebar_collapsed', 'false');
    }
    if (section === 'categories') setCategoriesOpen(open => !open);
    else setRegionsOpen(open => !open);
  };

  const goToHomeStart = () => {
    setIsMobileMenuOpen(false);
    document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAdmin = currentUser?.role === 'admin';
  const isBroadcaster = currentUser?.role === 'broadcaster';
  const isProducer = currentUser?.role === 'producer';
  const isAgency = currentUser?.role === 'agency'; 
  
  const hasAdControl = currentUser?.broadcasterProfile?.features?.adControl;
  const hasDSP = currentUser?.broadcasterProfile?.features?.dspEngine;
  const isFullPremium = currentUser?.broadcasterProfile?.tier === 'premium';
  const isListenerPremium = currentUser?.isPremium;
  
  const homeRoute = isAgency ? '/agency/dashboard' : (isAdmin || isBroadcaster || isProducer) ? '/backoffice' : '/';

  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    fetch(`/version.json?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.version) setAppVersion(data.version);
      })
      .catch(() => setAppVersion('1.0.0'));
  }, []);

  return (
    <>
      <style>
        {`
          @keyframes eq-bar {
            0% { height: 4px; }
            50% { height: 18px; }
            100% { height: 4px; }
          }
          .eq-bar-1 { animation: eq-bar 0.6s infinite ease-in-out alternate; }
          .eq-bar-2 { animation: eq-bar 0.9s infinite ease-in-out alternate 0.2s; }
          .eq-bar-3 { animation: eq-bar 0.7s infinite ease-in-out alternate 0.4s; }
          .eq-bar-4 { animation: eq-bar 0.5s infinite ease-in-out alternate 0.1s; }
          .eq-bar-5 { animation: eq-bar 0.8s infinite ease-in-out alternate 0.3s; }
        `}
      </style>

      {isMobileMenuOpen&&<button type="button" aria-label="Κλείσιμο μενού" onClick={()=>setIsMobileMenuOpen(false)}
        className="fixed inset-0 z-[99] bg-black/70 backdrop-blur-[3px] lg:hidden" />}
      <aside aria-label="Κύρια πλοήγηση" className={`ir-app-sidebar fixed inset-y-0 left-0 z-[100] lg:sticky lg:top-0 lg:h-screen shrink-0 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isMobileMenuOpen ? 'translate-x-0 visible' : '-translate-x-full invisible lg:visible lg:translate-x-0'
      } ${isCollapsed ? 'lg:w-[82px] w-[min(86vw,280px)]' : 'w-[min(86vw,280px)] lg:w-[252px]'}`}>
        
        <div className="flex flex-col h-full">
          
          {/* LOGO & TOGGLE SECTION */}
          <div className={`px-6 pt-6 mb-6 flex border-b border-white/5 pb-6 shrink-0 transition-all duration-300 ${
            isCollapsed ? 'lg:flex-col lg:items-center lg:gap-5 items-center justify-between' : 'items-center justify-between'
          }`}>
            
            <Link to={homeRoute} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2.5 shrink-0 group overflow-hidden">
              <div className="flex items-end gap-[3px] h-[22px] shrink-0">
                <div className="w-[4px] bg-[#ccff00] rounded-full eq-bar-1" />
                <div className="w-[4px] bg-white rounded-full eq-bar-2" />
                <div className="w-[4px] bg-[#ccff00] rounded-full eq-bar-3" />
                <div className="w-[4px] bg-white rounded-full eq-bar-4" />
                <div className="w-[4px] bg-[#ccff00] rounded-full eq-bar-5" />
              </div>
              <span className={`flex min-w-0 flex-col justify-center transition-all duration-300 ${isCollapsed?'lg:max-w-0 lg:opacity-0':'opacity-100'}`}>
                <span className="whitespace-nowrap text-lg font-black tracking-tight text-white">iRadios<span className="text-[#ccff00]">GR</span></span>
                <span className="whitespace-nowrap text-[9px] font-medium text-zinc-500">Ελληνικό Ραδιόφωνο · Premium</span>
              </span>
            </Link>

            <button 
              type="button"
              aria-label={isCollapsed ? 'Επέκταση μενού' : 'Σύμπτυξη μενού'}
              onClick={toggleCollapse} 
              className="hidden lg:flex text-zinc-500 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5 shrink-0"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            <button type="button" aria-label="Κλείσιμο μενού" onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors shrink-0">
              <X size={24} />
            </button>
          </div>
          
          {/* 📜 SCROLLABLE AREA */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar flex flex-col justify-between pb-28 lg:pb-24">
            
            <nav className={`space-y-1 transition-all duration-300 ${isCollapsed ? 'lg:px-3 px-4' : 'px-4'}`}>
              
              {(isAdmin || isBroadcaster || isProducer) && (
                <SidebarItem isCollapsed={isCollapsed} to="/backoffice"
                  currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)}
                  icon={<LayoutDashboard size={20} className="text-[#ccff00]" />}
                  label="iRadios Backoffice" className="bg-[#ccff00]/10 text-[#ccff00]" />
              )}

              {/* 🚀 TOP MENU (Panel) */}
              {(isBroadcaster || isProducer || isAgency) ? ( 
                <>
                  <div className={`text-[10px] font-black text-[#ccff00] uppercase tracking-widest mb-4 mt-2 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Το panel σου</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-4" />}
                  
                  <SidebarItem 
                    to={isAgency ? "/agency/dashboard" : "/studio"} 
                    currentPath={location.pathname} 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    icon={<LayoutDashboard size={20} />} 
                    label={isAgency ? "Agency Dashboard" : (isProducer ? "Το Dashboard μου" : "Broadcaster Studio")} 
                    className="bg-[#ccff00]/10 text-[#ccff00] hover:bg-[#ccff00]/20 hover:text-[#ccff00] font-black" 
                    isCollapsed={isCollapsed}
                  />
                  
                  {!isProducer && (
                    <>
                      <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 mt-8 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Ανακαλυψη</div>
                      {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-6" />}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 mt-2 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Ανακαλυψη</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-4" />}
                </>
              )}

              
              
              {!isProducer && (
                <>
                  <SidebarItem isCollapsed={isCollapsed} to="/" state={{ forceHome: true }} currentPath={location.pathname+location.search} onClick={goToHomeStart} icon={<Compass size={20} />} label="Αρχική" />
                   <SidebarItem isCollapsed={isCollapsed} to="/newsfeed" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Newspaper size={20} />} label="Ειδήσεις" />
                  <button
                    type="button"
                    aria-expanded={categoriesOpen}
                    aria-controls="ir-sidebar-categories"
                    title={isCollapsed ? 'Κατηγορίες' : undefined}
                    onClick={() => toggleSubmenu('categories')}
                    className={`ir-nav-item flex w-full overflow-hidden items-center rounded-xl text-left transition-all duration-300 ${location.pathname.startsWith('/genre/') ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'} ${isCollapsed ? 'lg:justify-center lg:gap-0 lg:px-0 lg:py-3 px-4 py-3 gap-4' : 'px-4 py-3 gap-4'}`}
                  >
                    <Grid2X2 size={20} className="shrink-0"/>
                    <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'lg:max-w-0 lg:opacity-0' : ''}`}>Κατηγορίες</span>
                    <ChevronDown size={16} aria-hidden="true" className={`ml-auto shrink-0 transition-transform duration-200 ${categoriesOpen ? 'rotate-180' : ''} ${isCollapsed ? 'lg:hidden' : ''}`}/>
                  </button>
                  {categoriesOpen && (
                    <div id="ir-sidebar-categories" className={`mb-4 ml-6 space-y-4 border-l border-white/10 pl-3 pr-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
                      {PRIMARY_CATEGORY_GROUPS.map(group => (
                        <div key={group.label}>
                          <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{group.label}</p>
                          <div className="space-y-0.5">
                            {group.items.map(item => (
                              <Link key={item} to={`/genre/${encodeURIComponent(item)}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block rounded-xl px-3 py-2.5 text-[13px] font-medium leading-snug transition-colors hover:bg-white/5 hover:text-[#ccff00] ${decodeURIComponent(location.pathname) === `/genre/${item}` ? 'bg-white/5 text-[#ccff00]' : 'text-zinc-400'}`}>
                                {item}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=top" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<Trophy size={20} />} label="Top σταθμοί" />
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=for-you" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<Sparkles size={20} />} label="Προτάσεις για σένα" />
                  <SidebarItem isCollapsed={isCollapsed} to="/map" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<MapPinned size={20} />} label="Δες στον Χάρτη" />
                </>
              )}

              {/* ADMIN SECTION */}
              {isAdmin && (
                <>
                  <div className={`text-[10px] font-black text-[#ccff00] uppercase tracking-widest mb-2 mt-6 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Admin Panel</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-[#ccff00]/30 mx-auto my-6" />}
                  <SidebarItem isCollapsed={isCollapsed} to="/admin" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Activity size={20} className="text-[#ccff00]" />} label="Dashboard" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/radios" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<LayoutGrid size={20} />} label="Ραδιόφωνα iRadios" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/radioset" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Radio size={20} className="text-[#ccff00]" />} label="Radio Set" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/home-slides" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Image size={20} className="text-[#ccff00]" />} label="Slides & Καμπάνιες" />
                   <SidebarItem isCollapsed={isCollapsed} to="/admin/newsfeed" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Newspaper size={20} className="text-[#ccff00]" />} label="Newsfeed RSS" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/banners" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Megaphone size={20} className="text-[#ccff00]" />} label="Banners Ακροατών" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/boost" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Rocket size={20} className="text-[#ccff00]" />} label="Έλεγχος Boost" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/users" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Users size={20} />} label="Χρήστες iRadios" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/ads" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Megaphone size={20} />} label="Διαφημίσεις (Network)" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/ad-control" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Target size={20} />} label="Local Ads (Broadcasters)" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/push" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<BellRing size={20} />} label="Αποστολή Ειδοποίησης" />
                  <SidebarItem isCollapsed={isCollapsed} to="/dsp" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<SlidersHorizontal size={20} />} label="Ρυθμίσεις ήχου" />
                  <SidebarItem isCollapsed={isCollapsed} to="/my-schedules" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Calendar size={20} />} label="Πρόγραμμα Σταθμών" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/billing" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<FileText size={20} className="text-orange-400" />} label="Πληρωμές & Τιμολόγια" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/emails" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Mail size={20} className="text-[#ccff00]" />} label="Αποστολή Email" />
                </>
              )}
              
              {/* BROADCASTER & PRODUCER SECTION */}
              {(isBroadcaster || isProducer) && (
                <div className="mt-6">
                  <div className={`text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>
                    {isProducer ? 'Producer Menu' : 'Broadcaster Menu'}
                  </div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-blue-500/30 mx-auto my-6" />}
                  
                  {isBroadcaster && (
                    <SidebarItem isCollapsed={isCollapsed} to="/my-radios" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Radio size={20} />} label="Τα iRadios μου" />
                  )}
                  
                  <SidebarItem 
                    isCollapsed={isCollapsed}
                    to="/my-schedules" 
                    currentPath={location.pathname} 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    icon={<Calendar size={20} />} 
                    label={isProducer ? "Πρόγραμμα Σταθμού" : "Πρόγραμμα iRadios"} 
                  />
                  
                  {isBroadcaster && (
                    <>
                      <div className="relative group mt-2 mb-2">
                        <SidebarItem 
                          isCollapsed={isCollapsed}
                          to="/boost-my-station" 
                          currentPath={location.pathname} 
                          onClick={() => setIsMobileMenuOpen(false)} 
                          icon={<Rocket size={20} className="text-emerald-400 animate-pulse" />} 
                          label="Boost My Radio" 
                          className="border border-emerald-500/10 bg-emerald-500/5 hover:bg-emerald-500/10"
                        />
                        {!isCollapsed && (
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-emerald-500 text-[8px] font-black px-1.5 py-0.5 rounded text-black uppercase tracking-tighter">HOT</span>
                        )}
                      </div>

                      {hasAdControl && (
                        <SidebarItem isCollapsed={isCollapsed} to="/ad-control" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Target size={20} className="text-[#ccff00]" />} label="My Ad Control" />
                      )}

                      {hasDSP && (
                        <SidebarItem isCollapsed={isCollapsed} to="/dsp" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<SlidersHorizontal size={20} />} label="Οι ρυθμίσεις ήχου μου" />
                      )}
                      
                      {!isFullPremium && (
                        <Link 
                          to="/upgrade-station" 
                          title={isCollapsed ? "Upgrade to Pro" : ""}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center rounded-xl bg-black border border-white/5 transition-all duration-300 mt-2 overflow-hidden text-zinc-600 hover:text-zinc-400 group ${isCollapsed ? 'lg:justify-center lg:px-0 lg:py-3 px-4 py-3' : 'justify-between px-4 py-3'}`}
                        >
                          <div className={`flex items-center ${isCollapsed ? 'lg:gap-0' : 'gap-4'}`}>
                            <Lock size={18} className="opacity-50 shrink-0" />
                            <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-[200px] opacity-100'}`}>Pro Features</span>
                          </div>
                          {!isCollapsed && (
                            <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full group-hover:bg-[#ccff00]/10 group-hover:text-[#ccff00] transition-colors">UPGRADE</span>
                          )}
                        </Link>
                      )}
                    </>
                  )}
                </div>
              )}
              
              {/* LISTENERS SECTION */}
              {!isProducer && !isAgency && ( 
                <>
                  <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 mt-10 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Βιβλιοθηκη</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-6" />}
                  
                  <SidebarItem isCollapsed={isCollapsed} to="/favorites" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Heart size={20} />} label="Αγαπημένα" />
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=recent" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<History size={20} />} label="Πρόσφατα" />
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=playlist" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<ListMusic size={20} />} label="Playlist σταθμού" />

                  {(!currentUser || !isListenerPremium) && (
                    <div className="mt-2 mb-2">
                      <SidebarItem 
                        isCollapsed={isCollapsed}
                        to="/premium" 
                        currentPath={location.pathname} 
                        onClick={() => setIsMobileMenuOpen(false)} 
                        icon={<Crown size={20} className="text-[#ccff00]" />} 
                        label="Γίνε Premium" 
                      />
                    </div>
                  )}

                  {/* City-first shortcuts and real radio regions, populated from available stations. */}
                  <button
                    type="button"
                    aria-expanded={regionsOpen}
                    aria-controls="ir-sidebar-regions"
                    title={isCollapsed ? 'Ανά περιοχή' : undefined}
                    onClick={() => toggleSubmenu('regions')}
                    className={`ir-nav-item mt-5 flex w-full overflow-hidden items-center rounded-xl text-left transition-all duration-300 ${location.pathname.startsWith('/region/') ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'} ${isCollapsed ? 'lg:justify-center lg:gap-0 lg:px-0 lg:py-3 px-4 py-3 gap-4' : 'px-4 py-3 gap-4'}`}
                  >
                    <MapPin size={20} className="shrink-0"/>
                    <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'lg:max-w-0 lg:opacity-0' : ''}`}>Ανά περιοχή</span>
                    <ChevronDown size={16} aria-hidden="true" className={`ml-auto shrink-0 transition-transform duration-200 ${regionsOpen ? 'rotate-180' : ''} ${isCollapsed ? 'lg:hidden' : ''}`}/>
                  </button>
                  {regionsOpen && (
                    <div id="ir-sidebar-regions" className={`mb-4 ml-6 space-y-0.5 border-l border-white/10 pl-3 pr-1 ${isCollapsed ? 'lg:hidden' : ''}`}>
                      {regionLinks.map(name => (
                        <Link key={name} to={`/region/${encodeURIComponent(name)}`}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`block rounded-xl px-3 py-2.5 text-[13px] font-medium leading-snug transition-colors hover:bg-white/5 hover:text-[#ccff00] ${decodeURIComponent(location.pathname) === `/region/${name}` ? 'bg-white/5 text-[#ccff00]' : 'text-zinc-400'}`}>
                          {name}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* 📸 PRESS KIT SECTION - Ενσωματωμένο σωστά στο NAV */}
              {(isAdmin || isAgency || isBroadcaster) && (
                <>
                  <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 mt-10 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Υλικο Συνεργατων</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-6" />}
                  
                  <SidebarItem 
                    isCollapsed={isCollapsed} 
                    to="/press-kit" 
                    currentPath={location.pathname} 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    icon={<Image size={20} className="text-zinc-400 group-hover:text-white" />} 
                    label="Press Kit" 
                  />
                </>
              )}
            </nav>
            
            {/* 📥 BOTTOM SECTION (Footer & CTA) */}
            <div className="mt-8">
              {/* Advertising CTA belongs with the Premium card, not the discovery links. */}
              <div className={`mb-4 px-4 ${isCollapsed ? 'lg:hidden' : ''}`}>
                <div className="relative overflow-hidden rounded-3xl border border-purple-400/25 bg-gradient-to-br from-[#302041] via-[#20192d] to-[#0b1011] p-4 shadow-[0_0_28px_rgba(168,85,247,0.08)]">
                  <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-purple-500/15 blur-[35px]"/>
                  <div className="relative z-10">
                    <h4 className="flex items-center gap-2 text-sm font-black text-white">
                      <Target size={18} className="text-purple-300"/> Διαφήμιση στο iRadiosGR
                      <span className="ml-auto rounded-md bg-purple-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white">NEW</span>
                    </h4>
                    <p className="mt-3 text-[11px] leading-relaxed text-zinc-300">Προώθησε την επιχείρησή σου στο δίκτυο του iRadiosGR.</p>
                    <Link to="/go-ads" onClick={() => setIsMobileMenuOpen(false)}
                      className="mt-4 flex min-h-10 items-center justify-center gap-2 rounded-full bg-purple-500 px-3 text-xs font-black text-white transition-colors hover:bg-purple-400">
                      {isAgency ? 'Δες τιμές διαφήμισης' : 'Δες τις επιλογές διαφήμισης'} <Rocket size={15}/>
                    </Link>
                  </div>
                </div>
              </div>
              {isCollapsed && (
                <Link to="/go-ads" title="Διαφήμιση" aria-label="Διαφήμιση"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mx-3 mb-4 hidden justify-center rounded-xl py-3 text-purple-300 hover:bg-purple-500/10 lg:flex">
                  <Target size={20}/>
                </Link>
              )}
              {!['admin', 'broadcaster', 'producer', 'agency'].includes(currentUser?.role) && ( 
                <div className={`px-4 shrink-0 transition-all duration-300 ${isCollapsed ? 'lg:opacity-0 lg:h-0 lg:overflow-hidden' : 'opacity-100 h-auto'}`}>
                  <div className="relative overflow-hidden rounded-3xl border border-[#ccff00]/25 bg-gradient-to-br from-[#323a19]/95 via-[#1c2417] to-[#0b1011] p-4 shadow-[0_0_28px_rgba(204,255,0,0.07)]">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#ccff00]/20 blur-[35px]"/>
                    <div className="relative z-10">
                      <h4 className="flex items-center gap-2 text-sm font-black text-white"><Crown size={18} className="text-[#ccff00]"/> iRadiosGR Premium</h4>
                      {isListenerPremium?(
                        <p className="mt-3 text-xs leading-relaxed text-zinc-200">Απολαμβάνεις ήδη τα Premium προνόμιά σου.</p>
                      ):(
                        <>
                          <p className="mt-3 text-[11px] leading-relaxed text-zinc-300">Premium λειτουργίες και ακρόαση χωρίς διαφημίσεις του iRadios.</p>
                          <Link to="/premium" onClick={()=>setIsMobileMenuOpen(false)}
                            className="mt-4 flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#ccff00] px-3 text-xs font-black text-black transition-colors hover:bg-[#e4ff83]">
                            Αναβάθμιση σε Premium <Rocket size={15}/>
                          </Link>
                        </>
                      )}
                      <Link to="/broadcast" onClick={()=>setIsMobileMenuOpen(false)}
                        className="mt-3 block text-center text-[10px] font-semibold text-zinc-300 underline decoration-white/20 underline-offset-4 hover:text-[#ccff00]">Έχεις ραδιοφωνικό σταθμό;</Link>
                    </div>
                  </div>
                </div>
              )}

              {/* ⚖️ ΝΟΜΙΚΟ FOOTER */}
              <div className={`px-6 pt-6 mt-4 border-t border-white/5 shrink-0 flex flex-col gap-3 transition-all duration-300 ${isCollapsed ? 'lg:opacity-0 lg:h-0 lg:overflow-hidden lg:pt-0 lg:mt-0 lg:border-0' : 'opacity-100 h-auto'}`}>
                <Link to="/terms" onClick={() => setIsMobileMenuOpen(false)} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest font-black transition-colors">Οροι Χρησης</Link>
                <Link to="/privacy" onClick={() => setIsMobileMenuOpen(false)} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest font-black transition-colors">Πολιτικη Απορρητου</Link>
                
                {(isBroadcaster || isAdmin) && (
                  <Link to="/broadcaster-terms" onClick={() => setIsMobileMenuOpen(false)} className="text-[10px] text-blue-500/70 hover:text-blue-400 uppercase tracking-widest font-black transition-colors">Συμφωνητικο Broadcasters</Link>
                )}
                
                {(isAgency || isAdmin) && (
                  <Link to="/agency-terms" className="text-[10px] text-purple-500/70 hover:text-purple-400 uppercase tracking-widest font-black transition-colors">Συμφωνητικο Διαφημιστων</Link>
                )}
                
                <div className="flex flex-col gap-1 mt-1">
                  <div className="text-[9px] text-zinc-700 font-bold">&copy; {new Date().getFullYear()}<a href="https://iluma.gr" target="_blank" rel="noreferrer"> ILUMA Digital Agency</a></div>
                  
                  {appVersion && (
                    <div className="text-[10px] text-zinc-600 font-black tracking-widest">
                      iRadios App Version: {appVersion}
                    </div>
                  )}
                  
                  <div className="text-[11px] text-zinc-600 font-black tracking-widest">
                      <a 
                        href="https://backstage.iluma.gr" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[10px] text-white/70 hover:text-blue-400 tracking-widest font-black transition-colors"
                      >
                        Αίτημα Τεχνικής Υποστήριξης
                      </a>
                    </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </aside>
    </>
  );
}
