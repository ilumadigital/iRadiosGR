import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Calendar as CalendarIcon, Clock, User, Radio, Loader2, Check } from 'lucide-react';

const DAYS_OF_WEEK = [
  'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο', 'Κυριακή'
];

const INITIAL_FORM_STATE = {
  days: [1], 
  startTime: '06:00',
  endTime: '10:00',
  title: '',
  host: '',
  isAllDay: false // 🟢 Νέο πεδίο
};

const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Επιτρέπει εκπομπές που ξεκινούν ακριβώς τη στιγμή που τελειώνει η προηγούμενη (π.χ. 10:00-12:00 και 12:00-14:00)
const checkOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2; 
};

export default function MySchedules({ API_URL, currentUser, refreshStations }) {
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [editingShowInfo, setEditingShowInfo] = useState(null); 

  const isProducer = currentUser?.role === 'producer';

  useEffect(() => {
    fetchStations();
  }, [currentUser]);

  const fetchStations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('iluma_token');
      let endpoint;
      
      if (currentUser.role === 'admin') {
        endpoint = `${API_URL}/stations/all`;
      } else if (isProducer) {
        endpoint = `${API_URL}/producers/my-station`; 
      } else {
        endpoint = `${API_URL}/broadcaster/${currentUser._id || currentUser.id}/stations`;
      }
      
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (isProducer) {
        if (data.station) {
          setStations([data.station]);
          handleSelectStation(data.station); 
        }
      } else {
        setStations(data);
        if (data.length === 1) handleSelectStation(data[0]);
      }
    } catch (err) {
      console.error("Σφάλμα φόρτωσης σταθμών:", err);
    }
    setLoading(false);
  };

  const handleSelectStation = (station) => {
    setSelectedStation(station);
    setSchedule(station.schedule ? [...station.schedule] : []);
  };

  // --- MODAL & FORM LOGIC ---
  const handleOpenModal = (item = null) => {
    if (item) {
      const relatedShows = schedule.filter(s => 
        s.title === item.title && 
        s.startTime === item.startTime && 
        s.endTime === item.endTime && 
        s.host === item.host
      );
      const activeDays = relatedShows.map(s => s.day);
      
      // 🟢 Έλεγχος αν η εκπομπή που κάνουμε edit είναι All Day
      const isAllDay = item.startTime === '00:00' && item.endTime === '23:59';

      setFormData({ ...item, days: activeDays, isAllDay });
      setEditingShowInfo({
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        host: item.host
      });
    } else {
      setFormData(INITIAL_FORM_STATE);
      setEditingShowInfo(null);
    }
    setShowModal(true);
  };

  const handleToggleAllDay = () => {
    setFormData(prev => {
      const isNowAllDay = !prev.isAllDay;
      return {
        ...prev,
        isAllDay: isNowAllDay,
        // Αν ενεργοποιηθεί το All Day, βάζουμε καρφωτά τις ώρες.
        // Αν απενεργοποιηθεί, βάζουμε κάτι default (π.χ. 06:00 - 10:00) για να μην μείνει στο 00:00-23:59
        startTime: isNowAllDay ? '00:00' : '06:00',
        endTime: isNowAllDay ? '23:59' : '10:00'
      };
    });
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.startTime || !formData.endTime) return alert("Συμπληρώστε τα υποχρεωτικά πεδία!");
    if (formData.days.length === 0) return alert("Επιλέξτε τουλάχιστον μία ημέρα!");

    const startMins = timeToMinutes(formData.startTime);
    const endMins = timeToMinutes(formData.endTime);

    if (startMins >= endMins) {
      return alert("Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.");
    }

    const strictEndMins = endMins - 1; 

    const otherShows = schedule.filter(s => {
      if (!editingShowInfo) return true;
      const isSameOldShow = s.title === editingShowInfo.title && s.startTime === editingShowInfo.startTime && s.endTime === editingShowInfo.endTime && s.host === editingShowInfo.host;
      return !isSameOldShow;
    });

    for (let day of formData.days) {
      const dayShows = otherShows.filter(s => s.day === day);
      
      for (let existingShow of dayShows) {
        const existStart = timeToMinutes(existingShow.startTime);
        const existEnd = timeToMinutes(existingShow.endTime) - 1; 
        
        if (checkOverlap(startMins, strictEndMins, existStart, existEnd)) {
          return alert(`Σφάλμα: Η εκπομπή επικαλύπτεται με την "${existingShow.title}" την ${DAYS_OF_WEEK[day]}.`);
        }
      }
    }

    const newEntries = formData.days.map(d => ({
      day: d,
      startTime: formData.startTime,
      endTime: formData.endTime, 
      title: formData.title,
      host: formData.host
    }));

    setSchedule([...otherShows, ...newEntries]);
    setShowModal(false);
  };

  const handleDeleteItem = (indexToDelete) => {
    if (window.confirm("Σίγουρα θέλετε να διαγράψετε αυτή την εκπομπή;")) {
      const newSchedule = [...schedule];
      newSchedule.splice(indexToDelete, 1);
      setSchedule(newSchedule);
    }
  };

  const handleSaveToDB = async () => {
    if (!selectedStation) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('iluma_token');
      const res = await fetch(`${API_URL}/stations/${selectedStation._id}/schedule`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ schedule })
      });

      if (res.ok) {
        if (refreshStations) refreshStations(); 
        alert("Το πρόγραμμα αποθηκεύτηκε με επιτυχία!");
      } else {
        alert("Σφάλμα κατά την αποθήκευση.");
      }
    } catch (err) {
      alert("Σφάλμα δικτύου.");
    }
    setIsSaving(false);
  };

  const getShowsForDay = (dayIndex) => {
    return schedule
      .map((item, index) => ({ ...item, originalIndex: index })) 
      .filter(item => Number(item.day) === dayIndex)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)); 
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center flex-col gap-4">
        <Loader2 className="text-[#ccff00] animate-spin" size={40} />
        <div className="text-[#ccff00] font-black tracking-widest uppercase text-xs">Initializing Schedule Engine...</div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
      
      {!isProducer && (
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          <h2 className="text-xl font-black text-white tracking-widest flex items-center gap-2 mb-2">
            <Radio className="text-[#ccff00]" /> Επιλογη Σταθμου
          </h2>
          {stations.length === 0 ? (
            <div className="text-zinc-500 italic">Δεν βρέθηκαν σταθμοί.</div>
          ) : (
            stations.map(station => (
              <div 
                key={station._id}
                onClick={() => handleSelectStation(station)}
                className={`p-4 rounded-2xl cursor-pointer border transition-all flex items-center gap-4 ${
                  selectedStation?._id === station._id 
                    ? 'bg-zinc-900 border-[#ccff00] shadow-[0_0_15px_rgba(204,255,0,0.1)]' 
                    : 'bg-black border-white/5 hover:border-white/20'
                }`}
              >
                <img src={station.logo} alt="" className="w-12 h-12 rounded-xl object-cover bg-white" />
                <div className="min-w-0">
                  <div className={`font-bold truncate ${selectedStation?._id === station._id ? 'text-[#ccff00]' : 'text-white'}`}>
                    {station.name}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-bold tracking-widest mt-1">
                    {station.schedule?.length || 0} Εκπομπες
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className={`w-full ${isProducer ? 'lg:w-full' : 'lg:w-2/3'} flex flex-col`}>
        {!selectedStation ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl p-12 text-zinc-500 text-center">
            <CalendarIcon size={48} className="mb-4 opacity-50" />
            <div className="font-bold text-lg tracking-widest text-white mb-2">Κανενα Προγραμμα</div>
            <p className="text-sm">Επιλέξτε έναν σταθμό για να διαχειριστείτε το πρόγραμμά του.</p>
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-white/5 rounded-[40px] p-6 md:p-10 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10 pb-8 border-b border-white/10">
              <div className="flex items-center gap-5">
                <div className="relative">
                    <img src={selectedStation.logo} className="w-16 h-16 rounded-2xl object-cover bg-white p-1" alt="" />
                    <div className="absolute -top-2 -right-2 bg-[#ccff00] text-black p-1 rounded-lg"><CalendarIcon size={14} /></div>
                </div>
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">{selectedStation.name}</h2>
                    <p className="text-[10px] text-[#ccff00] font-black uppercase tracking-[0.2em] mt-1">Schedule Control Panel</p>
                </div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => handleOpenModal()} 
                  className="flex-1 sm:flex-none bg-white text-black hover:bg-zinc-200 px-6 py-3 rounded-2xl text-xs font-black tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <Plus size={16} /> Νεα Εκπομπη
                </button>
                <button 
                  onClick={handleSaveToDB} 
                  disabled={isSaving}
                  className="flex-1 sm:flex-none bg-[#ccff00] text-black hover:brightness-110 px-6 py-3 rounded-2xl text-xs font-black tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_15px_30px_rgba(204,255,0,0.2)] disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="space-y-8">
              {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                const dayShows = getShowsForDay(dayIndex);
                if (dayShows.length === 0) return null; 

                return (
                  <div key={dayIndex} className="bg-black/40 p-6 rounded-[32px] border border-white/5">
                    <h3 className="text-[#ccff00] font-black tracking-[0.2em] text-xs mb-6 uppercase flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ccff00]"></div>
                      {dayName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dayShows.map((show) => (
                        <div key={show.originalIndex} className="bg-zinc-900/80 border border-white/5 p-5 rounded-2xl flex flex-col gap-4 hover:border-[#ccff00]/30 transition-all group relative overflow-hidden">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 pr-4">
                              <div className="font-black text-white truncate text-base uppercase tracking-tight">{show.title}</div>
                              {show.host && (
                                <div className="text-[10px] text-zinc-500 font-black uppercase flex items-center gap-1.5 mt-2 truncate">
                                  <User size={12} className="text-blue-500" /> {show.host}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleOpenModal(show)} className="p-2 bg-white/5 rounded-lg text-zinc-400 hover:text-[#ccff00] hover:bg-[#ccff00]/10 transition-all"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteItem(show.originalIndex)} className="p-2 bg-white/5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all"><Trash2 size={14} /></button>
                            </div>
                          </div>
                          <div className="bg-black/50 self-start px-3 py-1.5 rounded-xl border border-white/5 flex items-center gap-2">
                            <Clock size={12} className={show.startTime === '00:00' && show.endTime === '23:59' ? "text-[#a855f7]" : "text-[#ccff00]"} />
                            <span className="text-[11px] font-black text-white tracking-widest">
                              {show.startTime === '00:00' && show.endTime === '23:59' ? 'ΟΛΟΗΜΕΡΟ (ALL DAY)' : `${show.startTime} - ${show.endTime}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {schedule.length === 0 && (
                <div className="text-center py-20 bg-black/20 rounded-[40px] border border-dashed border-white/5">
                    <CalendarIcon size={40} className="mx-auto text-zinc-800 mb-4" />
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">No shows registered yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[40px] p-8 shadow-2xl relative animate-in zoom-in-95">
            <button onClick={() => setShowModal(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full"><X size={20} /></button>
            <div className="mb-8 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-1">
                {editingShowInfo !== null ? 'Edit Show' : 'Add New Show'}
                </h3>
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Station: {selectedStation?.name}</p>
              </div>
            </div>

            <form onSubmit={handleSaveItem} className="flex flex-col gap-6">
              <div>
                <label className="text-[9px] text-zinc-500 font-black tracking-widest mb-3 block uppercase ml-1">Select Days</label>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS_OF_WEEK.map((day, idx) => {
                    const isSelected = formData.days.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const newDays = isSelected ? formData.days.filter(d => d !== idx) : [...formData.days, idx];
                          setFormData({...formData, days: newDays});
                        }}
                        className={`py-2 rounded-xl text-[10px] font-black tracking-tighter transition-all border ${
                          isSelected ? 'bg-[#ccff00] border-[#ccff00] text-black' : 'bg-black border-white/5 text-zinc-600'
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 🟢 TOGGLE ALL DAY & TIME INPUTS */}
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Ολοημερη (All Day)</span>
                  <button 
                    type="button"
                    onClick={handleToggleAllDay}
                    className={`w-12 h-6 rounded-full p-1 transition-colors flex items-center ${formData.isAllDay ? 'bg-[#ccff00]' : 'bg-zinc-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.isAllDay ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>

                <div className={`grid grid-cols-2 gap-4 transition-opacity ${formData.isAllDay ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-black tracking-widest mb-2 block uppercase ml-1">Start Time</label>
                    <input 
                      type="time" 
                      required 
                      value={formData.startTime} 
                      onChange={(e) => setFormData({...formData, startTime: e.target.value})} 
                      disabled={formData.isAllDay}
                      className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white font-bold disabled:bg-zinc-900" 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-black tracking-widest mb-2 block uppercase ml-1">End Time</label>
                    <input 
                      type="time" 
                      required 
                      value={formData.endTime} 
                      onChange={(e) => setFormData({...formData, endTime: e.target.value})} 
                      disabled={formData.isAllDay}
                      className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white font-bold disabled:bg-zinc-900" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 font-black tracking-widest mb-2 block uppercase ml-1">Show Title *</label>
                <input type="text" required placeholder="e.g. Club Mix Live" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full bg-black border border-white/10 h-14 rounded-2xl px-5 text-sm focus:border-[#ccff00]/50 outline-none text-white font-bold" />
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 font-black tracking-widest mb-2 block uppercase ml-1">Producer / Host</label>
                <input type="text" placeholder="e.g. DJ Name" value={formData.host} onChange={(e) => setFormData({...formData, host: e.target.value})} className="w-full bg-black border border-white/10 h-14 rounded-2xl px-5 text-sm focus:border-[#ccff00]/50 outline-none text-white font-bold" />
              </div>

              <button type="submit" className="w-full bg-[#ccff00] text-black h-16 rounded-[24px] text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all mt-2 shadow-xl flex items-center justify-center gap-2">
                <Check size={18} /> {editingShowInfo !== null ? 'Update Show Data' : 'Add to Schedule'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
