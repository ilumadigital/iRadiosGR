import {adminFetch as fetch} from '../utils/adminFetch';
import React, { useState, useEffect } from 'react';
import { Target, ShieldAlert, Zap, Trash2, Radio, Edit, X, Image as ImageIcon, SlidersHorizontal, MapPin } from 'lucide-react';

// 🗺️ ΔΥΝΑΜΙΚΟΣ ΧΑΡΤΗΣ (Για το Edit Modal)
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

export default function AdminAdControl({ API_URL }) {
  const [stations, setStations] = useState([]);
  const [localAds, setLocalAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAd, setEditingAd] = useState(null); 

  const [audioFile, setAudioFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const stRes = await fetch(`${API_URL}/stations/all`);
      const stData = await stRes.json();
      setStations(stData);

      const adRes = await fetch(`${API_URL}/admin/local-ads`);
      const adData = await adRes.json();
      setLocalAds(adData);
    } catch (err) {
      console.error("Σφάλμα φόρτωσης:", err);
    }
    setLoading(false);
  };

  const handleDeleteAd = async (adId) => {
    if(!window.confirm('Είσαι σίγουρος ότι θέλεις να διαγράψεις αυτή τη διαφήμιση Broadcaster;')) return;
    try {
      await fetch(`${API_URL}/admin/ads/${adId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleOverrideNetworkAds = async (stationId, currentStatus) => {
    try {
      await fetch(`${API_URL}/broadcaster/stations/${stationId}/network-ads`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disableNetworkAds: !currentStatus })
      });
      fetchData();
    } catch (err) { console.error(err); }
  };

  // 🟢 Συνάρτηση Ενημέρωσης του Σποτ από τον Admin
  const handleUpdateAd = async (e) => {
    e.preventDefault();
    setUploading(true);

    try {
      let finalAudioUrl = editingAd.audioUrl;

      // 🟢 ΑΝ Ο ADMIN ΑΝΕΒΑΣΕ ΝΕΟ ΑΡΧΕΙΟ, ΚΑΝΟΥΜΕ UPLOAD
      if (audioFile) {
        const fileData = new FormData();
        fileData.append('audioFile', audioFile);

        const uploadRes = await fetch(`${API_URL}/uploads/upload-ad`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` },
          body: fileData
        });

        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadResult.error);
        finalAudioUrl = uploadResult.url;
      }

      const finalLogo = editingAd.logoUrl.trim() === '' ? '/favicon.png' : editingAd.logoUrl;

      // ΣΩΖΟΥΜΕ ΤΙΣ ΑΛΛΑΓΕΣ
      const res = await fetch(`${API_URL}/admin/ads/${editingAd._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` 
        },
        body: JSON.stringify({ ...editingAd, audioUrl: finalAudioUrl, logoUrl: finalLogo })
      });
      
      if (res.ok) {
        setEditingAd(null); 
        setAudioFile(null); // Καθαρισμός
        fetchData(); 
      }
    } catch (err) { 
      console.error(err); 
      alert("Σφάλμα κατά την επεξεργασία: " + err.message);
    }
    setUploading(false);
  };

  if (loading) return <div className="p-12 text-[#ccff00] uppercase font-black tracking-widest text-center animate-pulse">Φόρτωση...</div>;

  const adFreeStations = stations.filter(s => s.disableNetworkAds);

  return (
    <div className="p-6 lg:p-12 max-w-6xl mx-auto animate-fade-in pb-40">
      
      <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-6">
        <Target className="text-[#ccff00]" size={36} />
        <div>
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">Ελεγχος Local Ads</h1>
          <p className="text-zinc-500 font-bold text-sm tracking-widest uppercase mt-1">Παρακολουθηση Broadcaster Monetization</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ΣΤΑΘΜΟΙ ΜΕ ΚΛΕΙΣΤΑ NETWORK ADS */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 shadow-2xl">
          <h2 className="text-xl font-black text-white mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><ShieldAlert className="text-red-500" size={20} /> Κλειστά Network Ads</span>
            <span className="text-xs bg-red-500/10 text-red-500 px-3 py-1 rounded-full">{adFreeStations.length} Σταθμοί</span>
          </h2>
          <p className="text-xs text-zinc-500 mb-6">Σταθμοί που έχουν επιλέξει να μην παίζουν οι δικές σου κεντρικές διαφημίσεις.</p>
          
          <div className="space-y-3">
            {adFreeStations.map(station => (
              <div key={station._id} className="flex items-center justify-between bg-black p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <img src={station.logo} className="w-10 h-10 rounded-lg object-cover" alt="" />
                  <div>
                    <div className="font-bold text-white text-sm">{station.name}</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleOverrideNetworkAds(station._id, station.disableNetworkAds)}
                  className="text-[10px] font-black px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  ΑΚΥΡΩΣΗ & ΕΝΕΡΓΟΠΟΙΗΣΗ
                </button>
              </div>
            ))}
            {adFreeStations.length === 0 && (
              <div className="text-center p-8 border border-dashed border-white/5 rounded-2xl text-zinc-600 text-xs font-bold uppercase tracking-widest">
                Ολοι οι σταθμοι παιζουν Network Ads
              </div>
            )}
          </div>
        </div>

        {/* LOCAL ADS BROADCASTERS */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 shadow-2xl">
           <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
            <Zap className="text-[#ccff00]" size={20} /> Σποτ Broadcasters
          </h2>
          <p className="text-xs text-zinc-500 mb-6">Όλα τα τοπικά ηχητικά που έχουν ανεβάσει οι Premium Broadcasters.</p>

          <div className="space-y-3">
            {localAds.map(ad => (
              <div key={ad._id} className="flex flex-col bg-black p-4 rounded-xl border border-white/5 gap-3 group hover:border-white/10 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-bold text-white mb-0.5">{ad.title}</div>
                    <div className="text-[10px] text-[#ccff00] uppercase tracking-widest mb-1">{ad.client}</div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Radio size={10} /> Σταθμός: {ad.stationId?.name || 'Άγνωστος'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingAd(ad)} 
                      className="text-zinc-400 hover:text-white bg-zinc-900 p-2 rounded-lg transition-colors"
                      title="Επεξεργασία"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteAd(ad._id)} 
                      className="text-red-500/70 hover:text-red-500 transition-colors p-2 bg-red-500/5 rounded-lg"
                      title="Διαγραφή"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="w-full bg-zinc-900/50 p-2 rounded-lg">
                  <audio src={ad.audioUrl} controls className="w-full h-8 custom-audio-player" />
                </div>
              </div>
            ))}
            {localAds.length === 0 && (
              <div className="text-center p-8 border border-dashed border-white/5 rounded-2xl text-zinc-600 text-xs font-bold uppercase tracking-widest">
                Δεν υπαρχουν Local Ads
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 🟢 MODAL ΕΠΕΞΕΡΓΑΣΙΑΣ (Ακριβώς όπως στο AdControl) */}
      {editingAd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f0f0f] border border-white/10 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setEditingAd(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-zinc-900 p-1.5 rounded-full">
              <X size={20} />
            </button>
            
            <h3 className="text-2xl font-black text-white italic tracking-tighter mb-6 flex items-center gap-2">
              <Edit className="text-[#ccff00]" size={24} /> Edit Admin Ad
            </h3>

            <form onSubmit={handleUpdateAd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Τιτλος</label>
                  <input required type="text" value={editingAd.title} onChange={e => setEditingAd({...editingAd, title: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Πελατης / Χορηγος</label>
                  <input required type="text" value={editingAd.client} onChange={e => setEditingAd({...editingAd, client: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Αντικατάσταση Ήχου (Αφήστε κενό για διατήρηση του παλιού)</label>
                  <div className="flex flex-col gap-2">
                    {/* Δείχνουμε το τρέχον URL */}
                    <input type="text" readOnly value={editingAd.audioUrl} className="w-full bg-black/50 border border-white/5 h-10 rounded-xl px-4 text-xs text-zinc-500 outline-none" />
                    
                    {/* Το νέο File Input */}
                    <input 
                      type="file" 
                      accept="audio/mp3, audio/wav, audio/mpeg"
                      onChange={e => setAudioFile(e.target.files[0])} 
                      className="w-full bg-black border border-white/5 h-12 rounded-xl px-3 py-3 text-sm text-white focus:border-[#ccff00]/50 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-[#ccff00] file:text-black cursor-pointer" 
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 flex items-center gap-1"><ImageIcon size={12}/> Logo URL (Προαιρετικο)</label>
                  <input type="url" value={editingAd.logoUrl} onChange={e => setEditingAd({...editingAd, logoUrl: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Σταθμος</label>
                  <select value={editingAd.stationId?._id || editingAd.stationId} onChange={e => setEditingAd({...editingAd, stationId: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none cursor-pointer">
                    {stations.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Συχνοτητα</label>
                  <select value={editingAd.frequency} onChange={e => setEditingAd({...editingAd, frequency: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none cursor-pointer">
                    <option value="first_station">Στο Play (Pre-roll)</option>
                    <option value="every_2">Κάθε 2 Αλλαγές</option>
                    <option value="every_4">Κάθε 4 Αλλαγές</option>
                    <option value="every_6">Κάθε 6 Αλλαγές</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 flex items-center gap-1"><SlidersHorizontal size={12}/> DSP Επεξεργασια (Mastering)</label>
                  <select value={editingAd.dspPreset || 'OFF'} onChange={e => setEditingAd({...editingAd, dspPreset: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-[#ccff00] focus:border-[#ccff00]/50 outline-none cursor-pointer">
                    <option value="OFF">Χωρίς Επεξεργασία (Original)</option>
                    <option value="NORMALIZE">Normalize (Σταθερή Ένταση)</option>
                  </select>
                </div>

                {/* GEO TARGETING BLOCK */}
                <div className="col-span-2 bg-zinc-900/50 p-4 rounded-2xl border border-white/5 mt-2">
                  <h4 className="text-[#ccff00] font-black text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MapPin size={12}/> Στόχευση Περιοχής
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Χώρα</label>
                      <select 
                        value={editingAd.targetCountry || 'All'} 
                        onChange={e => {
                          const val = e.target.value;
                          setEditingAd({ ...editingAd, targetCountry: val, targetRegion: 'All', targetLocations: [val === 'All' ? 'All' : val] });
                        }} 
                        className="w-full bg-black border border-white/5 h-10 rounded-lg px-3 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer text-xs font-bold transition-colors"
                      >
                        <option value="All">Όλες οι Χώρες (Global)</option>
                        {Object.keys(LOCATION_DATA).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Νομός / Περιφέρεια</label>
                      <select 
                        value={editingAd.targetRegion || 'All'} 
                        onChange={e => {
                          const val = e.target.value;
                          setEditingAd({ ...editingAd, targetRegion: val, targetLocations: [val === 'All' ? editingAd.targetCountry : val] });
                        }} 
                        disabled={!editingAd.targetCountry || editingAd.targetCountry === 'All'}
                        className="w-full bg-black border border-white/5 h-10 rounded-lg px-3 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold transition-colors"
                      >
                        <option value="All">Όλοι οι Νομοί</option>
                        {editingAd.targetCountry && editingAd.targetCountry !== 'All' && 
                          Object.keys(LOCATION_DATA[editingAd.targetCountry]).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Πόλη</label>
                      <select 
                        value={(editingAd.targetLocations && editingAd.targetLocations[0]) || 'All'} 
                        onChange={e => setEditingAd({...editingAd, targetLocations: [e.target.value]})} 
                        disabled={!editingAd.targetRegion || editingAd.targetRegion === 'All'}
                        className="w-full bg-black border border-white/5 h-10 rounded-lg px-3 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold transition-colors"
                      >
                        <option value={editingAd.targetRegion && editingAd.targetRegion !== 'All' ? editingAd.targetRegion : 'All'}>Όλες οι Πόλεις</option>
                        {editingAd.targetCountry && editingAd.targetCountry !== 'All' && editingAd.targetRegion && editingAd.targetRegion !== 'All' && 
                          LOCATION_DATA[editingAd.targetCountry]?.[editingAd.targetRegion]?.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

              </div>
              <div className="flex gap-3 pt-4 border-t border-white/10 mt-6">
                <button type="button" onClick={() => setEditingAd(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">
                  Ακυρωση
                </button>
                <button type="submit" className="flex-1 bg-[#ccff00] hover:bg-[#b3e600] text-black h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg">
                  Αποθηκευση
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
