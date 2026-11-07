import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti'; 
import { 
  Radio, BarChart3, SlidersHorizontal, Activity, 
  Mic2, Play, FastForward, Clock, Zap, ShieldCheck,
  Edit, Globe, Image as ImageIcon, X, Loader2, TrendingUp, Users, MessageSquare, RefreshCw, SignalHigh,
  MapPin, Volume2 // 🟢 Προστέθηκαν για το Radar
} from 'lucide-react';

const LOCATION_DATA = { 
  "Ελλάδα": {
    "Αττική": [
      "Αθήνα", "Πειραιάς", "Νέα Σμύρνη", "Καλλιθέα", "Παλαιό Φάληρο", "Άλιμος", "Ελληνικό", 
      "Αργυρούπολη", "Γλυφάδα", "Βούλα", "Βουλιαγμένη", "Ηλιούπολη", "Άγιος Δημήτριος", 
      "Ζωγράφου", "Καισαριανή", "Βύρωνας", "Γαλάτσι", "Νέα Ιωνία", "Νέο Ηράκλειο", 
      "Νέα Φιλαδέλφεια", "Χαλάνδρι", "Μαρούσι", "Κηφισιά", "Πεύκη", "Μελίσσια", "Βριλήσσια", 
      "Αγία Παρασκευή", "Περιστέρι", "Αιγάλεω", "Χαϊδάρι", "Ίλιον", "Πετρούπολη", "Αγία Βαρβάρα", 
      "Νίκαια", "Κορυδαλλός", "Κερατσίνι", "Δραπετσώνα", "Πέραμα", "Σαλαμίνα", "Ελευσίνα", 
      "Αχαρνές", "Παλλήνη", "Γέρακας", "Κορωπί", "Μαρκόπουλο", "Ραφήνα", "Λαύριο", "Άλλη"
    ],
    "Θεσσαλονίκη": [
      "Θεσσαλονίκη", "Καλαμαριά", "Εύοσμος", "Κορδελιό", "Αμπελόκηποι", "Μενεμένη", "Σταυρούπολη", 
      "Πολίχνη", "Νεάπολη", "Συκιές", "Πυλαία", "Χορτιάτης", "Πανόραμα", "Θέρμη", "Ωραιόκαστρο", 
      "Μηχανιώνα", "Περαία", "Σίνδος", "Χαλάστρα", "Άλλη"
    ],
    "Αιτωλοακαρνανία": ["Μεσολόγγι", "Αγρίνιο", "Ναύπακτος", "Άλλη"],
    "Αργολίδα": ["Ναύπλιο", "Άργος", "Άλλη"],
    "Αρκαδία": ["Τρίπολη", "Μεγαλόπολη", "Άλλη"],
    "Άρτα": ["Άρτα", "Άλλη"],
    "Αχαΐα": ["Πάτρα", "Αίγιο", "Καλάβρυτα", "Άλλη"],
    "Βοιωτία": ["Λιβαδειά", "Θήβα", "Αράχωβα", "Άλλη"],
    "Γρεβενά": ["Γρεβενά", "Άλλη"],
    "Δράμα": ["Δράμα", "Άλλη"],
    "Δωδεκάνησα": ["Ρόδος", "Κως", "Κάλυμνος", "Κάρπαθος", "Άλλη"],
    "Έβρος": ["Αλεξανδρούπολη", "Ορεστιάδα", "Διδυμότειχο", "Άλλη"],
    "Εύβοια": ["Χαλκίδα", "Κάρυστος", "Άλλη"],
    "Ευρυτανία": ["Καρπενήσι", "Άλλη"],
    "Ζάκυνθος": ["Ζάκυνθος", "Άλλη"],
    "Ηλεία": ["Πύργος", "Αμαλιάδα", "Άλλη"],
    "Ημαθία": ["Βέροια", "Νάουσα", "Αλεξάνδρεια", "Άλλη"],
    "Ηράκλειο": ["Ηράκλειο", "Μοίρες", "Χερσόνησος", "Άλλη"],
    "Θεσπρωτία": ["Ηγουμενίτσα", "Άλλη"],
    "Ιωάννινα": ["Ιωάννινα", "Μέτσοβο", "Άλλη"],
    "Καβάλα": ["Καβάλα", "Άλλη"],
    "Καρδίτσα": ["Καρδίτσα", "Άλλη"],
    "Καστοριά": ["Καστοριά", "Άλλη"],
    "Κέρκυρα": ["Κέρκυρα", "Άλλη"],
    "Κεφαλληνία": ["Αργοστόλι", "Ληξούρι", "Άλλη"],
    "Κιλκίς": ["Κιλκίς", "Άλλη"],
    "Κοζάνη": ["Κοζάνη", "Πτολεμαΐδα", "Άλλη"],
    "Κορινθία": ["Κόρινθος", "Λουτράκι", "Κιάτο", "Άλλη"],
    "Κυκλάδες": ["Σύρος", "Νάξος", "Μύκονος", "Σαντορίνη", "Πάρος", "Τήνος", "Μήλος", "Άλλη"],
    "Λακωνία": ["Σπάρτη", "Γύθειο", "Άλλη"],
    "Λάρισα": ["Λάρισα", "Ελασσόνα", "Φάρσαλα", "Άλλη"],
    "Λασίθι": ["Άγιος Νικόλαος", "Ιεράπετρα", "Σητεία", "Άλλη"],
    "Λέσβος": ["Μυτιλήνη", "Άλλη"],
    "Λευκάδα": ["Λευκάδα", "Άλλη"],
    "Μαγνησία": ["Βόλος", "Αλμυρός", "Άλλη"],
    "Μεσσηνία": ["Καλαμάτα", "Μεσσήνη", "Άλλη"],
    "Ξάνθη": ["Ξάνθη", "Άλλη"],
    "Πέλλα": ["Έδεσσα", "Γιαννιτσά", "Άλλη"],
    "Πιερία": ["Κατερίνη", "Άλλη"],
    "Πρέβεζα": ["Πρέβεζα", "Πάργα", "Άλλη"],
    "Ρέθυμνο": ["Ρέθυμνο", "Άλλη"],
    "Ροδόπη": ["Κομοτηνή", "Άλλη"],
    "Σάμος": ["Σάμος", "Άλλη"],
    "Σέρρες": ["Σέρρες", "Άλλη"],
    "Τρίκαλα": ["Τρίκαλα", "Καλαμπάκα", "Άλλη"],
    "Φθιώτιδα": ["Λαμία", "Άλλη"],
    "Φλώρινα": ["Φλώρινα", "Αμύνταιο", "Άλλη"],
    "Φωκίδα": ["Άμφισσα", "Δελφοί", "Άλλη"],
    "Χαλκιδική": ["Πολύγυρος", "Νέα Μουδανιά", "Χαλκιδική", "Άλλη"],
    "Χανιά": ["Χανιά", "Κίσσαμος", "Άλλη"],
    "Χίος": ["Χίος", "Άλλη"]
  },
  "Κύπρος": {
    "Λευκωσία": ["Λευκωσία", "Στρόβολος", "Λακατάμεια", "Άλλη"],
    "Λεμεσός": ["Λεμεσός", "Άλλη"],
    "Λάρνακα": ["Λάρνακα", "Άλλη"],
    "Πάφος": ["Πάφος", "Άλλη"],
    "Αμμόχωστος": ["Παραλίμνι", "Αγία Νάπα", "Άλλη"],
    "Κερύνεια": ["Κερύνεια", "Άλλη"]
  },
  "Εξωτερικό": {
    "Ευρώπη": ["Λονδίνο", "Παρίσι", "Βερολίνο", "Άλλη"],
    "Αμερική": ["Νέα Υόρκη", "Σικάγο", "Άλλη"],
    "Αυστραλία": ["Σίδνεϊ", "Μελβούρνη", "Άλλη"],
    "Άλλο": ["Άλλη"]
  }
};

