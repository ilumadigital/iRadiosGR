import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Compass, LayoutDashboard, LayoutGrid, FileText, Users, Radio, Heart, X, Mail, Disc3, BellRing, Megaphone, Crown, SlidersHorizontal, MapPin, Calendar, Rocket, Target, Lock, MessageSquare, Activity, MapPinned, PanelLeftClose, PanelLeftOpen, Image, Navigation } from 'lucide-react';

function SidebarItem({ icon, label, to, currentPath, onClick, className = "", isCollapsed }) {
  const active = currentPath === to || decodeURIComponent(currentPath) === to;
  
  return (
    <Link 
      to={to} 
      onClick={onClick}
      title={isCollapsed ? label : ""} 
      className={`relative flex items-center rounded-xl cursor-pointer transition-all duration-300 overflow-hidden ${
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

      <aside className={`fixed inset-y-0 left-0 z-[100] lg:sticky lg:top-0 lg:h-screen shrink-0 bg-black border-r border-white/5 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      } ${isCollapsed ? 'lg:w-[88px] w-[280px]' : 'w-[280px]'}`}>
        
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
              <img 
                src="/noicon-iradios-app-logo.png" 
                alt="iRadios Logo" 
                className={`h-[20px] w-auto object-contain mt-1 group-hover:opacity-80 transition-all duration-300 ${
                  isCollapsed ? 'lg:max-w-0 lg:opacity-0' : 'max-w-[100px] opacity-100'
                }`} 
              />
            </Link>

            <button 
              onClick={toggleCollapse} 
              className="hidden lg:flex text-zinc-500 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5 shrink-0"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-zinc-500 hover:text-white transition-colors shrink-0">
              <X size={24} />
            </button>
          </div>
          
          {/* 📜 SCROLLABLE AREA */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col justify-between pb-44 lg:pb-32">
            
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
                  <SidebarItem isCollapsed={isCollapsed} to="/" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Compass size={20} />} label="Αρχική" />
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
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/banners" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Megaphone size={20} className="text-[#ccff00]" />} label="Banners Ακροατών" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/boost" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Rocket size={20} className="text-[#ccff00]" />} label="Έλεγχος Boost" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/users" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Users size={20} />} label="Χρήστες iRadios" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/ads" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Megaphone size={20} />} label="Διαφημίσεις (Network)" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/ad-control" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<Target size={20} />} label="Local Ads (Broadcasters)" />
                  <SidebarItem isCollapsed={isCollapsed} to="/admin/push" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<BellRing size={20} />} label="Αποστολή Ειδοποίησης" />
                  <SidebarItem isCollapsed={isCollapsed} to="/dsp" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<SlidersHorizontal size={20} />} label="DSP Engine" />
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
                        <SidebarItem isCollapsed={isCollapsed} to="/dsp" currentPath={location.pathname} onClick={() => setIsMobileMenuOpen(false)} icon={<SlidersHorizontal size={20} />} label="My DSP Engine" />
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

                  {/* 🟢 ΝΕΟ: ΔΗΜΟΦΙΛΕΙΣ ΠΕΡΙΟΧΕΣ (Νομοί) */}
                  <>
                    <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 mt-10 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Δημοφιλεις Περιοχες</div>
                    {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-6" />}
                    
                    <SidebarItem 
                      isCollapsed={isCollapsed}
                      to={`/region/${encodeURIComponent('Αθήνα')}`} 
                      currentPath={location.pathname} 
                      onClick={() => setIsMobileMenuOpen(false)} 
                      icon={<Navigation size={18} className="text-zinc-500" />} 
                      label="Αθήνα" 
                    />
                    <SidebarItem 
                      isCollapsed={isCollapsed}
                      to={`/region/${encodeURIComponent('Θεσσαλονίκη')}`} 
                      currentPath={location.pathname} 
                      onClick={() => setIsMobileMenuOpen(false)} 
                      icon={<Navigation size={18} className="text-zinc-500" />} 
                      label="Θεσσαλονίκη" 
                    />
                  </>

                  {regions.length > 0 && (
                    <>
                      {/* 🟢 Αλλαγή του τίτλου σε ΑΝΑ ΠΕΡΙΦΕΡΕΙΑ */}
                      <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 mt-10 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Ανα Περιφερεια</div>
                      {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-6" />}
                      {regions.map(region => (
                        <SidebarItem 
                          key={region}
                          isCollapsed={isCollapsed}
                          to={`/region/${encodeURIComponent(region)}`} 
                          currentPath={location.pathname} 
                          onClick={() => setIsMobileMenuOpen(false)} 
                          icon={<MapPin size={18} className="text-zinc-500" />} 
                          label={region} 
                        />
                      ))}
                    </>
                  )}

                  {genres.length > 0 && (
                    <>
                      <div className={`text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 mt-10 transition-all duration-300 ${isCollapsed ? 'lg:hidden px-4' : 'px-4'}`}>Ανα Ειδος</div>
                      {isCollapsed && <div className="hidden lg:block w-6 h-px bg-white/10 mx-auto my-6" />}
                      {genres.map(genre => (
                        <SidebarItem 
                          key={genre}
                          isCollapsed={isCollapsed}
                          to={`/genre/${encodeURIComponent(genre)}`} 
                          currentPath={location.pathname} 
                          onClick={() => setIsMobileMenuOpen(false)} 
                          icon={<Disc3 size={18} className="text-zinc-500" />} 
                          label={genre.charAt(0).toUpperCase() + genre.slice(1).toLowerCase()} 
                        />
                      ))}
                    </>
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
              {!['admin', 'broadcaster', 'producer', 'agency'].includes(currentUser?.role) && ( 
                <div className={`px-4 shrink-0 transition-all duration-300 ${isCollapsed ? 'lg:opacity-0 lg:h-0 lg:overflow-hidden' : 'opacity-100 h-auto'}`}>
                  <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-3xl p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-[60px] transition-transform group-hover:scale-110"></div>
                    <div className="relative z-10">
                      <h4 className="text-white font-black mb-1">Έχεις σταθμό;</h4>
                      <p className="text-[11px] text-zinc-400 font-medium leading-relaxed mb-4">
                        Έλα στο δίκτυο του iRadios και πάρε τον έλεγχο των ακροατών και των διαφημίσεών σου.
                      </p>
                      <Link 
                        to="/broadcast" 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full bg-white hover:bg-zinc-200 text-black text-[10px] font-black uppercase tracking-widest py-3 rounded-xl flex items-center justify-center transition-transform active:scale-95 shadow-lg"
                      >
                        Γινε Broadcaster
                      </Link>
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
