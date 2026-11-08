import React, { useState, useEffect, useMemo, useRef } from 'react';
import {PrimaryCategorySelect,SecondaryCategorySelect} from '../components/StationCategorySelect';
import {LOCATION_DATA, stationCityOptions, stationCapital, canonicalStationLocation, inferStationPrefecture} from '../utils/stationLocations';
import {isPrimaryCategory,isSecondaryCategory,PRIMARY_CATEGORIES} from '../utils/stationCategories';
import { 
  PlusCircle, Radio, Trash2, Edit, X, 
  CheckCircle, XCircle, Clock, Star, Loader2, Search, AlertTriangle, Check, LayoutDashboard,
  LayoutGrid, List, Globe, Image as ImageIcon, Filter, SignalHigh, Upload, Link as LinkIcon, Activity, PlayCircle,
  MessageCircle 
} from 'lucide-react';



// Dropdown choices come from the shared station taxonomy.


// 🟢 Προστέθηκε το viber & το metadata
const INITIAL_STATION_STATE = { 
  name: '', slogan: '', slug: '', genre: '', secondaryGenre: '', country: 'Ελλάδα', region: '', prefecture: '', city: '', 
  transmissionType: 'Web Radio', frequency: '', 
  logo: '', stream: '', metadata: '', description: '', website: '', facebook: '', instagram: '', twitter: '', tiktok: '', 
  phone: '', viber: '', email: '', 
  explicit: false, status: 'approved', isOffline: false, isFeatured: false
};

