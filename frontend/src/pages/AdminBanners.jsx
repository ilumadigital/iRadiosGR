import {adminFetch as fetch} from '../utils/adminFetch';
import React, { useState, useEffect } from 'react';
import '../styles/ad-campaign-console.css';
import { Plus, Edit2, Trash2, Megaphone, LayoutPanelTop, Rows3, LayoutGrid, ExternalLink, Activity, X, Check, Loader2 } from 'lucide-react';

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

export default function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,setFilter]=useState('all');
  const [statusFilter,setStatusFilter]=useState('all');
  const [searchTerm,setSearchTerm]=useState('');
  const [loadError,setLoadError]=useState('');
  const stage=typeof window!=='undefined'&&window.location.hostname==='stage.iradios.gr';

  // 🟢 FILE UPLOAD STATES
  const [bannerFile, setBannerFile] = useState(null);
  const [squareBannerFile, setSquareBannerFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    squareImageUrl: '',
    targetUrl: '',
    placement: [], 
    status: 'active',
    targetCountry: 'All', targetRegion: 'All', targetLocations: ['All']
  });

  const fetchBanners = async () => {
    try {
      setLoading(true);setLoadError('');
      const res = await fetch('/api/banners/admin');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setBanners(data);
    } catch (err) {
      console.error("Σφάλμα φόρτωσης banners:", err);
      setLoadError('Αποτυχία φόρτωσης. Έλεγξε σύνδεση και δικαιώματα.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleOpenModal = (banner = null) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title,
        description: banner.description,
        imageUrl: banner.imageUrl,
        squareImageUrl: banner.squareImageUrl || '',
        targetUrl: banner.targetUrl,
        placement: Array.isArray(banner.placement) ? banner.placement : [banner.placement],
        status: banner.status || (banner.isActive ? 'active' : 'expired'),
        targetCountry: banner.targetCountry || 'All',
        targetRegion: banner.targetRegion || 'All',
        targetLocations: banner.targetLocations || ['All']
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: '',
        description: '',
        imageUrl: '',
        squareImageUrl: '',
        targetUrl: '',
        placement: ['home'], 
        status: 'active',
        targetCountry: 'All', targetRegion: 'All', targetLocations: ['All']
      });
    }
    // Καθαρισμός επιλεγμένων αρχείων κάθε φορά που ανοίγει το Modal
    setBannerFile(null);
    setSquareBannerFile(null);
    setIsModalOpen(true);
  };

  const togglePlacement = (type) => {
    setFormData(prev => {
      const current = prev.placement;
      const next = current.includes(type) 
        ? current.filter(t => t !== type) 
        : [...current, type];
      return { ...prev, placement: next };
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBanner(null);
    setBannerFile(null);
    setSquareBannerFile(null);
  };

  // 🟢 ΥΠΟΒΟΛΗ ΜΕ UPLOAD ΑΡΧΕΙΩΝ
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.placement.length === 0) {
      return alert("Παρακαλώ επιλέξτε τουλάχιστον μία τοποθεσία εμφάνισης.");
    }
    
    // Έλεγχος ότι υπάρχει εικόνα
    if (!formData.imageUrl && !bannerFile) {
      return alert("Παρακαλώ επιλέξτε το βασικό εικαστικό (Horizontal Banner).");
    }

    setUploading(true);

    try {
      let finalImageUrl = formData.imageUrl;
      let finalSquareUrl = formData.squareImageUrl;

      // 1. Upload Horizontal Banner (αν επιλέχθηκε αρχείο)
      if (bannerFile) {
        const fileData = new FormData();
        fileData.append('imageFile', bannerFile);
        
        const res = await fetch(`/api/uploads/upload-banner`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` },
          body: fileData
        });
        
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Αποτυχία ανεβάσματος Horizontal Banner.");
        finalImageUrl = result.url;
      }

      // 2. Upload Square Banner (αν επιλέχθηκε αρχείο)
      if (squareBannerFile) {
        const sqData = new FormData();
        sqData.append('imageFile', squareBannerFile);
        
        const sqRes = await fetch(`/api/uploads/upload-banner`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` },
          body: sqData
        });
        
        const sqResult = await sqRes.json();
        if (!sqRes.ok) throw new Error(sqResult.error || "Αποτυχία ανεβάσματος Square Banner.");
        finalSquareUrl = sqResult.url;
      }

      // 3. Αποθήκευση Δεδομένων Στη Βάση
      const payload = {
        ...formData,
        imageUrl: finalImageUrl,
        squareImageUrl: finalSquareUrl
      };

      const url = editingBanner ? `/api/banners/admin/${editingBanner._id}` : '/api/banners/admin';
      const method = editingBanner ? 'PUT' : 'POST';

      const dbRes = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (dbRes.ok) {
        fetchBanners();
        handleCloseModal();
      } else {
        alert("Υπήρξε κάποιο σφάλμα κατά την αποθήκευση.");
      }
    } catch (err) {
      console.error(err);
      alert("Σφάλμα: " + err.message);
    }
    
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Σίγουρα θέλεις να διαγράψεις αυτή τη διαφήμιση;')) return;
    try {
      const res = await fetch(`/api/banners/admin/${id}`, { method: 'DELETE' });
      if (res.ok) fetchBanners();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Έλεγξες το εικαστικό; Η διαφήμιση θα βγει LIVE και θα ξεκινήσει να μετράει ο χρόνος της!')) return;
    try {
      const res = await fetch(`/api/admin/banners/${id}/approve`, { method: 'PUT' });
      if (res.ok) {
        alert("Επιτυχής Έγκριση! Η διαφήμιση είναι πλέον LIVE.");
        fetchBanners();
      } else {
        alert("Σφάλμα κατά την έγκριση.");
      }
    } catch (err) {
      console.error(err);
      alert("Σφάλμα δικτύου.");
    }
  };

  const cloneStageBanner=async banner=>{
    if(!window.confirm('Δημιουργία δοκιμαστικού αντιγράφου χωρίς αλλαγή της παραγωγικής καμπάνιας;'))return;
    try{
      const res=await fetch(`/api/banners/admin/${banner._id}/clone-stage`,{method:'POST'});
      if(!res.ok)throw Error((await res.json().catch(()=>({}))).error||'Αποτυχία.');
      await fetchBanners();
    }catch(error){alert(error.message);}
  };
  const filteredBanners=banners.filter(b=>
    (filter==='all'||b.placement?.includes(filter))&&
    (statusFilter==='all'||b.status===statusFilter)&&
    [b.title,b.description].some(v=>String(v||'').toLocaleLowerCase('el-GR')
      .includes(searchTerm.toLocaleLowerCase('el-GR')))
  );

  const placementOptions = [
    { id: 'hero', label: 'Hero (Top)', icon: <LayoutPanelTop size={14} />, color: 'bg-blue-500' },
    { id: 'home', label: 'Home Feed', icon: <Rows3 size={14} />, color: 'bg-emerald-500' },
    { id: 'radio_feed', label: 'Radio Grid', icon: <LayoutGrid size={14} />, color: 'bg-purple-500' },
    { id: 'news_feed', label: 'Newsfeed', icon: <Rows3 size={14} />, color: 'bg-orange-600' },
    { id: 'station_profile', label: 'Προφίλ Σταθμού', icon: <LayoutPanelTop size={14} />, color: 'bg-cyan-700' },
  ];

  return (
    <div className="admin-legacy-page ad-console space-y-6 text-white">
      
      <div className="ad-console-hero flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-white flex items-center gap-3">
            <Megaphone className="text-[#ccff00]" size={32} /> Διαφημιστικά banners
          </h1>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-[#ccff00] text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center gap-2"
        >
          <Plus size={16} /> Νέο banner
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="ad-console-stat"><p className="text-xs text-zinc-400">Σύνολο καμπανιών</p><p className="mt-2 text-3xl font-black">{banners.length}</p></div>
        <div className="ad-console-stat"><p className="text-xs text-[#ccff00]">Ενεργές</p><p className="mt-2 text-3xl font-black">{banners.filter(b=>b.status==='active').length}</p></div>
        <div className="ad-console-stat col-span-2 md:col-span-1"><p className="text-xs text-amber-300">Για έγκριση</p><p className="mt-2 text-3xl font-black">{banners.filter(b=>b.status==='pending').length}</p></div>
      </div>
      <div className="ad-console-toolbar">
        <input type="search" aria-label="Αναζήτηση banner" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
          placeholder="Αναζήτηση καμπάνιας…" className="ad-console-filter min-w-[220px] flex-1"/>
        <select aria-label="Κατάσταση" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="ad-console-filter">
          <option value="all">Όλες οι καταστάσεις</option><option value="active">Ενεργές</option>
          <option value="pending">Προς έγκριση</option><option value="expired">Ληγμένες</option>
          <option value="rejected">Απορριφθείσες</option>
        </select>
        <button type="button" onClick={fetchBanners} className="ad-console-filter">Ανανέωση</button>
        {stage&&<span className="ad-console-label ad-console-demo">STAGING · Μόνο δοκιμαστικές καμπάνιες</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-8 bg-zinc-900/50 p-2 rounded-2xl w-fit border border-white/5">
        <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter === 'all' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}>Όλες</button>
        {placementOptions.map(opt => (
          <button 
            key={opt.id} 
            onClick={() => setFilter(opt.id)} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${filter === opt.id ? `${opt.color} text-white shadow-lg` : 'text-zinc-400 hover:text-white'}`}
          >
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs font-semibold text-zinc-400">{filteredBanners.length} από {banners.length} banners</p>
      {loadError&&<p role="alert" className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-200">{loadError}</p>}
      {loading ? (
        <div className="flex justify-center items-center h-40"><span className="text-[#ccff00] font-bold animate-pulse">Φόρτωση...</span></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {!filteredBanners.length&&<div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-dashed border-white/10 bg-white/[.025] p-10 text-center text-sm text-zinc-400">
            Δεν υπάρχουν banners για αυτή την τοποθέτηση. Επίλεξε άλλο φίλτρο ή πρόσθεσε νέο banner.
          </div>}
          {filteredBanners.map(banner => {
            const isPending = banner.status === 'pending';
            const isActive = banner.status === 'active' && (!stage || banner.isStageCreative); 
            
            return (
              <div key={banner._id} className={`ad-console-card bg-zinc-900 rounded-3xl overflow-hidden border transition-all ${isActive ? 'border-white/10 hover:border-[#ccff00]/50' : isPending ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]' : 'border-red-500/30 opacity-60'}`}>
                
                <div className="h-40 bg-zinc-800 relative overflow-hidden group">
                  <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                    {(Array.isArray(banner.placement)?banner.placement:[]).map(p => (
                      <span key={p} className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-black/80 text-white border border-white/10 shadow-lg">
                        {p}
                      </span>
                    ))}
                    {/* 🟢 STATUS BADGES */}
                    {stage&&!banner.isStageCreative&&<span className="ad-console-label ad-console-demo">Εισαγμένο · Δεν προβάλλεται</span>}
                     {isPending && <span className="bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-lg animate-pulse">PENDING</span>}
                    {banner.status === 'expired' && <span className="bg-red-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-lg">ΛΗΓΜΕΝΟ</span>}
                    {banner.status === 'rejected' && <span className="bg-red-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shadow-lg">ΑΠΟΡΡΙΦΘΗΚΕ</span>}
                  </div>
                  {/* Εμφάνιση Τοποθεσίας πάνω στην εικόνα αν δεν είναι All */}
                  {banner.targetLocations && banner.targetLocations[0] !== 'All' && (
                    <div className="absolute bottom-3 left-3 bg-purple-500/90 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-lg flex items-center gap-1 backdrop-blur-sm">
                      📍 {banner.targetLocations[0]}
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <h3 className="font-bold text-lg text-white truncate">{banner.title}</h3>

                  <div className="grid grid-cols-3 gap-2 border-y border-white/5 py-3">
                    <div className="text-center">
                      <div className="text-[8px] text-zinc-500 uppercase font-bold">Views</div>
                      <div className="font-black text-white text-sm">{banner.impressions}</div>
                    </div>
                    <div className="text-center border-l border-white/5">
                      <div className="text-[8px] text-zinc-500 uppercase font-bold">Clicks</div>
                      <div className="font-black text-[#ccff00] text-sm">{banner.clicks}</div>
                    </div>
                    <div className="text-center border-l border-white/5">
                      <div className="text-[8px] text-zinc-500 uppercase font-bold">CTR</div>
                      <div className="font-black text-blue-400 text-sm">
                        {banner.impressions > 0 ? ((banner.clicks / banner.impressions) * 100).toFixed(1) : '0'}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <a href={banner.targetUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1">
                      <ExternalLink size={12} /> Link
                    </a>
                    
                    <div className="flex gap-2">
                      {isPending && (!stage||banner.isStageCreative) && (
                        <button onClick={() => handleApprove(banner._id)} className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" title="Έγκριση & Έναρξη">
                          <Check size={16} strokeWidth={3} />
                        </button>
                      )}
                      {stage&&!banner.isStageCreative&&
                        <button type="button" onClick={()=>cloneStageBanner(banner)} className="ad-console-filter !text-purple-200">Αντίγραφο</button>}
                      <button onClick={() => handleOpenModal(banner)} className="p-2 bg-white/5 text-zinc-300 hover:text-[#ccff00] rounded-xl transition-all"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(banner._id)} className="p-2 bg-white/5 text-zinc-300 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="ad-console-modal bg-zinc-950 border border-white/10 p-6 md:p-8 rounded-[32px] w-full max-w-xl shadow-2xl relative animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={handleCloseModal} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full">
              <X size={20} />
            </button>

            <h2 className="text-2xl font-black italic tracking-tight mb-6 flex items-center gap-2">
              <Activity className="text-[#ccff00]" /> {editingBanner ? 'Επεξεργασία Banner' : 'Νέο Banner'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] pl-1">Τοποθεσίες Προβολής</label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {placementOptions.map(opt => {
                    const isSelected = formData.placement.includes(opt.id);
                    return (
                      <div 
                        key={opt.id} onClick={() => togglePlacement(opt.id)}
                        className={`relative cursor-pointer p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 group ${isSelected ? `${opt.color} border-transparent text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]` : 'bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/20'}`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-white text-black rounded-full p-0.5">
                            <Check size={10} strokeWidth={4} />
                          </div>
                        )}
                        <div className={`${isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`}>
                          {opt.icon}
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-tighter text-center ${isSelected ? 'text-white' : ''}`}>
                          {opt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Τίτλος</label>
                  <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ccff00]" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Κατάσταση</label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ccff00]"
                  >
                    <option value="active">🟢 Ενεργό (Live)</option>
                    <option value="pending">🟠 Εκκρεμεί (Pending)</option>
                    <option value="expired">🔴 Ανενεργό (Expired)</option>
                    <option value="rejected">🔴 Απορρίφθηκε</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Περιγραφή</label>
                <textarea required rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ccff00] resize-none"></textarea>
              </div>

              <div className="bg-zinc-900/50 rounded-2xl border border-white/5 p-4 mt-6">
                <h4 className="text-purple-400 font-black text-[11px] uppercase tracking-widest mb-4">📍 Στόχευση Περιοχής</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Χώρα</label>
                    <select 
                      value={formData.targetCountry || 'All'} 
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({ ...formData, targetCountry: val, targetRegion: 'All', targetLocations: [val === 'All' ? 'All' : val] });
                      }} 
                      className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-white focus:border-purple-500 outline-none appearance-none cursor-pointer text-xs font-bold transition-colors"
                    >
                      <option value="All">Όλες οι Χώρες (Global)</option>
                      {Object.keys(LOCATION_DATA).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Νομός / Περιφέρεια</label>
                      <select 
                        value={formData.targetRegion || 'All'} 
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({ ...formData, targetRegion: val, targetLocations: [val === 'All' ? formData.targetCountry : val] });
                        }} 
                        disabled={!formData.targetCountry || formData.targetCountry === 'All'}
                        className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-white focus:border-purple-500 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold transition-colors"
                      >
                        <option value="All">Όλοι οι Νομοί</option>
                        {formData.targetCountry && formData.targetCountry !== 'All' && 
                          Object.keys(LOCATION_DATA[formData.targetCountry]).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Πόλη</label>
                      <select 
                        value={(formData.targetLocations && formData.targetLocations[0]) || 'All'} 
                        onChange={e => setFormData({...formData, targetLocations: [e.target.value]})} 
                        disabled={!formData.targetRegion || formData.targetRegion === 'All'}
                        className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-white focus:border-purple-500 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold transition-colors"
                      >
                        <option value={formData.targetRegion && formData.targetRegion !== 'All' ? formData.targetRegion : 'All'}>Όλες οι Πόλεις</option>
                        {formData.targetCountry && formData.targetCountry !== 'All' && formData.targetRegion && formData.targetRegion !== 'All' && 
                          LOCATION_DATA[formData.targetCountry]?.[formData.targetRegion]?.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🟢 ΝΕΑ UPLOADS ΓΙΑ ΕΙΚΟΝΕΣ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest pl-1">Horizontal Banner (16:9)</label>
                  <div className="flex flex-col gap-2">
                    {formData.imageUrl && <input type="text" readOnly value={formData.imageUrl} className="w-full bg-black/50 border border-white/5 h-10 rounded-xl px-4 text-xs text-zinc-500 outline-none" title="Τρέχον URL" />}
                    <input 
                      type="file" 
                      accept="image/jpeg, image/png, image/webp"
                      required={!formData.imageUrl} 
                      onChange={e => setBannerFile(e.target.files[0])} 
                      className="w-full bg-zinc-900 border border-white/10 h-10 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-purple-500 file:text-white cursor-pointer" 
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest pl-1">Square Banner (1:1)</label>
                  <div className="flex flex-col gap-2">
                    {formData.squareImageUrl && <input type="text" readOnly value={formData.squareImageUrl} className="w-full bg-black/50 border border-white/5 h-10 rounded-xl px-4 text-xs text-zinc-500 outline-none" title="Τρέχον URL" />}
                    <input 
                      type="file" 
                      accept="image/jpeg, image/png, image/webp"
                      onChange={e => setSquareBannerFile(e.target.files[0])} 
                      className="w-full bg-zinc-900 border border-white/10 h-10 rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-zinc-800 file:text-white cursor-pointer" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Target URL (Website)</label>
                <input type="url" required value={formData.targetUrl} onChange={e => setFormData({...formData, targetUrl: e.target.value})} className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ccff00]" />
              </div>

              <button disabled={uploading} type="submit" className="w-full mt-4 bg-[#ccff00] disabled:bg-[#ccff00]/50 text-black rounded-2xl py-5 font-black uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[#ccff00]/10 flex items-center justify-center gap-2">
                {uploading ? <Loader2 className="animate-spin" size={18} /> : (editingBanner ? 'Αποθηκευση Αλλαγων' : 'Δημιουργια Διαφημισης')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
