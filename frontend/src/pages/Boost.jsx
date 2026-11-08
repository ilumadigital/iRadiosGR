import {adminFetch as fetch} from '../utils/adminFetch';
import React, { useState, useEffect, useRef } from 'react';
import { Rocket, Search, GripVertical, Save, Info, Filter, Zap, Clock, ZapOff } from 'lucide-react';

export default function Boost({ API_URL, stations, refreshStations }) {
  const [localStations, setLocalStations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showOnlyBoosted, setShowOnlyBoosted] = useState(false); // 🟢 ΝΕΟ ΦΙΛΤΡΟ
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const dragItemIndex = useRef(null);
  const dragOverItemIndex = useRef(null);

  useEffect(() => {
    if (stations) {
      // Ταξινομούμε by default βάσει position (όπως τα φέρνει η βάση)
      const approved = [...stations].filter(s => s.status === 'approved').sort((a, b) => a.position - b.position);
      setLocalStations(approved);
    }
  }, [stations]);

  const genres = [...new Set(localStations.map(s => s.genre))].filter(Boolean).sort();
  const regions = [...new Set(localStations.map(s => s.region))].filter(Boolean).sort();

  const filteredStations = localStations.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchGenre = selectedGenre ? s.genre === selectedGenre : true;
    const matchRegion = selectedRegion ? s.region === selectedRegion : true;
    const matchBoosted = showOnlyBoosted ? s.boostStatus === true : true;
    return matchSearch && matchGenre && matchRegion && matchBoosted;
  });

  const isSearchActive = searchTerm.length > 0 || selectedGenre !== '' || selectedRegion !== '' || showOnlyBoosted;

  // Υπολογισμός χρόνου που απομένει
  const getTimeLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return 'Έληξε';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} μέρες`;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours} ώρες`;
  };

  // --- BOOST HANDLERS ---
  const handleBoostToggle = (stationId) => {
    setLocalStations(prev => prev.map(s => {
      if (s._id === stationId) {
        const newStatus = !s.boostStatus;
        // Αν το ανοίγει χειροκίνητα ο Admin, βάζουμε default 1 μέρα
        let newExpiresAt = s.boostExpiresAt;
        if (newStatus && !newExpiresAt) {
          newExpiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
        }
        return { ...s, boostStatus: newStatus, boostExpiresAt: newStatus ? newExpiresAt : null };
      }
      return s;
    }));
  };

  const handleBoostDurationChange = (stationId, days) => {
    const newExpiresAt = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString();
    setLocalStations(prev => prev.map(s => 
      s._id === stationId ? { ...s, boostExpiresAt: newExpiresAt, boostStatus: true } : s
    ));
  };

  // --- DRAG & DROP LOGIC ---
  const handleDragStart = (e, index) => {
    dragItemIndex.current = index;
    setTimeout(() => { e.target.style.opacity = '0.4'; }, 0);
  };
  const handleDragEnter = (e, index) => {
    e.preventDefault();
    dragOverItemIndex.current = index;
  };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e) => {
    e.preventDefault();
    e.target.style.opacity = '1';

    if (isSearchActive || dragItemIndex.current === null || dragOverItemIndex.current === null) return;
    if (dragItemIndex.current === dragOverItemIndex.current) return; 

    const reorderedFiltered = [...filteredStations];
    const draggedItem = reorderedFiltered[dragItemIndex.current];
    
    reorderedFiltered.splice(dragItemIndex.current, 1);
    reorderedFiltered.splice(dragOverItemIndex.current, 0, draggedItem);

    const newLocalStations = [...localStations];
    const originalIndexes = filteredStations.map(station => newLocalStations.findIndex(s => s._id === station._id));
    originalIndexes.sort((a, b) => a - b);

    reorderedFiltered.forEach((station, index) => {
      newLocalStations[originalIndexes[index]] = station;
    });

    setLocalStations(newLocalStations);
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;
  };
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    dragItemIndex.current = null;
    dragOverItemIndex.current = null;
  };

  // --- SAVE LOGIC ---
  const handleSaveOrder = async () => {
    setSaving(true);
    setMessage('');
    try {
      const stationsData = localStations.map((s, index) => ({
        id: s._id,
        position: index + 1,
        boostStatus: s.boostStatus || false,
        boostExpiresAt: s.boostExpiresAt || null,
        isFeatured: s.isFeatured || false
      }));
      
      const res = await fetch(`${API_URL}/admin/stations/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('iluma_token')}`
        },
        body: JSON.stringify({ stationsData })
      });

      if (res.ok) {
        setMessage('Οι αλλαγές (Σειρά & Boost) αποθηκεύτηκαν επιτυχώς!');
        await refreshStations(); 
        setTimeout(() => setMessage(''), 4000);
      } else {
        setMessage('Σφάλμα αποθήκευσης.');
      }
    } catch (err) {
      setMessage('Σφάλμα δικτύου.');
    }
    setSaving(false);
  };

  return (
    <div className="p-6 lg:p-12 w-full mx-auto animate-fade-in pb-40">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8 border-b border-white/5 pb-6">
        <div className="flex flex-col shrink-0">
          <div className="flex items-center gap-3">
            <Rocket className="text-[#ccff00]" size={36} />
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">Premium Placements</h1>
          </div>
          <span className="text-zinc-500 font-bold text-sm tracking-widest uppercase mt-2">
            Επίβλεψη & Χειροκίνητη Διαχείριση Boosts
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
          
          {/* 🟢 ΝΕΟ ΚΟΥΜΠΙ: Μόνο Ενεργά Boosts */}
          <button 
            onClick={() => setShowOnlyBoosted(!showOnlyBoosted)}
            className={`flex items-center gap-2 px-4 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${showOnlyBoosted ? 'bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]' : 'bg-zinc-900 text-zinc-500 border border-white/5 hover:text-white'}`}
          >
            {showOnlyBoosted ? <Zap size={16} /> : <ZapOff size={16} />}
            {showOnlyBoosted ? 'ΟΛΑ ΤΑ ΡΑΔΙΟΦΩΝΑ' : 'ΕΝΕΡΓΑ BOOSTS'}
          </button>

          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input 
              type="text" placeholder="Αναζήτηση..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 border border-white/5 h-12 rounded-xl pl-12 pr-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors"
            />
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="w-full bg-zinc-900 border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors appearance-none cursor-pointer">
              <option value="">Όλα τα Είδη</option>
              {genres.map(genre => <option key={genre} value={genre}>{genre}</option>)}
            </select>
            <Filter size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
          
          <button onClick={handleSaveOrder} disabled={saving || isSearchActive} className="flex items-center justify-center gap-2 px-8 h-12 bg-[#ccff00] text-black text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100 whitespace-nowrap">
            <Save size={16} /> {saving ? 'Αποθηκευση...' : 'Αποθηκευση Σειρας'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 p-4 rounded-xl bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00] text-sm font-bold flex items-center gap-2">
          <Info size={16} /> {message}
        </div>
      )}

      {/* DRAG & DROP LIST */}
      <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/5 bg-black/50 text-[10px] text-zinc-500 font-black uppercase tracking-widest">
          <div className="col-span-1 text-center">Θεση</div>
          <div className="col-span-4 md:col-span-3">Σταθμος</div>
          <div className="col-span-2 hidden md:block">Ειδος</div>
          <div className="col-span-6 md:col-span-5 text-center">Ρυθμισεις Boost</div>
          <div className="col-span-1 text-right pr-4">Drag</div>
        </div>

        <div className="flex flex-col">
          {filteredStations.map((station, filterIndex) => {
            const realIndex = localStations.findIndex(s => s._id === station._id);
            const isBoosted = station.boostStatus;
            const timeLeft = getTimeLeft(station.boostExpiresAt);
            const isExpired = timeLeft === 'Έληξε';

            return (
              <div 
                key={station._id} draggable={!isSearchActive} 
                onDragStart={(e) => handleDragStart(e, filterIndex)} onDragEnter={(e) => handleDragEnter(e, filterIndex)}
                onDragOver={handleDragOver} onDrop={handleDrop} onDragEnd={handleDragEnd}
                className={`grid grid-cols-12 gap-4 p-4 border-b border-white/5 items-center hover:bg-white/5 transition-colors group bg-black ${!isSearchActive ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {/* Position */}
                <div className="col-span-1 flex justify-center pointer-events-none">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${isBoosted && !isExpired ? 'bg-[#ccff00]/10 border-[#ccff00]/30 text-[#ccff00]' : 'bg-zinc-900 border-white/5 text-zinc-400 group-hover:border-[#ccff00]/30 group-hover:text-[#ccff00]'}`}>
                    {realIndex + 1}
                  </span>
                </div>
                
                {/* Station Info */}
                <div className="col-span-4 md:col-span-3 flex items-center gap-4 pointer-events-none">
                  <div className="relative">
                    <img src={station.logo} className="w-10 h-10 rounded-xl object-cover bg-white" alt="" />
                    {isBoosted && !isExpired && <Zap size={14} className="absolute -top-2 -right-2 text-black bg-[#ccff00] rounded-full p-0.5 shadow-[0_0_10px_rgba(204,255,0,0.5)]" />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white text-sm truncate">{station.name}</span>
                    <span className="text-[10px] text-zinc-500 md:hidden truncate">{station.genre}</span>
                  </div>
                </div>

                <div className="col-span-2 hidden md:flex flex-col min-w-0 pointer-events-none">
                  <span className="text-xs text-zinc-300 truncate">{station.genre}</span>
                  <span className="text-[10px] text-zinc-500 truncate">{station.region}</span>
                </div>

                {/* Boost Controls */}
                <div className="col-span-6 md:col-span-5 flex items-center justify-center gap-2 md:gap-4 bg-zinc-900/50 p-2 rounded-xl border border-white/5">
                  {/* Toggle */}
                  <button type="button" onClick={() => handleBoostToggle(station._id)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none ${isBoosted ? 'bg-[#ccff00]' : 'bg-zinc-700'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-black transition duration-300 ${isBoosted ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>

                  {/* Select Duration */}
                  <select 
                    disabled={!isBoosted}
                    onChange={(e) => handleBoostDurationChange(station._id, e.target.value)}
                    className="bg-black border border-white/10 h-8 rounded-lg px-2 text-[11px] font-bold text-white outline-none disabled:opacity-30 cursor-pointer"
                  >
                    <option value="" disabled selected>Επιλογή...</option>
                    <option value="1">1 Ημέρα</option>
                    <option value="3">3 Ημέρες</option>
                    <option value="7">7 Ημέρες</option>
                    <option value="14">14 Ημέρες</option>
                    <option value="30">1 Μήνας</option>
                    <option value="90">3 Μήνες</option>
                    <option value="180">6 Μήνες</option>
                    <option value="365">1 Έτος</option>
                  </select>

                  {/* Remaining Time */}
                  <div className="hidden lg:flex items-center gap-1.5 w-24">
                    {isBoosted && station.boostExpiresAt && (
                      <>
                        <Clock size={12} className={isExpired ? "text-red-500" : "text-[#ccff00]"} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isExpired ? "text-red-500" : "text-[#ccff00]"}`}>
                          {timeLeft}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="col-span-1 flex justify-end pr-4 text-zinc-600 group-hover:text-white transition-colors">
                  <GripVertical size={20} className={isSearchActive ? 'opacity-20' : ''} />
                </div>
              </div>
            );
          })}
          
          {filteredStations.length === 0 && (
            <div className="p-12 text-center text-zinc-500 font-bold uppercase tracking-widest text-xs">
              Δεν βρέθηκαν σταθμοί με αυτά τα κριτήρια.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
