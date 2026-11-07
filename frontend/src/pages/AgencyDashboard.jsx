import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Megaphone, Plus, LayoutPanelTop, Rows3, LayoutGrid, Activity, X, Eye, ShieldCheck, 
  Clock, Mic2, BarChart3, RotateCw, Target, CreditCard, Building2, AlertTriangle, Loader2, SlidersHorizontal, Image as ImageIcon, Link as LinkIcon, Users
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAlert } from '../context/AlertContext';

// ⚠️ Βάλε το LIVE Publishable Key σου
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

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

const StripeCheckoutForm = ({ plan, price, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message);
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: 'tabs' }} />
      {errorMessage && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold flex items-start gap-3 border border-red-100">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" /> 
          <span>{errorMessage}</span>
        </div>
      )}
      <button 
        disabled={isProcessing || !stripe || !elements} 
        className="w-full h-14 bg-[#ccff00] text-black font-black uppercase tracking-[0.2em] text-xs rounded-xl hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(204,255,0,0.3)] disabled:opacity-50 disabled:hover:scale-100"
      >
        {isProcessing ? <Loader2 className="animate-spin" size={20} /> : `ΟΛΟΚΛΗΡΩΣΗ ΠΛΗΡΩΜΗΣ ${price}€`}
      </button>
      <div className="text-center text-[10px] text-zinc-500 font-medium mt-2 flex items-center justify-center gap-1">
        <ShieldCheck size={12} /> Ασφαλής Συναλλαγή μέσω Stripe
      </div>
    </form>
  );
};


