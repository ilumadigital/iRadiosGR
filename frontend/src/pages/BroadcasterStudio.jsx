import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti'; 
import { 
  Radio, BarChart3, SlidersHorizontal, Activity, 
  Mic2, ArrowRight, Play, Clock, Zap, ShieldCheck,
  PlusCircle, Edit, Globe, X, Loader2, TrendingUp, Users, Megaphone, RefreshCw,
  UserPlus, Trash2, Mail, User, MapPin, Volume2, Code2, Copy, CheckCircle2
} from 'lucide-react';

export default function BroadcasterStudio({ 
  currentUser, API_URL, 
  currentStation, isPlaying, analyser 
}) {
  const navigate = useNavigate();
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localAds, setLocalAds] = useState([]);

  // 🟢 BACKGROUND CURVE ΓΙΑ ΤΟ DSP MODULE
const getDSPBackgroundCurve = (preset) => {
  const getCurvePoints = () => {
    switch (preset) {
      case 'SOFT': return [30, 65, 75, 70, 75, 65, 30]; 
      case 'NORMALIZE': return [35, 60, 65, 65, 65, 60, 35]; 
      case 'ULTRABAND': return [25, 80, 50, 45, 60, 75, 20]; 
      case 'ULTRA': return [20, 85, 85, 85, 85, 85, 15]; 
      case 'OMNIA': return [15, 60, 70, 85, 95, 95, 45]; 
      case '0DB_LEVELER': return [25, 90, 95, 95, 95, 95, 40]; 
      case 'HomeTheater': return [25, 65, 50, 45, 55, 65, 25]; 
      case 'HiRes': return [55, 55, 55, 55, 50, 45, 40]; 
      case 'Immersive3D': return [45, 55, 60, 60, 45, 30, 20]; 
      case 'OFF':
      default: return [50, 50, 50, 50, 50, 50, 50]; 
    }
  };

  const points = getCurvePoints();
  const svgWidth = 1000;
  const svgHeight = 300;
  const stepX = svgWidth / (points.length - 1);

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
  return { pathD, fillPathD: `${pathD} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z` };
};

  // STATE ΓΙΑ PRODUCERS
  const [producers, setProducers] = useState([]);
  const [showProducerModal, setShowProducerModal] = useState(false);
  const [producerFormLoading, setProducerFormLoading] = useState(false);
  const [producerForm, setProducerForm] = useState({ email: '', fname: '', lname: '', stationId: '' });

  // dB METER STATE
  const [dbLevel, setDbLevel] = useState(-100);

  // WIDGET BUILDER STATE
  const [selectedWidgetStation, setSelectedWidgetStation] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const features = currentUser?.broadcasterProfile?.features || {};
  // Never trust a cached feature flag: the analytics API verifies active
  // station-level entitlements on every request.
  const [analyticsUnlocked, setAnalyticsUnlocked] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('all');
  const [analyticsStationId, setAnalyticsStationId] = useState('');
  const [analyticsError, setAnalyticsError] = useState('');
  const hasAnalytics = analyticsUnlocked || currentUser?.role === 'admin';
  const hasDSP = features.dspEngine || currentUser?.role === 'admin';
  const isPremium = currentUser?.isPremium || currentUser?.broadcasterProfile?.tier === 'premium';
  const [widgetType, setWidgetType] = useState('player');

  // STREAM HEALTH STATE
  const [streamHealth, setStreamHealth] = useState({
    status: 'idle',
    latency: 0
  });

  const [analytics, setAnalytics] = useState({
    liveListeners: 0,
    avgListenTime: "0m 0s",
    topOrigins: [],
    liveLocations: [],
    totalSessions: 0, totalPlays: 0, stations: [], period: 'all',
    adStats: { totalPlays: 0, totalClicks: 0, topAd: "No Data" }
  });

  // --- 💡 GREETING LOGIC ---
  const getVocativeName = (name) => {
    if (!name) return 'Φίλε';
    let n = name.trim();
    if (n.endsWith('ος') || n.endsWith('ός') || n.endsWith('ης') || n.endsWith('ής') || n.endsWith('ας') || n.endsWith('άς')) {
      return n.slice(0, -1); 
    }
    return n;
  };

  const { finalGreeting, isBirthday } = useMemo(() => {
    if (!currentUser) return { finalGreeting: "Καλωσήρθες στο Studio", isBirthday: false };
    const now = new Date();
    const hour = now.getHours();
    let bday = false;
    if (currentUser?.birthdate) {
      const userBday = new Date(currentUser.birthdate);
      if (userBday.getDate() === now.getDate() && userBday.getMonth() === now.getMonth()) {
        bday = true;
      }
    }
    const friendlyName = getVocativeName(currentUser.fname);
    if (bday) return { finalGreeting: `🎂 Χρόνια Πολλά, ${friendlyName}!`, isBirthday: true };
    let text = "Γειά σου";
    if (hour >= 5 && hour < 12) text = "Καλημέρα";
    else if (hour >= 17 && hour < 21) text = "Καλησπέρα";
    return { finalGreeting: `${text}, ${friendlyName}`, isBirthday: false };
  }, [currentUser]);

  useEffect(() => {
    if (isBirthday) {
      const duration = 4 * 1000;
      const end = Date.now() + duration;
      (function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ccff00', '#ffffff', '#3b82f6'] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ccff00', '#ffffff', '#3b82f6'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      }());
    }
  }, [isBirthday]);

  // LIVE dB METER LOGIC
  useEffect(() => {
    let interval;
    const isMyStation = currentStation && stations.some(s => s._id === currentStation._id);

    if (isPlaying && isMyStation && analyser) {
      const dataArray = new Float32Array(analyser.fftSize);
      interval = setInterval(() => {
        analyser.getFloatTimeDomainData(dataArray);
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -100;
        setDbLevel(db);
      }, 1000);
    } else {
      setDbLevel(-100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentStation, analyser, stations]);


  const loadProducers = async () => {
    if (!currentUser || currentUser.role !== 'broadcaster') return;
    try {
      const token = localStorage.getItem('iluma_token'); 
      const res = await fetch(`${API_URL}/producers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducers(data);
      }
    } catch (err) { console.error("Error loading producers:", err); }
  };

  const loadData = async () => {
    if (!currentUser) return;
    try {
      const userId = currentUser._id || currentUser.id;
      const res = await fetch(`${API_URL}/broadcaster/${userId}/stations`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setStations(data);
        if (data.length > 0) setSelectedWidgetStation(data[0]); // Set default widget station
      }

      if (features.adControl) {
        const adRes = await fetch(`${API_URL}/broadcaster/${userId}/ads`);
        const adData = await adRes.json();
        if (Array.isArray(adData)) setLocalAds(adData);
      }
    } catch (err) { console.error("Error loading stations:", err); }
    setLoading(false);
  };

  const fetchAnalytics = async (signal) => {
    if (!currentUser) return;
    const params = new URLSearchParams({period: analyticsPeriod});
    if (analyticsStationId) params.set('stationId', analyticsStationId);
    try {
      const res = await fetch(`${API_URL}/broadcaster/${currentUser._id || currentUser.id}/analytics?${params}`, {signal});
      if (signal?.aborted) return;
      if (res.status === 403) {
        setAnalyticsUnlocked(false);
        setAnalyticsError('');
        return;
      }
      if (!res.ok) throw new Error('Δεν ήταν δυνατή η ανάκτηση των Analytics.');
      const data = await res.json();
      if (signal?.aborted) return;
      setAnalytics(data);
      setAnalyticsUnlocked(true);
      setAnalyticsError('');
    } catch (err) {
      if (err?.name !== 'AbortError' && !signal?.aborted)
        setAnalyticsError(err?.message || 'Προσωρινό σφάλμα Analytics.');
    }
  };

  useEffect(() => {
    loadData();
    loadProducers();
  }, [currentUser, API_URL]);

  useEffect(() => {
    if (!currentUser) return;
    const controller = new AbortController();
    const refresh = () => fetchAnalytics(controller.signal);
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [currentUser?._id, API_URL, analyticsPeriod, analyticsStationId]);

  useEffect(() => {
    if (stations.length > 0 && streamHealth.status === 'idle') {
      const pingStream = async () => {
        setStreamHealth(prev => ({ ...prev, status: 'checking' }));
        const primaryStream = stations[0].stream;
        const startTime = Date.now();
        
        try {
          const res = await fetch(`${API_URL}/metadata?stream=${encodeURIComponent(primaryStream)}`);
          const latency = Date.now() - startTime;
          if (res.ok) setStreamHealth({ status: 'online', latency });
          else setStreamHealth({ status: 'offline', latency: 0 });
        } catch (e) {
          setStreamHealth({ status: 'offline', latency: 0 });
        }
      };
      pingStream();
    }
  }, [stations, streamHealth.status, API_URL]);

  const getCurrentShow = (schedule) => {
      if (!schedule || schedule.length === 0) return null;

      // 1. Παίρνουμε την ΑΚΡΙΒΗ ημερομηνία και ώρα Αθήνας
      const now = new Date();
      const athensDateString = now.toLocaleString('en-US', { timeZone: 'Europe/Athens' });
      const athensDate = new Date(athensDateString);

      // 2. Τρέχουσα ώρα σε λεπτά (0-1439)
      const currentTime = athensDate.getHours() * 60 + athensDate.getMinutes();
      
      // 3. Παίρνουμε την ημέρα της JS (0 = Κυριακή, 1 = Δευτέρα, ..., 6 = Σάββατο)
      const jsDay = athensDate.getDay(); 

      // 🟢 ΤΟ FIX ΜΕ ΤΟ -1: Μετατρέπουμε την ημέρα της JS στο δικό σου format 
      // (Όπου 0 = Δευτέρα, 1 = Τρίτη ... 6 = Κυριακή)
      const currentDbDay = jsDay === 0 ? 6 : jsDay - 1;
      
      // Βρίσκουμε και ποια ήταν η χθεσινή μέρα (για τις νυχτερινές εκπομπές)
      const prevDbDay = currentDbDay === 0 ? 6 : currentDbDay - 1;

      return schedule.find(item => {
          const showDay = parseInt(item.day);

          // Ελέγχουμε αν η εκπομπή είναι καταχωρημένη για τη σημερινή ή τη χθεσινή μέρα
          const isToday = showDay === currentDbDay;
          const isYesterday = showDay === prevDbDay;

          if (!isToday && !isYesterday) return false;

          // Μετατροπή ώρας εκπομπής σε λεπτά
          const [startH, startM] = item.startTime.split(':').map(Number);
          const [endH, endM] = item.endTime.split(':').map(Number);
          const startTotal = startH * 60 + startM;
          const endTotal = endH * 60 + endM;

          // Είναι μεταμεσονύχτια εκπομπή; (π.χ. 22:00 - 02:00)
          const isOvernight = startTotal > endTotal;

          if (isToday) {
              if (!isOvernight) {
                  // Κανονική εκπομπή (π.χ. 10:00 - 12:00)
                  return currentTime >= startTotal && currentTime < endTotal;
              } else {
                  // Νυχτερινή εκπομπή που ξεκίνησε ΣΗΜΕΡΑ το βράδυ
                  return currentTime >= startTotal;
              }
          } else if (isYesterday && isOvernight) {
              // Νυχτερινή εκπομπή που ξεκίνησε ΧΘΕΣ το βράδυ και παίζει ακόμα
              return currentTime < endTotal;
          }

          return false;
      });
  };

  const handleInviteProducer = async (e) => {
    e.preventDefault();
    setProducerFormLoading(true);
    try {
      const token = localStorage.getItem('iluma_token');
      const res = await fetch(`${API_URL}/producers/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(producerForm)
      });
      
      const data = await res.json();
      if (res.ok) {
        alert("Η πρόσκληση εστάλη επιτυχώς!");
        setShowProducerModal(false);
        setProducerForm({ email: '', fname: '', lname: '', stationId: '' });
        loadProducers();
      } else {
        alert(data.message || "Προέκυψε σφάλμα.");
      }
    } catch (err) {
      alert("Σφάλμα δικτύου.");
    }
    setProducerFormLoading(false);
  };

  const handleRemoveProducer = async (id) => {
    if (!window.confirm("Είστε σίγουροι ότι θέλετε να ανακαλέσετε την πρόσβαση σε αυτόν τον παραγωγό;")) return;
    try {
      const token = localStorage.getItem('iluma_token');
      const res = await fetch(`${API_URL}/producers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadProducers();
      }
    } catch (err) { alert("Σφάλμα κατά τη διαγραφή."); }
  };

  const handleCopyWidgetCode = () => {
    if (!selectedWidgetStation) return;
    const code = `<script src="__IRADIOS_SITE_ORIGIN__/widget.js" data-station="${selectedWidgetStation.slug || selectedWidgetStation._id}"></script>`;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 5000);
  };

  if (loading) return <div className="p-10 text-[#ccff00] animate-pulse font-black uppercase tracking-widest text-center mt-20">Initializing Studio...</div>;

  return (
    <div className="w-full max-w-[1400px] mx-auto p-4 md:p-8 space-y-10 animate-fade-in pb-40">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
        <div className="animate-in slide-in-from-left duration-700">
          <h1 className="text-3xl md:text-3xl font-black text-white tracking-tighter flex flex-wrap items-center gap-x-4">
            <div className="w-12 h-12 bg-[#ccff00] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(204,255,0,0.3)]">
              <Mic2 size={24} className="text-black" />
            </div>
            <span>{finalGreeting}</span>
            <span className="text-[#ccff00]">To Studio σου</span>
          </h1>
          <p className="text-zinc-500 font-bold mt-2 uppercase tracking-widest text-[10px] flex items-center gap-2">
            <Activity size={12} className="text-[#ccff00]" /> 
            iRadios Broadcasters Control Center
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setLoading(true);
              loadData();
              if (hasAnalytics) fetchAnalytics();
              loadProducers();
            }}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-[#ccff00] p-4 rounded-2xl border border-white/5 transition-all active:scale-90 group"
            title="Refresh Dashboard"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
          </button>
          
          <button onClick={() => navigate('/my-radios')} className="bg-[#ccff00] text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-transform active:scale-95 shadow-[0_15px_35px_rgba(204,255,0,0.2)] flex items-center gap-2">
            <PlusCircle size={18} /> New Station
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 📻 STATION MANAGEMENT */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Radio size={16} /> Active Radio Units
            </h3>
            <span className="text-[10px] bg-zinc-900 text-zinc-500 px-3 py-1 rounded-full border border-white/5 font-bold uppercase tracking-widest">
              Total: {stations.length}
            </span>
          </div>
          
          {stations.length === 0 ? (
            <div className="bg-zinc-900/30 border border-white/5 p-16 rounded-[40px] text-center">
              <p className="text-zinc-500 font-medium mb-6">No active stations found.</p>
              <button onClick={() => navigate('/my-radios')} className="bg-white text-black px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest">Deploy Unit</button>
            </div>
          ) : (
            stations.map(station => {
              const currentShow = getCurrentShow(station.schedule);
              const stationPath = `/station/${station.slug || station._id}`;
              return (
                <div key={station._id} className="bg-zinc-900/40 border border-white/5 hover:border-[#ccff00]/30 transition-all p-6 rounded-[32px] flex flex-col md:flex-row items-center gap-6 group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#ccff00] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <img src={station.logo} alt="" onClick={() => navigate(stationPath)} className="w-24 h-24 rounded-2xl object-cover bg-white p-1 shadow-2xl group-hover:scale-105 transition-transform shrink-0 cursor-pointer" />
                  <div className="flex-1 text-center md:text-left min-w-0">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                      <h4 onClick={() => navigate(stationPath)} className="text-2xl font-black text-white truncate cursor-pointer hover:text-[#ccff00] transition-colors">{station.name}</h4>
                      {station.status === 'approved' && <ShieldCheck size={18} className="text-emerald-500" />}
                    </div>
                    
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate mb-3 flex items-center justify-center md:justify-start flex-wrap gap-2">
                       <span className={`px-2 py-0.5 rounded-md border ${station.transmissionType === 'Επίγειο' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : station.transmissionType === 'DAB' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                         {station.transmissionType || 'Web Radio'} {station.frequency && `- ${station.frequency}`}
                       </span>
                       {station.genre} • {station.city ? `${station.city}, ${station.region}` : station.region}
                    </p>

                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl max-w-sm mb-4">
                      {currentShow ? (
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">On Air Now</p>
                            <h5 className="text-sm font-black text-white truncate uppercase italic leading-none mb-1">{currentShow.title}</h5>
                            <p className="text-[10px] text-zinc-400 font-bold truncate">Host: {currentShow.host || 'Auto-DJ'}</p>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => navigate('/my-schedules')} className="text-[10px] font-black text-zinc-600 hover:text-[#ccff00] uppercase tracking-widest flex items-center gap-2 transition-colors">
                          <PlusCircle size={14} /> Προσθεσε προγραμμα σταθμου
                        </button>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${station.dspPreset !== 'OFF' ? 'bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20' : 'bg-zinc-800 text-zinc-500'}`}>DSP: {station.dspPreset || 'OFF'}</span>
                      {station.boostStatus && <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-orange-500/20 text-orange-400 flex items-center gap-1 animate-pulse"><Zap size={10} /> Boosted</span>}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full md:w-auto shrink-0">
                    <button onClick={() => navigate('/my-radios')} className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"><Edit size={14} /> Manage</button>
                    <button onClick={() => navigate('/boost-my-station')} className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 shadow-lg flex items-center justify-center gap-2"><Zap size={14} /> Boost</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 🟢 AIR TRAFFIC & STREAM HEALTH */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity size={16} /> Air Traffic
            </h3>
            <button 
              onClick={() => setStreamHealth(prev => ({ ...prev, status: 'idle' }))}
              disabled={streamHealth.status === 'checking' || stations.length === 0}
              className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={streamHealth.status === 'checking' ? 'animate-spin' : ''} />
              Recheck
            </button>
          </div>

          <div className={`border rounded-[40px] p-8 relative overflow-hidden group transition-all duration-500 ${
            streamHealth.status === 'offline' ? 'bg-red-950/20 border-red-500/20' : 
            streamHealth.status === 'checking' ? 'bg-zinc-900 border-white/5' : 
            'bg-zinc-900 border-white/5'
          }`}>
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full group-hover:scale-125 transition-transform duration-700 ${
              streamHealth.status === 'online' ? 'bg-emerald-500/5' : 
              streamHealth.status === 'offline' ? 'bg-red-500/10' : 'bg-blue-500/5'
            }`}></div>
            
            <div className="flex items-center gap-2 mb-6">
              <span className="relative flex h-3 w-3">
                {streamHealth.status === 'checking' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  streamHealth.status === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 
                  streamHealth.status === 'offline' ? 'bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse' : 'bg-blue-500'
                }`}></span>
              </span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                streamHealth.status === 'online' ? 'text-emerald-500' : 
                streamHealth.status === 'offline' ? 'text-red-500' : 'text-blue-500'
              }`}>
                {streamHealth.status === 'checking' ? 'Pinging Server...' : 
                 streamHealth.status === 'online' ? 'Stream Online' : 
                 streamHealth.status === 'offline' ? 'Stream Offline' : 'Awaiting Data'}
              </span>
            </div>

            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2">Network Health</p>
            <h4 className={`text-2xl font-black leading-tight mb-2 uppercase italic tracking-tighter ${
              streamHealth.status === 'offline' ? 'text-red-400' : 'text-white'
            }`}>
               {streamHealth.status === 'online' ? 'EXCELLENT' : 
                streamHealth.status === 'offline' ? 'CONNECTION FAILED' : 'CHECKING...'}
            </h4>
            
            <div className="flex items-center gap-3 mt-6 mb-8">
               <div className="bg-black/50 border border-white/5 rounded-xl px-3 py-2 flex-1">
                 <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Latency</p>
                 <p className="text-sm font-black text-white">{streamHealth.status === 'online' ? `${streamHealth.latency}ms` : '--'}</p>
               </div>
               <div className="bg-black/50 border border-white/5 rounded-xl px-3 py-2 flex-1 truncate">
                 <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-0.5">Target</p>
                 <p className="text-sm font-black text-zinc-400 truncate">{stations.length > 0 ? stations[0].name : 'None'}</p>
               </div>
            </div>

            <div className="border-t border-white/5 pt-6">
              <button onClick={() => navigate('/my-schedules')} className="w-full py-3 bg-white/5 hover:bg-[#ccff00]/10 hover:text-[#ccff00] text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">Update Master Schedule</button>
            </div>
          </div>
        </div>
      </div>

      {/* 🧩 WIDGET GENERATOR */}
      <div className="mt-12">
        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
          <Code2 size={16} /> Web Player Widget
        </h3>
        
        <div className="relative w-full rounded-[50px] overflow-hidden border bg-black border-white/5 transition-all duration-500">
          
          <div className="p-8 md:p-12">
            <div className="flex flex-col lg:flex-row gap-12">
              
              {/* Αριστερή Στήλη (Controls & Code) */}
              <div className="flex-1 space-y-8">
                <div>
                  <h4 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Widget Builder</h4>
                  <p className="text-zinc-400 text-sm">Δημιουργήστε το Player Widget του σταθμού σας για το website σας.</p>
                </div>

                {stations.length > 1 && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Επιλογη Σταθμου</label>
                    <div className="flex flex-wrap gap-2">
                      {stations.map(st => (
                        <button
                          key={st._id}
                          onClick={() => setSelectedWidgetStation(st)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            selectedWidgetStation?._id === st._id 
                              ? 'bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]' 
                              : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {st.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedWidgetStation && (
                  <div className="space-y-6">
                    
                    {/* 🟢 ΝΕΟ: ΕΠΙΛΟΓΗ ΤΥΠΟΥ WIDGET & HD+ INFO */}
                    <div className="space-y-3">
                      
                      {/* Τίτλος & Badge */}
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <span>Τυπος Widget</span>
                        {/* Χρησιμοποιούμε τις μεταβλητές isPremium / hasDSP που όρισες */}
                        {(isPremium || hasDSP) && (
                          <span className="bg-[#ccff00]/20 text-[#ccff00] px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border border-[#ccff00]/30 shadow-[0_0_10px_rgba(204,255,0,0.1)]">
                            HD+ Audio Active
                          </span>
                        )}
                      </label>

                      {/* Buttons Επιλογής */}
                      <div className="flex bg-zinc-900 rounded-xl p-1 w-fit border border-white/5">
                        <button
                          onClick={() => setWidgetType('player')}
                          className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${
                            widgetType === 'player' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          Full Player
                        </button>
                        <button
                          onClick={() => setWidgetType('metadata')}
                          className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${
                            widgetType === 'metadata' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          Metadata Only
                        </button>
                      </div>

                      {/* Περιγραφή για το DSP αν ο χρήστης το δικαιούται ΚΑΙ έχει επιλέξει Full Player */}
                      {(isPremium || hasDSP) && widgetType === 'player' && (
                        <div className="mt-4 p-4 bg-[#ccff00]/5 border border-[#ccff00]/20 rounded-xl flex items-start gap-3">
                          <div className="shrink-0 mt-0.5 text-[#ccff00]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white mb-1">Ο Player σας διαθέτει ενσωματωμένο DSP</p>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                              Ως {isPremium ? 'Premium' : 'PRO'} Broadcaster, οι ρυθμίσεις <b>DSP Engine</b> που επιλέγετε από το μενού μεταφέρονται αυτόματα στον player. Οι ακροατές σας στο website σας θα απολαμβάνουν HD ήχο, χωρίς καμία επιπλέον ρύθμιση.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="text-[10px] font-black text-zinc-500 tracking-widest flex items-center justify-between">
                        <span>Κώδικας HTML (Responsive Widget)</span>
                        <span className="text-emerald-500 text-[9px]">Max 600px Desktop / 100% Mobile</span>
                      </label>
                      
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-lg opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        
                        {/* ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΣΤΟ STUDIO */}
                        <div className="relative bg-zinc-950 border border-white/10 rounded-2xl p-4 font-mono text-[10px] leading-relaxed text-zinc-400 break-all overflow-y-auto custom-scrollbar flex items-center h-40">
                          <code>
                            &lt;iframe <br/>
                            &nbsp;&nbsp;src="__IRADIOS_SITE_ORIGIN__/{widgetType === 'player' ? 'widget' : 'widget-now'}/{selectedWidgetStation.slug || selectedWidgetStation._id}{widgetType === 'player' ? '?autoplay=true' : ''}" <br/>
                            &nbsp;&nbsp;width="100%" <br/>
                            &nbsp;&nbsp;frameborder="0" <br/>
                            &nbsp;&nbsp;allow="{widgetType === 'player' ? 'autoplay; encrypted-media; clipboard-write;' : 'autoplay'}" <br/>
                            &nbsp;&nbsp;style="border:none; width: 100%; max-width: 600px; aspect-ratio: 1 / 1; margin: 0 auto; display: block; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border-radius: 32px; overflow: hidden;"<br/>
                            &gt;&lt;/iframe&gt;
                          </code>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          const stationRef = selectedWidgetStation.slug || selectedWidgetStation._id;
                          const route = widgetType === 'player' ? 'widget' : 'widget-now';
                          const autoplayParam = widgetType === 'player' ? '?autoplay=true' : '';
                          const allowParam = widgetType === 'player' ? 'autoplay; encrypted-media; clipboard-write;' : 'autoplay';
                          
                          const code = `<iframe src="__IRADIOS_SITE_ORIGIN__/${route}/${stationRef}${autoplayParam}" width="100%" frameborder="0" allow="${allowParam}" style="border:none; width: 100%; max-width: 600px; aspect-ratio: 1 / 1; margin: 0 auto; display: block; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border-radius: 32px; overflow: hidden;"></iframe>`;
                          
                          navigator.clipboard.writeText(code);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${
                          copiedCode ? 'bg-emerald-500 text-black' : 'bg-white text-black hover:bg-zinc-200 active:scale-95'
                        }`}
                      >
                        {copiedCode ? <><CheckCircle2 size={16} /> Αντιγραφηκε!</> : <><Copy size={16} /> Αντιγραφη Κωδικα</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Δεξιά Στήλη (Live Preview) */}
              {selectedWidgetStation && (
                <div className="shrink-0 flex flex-col items-center">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 flex justify-between w-full">
                    <span>Live Preview</span>
                    <span className="text-[#ccff00]">{widgetType === 'player' ? 'Full Player' : 'Metadata Only'}</span>
                  </p>
                  <div className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] md:w-[500px] md:h-[500px] bg-zinc-900 rounded-[32px] overflow-hidden border-4 border-zinc-800 shadow-2xl relative flex items-center justify-center">
                    <iframe 
                      // 🟢 Αλλάζει το URL του iframe δυναμικά
                      src={`${window.location.origin}/${widgetType === 'player' ? 'widget' : 'widget-now'}/${selectedWidgetStation.slug || selectedWidgetStation._id}`} 
                      className="w-full h-full border-0"
                      title="Widget Preview"
                    />
                    {/* Overlay για αποφυγή ανεπιθύμητου ήχου μέσα στο studio */}
                    <div className="absolute inset-0 z-50 cursor-not-allowed" title="Preview is view-only"></div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* 👥 TEAM & PRODUCERS MANAGEMENT */}
      {currentUser?.role === 'broadcaster' && (
        <div className="mt-12 space-y-6">
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Users size={16} /> Team & Producers
            </h3>
            <button 
              onClick={() => setShowProducerModal(true)}
              className="bg-white/10 hover:bg-[#ccff00] hover:text-black text-white px-5 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2"
            >
              <UserPlus size={14} /> Add Producer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {producers.length === 0 ? (
              <div className="col-span-full p-12 border border-white/5 rounded-[32px] bg-zinc-900/20 text-center">
                <Users size={40} className="mx-auto text-zinc-700 mb-4" />
                <p className="text-zinc-400 font-medium text-sm mb-2">Δεν έχετε προσθέσει παραγωγούς ακόμα.</p>
                <p className="text-zinc-600 text-[10px] font-bold uppercase">Προσκαλέστε συνεργάτες για να διαχειρίζονται το πρόγραμμα του σταθμού.</p>
              </div>
            ) : (
              producers.map(p => (
                <div key={p._id} className="bg-black border border-white/5 p-6 rounded-[32px] flex items-center justify-between group hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center shrink-0 border border-white/10">
                      <User size={20} className="text-zinc-500" />
                    </div>
                    <div>
                      <h4 className="text-white font-black text-sm">{p.fname} {p.lname}</h4>
                      <p className="text-zinc-500 text-[10px] font-bold uppercase">{p.email}</p>
                      <p className="text-[#ccff00] text-[10px] font-bold mt-1.5 truncate max-w-[150px] flex items-center gap-1">
                         <Radio size={10} /> {p.assignedStation?.name || 'Άγνωστος Σταθμός'}
                      </p>
                      {!p.isVerified && (
                        <span className="text-orange-400 text-[9px] uppercase font-black bg-orange-400/10 px-2 py-0.5 rounded-full mt-2 inline-block">
                          Εκκρεμεί Αποδοχή
                        </span>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveProducer(p._id)} 
                    className="text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-colors p-3 rounded-2xl shrink-0"
                    title="Ανάκληση Πρόσβασης"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 📊 REAL-TIME ANALYTICS */}
      <div className="mt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2"><BarChart3 size={16} /> Audience Radar</h3>
          {hasAnalytics && <div className="flex flex-wrap gap-2">
            <select aria-label="Σταθμός Analytics" value={analyticsStationId}
              onChange={event=>setAnalyticsStationId(event.target.value)}
              className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white">
              <option value="">Όλοι οι διαθέσιμοι σταθμοί</option>
              {(analytics.stations||[]).map(station=><option key={station.id} value={station.id}>{station.name}</option>)}
            </select>
            <select aria-label="Περίοδος Analytics" value={analyticsPeriod}
              onChange={event=>setAnalyticsPeriod(event.target.value)}
              className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white">
              <option value="all">Συνολικά</option>
              <option value="7d">Τελευταίες 7 ημέρες</option>
              <option value="30d">Τελευταίες 30 ημέρες</option>
              <option value="90d">Τελευταίες 90 ημέρες</option>
            </select>
          </div>}
        </div>
        {hasAnalytics && analyticsError && <p role="alert" className="mb-4 text-xs text-amber-400">{analyticsError} Εμφανίζονται οι τελευταίες διαθέσιμες μετρήσεις.</p>}
        {hasAnalytics && <p className="mb-4 text-xs text-zinc-500">Οι ακροάσεις είναι εκτιμήσεις από το iRadios player, όχι μετρήσεις του stream host. Οι περίοδοι 7/30/90 ημερών περιέχουν μόνο δεδομένα που συλλέχθηκαν από την ενεργοποίηση της νέας καταγραφής (UTC).</p>}
        <div className={`relative w-full rounded-[50px] overflow-hidden border border-white/5 transition-all duration-500 ${!hasAnalytics ? 'min-h-[450px] flex items-center justify-center' : 'bg-zinc-900/20'}`}>
          {!hasAnalytics && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-6 md:p-12">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-[25px]"></div>
              <div className="relative z-40 w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 mb-6 shadow-[0_0_50px_rgba(59,130,246,0.25)]"><BarChart3 size={40} className="text-blue-400" /></div>
                  <h3 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">Audience <span className="text-blue-500">Radar</span></h3>
                  <p className="text-zinc-400 text-sm md:text-lg font-medium max-w-lg mx-auto md:mx-0">Ξεκλειδώστε τα data. Δείτε live ακροατές, γεωγραφική κατανομή και avg listen time σε πραγματικό χρόνο.</p>
                </div>
                <button onClick={() => navigate('/upgrade-station')} className="shrink-0 bg-[#ccff00] text-black px-12 py-6 rounded-[28px] font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 shadow-2xl flex items-center gap-4">Ενεργοποιηση με 6.99€ <ArrowRight size={22} /></button>
              </div>
            </div>
          )}
          
          <div className={`w-full transition-all duration-500 p-8 md:p-12 ${!hasAnalytics ? 'opacity-10 blur-xl pointer-events-none select-none' : 'opacity-100'}`}>
              
              {/* PRIMARY ANALYTICS ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <div className="bg-black border border-white/5 p-8 rounded-[32px] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Active Listeners</span>
                    <Users size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="flex items-end gap-3">
                    <h4 className="text-6xl font-black text-white leading-none tracking-tighter">{analytics.liveListeners}</h4>
                    <span className="text-emerald-500 text-[10px] font-black mb-1 animate-pulse flex items-center gap-1"><TrendingUp size={10} /> LIVE</span>
                  </div>
                </div>

                <div className="bg-black border border-white/5 p-8 rounded-[32px] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#ccff00]"></div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Avg. Session</span>
                    <Clock size={20} className="text-[#ccff00] group-hover:scale-110 transition-transform" />
                  </div>
                  <h4 className="text-4xl font-black text-white tracking-tighter">{analytics.avgListenTime}</h4>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase mt-2">Quality engagement</p>
                </div>

                <div className="bg-black border border-white/5 p-8 rounded-[32px] relative overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between mb-6 shrink-0">
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Top Origins</span>
                    <Globe size={20} className="text-purple-500" />
                  </div>
                  <div className="overflow-y-auto max-h-[120px] custom-scrollbar pr-2 space-y-3">
                    {analytics.topOrigins && analytics.topOrigins.length > 0 ? analytics.topOrigins.map((loc, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-300 truncate pr-2">{loc.city}</span>
                        <span className="text-xs font-black text-purple-400">{loc.percentage}%</span>
                      </div>
                    )) : <div className="text-xs text-zinc-600 italic">Δεν υπάρχουν διαθέσιμα ιστορικά γεωγραφικά δεδομένα.</div>}
                  </div>
                </div>


              </div>

              {/* SECONDARY ANALYTICS ROW */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                 
                 {/* 1. ΣΥΝΟΛΙΚΑ PLAYS (Network) */}
                 <div className="bg-black border border-white/5 p-8 rounded-[32px] relative overflow-hidden group hover:border-orange-500/30 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-pink-500"></div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{analyticsPeriod==='all'?'Total Player Starts':'Session Starts (UTC period)'}</span>
                      <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <Play size={14} className="text-orange-500 ml-0.5" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <h4 className="text-5xl font-black text-white tracking-tighter">{Number(analytics.totalPlays||0).toLocaleString('el-GR')}</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Μόνο σταθμοί με ενεργό Analytics</p>
                    </div>
                 </div>

                 {/* 2. LIVE LOCATIONS SCROLL */}
                 <div className="bg-black border border-white/5 p-8 rounded-[32px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Listeners Locations</span>
                      <MapPin size={20} className="text-emerald-500" />
                    </div>
                    
                    <div className="overflow-y-auto max-h-[120px] custom-scrollbar pr-2 space-y-3">
                      {analytics.liveLocations && analytics.liveLocations.length > 0 ? (
                         analytics.liveLocations.map((loc, i) => (
                           <div key={i} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                             <div className="flex items-center gap-2 min-w-0">
                               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0"></div>
                               <span className="text-xs font-bold text-white truncate">{loc.city}</span>
                             </div>
                             <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0">
                               {loc.percentage}%
                             </span>
                           </div>
                         ))
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full pt-4 opacity-50">
                           <MapPin size={24} className="mb-2 text-zinc-600"/>
                           <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">Δεν συλλέγονται<br/>live γεωγραφικά δεδομένα</p>
                        </div>
                      )}
                    </div>
                 </div>

                 {/* 3. LIVE dB METER */}
                 <div className="bg-black border border-white/5 p-8 rounded-[32px] relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#ccff00] to-red-500"></div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-1">
                        <Volume2 size={12}/> LIVE dB Meter
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-zinc-900 px-2 py-1 rounded text-zinc-400">Master Output</span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center">
                      {!isPlaying ? (
                        <div className="text-center animate-pulse">
                          <Play size={32} className="mx-auto text-zinc-700 mb-2"/>
                          <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Press Play</p>
                        </div>
                      ) : (!currentStation || !stations.some(s => s._id === currentStation._id)) ? (
                        <div className="text-center">
                          <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Not Your Station</p>
                        </div>
                      ) : (
                        <div className="text-center w-full">
                          {(() => {
                            let colorClass = "text-emerald-400";
                            if (dbLevel > -3) colorClass = "text-red-500";
                            else if (dbLevel > -12) colorClass = "text-yellow-400";
                            else if (dbLevel <= -100) colorClass = "text-zinc-600";

                            return (
                              <>
                                <h4 className={`text-6xl font-black italic tracking-tighter leading-none ${colorClass}`}>
                                  {dbLevel <= -100 ? '-∞' : dbLevel.toFixed(1)}
                                </h4>
                                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${colorClass}`}>dBFS</p>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                 </div>

              </div>
          </div>
        </div>
      </div>

      {hasAnalytics && <div className="mt-4 grid gap-3 rounded-3xl border border-white/5 bg-zinc-900/30 p-6 text-xs text-zinc-300 sm:grid-cols-3">
        <div><p className="mb-2 text-zinc-500">Audio Ad Plays (συνολικά)</p><strong className="text-xl text-white">{Number(analytics.adStats?.totalPlays||0).toLocaleString('el-GR')}</strong></div>
        <div><p className="mb-2 text-zinc-500">Audio Ad Clicks (συνολικά)</p><strong className="text-xl text-white">{Number(analytics.adStats?.totalClicks||0).toLocaleString('el-GR')}</strong></div>
        <div><p className="mb-2 text-zinc-500">Κορυφαίο audio ad</p><strong className="text-sm text-white">{analytics.adStats?.topAd==='No Data'?'Χωρίς δεδομένα':analytics.adStats?.topAd}</strong></div>
      </div>}

      {/* 🎛️ DSP ENGINE PREVIEW (WITH LIVE CURVE BACKGROUND) */}
      <div className="mt-12">
        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6">
          <SlidersHorizontal size={16} /> Studio DSP Status
        </h3>
        
        <div className={`relative w-full rounded-[50px] overflow-hidden border transition-all duration-500 ${!hasDSP ? 'min-h-[400px] border-white/5 bg-zinc-950' : 'min-h-[300px] border-[#ccff00]/20 bg-black shadow-[0_0_50px_rgba(204,255,0,0.05)]'}`}>
          
          {/* 🟢 ΤΟ ΝΕΟ SVG BACKGROUND (Διαβάζει το Preset αν υπάρχει) */}
          <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${!hasDSP ? 'opacity-10 grayscale' : 'opacity-40'}`}>
            <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#gridPattern)" />
            </svg>
            
            {(() => {
              const activePreset = stations.length > 0 ? (stations[0].dspPreset || 'OFF') : 'OFF';
              const { pathD, fillPathD } = getDSPBackgroundCurve(hasDSP ? activePreset : 'ULTRABAND'); // Δείχνει το Ultraband σαν tease αν δεν έχει DSP
              const isOff = hasDSP && activePreset === 'OFF';

              return (
                <svg viewBox="0 0 1000 300" className="absolute inset-0 w-full h-full drop-shadow-2xl" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="bgCurveGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={isOff ? '#52525b' : '#ccff00'} stopOpacity={isOff ? "0.1" : "0.4"} />
                      <stop offset="100%" stopColor={isOff ? '#52525b' : '#ccff00'} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={fillPathD} fill="url(#bgCurveGradient)" className="transition-all duration-1000 ease-in-out" />
                  <path d={pathD} fill="none" stroke={isOff ? '#52525b' : '#ccff00'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-1000 ease-in-out drop-shadow-[0_0_15px_rgba(204,255,0,0.4)]" />
                </svg>
              );
            })()}
          </div>

          {/* 🟢 OVERLAY ΓΙΑ FREE USERS (Upgrade Prompt) */}
          {!hasDSP && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-6 md:p-12">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-[12px]"></div>
              <div className="relative z-40 w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex p-4 rounded-3xl bg-purple-500/10 border border-purple-500/20 mb-6">
                    <SlidersHorizontal size={40} className="text-purple-400" />
                  </div>
                  <h3 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">
                    Studio <span className="text-purple-500">Evolution</span>
                  </h3>
                  <p className="text-zinc-400 text-sm md:text-base font-medium max-w-lg mx-auto md:mx-0 leading-relaxed">
                    Απογειώστε τον ήχο σας με Pro Audio Presets. Δώστε όγκο FM υπερπαραγωγής στο web stream σας.
                  </p>
                </div>
                <button 
                  onClick={() => navigate('/upgrade-station')} 
                  className="bg-white text-black px-10 py-5 rounded-[24px] font-black uppercase tracking-widest text-xs hover:bg-[#ccff00] hover:scale-105 transition-all shadow-xl"
                >
                  Upgrade Audio
                </button>
              </div>
            </div>
          )}

          {/* 🟢 ПEΡΙΕΧΟΜΕΝΟ ΓΙΑ PREMIUM/PRO USERS */}
          <div className={`relative z-20 p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-10 h-full min-h-[300px] ${!hasDSP ? 'opacity-0 hidden' : 'opacity-100'}`}>
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity size={12} className="text-[#ccff00] animate-pulse" /> Global Audio Engine Active
              </p>
              <h4 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter uppercase mb-2 drop-shadow-md">
                {stations.length > 0 ? (stations[0].dspPreset || 'OFF') : 'OFF'}
              </h4>
              <p className="text-zinc-400 text-sm font-bold bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5 inline-block">
                Current DSP Profile across your station network.
              </p>
            </div>
            <button 
              onClick={() => navigate('/dsp')} 
              className="bg-[#ccff00] text-black px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-[0_15px_30px_rgba(204,255,0,0.3)] hover:scale-105 transition-transform"
            >
              Configure Engine
            </button>
          </div>
        </div>
      </div>

      {/* 📢 AD CONTROL PREVIEW */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <Megaphone size={16} /> Monetization Hub
          </h3>
          {features.adControl && (
            <button 
              onClick={() => navigate('/ad-control')}
              className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors"
            >
              Πληρης Διαχειριση <ArrowRight size={12} />
            </button>
          )}
        </div>
        
        <div className={`relative w-full rounded-[50px] overflow-hidden border border-white/5 transition-all duration-500 ${!features.adControl ? 'min-h-[400px] flex items-center justify-center' : 'bg-black min-h-[300px]'}`}>
          
          {/* Locked State (Tease & CTA) */}
          {!features.adControl ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <Megaphone size={300} className="text-orange-500 rotate-12" />
              </div>
              <div className="absolute inset-0 z-30 flex items-center justify-center p-6 md:p-12">
                <div className="absolute inset-0 bg-black/90 backdrop-blur-[20px]"></div>
                <div className="relative z-40 w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex p-4 rounded-3xl bg-orange-500/10 border border-orange-500/20 mb-6 shadow-[0_0_50px_rgba(249,115,22,0.25)]">
                      <Megaphone size={40} className="text-orange-400" />
                    </div>
                    <h3 className="text-4xl md:text-5xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">Smart Ad <span className="text-orange-500">Engine</span></h3>
                    <p className="text-zinc-400 text-sm md:text-base font-medium max-w-lg mx-auto md:mx-0 leading-relaxed">
                      Πάρτε τον έλεγχο των εσόδων σας. Διακόψτε τις διαφημίσεις του δικτύου και τρέξτε τα δικά σας χορηγικά σποτς (pre-rolls) ανάμεσα στο πρόγραμμά σας.
                    </p>
                  </div>
                  <button onClick={() => navigate('/upgrade-station')} className="shrink-0 bg-gradient-to-r from-orange-500 to-pink-500 text-white px-10 py-5 rounded-[24px] font-black uppercase tracking-widest text-xs hover:scale-105 transition-transform shadow-2xl flex items-center gap-3">
                    Unlock Monetization <Zap size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="relative z-20 p-8 md:p-12 h-full flex flex-col">
              <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                <div className="w-12 h-12 bg-orange-500/10 text-orange-400 rounded-2xl flex items-center justify-center">
                  <Activity size={24} />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-white italic tracking-tighter uppercase">Ενεργες Καμπανιες</h4>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Live audio injects στο σταθμό σας</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localAds.length === 0 ? (
                  <div className="col-span-full p-8 border border-dashed border-white/10 rounded-3xl text-center">
                     <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-4">Δεν εχετε ανεβασει δικα σας σποτ.</p>
                     <button onClick={() => navigate('/ad-control')} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                       Δημιουργια Καμπανιας
                     </button>
                  </div>
                ) : (
                  localAds.slice(0, 4).map(ad => (
                    <div key={ad._id} className="bg-zinc-900/50 border border-white/5 p-4 rounded-2xl flex items-center gap-4 group hover:border-orange-500/30 transition-colors">
                      <img src={ad.logoUrl || '/favicon.png'} alt="" className="w-12 h-12 rounded-xl object-cover bg-black" />
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-black text-white truncate">{ad.title}</h5>
                        <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest truncate">{ad.client}</p>
                      </div>
                      <div className="text-[9px] font-black bg-black border border-white/5 px-3 py-1.5 rounded-lg text-zinc-400">
                        {ad.frequency === 'first_station' ? 'PRE-ROLL' : 'MID-ROLL'}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {localAds.length > 4 && (
                <div className="mt-6 text-center">
                  <button onClick={() => navigate('/ad-control')} className="text-[10px] text-zinc-500 hover:text-white font-bold uppercase tracking-widest transition-colors">
                    Προβολη ολων ({localAds.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- 📝 MODAL ΠΡΟΣΚΛΗΣΗΣ PRODUCER --- */}
      {showProducerModal && (
        <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-lg rounded-[40px] border border-white/10 shadow-2xl relative">
            <button onClick={() => setShowProducerModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors z-10 bg-white/5 p-2 rounded-full"><X size={20} /></button>
            <div className="p-8 md:p-10">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mb-6">
                <Mail size={24} className="text-blue-400" />
              </div>
              <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Invite Producer</h2>
              <p className="text-zinc-500 font-medium text-xs uppercase tracking-widest mb-8">
                Θα σταλεί email πρόσκλησης για να ορίσει τον κωδικό του.
              </p>
              
              <form onSubmit={handleInviteProducer} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Email Παραγωγού *</label>
                  <input type="email" required value={producerForm.email} onChange={e => setProducerForm({...producerForm, email: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-blue-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Όνομα *</label>
                    <input type="text" required value={producerForm.fname} onChange={e => setProducerForm({...producerForm, fname: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-blue-500 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Επίθετο *</label>
                    <input type="text" required value={producerForm.lname} onChange={e => setProducerForm({...producerForm, lname: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-blue-500 outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[#ccff00] uppercase tracking-widest">Ανάθεση Σταθμού *</label>
                  <select required value={producerForm.stationId} onChange={e => setProducerForm({...producerForm, stationId: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer">
                    <option value="">Επιλέξτε Σταθμό...</option>
                    {stations.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>

                <button type="submit" disabled={producerFormLoading} className="w-full mt-8 bg-white text-black h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-400 transition-colors flex items-center justify-center gap-2">
                  {producerFormLoading ? <Loader2 className="animate-spin" /> : <><Mail size={16} /> Αποστολη Προσκλησης</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
