import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {PRIMARY_CATEGORY_GROUPS} from '../utils/stationCategories';
import {CITY_SHORTCUTS, getAvailableRegionLinks} from '../utils/stationRegions';
import { Compass, LayoutDashboard, LayoutGrid, FileText, Users, Radio, Heart, X, Mail, Disc3, BellRing, Megaphone, Crown, SlidersHorizontal, MapPin, Calendar, Rocket, Target, Lock, Activity, MapPinned, PanelLeftClose, PanelLeftOpen, Image, Newspaper, Navigation, ListMusic, History, Sparkles, Grid2X2, Trophy, ChevronDown, House, RadioTower } from 'lucide-react';

function SidebarItem({ icon, label, to, state, currentPath, onClick, className = "", isCollapsed }) {
  const active = currentPath === to || decodeURIComponent(currentPath) === to;
  
  return (
    <Link 
      to={to} 
      state={state}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      aria-label={isCollapsed ? label : undefined} 
      className={`ir-nav-item ${active ? 'ir-nav-item--active' : ''} relative flex min-h-9 w-full items-center rounded-xl cursor-pointer transition-all duration-200 overflow-hidden ${
        active ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
      } ${isCollapsed ? 'lg:justify-center lg:px-0 px-3 py-2 gap-3' : 'px-3 py-2 gap-3'} ${className}`}
    >
      <div className="shrink-0 flex items-center justify-center relative z-10">
        {icon}
      </div>
      
      <span 
        className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isCollapsed ? 'lg:max-w-0 lg:opacity-0' : 'min-w-0 max-w-[188px] opacity-100'
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
    if (newVal) {
      setCategoriesOpen(false);
      setRegionsOpen(false);
    }
    localStorage.setItem('iradios_sidebar_collapsed', String(newVal));
  };

  const regionLinks = useMemo(() => getAvailableRegionLinks(Array.isArray(stations) ? stations : []), [stations]);

  const [categoriesOpen, setCategoriesOpen] = useState(() => location.pathname.startsWith('/genre/'));
  const [regionsOpen, setRegionsOpen] = useState(() => location.pathname.startsWith('/region/'));

  useEffect(() => {
    if (location.pathname.startsWith('/genre/')) {
      setCategoriesOpen(true);
      setRegionsOpen(false);
    }
    if (location.pathname.startsWith('/region/')) {
      setRegionsOpen(true);
      setCategoriesOpen(false);
    }
  }, [location.pathname]);

  const toggleSubmenu = section => {
    // One accordion at a time. Icon-only mode expands on the first click.
    if (isCollapsed) {
      setIsCollapsed(false);
      localStorage.setItem('iradios_sidebar_collapsed', 'false');
    }
    if (section === 'categories') {
      setCategoriesOpen(open => isCollapsed || !open);
      setRegionsOpen(false);
    } else {
      setRegionsOpen(open => isCollapsed || !open);
      setCategoriesOpen(false);
    }
  };

  const goToHomeStart = () => {
    setIsMobileMenuOpen(false);
    document.getElementById('main-scroll-area')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isAdmin = currentUser?.role === 'admin';
  const isBroadcaster = currentUser?.role === 'broadcaster';
  const isProducer = currentUser?.role === 'producer';
  const isAgency = currentUser?.role === 'agency'; 
  
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
      {isMobileMenuOpen&&<button type="button" aria-label="Κλείσιμο μενού" onClick={()=>setIsMobileMenuOpen(false)}
        className="fixed inset-0 z-[99] bg-black/70 backdrop-blur-[3px] lg:hidden" />}
      <aside aria-label="Κύρια πλοήγηση" className={`ir-app-sidebar fixed inset-y-0 left-0 z-[100] lg:sticky lg:top-0 lg:h-dvh shrink-0 flex flex-col min-h-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isMobileMenuOpen ? 'translate-x-0 visible' : '-translate-x-full invisible lg:visible lg:translate-x-0'
      } ${isCollapsed ? 'lg:w-[76px] w-[min(86vw,280px)]' : 'w-[min(86vw,280px)] lg:w-[252px]'}`}>
        
        <div className="flex h-full min-h-0 flex-col">
          
          {/* LOGO & TOGGLE SECTION */}
          <div className={`px-4 pt-3 pb-3 mb-2 flex border-b border-white/5 shrink-0 transition-all duration-300 ${
            isCollapsed ? 'lg:flex-col lg:items-center lg:gap-1 items-center justify-between' : 'items-center justify-between'
          }`}>
            
            <Link to={homeRoute} onClick={() => setIsMobileMenuOpen(false)}
              className="flex min-w-0 shrink-0 items-center justify-center overflow-hidden rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ccff00]"
              title="iRadiosGR" aria-label="iRadiosGR">
              <img src="/iradios-logo.png" alt="iRadiosGR" className={`h-11 w-[158px] object-contain object-left ${isCollapsed ? 'lg:hidden' : ''}`}/>
              {isCollapsed && <img src="/favicon.png" alt="" aria-hidden="true" className="hidden h-10 w-10 object-contain lg:block"/>}
            </Link>

            <button 
              type="button"
              aria-label={isCollapsed ? 'Επέκταση μενού' : 'Σύμπτυξη μενού'}
              onClick={toggleCollapse} 
              className="hidden lg:flex text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 shrink-0"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            <button type="button" aria-label="Κλείσιμο μενού" onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors shrink-0">
              <X size={24} />
            </button>
          </div>
          
          {/* 📜 SCROLLABLE AREA */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar flex flex-col justify-between gap-2 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-3">
            
            <nav className={`space-y-0.5 transition-all duration-300 ${isCollapsed ? 'lg:px-2 px-3' : 'px-3'}`}>
              
              {(isAdmin || isBroadcaster || isProducer) && (
                <SidebarItem isCollapsed={isCollapsed} to="/backoffice"
                  currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)}
                  icon={<LayoutDashboard size={20} className="text-[#ccff00]" />}
                  label="iRadios Backoffice" className="bg-[#ccff00]/10 text-[#ccff00]" />
              )}

              {/* 🚀 TOP MENU (Panel) */}
              {(isBroadcaster || isProducer || isAgency) ? ( 
                <>
                  <div className={`text-[10px] font-black text-[#ccff00] uppercase tracking-widest mb-2 mt-1 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Το panel σου</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-2" />}
                  
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
                      <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 mt-3 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Ανακαλυψη</div>
                      {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-2" />}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 mt-1 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Ανακαλυψη</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-2" />}
                </>
              )}

              
              
              {!isProducer && (
                <>
                  <SidebarItem isCollapsed={isCollapsed} to="/" state={{ forceHome: true }} currentPath={location.pathname+location.search} onClick={goToHomeStart} icon={<House size={20} />} label="Για Σένα" />
                  {(!currentUser || !isListenerPremium) && (
                    <SidebarItem isCollapsed={isCollapsed} to="/premium" currentPath={location.pathname}
                      onClick={() => setIsMobileMenuOpen(false)} icon={<Crown size={20} className="text-[#ccff00]"/>} label="Γίνε Premium"/>
                  )}
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=live" currentPath={location.pathname+location.search}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      if (location.pathname === '/' && location.search === '?explore=live')
                        document.getElementById('home-live-now')?.scrollIntoView({behavior:'smooth',block:'start'});
                    }} icon={<RadioTower size={20} />} label="Live Τώρα" />
                   <SidebarItem isCollapsed={isCollapsed} to="/newsfeed" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Newspaper size={20} />} label="Ειδήσεις" />
                  <button
                    type="button"
                    aria-expanded={categoriesOpen && !isCollapsed}
                    aria-controls="ir-sidebar-categories"
                    title={isCollapsed ? 'Κατηγορίες' : undefined}
                    aria-label={isCollapsed ? 'Κατηγορίες' : undefined}
                    onClick={() => toggleSubmenu('categories')}
                    className={`ir-nav-item flex w-full overflow-hidden items-center rounded-xl text-left transition-all duration-300 ${location.pathname.startsWith('/genre/') ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'} ${isCollapsed ? 'lg:justify-center lg:gap-0 lg:px-0 px-3 py-2 gap-3' : 'px-3 py-2 gap-3'}`}
                  >
                    <Grid2X2 size={20} className="shrink-0"/>
                    <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'lg:max-w-0 lg:opacity-0' : ''}`}>Κατηγορίες</span>
                    <ChevronDown size={16} aria-hidden="true" className={`ml-auto shrink-0 transition-transform duration-200 ${categoriesOpen ? 'rotate-180' : ''} ${isCollapsed ? 'lg:hidden' : ''}`}/>
                  </button>
                  {categoriesOpen && (
                    <div id="ir-sidebar-categories" className={`mb-2 ml-6 max-h-[min(32dvh,260px)] space-y-2 overflow-y-auto overscroll-contain border-l border-white/10 pl-2 pr-1 custom-scrollbar ${isCollapsed ? 'lg:hidden' : ''}`}>
                      {PRIMARY_CATEGORY_GROUPS.map(group => (
                        <div key={group.label}>
                          <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{group.label}</p>
                          <div className="space-y-0.5">
                            {group.items.map(item => (
                              <Link key={item} to={`/genre/${encodeURIComponent(item)}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block rounded-lg px-2.5 py-1.5 text-[12px] font-medium leading-snug transition-colors hover:bg-white/5 hover:text-[#ccff00] ${decodeURIComponent(location.pathname) === `/genre/${item}` ? 'bg-white/5 text-[#ccff00]' : 'text-zinc-400'}`}>
                                {item}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Popular city shortcuts, followed by available geographical regions. */}
                  <button type="button" aria-expanded={regionsOpen && !isCollapsed}
                    aria-controls="ir-sidebar-regions"
                    aria-label={isCollapsed ? 'Περιοχές' : undefined}
                    title={isCollapsed ? 'Περιοχές' : undefined}
                    onClick={() => toggleSubmenu('regions')}
                    className={`ir-nav-item relative flex min-h-9 w-full items-center overflow-hidden rounded-xl text-left transition-all duration-200 ${location.pathname.startsWith('/region/') ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'} ${isCollapsed ? 'lg:justify-center lg:px-0 px-3 py-2 gap-3' : 'px-3 py-2 gap-3'}`}>
                    <MapPin size={20} className="shrink-0"/>
                    <span className={`text-sm font-medium whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'lg:max-w-0 lg:opacity-0' : ''}`}>Περιοχές</span>
                    <ChevronDown size={16} aria-hidden="true" className={`ml-auto shrink-0 transition-transform duration-200 ${regionsOpen ? 'rotate-180' : ''} ${isCollapsed ? 'lg:hidden' : ''}`}/>
                  </button>
                  {regionsOpen && (
                    <div id="ir-sidebar-regions" className={`mb-2 ml-6 max-h-[min(30dvh,250px)] space-y-1 overflow-y-auto overscroll-contain border-l border-white/10 pl-2 pr-1 custom-scrollbar ${isCollapsed ? 'lg:hidden' : ''}`}>
                      <div className="rounded-xl border border-[#ccff00]/20 bg-[#ccff00]/[0.05] p-1">
                        <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#ccff00]">Μεγάλες πόλεις</p>
                        {CITY_SHORTCUTS.filter(name => regionLinks.includes(name)).map(name => (
                          <Link key={name} to={`/region/${encodeURIComponent(name)}`}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`block rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-[#ccff00]/10 hover:text-[#ccff00] ${decodeURIComponent(location.pathname) === `/region/${name}` ? 'bg-[#ccff00]/10 text-[#ccff00]' : 'text-zinc-200'}`}>
                            {name}
                          </Link>
                        ))}
                      </div>
                      {regionLinks.some(name => !CITY_SHORTCUTS.includes(name)) && (
                        <>
                          <p className="mx-2 border-t border-white/10 px-1 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">Υπόλοιπες περιοχές</p>
                          {regionLinks.filter(name => !CITY_SHORTCUTS.includes(name)).map(name => (
                            <Link key={name} to={`/region/${encodeURIComponent(name)}`}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className={`block rounded-lg px-2.5 py-1.5 text-[12px] font-medium leading-snug transition-colors hover:bg-white/5 hover:text-[#ccff00] ${decodeURIComponent(location.pathname) === `/region/${name}` ? 'bg-white/5 text-[#ccff00]' : 'text-zinc-400'}`}>
                              {name}
                            </Link>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=for-you" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<Sparkles size={20} />} label="Προτάσεις για σένα" />
                  <SidebarItem isCollapsed={isCollapsed} to="/map" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<MapPinned size={20} />} label="Δες στον Χάρτη" />
                </>
              )}

              {/* ADMIN SECTION */}
              {isAdmin && (
                <>
                  <div className={`text-[10px] font-black text-[#ccff00] uppercase tracking-widest mb-2 mt-3 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Admin Panel</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-[#ccff00]/30 mx-auto my-2" />}
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
                <div className="mt-3">
                  <div className={`text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>
                    {isProducer ? 'Producer Menu' : 'Broadcaster Menu'}
                  </div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-blue-500/30 mx-auto my-2" />}
                  
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
                  
                  {/* Boost, DSP, Ad Control and Pro subscriptions now live inside Backoffice. */}

                </div>
              )}
              
              {/* LISTENERS SECTION */}
              {!isProducer && !isAgency && ( 
                <>
                  <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 mt-4 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Βιβλιοθηκη</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-2" />}
                  
                  <SidebarItem isCollapsed={isCollapsed} to="/favorites" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Heart size={20} />} label="Αγαπημένα" />
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=recent" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<History size={20} />} label="Πρόσφατα" />
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=playlist" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<ListMusic size={20} />} label="Playlist" />




                </>
              )}

              {/* 📸 PRESS KIT SECTION - Ενσωματωμένο σωστά στο NAV */}
              {(isAdmin || isAgency || isBroadcaster) && (
                <>
                  <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 mt-4 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Υλικο Συνεργατων</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-2" />}
                  
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
            <div className="mt-2">
              {!['admin', 'broadcaster', 'producer', 'agency'].includes(currentUser?.role) && ( 
                <div className={`mb-2 px-3 shrink-0 transition-all duration-300 ${isCollapsed ? 'lg:hidden' : ''}`}>
                  <div className="relative overflow-hidden rounded-2xl border border-[#ccff00]/25 bg-gradient-to-br from-[#323a19]/95 via-[#1c2417] to-[#0b1011] p-3 shadow-[0_0_28px_rgba(204,255,0,0.07)]">
                    <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#ccff00]/20 blur-[35px]"/>
                    <div className="relative z-10">
                      <h4 className="flex items-center gap-2 text-sm font-black text-white"><Crown size={18} className="text-[#ccff00]"/> iRadiosGR Premium</h4>
                      {isListenerPremium?(
                        <p className="mt-3 text-xs leading-relaxed text-zinc-200">Απολαμβάνεις ήδη τα Premium προνόμιά σου.</p>
                      ):(
                        <>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-300">Premium λειτουργίες και ακρόαση χωρίς διαφημίσεις του iRadios.</p>
                          <Link to="/premium" onClick={()=>setIsMobileMenuOpen(false)}
                            className="mt-2 flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#ccff00] px-3 text-xs font-black text-black transition-colors hover:bg-[#e4ff83]">
                            Αναβάθμιση σε Premium <Rocket size={15}/>
                          </Link>
                        </>
                      )}
                      <Link to="/broadcast" target="_blank" rel="noopener noreferrer" onClick={()=>setIsMobileMenuOpen(false)}
                        className="mt-3 block text-center text-[10px] font-semibold text-zinc-300 underline decoration-white/20 underline-offset-4 hover:text-[#ccff00]">Έχεις ραδιοφωνικό σταθμό;</Link>
                    </div>
                  </div>
                </div>
              )}

              {isCollapsed && !['admin', 'broadcaster', 'producer', 'agency'].includes(currentUser?.role) && (
                <Link to="/premium" title="iRadiosGR Premium" aria-label="iRadiosGR Premium"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mx-2 mb-1 hidden justify-center rounded-xl py-2 text-[#ccff00] hover:bg-[#ccff00]/10 lg:flex">
                  <Crown size={20}/>
                </Link>
              )}
              {/* Advertising CTA belongs with the Premium card, not the discovery links. */}
              <div className={`mb-2 px-3 ${isCollapsed ? 'lg:hidden' : ''}`}>
                <div className="relative overflow-hidden rounded-2xl border border-purple-400/25 bg-gradient-to-br from-[#302041] via-[#20192d] to-[#0b1011] p-3 shadow-[0_0_28px_rgba(168,85,247,0.08)]">
                  <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-purple-500/15 blur-[35px]"/>
                  <div className="relative z-10">
                    <h4 className="flex items-center gap-2 text-sm font-black text-white">
                      <Target size={18} className="text-purple-300"/> Διαφήμιση στο iRadiosGR
                      <span className="ml-auto rounded-md bg-purple-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white">NEW</span>
                    </h4>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-300">Προώθησε την επιχείρησή σου στο δίκτυο του iRadiosGR.</p>
                    <Link to="/go-ads" onClick={() => setIsMobileMenuOpen(false)}
                      className="mt-2 flex min-h-9 items-center justify-center gap-2 rounded-full bg-purple-500 px-3 text-xs font-black text-white transition-colors hover:bg-purple-400">
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
              {/* ⚖️ ΝΟΜΙΚΟ FOOTER */}
              <div className={`px-4 pt-3 mt-2 border-t border-white/5 shrink-0 flex flex-col gap-1.5 transition-all duration-300 ${isCollapsed ? 'lg:opacity-0 lg:h-0 lg:overflow-hidden lg:pt-0 lg:mt-0 lg:border-0' : 'opacity-100 h-auto'}`}>
                <Link to="/terms" onClick={() => setIsMobileMenuOpen(false)} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest font-black transition-colors">Οροι Χρησης</Link>
                <Link to="/privacy" onClick={() => setIsMobileMenuOpen(false)} className="text-[10px] text-zinc-500 hover:text-white uppercase tracking-widest font-black transition-colors">Πολιτικη Απορρητου</Link>
                
                {(isBroadcaster || isAdmin) && (
                  <Link to="/broadcaster-terms" onClick={() => setIsMobileMenuOpen(false)} className="text-[10px] text-blue-500/70 hover:text-blue-400 uppercase tracking-widest font-black transition-colors">Συμφωνητικο Broadcasters</Link>
                )}
                
                {(isAgency || isAdmin) && (
                  <Link to="/agency-terms" className="text-[10px] text-purple-500/70 hover:text-purple-400 uppercase tracking-widest font-black transition-colors">Συμφωνητικο Διαφημιστων</Link>
                )}
                
                <div className="flex flex-col gap-0.5 mt-1">
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