const GENRES = [
  "Διεθνή Mainstream", "House", "Techno", "Rock", "HipHop / RnB / Rap", 
  "80s / 90s", "Ειδήσεις", "Αθλητικά", "Παιδικά", "Cosmopolitan", "Sophisticated", 
  "Εναλλακτικά", "Ελληνικά Επιτυχίες", "Ελληνικά Λαϊκά", "Έντεχνη",
  "Θρησκευτικά", "Κλασική", "Lounge", "Παραδοσιακά"
];

// 🟢 ΠΡΟΣΤΕΘΗΚΑΝ: currentStation, isPlaying, analyser
export default function ProducerStudio({ 
  currentUser, API_URL, 
  unreadBroadcasterChat,
  currentStation, isPlaying, analyser 
}) {
  const navigate = useNavigate();
  
  // States
  const [stations, setStations] = useState([]); // Θα έχει μόνο 1 στοιχείο (τον assigned station)
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // States από τον Broadcaster (Parent)
  const [parentFeatures, setParentFeatures] = useState({});
  const [bossId, setBossId] = useState(null);

  // 🟢 dB METER STATE
  const [dbLevel, setDbLevel] = useState(-100);

  const hasAnalytics = parentFeatures?.analytics || false;
  const hasDSP = parentFeatures?.dspEngine || false;

  const [streamHealth, setStreamHealth] = useState({
    status: 'idle',
    latency: 0
  });

  const [analytics, setAnalytics] = useState({
    liveListeners: 0,
    avgListenTime: "0m 0s",
    topOrigins: [],
    liveLocations: [],
    adStats: { totalImpressions: 0, topAd: "-", clicks: 0 },
    chatStats: { totalMessages: 0, activeChatters: 0 }
  });

  const initialFormState = {
    name: '', slug: '', genre: '', stream: '', logo: '', cover: '', 
    country: 'Ελλάδα', region: '', city: '', customCity: '', slogan: '', description: '',
    transmissionType: 'Web Radio', frequency: '',
    website: '', facebook: '', instagram: '', twitter: '', tiktok: '',
    phone: '', email: '', explicit: false
  };

  const [formData, setFormData] = useState(initialFormState);

  // 🟢 ΣΥΝΟΛΙΚΑ PLAYS ΥΠΟΛΟΓΙΣΜΟΣ
  const totalStationPlays = useMemo(() => {
    return stations.reduce((acc, st) => acc + (st.plays || 0), 0);
  }, [stations]);

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

  // 🟢 LIVE dB METER LOGIC
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


  // 🟢 LOAD DATA (ΜΟΝΟ ΓΙΑ PRODUCER)
  const loadData = async () => {
    try {
      const token = localStorage.getItem('iluma_token');
      const res = await fetch(`${API_URL}/producers/my-station`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.station) {
        setStations([data.station]); 
        setParentFeatures(data.parentFeatures || {});
        setBossId(data.bossId);
      } else {
        setStations([]);
      }
    } catch (err) { console.error("Error loading assigned station:", err); }
    setLoading(false);
  };

  // 🟢 FETCH ANALYTICS
  const fetchAnalytics = async () => {
    if (!bossId || !hasAnalytics) return;
    try {
      const res = await fetch(`${API_URL}/broadcaster/${bossId}/analytics`);
      const data = await res.json();
      if (res.ok) setAnalytics(data);
    } catch (err) { console.error("Error fetching analytics:", err); }
  };

  useEffect(() => {
    loadData();
  }, [API_URL]);

  useEffect(() => {
    if (hasAnalytics && bossId) {
      fetchAnalytics();
      const interval = setInterval(fetchAnalytics, 5000);
      return () => clearInterval(interval);
    }
  }, [hasAnalytics, bossId]);

  // 🟢 STREAM HEALTH PING
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
    const now = new Date();
    const currentDay = now.getDay(); 
    const currentTime = now.getHours() * 60 + now.getMinutes();
    return schedule.find(item => {
      if (parseInt(item.day) !== currentDay) return false;
      const [startH, startM] = item.startTime.split(':').map(Number);
      const [endH, endM] = item.endTime.split(':').map(Number);
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;
      return currentTime >= startTotal && currentTime < endTotal;
    });
  };

  const handleEditClick = (station) => { 
    setEditingId(station._id); 
    const dataToEdit = station.pendingEdits || station;
    let customCityValue = '';
    const possibleCities = dataToEdit.country && dataToEdit.region ? LOCATION_DATA[dataToEdit.country]?.[dataToEdit.region] : [];
    if (possibleCities && !possibleCities.includes(dataToEdit.city)) {
      customCityValue = dataToEdit.city; 
      dataToEdit.city = 'Άλλη';
    }
    setFormData({ 
      ...initialFormState, 
      ...dataToEdit, 
      customCity: customCityValue, 
      country: dataToEdit.country || 'Ελλάδα',
      transmissionType: dataToEdit.transmissionType || 'Web Radio',
      frequency: dataToEdit.frequency || ''
    }); 
    setShowForm(true); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    const finalCity = formData.city === 'Άλλη' ? formData.customCity : formData.city;
    const finalFrequency = formData.transmissionType === 'Επίγειο' ? formData.frequency : '';
    
    const payload = { 
      ...formData, 
      city: finalCity, 
      frequency: finalFrequency,
      broadcasterId: bossId 
    };
    
    try {
      const token = localStorage.getItem('iluma_token');
      const url = `${API_URL}/broadcaster/stations/${editingId}/edit-request`;
      const res = await fetch(url, {
        method: 'PUT', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }, 
        body: JSON.stringify(payload)
      });
      if (res.ok) { setShowForm(false); setFormData(initialFormState); setEditingId(null); loadData(); }
    } catch (err) { alert("Σφάλμα κατά την υποβολή."); }
    setFormLoading(false);
  };

  if (loading) return <div className="p-10 text-[#ccff00] animate-pulse font-black uppercase tracking-widest text-center mt-20">Initializing Dashboard...</div>;

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
            <span className="text-[#ccff00]">Το Dashboard σου</span>
          </h1>
          <p className="text-zinc-500 font-bold mt-2 uppercase tracking-widest text-[10px] flex items-center gap-2">
            <Activity size={12} className="text-[#ccff00]" /> 
            iRadios Producer Control Panel
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 📻 STATION MANAGEMENT */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Radio size={16} /> Assigned Radio Unit
            </h3>
          </div>
          
          {stations.length === 0 ? (
            <div className="bg-zinc-900/30 border border-white/5 p-16 rounded-[40px] text-center">
              <p className="text-zinc-500 font-medium mb-2">Δεν έχει ανατεθεί ενεργός σταθμός.</p>
              <p className="text-zinc-600 text-xs uppercase font-bold tracking-widest">Επικοινωνηστε με τον ιδιοκτητη (Broadcaster).</p>
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
                        <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                          Εκτος Προγραμματος
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${station.dspPreset !== 'OFF' ? 'bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20' : 'bg-zinc-800 text-zinc-500'}`}>DSP: {station.dspPreset || 'OFF'}</span>
                      {station.boostStatus && <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-orange-500/20 text-orange-400 flex items-center gap-1 animate-pulse"><Zap size={10} /> Boosted</span>}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full md:w-auto shrink-0">
                    <button onClick={() => handleEditClick(station)} className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"><Edit size={14} /> Manage Profile</button>
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
          </div>
        </div>
      </div>

      {/* 📊 REAL-TIME ANALYTICS (Με dB Meter και Plays) */}
      <div className="mt-12">
        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6"><BarChart3 size={16} /> Audience Radar</h3>
        <div className={`relative w-full rounded-[50px] overflow-hidden border border-white/5 transition-all duration-500 ${!hasAnalytics ? 'min-h-[350px] flex items-center justify-center' : 'bg-zinc-900/20'}`}>
          {!hasAnalytics && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-6 md:p-12">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-[25px]"></div>
              <div className="relative z-40 w-full max-w-2xl text-center">
                <div className="inline-flex p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 mb-6 shadow-[0_0_50px_rgba(59,130,246,0.25)]"><BarChart3 size={40} className="text-blue-400" /></div>
                <h3 className="text-3xl md:text-5xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">Audience <span className="text-blue-500">Radar</span></h3>
                <p className="text-zinc-400 text-sm font-medium">
                  Τα Analytics δεν είναι ενεργοποιημένα για αυτόν τον σταθμό. Μόνο ο ιδιοκτήτης (Broadcaster) μπορεί να τα ενεργοποιήσει.
                </p>
              </div>
            </div>
          )}
          
          <div className={`w-full transition-all duration-500 p-8 md:p-12 ${!hasAnalytics ? 'opacity-10 blur-xl pointer-events-none select-none' : 'opacity-100'}`}>
              
              {/* MAIN ANALYTICS ROW */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
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
                    )) : <div className="text-xs text-zinc-600 italic">Gathering geo-data...</div>}
                  </div>
                </div>

                <div 
                  onClick={() => navigate('/my-chat')}
                  className={`bg-gradient-to-br from-black to-zinc-900 p-8 rounded-[32px] relative overflow-hidden cursor-pointer transition-all duration-300 ${
                    unreadBroadcasterChat 
                      ? 'border-2 border-[#ccff00] shadow-[0_0_30px_rgba(204,255,0,0.2)] animate-pulse scale-[1.02]' 
                      : 'border border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className={`absolute top-0 left-0 w-full h-1 ${unreadBroadcasterChat ? 'bg-[#ccff00]' : 'bg-blue-400'}`}></div>
                  <div className="flex items-center justify-between mb-6">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${unreadBroadcasterChat ? 'text-[#ccff00]' : 'text-zinc-500'}`}>
                      {unreadBroadcasterChat ? 'NEW MESSAGE!' : 'Live Chat Status'}
                    </span>
                    <MessageSquare size={20} className={`${unreadBroadcasterChat ? 'text-black fill-[#ccff00]' : 'text-blue-400'}`} />
                  </div>
                  <h4 className="text-4xl font-black text-white tracking-tighter mb-2">
                    {analytics.chatStats?.totalMessages || 0} <span className="text-sm text-zinc-500 font-bold">Msgs</span>
                  </h4>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase flex items-center gap-1">
                     <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                     {analytics.chatStats?.activeChatters || 0} Active Chatters
                  </p>
                  
                  <div className="absolute -bottom-4 -right-4 opacity-5">
                    <MessageSquare size={100} />
                  </div>
                </div>

              </div>

              {/* 🟢 NEW SECONDARY ANALYTICS ROW (Plays, Locations, dB Meter) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                 
                 {/* 1. ΣΥΝΟΛΙΚΑ PLAYS */}
                 <div className="bg-black border border-white/5 p-8 rounded-[32px] relative overflow-hidden group hover:border-orange-500/30 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-pink-500"></div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Station Total Plays</span>
                      <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <Play size={14} className="text-orange-500 ml-0.5" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <h4 className="text-5xl font-black text-white tracking-tighter">{totalStationPlays.toLocaleString()}</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">All-time listener hits</p>
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
                           <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">Αναμονή για<br/>ζωντανά δεδομένα</p>
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
                          {/* Dynamic Color based on dB */}
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

      {/* 🎛️ DSP ENGINE PREVIEW (Read Only) */}
      <div className="mt-12">
        <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-6"><SlidersHorizontal size={16} /> Studio DSP Status</h3>
        <div className={`relative w-full rounded-[50px] overflow-hidden border border-white/5 transition-all duration-500 ${!hasDSP ? 'min-h-[300px] flex items-center justify-center' : 'bg-black min-h-[250px]'}`}>
          <style dangerouslySetInnerHTML={{__html: `@keyframes eq { 0% { height: 15%; } 50% { height: 100%; } 100% { height: 15%; } } .v-bar { animation: eq 1s ease-in-out infinite; background: #ccff00; opacity: 0.15; width: 6px; border-radius: 99px; }`}} />
          <div className="absolute inset-0 flex items-end justify-between px-10 pb-[-40px] gap-2 pointer-events-none">
             {[...Array(20)].map((_, i) => (<div key={i} className="v-bar" style={{ animationDuration: `${0.6 + Math.random()}s`, height: '60%' }}></div>))}
          </div>
          {!hasDSP && (
            <div className="absolute inset-0 z-30 flex items-center justify-center p-6 md:p-12">
              <div className="absolute inset-0 bg-black/90 backdrop-blur-[20px]"></div>
              <div className="relative z-40 w-full max-w-2xl text-center">
                <div className="inline-flex p-4 rounded-3xl bg-purple-500/10 border border-purple-500/20 mb-6"><SlidersHorizontal size={40} className="text-purple-400" /></div>
                <h3 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">Studio <span className="text-purple-500">Evolution</span></h3>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                  Το DSP (Digital Signal Processing) δεν είναι ενεργοποιημένο από τον ιδιοκτήτη του σταθμού.
                </p>
              </div>
            </div>
          )}
          <div className={`relative z-20 p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-10 ${!hasDSP ? 'opacity-0' : 'opacity-100'}`}>
             <div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Activity size={12} className="text-[#ccff00]" /> Global Audio Engine Active</p>
                <h4 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter uppercase mb-2">{stations.length > 0 ? (stations[0].dspPreset || 'OFF') : 'OFF'}</h4>
                <p className="text-zinc-500 text-sm font-bold">Το τρέχον ηχητικό προφίλ του σταθμού (Ορίζεται από τον Broadcaster).</p>
             </div>
          </div>
        </div>
      </div>

      {/* --- 📝 ΠΛΗΡΕΣ FORM MODAL (EDIT ΜΟΝΟ) --- */}
      {showForm && (
         <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-4xl rounded-[50px] border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative">
              <button onClick={() => setShowForm(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors z-10 bg-white/5 p-2 rounded-full"><X size={24} /></button>
              <div className="p-10 md:p-14">
                <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">Edit Station Profile</h2>
                <p className="text-zinc-500 font-medium mb-10 text-xs md:text-sm uppercase tracking-widest border-l-2 border-[#ccff00] pl-4">
                  Οι αλλαγές θα ελεγχθούν από την ομάδα του iRadios.
                </p>
                <form onSubmit={handleSubmit} className="space-y-10">
                  
                  {/* ΕΝΟΤΗΤΑ 1: MEDIA & STREAM */}
                  <div className="space-y-6 bg-black/20 p-8 rounded-[32px] border border-white/5 mt-8">
                    <h3 className="text-[#ccff00] font-black text-[10px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Globe size={14}/> Media & Stream Assets</h3>
                    <div className="flex flex-col md:flex-row items-start gap-8">
                      <div className="w-28 h-28 rounded-3xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
                        {formData.logo ? <img src={formData.logo} className="w-full h-full object-cover" alt="" /> : <ImageIcon className="text-zinc-700" size={32} />}
                      </div>
                      <div className="flex-1 w-full space-y-4">
                        <div>
                          <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest block mb-2">Logo Image URL *</label>
                          <input type="url" required value={formData.logo} onChange={e => setFormData({...formData, logo: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white text-xs outline-none focus:border-[#ccff00]/50 transition-all" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest block mb-2">Cover / Banner Image URL</label>
                          <input type="url" value={formData.cover || ''} onChange={e => setFormData({...formData, cover: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white text-xs outline-none focus:border-[#ccff00]/50 transition-all" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black uppercase text-[#ccff00] tracking-widest block mb-2">Stream Source URL *</label>
                          <input type="url" required value={formData.stream} onChange={e => setFormData({...formData, stream: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white text-xs outline-none focus:border-[#ccff00]/50 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ΕΝΟΤΗΤΑ 2: IDENTITY & LOCALIZATION */}
                  <div className="space-y-6">
                    <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] border-b border-white/10 pb-3 flex items-center gap-2">
                       <SignalHigh size={16} className="text-[#ccff00]" /> Identity & Transmission
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Station Title *</label>
                        <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none font-bold" />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Custom URL (Slug)</label>
                        <div className="flex items-center">
                          <span className="bg-white/5 border border-white/10 border-r-0 h-12 px-3 rounded-l-xl flex items-center text-zinc-500 text-xs italic">
                            /station/
                          </span>
                          <input 
                            type="text" 
                            value={formData.slug || ''} 
                            onChange={e => setFormData({
                              ...formData, 
                              slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                            })} 
                            placeholder="my-radio"
                            className="w-full bg-black border border-white/10 border-l-0 h-12 rounded-r-xl px-3 text-white focus:border-[#ccff00]/50 outline-none font-bold placeholder:text-zinc-700" 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Global Slogan</label>
                        <input type="text" value={formData.slogan || ''} onChange={e => setFormData({...formData, slogan: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Genre *</label>
                        <select required value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer">
                          <option value="">Select Genre...</option>
                          {GENRES.map((g, idx) => <option key={idx} value={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-zinc-900/50 rounded-2xl border border-white/5 mt-4">
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-[#ccff00] uppercase tracking-widest flex items-center gap-1"><SignalHigh size={12}/> Τύπος Μετάδοσης *</label>
                         <select 
                           required 
                           value={formData.transmissionType || 'Web Radio'} 
                           onChange={e => setFormData({...formData, transmissionType: e.target.value, frequency: e.target.value !== 'Επίγειο' ? '' : formData.frequency})} 
                           className="w-full bg-black border border-[#ccff00]/30 h-12 rounded-xl px-4 text-white focus:border-[#ccff00] outline-none appearance-none cursor-pointer font-bold"
                         >
                           <option value="Web Radio">Web Radio</option>
                           <option value="Επίγειο">Επίγειο (FM/AM)</option>
                           <option value="DAB">DAB / Ψηφιακό</option>
                         </select>
                      </div>

                      {formData.transmissionType === 'Επίγειο' && (
                        <div className="space-y-2 animate-in fade-in zoom-in-95">
                          <label className="text-[9px] font-black text-white uppercase tracking-widest">Συχνότητα (π.χ. 95.2 FM) *</label>
                          <input 
                            type="text" 
                            required 
                            value={formData.frequency || ''} 
                            onChange={e => setFormData({...formData, frequency: e.target.value})} 
                            placeholder="π.χ. 95.2 FM"
                            className="w-full bg-black border border-white/20 h-12 rounded-xl px-4 text-white focus:border-[#ccff00] outline-none font-black" 
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-zinc-900/50 rounded-2xl border border-white/5">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-[#ccff00] uppercase tracking-widest">Χώρα *</label>
                        <select 
                          required 
                          value={formData.country} 
                          onChange={e => setFormData({...formData, country: e.target.value, region: '', city: '', customCity: ''})} 
                          className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer"
                        >
                          {Object.keys(LOCATION_DATA).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Νομός / Περιφέρεια *</label>
                        <select 
                          required 
                          value={formData.region} 
                          onChange={e => setFormData({...formData, region: e.target.value, city: '', customCity: ''})} 
                          disabled={!formData.country}
                          className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50"
                        >
                          <option value="">Επιλέξτε...</option>
                          {formData.country && Object.keys(LOCATION_DATA[formData.country]).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Πόλη *</label>
                        <select 
                          required 
                          value={formData.city} 
                          onChange={e => setFormData({...formData, city: e.target.value})} 
                          disabled={!formData.region}
                          className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50"
                        >
                          <option value="">Επιλέξτε...</option>
                          {formData.region && LOCATION_DATA[formData.country]?.[formData.region]?.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      {formData.city === 'Άλλη' && (
                        <div className="space-y-2 animate-in fade-in zoom-in-95">
                          <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Πληκτρολογήστε Πόλη *</label>
                          <input 
                            type="text" 
                            required 
                            value={formData.customCity || ''} 
                            onChange={e => setFormData({...formData, customCity: e.target.value})} 
                            placeholder="π.χ. Μέτσοβο"
                            className="w-full bg-black border border-orange-500/50 h-12 rounded-xl px-4 text-white focus:border-orange-500 outline-none" 
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center h-12 mt-4">
                      <label className="flex items-center gap-4 cursor-pointer group">
                        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${formData.explicit ? 'bg-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-black border-white/20 group-hover:border-white/40'}`}>
                          {formData.explicit && <ShieldCheck size={14} className="text-black" />}
                        </div>
                        <input type="checkbox" checked={formData.explicit || false} onChange={e => setFormData({...formData, explicit: e.target.checked})} className="hidden" />
                        <span className="text-xs font-black text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Explicit Content Warning</span>
                      </label>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">About / Description</label>
                      <textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} rows="3" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-[#ccff00]/50 outline-none text-sm resize-none"></textarea>
                    </div>
                  </div>

                  {/* ΕΝΟΤΗΤΑ 3: CONTACT & SOCIALS */}
                  <div className="space-y-6">
                    <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] border-b border-white/10 pb-3">Contact & Socials</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Email Address</label>
                        <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Phone Number</label>
                        <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Official Website URL</label>
                        <input type="url" value={formData.website || ''} onChange={e => setFormData({...formData, website: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Instagram URL</label>
                        <input type="url" value={formData.instagram || ''} onChange={e => setFormData({...formData, instagram: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Facebook URL</label>
                        <input type="url" value={formData.facebook || ''} onChange={e => setFormData({...formData, facebook: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">TikTok URL</label>
                        <input type="url" value={formData.tiktok || ''} onChange={e => setFormData({...formData, tiktok: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={formLoading} className="w-full bg-[#ccff00] text-black h-16 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center hover:bg-[#b3e600] transition-colors">
                    {formLoading ? <Loader2 className="animate-spin" /> : 'Submit Audit Request'}
                  </button>
                </form>

              </div>
            </div>
         </div>
      )}
    </div>
  );
}
