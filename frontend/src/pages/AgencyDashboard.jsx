import React, { useState, useEffect } from 'react';
import '../styles/ad-campaign-console.css';
import CampaignDeliveryStatus from '../components/CampaignDeliveryStatus';
import ProtectedAudioPreview from '../components/ProtectedAudioPreview';
import { useNavigate } from 'react-router-dom';
import { 
  Megaphone, Plus, LayoutPanelTop, Rows3, LayoutGrid, Activity, X, Eye, ShieldCheck, 
  Clock, Mic2, BarChart3, RotateCw, Target, CreditCard, Building2, AlertTriangle, Loader2, SlidersHorizontal, Image as ImageIcon, Link as LinkIcon, Users
} from 'lucide-react';
import { useAlert } from '../context/AlertContext';

// 🗺️ ΔΥΝΑΜΙΚΟΣ ΧΑΡΤΗΣ ΤΟΠΟΘΕΣΙΩΝ
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

// --- MAIN AGENCY DASHBOARD ---
export default function AgencyDashboard({ API_URL, currentUser, globalSocket }) {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  const [activeTab,setActiveTab]=useState('banners');
  const [statusFilter,setStatusFilter]=useState('all');
  const [searchTerm,setSearchTerm]=useState('');
  const isStaging=typeof window!=='undefined'&&window.location.hostname==='stage.iradios.gr'; 
  const [campaigns, setCampaigns] = useState({ banners: [], audio: [] });
  const [loading, setLoading] = useState(true);
  
  // 🟢 Real Data States
  const [liveListeners, setLiveListeners] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  // File Upload States
  const [audioFile, setAudioFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null); // 🟢 Νέο State για το Λογότυπο της Audio Campaign
  const [bannerFile, setBannerFile] = useState(null);
  const [squareBannerFile, setSquareBannerFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Modal States
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [creationStep, setCreationStep] = useState(1); 
  const [selectedType, setSelectedType] = useState(null); 
  const [selectedDuration, setSelectedDuration] = useState('month');
  
  // Payment States

  const [bannerForm, setBannerForm] = useState({ 
    title: '', description: '', imageUrl: '', squareImageUrl: '', targetUrl: '', targetCountry: 'All', targetRegion: 'All', targetLocations: ['All']
  });
  
  const [audioForm, setAudioForm] = useState({ 
    title: '', client: '', audioUrl: '', logoUrl: '', linkUrl: '', frequency: 'entry', dspPreset: 'OFF', targetCountry: 'All', targetRegion: 'All', targetLocations: ['All']
  });

  // Final VAT-inclusive monthly price catalog. Each campaign is billed separately.
  // Gateway campaign checkout is not enabled during Listener-only Sandbox UAT.
  const displayPrices = {
    radio_feed: { month: 29.00 },
    home: { month: 29.00 },
    station_profile: { month: 29.00 },
    news_feed: { month: 149.00 },
    hero: { month: 289.00 },
    audio: { month: 79.00 }
  };

  const placementOptions = [
    { id: 'hero', label: 'Hero Banner', desc: 'Μεγάλο banner στην αρχική.', icon: <LayoutPanelTop size={24} />, type: 'banner' },
    { id: 'home', label: 'Home Feed', desc: 'Στην αρχική σελίδα.', icon: <LayoutGrid size={24} />, type: 'banner' },
    { id: 'station_profile', label: 'Station Profile', desc: 'Μέσα στη σελίδα σταθμού.', icon: <LayoutPanelTop size={24} />, type: 'banner' },
    { id: 'news_feed', label: 'News Grid', desc: 'Στην ενότητα ειδήσεων.', icon: <Rows3 size={24} />, type: 'banner' },
    { id: 'radio_feed', label: 'Radio Grid', desc: 'Στο grid αναζήτησης.', icon: <LayoutGrid size={24} />, type: 'banner' },
    { id: 'audio', label: 'Audio Spot', desc: 'Pre-roll ή Mid-roll ήχος.', icon: <Mic2 size={24} />, type: 'audio' },
  ];

  const loadDashboardData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const headers={Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`};
      const resBanners=await fetch(`${BASE_URL}/agency/${currentUser._id}/banners`,{headers});
      const resAudio=await fetch(`${BASE_URL}/agency/${currentUser._id}/audio-ads`,{headers});
      
      const parsedBanners = resBanners.ok ? await resBanners.json() : [];
      const parsedAudio = resAudio.ok ? await resAudio.json() : [];
      
      setCampaigns({ 
        banners: Array.isArray(parsedBanners) ? parsedBanners : [], 
        audio: Array.isArray(parsedAudio) ? parsedAudio : [] 
      });
    } catch (err) { 
      console.error(err); 
      setCampaigns({ banners: [], audio: [] });
    }
    setLoading(false);
  };

  const fetchNetworkStats = async () => {
    try {
      const statsRes = await fetch(`${BASE_URL}/stats/network`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.totals?.users !== undefined) setTotalUsers(statsData.totals.users);
        if (statsData.totals?.liveListeners !== undefined) setLiveListeners(statsData.totals.liveListeners);
      }
    } catch(e) { console.error("Failed to fetch network stats", e); }
  };

  useEffect(() => { 
    loadDashboardData(); 
    fetchNetworkStats(); 
    const interval = setInterval(fetchNetworkStats, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (!globalSocket) return;
    const handleLiveCount = (count) => setLiveListeners(count);
    
    globalSocket.on('admin_live_listeners', handleLiveCount);
    globalSocket.on('global_live_listeners', handleLiveCount);

    if (globalSocket.connected) {
      globalSocket.emit('get_live_count');
    } else {
      globalSocket.on('connect', () => globalSocket.emit('get_live_count'));
    }

    return () => {
      globalSocket.off('admin_live_listeners', handleLiveCount);
      globalSocket.off('global_live_listeners', handleLiveCount);
    };
  }, [globalSocket]);

  // 🟢 UNIVERSAL FILE UPLOAD HELPER
  const uploadFile = async (file, endpoint, fieldName) => {
    const fileData = new FormData();
    fileData.append(fieldName, file);
    const res = await fetch(`${BASE_URL}/uploads/${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` },
      body: fileData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || `Αποτυχία ανεβάσματος ${fieldName}.`);
    return result.url;
  };

  // Stage-only: draft creative and submit for Admin approval; no financial action.
  const handleProceedToPayment=async event=>{
    event.preventDefault();
    if(!isStaging){showAlert('Agency','Οι αγορές μέσω Nexi δεν έχουν ενεργοποιηθεί.','info');return;}
    setUploading(true);
    try{
      const jwt=localStorage.getItem('iluma_token');
      if(!jwt)throw Error('Χρειάζεται επανασύνδεση.');
      let endpoint,payload;
      if(selectedType==='audio'){
        if(!audioFile)throw Error('Επίλεξε αρχείο MP3 ή WAV.');
        const audioUrl=await uploadFile(audioFile,'upload-ad','audioFile');
        const logoUrl=logoFile?await uploadFile(logoFile,'upload-logo','logoFile'):'/favicon.png';
        endpoint='audio-ads';payload={...audioForm,audioUrl,logoUrl,frequency:audioForm.frequency||'entry'};
      }else{
        if(!bannerFile)throw Error('Επίλεξε οριζόντιο banner.');
        const imageUrl=await uploadFile(bannerFile,'upload-banner','imageFile');
        const squareImageUrl=squareBannerFile?await uploadFile(squareBannerFile,'upload-banner','imageFile'):'';
        endpoint='banners';payload={...bannerForm,imageUrl,squareImageUrl,placement:[selectedType]};
      }
      const response=await fetch(`${BASE_URL}/agency/${endpoint}`,{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt}`},
        body:JSON.stringify(payload)
      });
      if(!response.ok)throw Error((await response.json().catch(()=>({}))).error||'Αποτυχία αποθήκευσης.');
      setShowCreationModal(false);setCreationStep(1);setSelectedType(null);
      setAudioFile(null);setLogoFile(null);setBannerFile(null);setSquareBannerFile(null);
      await loadDashboardData();
      showAlert('Αποθηκεύτηκε','Το δοκιμαστικό draft περιμένει έγκριση. Καμία χρέωση.','success');
    }catch(error){showAlert('Σφάλμα καμπάνιας',error.message,'error');}
    finally{setUploading(false);}
  };

  const totalImpressions = [...campaigns.banners, ...campaigns.audio].reduce((acc, curr) => acc + (curr.impressions || curr.plays || 0), 0);
  const totalClicks = [...campaigns.banners, ...campaigns.audio].reduce((acc, curr) => acc + (curr.clicks || 0), 0);
  const avgCTR=totalImpressions>0?((totalClicks/totalImpressions)*100).toFixed(2):0;
  const visibleCampaigns=(activeTab==='banners'?campaigns.banners:campaigns.audio).filter(c=>
    (statusFilter==='all'||c.status===statusFilter)&&
    String(c.title||'').toLocaleLowerCase('el-GR').includes(searchTerm.toLocaleLowerCase('el-GR'))
  );


  return (
    <div className="ad-console min-h-screen bg-black text-white p-6 lg:p-12 font-sans pb-32 animate-fade-in relative overflow-hidden">
      
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#ccff00]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        <div className="ad-console-hero flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-[9px] font-black tracking-[0.2em] uppercase mb-4">
              <Building2 size={12} className="text-purple-400" /> Agency Ad Network
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">
              Agency <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[#ccff00]">Dashboard</span>
            </h1>
            <p className="text-zinc-500 font-medium mt-2 max-w-lg">
              Καλωσορίσατε. Διαχειριστείτε τις καμπάνιες σας, παρακολουθήστε τα στατιστικά σε πραγματικό χρόνο και δημιουργήστε νέες διαφημίσεις.
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="bg-red-500/10 border border-red-500/30 px-5 py-3.5 rounded-2xl flex items-center gap-2.5 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping absolute"></div>
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full relative z-10"></div>
              <span className="text-red-400 font-black tracking-widest text-[10px] hidden sm:inline">Ακροατές Live:</span>
              <span className="text-white font-black text-lg font-mono leading-none">{liveListeners.toLocaleString()}</span>
            </div>
            <button 
              onClick={() => { loadDashboardData(); fetchNetworkStats(); }}
              disabled={loading}
              className="p-4 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all active:scale-95 group"
              title="Ανανέωση Στατιστικών"
            >
              <RotateCw size={20} className={`${loading ? 'animate-spin text-[#ccff00]' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            </button>
            <button 
              onClick={() => navigate('/agency/campaigns/'+(activeTab==='audio'?'audio':'banners')+'/new')}
              className="bg-[#ccff00] text-black px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(204,255,0,0.2)] flex items-center gap-3 shrink-0"
            >
              <Plus size={18} /> Νεα Καμπανια
            </button>
          </div>
        </div>

        {/* 🟢 5-COLUMN GRID (Πραγματικοί Χρήστες) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 mb-12">
          
          <div className="bg-cyan-500/5 backdrop-blur-sm border border-cyan-500/10 p-6 rounded-[32px] hover:bg-cyan-500/10 transition-colors">
            <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14} /> Εγγεγραμένοι</p>
            <div className="text-4xl font-black text-cyan-400">{totalUsers.toLocaleString()}</div>
          </div>

          <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 p-6 rounded-[32px] hover:bg-zinc-900/60 transition-colors">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2"><Activity size={14} /> Ενεργες</p>
            <div className="text-4xl font-black text-white">
              {[...campaigns.banners, ...campaigns.audio].filter(c => c.status === 'active').length}
            </div>
          </div>
          
          <div className="bg-purple-500/5 backdrop-blur-sm border border-purple-500/10 p-6 rounded-[32px] hover:bg-purple-500/10 transition-colors">
            <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2"><Eye size={14} /> Views/Plays</p>
            <div className="text-4xl font-black text-purple-400">{totalImpressions.toLocaleString()}</div>
          </div>
          
          <div className="bg-[#ccff00]/5 backdrop-blur-sm border border-[#ccff00]/10 p-6 rounded-[32px] hover:bg-[#ccff00]/10 transition-colors">
            <p className="text-[#ccff00] text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2"><Target size={14} /> Clicks</p>
            <div className="text-4xl font-black text-[#ccff00]">{totalClicks.toLocaleString()}</div>
          </div>
          
          <div className="bg-blue-500/5 backdrop-blur-sm border border-blue-500/10 p-6 rounded-[32px] hover:bg-blue-500/10 transition-colors">
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2"><BarChart3 size={14} /> Avg. CTR</p>
            <div className="text-4xl font-black text-blue-400">{avgCTR}%</div>
          </div>
        </div>

        <div className="ad-console-toolbar mb-5">
          <input type="search" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
            placeholder="Αναζήτηση καμπάνιας…" aria-label="Αναζήτηση" className="ad-console-filter min-w-[180px] flex-1"/>
          <select value={statusFilter} aria-label="Κατάσταση" onChange={e=>setStatusFilter(e.target.value)} className="ad-console-filter">
            <option value="all">Όλες</option><option value="active">LIVE</option><option value="pending">Σε έλεγχο</option>
            <option value="expired">Ληγμένες</option><option value="rejected">Απορριφθείσες</option>
          </select>
          {isStaging&&<span className="ad-console-label ad-console-demo">Sandbox · Χωρίς χρεώσεις</span>}
        </div>
        <div className="flex items-center gap-2 mb-8 bg-zinc-900/50 p-1.5 rounded-2xl w-fit border border-white/5">
          <button 
            onClick={() => setActiveTab('banners')} 
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'banners' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            Visual Banners
          </button>
          <button 
            onClick={() => setActiveTab('audio')} 
            className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'audio' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}
          >
            Audio Spots
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#ccff00]" size={40} /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleCampaigns.map(campaign => (
              <div key={campaign._id} className="ad-console-card bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-[32px] p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
                
                <div className="absolute top-6 right-6">
                  {campaign.status === 'active' && (!isStaging||campaign.isStageCreative) && <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border border-emerald-500/20">LIVE</span>}
                  {campaign.status === 'active' && isStaging && !campaign.isStageCreative && <span className="bg-purple-500/10 text-purple-200 text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border border-purple-500/20">Εισαγμένη · δεν προβάλλεται</span>}
                  {campaign.status === 'pending' && <span className="bg-orange-500/10 text-orange-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border border-orange-500/20 animate-pulse">IN REVIEW</span>}
                  {campaign.status === 'expired' && <span className="bg-red-500/10 text-red-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border border-red-500/20">EXPIRED</span>}
                </div>

                <div className="mb-6 pr-24">
                  <h3 className="text-xl font-black text-white truncate" title={campaign.title}>{campaign.title}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                    {activeTab === 'banners' ? <LayoutGrid size={12} /> : <Mic2 size={12} />}
                    {activeTab === 'banners' ? (campaign.placement?.join(', ') || 'Banner') : 'Audio Spot'}
                  </p>
                </div>

                <div className="mb-3"><CampaignDeliveryStatus campaign={campaign} kind={activeTab==='banners'?'banner':'audio'} stage={isStaging}/></div>
                <div className="ad-console-preview mb-4">
                   {activeTab==='banners'&&campaign.imageUrl&&
                     <img src={campaign.squareImageUrl||campaign.imageUrl} alt={campaign.title}
                       loading="lazy" className="mb-3 h-32 w-full rounded-xl object-cover"/>}
                   {activeTab==='audio'&&campaign.audioUrl&&
                     <ProtectedAudioPreview adId={campaign._id} scope="agency" sourceUrl={campaign.audioUrl}/>}
                   <span className="mt-2 block text-[10px] font-bold text-zinc-400">Preview · Χωρίς καταμέτρηση</span>
                 </div>
                 <div className="bg-black/50 rounded-2xl p-4 mb-4 border border-white/5">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-[8px] text-zinc-500 uppercase font-black tracking-wider mb-1">
                        {activeTab === 'banners' ? 'Views' : 'Plays'}
                      </div>
                      <div className="font-black text-white text-lg">
                        {activeTab === 'banners' 
                          ? (campaign.impressions?.toLocaleString() || 0) 
                          : (campaign.plays?.toLocaleString() || 0)}
                      </div>
                    </div>
                    <div className="text-center border-l border-white/5">
                      <div className="text-[8px] text-zinc-500 uppercase font-black tracking-wider mb-1">Clicks</div>
                      <div className="font-black text-[#ccff00] text-lg">{campaign.clicks?.toLocaleString() || 0}</div>
                    </div>
                    <div className="text-center border-l border-white/5">
                      <div className="text-[8px] text-zinc-500 uppercase font-black tracking-wider mb-1">CTR</div>
                      <div className="font-black text-blue-400 text-lg">
                        {activeTab === 'banners'
                          ? (campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(1) : '0')
                          : (campaign.plays > 0 ? ((campaign.clicks / campaign.plays) * 100).toFixed(1) : '0')}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest pt-2">
                  <span className="text-zinc-600">Πακετο: <span className="text-zinc-300">{campaign.duration}</span></span>
                  {campaign.expiresAt && campaign.status === 'active' && (
                    <span className="text-zinc-500">Ληξη: {new Date(campaign.expiresAt).toLocaleDateString('el-GR')}</span>
                  )}
                </div>
                {['pending','rejected'].includes(campaign.status)&&
                  <button type="button" onClick={()=>navigate('/agency/campaigns/'+(activeTab==='banners'?'banners':'audio')+'/'+campaign._id+'/edit')}
                    className="mt-4 w-full rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-xs font-bold text-purple-200 hover:bg-purple-500/20">
                    Επεξεργασία καμπάνιας
                  </button>}
              </div>
            ))}
            
            {visibleCampaigns.length===0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[40px]">
                <Target size={48} className="mx-auto text-zinc-700 mb-4" />
                <h3 className="text-xl font-black text-zinc-400 mb-2">Δεν βρέθηκαν καμπάνιες</h3>
                <p className="text-zinc-600 text-sm">Δημιουργήστε την πρώτη σας διαφήμιση για να ξεκινήσετε.</p>
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  );
}
