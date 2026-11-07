import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Megaphone, Edit2, Activity, AlertCircle, CheckCircle2, 
  Clock, XCircle, ImageIcon, LinkIcon, Trash2, ShieldAlert,
  PlusCircle, X, Mic2, SlidersHorizontal, Image, LayoutGrid, LayoutPanelTop, Rows3, Loader2, MapPin
} from 'lucide-react';

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

const INITIAL_FORM_STATE = {
  title: '',
  description: '',
  imageUrl: '',
  squareImageUrl: '',
  targetUrl: '',
  audioUrl: '',
  placement: ['audio'], 
  frequency: 'pending_admin',
  dspPreset: 'OFF',
  targetCountry: 'All', targetRegion: 'All', targetLocations: ['All'] // 🟢 ΝΕΑ ΠΕΔΙΑ
};

export default function AdvertiserAds({ API_URL, currentUser }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  
  // 🟢 FILE STATES
  const [audioFile, setAudioFile] = useState(null); 
  const [bannerFile, setBannerFile] = useState(null); 
  const [squareBannerFile, setSquareBannerFile] = useState(null); 
  
  const navigate = useNavigate();
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  const fetchMyAds = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/banners/my-ads?userId=${currentUser._id || currentUser.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` }
      });
      if (res.ok) setAds(await res.json());
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMyAds(); }, [currentUser, BASE_URL]);

  const handleCreateNewClick = () => {
    setEditingAd(null);
    setFormData(INITIAL_FORM_STATE);
    setAudioFile(null); 
    setBannerFile(null);
    setSquareBannerFile(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (ad) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title || '',
      description: ad.description || '',
      imageUrl: ad.imageUrl || '',
      squareImageUrl: ad.squareImageUrl || '',
      targetUrl: ad.targetUrl || '',
      audioUrl: ad.audioUrl || '',
      placement: ad.placement || ['audio'],
      frequency: ad.frequency || 'pending_admin',
      dspPreset: ad.dspPreset || 'OFF',
      targetCountry: ad.targetCountry || 'All',
      targetRegion: ad.targetRegion || 'All',
      targetLocations: ad.targetLocations || ['All']
    });
    setAudioFile(null); 
    setBannerFile(null);
    setSquareBannerFile(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      let finalAudioUrl = formData.audioUrl;
      let finalImageUrl = formData.imageUrl;
      let finalSquareUrl = formData.squareImageUrl;

      const isAudioAd = formData.placement.includes('audio');

      // 1. UPLOADS ΣΤΑ NGINX ENDPOINTS
      if (isAudioAd) {
        if (!finalAudioUrl && !audioFile) {
          throw new Error("Είναι απαραίτητο να επιλέξετε ένα αρχείο ήχου (mp3/wav).");
        }
        if (audioFile) {
          const fileData = new FormData();
          fileData.append('audioFile', audioFile);
          const uploadRes = await fetch(`${BASE_URL}/uploads/upload-ad`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` },
            body: fileData
          });
          const uploadResult = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uploadResult.error || "Αποτυχία ανεβάσματος ήχου.");
          finalAudioUrl = uploadResult.url;
        }
      } else {
        if (!finalImageUrl && !bannerFile) {
          throw new Error("Είναι απαραίτητο να επιλέξετε μια εικόνα Horizontal Banner.");
        }
        
        if (bannerFile) {
          const fileData = new FormData();
          fileData.append('imageFile', bannerFile);
          const uploadRes = await fetch(`${BASE_URL}/uploads/upload-banner`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` },
            body: fileData
          });
          const uploadResult = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uploadResult.error || "Αποτυχία ανεβάσματος banner.");
          finalImageUrl = uploadResult.url;
        }

        if (squareBannerFile) {
          const sqData = new FormData();
          sqData.append('imageFile', squareBannerFile);
          const sqRes = await fetch(`${BASE_URL}/uploads/upload-banner`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` },
            body: sqData
          });
          const sqResult = await sqRes.json();
          if (!sqRes.ok) throw new Error(sqResult.error || "Αποτυχία ανεβάσματος square banner.");
          finalSquareUrl = sqResult.url;
        }
      }

      // 2. ΑΠΟΘΗΚΕΥΣΗ ΔΙΑΦΗΜΙΣΗΣ (DB) ΜΕ JSON
      const payload = {
        userId: currentUser._id || currentUser.id,
        title: formData.title,
        description: formData.description,
        targetUrl: formData.targetUrl,
        placement: formData.placement,
        frequency: formData.frequency,
        dspPreset: formData.dspPreset,
        audioUrl: finalAudioUrl,
        imageUrl: finalImageUrl,
        squareImageUrl: finalSquareUrl,
        targetCountry: formData.targetCountry,
        targetRegion: formData.targetRegion,
        targetLocations: formData.targetLocations
      };

      const method = editingAd ? 'PUT' : 'POST';
      const url = editingAd ? `${BASE_URL}/banners/my-ads/${editingAd._id}` : `${BASE_URL}/banners/upload`;

      const res = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('iluma_token')}` 
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        fetchMyAds();
        setIsModalOpen(false);
      } else {
        const errData = await res.json();
        alert(errData.message || "Σφάλμα κατά την αποθήκευση.");
      }
    } catch (err) {
      alert(err.message || "Σφάλμα δικτύου.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubscription = async (adId) => {
    if (!window.confirm("Ακύρωση συνδρομής;")) return;
    setCancellingId(adId);
    try {
      const res = await fetch(`${BASE_URL}/payments/cancel-ad-subscription`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('iluma_token')}`
        },
        body: JSON.stringify({ adId, userId: currentUser._id || currentUser.id })
      });
      if (res.ok) fetchMyAds();
    } catch (err) {}
    setCancellingId(null);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved': return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 size={12} /> Live</span>;
      case 'pending': return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><Clock size={12} /> Pending</span>;
      case 'draft': return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><Edit2 size={12} /> Draft</span>;
      default: return null;
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-[#ccff00] font-black uppercase tracking-widest animate-pulse italic">
       <Loader2 className="animate-spin" size={40} />
       Syncing with iRadios Ad Network...
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 pb-40">
      
      <div className="max-w-7xl mx-auto mb-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00] text-[10px] font-black tracking-[0.3em] uppercase mb-4">
            <ShieldAlert size={14} /> Global Advertiser Access
          </div>
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase text-white">Campaign <span className="text-[#ccff00]">Command</span></h1>
        </div>
        
        <button onClick={handleCreateNewClick} className="bg-[#ccff00] text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:scale-105 transition-all shadow-[0_0_30px_rgba(204,255,0,0.2)] w-fit">
          <PlusCircle size={18} strokeWidth={3} /> NEW CAMPAIGN
        </button>
      </div>

      <div className="max-w-7xl mx-auto">
        {ads.length === 0 ? (
          <div className="bg-zinc-900/30 border border-white/5 rounded-[50px] p-20 text-center flex flex-col items-center border-dashed">
            <Megaphone size={60} className="text-zinc-800 mb-8" />
            <h3 className="text-3xl font-black uppercase italic mb-4">Clean Slate</h3>
            <p className="text-zinc-500 max-w-sm mx-auto mb-10 leading-relaxed font-medium">Δεν έχετε δημιουργήσει ακόμα κάποια διαφήμιση. Ξεκινήστε την πρώτη σας καμπάνια τώρα.</p>
            <button onClick={handleCreateNewClick} className="bg-white text-black px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-[#ccff00] transition-colors">ΔΗΜΙΟΥΡΓΙΑ ΠΡΩΤΗΣ ΔΙΑΦΗΜΙΣΗΣ</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {ads.map(ad => {
              const isAudio = ad.placement?.includes('audio');
              return (
                <div key={ad._id} className="bg-[#0c0c0c] border border-white/10 rounded-[40px] overflow-hidden flex flex-col group hover:border-[#ccff00]/30 transition-all shadow-2xl relative">
                  <div className="h-56 bg-zinc-900 relative flex items-center justify-center border-b border-white/5 overflow-hidden">
                    {isAudio ? (
                      <div className="flex flex-col items-center gap-3 text-orange-500/40">
                         <Mic2 size={50} />
                         <span className="text-[10px] font-black uppercase tracking-[0.3em]">Audio Campaign</span>
                      </div>
                    ) : (ad.imageUrl || ad.squareImageUrl) ? (
                      <img src={ad.imageUrl || ad.squareImageUrl} alt="" className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700" />
                    ) : <ImageIcon size={40} className="text-zinc-800" />}
                    
                    <div className="absolute top-6 left-6">{getStatusBadge(ad.status)}</div>
                    <div className="absolute bottom-6 right-6 flex items-center gap-2">
                       {ad.placement?.map(p => (
                         <span key={p} className="bg-black/60 backdrop-blur-md text-white text-[8px] font-black px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-widest">{p}</span>
                       ))}
                    </div>
                    {/* Εμφάνιση Τοποθεσίας αν δεν είναι All */}
                    {ad.targetLocations && ad.targetLocations[0] !== 'All' && (
                      <div className="absolute bottom-6 left-6 bg-purple-500/90 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-lg flex items-center gap-1 backdrop-blur-sm">
                        📍 {ad.targetLocations[0]}
                      </div>
                    )}
                  </div>

                  <div className="p-8 flex-1 flex flex-col">
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2 group-hover:text-[#ccff00] transition-colors">{ad.title || 'Draft Campaign'}</h3>
                    <p className="text-zinc-500 text-sm font-medium mb-8 line-clamp-2 min-h-[40px]">{ad.description || 'Χωρίς περιγραφή...'}</p>

                    <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-8 mb-8">
                       <div className="text-center">
                          <div className="text-[9px] text-zinc-600 font-black uppercase mb-1">Impact</div>
                          <div className="font-black text-white text-lg">{ad.impressions || 0}</div>
                       </div>
                       <div className="text-center border-x border-white/5">
                          <div className="text-[9px] text-zinc-600 font-black uppercase mb-1">Actions</div>
                          <div className="font-black text-[#ccff00] text-lg">{ad.clicks || 0}</div>
                       </div>
                       <div className="text-center">
                          <div className="text-[9px] text-zinc-600 font-black uppercase mb-1">CTR</div>
                          <div className="font-black text-blue-400 text-lg">{ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0'}%</div>
                       </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                       <div>
                          <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mb-1">Ends At</div>
                          <div className="text-xs font-black text-white">{ad.expiresAt ? new Date(ad.expiresAt).toLocaleDateString('el-GR') : 'Pending Approval'}</div>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleEditClick(ad)} className="bg-white/5 hover:bg-[#ccff00] hover:text-black p-3 rounded-2xl transition-all"><Edit2 size={18} /></button>
                          {!ad.cancelAtPeriodEnd && ad.stripeSubscriptionId && (
                            <button onClick={() => handleCancelSubscription(ad._id)} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-3 rounded-2xl transition-all"><Trash2 size={18} /></button>
                          )}
                       </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL ΕΠΕΞΕΡΓΑΣΙΑΣ / ΔΗΜΙΟΥΡΓΙΑΣ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-start justify-center p-4 pt-12 md:pt-20 bg-black/95 backdrop-blur-xl overflow-y-auto custom-scrollbar">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-[50px] w-full max-w-2xl p-10 md:p-14 relative shadow-2xl animate-in slide-in-from-bottom-8 mb-20">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-10 right-10 text-zinc-600 hover:text-white bg-white/5 p-2 rounded-full transition-colors"><X size={24} /></button>
            
            <div className="mb-10">
              <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter mb-2">
                {editingAd ? 'Edit Campaign' : 'Create New Campaign'}
              </h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Configure your presence on iRadios Network</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              
              {!editingAd && (
                <div>
                   <label className="text-[10px] font-black text-zinc-600 uppercase mb-4 block tracking-widest ml-1">Select Placement Type</label>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        {id: 'hero', icon: <LayoutPanelTop size={18}/>},
                        {id: 'home', icon: <Rows3 size={18}/>},
                        {id: 'radio_feed', icon: <LayoutGrid size={18}/>},
                        {id: 'audio', icon: <Mic2 size={18}/>}
                      ].map(p => (
                        <button 
                           key={p.id} 
                           type="button" 
                           onClick={() => setFormData({...formData, placement: [p.id]})} 
                           className={`p-4 rounded-2xl border text-[9px] font-black uppercase flex flex-col items-center gap-2 transition-all ${formData.placement.includes(p.id) ? 'bg-[#ccff00] border-[#ccff00] text-black shadow-xl scale-105' : 'bg-zinc-900 border-white/5 text-zinc-600 hover:border-white/10'}`}
                        >
                           {p.icon} {p.id.replace('_', ' ')}
                        </button>
                      ))}
                   </div>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-zinc-600 uppercase mb-2 block tracking-widest ml-1">Campaign Title</label>
                  <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-black border border-white/10 h-14 rounded-2xl px-6 text-sm outline-none focus:border-[#ccff00]/50 font-bold transition-all" placeholder="e.g. Summer Promo" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-600 uppercase mb-2 block tracking-widest ml-1">Subtitle / Description</label>
                  <textarea rows="2" required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-[#ccff00]/50 font-medium transition-all resize-none" placeholder="Short marketing text..."></textarea>
                </div>
              </div>

              {formData.placement.includes('audio') ? (
                <div className="bg-orange-500/5 border border-orange-500/10 p-8 rounded-[32px] space-y-6">
                   <h4 className="text-orange-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-2"><Mic2 size={14}/> Audio Assets</h4>
                   
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">Audio File (.mp3, .wav) *</label>
                     {editingAd && formData.audioUrl && (
                        <div className="mb-2 px-1">
                           <a href={formData.audioUrl} target="_blank" rel="noreferrer" className="text-orange-400 text-xs hover:underline">▶ Ακούστε το τρέχον αρχείο</a>
                        </div>
                     )}
                     <input 
                       type="file" 
                       accept="audio/mp3, audio/wav, audio/mpeg"
                       required={!editingAd && !formData.audioUrl} 
                       onChange={e => setAudioFile(e.target.files[0])} 
                       className="w-full bg-black border border-white/10 h-12 rounded-xl text-sm outline-none font-bold transition-all file:mr-4 file:h-12 file:px-6 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-orange-500 file:text-white hover:file:bg-orange-400 cursor-pointer text-zinc-500" 
                     />
                   </div>

                   {/* Στο Audio συνήθως δεν έχουμε banner, αλλά αν θες Brand Logo */}
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1 block">Brand Logo URL (Προαιρετικό)</label>
                     <input 
                       type="url" 
                       value={formData.squareImageUrl} 
                       onChange={e => setFormData({...formData, squareImageUrl: e.target.value})} 
                       className="w-full bg-black border border-white/10 h-12 rounded-xl px-5 text-sm outline-none font-bold transition-all focus:border-orange-500/50" 
                       placeholder="https://..." 
                     />
                   </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Mastering</label>
                        <select value={formData.dspPreset} onChange={e => setFormData({...formData, dspPreset: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-sm outline-none cursor-pointer font-bold text-blue-400">
                           <option value="OFF">Bypass</option>
                           <option value="NORMALIZE">Normalize</option>
                        </select>
                      </div>
                </div>
              ) : (
                <div className="bg-purple-500/5 border border-purple-500/10 p-8 rounded-[32px] space-y-6">
                   <h4 className="text-purple-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-2"><ImageIcon size={14}/> Visual Assets</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Landscape Banner (16:9)</label>
                        {editingAd && formData.imageUrl && <input type="text" readOnly value={formData.imageUrl} className="w-full bg-black/50 border border-white/10 h-10 rounded-xl px-3 text-xs text-zinc-500 mb-2 outline-none" />}
                        <input 
                           type="file" 
                           accept="image/jpeg, image/png, image/webp"
                           required={!editingAd && !formData.imageUrl}
                           onChange={e => setBannerFile(e.target.files[0])} 
                           className="w-full bg-black border border-white/10 h-10 rounded-xl text-sm outline-none font-bold transition-all file:mr-2 file:h-10 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-purple-500 file:text-white hover:file:bg-purple-400 cursor-pointer text-zinc-500" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Square Banner (1:1)</label>
                        {editingAd && formData.squareImageUrl && <input type="text" readOnly value={formData.squareImageUrl} className="w-full bg-black/50 border border-white/10 h-10 rounded-xl px-3 text-xs text-zinc-500 mb-2 outline-none" />}
                        <input 
                           type="file" 
                           accept="image/jpeg, image/png, image/webp"
                           onChange={e => setSquareBannerFile(e.target.files[0])} 
                           className="w-full bg-black border border-white/10 h-10 rounded-xl text-sm outline-none font-bold transition-all file:mr-2 file:h-10 file:px-4 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 cursor-pointer text-zinc-500" 
                        />
                      </div>
                   </div>
                </div>
              )}

              {/* 🟢 GEO TARGETING BLOCK */}
              <div className="bg-zinc-900/50 rounded-2xl border border-white/5 p-6">
                <h4 className="text-[#ccff00] font-black text-[11px] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <MapPin size={12}/> Στόχευση Περιοχής
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Χώρα</label>
                    <select 
                      value={formData.targetCountry || 'All'} 
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({ ...formData, targetCountry: val, targetRegion: 'All', targetLocations: [val === 'All' ? 'All' : val] });
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
                      value={formData.targetRegion || 'All'} 
                      onChange={e => {
                        const val = e.target.value;
                        setFormData({ ...formData, targetRegion: val, targetLocations: [val === 'All' ? formData.targetCountry : val] });
                      }} 
                      disabled={!formData.targetCountry || formData.targetCountry === 'All'}
                      className="w-full bg-black border border-white/5 h-10 rounded-lg px-3 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold transition-colors"
                    >
                      <option value="All">Όλοι οι Νομοί</option>
                      {formData.targetCountry && formData.targetCountry !== 'All' && 
                        Object.keys(LOCATION_DATA[formData.targetCountry]).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Πόλη</label>
                    <select 
                      value={(formData.targetLocations && formData.targetLocations[0]) || 'All'} 
                      onChange={e => setFormData({...formData, targetLocations: [e.target.value]})} 
                      disabled={!formData.targetRegion || formData.targetRegion === 'All'}
                      className="w-full bg-black border border-white/5 h-10 rounded-lg px-3 text-white focus:border-[#ccff00]/50 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold transition-colors"
                    >
                      <option value={formData.targetRegion && formData.targetRegion !== 'All' ? formData.targetRegion : 'All'}>Όλες οι Πόλεις</option>
                      {formData.targetCountry && formData.targetCountry !== 'All' && formData.targetRegion && formData.targetRegion !== 'All' && 
                        LOCATION_DATA[formData.targetCountry]?.[formData.targetRegion]?.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* AUTOMATION NOTICE */}
              {formData.placement.includes('audio') && (
                 <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-start gap-3 mt-4">
                    <AlertCircle className="text-[#ccff00] shrink-0 mt-0.5" size={16} />
                    <p className="text-[10px] text-zinc-400 font-bold uppercase leading-relaxed tracking-wider">
                      Η συχνότητα μετάδοσης θα οριστεί από τον Admin κατά την έγκριση του αρχείου για τη βέλτιστη εμπειρία ακρόασης.
                    </p>
                 </div>
              )}

              <div>
                <label className="text-[10px] font-black text-zinc-600 uppercase mb-2 block tracking-widest ml-1">Call to Action Link</label>
                <div className="flex items-center gap-4 bg-black border border-white/10 h-14 rounded-2xl px-6 focus-within:border-blue-500/50 transition-all">
                   <LinkIcon size={18} className="text-zinc-600" />
                   <input type="url" required value={formData.targetUrl} onChange={e => setFormData({...formData, targetUrl: e.target.value})} className="bg-transparent w-full outline-none text-sm font-bold text-blue-400" placeholder="https://your-site.com" />
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-[#ccff00] text-black font-black py-6 rounded-[28px] uppercase tracking-[0.25em] text-xs shadow-2xl hover:scale-[1.02] active:scale-95 transition-all mt-8 flex justify-center items-center gap-3">
                 {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingAd ? 'Update Campaign' : 'Deploy Campaign')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
