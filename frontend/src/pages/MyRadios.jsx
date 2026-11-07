import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Radio, PlusCircle, CheckCircle, Clock, Image as ImageIcon, XCircle, X, LayoutDashboard, Globe, AlertTriangle, Edit,
  Headphones, Loader2, Zap, LayoutGrid, SignalHigh, Upload, Link as LinkIcon, Activity, PlayCircle,
  MessageCircle
} from 'lucide-react';
import { useAlert } from '../context/AlertContext';

// 🗺️ 1. ΔΥΝΑΜΙΚΟΣ ΧΑΡΤΗΣ
const LOCATION_DATA = {
  "Ελλάδα": {
    "Αττική": {
      "Αττική": [
        "Αθήνα", "Πειραιάς", "Νέα Σμύρνη", "Καλλιθέα", "Παλαιό Φάληρο", "Άλιμος", "Ελληνικό", 
        "Αργυρούπολη", "Γλυφάδα", "Βούλα", "Βουλιαγμένη", "Ηλιούπολη", "Άγιος Δημήτριος", 
        "Ζωγράφου", "Καισαριανή", "Βύρωνας", "Γαλάτσι", "Νέα Ιωνία", "Νέο Ηράκλειο", 
        "Νέα Φιλαδέλφεια", "Χαλάνδρι", "Μαρούσι", "Κηφισιά", "Πεύκη", "Μελίσσια", "Βριλήσσια", 
        "Αγία Παρασκευή", "Περιστέρι", "Αιγάλεω", "Χαϊδάρι", "Ίλιον", "Πετρούπολη", "Αγία Βαρβάρα", 
        "Νίκαια", "Κορυδαλλός", "Κερατσίνι", "Δραπετσώνα", "Πέραμα", "Σαλαμίνα", "Ελευσίνα", 
        "Αχαρνές", "Παλλήνη", "Γέρακας", "Κορωπί", "Μαρκόπουλο", "Ραφήνα", "Λαύριο"
      ]
    },
    "Κεντρική Μακεδονία": {
      "Θεσσαλονίκη": [
        "Θεσσαλονίκη", "Καλαμαριά", "Εύοσμος", "Κορδελιό", "Αμπελόκηποι", "Μενεμένη", "Σταυρούπολη", 
        "Πολίχνη", "Νεάπολη", "Συκιές", "Πυλαία", "Χορτιάτης", "Πανόραμα", "Θέρμη", "Ωραιόκαστρο", 
        "Μηχανιώνα", "Περαία", "Σίνδος", "Χαλάστρα"
      ],
      "Ημαθία": ["Βέροια", "Νάουσα", "Αλεξάνδρεια"],
      "Κιλκίς": ["Κιλκίς"],
      "Πέλλα": ["Έδεσσα", "Γιαννιτσά"],
      "Πιερία": ["Κατερίνη"],
      "Σέρρες": ["Σέρρες"],
      "Χαλκιδική": ["Πολύγυρος", "Νέα Μουδανιά", "Χαλκιδική"]
    },
    "Θεσσαλία": {
      "Λάρισα": ["Λάρισα", "Ελασσόνα", "Φάρσαλα"],
      "Μαγνησία": ["Βόλος", "Αλμυρός"],
      "Τρίκαλα": ["Τρίκαλα", "Καλαμπάκα"],
      "Καρδίτσα": ["Καρδίτσα"]
    },
    "Δυτική Ελλάδα": {
      "Αχαΐα": ["Πάτρα", "Αίγιο", "Καλάβρυτα"],
      "Αιτωλοακαρνανία": ["Μεσολόγγι", "Αγρίνιο", "Ναύπακτος"],
      "Ηλεία": ["Πύργος", "Αμαλιάδα"]
    },
    "Πελοπόννησος": {
      "Κορινθία": ["Κόρινθος", "Λουτράκι", "Κιάτο"],
      "Μεσσηνία": ["Καλαμάτα", "Μεσσήνη"],
      "Αργολίδα": ["Ναύπλιο", "Άργος"],
      "Αρκαδία": ["Τρίπολη", "Μεγαλόπολη"],
      "Λακωνία": ["Σπάρτη", "Γύθειο"]
    },
    "Ήπειρος": {
      "Ιωάννινα": ["Ιωάννινα", "Μέτσοβο"],
      "Άρτα": ["Άρτα"],
      "Θεσπρωτία": ["Ηγουμενίτσα"],
      "Πρέβεζα": ["Πρέβεζα", "Πάργα"]
    },
    "Στερεά Ελλάδα": {
      "Φθιώτιδα": ["Λαμία"],
      "Εύβοια": ["Χαλκίδα", "Κάρυστος"],
      "Βοιωτία": ["Λιβαδειά", "Θήβα", "Αράχωβα"],
      "Φωκίδα": ["Άμφισσα", "Δελφοί"],
      "Ευρυτανία": ["Καρπενήσι"]
    },
    "Ανατολική Μακεδονία & Θράκη": {
      "Έβρος": ["Αλεξανδρούπολη", "Ορεστιάδα", "Διδυμότειχο"],
      "Καβάλα": ["Καβάλα"],
      "Ξάνθη": ["Ξάνθη"],
      "Ροδόπη": ["Κομοτηνή"],
      "Δράμα": ["Δράμα"]
    },
    "Δυτική Μακεδονία": {
      "Κοζάνη": ["Κοζάνη", "Πτολεμαΐδα"],
      "Καστοριά": ["Καστοριά"],
      "Φλώρινα": ["Φλώρινα", "Αμύνταιο"],
      "Γρεβενά": ["Γρεβενά"]
    },
    "Ιόνια Νησιά": {
      "Κέρκυρα": ["Κέρκυρα"],
      "Ζάκυνθος": ["Ζάκυνθος"],
      "Κεφαλληνία": ["Αργοστόλι", "Ληξούρι"],
      "Λευκάδα": ["Λευκάδα"]
    },
    "Βόρειο Αιγαίο": {
      "Λέσβος": ["Μυτιλήνη"],
      "Χίος": ["Χίος"],
      "Σάμος": ["Σάμος"]
    },
    "Νότιο Αιγαίο": {
      "Κυκλάδες": ["Σύρος", "Νάξος", "Μύκονος", "Σαντορίνη", "Πάρος", "Τήνος", "Μήλος"],
      "Δωδεκάνησα": ["Ρόδος", "Κως", "Κάλυμνος", "Κάρπαθος"]
    },
    "Κρήτη": {
      "Ηράκλειο": ["Ηράκλειο", "Μοίρες", "Χερσόνησος"],
      "Χανιά": ["Χανιά", "Κίσσαμος"],
      "Ρέθυμνο": ["Ρέθυμνο"],
      "Λασίθι": ["Άγιος Νικόλαος", "Ιεράπετρα", "Σητεία"]
    }
  },
  "Κύπρος": {
    "Κύπρος": {
        "Λευκωσία": ["Λευκωσία", "Στρόβολος", "Λακατάμεια"],
        "Λεμεσός": ["Λεμεσός"],
        "Λάρνακα": ["Λάρνακα"],
        "Πάφος": ["Πάφος"],
        "Αμμόχωστος": ["Παραλίμνι", "Αγία Νάπα"],
        "Κερύνεια": ["Κερύνεια"]
    }
  },
  "Εξωτερικό": {
    "Εξωτερικό": {
        "Ευρώπη": ["Λονδίνο", "Παρίσι", "Βερολίνο"],
        "Αμερική": ["Νέα Υόρκη", "Σικάγο"],
        "Αυστραλία": ["Σίδνεϊ", "Μελβούρνη"],
        "Άλλο": ["Διεθνές"]
    }
  }
};

