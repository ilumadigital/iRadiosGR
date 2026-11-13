import React, { useState, useEffect } from 'react';
import { 
  Rocket, Check, Zap, Star, Target, Globe, 
  Sparkles, TrendingUp, Calendar, ShieldCheck, Loader2, X, CreditCard, Radio, AlertTriangle,
  Crown, MousePointer2, BarChart3, ArrowRight, Shield
} from 'lucide-react';

export default function BoostStation({ API_URL, currentUser }) {

  const [period, setPeriod] = useState('month'); 
  const [fetching, setFetching] = useState(true);
  const [myStations, setMyStations] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState('');

  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  const displayPrices = {
    category: { day: 4.90, week: 29.90, two_weeks: 54.90, month: 99.00, year: 890.00 },
    global: { day: 29.00, week: 179.00, two_weeks: 349.00, month: 799.00, year: 8489.00 }
  };

  useEffect(() => {
    const fetchMyStations = async () => {
      if (!currentUser) return;
      setFetching(true);
      try {
        const userId = currentUser._id || currentUser.id;
        const res = await fetch(`${BASE_URL}/broadcaster/${userId}/stations`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setMyStations(data);
          const firstApproved = data.find(s => s.status === 'approved');
          if (firstApproved) setSelectedStationId(firstApproved._id);
        }
      } catch (err) { console.error(err); }
      setFetching(false);
    };
    fetchMyStations();
  }, [currentUser, BASE_URL]);

  const selectedStation = myStations.find(s => s._id === selectedStationId);
  const isSelectedApproved = selectedStation?.status === 'approved';

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden pb-40">
      
      {/* --- BG EFFECTS --- */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-[#ccff00]/5 blur-[120px] rounded-full pointer-events-none opacity-40"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-12 pt-24">
        
        {/* --- HEADER --- */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00] text-[10px] font-black tracking-[0.3em] uppercase mb-10">
            <Rocket size={14} className="animate-pulse" /> Signal Amplifier
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-[0.85] uppercase italic">
            BREAK THE <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] via-green-400 to-emerald-500">ALGORITHM.</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-2xl max-w-2xl mx-auto font-medium leading-relaxed">
            Προβολή για τον σταθμό σου με επιλογή διάρκειας. Οι πληρωμές μέσω Nexi θα ενεργοποιηθούν μετά τις δοκιμές. 
          </p>
        </div>

        {/* --- STATION SELECTOR --- */}
        <div className="max-w-4xl mx-auto mb-20">
           <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 italic">Step 1: Select Your Weapon</h2>
              <span className="text-[10px] font-bold text-[#ccff00] uppercase tracking-widest">{myStations.length} Stations Available</span>
           </div>
           
           {fetching ? (
               <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#ccff00]" size={40} /></div>
           ) : (
               <div className="flex flex-wrap justify-center gap-5">
                   {myStations.map(station => (
                       <button
                           key={station._id}
                           onClick={() => setSelectedStationId(station._id)}
                           className={`group relative flex items-center gap-5 px-8 py-5 rounded-[32px] border transition-all duration-500 ${
                               selectedStationId === station._id 
                               ? 'bg-[#ccff00] border-[#ccff00] text-black shadow-[0_20px_40px_rgba(204,255,0,0.2)] scale-105' 
                               : 'bg-zinc-900/40 border-white/5 text-zinc-500 hover:border-white/20'
                           }`}
                       >
                           <img src={station.logo} alt="" className="w-12 h-12 rounded-2xl object-contain p-1 shadow-2xl bg-white" />
                           <div className="text-left">
                               <span className={`text-sm font-black uppercase tracking-tight block ${selectedStationId === station._id ? 'text-black' : 'text-white'}`}>{station.name}</span>
                               <span className={`text-[10px] font-bold uppercase opacity-60`}>{station.status}</span>
                           </div>
                       </button>
                   ))}
               </div>
           )}
        </div>

        {/* --- DURATION TOGGLE --- */}
        <div className="flex justify-center mb-24 px-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-zinc-900/80 border border-white/10 p-2 rounded-3xl md:rounded-[40px] shadow-2xl w-full max-w-2xl mx-auto">
                {['day', 'week', 'two_weeks', 'month', 'year'].map(p => (
                <button 
                  key={p} 
                  onClick={() => setPeriod(p)} 
                  className={`w-full md:flex-1 px-4 py-4 rounded-2xl md:rounded-[32px] text-[11px] md:text-xs font-black uppercase tracking-widest transition-all ${
                    period === p ? 'bg-[#ccff00] text-black shadow-xl md:scale-105' : 'text-zinc-500 hover:text-white hover:bg-white/5 md:hover:bg-transparent'
                  }`}
                >
                    {p === 'day' ? 'Ημέρα' : p === 'week' ? 'Εβδομάδα' : p === 'two_weeks' ? '2 Εβδομάδες' : p === 'month' ? 'Μήνας' : 'Έτος'}
                </button>
                ))}
            </div>
        </div>

        {/* --- CARDS GRID --- */}
        <div className={`grid lg:grid-cols-2 gap-10 max-w-6xl mx-auto transition-all duration-700 ${!isSelectedApproved ? 'opacity-30 grayscale blur-[2px] pointer-events-none' : 'opacity-100'}`}>
          
          {/* CATEGORY BOOST */}
          <div className="bg-[#0a0a0a] border border-white/5 hover:border-emerald-500/30 rounded-[56px] p-12 transition-all flex flex-col group relative overflow-hidden shadow-xl hover:shadow-emerald-500/10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] rounded-full -mr-32 -mt-32"></div>
            <div className="flex items-center justify-between mb-10">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-3xl flex items-center justify-center border border-emerald-500/10 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                    <Target size={32} />
                </div>
                <div className="text-right">
                    <p className="text-4xl font-black tracking-tighter">{displayPrices.category[period]}€</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Fixed Period</p>
                </div>
            </div>
            <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-6">Category <br/> <span className="text-emerald-500">Sniper</span></h3>
            <p className="text-zinc-500 font-medium mb-10 leading-relaxed">
                Γίνε το No.1 στην κατηγορία σου. Μην περιμένεις να σε βρουν, βγες μπροστά σε όποιον ψάχνει το genre σου.
            </p>
            <div className="space-y-4 mb-12 flex-1">
              {[
                  'Top-3 Ranking στο Category Page', 
                  'Highlighted Search Appearance', 
                  'Double Engagement Probability',
                  'Priority Discovery Algorythm'
                ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-bold text-zinc-300">
                    <Check size={18} className="text-emerald-500 bg-emerald-500/10 rounded-full p-1" /> {f}
                </div>
              ))}
            </div>
            <button type="button" disabled title="Το Boost checkout θα ανοίξει μετά τις δοκιμές Nexi" className="w-full py-6 bg-white text-black rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-[#ccff00] transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-2 relative z-10">
              <TrendingUp size={16} /> ΑΓΟΡΑ ΣΥΝΤΟΜΑ ΜΕ NEXI
            </button>
          </div>

          {/* GLOBAL FEATURED */}
          <div className="bg-gradient-to-br from-[#ccff00]/20 to-black border-2 border-[#ccff00] rounded-[56px] p-12 transition-all flex flex-col relative shadow-[0_0_60px_rgba(204,255,0,0.1)] group">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#ccff00] text-black text-[10px] font-black px-8 py-2 rounded-full shadow-2xl tracking-[0.2em]">GOD MODE</div>
            <div className="flex items-center justify-between mb-10">
                <div className="w-16 h-16 bg-black text-[#ccff00] rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                    <Globe size={32} />
                </div>
                <div className="text-right">
                    <p className="text-4xl font-black tracking-tighter text-[#ccff00]">{displayPrices.global[period]}€</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Premium Placement</p>
                </div>
            </div>
            <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-6">Global <br/> <span className="text-[#ccff00]">Dominator</span></h3>
            <p className="text-zinc-300 font-medium mb-10 leading-relaxed">
                Η απόλυτη έκθεση. Ο σταθμός σου στην κεντρική βιτρίνα του iRadios. Όλος ο κόσμος θα σε βλέπει με το που ανοίγει την εφαρμογή.
            </p>
            <div className="space-y-4 mb-12 flex-1">
              {[
                  'Home Page Hero Slider (Slot 1-3)', 
                  'Featured Badge σε όλο το Network', 
                  '5x Traffic Boost Guaranteed',
                  'Auto-Promotion στα Social Labs μας'
                ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-black text-white">
                    <Sparkles size={18} className="text-[#ccff00] fill-[#ccff00]/20" /> {f}
                </div>
              ))}
            </div>
            <button type="button" disabled title="Το Boost checkout θα ανοίξει μετά τις δοκιμές Nexi" className="w-full py-6 bg-[#ccff00] text-black rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-white transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-2 relative z-10">
                <Crown size={16} /> ΑΓΟΡΑ ΣΥΝΤΟΜΑ ΜΕ NEXI
            </button>
          </div>
        </div>

        {/* --- PENDING WARNING --- */}
        {!fetching && selectedStation && !isSelectedApproved && (
            <div className="max-w-2xl mx-auto mt-20 bg-amber-500/10 border border-amber-500/20 p-8 rounded-[40px] flex flex-col items-center text-center gap-4">
                <AlertTriangle className="text-amber-500 mb-2" size={48} />
                <h4 className="text-xl font-black uppercase italic tracking-tighter">Station Under Review</h4>
                <p className="text-zinc-400 text-sm font-medium max-w-md">
                    Ο σταθμός <span className="text-white">"{selectedStation.name}"</span> δεν έχει εγκριθεί ακόμα. 
                    Μπορείς να ενεργοποιήσεις το Boost μόλις η ομάδα του iRadios επιβεβαιώσει το stream σου. 
                </p>
                <div className="flex gap-2 items-center px-4 py-2 bg-amber-500/10 rounded-full text-[10px] font-black text-amber-500 uppercase">
                    <Shield size={12} /> Verification in Progress
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
