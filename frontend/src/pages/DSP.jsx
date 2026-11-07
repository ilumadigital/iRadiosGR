import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Activity, ShieldCheck, X, Loader2, Search, PowerOff, AudioWaveform, Speaker, RadioTower, Gauge } from 'lucide-react';

// 🟢 NEW COMPONENT: Professional Frequency Response Curve (Millimeter/SVG)
const DSPCurveVisualizer = ({ preset }) => {
  // Η λογική της καμπύλης με βάση τα ΠΡΑΓΜΑΤΙΚΑ νούμερα του useAudioDSP:
  // Σημεία: [20Hz, 100Hz, 500Hz, 1kHz, 5kHz, 10kHz, 20kHz]
  // 0% = Κάτω τέρμα, 100% = Πάνω τέρμα, 50% = 0dB (Unity Gain)
  const getCurvePoints = () => {
    switch (preset) {
      case 'SOFT': 
        // HPF: 28Hz, LPF: 17800Hz, Makeup: 1.55
        return [30, 65, 75, 70, 75, 65, 30]; 
      
      case 'NORMALIZE': 
        // HPF: 25Hz, LPF: 17500Hz, Makeup: 1.35
        return [35, 60, 65, 65, 65, 60, 35]; 
      
      case 'ULTRABAND': 
        // HPF: 30Hz, LPF: 16500Hz, Makeup: 1.55 (Smiley Face)
        return [25, 80, 50, 45, 60, 75, 20]; 
      
      case 'ULTRA': 
        // HPF: 35Hz, LPF: 16000Hz, Makeup: 1.70 (Massive/Thick)
        return [20, 85, 85, 85, 85, 85, 15]; 
      
      case 'OMNIA': 
        // HPF: 40Hz, LPF: 17500Hz, Makeup: 1.85 (High-end clarity, low bass)
        return [15, 60, 70, 85, 95, 95, 45]; 
      
      case '0DB_LEVELER': 
        // HPF: 30Hz, LPF: 18000Hz, Makeup: 1.8 (Brickwall Limiting, Flat Top)
        return [25, 90, 95, 95, 95, 95, 40]; 
      
      case 'OFF':
      default: 
        // HPF: 10Hz, LPF: 22000Hz, Makeup: 1.0 (True Bypass)
        return [50, 50, 50, 50, 50, 50, 50]; 
    }
  };

  const points = getCurvePoints();
  const isOff = !preset || preset === 'OFF';

  // Μετατροπή των σημείων (0-100) σε συντεταγμένες SVG (Width: 1000, Height: 300)
  // Height είναι αντεστραμμένο (0 είναι πάνω, 300 είναι κάτω)
  const svgWidth = 1000;
  const svgHeight = 300;
  const stepX = svgWidth / (points.length - 1);

  // Δημιουργία ομαλής καμπύλης (Cubic Bezier / Catmull-Rom)
  let pathD = `M 0 ${svgHeight - (points[0] / 100) * svgHeight}`;
  for (let i = 0; i < points.length - 1; i++) {
    const currX = i * stepX;
    const currY = svgHeight - (points[i] / 100) * svgHeight;
    const nextX = (i + 1) * stepX;
    const nextY = svgHeight - (points[i + 1] / 100) * svgHeight;
    
    const cpX1 = currX + stepX / 2;
    const cpY1 = currY;
    const cpX2 = currX + stepX / 2;
    const cpY2 = nextY;
    
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${nextX} ${nextY}`;
  }

  // Για το "γέμισμα" (fill) κάτω από την καμπύλη
  const fillPathD = `${pathD} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;

  return (
    <div className="relative w-full h-[180px] md:h-[240px] bg-[#121212] rounded-2xl border border-white/10 shadow-inner overflow-hidden mb-8 group">
      
      {/* Μιλιμετρέ Background (Grid) */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <rect width="50" height="50" fill="url(#smallGrid)" />
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Axis Labels (Σημάδια για dB και Hz) */}
      <div className="absolute top-2 left-3 flex flex-col justify-between h-[calc(100%-30px)] text-[9px] font-mono text-zinc-500 select-none">
        <span>+12dB</span>
        <span>0dB</span>
        <span>-12dB</span>
      </div>
      <div className="absolute bottom-1 left-0 w-full px-8 flex justify-between text-[9px] font-mono text-zinc-500 select-none">
        <span>20Hz</span>
        <span>100Hz</span>
        <span>500Hz</span>
        <span>1kHz</span>
        <span>5kHz</span>
        <span>10kHz</span>
        <span>20kHz</span>
      </div>

      {/* Active Preset Badge */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-md flex items-center gap-2 z-10">
        <div className={`w-1.5 h-1.5 rounded-full ${isOff ? 'bg-zinc-500' : 'bg-[#ccff00] animate-pulse shadow-[0_0_8px_#ccff00]'}`}></div>
        <span className="text-[10px] font-black uppercase tracking-widest text-white">
          {preset || 'OFF'}
        </span>
      </div>

      {/* Η Καμπύλη (SVG Curve) */}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="absolute inset-0 w-full h-full drop-shadow-2xl" preserveAspectRatio="none">
        {/* Fill με Gradient */}
        <defs>
          <linearGradient id="curveGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={isOff ? '#52525b' : '#ccff00'} stopOpacity={isOff ? "0.1" : "0.3"} />
            <stop offset="100%" stopColor={isOff ? '#52525b' : '#ccff00'} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPathD} fill="url(#curveGradient)" className="transition-all duration-700 ease-in-out" />
        
        {/* Η κύρια γραμμή */}
        <path 
          d={pathD} 
          fill="none" 
          stroke={isOff ? '#52525b' : '#ccff00'} 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="transition-all duration-700 ease-in-out drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]" 
        />
      </svg>
    </div>
  );
};

// 🟢 MAIN COMPONENT: DSP PAGE
export default function DSP({ API_URL, currentUser, onUpdateDSP, resumeDSP }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State για το ποιο preset να δείχνει το Visualizer στην κορυφή της σελίδας
  const [previewPreset, setPreviewPreset] = useState('OFF');

  // Φόρτωση σταθμών
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await fetch(`${API_URL}/stations`);
        const data = await res.json();
        
        if (currentUser?.role === 'admin') {
          setStations(data);
        } else {
          const myId = currentUser?._id || currentUser?.id;
          const myStations = data.filter(s => 
            s.broadcasterId && String(s.broadcasterId) === String(myId)
          );
          setStations(myStations);
          
          // Αν έχει μόνο έναν σταθμό, δείξε το preset του απευθείας στο γράφημα
          if (myStations.length === 1) {
            setPreviewPreset(myStations[0].dspPreset || 'OFF');
          }
        }
      } catch (err) {
        console.error("Σφάλμα φόρτωσης σταθμών DSP", err);
      } finally {
        setLoading(false);
      }
    };
    if (currentUser) fetchStations();
  }, [API_URL, currentUser]);

  const openDSPModal = (station) => {
    setSelectedStation(station);
    setPreviewPreset(station.dspPreset || 'OFF');
    setIsModalOpen(true);
  };

  const handleSaveDSP = async (preset) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('iluma_token');

      const res = await fetch(`${API_URL}/stations/${selectedStation._id}/dsp`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ dspPreset: preset })
      });

      if (res.ok) {
        const updatedStation = await res.json();
        
        setStations(prevStations => 
          prevStations.map(s => s._id === updatedStation._id ? updatedStation : s)
        );
        
        if (onUpdateDSP) {
          onUpdateDSP(updatedStation._id, updatedStation.dspPreset);
        }
        
        setIsModalOpen(false);
        setSelectedStation(null);
        setPreviewPreset(updatedStation.dspPreset || 'OFF');
      } else {
        const errorData = await res.json();
        alert(`Αποτυχία αποθήκευσης DSP: ${errorData.error || 'Server Error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Σφάλμα σύνδεσης");
    } finally {
      setSaving(false);
    }
  };

  const filteredStations = stations.filter(station => 
    station.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-[#ccff00] animate-pulse">Φόρτωση DSP Engine...</div>;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        
        {/* ΤΙΤΛΟΣ */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#ccff00]/10 rounded-xl flex items-center justify-center border border-[#ccff00]/20">
            <SlidersHorizontal className="text-[#ccff00]" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">DSP Engine</h1>
            <p className="text-zinc-400 text-sm">Ρυθμίστε την ψηφιακή επεξεργασία ήχου.</p>
          </div>
        </div>

        {/* ΜΠΑΡΑ ΑΝΑΖΗΤΗΣΗΣ */}
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#ccff00] transition-colors" size={18} />
          <input
            type="text"
            placeholder="Αναζήτηση σταθμού..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/5 h-12 rounded-2xl pl-12 pr-10 text-sm text-white focus:outline-none focus:border-[#ccff00]/30 transition-all shadow-inner"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 🟢 ΤΟ MASTER EQUALIZER VISUALIZER 🟢 */}
      <DSPCurveVisualizer preset={previewPreset} />

      {/* ΛΙΣΤΑ ΣΤΑΘΜΩΝ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStations.map(station => (
          <div 
            key={station._id} 
            onMouseEnter={() => setPreviewPreset(station.dspPreset || 'OFF')} // Αλλάζει το γράφημα στο hover!
            className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 flex flex-col justify-between hover:border-white/10 transition-colors group cursor-default"
          >
            <div className="flex items-center gap-4 mb-6">
              <img src={station.logo} alt={station.name} className="w-16 h-16 rounded-xl object-cover border border-white/10 shadow-md bg-white" />
              <div className="min-w-0">
                <h3 className="font-bold text-white text-lg truncate group-hover:text-[#ccff00] transition-colors">{station.name}</h3>
                <span className={`text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded-lg inline-block mt-1 border ${
                  !station.dspPreset || station.dspPreset === 'OFF' 
                    ? 'text-zinc-500 bg-zinc-900 border-zinc-800' 
                    : 'text-[#ccff00] bg-[#ccff00]/10 border-[#ccff00]/20'
                }`}>
                  {station.dspPreset || 'OFF'}
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => openDSPModal(station)}
              className="w-full bg-white/5 hover:bg-[#ccff00] hover:text-black text-white text-xs font-black uppercase tracking-widest py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <SlidersHorizontal size={14} />
              Ρυθμιση DSP
            </button>
          </div>
        ))}
        
        {stations.length > 0 && filteredStations.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500 font-medium">
            Δεν βρέθηκε σταθμός με το όνομα "{searchTerm}".
          </div>
        )}
        {stations.length === 0 && (
          <div className="col-span-full text-center py-12 text-zinc-500 font-medium">
            Δεν βρέθηκαν σταθμοί προς ρύθμιση.
          </div>
        )}
      </div>

      {/* DSP SELECTION MODAL */}
      {isModalOpen && selectedStation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-zinc-950 border border-white/10 p-6 lg:p-8 rounded-[32px] w-full max-w-2xl relative shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
            
            <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full z-10">
              <X size={20} />
            </button>

            <div className="text-center mb-8 mt-2">
              <h2 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase mb-1">Studio Presets</h2>
              <p className="text-[#ccff00] text-[10px] font-black uppercase tracking-widest">Master Output: {selectedStation.name}</p>
            </div>

            <div className="space-y-4">
              
              {/* 1. OFF / BYPASS PRESET */}
              <button 
                onMouseEnter={() => setPreviewPreset('OFF')} // Δείχνει το preview στο γράφημα πίσω από το modal
                onClick={() => {if (resumeDSP) resumeDSP(); handleSaveDSP('OFF')}} 
                disabled={saving} 
                className={`w-full text-left bg-zinc-900 border p-5 rounded-2xl transition-all group ${selectedStation.dspPreset === 'OFF' ? 'border-white/50' : 'border-white/5 hover:border-zinc-500/50'}`}
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-zinc-700 transition-colors">
                    <PowerOff className="text-zinc-400 group-hover:text-white" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-white">DSP Off (Bypass)</h3>
                </div>
                <p className="text-sm text-zinc-400 pl-14 leading-relaxed">
                  <strong>True Bypass / Unity Gain.</strong> Δεν εφαρμόζεται καμία επεξεργασία. Ο ήχος περνάει 100% αυτούσιος. Είναι η ιδανική επιλογή αν το stream σας έρχεται ήδη τέλεια επεξεργασμένο από το studio.
                </p>
              </button>
              
              {/* 2. SOFT DSP */}
              <button 
                onMouseEnter={() => setPreviewPreset('SOFT')}
                onClick={() => {if (resumeDSP) resumeDSP(); handleSaveDSP('SOFT')}} 
                disabled={saving} 
                className={`w-full text-left bg-zinc-900 border p-5 rounded-2xl transition-all group ${selectedStation.dspPreset === 'SOFT' ? 'border-blue-500' : 'border-white/5 hover:border-blue-500/50'}`}
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20"><ShieldCheck className="text-blue-500" size={20} /></div>
                  <h3 className="text-lg font-bold text-white">Soft (Acoustic / Jazz)</h3>
                </div>
                <p className="text-sm text-zinc-400 pl-14 leading-relaxed">
                  <strong>Φυσικότητα & Δυναμικές.</strong> Πολύ ελαφριά και διάφανη συμπίεση. Διατηρεί ανέπαφη τη φυσική δυναμική περιοχή των οργάνων και των φωνητικών, ιδανικό για Κλασική ή Jazz.
                </p>
              </button>

              {/* 3. NORMALIZE DSP (Recommended) */}
              <button 
                onMouseEnter={() => setPreviewPreset('NORMALIZE')}
                onClick={() => {if (resumeDSP) resumeDSP(); handleSaveDSP('NORMALIZE')}} 
                disabled={saving} 
                className={`w-full text-left bg-zinc-900 border p-5 rounded-2xl transition-all group relative overflow-hidden ${selectedStation.dspPreset === 'NORMALIZE' ? 'border-[#ccff00]' : 'border-white/5 hover:border-[#ccff00]/50'}`}
              >
                <div className="absolute top-0 right-0 bg-[#ccff00] text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">Recommended</div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-[#ccff00]/10 flex items-center justify-center shrink-0 group-hover:bg-[#ccff00]/20"><Activity className="text-[#ccff00]" size={20} /></div>
                  <h3 className="text-lg font-bold text-white">Normalize (General Radio)</h3>
                </div>
                <p className="text-sm text-zinc-400 pl-14 leading-relaxed">
                  <strong>Balanced & Fatigue-Free.</strong> Η πιο ασφαλής επιλογή για τα περισσότερα Web Radios. "Σιδερώνει" γλυκά τις διαφορές έντασης. Παρέχει ένα ξεκούραστο, σταθερό άκουσμα.
                </p>
              </button>

              {/* 4. ULTRABAND DSP */}
              <button 
                onMouseEnter={() => setPreviewPreset('ULTRABAND')}
                onClick={() => {if (resumeDSP) resumeDSP(); handleSaveDSP('ULTRABAND')}} 
                disabled={saving} 
                className={`w-full text-left bg-zinc-900 border p-5 rounded-2xl transition-all group ${selectedStation.dspPreset === 'ULTRABAND' ? 'border-purple-500' : 'border-white/5 hover:border-purple-500/50'}`}
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 group-hover:bg-purple-500/20"><AudioWaveform className="text-purple-500" size={20} /></div>
                  <h3 className="text-lg font-bold text-white">UltraBand (Dance / Hit Radio)</h3>
                </div>
                <p className="text-sm text-zinc-400 pl-14 leading-relaxed">
                  <strong>Club & Electronic Vibes.</strong> Έντονο loudness με βαθύ drive που κάνει τα μπάσα εξαιρετικά συμπαγή. Ειδικά ρυθμισμένο για σύγχρονη χορευτική, Pop, House ή RnB.
                </p>
              </button>

              {/* 5. ULTRA (Behringer Sim) */}
              <button 
                onMouseEnter={() => setPreviewPreset('ULTRA')}
                onClick={() => {if (resumeDSP) resumeDSP(); handleSaveDSP('ULTRA')}} 
                disabled={saving} 
                className={`w-full text-left bg-zinc-900 border p-5 rounded-2xl transition-all group relative overflow-hidden ${selectedStation.dspPreset === 'ULTRA' ? 'border-orange-500' : 'border-white/5 hover:border-orange-500/50'}`}
              >
                 <div className="absolute top-0 right-0 bg-orange-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">Digital Maximizer</div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/20"><Speaker className="text-orange-500" size={20} /></div>
                  <h3 className="text-lg font-bold text-white">Ultra (Massive FM)</h3>
                </div>
                <p className="text-sm text-zinc-400 pl-14 leading-relaxed">
                  <strong>Αναλογικός Όγκος.</strong> Ο κλασικός, τεράστιος ήχος των ερτζιανών. Εφαρμόζει βαθύ compression για να δημιουργήσει έναν "δεμένο" και ζεστό ήχο.
                </p>
              </button>

              {/* 6. OMNIA (CHR/Top 40 Sim) */}
              <button 
                onMouseEnter={() => setPreviewPreset('OMNIA')}
                onClick={() => {if (resumeDSP) resumeDSP(); handleSaveDSP('OMNIA')}} 
                disabled={saving} 
                className={`w-full text-left bg-zinc-900 border p-5 rounded-2xl transition-all group relative overflow-hidden ${selectedStation.dspPreset === 'OMNIA' ? 'border-cyan-500' : 'border-white/5 hover:border-cyan-500/50'}`}
              >
                 <div className="absolute top-0 right-0 bg-cyan-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">Top 40 / CHR</div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20"><RadioTower className="text-cyan-500" size={20} /></div>
                  <h3 className="text-lg font-bold text-white">Omnia (CHR Signature)</h3>
                </div>
                <p className="text-sm text-zinc-400 pl-14 leading-relaxed">
                  <strong>Απόλυτη Διαύγεια.</strong> Ο ήχος γίνεται "γυαλί". Μαζεύει τη "λάσπη" από τις υποσυχνότητες και φέρνει τις φωνές των παραγωγών και τα πρίμα μπροστά. 
                </p>
              </button>

              {/* 7. 0DB LEVELER (Broadcast Standard) */}
              <button 
                onMouseEnter={() => setPreviewPreset('0DB_LEVELER')}
                onClick={() => {if (resumeDSP) resumeDSP(); handleSaveDSP('0DB_LEVELER')}} 
                disabled={saving} 
                className={`w-full text-left bg-zinc-900 border p-5 rounded-2xl transition-all group relative overflow-hidden ${selectedStation.dspPreset === '0DB_LEVELER' ? 'border-emerald-500' : 'border-white/5 hover:border-emerald-500/50'}`}
              >
                 <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">Pro Broadcast</div>
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20"><Gauge className="text-emerald-500" size={20} /></div>
                  <h3 className="text-lg font-bold text-white">0dB Leveler (RMS Boost)</h3>
                </div>
                <p className="text-sm text-zinc-400 pl-14 leading-relaxed">
                  <strong>Μέγιστη Ένταση χωρίς Clipping.</strong> Επαγγελματικό Broadcast AGC. Ενισχύει δραματικά τα χαμηλά streams ώστε να ακούγονται "δυνατά" (0dBFS) με αόρατο Brickwall Limiting.
                </p>
              </button>

            </div>

            {saving && (
              <div className="absolute inset-0 bg-black/80 rounded-[32px] flex items-center justify-center z-10">
                <Loader2 className="animate-spin text-[#ccff00]" size={48} />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
