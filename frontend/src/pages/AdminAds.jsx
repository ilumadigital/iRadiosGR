import {adminFetch as fetch} from '../utils/adminFetch';
import React, { useState, useEffect } from 'react';
import {useNavigate} from 'react-router-dom';
import '../styles/ad-campaign-console.css';
import CampaignDeliveryStatus from '../components/CampaignDeliveryStatus';
import ProtectedAudioPreview from '../components/ProtectedAudioPreview';
import { Megaphone, PlusCircle, Trash2, Edit, X, Clock, Search, SlidersHorizontal, Check, Loader2, Image as ImageIcon, Link as LinkIcon, Music } from 'lucide-react';

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

const INITIAL_AD_STATE = { 
  title: '', client: '', audioUrl: '', frequency: 'entry', logoUrl: '', linkUrl: '', dspPreset: 'OFF', status: 'active',
  targetCountry: 'All', targetRegion: 'All', targetLocations: ['All'] 
};

export default function AdminAds({ API_URL, refreshGlobalAds }) {
  const navigate=useNavigate();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError,setLoadError]=useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const stage=typeof window!=='undefined'&&window.location.hostname==='stage.iradios.gr';
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAd, setNewAd] = useState(INITIAL_AD_STATE);
  const [editingAd, setEditingAd] = useState(null);

  // 🟢 File Upload States
  const [audioFile, setAudioFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null); // 🟢 Νέο state για το Logo
  const [uploading, setUploading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('iluma_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const loadAds = async () => {
    setLoading(true);setLoadError('');
    try {
      const res = await fetch(API_URL+'/admin/ads?t='+Date.now(),{headers:getAuthHeaders()});
      if(!res.ok)throw new Error(res.status===403?'Δεν υπάρχει πρόσβαση στις διαφημίσεις.':'Αποτυχία φόρτωσης διαφημίσεων.');
      const data=await res.json();
      if(!Array.isArray(data))throw new Error('Μη αναμενόμενη απάντηση από τον server.');
      setAds(data);
    }catch(err){
      setLoadError(err.message||'Αποτυχία φόρτωσης διαφημίσεων.');
    }finally{setLoading(false);}
  };

  useEffect(() => { loadAds(); }, []);

  // 🟢 UPLOAD HELPER (Audio + Logo)
  const uploadFile = async (file, endpoint, fieldName) => {
    const fileData = new FormData();
    fileData.append(fieldName, file);
    const res = await fetch(`${API_URL}/uploads/${endpoint}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` },
      body: fileData
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Αποτυχία ανεβάσματος αρχείου.");
    return result.url;
  };

  // 🟢 CREATE
  const handleAddAd = async (e) => {
    e.preventDefault();
    if (!audioFile) return alert("Παρακαλώ επιλέξτε ένα αρχείο ήχου (.mp3)");
    
    setUploading(true);
    try {
      // 1. UPLOAD AUDIO
      const finalAudioUrl = await uploadFile(audioFile, 'upload-ad', 'audioFile');
      
      // 2. UPLOAD LOGO (Αν υπάρχει)
      let finalLogoUrl = newAd.logoUrl.trim() === '' ? '/favicon.png' : newAd.logoUrl;
      if (logoFile) {
        finalLogoUrl = await uploadFile(logoFile, 'upload-logo', 'logoFile');
      }

      // 3. CREATE AD
      const finalPayload = { ...newAd, audioUrl: finalAudioUrl, logoUrl: finalLogoUrl };
      const res = await fetch(`${API_URL}/admin/ads`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(finalPayload)
      });
      
      if (res.ok) {
        const addedAd = await res.json();
        setAds(prevAds => [...prevAds, addedAd]);
        setNewAd(INITIAL_AD_STATE);
        setAudioFile(null);
        setLogoFile(null);
        setShowAddModal(false);
        if (refreshGlobalAds) refreshGlobalAds();
      }
    } catch (err) { 
      alert(err.message);
    }
    setUploading(false);
  };

  // 🟢 UPDATE
  const handleUpdateAd = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let finalAudioUrl = editingAd.audioUrl;
      let finalLogoUrl = editingAd.logoUrl.trim() === '' ? '/favicon.png' : editingAd.logoUrl;

      // 1. UPLOAD AUDIO (Αν ανέβασε νέο)
      if (audioFile) {
        finalAudioUrl = await uploadFile(audioFile, 'upload-ad', 'audioFile');
      }

      // 2. UPLOAD LOGO (Αν ανέβασε νέο)
      if (logoFile) {
        finalLogoUrl = await uploadFile(logoFile, 'upload-logo', 'logoFile');
      }

      // 3. UPDATE AD
      const finalPayload = { ...editingAd, audioUrl: finalAudioUrl, logoUrl: finalLogoUrl };
      const res = await fetch(`${API_URL}/admin/ads/${editingAd._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(finalPayload)
      });
      
      if (res.ok) {
        const updatedAd = await res.json();
        setAds(prevAds => prevAds.map(ad => ad._id === updatedAd._id ? updatedAd : ad));
        setEditingAd(null);
        setAudioFile(null);
        setLogoFile(null);
        if (refreshGlobalAds) refreshGlobalAds();
      }
    } catch (err) { 
      alert(err.message);
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    if(window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε οριστικά αυτό το διαφημιστικό σποτ;')) {
      try {
        const res = await fetch(`${API_URL}/admin/ads/${id}`, { 
          method: 'DELETE',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          setAds(prevAds => prevAds.filter(ad => ad._id !== id));
          if (refreshGlobalAds) refreshGlobalAds(); 
        }
      } catch (err) { console.error(err); }
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Έλεγξες το ηχητικό; Το σποτ θα βγει LIVE και θα ξεκινήσει να μετράει ο χρόνος του!')) return;
    try {
      const res = await fetch(`${API_URL}/admin/ads/${id}/approve`, { 
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        alert("Επιτυχής Έγκριση! Το Audio Spot είναι πλέον LIVE.");
        loadAds();
        if (refreshGlobalAds) refreshGlobalAds();
      } else {
        alert("Σφάλμα κατά την έγκριση.");
      }
    } catch (err) {
      console.error(err);
      alert("Σφάλμα δικτύου.");
    }
  };

  const getFrequencyLabel = (freq) => {
    switch(freq) {
      case 'entry':case 'first_station':return 'Στην Είσοδο (1ος Σταθμός)';
      case 'every_2':case 'every_2_stations':return 'Κάθε 2 σταθμούς (παλαιό)';
      case 'every_4':case 'every_4_stations':return 'Κάθε 4 σταθμούς (παλαιό)';
      case 'every_5_stations': return 'Κάθε 5 σταθμούς (Zapping)';
      case 'every_10_stations': return 'Κάθε 10 σταθμούς (Zapping)';
      case 'every_15_stations': return 'Κάθε 15 σταθμούς (Zapping)';
      case 'every_20_stations': return 'Κάθε 20 σταθμούς (Zapping)';
      case 'every_30_stations': return 'Κάθε 30 σταθμούς (Zapping)';
      case 'every_1_hour': return 'Κάθε 1 ώρα (Clock \'15 / \'45)';
      case 'every_2_hours': return 'Κάθε 2 ώρες (Clock \'15 / \'45)';
      case 'every_6_hours': return 'Κάθε 6 ώρες (Clock \'15 / \'45)';
      case 'once_a_day': return '1 Φορά την ημέρα (Clock \'15 / \'45)';
      case 'twice_a_day': return '2 Φορές την ημέρα (Clock \'15 / \'45)';
      case 'four_times_a_day': return '4 Φορές την ημέρα (Clock \'15 / \'45)';
      case 'once_a_week': return '1 Φορά την εβδομάδα (Clock \'15 / \'45)';
      default: return 'Ανενεργό';
    }
  };

  const handleCloneStage=async ad=>{
    if(!window.confirm('Δημιουργία δοκιμαστικού αντιγράφου για έγκριση, χωρίς αλλαγή της αρχικής καμπάνιας;'))return;
    try{
      const r=await fetch(`${API_URL}/admin/ads/${ad._id}/clone-stage`,{method:'POST',headers:getAuthHeaders()});
      if(!r.ok)throw Error((await r.json().catch(()=>({}))).error||'Αποτυχία αντιγραφής.');
      await loadAds();
    }catch(error){alert(error.message);}
  };
  const filteredAds=ads.filter(ad=>
    (statusFilter==='all'||ad.status===statusFilter)&&
    [ad.title,ad.client].some(v=>String(v||'').toLocaleLowerCase('el-GR')
      .includes(searchTerm.toLocaleLowerCase('el-GR')))
  );

  // 🟢 renderForm με το isEditing flag
  const renderForm = (formData, setFormData, onSubmit, isEditing = false) => (
    <form onSubmit={onSubmit} className="space-y-8 mt-6">
      
      <div className="space-y-4">
        <h4 className="text-white font-black text-[11px] uppercase tracking-widest mb-4">Βασικα Στοιχεια Πελατη</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-1 block">Τιτλος Καμπανιας *</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-1 block">Επωνυμια Πελατη *</label>
            <input type="text" required value={formData.client} onChange={(e) => setFormData({...formData, client: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors" />
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-white/5"></div>

      <div className="space-y-4">
        <h4 className="text-[#ccff00] font-black text-[11px] tracking-widest mb-4 uppercase">Media & URL Προοριμού</h4>
        
        {/* MEDIA ROW (AUDIO & LOGO SIDE BY SIDE) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* AUDIO UPLOAD */}
          <div>
            <label className="text-[10px] text-[#ccff00] font-black uppercase tracking-widest ml-2 mb-1 flex items-center gap-1">
              <Music size={12} />
              {isEditing ? 'Αντικατασταση Ηχου (Αφηστε κενο για διατηρηση)' : 'Ανεβασμα Αρχειου Ηχου (.mp3/.wav) *'}
            </label>
            <div className="flex flex-col gap-2">
              {isEditing && formData.audioUrl && (
                <input type="text" readOnly value={formData.audioUrl} className="w-full bg-black/50 border border-white/5 h-10 rounded-xl px-4 text-xs text-zinc-500 outline-none" title="Τρέχον URL" />
              )}
              <input 
                type="file" 
                accept="audio/mp3, audio/wav, audio/mpeg"
                required={!isEditing} 
                onChange={e => setAudioFile(e.target.files[0])} 
                className="w-full bg-black border border-white/5 h-12 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#ccff00]/50 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-[#ccff00] file:text-black cursor-pointer hover:file:bg-[#b3e600]" 
              />
            </div>
          </div>

          {/* LOGO UPLOAD */}
          <div>
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-1 flex items-center gap-1">
              <ImageIcon size={12}/> {isEditing ? 'Αντικατασταση Λογοτυπου (Εικονα)' : 'Ανεβασμα Λογοτυπου (Εικονα)'}
            </label>
            <div className="flex flex-col gap-2">
              {isEditing && formData.logoUrl && (
                <input type="text" readOnly value={formData.logoUrl} className="w-full bg-black/50 border border-white/5 h-10 rounded-xl px-4 text-xs text-zinc-500 outline-none" title="Τρέχον URL" />
              )}
              <input 
                type="file" 
                accept="image/jpeg, image/png, image/webp"
                onChange={e => setLogoFile(e.target.files[0])} 
                className="w-full bg-black border border-white/5 h-12 rounded-xl px-3 py-2.5 text-sm text-white focus:border-purple-500 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-purple-500 file:text-white cursor-pointer hover:file:bg-purple-600" 
              />
            </div>
          </div>
        </div>

        {/* LOGIC ROW (LINK & FREQUENCY) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="text-[10px] text-[#ccff00] font-black uppercase tracking-widest ml-2 mb-1 flex items-center gap-1"><LinkIcon size={12}/> URL Ιστοσελιδας (Link)</label>
            <input type="url" placeholder="https://..." value={formData.linkUrl || ''} onChange={(e) => setFormData({...formData, linkUrl: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-colors" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-1 block">Συχνοτητα Προβολης *</label>
            <select required value={formData.frequency} onChange={(e) => setFormData({...formData, frequency: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-zinc-300 appearance-none transition-colors">
              <optgroup label="Δράση Χρήστη (Zapping)">
                <option value="entry">Στην Είσοδο (1ος Σταθμός)</option>
                <option value="every_5_stations">Κάθε 5 σταθμούς</option>
                <option value="every_10_stations">Κάθε 10 σταθμούς</option>
                <option value="every_15_stations">Κάθε 15 σταθμούς</option>
                <option value="every_20_stations">Κάθε 20 σταθμούς</option>
                <option value="every_30_stations">Κάθε 30 σταθμούς</option>
              </optgroup>
              <optgroup label="Χρονικά (Ρολόι '15 / '45 - Max 2 Spot)">
                <option value="every_1_hour">Κάθε 1 ώρα</option>
                <option value="every_2_hours">Κάθε 2 ώρες</option>
                <option value="every_6_hours">Κάθε 6 ώρες</option>
                <option value="once_a_day">1 Φορά την Ημέρα</option>
                <option value="twice_a_day">2 Φορές την Ημέρα</option>
                <option value="four_times_a_day">4 Φορές την Ημέρα</option>
                <option value="once_a_week">1 Φορά την Εβδομάδα</option>
              </optgroup>
            </select>
          </div>
        </div>

      </div>

      <div className="w-full h-px bg-white/5"></div>

      {/* GEO-TARGETING */}
      <div className="space-y-4">
        <h4 className="text-purple-400 font-black text-[11px] uppercase tracking-widest mb-4">📍 Στόχευση Περιοχής (Geo-Targeting)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      <div className="w-full h-px bg-white/5"></div>

      <div className="space-y-4">
        <h4 className="text-white font-black text-[11px] uppercase tracking-widest mb-4 flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-blue-400" /> Audio Processing (DSP) & Κατάσταση
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-1 block">Επιλογη Επεξεργασιας Ηχου</label>
            <select value={formData.dspPreset || 'OFF'} onChange={(e) => setFormData({...formData, dspPreset: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-blue-400 font-bold appearance-none transition-colors">
              <option value="OFF">Bypass (Χωρίς Επεξεργασία)</option>
              <option value="NORMALIZE">Normalize (Ομαλή Στάθμιση Έντασης)</option>
            </select>
          </div>
          
          <div>
            <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest ml-2 mb-1 block">Κατάσταση Διαφήμισης</label>
            <select 
              value={formData.status} 
              onChange={(e) => setFormData({...formData, status: e.target.value})} 
              className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm focus:border-[#ccff00]/50 outline-none text-white appearance-none transition-colors"
            >
              <option value="active">🟢 Ενεργό (Live)</option>
              <option value="pending">🟠 Εκκρεμεί (Pending)</option>
              <option value="expired">🔴 Ανενεργό (Expired)</option>
              <option value="rejected">🔴 Απορρίφθηκε</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-white/10">
        <button type="button" onClick={() => { setShowAddModal(false); setEditingAd(null); setAudioFile(null); setLogoFile(null); }} className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">Ακυρωση</button>
        <button type="submit" disabled={uploading} className="px-8 py-3 bg-[#ccff00] text-black text-xs font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-transform shadow-[0_4px_20px_rgba(204,255,0,0.2)] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2">
          {uploading && <Loader2 className="animate-spin" size={16} />}
          {uploading ? 'Αποθηκευση...' : 'Αποθηκευση'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="admin-legacy-page ad-console space-y-6">
      <div className="ad-console-hero flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Megaphone className="text-[#ccff00]" size={28} />
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Ηχητικές διαφημίσεις</h2>
          </div>
          <p className="text-zinc-500 text-sm font-medium">Διαχειριστείτε τις Audio Pre-Roll & Mid-Roll καμπάνιες του δικτύου.</p>
        </div>
        <button onClick={() => navigate("/backoffice/admin/ads/new")} className="bg-[#ccff00] text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-[0_10px_30px_rgba(204,255,0,0.2)]">
          Νέο ηχητικό σποτ
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <div className="ad-console-stat">
          <div className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Σύνολο σποτ</div>
          <div className="text-4xl font-black text-white">{ads.length}</div>
        </div>
        <div className="ad-console-stat">
          <div className="text-[#ccff00] text-[10px] font-black uppercase tracking-widest mb-2">Pre-roll · στην είσοδο</div>
          <div className="text-4xl font-black text-[#ccff00]">{ads.filter(a => ['entry','first_station'].includes(a.frequency)).length}</div>
        </div>
        <div className="ad-console-stat">
          <div className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-2">Mid-roll · κατά την ακρόαση</div>
          <div className="text-4xl font-black text-white">{ads.filter(a => !['entry','first_station'].includes(a.frequency)).length}</div>
        </div>
      </div>

      <div className="ad-console-toolbar mb-4">
        <span className="text-xs font-black text-zinc-300">Κατάσταση</span>
        <select aria-label="Φίλτρο κατάστασης" className="ad-console-filter" value={statusFilter}
          onChange={event=>setStatusFilter(event.target.value)}>
          <option value="all">Όλες ({ads.length})</option>
          <option value="active">Ενεργές ({ads.filter(a=>a.status==='active').length})</option>
          <option value="pending">Για έγκριση ({ads.filter(a=>a.status==='pending').length})</option>
          <option value="expired">Ληγμένες ({ads.filter(a=>a.status==='expired').length})</option>
          <option value="rejected">Απορριφθείσες</option>
        </select>
        {stage&&<span className="ad-console-label ad-console-demo">STAGING · Τα εισαγμένα spots δεν παίζουν μέχρι να αντιγραφούν</span>}
      </div>
      <div className="relative w-full max-w-lg mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input type="text" placeholder="Αναζήτηση..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/50 border border-white/10 h-12 rounded-2xl pl-12 pr-10 text-sm focus:border-[#ccff00]/50 outline-none text-white transition-all placeholder:text-zinc-600" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-semibold text-zinc-400">{filteredAds.length} από {ads.length} σποτ</span>
        <div className="flex items-center gap-2">
          {searchTerm&&<button type="button" onClick={()=>setSearchTerm('')}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300">
            Καθαρισμός</button>}
          <button type="button" onClick={loadAds} disabled={loading} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-[#caff00]">
            Ανανέωση</button>
        </div>
      </div>
      {loadError&&<p role="alert" className="mb-5 rounded-2xl border border-rose-400/25 bg-rose-400/[.06] p-4 text-xs text-rose-200">{loadError}</p>}
      {loading&&<p role="status" className="mb-5 text-sm text-[#caff00]">Φόρτωση διαφημίσεων…</p>}
      {!loading&&!filteredAds.length&&<div className="mb-5 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-400">
        Δεν βρέθηκαν σποτ. Μπορείς να δημιουργήσεις νέο ή να καθαρίσεις την αναζήτηση.</div>}
      <div className="space-y-4">
        {filteredAds.map(ad => (
          <div key={ad._id} className={`ad-console-card border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all ${ad.status === 'pending' ? 'bg-zinc-900 border-orange-500/30' : 'bg-zinc-900/30 border-white/5 hover:bg-zinc-900/60'}`}>
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-zinc-800 shadow-xl shrink-0 flex items-center justify-center border border-white/5">
                {ad.logoUrl ? <img src={ad.logoUrl} alt={ad.client} className="w-full h-full object-cover bg-white" /> : <span className="text-xl font-black text-zinc-500 uppercase">{ad.client ? ad.client.charAt(0) : 'A'}</span>}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-white text-base sm:text-lg flex items-center gap-2 truncate">
                  {ad.title || 'Ανώνυμη Καμπάνια'}
                   <span className="ad-console-label" data-state={ad.status}>{ad.status==='active'?'Ενεργή εγγραφή':ad.status==='pending'?'Για έγκριση':ad.status==='expired'?'Έληξε':'Ανενεργό'}</span>
                   {stage&&!ad.isStageCreative&&<span className="ad-console-label ad-console-demo">Εισαγμένο · Μη δημοσιευμένο</span>}
                  {/* 🟢 Ένδειξη Pending */}
                  {ad.status === 'pending' && <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full uppercase tracking-widest ml-2 animate-pulse">PENDING</span>}
                  {ad.status === 'expired' && <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full uppercase tracking-widest ml-2">ΛΗΓΜΕΝΟ</span>}
                </h4>
                <div className="mt-2"><CampaignDeliveryStatus campaign={ad} kind="audio" stage={stage}/></div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] text-[#ccff00] font-black uppercase tracking-wider">{ad.client || 'Unknown'}</span>
                  <span className="w-1 h-1 bg-zinc-700 rounded-full hidden sm:block"></span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500 font-black uppercase tracking-wider truncate"><Clock size={10} /> {getFrequencyLabel(ad.frequency)}</span>
                  {ad.dspPreset && ad.dspPreset !== 'OFF' && (
                    <><span className="w-1 h-1 bg-zinc-700 rounded-full hidden sm:block"></span><span className="flex items-center gap-1 text-[10px] text-blue-400 font-black uppercase tracking-wider truncate"><SlidersHorizontal size={10} /> DSP: {ad.dspPreset}</span></>
                  )}
                  {/* Εμφάνιση Τοποθεσίας αν δεν είναι All */}
                  {ad.targetLocations && ad.targetLocations[0] !== 'All' && (
                    <><span className="w-1 h-1 bg-zinc-700 rounded-full hidden sm:block"></span><span className="flex items-center gap-1 text-[10px] text-purple-400 font-black uppercase tracking-wider truncate">📍 {ad.targetLocations[0]}</span></>
                  )}
                  {ad.audioUrl&&<div className="ad-console-preview mt-3">
                    <span className="mb-2 block text-[10px] font-black uppercase text-zinc-400">Preview · χωρίς καταμέτρηση</span>
                    <ProtectedAudioPreview adId={ad._id} scope="admin" sourceUrl={ad.audioUrl}/>
                  </div>}
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Plays: {ad.plays||0} · Clicks: {ad.clicks||0} · {ad.expiresAt?`Λήξη ${new Date(ad.expiresAt).toLocaleDateString('el-GR')}`:'Χωρίς λήξη'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* 🟢 ACTION BUTTONS */}
            <div className="flex items-center gap-3">
              {ad.status === 'pending' && (!stage||ad.isStageCreative) && (
                <button onClick={() => handleApprove(ad._id)} className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-all animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.2)]" title="Έγκριση">
                  <Check size={16} strokeWidth={3} />
                </button>
              )}
              {stage&&!ad.isStageCreative&&
                <button type="button" onClick={()=>handleCloneStage(ad)} className="ad-console-filter !text-purple-200" title="Δημιουργία δοκιμαστικού αντιγράφου">
                  Αντίγραφο
                </button>}
              <button onClick={() => navigate("/backoffice/admin/ads/"+ad._id+"/edit")} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-300 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"><Edit size={16} /></button>
              <button onClick={() => handleDelete(ad._id)} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>


    </div>
  );
}
