import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, LayoutDashboard, LayoutGrid, FileText, Users, Radio, Heart, X, Mail, Disc3, BellRing, Megaphone, Crown, SlidersHorizontal, MapPin, Calendar, Rocket, Target, Lock, MessageSquare, Activity, MapPinned, PanelLeftClose, PanelLeftOpen, Image, Navigation, ListMusic, History, Sparkles, Grid2X2, Trophy } from 'lucide-react';

function SidebarItem({ icon, label, to, currentPath, onClick, className = "", isCollapsed }) {
  const active = currentPath === to || decodeURIComponent(currentPath) === to;
  
  return (
    <Link 
      to={to} 
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
  isMobileMenuOpen, setIsMobileMenuOpen, currentUser, stations,
  unreadBroadcasterChat, setUnreadBroadcasterChat
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

  const genres = [...new Set(stations.map(s => s.genre))].filter(Boolean).sort();
  const regions = [...new Set(stations.map(s => s.region))].filter(Boolean).sort();

  const isAdmin = currentUser?.role === 'admin';
  const isBroadcaster = currentUser?.role === 'broadcaster';
  const isProducer = currentUser?.role === 'producer';
  const isAgency = currentUser?.role === 'agency'; 
  
  const hasAdControl = currentUser?.broadcasterProfile?.features?.adControl;
  const hasDSP = currentUser?.broadcasterProfile?.features?.dspEngine;
  const isFullPremium = currentUser?.broadcasterProfile?.tier === 'premium';
  const isListenerPremium = currentUser?.isPremium;
  
  const homeRoute = isAgency ? '/agency/dashboard' : (isBroadcaster || isProducer) ? '/studio' : '/';

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
                  <SidebarItem isCollapsed={isCollapsed} to="/" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<Compass size={20} />} label="Αρχική" />
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=categories" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<Grid2X2 size={20} />} label="Κατηγορίες" />
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=top" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<Trophy size={20} />} label="Top σταθμοί" />
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=for-you" currentPath={location.pathname+location.search} onClick={() => setIsMobileMenuOpen(false)} icon={<Sparkles size={20} />} label="Προτάσεις για σένα" />
                  <SidebarItem isCollapsed={isCollapsed} to="/map" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<MapPinned size={20} />} label="Δες στον Χάρτη" />
                </>
              )}

              {/* 🚀 Διαφημιστικό Δίκτυο */}
                <Link
                  to="/go-ads"
                  title={isCollapsed ? (isAgency ? "Δες Τιμές Διαφήμισης" : "Διαφήμιση") : ""}
                  className={`flex items-center rounded-xl transition-all duration-300 overflow-hidden relative ${
                    location.pathname === '/go-ads' 
                      ? 'bg-[#ccff00] text-black shadow-lg' 
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  } ${isCollapsed ? 'lg:justify-center lg:px-0 lg:py-3 px-4 py-3' : 'px-4 py-3 gap-3'}`}
                >
                  <div className="shrink-0 flex items-center justify-center relative z-10">
                    <Target size={20} />
                  </div>
                  <span className={`text-sm font-medium tracking-wider whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-[200px] opacity-100'} ${isCollapsed ? 'ml-3 lg:ml-0' : ''}`}>
                    {isAgency ? "Δες Τιμές Διαφήμισης" : "Διαφήμιση"}
                  </span>
                  <span className={`absolute right-3 bg-purple-600 text-white px-1.5 py-0.5 rounded-md animate-pulse transition-all duration-300 ${isCollapsed ? 'lg:text-[6px] lg:right-1 lg:top-1' : 'text-[8px]'}`}>
                    NEW
                  </span>
                </Link>
              
              {/* ADMIN SECTION */}
              {isAdmin && (
                <>
                  <div className={`text-[10px] font-black text-[#ccff00] uppercase tracking-widest mb-2 mt-6 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Admin Panel</div>
                  {isCollapsed && <div className="hidden lg:block w-6 h-px bg-[#ccff00]/30 mx-auto my-6" />}
                  <SidebarItem isCollapsed={isCollapsed} to="/admin" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Activity size={20} className="text-[#ccff00]" />} label="Dashboard" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/radios" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<LayoutGrid size={20} />} label="Ραδιόφωνα iRadios" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/radioset" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Radio size={20} className="text-[#ccff00]" />} label="Radio Set" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/home-slides" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Image size={20} className="text-[#ccff00]" />} label="Slides Αρχικής" />
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
                  
                  <div className="relative mt-1 mb-1">
                    <SidebarItem 
                      isCollapsed={isCollapsed}
                      to="/my-chat" 
                      currentPath={location.pathname} 
                      onClick={() => { setIsMobileMenuOpen(false); if (setUnreadBroadcasterChat) setUnreadBroadcasterChat(false); }} 
                      icon={<MessageSquare size={20} className={unreadBroadcasterChat ? "text-[#ccff00] animate-pulse" : ""} />} 
                      label="Live Chat Σταθμού" 
                      className={unreadBroadcasterChat ? "bg-[#ccff00]/10 border-l-2 border-[#ccff00] shadow-[inset_10px_0_20px_rgba(204,255,0,0.05)] text-white" : ""}
                    />
                    {unreadBroadcasterChat && (
                      <span className={`absolute bg-[#ccff00] rounded-full shadow-[0_0_10px_#ccff00] animate-ping transition-all duration-300 ${isCollapsed ? 'w-1.5 h-1.5 top-2 right-2' : 'w-2 h-2 right-4 top-1/2 -translate-y-1/2'}`}></span>
                    )}
                  </div>
                  
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

                  {/* Focused region shortcuts; the home grid contains every real region/genre. */}
                  <div className={`ir-sidebar-heading mb-3 mt-7 px-4 text-[10px] font-black uppercase tracking-widest text-zinc-500 ${isCollapsed?'lg:hidden':''}`}>Ανά περιοχή</div>
                  {['Αττική','Θεσσαλονίκη','Ανατολική Μακεδονία & Θράκη'].map(name=>(
                    <SidebarItem key={name} isCollapsed={isCollapsed} to={`/region/${encodeURIComponent(name)}`}
                      currentPath={location.pathname} onClick={()=>setIsMobileMenuOpen(false)}
                      icon={<MapPin size={18}/>} label={name}/>
                  ))}
                  <SidebarItem isCollapsed={isCollapsed} to="/?explore=regions" currentPath={location.pathname+location.search}
                    onClick={()=>setIsMobileMenuOpen(false)} icon={<Grid2X2 size={18}/>} label="Περισσότερες περιοχές"/>
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
