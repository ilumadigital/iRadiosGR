import React, { useState, useEffect } from 'react';
import { Megaphone, ShieldAlert, Plus, Trash2, Crown, Zap, Edit, X, Image as ImageIcon, SlidersHorizontal, MapPin, Link as LinkIcon } from 'lucide-react';

// 🗺️ ΔΥΝΑΜΙΚΟΣ ΧΑΡΤΗΣ
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

export default function AdControl({ API_URL, currentUser }) {
  const [stations, setStations] = useState([]);
  const [stationEntitlements,setStationEntitlements]=useState({});
  const [accessError,setAccessError]=useState('');
  const [myAds, setMyAds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [audioFile, setAudioFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  // 🟢 ΔΙΟΡΘΩΣΗ: Αλλαγή από targetUrl σε linkUrl
  const [newAd, setNewAd] = useState({
    title: '', client: '', audioUrl: '', logoUrl: '', linkUrl: '', frequency: 'entry', stationId: '', dspPreset: 'OFF',
    targetCountry: 'All', targetRegion: 'All', targetLocations: ['All']
  });

  const [editingAd, setEditingAd] = useState(null);

  const mayUseAdControl=stationId=>currentUser?.role==='admin' ||
    (stationEntitlements[stationId]||[]).includes('broadcaster.ad_control');
  const isPremium=currentUser?.role==='admin'||stations.some(s=>mayUseAdControl(s._id));

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchData=async()=>{
    if(!currentUser)return;
    setLoading(true);setAccessError('');
    try{
      const id=currentUser._id||currentUser.id;
      const headers={Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`};
      const urls=[`${API_URL}/broadcaster/${id}/stations`,
        `${API_URL}/broadcaster/${id}/ads`];
      if(currentUser.role!=='admin')urls.push(`${API_URL}/billing/me/station-entitlements`);
      const responses=await Promise.all(urls.map(url=>fetch(url,{headers,cache:'no-store'})));
      if(responses.some(r=>!r.ok))throw Error('Δεν φορτώθηκαν τα δικαιώματα Ad Control.');
      const [stData,adData]=await Promise.all([responses[0].json(),responses[1].json()]);
      const rights=currentUser.role==='admin'?{byStation:{}}:await responses[2].json();
      if(!Array.isArray(stData)||!Array.isArray(adData))throw Error('Μη έγκυρη απάντηση server.');
      const byStation=rights.byStation||{};
      setStations(stData);setMyAds(adData);setStationEntitlements(byStation);
      const firstEligible=stData.find(s=>currentUser.role==='admin'||
        (byStation[s._id]||[]).includes('broadcaster.ad_control'));
      setNewAd(prev=>({...prev,stationId:firstEligible?._id||''}));
    }catch(error){
      console.error('[AD CONTROL] Load failed',error);
      setStations([]);setMyAds([]);setStationEntitlements({});
      setAccessError(error.message);
    }finally{setLoading(false);}
  };

  const toggleNetworkAds=async(stationId,currentStatus)=>{
    if(!mayUseAdControl(stationId))
      return alert('Το Ad Control δεν είναι ενεργό για αυτόν τον σταθμό.');
    try{
      const res=await fetch(`${API_URL}/broadcaster/stations/${stationId}/network-ads`,{
        method:'PUT',headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`
        },body:JSON.stringify({disableNetworkAds:!currentStatus})
      });
      if(!res.ok)throw Error((await res.json().catch(()=>({}))).error||'Η αλλαγή απέτυχε.');
      fetchData();
    }catch(error){alert(error.message);}
  };

  const handleCreateAd = async (e) => {
    e.preventDefault();
    if (!audioFile) {
      alert("Παρακαλώ επιλέξτε ένα αρχείο ήχου (.mp3)");
      return;
    }
    if(!newAd.stationId||!mayUseAdControl(newAd.stationId)){
      alert('Επίλεξε σταθμό με ενεργό Ad Control.');
      return;
    }
    
    setUploading(true);
    
    try {
      // 1. UPLOAD ΤΟΥ ΑΡΧΕΙΟΥ ΣΤΟΝ ΦΑΚΕΛΟ ΤΟΥ NGINX
      const fileData = new FormData();
      fileData.append('audioFile', audioFile);

      const uploadRes = await fetch(`${API_URL}/uploads/upload-ad`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('iluma_token')||''}`,
          'X-iRadios-Station':newAd.stationId
        },
        body: fileData
      });

      const uploadResult = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadResult.error || "Αποτυχία ανεβάσματος αρχείου.");
      }

      const generatedAudioUrl = uploadResult.url; 
      const finalLogo = newAd.logoUrl.trim() === '' ? '/icon-tr.png' : newAd.logoUrl;

      // 2. ΑΠΟΘΗΚΕΥΣΗ ΤΗΣ ΔΙΑΦΗΜΙΣΗΣ ΣΤΗ ΒΑΣΗ
      const res = await fetch(`${API_URL}/broadcaster/ads`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` 
        },
        body: JSON.stringify({
          ...newAd,
          audioUrl: generatedAudioUrl, 
          logoUrl: finalLogo,
          broadcasterId: currentUser._id || currentUser.id
        })
      });
      
      if (res.ok) {
        setNewAd({ title: '', client: '', audioUrl: '', logoUrl: '', linkUrl: '', frequency: 'entry', stationId: stations[0]?._id, dspPreset: 'OFF', targetCountry: 'All', targetRegion: 'All', targetLocations: ['All'] });
        setAudioFile(null); 
        fetchData(); 
      }
    } catch (err) { 
      console.error(err); 
      alert(err.message);
    }
    
    setUploading(false);
  };

  const handleUpdateAd = async (e) => {
    e.preventDefault();
    if(!editingAd?.stationId||!mayUseAdControl(editingAd.stationId)){
      alert('Το Ad Control δεν είναι ενεργό για αυτόν τον σταθμό.');return;
    }
    try {
      const finalLogo = editingAd.logoUrl.trim() === '' ? '/icon-tr.png' : editingAd.logoUrl;

      const res = await fetch(`${API_URL}/broadcaster/ads/${editingAd._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` 
        },
        body: JSON.stringify({ ...editingAd, logoUrl: finalLogo })
      });
      
      if (res.ok) {
        setEditingAd(null); 
        fetchData(); 
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteAd = async (adId) => {
    if(!window.confirm('Διαγραφή αυτού του σποτ;')) return;
    try {
      const res=await fetch(`${API_URL}/broadcaster/ads/${adId}`, {
        method:'DELETE',headers:{Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`}
      });
      if(!res.ok)throw Error((await res.json().catch(()=>({}))).error||'Η διαγραφή απέτυχε.');
      fetchData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="p-12 text-white animate-pulse">Φόρτωση...</div>;

  const entitledStations=stations.filter(s=>mayUseAdControl(s._id));

  return (
    <div className="p-6 lg:p-12 max-w-6xl mx-auto animate-fade-in pb-40">
      
      <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-6">
        <Megaphone className="text-[#ccff00]" size={36} />
        <div>
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">Ad Control</h1>
          <p className="text-zinc-500 font-bold text-sm tracking-widest uppercase mt-1">Διαχειριση Διαφημισεων & Monetization</p>
          {accessError&&<p role="alert" className="text-sm text-red-300 mt-2">{accessError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* NETWORK ADS CONTROL */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 shadow-2xl h-fit">
          <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
            <ShieldAlert className="text-[#ccff00]" size={20} /> Network Ads (Pre-Rolls)
          </h2>
          <p className="text-xs text-zinc-500 mb-6">Απενεργοποίησε τις κεντρικές διαφημίσεις του δικτύου iRadios για τους σταθμούς σου. (Απαιτείται Premium)</p>
          
          <div className="space-y-4">
            {stations.map(station => (
              <div key={station._id} className="flex items-center justify-between bg-black p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <img src={station.logo} className="w-10 h-10 rounded-lg object-cover" alt="" />
                  <span className="font-bold text-white text-sm">{station.name}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  {!mayUseAdControl(station._id) && <Crown size={16} className="text-zinc-600" />}
                  <button 
                    onClick={() => toggleNetworkAds(station._id, station.disableNetworkAds)}
                    disabled={!mayUseAdControl(station._id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!mayUseAdControl(station._id) ? 'opacity-50 cursor-not-allowed' : ''} ${station.disableNetworkAds ? 'bg-red-500' : 'bg-[#ccff00]'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-black transition duration-300 ${station.disableNetworkAds ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className={`text-[10px] font-black uppercase w-16 text-center ${station.disableNetworkAds ? 'text-red-500' : 'text-[#ccff00]'}`}>
                    {station.disableNetworkAds ? 'ΚΛΕΙΣΤΑ' : 'ΕΝΕΡΓΑ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LOCAL ADS UPLOAD */}
        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 shadow-2xl">
           <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
            <Zap className="text-[#ccff00]" size={20} /> Τα Δικά μου Σποτάκια
          </h2>
          <p className="text-xs text-zinc-500 mb-6">Ανέβασε τα δικά σου ηχητικά σποτ που θα παίζουν αποκλειστικά στους δικούς σου ακροατές.</p>

          <form onSubmit={handleCreateAd} className="space-y-4 mb-8 bg-black p-5 rounded-2xl border border-white/5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Τιτλος</label>
                <input required type="text" value={newAd.title} onChange={e => setNewAd({...newAd, title: e.target.value})} className="w-full bg-zinc-900 border border-white/5 h-10 rounded-xl px-3 text-sm text-white focus:border-[#ccff00]/50 outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Πελατης / Χορηγος</label>
                <input required type="text" value={newAd.client} onChange={e => setNewAd({...newAd, client: e.target.value})} className="w-full bg-zinc-900 border border-white/5 h-10 rounded-xl px-3 text-sm text-white focus:border-[#ccff00]/50 outline-none transition-colors" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Ανεβασμα Αρχειου (mp3/wav) *</label>
                <input 
                  type="file" 
                  accept="audio/mp3, audio/wav, audio/mpeg"
                  required 
                  onChange={e => setAudioFile(e.target.files[0])} 
                  className="w-full bg-zinc-900 border border-white/5 h-12 rounded-xl px-3 py-2.5 text-sm text-white focus:border-[#ccff00]/50 outline-none transition-colors file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-[#ccff00] file:text-black hover:file:bg-[#b3e600] cursor-pointer" 
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 flex items-center gap-1"><ImageIcon size={12}/> Logo URL (Προαιρετικο)</label>
                <input type="url" placeholder="Άδειο = Default" value={newAd.logoUrl} onChange={e => setNewAd({...newAd, logoUrl: e.target.value})} className="w-full bg-zinc-900 border border-white/5 h-10 rounded-xl px-3 text-sm text-white focus:border-[#ccff00]/50 outline-none transition-colors placeholder:text-zinc-600" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 flex items-center gap-1"><LinkIcon size={12}/> URL Προορισμου *</label>
                <input required type="url" placeholder="https://..." value={newAd.linkUrl} onChange={e => setNewAd({...newAd, linkUrl: e.target.value})} className="w-full bg-zinc-900 border border-white/5 h-10 rounded-xl px-3 text-sm text-white focus:border-[#ccff00]/50 outline-none transition-colors placeholder:text-zinc-600" />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Σταθμος</label>
                <select value={newAd.stationId} onChange={e => setNewAd({...newAd, stationId: e.target.value})} className="w-full bg-zinc-900 border border-white/5 h-10 rounded-xl px-3 text-sm text-white focus:border-[#ccff00]/50 outline-none cursor-pointer">
                  <option value="">Επιλογή εγκεκριμένου σταθμού</option>
                  {entitledStations.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Συχνοτητα</label>
                <select value={newAd.frequency} onChange={e => setNewAd({...newAd, frequency: e.target.value})} className="w-full bg-zinc-900 border border-white/5 h-10 rounded-xl px-3 text-sm text-white focus:border-[#ccff00]/50 outline-none cursor-pointer">
                  <option value="entry">Στο Play (Pre-roll)</option>
                  <option value="every_5_stations">Κάθε 5 Αλλαγές</option>
                  <option value="every_10_stations">Κάθε 10 Αλλαγές</option>
                  <option value="every_15_stations">Κάθε 15 Αλλαγές</option>
                </select>
              </div>
              
              <div className="col-span-2">
                <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 flex items-center gap-1"><SlidersHorizontal size={12}/> DSP Επεξεργασια (Mastering)</label>
                <select value={newAd.dspPreset} onChange={e => setNewAd({...newAd, dspPreset: e.target.value})} className="w-full bg-zinc-900 border border-white/5 h-10 rounded-xl px-3 text-sm text-[#ccff00] focus:border-[#ccff00]/50 outline-none cursor-pointer">
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
                      value={newAd.targetCountry || 'All'} 
                      onChange={e => {
                        const val = e.target.value;
                        setNewAd({ ...newAd, targetCountry: val, targetRegion: 'All', targetLocations: [val === 'All' ? 'All' : val] });
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
                      value={newAd.targetRegion || 'All'} 
                      onChange={e => {
                        const val = e.target.value;
                        setNewAd({ ...newAd, targetRegion: val, targetLocations: [val === 'All' ? newAd.targetCountry : val] });
                      }} 
                      disabled={!newAd.targetCountry || newAd.targetCountry === 'All'}
                      className="w-full bg-black border border-white/5 h-10 rounded-lg px-3 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold transition-colors"
                    >
                      <option value="All">Όλοι οι Νομοί</option>
                      {newAd.targetCountry && newAd.targetCountry !== 'All' && 
                        Object.keys(LOCATION_DATA[newAd.targetCountry]).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Πόλη</label>
                    <select 
                      value={(newAd.targetLocations && newAd.targetLocations[0]) || 'All'} 
                      onChange={e => setNewAd({...newAd, targetLocations: [e.target.value]})} 
                      disabled={!newAd.targetRegion || newAd.targetRegion === 'All'}
                      className="w-full bg-black border border-white/5 h-10 rounded-lg px-3 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold transition-colors"
                    >
                      <option value={newAd.targetRegion && newAd.targetRegion !== 'All' ? newAd.targetRegion : 'All'}>Όλες οι Πόλεις</option>
                      {newAd.targetCountry && newAd.targetCountry !== 'All' && newAd.targetRegion && newAd.targetRegion !== 'All' && 
                        LOCATION_DATA[newAd.targetCountry]?.[newAd.targetRegion]?.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

            </div>
            <button disabled={uploading} type="submit" className="w-full mt-4 bg-[#ccff00] disabled:bg-[#ccff00]/50 text-black h-12 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg">
              <Plus size={16} /> {uploading ? 'Ανεβασμα & Αποθηκευση...' : 'Προσθηκη Σποτ'}
            </button>
          </form>

          {/* Λίστα με τα σποτ του */}
          <div className="space-y-3">
            <h3 className="text-white font-bold text-sm mb-3">Ενεργά Σποτ ({myAds.length})</h3>
            {myAds.map(ad => (
              <div key={ad._id} className="flex justify-between items-center bg-black p-3 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <img src={ad.logoUrl || '/icon-tr.png'} className="w-10 h-10 rounded-lg object-cover bg-zinc-900" alt="" />
                  <div>
                    <div className="text-sm font-bold text-white">{ad.title}</div>
                    <div className="text-[10px] text-[#ccff00] uppercase tracking-widest">{ad.client}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingAd(ad)} className="text-zinc-400 hover:text-white bg-zinc-900 p-2 rounded-lg transition-colors">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDeleteAd(ad._id)} className="text-red-500/70 hover:text-red-500 bg-red-500/10 p-2 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* MODAL ΕΠΕΞΕΡΓΑΣΙΑΣ */}
      {editingAd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f0f0f] border border-white/10 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setEditingAd(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-zinc-900 p-1.5 rounded-full">
              <X size={20} />
            </button>
            
            <h3 className="text-2xl font-black text-white italic tracking-tighter mb-6 flex items-center gap-2">
              <Edit className="text-[#ccff00]" size={24} /> Επεξεργασία Σποτ
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
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Audio URL (mp3)</label>
                  <input required type="url" value={editingAd.audioUrl} onChange={e => setEditingAd({...editingAd, audioUrl: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none" />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 flex items-center gap-1"><ImageIcon size={12}/> Logo URL</label>
                  <input type="url" value={editingAd.logoUrl} onChange={e => setEditingAd({...editingAd, logoUrl: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 flex items-center gap-1"><LinkIcon size={12}/> URL Προορισμου *</label>
                  <input required type="url" value={editingAd.linkUrl || ''} onChange={e => setEditingAd({...editingAd, linkUrl: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none placeholder:text-zinc-600" placeholder="https://..." />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Σταθμος</label>
                  <select value={editingAd.stationId} onChange={e => setEditingAd({...editingAd, stationId: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none cursor-pointer">
                    {stations.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 block">Συχνοτητα</label>
                  <select value={editingAd.frequency} onChange={e => setEditingAd({...editingAd, frequency: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none cursor-pointer">
                    <option value="entry">Στο Play (Pre-roll)</option>
                    <option value="every_5_stations">Κάθε 5 αλλαγές</option>
                    <option value="every_10_stations">Κάθε 10 αλλαγές</option>
                    <option value="every_15_stations">Κάθε 15 αλλαγές</option>
                    <option value="every_1_hour">Κάθε 1 ώρα (:15 / :45)</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-[10px] text-zinc-500 font-black uppercase ml-1 mb-1 flex items-center gap-1"><SlidersHorizontal size={12}/> DSP Επεξεργασια (Mastering)</label>
                  <select value={editingAd.dspPreset || 'OFF'} onChange={e => setEditingAd({...editingAd, dspPreset: e.target.value})} className="w-full bg-black border border-white/5 h-12 rounded-xl px-4 text-sm text-[#ccff00] focus:border-[#ccff00]/50 outline-none cursor-pointer">
                    <option value="OFF">Χωρίς Επεξεργασία (Original)</option>
                    <option value="NORMALIZE">Normalize (Σταθερή Ένταση)</option>
                  </select>
                </div>

                {/* GEO TARGETING BLOCK (Edit Form) */}
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