// 🎵 2. GENRES
const GENRES = [
  "Διεθνή Mainstream", "House", "Techno", "Rock", "HipHop / RnB / Rap", 
  "80s / 90s", "Ειδήσεις", "Αθλητικά", "Παιδικά", "Cosmopolitan", "Sophisticated", 
  "Εναλλακτικά", "Ελληνικά Επιτυχίες", "Ελληνικά Λαϊκά", "Έντεχνη",
  "Θρησκευτικά", "Κλασική", "Lounge", "Παραδοσιακά"
];

export default function MyRadios({ API_URL, currentUser }) {
  const navigate = useNavigate();
  const { showAlert } = useAlert(); 
  
  const [myStations, setMyStations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null); 
  
  const [liveMaxStations, setLiveMaxStations] = useState(3);
  
  const [isLogoValid, setIsLogoValid] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);

  const [testStatus, setTestStatus] = useState(null); 
  const [metaTestStatus, setMetaTestStatus] = useState({ status: null, title: '' }); // 🟢 Νέο State για Metadata

  const audioRef = useRef(null);

  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';
  
  const initialFormState = {
    name: '', slug: '', genre: '', stream: '', metadata: '', logo: '', 
    country: 'Ελλάδα', region: '', prefecture: '', city: '', slogan: '', description: '',
    transmissionType: 'Web Radio', frequency: '',
    website: '', facebook: '', instagram: '', twitter: '', tiktok: '',
    viber: '', phone: '', email: '', explicit: false
  };

  const [formData, setFormData] = useState(initialFormState);

  const isFormValid = useMemo(() => {
    const { name, slug, genre, stream, country, region, prefecture, city, transmissionType, frequency } = formData;
    const hasBasics = name && slug && genre && stream && country && region && prefecture && city;
    const hasFreq = transmissionType === 'Επίγειο' ? frequency : true;
    const hasLogo = selectedFile || (formData.logo !== '' && isLogoValid);
    return hasBasics && hasFreq && hasLogo;
  }, [formData, selectedFile, isLogoValid]);

  const mediaUrlDisplay = useMemo(() => {
    if (!selectedFile) return formData.logo;
    const ext = selectedFile.name.split('.').pop();
    return `__IRADIOS_SITE_ORIGIN__/media/radioassets/${formData.slug || 'station-slug'}/logo.${ext}`;
  }, [selectedFile, formData.slug, formData.logo]);

  const syncBroadcasterTier = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${BASE_URL}/users/profile/${currentUser._id || currentUser.id}`);
      const data = await res.json();
      
      if (data && data.broadcasterProfile) {
        const dbMax = data.broadcasterProfile.maxStations;
        const tierMax = data.broadcasterProfile.tier === 'premium' ? 10 : 3;
        const finalLimit = (dbMax !== undefined && dbMax !== null) ? dbMax : tierMax;
        setLiveMaxStations(finalLimit);
      }
    } catch (err) {
      setLiveMaxStations(currentUser?.broadcasterProfile?.maxStations || (currentUser?.broadcasterProfile?.tier === 'premium' ? 10 : 3));
    }
  };

  const loadMyStations = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${BASE_URL}/broadcaster/${currentUser._id || currentUser.id}/stations`);
      const data = await res.json();
      if (Array.isArray(data)) setMyStations(data);
    } catch (err) { console.error("Error loading stations:", err); }
  };

  useEffect(() => { 
    if (currentUser) {
      loadMyStations(); 
      syncBroadcasterTier();
    }
  }, [currentUser, BASE_URL]);

  useEffect(() => {
    if (!showForm && !editingId) {
      setTestStatus(null);
      setMetaTestStatus({ status: null, title: '' });
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    }
  }, [showForm, editingId]);

  const handleTestStream = (streamUrl) => {
    if (!streamUrl) {
      setTestStatus('error');
      return;
    }
    setTestStatus('testing');
    
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;
    audio.src = streamUrl;
    audio.volume = 0; 
    
    const timeout = setTimeout(() => {
      if (testStatus === 'testing') {
        audio.pause();
        setTestStatus('error');
      }
    }, 8000); 

    audio.oncanplay = () => {
      clearTimeout(timeout);
      setTestStatus('success');
      audio.pause(); 
    };

    audio.onerror = () => {
      clearTimeout(timeout);
      setTestStatus('error');
    };

    audio.play().catch(e => {});
  };

  // 🟢 ΝΕΑ ΣΥΝΑΡΤΗΣΗ ΕΛΕΓΧΟΥ METADATA
  const handleTestMetadata = async () => {
    if (!formData.stream) {
      showAlert('Προσοχή', 'Πρέπει πρώτα να συμπληρώσετε το Stream URL για να ελέγξετε τα Metadata.', 'warning');
      return;
    }

    setMetaTestStatus({ status: 'testing', title: '' });

    try {
      const queryUrl = `${BASE_URL}/metadata?stream=${encodeURIComponent(formData.stream)}${formData.metadata ? `&customMeta=${encodeURIComponent(formData.metadata)}` : ''}`;
      const res = await fetch(queryUrl);
      
      if (res.ok) {
        const data = await res.json();
        if (data.title && data.title !== '') {
          setMetaTestStatus({ status: 'success', title: data.title });
        } else {
          setMetaTestStatus({ status: 'error', title: '' });
        }
      } else {
        setMetaTestStatus({ status: 'error', title: '' });
      }
    } catch (err) {
      setMetaTestStatus({ status: 'error', title: '' });
    }
  };

  const handleAddNew = () => {
    if (myStations.length >= liveMaxStations) {
      showAlert('Οριο Σταθμων', `Έχετε φτάσει το όριο των ${liveMaxStations} σταθμών. Αναβαθμίστε το πλάνο σας για να προσθέσετε περισσότερους.`, 'warning');
      return;
    }
    setEditingId(null);
    setFormData(initialFormState);
    setSelectedFile(null);
    setIsLogoValid(true); 
    setTestStatus(null);
    setMetaTestStatus({ status: null, title: '' });
    setShowForm(true);
  };

  const handleEditClick = (station) => {
    setEditingId(station._id);
    const sourceData = station.pendingEdits || station;

    setFormData({
      ...initialFormState,
      name: sourceData.name || '',
      slug: sourceData.slug || '',
      genre: sourceData.genre || '',
      stream: sourceData.stream || '',
      metadata: sourceData.metadata || '',
      logo: sourceData.logo || '',
      slogan: sourceData.slogan || '',
      description: sourceData.description || '',
      country: sourceData.country || 'Ελλάδα',
      region: sourceData.region || '',
      prefecture: sourceData.prefecture || '',
      city: sourceData.city || '',
      transmissionType: sourceData.transmissionType || 'Web Radio',
      frequency: sourceData.frequency || '',
      website: sourceData.website || '',
      facebook: sourceData.facebook || '',
      instagram: sourceData.instagram || '',
      twitter: sourceData.twitter || '',
      tiktok: sourceData.tiktok || '',
      viber: sourceData.viber || '',
      phone: sourceData.phone || '',
      email: sourceData.email || '',
      explicit: sourceData.explicit || false
    });

    setSelectedFile(null);
    setIsLogoValid(true); 
    setTestStatus(null);
    setMetaTestStatus({ status: null, title: '' });
    setShowForm(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setIsLogoValid(true);
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    const finalFrequency = formData.transmissionType === 'Επίγειο' ? formData.frequency : '';
    
    const payloadData = new FormData();
    Object.keys(initialFormState).forEach(key => {
      let value = formData[key];
      if (key === 'frequency') value = finalFrequency;
      else if (key === 'logo' && selectedFile) return; 
      
      payloadData.append(key, value === null || value === undefined ? '' : value);
    });

    payloadData.append('broadcasterId', currentUser._id || currentUser.id);
    
    if (selectedFile) {
      payloadData.append('logoFile', selectedFile);
    }

    try {
      const url = editingId ? `${BASE_URL}/broadcaster/stations/${editingId}/edit-request` : `${BASE_URL}/broadcaster/stations`;
      const method = editingId ? 'PUT' : 'POST';
      const token = localStorage.getItem('token');
      
      const res = await fetch(url, {
        method: method,
        headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: payloadData
      });

      if (res.ok) {
        setShowForm(false);
        setFormData(initialFormState);
        setSelectedFile(null);
        setTestStatus(null);
        setMetaTestStatus({ status: null, title: '' });
        setEditingId(null);
        loadMyStations();
        showAlert('Επιτυχια!', editingId ? 'Το αίτημα αλλαγών καταχωρήθηκε.' : 'Ο σταθμός δημιουργήθηκε.', 'success');
      } else {
        const errorData = await res.json();
        showAlert('Σφαλμα', errorData.error || 'Προέκυψε σφάλμα κατά την αποθήκευση.', 'error');
      }
    } catch (err) { 
      showAlert('Σφαλμα', 'Σφάλμα σύνδεσης με τον διακομιστή.', 'error'); 
    }
    setLoading(false);
  };

  const approvedCount = myStations.filter(s => s.status === 'approved').length;
  const pendingCount = myStations.filter(s => s.status === 'pending').length;

  return (
    <div className="p-6 lg:p-12 max-w-[1400px] mx-auto pb-40 animate-fade-in">
      
      {/* 🚀 HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 border-b border-white/5 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/5 shadow-lg">
               <LayoutGrid className="text-white" size={24} />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter">Τα Ραδιοφωνα <span className="text-[#ccff00]">Σου</span></h2>
          </div>
          <p className="text-zinc-500 font-medium mt-2 uppercase tracking-widest text-[10px]">Διαχειριση & Ρυθμισεις Σταθμων</p>
        </div>
        <button 
          onClick={handleAddNew} 
          disabled={myStations.length >= liveMaxStations}
          className="bg-[#ccff00] text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-[0_15px_35px_rgba(204,255,0,0.2)] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          <PlusCircle size={18} /> Νεος Σταθμος
        </button>
      </div>

      {/* --- 📊 SUMMARY BOXES --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
        <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[32px] flex flex-col justify-center">
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
             <Radio size={14} className="text-white" /> Συνολο Σταθμων
          </p>
          <div className="flex items-end gap-2">
             <h4 className="text-5xl font-black text-white leading-none tracking-tighter">{myStations.length}</h4>
             <span className="text-lg text-zinc-600 font-black mb-1">/ {liveMaxStations}</span>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 mt-4 rounded-full overflow-hidden">
             <div className="bg-white h-full transition-all duration-1000" style={{ width: `${Math.min((myStations.length / liveMaxStations) * 100, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-[#ccff00]/5 border border-[#ccff00]/20 p-8 rounded-[32px] flex flex-col justify-center">
          <p className="text-[10px] text-[#ccff00] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
            <CheckCircle size={14} /> Approved
          </p>
          <h4 className="text-5xl font-black text-[#ccff00] leading-none tracking-tighter">{approvedCount}</h4>
        </div>

        <div className="bg-orange-500/5 border border-orange-500/20 p-8 rounded-[32px] flex flex-col justify-center">
          <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
            <Clock size={14} /> Pending Review
          </p>
          <h4 className="text-5xl font-black text-orange-500 leading-none tracking-tighter">{pendingCount}</h4>
        </div>
      </div>

      {/* --- 📻 STATIONS GRID --- */}
      <div className="mb-6">
        {myStations.length === 0 ? (
          <div className="bg-zinc-900/30 border border-white/5 rounded-[40px] p-16 text-center flex flex-col items-center">
            <Radio size={48} className="text-zinc-700 mb-4" />
            <h3 className="text-2xl font-black text-white mb-2">No stations found</h3>
            <p className="text-zinc-500 text-sm mb-8">Deploy your first web radio to the iRadios Network.</p>
            <button onClick={handleAddNew} className="bg-white text-black px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#ccff00] transition-all active:scale-95 shadow-xl">
              Add Station
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myStations.map(s => {
              const isApproved = s.status === 'approved';
              const isRejected = s.status === 'rejected';
              return (
                <div key={s._id} className="bg-zinc-900/40 border border-white/5 hover:border-white/10 rounded-[40px] overflow-hidden transition-all group flex flex-col">
                  <div className="relative aspect-[2/1] overflow-hidden bg-black border-b border-white/5">
                    <img src={s.logo} alt={s.name} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity blur-md scale-125" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent"></div>
                    <div className="absolute top-5 left-5">
                      {isApproved ? (
                        <span className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 backdrop-blur-md shadow-lg">
                          <CheckCircle size={12} /> APPROVED
                        </span>
                      ) : isRejected ? (
                        <span className="bg-red-500/20 border border-red-500/50 text-red-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 backdrop-blur-md shadow-lg">
                          <X size={12} /> REJECTED
                        </span>
                      ) : (
                        <span className="bg-orange-500/20 border border-orange-500/50 text-orange-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 backdrop-blur-md shadow-lg">
                          <Clock size={12} /> PENDING
                        </span>
                      )}
                    </div>
                    <img src={s.logo} alt="" className="absolute -bottom-4 left-6 w-20 h-20 rounded-2xl object-cover border-4 border-zinc-900 shadow-2xl transition-transform group-hover:scale-105 z-10 bg-white" />
                  </div>

                  <div className="px-6 pt-8 pb-6 flex-1 flex flex-col bg-zinc-950/50">
                    <h3 className="text-2xl font-black text-white truncate mb-1">{s.name}</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate mb-4">
                      {s.genre} • {s.city ? `${s.city}, ${s.prefecture || s.region}` : (s.prefecture || s.region)}
                    </p>
                    {s.pendingEdits && (
                      <div className="text-[9px] text-orange-400 font-black mb-4 bg-orange-400/10 w-fit px-2.5 py-1 rounded-lg uppercase border border-orange-400/20 tracking-wider">
                          Updates Pending Approval
                      </div>
                    )}
                    <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                      <button onClick={() => navigate(`/my-schedules`)} className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <Clock size={14} /> Schedule
                      </button>
                      <button onClick={() => handleEditClick(s)} className="flex items-center justify-center gap-2 py-3 bg-[#ccff00]/10 hover:bg-[#ccff00] text-[#ccff00] hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <Edit size={14} /> Settings
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- 📝 FORM MODAL --- */}
      {showForm && (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-4xl rounded-[50px] border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar relative animate-in zoom-in-95">
            <button onClick={() => setShowForm(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white transition-colors z-10 bg-white/5 p-2 rounded-full"><X size={24} /></button>
            <div className="p-10 md:p-14">
              <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">{editingId ? 'Επεξεργασια Ραδιοφωνου' : 'Προσθηκη νεου Ραδιοφωνου'}</h2>
              <p className="text-zinc-500 font-medium mb-10 text-xs md:text-sm tracking-widest border-l-2 border-[#ccff00] pl-4">
                {editingId ? 'Οι αλλαγές θα ελεγχθούν από την ομάδα' : 'Συμπλήρωσε τα στοιχεία του σταθμού σου'}
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-10">
                <div className="space-y-6 bg-black/20 p-8 rounded-[32px] border border-white/5 mt-8">
                  <h3 className="text-[#ccff00] font-black text-[10px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Globe size={14}/> Το Stream & Το Λογοτυπο σασ</h3>
                  <div className="flex flex-col md:flex-row items-start gap-8">
                    
                    {/* Logo Preview Area */}
                    <div className="w-28 h-28 rounded-3xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-white/10 shrink-0 relative">
                      {selectedFile ? (
                         <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" alt="Preview" />
                      ) : formData.logo ? (
                        <img 
                          src={formData.logo} 
                          className={`w-full h-full object-cover transition-all ${!isLogoValid ? 'opacity-20 grayscale' : ''}`} 
                          alt="Logo Preview" 
                          onLoad={() => setIsLogoValid(true)}
                          onError={() => setIsLogoValid(false)}
                        />
                      ) : (
                        <ImageIcon className="text-zinc-700" size={32} />
                      )}
                    </div>

                    <div className="flex-1 w-full space-y-4">
                      {/* FILE UPLOAD */}
                      <div>
                         <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2 mb-2"><Upload size={12}/> Ανεβασε Αρχειο Λογοτυπου (Αναλυση 1:1 & μορφη jpg η png)</label>
                         <input 
                           type="file" 
                           accept="image/*" 
                           onChange={handleFileChange} 
                           className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-3 text-xs text-zinc-400 file:bg-[#ccff00] file:text-black file:border-0 file:rounded-lg file:px-4 file:py-1.5 file:mr-4 file:font-black file:text-[10px] file:cursor-pointer hover:border-white/20 transition-all cursor-pointer" 
                         />
                      </div>

                      {/* URL INPUT */}
                      <div>
                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest block mb-2">
                           <span className="flex items-center gap-2"><LinkIcon size={12}/> {selectedFile ? 'Media URL (Αυτόματο)' : 'H Eισαγωγη URL'}</span>
                        </label>
                        <input 
                          type="url" 
                          required={!selectedFile} 
                          readOnly={!!selectedFile}
                          value={mediaUrlDisplay} 
                          onChange={e => {
                            setFormData({...formData, logo: e.target.value});
                            setIsLogoValid(true); 
                          }} 
                          className={`w-full bg-black border h-12 rounded-xl px-4 text-xs outline-none transition-all ${
                            selectedFile 
                              ? 'text-[#ccff00] border-[#ccff00]/30 italic opacity-80 cursor-not-allowed' 
                              : (formData.logo && !isLogoValid 
                                  ? 'text-white border-red-500 focus:border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                                  : 'text-white border-white/10 focus:border-[#ccff00]/50')
                          }`} 
                        />
                        {formData.logo && !isLogoValid && !selectedFile && (
                           <p className="text-red-500 text-[10px] font-bold mt-2 uppercase tracking-widest flex items-center gap-1 animate-in slide-in-from-top-1">
                             <AlertTriangle size={12}/> Το URL δεν αντιστοιχεί σε έγκυρη εικόνα.
                           </p>
                        )}
                      </div>
                      
                      {/* 🟢 STREAM TEST BLOCK */}
                      <div className="bg-zinc-950/50 p-4 rounded-2xl border border-white/5 mt-4">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                          <div className="flex-1 w-full">
                            <label className="text-[9px] font-black uppercase text-[#ccff00] tracking-widest block mb-2">Stream Source URL *</label>
                            <input 
                              type="url" 
                              required 
                              value={formData.stream} 
                              onChange={e => {
                                setFormData({...formData, stream: e.target.value});
                                setTestStatus(null); 
                              }} 
                              className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white text-xs outline-none focus:border-[#ccff00]/50 transition-all" 
                            />
                          </div>
                          
                          <div className="shrink-0 mt-4 md:mt-0 flex items-end gap-3 w-full md:w-auto">
                            <button
                              type="button"
                              onClick={() => handleTestStream(formData.stream)}
                              disabled={!formData.stream || testStatus === 'testing'}
                              className="h-12 px-6 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50 transition-all w-full md:w-auto"
                            >
                              {testStatus === 'testing' ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                              Test
                            </button>

                            <div className="h-12 w-32 rounded-xl border flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all bg-black shrink-0">
                              {testStatus === null && <span className="text-zinc-600">Pending</span>}
                              {testStatus === 'testing' && <span className="text-blue-400 flex gap-1 items-center"><Activity size={12}/> Ping...</span>}
                              {testStatus === 'success' && <span className="text-green-500 flex gap-1 items-center"><CheckCircle size={12}/> Stream OK</span>}
                              {testStatus === 'error' && <span className="text-red-500 flex gap-1 items-center"><XCircle size={12}/> Error / SSL</span>}
                            </div>
                          </div>
                        </div>
                        {testStatus === 'error' && (
                        <div className="text-red-500/80 text-[9px] mt-3 font-medium space-y-2 animate-in fade-in slide-in-from-top-1">
                          <p className="flex items-center gap-1">
                            <AlertTriangle size={12}/> 
                            Σφάλμα φόρτωσης. Είτε το link είναι λάθος, είτε δεν έχει SSL (https), είτε αποκλείεται από τον browser (CORS).
                          </p>
                          <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 group relative">
                            <p className="text-zinc-500 mb-1.5 uppercase text-[8px] font-black tracking-widest">
                              Δοκιμάστε το Εναλλακτικό Proxy URL:
                            </p>
                            <div className="bg-black/40 p-2 rounded-lg border border-white/5 relative">
                              <code className="text-white break-all select-all font-mono block leading-relaxed pr-8">
                                __IRADIOS_SITE_ORIGIN__/api/proxy-stream?url={encodeURIComponent(formData.stream)}
                              </code>
                              <div className="absolute right-2 top-2 text-zinc-600 group-hover:text-[#ccff00] transition-colors">
                                <LinkIcon size={12} />
                              </div>
                            </div>
                            <p className="text-[8px] text-zinc-500 mt-2 italic">* Αν το παραπάνω URL παίζει, χρησιμοποιήστε το ως Stream URL για να παρακάμψετε τους περιορισμούς SSL/CORS.</p>
                          </div>
                        </div>
                        )}
                      </div>

                      {/* 🟢 ΝΕΟ: METADATA OVERRIDE BLOCK */}
                      <div className="bg-zinc-950/50 p-4 rounded-2xl border border-white/5 mt-4">
                        <div className="flex flex-col md:flex-row items-center gap-4">
                          <div className="flex-1 w-full">
                            <label className="text-[9px] font-black uppercase text-purple-400 tracking-widest block mb-2">
                              Metadata JSON/XSL URL (Προαιρετικο)
                            </label>
                            <input 
                              type="url" 
                              value={formData.metadata || ''} 
                              onChange={e => {
                                setFormData({...formData, metadata: e.target.value});
                                setMetaTestStatus({ status: null, title: '' }); 
                              }} 
                              placeholder="π.χ. https://my-radio.com/status-json.xsl"
                              className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white text-xs outline-none focus:border-purple-400/50 transition-all" 
                            />
                          </div>
                          
                          <div className="shrink-0 mt-4 md:mt-0 flex items-end gap-3 w-full md:w-auto">
                            <button
                              type="button"
                              onClick={handleTestMetadata}
                              disabled={metaTestStatus.status === 'testing' || !formData.stream}
                              className="h-12 px-6 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50 transition-all w-full md:w-auto"
                            >
                              {metaTestStatus.status === 'testing' ? <Loader2 size={16} className="animate-spin text-purple-400" /> : <PlayCircle size={16} className="text-purple-400" />}
                              Test Meta
                            </button>

                            <div className="h-12 w-32 rounded-xl border flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all bg-black shrink-0 px-2 overflow-hidden text-center">
                              {metaTestStatus.status === null && <span className="text-zinc-600">Pending</span>}
                              {metaTestStatus.status === 'testing' && <span className="text-purple-400 flex gap-1 items-center"><Activity size={12}/> Fetch...</span>}
                              {metaTestStatus.status === 'success' && <span className="text-green-500 font-bold truncate" title={metaTestStatus.title}>✅ {metaTestStatus.title}</span>}
                              {metaTestStatus.status === 'error' && <span className="text-red-500 flex gap-1 items-center"><XCircle size={12}/> Error</span>}
                            </div>
                          </div>
                        </div>
                        
                        {metaTestStatus.status === 'error' && (
                        <div className="text-red-500/80 text-[9px] mt-3 font-medium space-y-2 animate-in fade-in slide-in-from-top-1">
                          <p className="flex items-center gap-1">
                            <AlertTriangle size={12}/> 
                            Αδυναμία ανάγνωσης τίτλου.
                          </p>
                          <ul className="list-disc pl-4 text-[9px] text-zinc-500 space-y-1">
                            <li>Βεβαιωθείτε ότι το URL επιστρέφει JSON/XML.</li>
                            <li>Αν το stream είναι CentovaCast/Icecast, ίσως δεν χρειάζεται να βάλετε τίποτα εδώ. Το σύστημά μας θα το βρει αυτόματα.</li>
                            <li>Αν ο server σας κόβει την πρόσβαση (CORS), δοκιμάστε να βάλετε https.</li>
                          </ul>
                        </div>
                        )}
                        <p className="text-[8px] text-zinc-600 mt-2 italic">
                          Συμπληρώστε αυτό το πεδίο <strong>ΜΟΝΟ</strong> αν ο σταθμός σας δεν βγάζει αυτόματα τίτλο τραγουδιού στο iRadios και έχετε εξωτερικό link για τα μεταδεδομένα σας.
                        </p>
                      </div>

                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] border-b border-white/10 pb-3 flex items-center gap-2">
                     <SignalHigh size={16} className="text-[#ccff00]" /> Ταυτοτητα & Μεταδοση
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Τιτλος Σταθμου *</label>
                      <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none font-bold" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Το δικο σας URL (για την Google, και το logo σας)*</label>
                      <div className="flex items-center">
                        <span className="bg-white/5 border border-white/10 border-r-0 h-12 px-3 rounded-l-xl flex items-center text-zinc-500 text-xs italic">/station/</span>
                        <input type="text" required value={formData.slug || ''} onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} placeholder="my-radio" className="w-full bg-black border border-white/10 border-l-0 h-12 rounded-r-xl px-3 text-white focus:border-[#ccff00]/50 outline-none font-bold placeholder:text-zinc-700" />
                      </div>
                      <div className="text-orange-500/80 text-[9px] mt-3 font-medium space-y-2 animate-in fade-in slide-in-from-top-1">
                          <p className="flex items-center gap-1">
                            <AlertTriangle size={12}/> 
                            Προσοχή! Δέχεται Μόνο αγγλικά (EN)
                          </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Slogan</label>
                      <input type="text" value={formData.slogan || ''} onChange={e => setFormData({...formData, slogan: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Ειδος *</label>
                      <select required value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer">
                        <option value="">Select Genre...</option>
                        {GENRES.map((g, idx) => <option key={idx} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-zinc-900/50 rounded-2xl border border-white/5 mt-4">
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-[#ccff00] uppercase tracking-widest flex items-center gap-1"><SignalHigh size={12}/> Τυπος Μεταδοσης *</label>
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
                        <label className="text-[9px] font-black text-white uppercase tracking-widest">Συχνοτητα (πρεπει να εχει μορφη: 99.2 FM) *</label>
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

                  <div className="flex items-center h-12 mt-4">
                    <label className="flex items-center gap-4 cursor-pointer group">
                      <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${formData.explicit ? 'bg-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-black border-white/20 group-hover:border-white/40'}`}>
                        {formData.explicit && <CheckCircle size={14} className="text-black" />}
                      </div>
                      <input type="checkbox" checked={formData.explicit || false} onChange={e => setFormData({...formData, explicit: e.target.checked})} className="hidden" />
                      <span className="text-xs font-black text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Explicit Content Warning</span>
                    </label>
                  </div>

                  {/* 📍 ΕΝΟΤΗΤΑ ΤΟΠΟΘΕΣΙΑΣ 4 ΕΠΙΠΕΔΩΝ */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-zinc-900/50 rounded-2xl border border-white/5">
                    
                    {/* 1. ΧΩΡΑ */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[#ccff00] uppercase tracking-widest">Χωρα *</label>
                      <select required value={formData.country} onChange={e => setFormData({...formData, country: e.target.value, region: '', prefecture: '', city: ''})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer">
                        {Object.keys(LOCATION_DATA).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {/* 2. ΠΕΡΙΦΕΡΕΙΑ */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Περιφερεια *</label>
                      <select required value={formData.region} onChange={e => setFormData({...formData, region: e.target.value, prefecture: '', city: ''})} disabled={!formData.country} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50">
                        <option value="">Επιλέξτε...</option>
                        {formData.country && Object.keys(LOCATION_DATA[formData.country]).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    {/* 3. ΝΟΜΟΣ */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Νομος / Επαρχια *</label>
                      <select required value={formData.prefecture} onChange={e => setFormData({...formData, prefecture: e.target.value, city: ''})} disabled={!formData.region} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50">
                        <option value="">Επιλέξτε...</option>
                        {formData.region && Object.keys(LOCATION_DATA[formData.country]?.[formData.region] || {}).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    {/* 4. ΠΟΛΗ */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Πολη *</label>
                      <select required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} disabled={!formData.prefecture} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50">
                        <option value="">Επιλέξτε...</option>
                        {formData.prefecture && LOCATION_DATA[formData.country]?.[formData.region]?.[formData.prefecture]?.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Περιγραφη Σταθμου / Description</label>
                    <textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} rows="3" className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-[#ccff00]/50 outline-none text-sm resize-none"></textarea>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] border-b border-white/10 pb-3">Επικοινωνια & Socials</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Email Address</label>
                      <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Τηλεφωνο</label>
                      <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none" />
                    </div>
                    
                    {/* 🟢 ΝΕΟ: VIBER INPUT */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-[#7360f2] uppercase tracking-widest flex items-center gap-1">
                        <MessageCircle size={12} /> Viber (Διεθνης μορφη π.χ. +3069...)
                      </label>
                      <input 
                        type="text" 
                        placeholder="+306912345678"
                        value={formData.viber || ''} 
                        onChange={e => setFormData({...formData, viber: e.target.value})} 
                        className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#7360f2]/50 outline-none" 
                      />
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

                <div className="space-y-2">
                   <button 
                     type="submit" 
                     disabled={loading || !isFormValid} 
                     className="w-full bg-[#ccff00] text-black h-16 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center justify-center hover:bg-[#b3e600] transition-colors disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                   >
                     {loading ? <Loader2 className="animate-spin" /> : (editingId ? 'Αποστολη για εγκριση' : 'Αποστολη για εγκριση')}
                   </button>
                   {!isFormValid && !loading && (
                      <p className="text-center text-zinc-500 text-[9px] font-bold uppercase tracking-widest animate-pulse mt-2">
                        Συμπληρωστε ολα τα υποχρεωτικα πεδια (και Λογοτυπο) για να συνεχισετε
                      </p>
                   )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