export default function Admin({ API_URL, refreshStations }) {
  const [adminStations, setAdminStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filterStatus, setFilterStatus] = useState('');
  const [filterGenre, setFilterGenre] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  
  const [viewMode, setViewMode] = useState('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStation, setNewStation] = useState(INITIAL_STATION_STATE);
  const [editingStation, setEditingStation] = useState(null);

  const [isLogoValid, setIsLogoValid] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);

  const [testStatus, setTestStatus] = useState(null);
  const [metaTestStatus, setMetaTestStatus] = useState({ status: null, title: '' }); // 🟢 Νέο State για Metadata

  const audioRef = useRef(null);

  const loadAdminStations = async () => {
    try {
      const res = await fetch(`${API_URL}/stations/all`); 
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      if(Array.isArray(data)) setAdminStations(data);
    } catch (err) { console.error("Error loading stations:", err); }
  };

  useEffect(() => { loadAdminStations(); }, []);

  useEffect(() => {
    if (!showAddModal && !editingStation) {
      setTestStatus(null);
      setMetaTestStatus({ status: null, title: '' });
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    }
  }, [showAddModal, editingStation]);

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

    audio.play().catch(e => {
        // Ignored on purpose
    });
  };

  // 🟢 ΝΕΑ ΣΥΝΑΡΤΗΣΗ ΕΛΕΓΧΟΥ METADATA ΣΤΟΝ ADMIN
  const handleTestMetadata = async (currentFormData) => {
    if (!currentFormData.stream) {
      alert('Πρέπει πρώτα να συμπληρώσετε το Stream URL για να ελέγξετε τα Metadata.');
      return;
    }

    setMetaTestStatus({ status: 'testing', title: '' });

    try {
      const queryUrl = `${API_URL}/metadata?stream=${encodeURIComponent(currentFormData.stream)}${currentFormData.metadata ? `&customMeta=${encodeURIComponent(currentFormData.metadata)}` : ''}`;
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

  const checkFormValidity = (formData) => {
    const { name, slug, genre, stream, country, region, prefecture, city, transmissionType, frequency } = formData;
    const hasBasics = name && slug && isPrimaryCategory(genre) && isSecondaryCategory(formData.secondaryGenre) && stream && country && region && prefecture && city && stationCityOptions(country, region, prefecture).includes(city);
    const hasFreq = transmissionType === 'Επίγειο' ? frequency : true;
    const hasLogo = selectedFile || (formData.logo !== '' && isLogoValid);
    return hasBasics && hasFreq && hasLogo;
  };

  const mediaUrlDisplay = (formData) => {
    if (!selectedFile) return formData.logo;
    const ext = selectedFile.name.split('.').pop();
    return `__IRADIOS_SITE_ORIGIN__/media/radioassets/${formData.slug || 'station-slug'}/logo.${ext}`;
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

  const prepareFormData = (formData) => {
    const finalFrequency = formData.transmissionType === 'Επίγειο' ? formData.frequency : '';
    
    const payloadData = new FormData();
    Object.keys(INITIAL_STATION_STATE).forEach(key => {
      let value = formData[key];
      if (key === 'frequency') value = finalFrequency;
      if (key === 'logo' && selectedFile) return; 
      payloadData.append(key, value === null || value === undefined ? '' : value);
    });

    if (selectedFile) {
      payloadData.append('logoFile', selectedFile);
    }

    return payloadData;
  };

  const handleAddStation = async (e) => {
    e.preventDefault();
    if (!checkFormValidity(newStation)) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/stations`, {
        method: 'POST',
        headers: { ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {}) },
        body: prepareFormData(newStation)
      });
      if (res.ok) {
        setNewStation(INITIAL_STATION_STATE);
        setSelectedFile(null);
        setShowAddModal(false);
        setTestStatus(null);
        setMetaTestStatus({ status: null, title: '' });
        loadAdminStations();
        if (refreshStations) refreshStations();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Σφάλμα δημιουργίας");
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleUpdateStation = async (e) => {
    e.preventDefault();
    if (!checkFormValidity(editingStation)) return;

    setLoading(true);
    try {
      // Σιγουρευόμαστε ότι στέλνουμε το update στο σωστό _id του Σταθμού
      const targetId = editingStation._id || editingStation.id; 
      const res = await fetch(`${API_URL}/admin/stations/${targetId}`, {
        method: 'PUT',
        headers: { ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {}) },
        body: prepareFormData(editingStation)
      });
      
      if (res.ok) {
        setEditingStation(null);
        setSelectedFile(null);
        setTestStatus(null);
        setMetaTestStatus({ status: null, title: '' });
        loadAdminStations();
        if (refreshStations) refreshStations();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Σφάλμα αποθήκευσης");
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  // Ακριβές Mapping για να μην χάνονται τα πεδία Τοποθεσίας όταν ανοίγει το Modal του Admin
  const handleEditClick = (station, isDraft = false) => {
    // Επιλέγουμε την πηγή δεδομένων (το pendingEdit document ή το κανονικό station document)
    const sourceData = canonicalStationLocation(isDraft ? station.pendingEdits : station);
    
    setEditingStation({ 
      ...INITIAL_STATION_STATE,
      // Σιγουρευόμαστε ότι κρατάμε το κεντρικό _id του σταθμού για να ξέρουμε ΠΟΙΟΝ σταθμό κάνουμε update
      _id: station._id, 
      
      // Όλα τα υπόλοιπα πεδία από την πηγή
      name: sourceData.name || '',
      slug: sourceData.slug || '',
      slogan: sourceData.slogan || '',
      genre: sourceData.genre || station.genre || '',
      secondaryGenre: sourceData.secondaryGenre || station.secondaryGenre || '',
      logo: sourceData.logo || '',
      stream: sourceData.stream || '',
      metadata: sourceData.metadata || '', // 🟢 Metadata
      description: sourceData.description || '',
      
      // Тоποθεσία: Explicit assignment για να "ξυπνήσουν" τα Dropdowns
      country: sourceData.country || 'Ελλάδα',
      region: sourceData.region || '',
      prefecture: sourceData.prefecture || inferStationPrefecture(sourceData.country || 'Ελλάδα', sourceData.region, sourceData.city),
      city: sourceData.city || '',
      
      transmissionType: sourceData.transmissionType || 'Web Radio',
      frequency: sourceData.frequency || '',
      
      website: sourceData.website || '',
      facebook: sourceData.facebook || '',
      instagram: sourceData.instagram || '',
      twitter: sourceData.twitter || '',
      tiktok: sourceData.tiktok || '',
      viber: sourceData.viber || '', // 🟢 Viber
      phone: sourceData.phone || '',
      email: sourceData.email || '',
      explicit: sourceData.explicit || false,
      
      status: station.status, // Approval is independent from stream availability.
       isOffline: station.isOffline === true,
      isFeatured: station.isFeatured || false
    });

    setSelectedFile(null);
    setIsLogoValid(true);
    setTestStatus(null);
    setMetaTestStatus({ status: null, title: '' });
  };

  const handleDelete = async (id) => {
    if(window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε οριστικά αυτόν τον σταθμό;')) {
      try {
        await fetch(`${API_URL}/admin/stations/${id}`, { 
          method: 'DELETE',
          headers: { ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {}) }
        });
        loadAdminStations();
        if (refreshStations) refreshStations();
      } catch (err) { console.error(err); }
    }
  };

  const stationAdminHeaders = () => ({
    'Content-Type': 'application/json',
    ...(localStorage.getItem('token') ? {Authorization: `Bearer ${localStorage.getItem('token')}`} : {})
  });
  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/admin/stations/${id}/status`, {
        method:'PUT', headers:stationAdminHeaders(), body:JSON.stringify({status:newStatus})
      });
      if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error || 'Αποτυχία αλλαγής κατάστασης');
      await loadAdminStations();
      refreshStations?.();
    } catch(err) { alert(err.message); }
  };
  const handleOfflineUpdate = async station => {
    try {
      const response = await fetch(`${API_URL}/admin/stations/${station._id}/offline`, {
        method:'PATCH', headers:stationAdminHeaders(),
        body:JSON.stringify({isOffline:station.isOffline !== true})
      });
      if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error || 'Αποτυχία ενημέρωσης offline');
      await loadAdminStations();
      refreshStations?.();
    } catch(err) { alert(err.message); }
  };

  const handleToggleFeatured = async (id) => {
    try {
      await fetch(`${API_URL}/admin/stations/${id}/featured`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        }
      });
      loadAdminStations();
      if (refreshStations) refreshStations();
    } catch (err) { console.error(err); }
  };

  const handleApproveEdit = async (id) => {
    if(window.confirm('Έγκριση των νέων αλλαγών; Τα νέα στοιχεία θα περάσουν LIVE.')) {
      try {
        await fetch(`${API_URL}/admin/stations/${id}/approve-edit`, { 
          method: 'POST',
          headers: { ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {}) }
        });
        loadAdminStations();
        if (refreshStations) refreshStations();
      } catch (err) { console.error(err); }
    }
  };

  const handleRejectEdit = async (id) => {
    if(window.confirm('Απόρριψη των αλλαγών; Το προσχέδιο θα διαγραφεί οριστικά.')) {
      try {
        await fetch(`${API_URL}/admin/stations/${id}/reject-edit`, { 
          method: 'DELETE',
          headers: { ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {}) }
        });
        loadAdminStations();
        if (refreshStations) refreshStations();
      } catch (err) { console.error(err); }
    }
  };

  const availableRegions = useMemo(() => {
    const regions = new Set();
    adminStations.forEach(s => { if (s.region) regions.add(s.region) });
    return Array.from(regions).sort();
  }, [adminStations]);

  const filteredStations = adminStations.filter(station => {
    const matchesSearch = 
      station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (station.city && station.city.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const isStationPending = station.status === 'pending' || station.pendingEdits;
    
    const matchesStatus = 
      filterStatus === 'approved' ? (station.status === 'approved' && !station.pendingEdits) :
      filterStatus === 'pending' ? isStationPending :
      filterStatus === 'rejected' ? station.status === 'rejected' :
       filterStatus === 'offline' ? station.isOffline === true :
      true; 

    const matchesGenre = filterGenre ? station.genre === filterGenre : true;
    const matchesType = filterType ? station.transmissionType === filterType : true;
    const matchesRegion = filterRegion ? station.region === filterRegion : true;

    return matchesSearch && matchesStatus && matchesGenre && matchesType && matchesRegion;
  }).sort((a,b)=>Number(a.isOffline === true)-Number(b.isOffline === true));

  const liveCount = adminStations.filter(s => s.status === 'approved' && !s.pendingEdits).length;
  const pendingCount = adminStations.filter(s => s.status === 'pending' || s.pendingEdits).length;

  const renderForm = (formData, setFormData, onSubmit, isEdit, isDraft = false) => {
    const isValid = checkFormValidity(formData);

    return (
      <form onSubmit={onSubmit} className="space-y-10 mt-6">
        {/* ΕΝΟΤΗΤΑ 1: MEDIA & STREAM */}
        <div className="space-y-6 bg-black/20 p-8 rounded-[32px] border border-white/5">
          <h3 className="text-[#ccff00] font-black text-[10px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Globe size={14}/> Media & Stream Assets</h3>
          <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="w-28 h-28 rounded-3xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-white/10 shrink-0 relative">
              {selectedFile ? (
                 <img src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover" alt="Preview" />
              ) : formData.logo ? (
                <img 
                  src={formData.logo} 
                  className={`w-full h-full object-cover transition-all ${!isLogoValid ? 'opacity-20 grayscale' : ''}`} 
                  alt="Station Preview" 
                  onLoad={() => setIsLogoValid(true)}
                  onError={() => setIsLogoValid(false)}
                />
              ) : (
                <ImageIcon className="text-zinc-700" size={32} />
              )}
            </div>
            
            <div className="flex-1 w-full space-y-4">
              <div>
                 <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2 mb-2"><Upload size={12}/> Ανεβασε Αρχειο Λογοτυπου</label>
                 <input 
                   type="file" 
                   accept="image/*" 
                   onChange={handleFileChange} 
                   className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-3 text-xs text-zinc-400 file:bg-[#ccff00] file:text-black file:border-0 file:rounded-lg file:px-4 file:py-1.5 file:mr-4 file:font-black file:text-[10px] file:cursor-pointer hover:border-white/20 transition-all cursor-pointer" 
                 />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest block mb-2">
                   <span className="flex items-center gap-2"><LinkIcon size={12}/> {selectedFile ? 'Media URL (Αυτόματο)' : 'H Eισαγωγη URL'}</span>
                </label>
                <input 
                  type="url" 
                  required={!selectedFile} 
                  readOnly={!!selectedFile}
                  value={mediaUrlDisplay(formData)} 
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
              </div>
              
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
                  <div className="bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                    <p className="text-zinc-400 mb-1 uppercase text-[8px] font-black">Εναλλακτικό Proxy URL (Copy-Paste):</p>
                    <code className="text-white break-all select-all font-mono">
                      __IRADIOS_SITE_ORIGIN__/api/proxy-stream?url={encodeURIComponent(formData.stream)}
                    </code>
                  </div>
                </div>
                )}
              </div>

              {/* 🟢 ΝΕΟ: METADATA OVERRIDE BLOCK ΣΤΟΝ ADMIN */}
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
                      onClick={() => handleTestMetadata(formData)}
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
                  Συμπληρώστε αυτό το πεδίο <strong>ΜΟΝΟ</strong> αν ο σταθμός δεν βγάζει αυτόματα τίτλο τραγουδιού και υπάρχει εξωτερικό link για τα μεταδεδομένα (π.χ. Icecast AutoDJ).
                </p>
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
                <span className="bg-white/5 border border-white/10 border-r-0 h-12 px-3 rounded-l-xl flex items-center text-zinc-500 text-xs italic">/station/</span>
                <input 
                  type="text" 
                  value={formData.slug || ''} 
                  onChange={e => setFormData({...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} 
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
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Βασική κατηγορία *</label>
              <PrimaryCategorySelect value={formData.genre} onChange={genre=>setFormData({...formData,genre})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white outline-none"/>
              <label className="mt-3 block text-[9px] font-black text-zinc-500 uppercase tracking-widest">Δευτερεύουσα κατηγορία *</label>
              <SecondaryCategorySelect value={formData.secondaryGenre} onChange={secondaryGenre=>setFormData({...formData,secondaryGenre})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white outline-none"/>
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

          <div className="flex items-center h-12 mt-4">
            <label className="flex items-center gap-4 cursor-pointer group">
              <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${formData.explicit ? 'bg-red-500 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-black border-white/20 group-hover:border-white/40'}`}>
                {formData.explicit && <CheckCircle size={14} className="text-black" />}
              </div>
              <input type="checkbox" checked={formData.explicit || false} onChange={e => setFormData({...formData, explicit: e.target.checked})} className="hidden" />
              <span className="text-xs font-black text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Explicit Content Warning</span>
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs font-bold text-zinc-200">
             <input type="checkbox" checked={formData.isOffline === true} onChange={e => setFormData({...formData, isOffline:e.target.checked})} className="h-4 w-4 accent-red-500" />
             Σταθμός OFFLINE — παραμένει ορατός, αλλά η αναπαραγωγή απενεργοποιείται
           </label>
           {/* 📍 ΕΝΟΤΗΤΑ ΤΟΠΟΘΕΣΙΑΣ 4 ΕΠΙΠΕΔΩΝ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-zinc-900/50 rounded-2xl border border-white/5">
            
            {/* 1. ΧΩΡΑ */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[#ccff00] uppercase tracking-widest">Χώρα *</label>
              <select required value={formData.country} onChange={e => setFormData({...formData, country: e.target.value, region: '', prefecture: '', city: ''})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer">
                {Object.keys(LOCATION_DATA).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* 2. ΠΕΡΙΦΕΡΕΙΑ */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Περιφέρεια *</label>
              <select required value={formData.region} onChange={e => setFormData({...formData, region: e.target.value, prefecture: '', city: ''})} disabled={!formData.country} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50">
                <option value="">Επιλέξτε...</option>
                {formData.country && Object.keys(LOCATION_DATA[formData.country]).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* 3. ΝΟΜΟΣ */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Νομός / Επαρχία *</label>
              <select required value={formData.prefecture} onChange={e => setFormData({...formData, prefecture: e.target.value, city: stationCapital(formData.country, formData.region, e.target.value)})} disabled={!formData.region} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50">
                <option value="">Επιλέξτε...</option>
                {formData.region && Object.keys(LOCATION_DATA[formData.country]?.[formData.region] || {}).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* 4. ΠΟΛΗ */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Πόλη *</label>
              <select required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} disabled={!formData.prefecture} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50">
                <option value="">Επιλέξτε...</option>
                {formData.prefecture && stationCityOptions(formData.country, formData.region, formData.prefecture).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

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

        <div className="flex flex-col gap-2 mt-8 pt-6 border-t border-white/10">
          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => { setShowAddModal(false); setEditingStation(null); }} className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">
              Ακυρωση
            </button>
            {!isDraft && (
              <button 
                type="submit" 
                disabled={loading || !isValid} 
                className="px-8 py-3 bg-[#ccff00] text-black text-xs font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-transform shadow-[0_4px_20px_rgba(204,255,0,0.2)] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
              >
                {loading ? 'Αποθηκευση...' : 'Αποθηκευση'}
              </button>
            )}
          </div>
          {!isValid && !loading && (
             <p className="text-right text-zinc-500 text-[9px] font-bold uppercase tracking-widest animate-pulse mt-2">
               Συμπληρωστε ολα τα υποχρεωτικα πεδια (και Λογοτυπο) για αποθηκευση
             </p>
          )}
        </div>
      </form>
    );
  };

  return (
    <div className="p-6 lg:p-12 max-w-full pb-40 animate-fade-in">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <LayoutDashboard className="text-[#ccff00]" size={28} />
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Station Management</h2>
          </div>
          <p className="text-zinc-500 text-sm font-medium">Διαχειριστείτε τους σταθμούς του δικτύου σας.</p>
        </div>
        <button 
          onClick={() => {
            setNewStation(INITIAL_STATION_STATE);
            setSelectedFile(null);
            setIsLogoValid(true);
            setTestStatus(null);
            setMetaTestStatus({ status: null, title: '' });
            setShowAddModal(true);
          }}
          className="bg-[#ccff00] text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-[0_10px_30px_rgba(204,255,0,0.2)]"
        >
          Προσθηκη Νεου Σταθμου
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[32px]">
          <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Συνολο Σταθμων</div>
          <div className="text-4xl font-black text-white">{adminStations.length}</div>
        </div>
        <div className="bg-[#ccff00]/5 border border-[#ccff00]/10 p-8 rounded-[32px]">
          <div className="text-[#ccff00] text-[10px] font-black uppercase tracking-widest mb-2">Live Now</div>
          <div className="text-4xl font-black text-[#ccff00]">{liveCount}</div>
        </div>
        <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[32px]">
          <div className="text-orange-500 text-[10px] font-black uppercase tracking-widest mb-2">Pending</div>
          <div className="text-4xl font-black text-white">{pendingCount}</div>
        </div>
      </div>

      {/* 🟢 FILTERS & SEARCH */}
      <div className="bg-black/40 border border-white/5 p-4 rounded-3xl mb-8 flex flex-col xl:flex-row gap-4 items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative w-full xl:w-96 shrink-0">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Αναζήτηση σταθμού ή πόλης..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900/80 border border-white/10 h-12 rounded-xl pl-12 pr-10 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-all placeholder:text-zinc-600"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* 🟢 Status Filter */}
          <div className="flex items-center gap-2 bg-zinc-900/50 px-3 h-12 rounded-xl border border-white/10 shrink-0">
            <Activity size={16} className={filterStatus === 'pending' ? 'text-orange-500' : 'text-zinc-500'} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-transparent text-xs text-white outline-none cursor-pointer font-bold">
              <option value="">Όλα τα Status</option>
              <option value="approved">✅ Μόνο Approved</option>
              <option value="pending">⏳ Μόνο Pending / Αιτήματα</option>
              <option value="rejected">❌ Μόνο Rejected</option>
               <option value="offline">🔴 Μόνο Offline</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-zinc-900/50 px-3 h-12 rounded-xl border border-white/10 shrink-0">
            <Filter size={16} className="text-zinc-500" />
            <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)} className="bg-transparent text-xs text-white outline-none cursor-pointer">
              <option value="">Όλα τα Είδη</option>
              {PRIMARY_CATEGORIES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/50 px-3 h-12 rounded-xl border border-white/10 shrink-0">
            <SignalHigh size={16} className="text-zinc-500" />
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-transparent text-xs text-white outline-none cursor-pointer">
              <option value="">Όλες οι Μεταδόσεις</option>
              <option value="Web Radio">Web Radio</option>
              <option value="Επίγειο">Επίγειο (FM)</option>
              <option value="DAB">DAB</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/50 px-3 h-12 rounded-xl border border-white/10 shrink-0">
            <Globe size={16} className="text-zinc-500" />
            <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="bg-transparent text-xs text-white outline-none cursor-pointer max-w-[150px]">
              <option value="">Όλες οι Περιοχές</option>
              {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 rounded-xl p-1 shrink-0 ml-auto xl:ml-0">
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#ccff00] text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
            <List size={18} />
          </button>
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#ccff00] text-black shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* STATIONS LIST / GRID */}
      <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
        {filteredStations.length === 0 ? (
          <div className="col-span-full text-center text-zinc-500 py-20 font-bold italic border border-dashed border-white/10 rounded-[32px]">Κανένα αποτέλεσμα με αυτά τα φίλτρα.</div>
        ) : (
          filteredStations.map(station => (
            <div 
              key={station._id} 
              className={`bg-zinc-900/30 border border-white/5 p-4 sm:p-5 rounded-[24px] group hover:bg-zinc-900/60 transition-all relative flex ${viewMode === 'grid' ? 'flex-col gap-5' : 'flex-col sm:flex-row sm:items-center justify-between gap-4'}`}
            >
              
              {station.pendingEdits && (
                <div className={`absolute bg-orange-500 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1 shadow-lg z-10 ${viewMode === 'grid' ? '-top-3 left-1/2 -translate-x-1/2' : '-top-3 left-6'}`}>
                  <Clock size={12} /> Pending Edits
                </div>
              )}

              <div className={`flex ${viewMode === 'grid' ? 'flex-col items-center text-center' : 'items-center gap-5'}`}>
                <img 
                  src={station.logo} 
                  className={`${viewMode === 'grid' ? 'w-24 h-24 mb-3' : 'w-14 h-14 sm:w-16 sm:h-16'} rounded-2xl object-cover bg-black shadow-xl shrink-0`} 
                  alt="" 
                />
                <div className="min-w-0">
                  <h4 className={`font-bold text-white text-base sm:text-lg flex items-center gap-2 truncate ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                    {station.name}
                    {station.isOffline === true && <span className="rounded-md border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[9px] font-black text-red-400">OFFLINE</span>}
                     {station.explicit && <AlertTriangle size={14} className="text-red-500 shrink-0" />}
                    {station.isFeatured && <Star size={14} className="text-[#ccff00] fill-[#ccff00] shrink-0" />}
                  </h4>
                  <div className={`flex flex-wrap items-center gap-2 mt-1.5 ${viewMode === 'grid' ? 'justify-center' : ''}`}>
                    
                    {/* 🟢 BADGE ΜΕΤΑΔΟΣΗΣ ΣΤΗ ΛΙΣΤΑ */}
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${station.transmissionType === 'Επίγειο' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : station.transmissionType === 'DAB' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                      {station.transmissionType || 'Web Radio'} {station.frequency && `- ${station.frequency}`}
                    </span>
                    
                    <span className="w-1 h-1 bg-zinc-700 rounded-full hidden sm:block"></span>
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-wider truncate">
                      {/* Απεικόνιση Πόλη, Νομός */}
                      {station.city ? `${station.city}, ${station.prefecture || station.region}` : (station.prefecture || station.region)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`flex flex-col sm:flex-row items-center gap-3 ${viewMode === 'grid' ? 'justify-center w-full pt-4 border-t border-white/5' : 'items-end sm:items-center'}`}>
                
                {station.pendingEdits && (
                  <div className="flex items-center gap-2 bg-orange-500/10 p-1.5 rounded-xl border border-orange-500/20">
                    <button onClick={() => handleEditClick(station, true)} className="text-[10px] font-black text-orange-400 uppercase tracking-widest px-2 hover:text-white transition-colors">Προβολη</button>
                    <button onClick={() => handleApproveEdit(station._id)} className="w-8 h-8 rounded-lg bg-green-500 text-black flex items-center justify-center hover:scale-105 transition-all" title="Έγκριση"><Check size={16} strokeWidth={3} /></button>
                    <button onClick={() => handleRejectEdit(station._id)} className="w-8 h-8 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all" title="Απόρριψη"><X size={16} strokeWidth={3} /></button>
                  </div>
                )}

                <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-xl border border-white/5">
                  <button onClick={() => handleToggleFeatured(station._id)} className={`p-1.5 rounded-lg transition-all ${station.isFeatured ? 'text-[#ccff00]' : 'text-zinc-600 hover:text-white'}`} title="Featured">
                    <Star size={16} fill={station.isFeatured ? '#ccff00' : 'none'} />
                  </button>
                  <button disabled={loading} onClick={() => handleStatusUpdate(station._id, 'approved')} className={`p-1.5 rounded-lg transition-all ${station.status === 'approved' ? 'bg-green-500/20 text-green-500' : 'text-zinc-600 hover:text-white'}`} title="Approve">
                    <CheckCircle size={16} />
                  </button>
                  <button disabled={loading} onClick={() => handleStatusUpdate(station._id, 'pending')} className={`p-1.5 rounded-lg transition-all ${station.status === 'pending' ? 'bg-orange-500/20 text-orange-500' : 'text-zinc-600 hover:text-white'}`} title="Set Pending">
                    <Clock size={16} />
                  </button>
                  <button disabled={loading} onClick={() => handleStatusUpdate(station._id, 'rejected')} className={`p-1.5 rounded-lg transition-all ${station.status === 'rejected' ? 'bg-red-500/20 text-red-500' : 'text-zinc-600 hover:text-white'}`} title="Reject">
                    <XCircle size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" disabled={loading} onClick={() => handleOfflineUpdate(station)}
                     title={station.isOffline ? 'Ενεργοποίηση μετάδοσης' : 'Ορισμός ως OFFLINE'}
                     aria-label={station.isOffline ? 'Ενεργοποίηση μετάδοσης' : 'Ορισμός ως offline'}
                     className={`rounded-xl border px-2 py-2 text-[10px] font-black transition-colors ${station.isOffline ? 'border-red-500/50 bg-red-500/15 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'}`}>
                     {station.isOffline ? 'OFFLINE' : 'ONLINE'}
                   </button>
                   <button onClick={() => handleEditClick(station, false)} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-300 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete(station._id)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- ADD STATION MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f0f0f] border border-white/5 rounded-[32px] w-full max-w-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#ccff00]"></div>
            <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full z-10"><X size={20} /></button>
            <div className="p-8 md:p-10">
              <h3 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Προσθηκη Σταθμου</h3>
              <p className="text-[#ccff00] text-xs font-black uppercase tracking-widest mb-6">Δημιουργια νεου εγγραφου</p>
              {renderForm(newStation, setNewStation, handleAddStation, false)}
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT STATION MODAL --- */}
      {editingStation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f0f0f] border border-white/5 rounded-[32px] w-full max-w-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#ccff00]"></div>
            <button onClick={() => setEditingStation(null)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full z-10"><X size={20} /></button>
            <div className="p-8 md:p-10">
              <h3 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase mb-2">
                {!editingStation._id ? 'Προβολη Draft' : 'Επεξεργασια Σταθμου'}
              </h3>
              <p className={`text-xs font-black uppercase tracking-widest mb-6 ${!editingStation._id ? 'text-orange-500' : 'text-[#ccff00]'}`}>
                {!editingStation._id ? 'Στοιχεια προς εγκριση απο τον Broadcaster' : 'Οι αλλαγες θα περασουν απευθειας live'}
              </p>
              {renderForm(editingStation, setEditingStation, handleUpdateStation, true, !editingStation._id)}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