// --- MAIN AGENCY DASHBOARD ---
export default function AgencyDashboard({ API_URL, currentUser, globalSocket }) {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  const [activeTab, setActiveTab] = useState('banners'); 
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
  const [clientSecret, setClientSecret] = useState("");
  const [pendingCampaignData, setPendingCampaignData] = useState(null);

  const [bannerForm, setBannerForm] = useState({ 
    title: '', description: '', imageUrl: '', squareImageUrl: '', targetUrl: '', targetCountry: 'All', targetRegion: 'All', targetLocations: ['All']
  });
  
  const [audioForm, setAudioForm] = useState({ 
    title: '', client: '', audioUrl: '', logoUrl: '', linkUrl: '', frequency: 'every_4', dspPreset: 'OFF', targetCountry: 'All', targetRegion: 'All', targetLocations: ['All']
  });

  const stripePriceIds = {
    hero: { day: 'price_1T96oJHiixNRiHTmeb9TWjQW', month: 'price_1T96suHiixNRiHTmMnAGpnQZ', quarter: 'price_1T96suHiixNRiHTmCPmZ3BRd', half: 'price_1T96suHiixNRiHTmSQj85CK3', year: 'price_1T96suHiixNRiHTmCdtdzMKm' },
    radio_feed: { day: 'price_1T96w3HiixNRiHTm8aqYWio0', month: 'price_1TAGGXHiixNRiHTmypD7t8jI', quarter: 'price_1T96x5HiixNRiHTmOfnKC8OF', half: 'price_1T96x5HiixNRiHTmlmTyYIsu', year: 'price_1T96x5HiixNRiHTmmlZFKfwJ' },
    home: { day: 'price_1T96ydHiixNRiHTmRjYMJqnk', month: 'price_1T96zNHiixNRiHTmPiLVQ3li', quarter: 'price_1T96zNHiixNRiHTmtwJ6ntfW', half: 'price_1T96zNHiixNRiHTmPeM5gw9G', year: 'price_1T96zNHiixNRiHTmbYwsshrH' },
    audio: { day: 'price_1TAFyEHiixNRiHTmpFiRvRok', month: 'price_1T9726HiixNRiHTm8wXBwGU3', quarter: 'price_1T9726HiixNRiHTmlS91sdPK', half: 'price_1T9726HiixNRiHTmoK55GgRY', year: 'price_1T9726HiixNRiHTmtD8XQIqi' }
  };

  const displayPrices = {
    radio_feed: { day: 3.99, month: 89.00, quarter: 239.00, half: 449.00, year: 899.00 },
    home:       { day: 5.99, month: 129.00, quarter: 349.00, half: 649.00, year: 1290.00 },
    hero:       { day: 8.99, month: 199.00, quarter: 539.00, half: 999.00, year: 1990.00 },
    audio:      { day: 9.99, month: 229.00, quarter: 619.00, half: 1149.00, year: 2290.00 }
  };

  const placementOptions = [
    { id: 'hero', label: 'Hero Banner', desc: 'Στην κορυφή της αρχικής.', icon: <LayoutPanelTop size={24} />, type: 'banner' },
    { id: 'home', label: 'Home Feed', desc: 'Ανάμεσα στα ραδιόφωνα.', icon: <Rows3 size={24} />, type: 'banner' },
    { id: 'radio_feed', label: 'Radio Grid', desc: 'Στο grid αναζήτησης.', icon: <LayoutGrid size={24} />, type: 'banner' },
    { id: 'audio', label: 'Audio Spot', desc: 'Pre-roll ή Mid-roll ήχος.', icon: <Mic2 size={24} />, type: 'audio' },
  ];

  const loadDashboardData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const resBanners = await fetch(`${BASE_URL}/agency/${currentUser._id}/banners`);
      const resAudio = await fetch(`${BASE_URL}/agency/${currentUser._id}/audio-ads`);
      
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

  // 🟢 PROCEED TO PAYMENT (Uploads Files first)
  const handleProceedToPayment = async (e) => {
    e.preventDefault();
    setUploading(true);
    
    let finalAudioUrl = audioForm.audioUrl;
    let finalAudioLogoUrl = '/favicon.png';
    let finalBannerUrl = bannerForm.imageUrl;
    let finalSquareUrl = bannerForm.squareImageUrl;

    try {
      if (selectedType === 'audio') {
        if (!audioFile) throw new Error("Παρακαλώ επιλέξτε ένα αρχείο ήχου (mp3/wav).");
        // Upload Audio
        finalAudioUrl = await uploadFile(audioFile, 'upload-ad', 'audioFile');
        // Upload Logo (Αν υπάρχει)
        if (logoFile) {
          finalAudioLogoUrl = await uploadFile(logoFile, 'upload-logo', 'logoFile');
        }
      } 
      else {
        if (!bannerFile && !finalBannerUrl) throw new Error("Παρακαλώ επιλέξτε το βασικό εικαστικό (Horizontal Banner).");
        if (bannerFile) finalBannerUrl = await uploadFile(bannerFile, 'upload-banner', 'imageFile');
        if (squareBannerFile) finalSquareUrl = await uploadFile(squareBannerFile, 'upload-banner', 'imageFile');
      }
    } catch (err) {
      setUploading(false);
      return showAlert('Σφάλμα Upload', err.message, 'error');
    }

    setUploading(false);

    const priceId = stripePriceIds[selectedType][selectedDuration];
    
    const payload = selectedType === 'audio' 
      ? { ...audioForm, audioUrl: finalAudioUrl, logoUrl: finalAudioLogoUrl, adType: 'audio', duration: selectedDuration, status: 'pending', agencyId: currentUser._id }
      : { ...bannerForm, imageUrl: finalBannerUrl, squareImageUrl: finalSquareUrl, placement: [selectedType], duration: selectedDuration, status: 'pending', agencyId: currentUser._id };

    try {
      const res = await fetch(`${BASE_URL}/payments/create-ad-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser._id, priceId, adType: selectedType })
      });
      const data = await res.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setPendingCampaignData(payload); 
        setCreationStep(3); 
      }
    } catch (err) {
      showAlert('Σφάλμα', 'Αποτυχία σύνδεσης με Stripe. Δοκιμάστε ξανά.', 'error');
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      const endpoint = selectedType === 'audio' ? '/agency/audio-ads' : '/agency/banners';
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingCampaignData)
      });

      if (res.ok) {
        showAlert('Επιτυχία!', 'Η πληρωμή ολοκληρώθηκε. Η καμπάνια σας εστάλη για έγκριση.', 'success');
        setShowCreationModal(false);
        setCreationStep(1);
        
        setBannerForm({ title: '', description: '', imageUrl: '', squareImageUrl: '', targetUrl: '', targetCountry: 'All', targetRegion: 'All', targetLocations: ['All'] });
        setAudioForm({ title: '', client: '', audioUrl: '', logoUrl: '', linkUrl: '', frequency: 'every_4', dspPreset: 'OFF', targetCountry: 'All', targetRegion: 'All', targetLocations: ['All'] });
        setAudioFile(null);
        setLogoFile(null);
        setBannerFile(null);
        setSquareBannerFile(null);

        loadDashboardData();
        fetchNetworkStats(); 
      }
    } catch (err) {
      showAlert('Σφάλμα', 'Η πληρωμή πέρασε, αλλά υπήρξε σφάλμα αποθήκευσης.', 'error');
    }
  };

  const totalImpressions = [...campaigns.banners, ...campaigns.audio].reduce((acc, curr) => acc + (curr.impressions || curr.plays || 0), 0);
  const totalClicks = [...campaigns.banners, ...campaigns.audio].reduce((acc, curr) => acc + (curr.clicks || 0), 0);
  const avgCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;


  return (
    <div className="min-h-screen bg-black text-white p-6 lg:p-12 font-sans pb-32 animate-fade-in relative overflow-hidden">
      
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#ccff00]/5 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-12">
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
              onClick={() => { 
                setCreationStep(1); setSelectedType(null); setShowCreationModal(true); 
                setAudioFile(null); setLogoFile(null); setBannerFile(null); setSquareBannerFile(null);
              }}
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
            {(activeTab === 'banners' ? campaigns.banners : campaigns.audio).map(campaign => (
              <div key={campaign._id} className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-[32px] p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
                
                <div className="absolute top-6 right-6">
                  {campaign.status === 'active' && <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border border-emerald-500/20">LIVE</span>}
                  {campaign.status === 'pending' && <span className="bg-orange-500/10 text-orange-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border border-orange-500/20 animate-pulse">IN REVIEW</span>}
                  {campaign.status === 'expired' && <span className="bg-red-500/10 text-red-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border border-red-500/20">EXPIRED</span>}
                </div>

                <div className="mb-6 pr-24">
                  <h3 className="text-xl font-black text-white truncate" title={campaign.title}>{campaign.title}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                    {activeTab === 'banners' ? <LayoutGrid size={12} /> : <Mic2 size={12} />}
                    {activeTab === 'banners' ? (campaign.placement?.join(', ') || 'Banner') : 'Audio Pre-Roll'}
                  </p>
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
              </div>
            ))}
            
            {(activeTab === 'banners' ? campaigns.banners : campaigns.audio).length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-[40px]">
                <Target size={48} className="mx-auto text-zinc-700 mb-4" />
                <h3 className="text-xl font-black text-zinc-400 mb-2">Δεν βρέθηκαν καμπάνιες</h3>
                <p className="text-zinc-600 text-sm">Δημιουργήστε την πρώτη σας διαφήμιση για να ξεκινήσετε.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreationModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-white/10 rounded-[40px] w-full max-w-3xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-black/50 shrink-0">
              <div>
                <h3 className="text-2xl md:text-3xl font-black italic tracking-tighter text-white">Setup Campaign</h3>
                <p className="text-[10px] text-[#ccff00] font-black uppercase tracking-[0.2em] mt-2">Βημα {creationStep} απο 3</p>
              </div>
              <button onClick={() => setShowCreationModal(false)} className="p-3 bg-white/5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"><X size={20}/></button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
              
              {creationStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-8">
                  <p className="text-sm font-bold text-zinc-400">Επιλέξτε πού θέλετε να εμφανίζεται το brand σας:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {placementOptions.map(opt => (
                      <div 
                        key={opt.id} 
                        onClick={() => setSelectedType(opt.id)}
                        className={`p-6 rounded-3xl border cursor-pointer transition-all flex items-start gap-4 ${
                          selectedType === opt.id ? 'bg-purple-500/10 border-purple-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.15)] scale-[1.02]' : 'bg-black border-white/5 text-zinc-500 hover:border-white/20'
                        }`}
                      >
                        <div className={`p-4 rounded-2xl shrink-0 ${selectedType === opt.id ? 'bg-purple-500 text-white shadow-lg' : 'bg-white/5 text-zinc-400'}`}>
                          {opt.icon}
                        </div>
                        <div>
                          <h4 className="font-black text-base uppercase tracking-tight mb-1">{opt.label}</h4>
                          <p className={`text-[11px] font-medium leading-snug ${selectedType === opt.id ? 'text-purple-200' : 'text-zinc-600'}`}>{opt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="pt-6">
                    <button 
                      disabled={!selectedType}
                      onClick={() => setCreationStep(2)}
                      className="w-full py-5 bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl disabled:opacity-50 disabled:hover:bg-white transition-all shadow-xl"
                    >
                      Συνεχεια
                    </button>
                  </div>
                </div>
              )}

              {creationStep === 2 && (
                <form onSubmit={handleProceedToPayment} className="space-y-8 animate-in slide-in-from-right-8">
                  
                  <div className="space-y-4">
                    <h4 className="text-white font-black text-[11px] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Target size={14} className="text-purple-400"/> Βασικα Στοιχεια
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Τίτλος Καμπάνιας *</label>
                        <input type="text" required value={selectedType === 'audio' ? audioForm.title : bannerForm.title} onChange={e => selectedType === 'audio' ? setAudioForm({...audioForm, title: e.target.value}) : setBannerForm({...bannerForm, title: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-sm text-white focus:border-purple-500 outline-none transition-colors" placeholder="π.χ. Summer Promo" />
                      </div>
                      {selectedType === 'audio' ? (
                        <div>
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Όνομα Πελάτη *</label>
                          <input type="text" required value={audioForm.client} onChange={e => setAudioForm({...audioForm, client: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-sm text-white focus:border-purple-500 outline-none transition-colors" placeholder="π.χ. ILUMA Agency" />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">URL Προορισμού (Link) *</label>
                          <input type="url" required value={bannerForm.targetUrl} onChange={e => setBannerForm({...bannerForm, targetUrl: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-sm text-white focus:border-purple-500 outline-none transition-colors" placeholder="https://..." />
                        </div>
                      )}
                    </div>
                    
                    {selectedType !== 'audio' && (
                      <div>
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Περιγραφή *</label>
                        <textarea required rows="2" value={bannerForm.description} onChange={e => setBannerForm({...bannerForm, description: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm text-white focus:border-purple-500 outline-none transition-colors resize-none" placeholder="Λίγα λόγια..."></textarea>
                      </div>
                    )}
                  </div>

                  <div className="w-full h-px bg-white/5"></div>

                  <div className="space-y-4">
                    <h4 className="text-white font-black text-[11px] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ImageIcon size={14} className="text-[#ccff00]"/> Υλικο Καμπανιας (Assets)
                    </h4>
                    
                    {/* 🟢 ΑΝΑΝΕΩΜΕΝΟ AUDIO SECTION ΜΕ FILE UPLOAD ΓΙΑ LOGO */}
                    {selectedType === 'audio' ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-black text-[#ccff00] uppercase tracking-widest pl-1 mb-1 flex items-center gap-1"><Mic2 size={12}/> Ανεβασμα Ηχου (mp3/wav) *</label>
                            <input 
                              type="file" 
                              required 
                              accept="audio/mp3, audio/wav, audio/mpeg"
                              onChange={e => setAudioFile(e.target.files[0])} 
                              className="w-full bg-black border border-white/10 h-12 rounded-xl px-3 py-3 text-sm text-white focus:border-[#ccff00]/50 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-[#ccff00] file:text-black cursor-pointer hover:file:bg-[#b3e600]" 
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 flex items-center gap-1"><ImageIcon size={12}/> Ανεβασμα Λογοτυπου (Εικονα)</label>
                            <input 
                              type="file" 
                              accept="image/jpeg, image/png, image/webp"
                              onChange={e => setLogoFile(e.target.files[0])} 
                              className="w-full bg-black border border-white/10 h-12 rounded-xl px-3 py-3 text-sm text-white focus:border-purple-500 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-purple-500 file:text-white cursor-pointer hover:file:bg-purple-600" 
                            />
                          </div>
                        </div>
                        
                        {/* Εδώ βάλαμε το URL και το DSP δίπλα-δίπλα, βγάζοντας τη Συχνότητα */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 flex items-center gap-1"><LinkIcon size={12}/> URL Προορισμού (Link Companion Ad)</label>
                            <input type="url" value={audioForm.linkUrl} onChange={e => setAudioForm({...audioForm, linkUrl: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-sm text-white focus:border-[#ccff00]/50 outline-none transition-colors" placeholder="https://..." />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest pl-1 mb-1 flex items-center gap-1"><SlidersHorizontal size={10}/> DSP Engine</label>
                            <select value={audioForm.dspPreset} onChange={e => setAudioForm({...audioForm, dspPreset: e.target.value})} className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-sm text-blue-400 font-bold focus:border-blue-500 outline-none transition-colors appearance-none">
                              <option value="OFF">Bypass (Original Audio)</option>
                              <option value="NORMALIZE">Normalize (Ομαλή Ένταση)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest pl-1 mb-1 block">Ανέβασμα Banner (Horizontal) *</label>
                          <input 
                            type="file" 
                            required={!bannerForm.imageUrl} 
                            accept="image/jpeg, image/png, image/webp"
                            onChange={e => setBannerFile(e.target.files[0])} 
                            className="w-full bg-black border border-white/10 h-12 rounded-xl px-3 py-3 text-sm text-white focus:border-purple-500 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-purple-500 file:text-white cursor-pointer" 
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1 mb-1 block">Ανέβασμα Square Banner (1:1)</label>
                          <input 
                            type="file" 
                            accept="image/jpeg, image/png, image/webp"
                            onChange={e => setSquareBannerFile(e.target.files[0])} 
                            className="w-full bg-black border border-white/10 h-12 rounded-xl px-3 py-3 text-sm text-white focus:border-purple-500 outline-none transition-colors file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-zinc-800 file:text-white cursor-pointer" 
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full h-px bg-white/5"></div>

                  <div className="space-y-4">
                    <h4 className="text-white font-black text-[11px] uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Target size={14} className="text-purple-400"/> Στοχευση Τοποθεσιας (Geo-Targeting)
                    </h4>
                    <div className="bg-zinc-900/50 rounded-2xl border border-white/5 p-6">
                      <div className="mb-4">
                        <p className="text-[9px] text-zinc-500 font-bold">Αφήστε "Όλες" για να εμφανίζεται η διαφήμιση παντού (Global), ή επιλέξτε συγκεκριμένη περιοχή.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Χώρα</label>
                          <select 
                            value={selectedType === 'audio' ? audioForm.targetCountry : bannerForm.targetCountry} 
                            onChange={e => {
                              const val = e.target.value;
                              const updates = { targetCountry: val, targetRegion: 'All', targetLocations: [val === 'All' ? 'All' : val] };
                              selectedType === 'audio' ? setAudioForm({ ...audioForm, ...updates }) : setBannerForm({ ...bannerForm, ...updates });
                            }} 
                            className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-purple-500 outline-none appearance-none cursor-pointer text-xs font-bold"
                          >
                            <option value="All">Όλες οι Χώρες</option>
                            {Object.keys(LOCATION_DATA).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Νομός / Περιφέρεια</label>
                          <select 
                            value={selectedType === 'audio' ? audioForm.targetRegion : bannerForm.targetRegion} 
                            onChange={e => {
                              const val = e.target.value;
                              const country = selectedType === 'audio' ? audioForm.targetCountry : bannerForm.targetCountry;
                              const updates = { targetRegion: val, targetLocations: [val === 'All' ? country : val] };
                              selectedType === 'audio' ? setAudioForm({ ...audioForm, ...updates }) : setBannerForm({ ...bannerForm, ...updates });
                            }} 
                            disabled={(selectedType === 'audio' ? audioForm.targetCountry : bannerForm.targetCountry) === 'All'}
                            className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-purple-500 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold"
                          >
                            <option value="All">Όλοι οι Νομοί</option>
                            {(selectedType === 'audio' ? audioForm.targetCountry : bannerForm.targetCountry) !== 'All' && 
                              Object.keys(LOCATION_DATA[selectedType === 'audio' ? audioForm.targetCountry : bannerForm.targetCountry]).map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Πόλη</label>
                          <select 
                            value={(selectedType === 'audio' ? audioForm.targetLocations[0] : bannerForm.targetLocations[0]) || 'All'} 
                            onChange={e => {
                              const updates = { targetLocations: [e.target.value] };
                              selectedType === 'audio' ? setAudioForm({ ...audioForm, ...updates }) : setBannerForm({ ...bannerForm, ...updates });
                            }} 
                            disabled={(selectedType === 'audio' ? audioForm.targetRegion : bannerForm.targetRegion) === 'All'}
                            className="w-full bg-black border border-white/10 h-12 rounded-xl px-4 text-white focus:border-purple-500 outline-none appearance-none cursor-pointer disabled:opacity-50 text-xs font-bold"
                          >
                            <option value={(selectedType === 'audio' ? audioForm.targetRegion : bannerForm.targetRegion) !== 'All' ? (selectedType === 'audio' ? audioForm.targetRegion : bannerForm.targetRegion) : 'All'}>Όλες οι Πόλεις</option>
                            {(selectedType === 'audio' ? audioForm.targetCountry : bannerForm.targetCountry) !== 'All' && (selectedType === 'audio' ? audioForm.targetRegion : bannerForm.targetRegion) !== 'All' && 
                              LOCATION_DATA[selectedType === 'audio' ? audioForm.targetCountry : bannerForm.targetCountry]?.[selectedType === 'audio' ? audioForm.targetRegion : bannerForm.targetRegion]?.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full h-px bg-white/5"></div>

                  <div className="bg-zinc-900/50 border border-white/5 rounded-[24px] p-6">
                    <label className="text-[10px] font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Clock size={14}/> Επιλογη Πακετου (Διαρκεια)
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
                      {['day', 'month', 'quarter', 'half', 'year'].map(dur => (
                        <div 
                          key={dur} 
                          onClick={() => setSelectedDuration(dur)}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center flex flex-col items-center justify-center ${
                            selectedDuration === dur ? 'bg-[#ccff00] border-[#ccff00] text-black shadow-lg md:scale-105' : 'bg-black border-white/5 text-zinc-500 hover:border-white/20'
                          }`}
                        >
                          <div className="text-[9px] md:text-[8px] lg:text-[9px] font-black uppercase tracking-widest mb-1">
                            {dur === 'day' ? '1 Ημερα' : dur === 'month' ? '1 Μηνας' : dur === 'quarter' ? '3 Μηνες' : dur === 'half' ? '6 Μηνες' : '1 Ετος'}
                          </div>
                          <div className="text-lg md:text-base lg:text-lg font-black">
                            {displayPrices[selectedType][dur]}€
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setCreationStep(1)} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors">Πισω</button>
                    <button type="submit" disabled={uploading} className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs tracking-[0.2em] rounded-xl transition-all active:scale-95 shadow-[0_10px_20px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2 disabled:opacity-50">
                      {uploading ? <Loader2 className="animate-spin" size={16} /> : <>Πληρωμη <CreditCard size={16} /></>}
                    </button>
                  </div>
                </form>
              )}

              {creationStep === 3 && clientSecret && (
                <div className="max-w-md mx-auto animate-in slide-in-from-right-8 pt-8">
                  <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-[#ccff00]/20 text-[#ccff00] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#ccff00]/30">
                      <CreditCard size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Checkout</h3>
                    <p className="text-zinc-400 mt-2 font-medium">Σύνολο πληρωμής: <span className="text-white font-black text-xl ml-1">{displayPrices[selectedType][selectedDuration]}€</span></p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl">
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <StripeCheckoutForm 
                        price={displayPrices[selectedType][selectedDuration]} 
                        onSuccess={handlePaymentSuccess} 
                      />
                    </Elements>
                  </div>
                  <button onClick={() => setCreationStep(2)} className="w-full mt-6 py-4 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors">Ακυρωση & Πισω</button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
