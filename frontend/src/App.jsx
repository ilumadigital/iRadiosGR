import React, { useState, useRef, useEffect, useMemo } from 'react';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { RefreshCw, X, Zap, Heart, Music, User, SlidersHorizontal, ShieldAlert, LogIn, UserPlus, Megaphone, FileText, Crown, MonitorSpeaker } from 'lucide-react';
import io from 'socket.io-client'; 


// --- CUSTOM HOOKS ---
import useAudioDSP from './hooks/useAudioDSP';
import useStations from './hooks/useStations';
import useAdEngine from './hooks/useAdEngine';
import useMediaSession from './hooks/useMediaSession';

// --- CONTEXT ---
import { AlertProvider, useAlert } from './context/AlertContext';

// --- UTILS  ---
import { cleanMetadata } from './utils/cleanMetadata';

// --- COMPONENTS ---
import Preloader from './components/Preloader';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import InstallPrompt from './components/InstallPrompt';
import TopBar from './components/TopBar';
import MobileNav from './components/MobileNav';
import MobileMiniPlayer from './components/MobileMiniPlayer';
import NotificationModal from './components/NotificationModal';
import MapMode from './components/MapMode';
import RadioDiscovery from './components/RadioDiscovery'; 
import CarMode from './components/CarMode';
import CarModePrompt from './components/CarModePrompt';
import CookieConsent from './components/CookieConsent';
import ScrollToTop from './components/ScrollToTop';
import WidgetPlayer from './components/WidgetPlayer';
import WidgetNow from './components/WidgetNow';

// --- PAGES ---
import Home from './pages/Home';
import BroadcasterStudio from './pages/BroadcasterStudio';
import ProducerStudio from './pages/ProducerStudio';
import Admin from './pages/Admin';
import AdminRadioSet from './pages/AdminRadioSet';
import AdminPaid from './pages/AdminPaid';
import AdminEmails from './pages/AdminEmails';
import Login from './pages/Login';
import Register from './pages/Register';
import StationProfile from './pages/StationProfile';
import Favorites from './pages/Favorites';
import AdminUsers from './pages/AdminUsers';
import AdminDashboard from './pages/AdminDashboard';
import MyRadios from './pages/MyRadios';
import Genre from './pages/Genre';
import Region from './pages/Region';
import NewPush from './pages/NewPush';
import AdminAds from './pages/AdminAds';
import GoPremium from './pages/GoPremium';
import DSP from './pages/DSP';
import Profile from './pages/Profile';
import MySchedules from './pages/MySchedules';
import Boost from './pages/Boost';
import AdControl from './pages/AdControl';
import AdminAdControl from './pages/AdminAdControl';
import GoBroadcast from './pages/GoBroadcast';
import GoPremiumBroadcast from './pages/GoPremiumBroadcast';
import MyChat from './pages/MyChat';
import BoostStation from './pages/BoostStation';
import AdminBanners from './pages/AdminBanners';
import AdminHomeSlides from './pages/AdminHomeSlides';
import AcceptInvite from './pages/AcceptInvite';
import GoAgency from './pages/GoAgency';
import AgencyDashboard from './pages/AgencyDashboard';
import TermsListeners from './pages/TermsListeners';
import TermsBroadcasters from './pages/TermsBroadcasters';
import TermsAgency from './pages/TermsAgency';
import ResetPassword from './pages/ResetPassword';
import Settings from './pages/Settings'; 
import PressKit from './pages/PressKit';
import PrivacyPolicy from './pages/PrivacyPolicy';

const SmartHomeRoute = ({ currentUser, children }) => {
  const location = useLocation();

  if (location.state?.forceHome) {
    return children;
  }

  if (currentUser?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  if (currentUser?.role === 'agency') {
    return <Navigate to="/agency/dashboard" replace />;
  }

  return children;
};

const GEO_DICTIONARY = {
  // --- ΧΩΡΕΣ ---
  "Ελλάδα": ["GR", "Greece", "Hellas"],
  "Κύπρος": ["CY", "Cyprus"],
  "Εξωτερικό": ["Abroad", "International", "Europe", "America", "US", "USA", "Australia", "AU", "UK", "United Kingdom", "Germany", "France"],

  // --- ΝΟΜΟΙ / ΠΕΡΙΦΕΡΕΙΕΣ (ΕΛΛΑΔΑ) ---
  "Αττική": ["Attica", "Attiki"],
  "Θεσσαλονίκη": ["Thessaloniki", "Central Macedonia", "Thessalonike"],
  "Αιτωλοακαρνανία": ["Aetolia-Acarnania", "Aitoloakarnania", "West Greece"],
  "Αργολίδα": ["Argolis", "Argolida", "Peloponnese"],
  "Αρκαδία": ["Arcadia", "Arkadia", "Peloponnese"],
  "Άρτα": ["Arta", "Epirus"],
  "Αχαΐα": ["Achaea", "Achaia", "West Greece"],
  "Βοιωτία": ["Boeotia", "Voiotia", "Central Greece"],
  "Γρεβενά": ["Grevena", "West Macedonia"],
  "Δράμα": ["Drama", "East Macedonia and Thrace"],
  "Δωδεκάνησα": ["Dodecanese", "South Aegean"],
  "Έβρος": ["Evros", "East Macedonia and Thrace"],
  "Εύβοια": ["Euboea", "Evia", "Central Greece"],
  "Ευρυτανία": ["Evrytania", "Central Greece"],
  "Ζάκυνθος": ["Zakynthos", "Zante", "Ionian Islands"],
  "Ηλεία": ["Elis", "Ilia", "West Greece"],
  "Ημαθία": ["Imathia", "Central Macedonia"],
  "Ηράκλειο": ["Heraklion", "Iraklio", "Crete"],
  "Θεσπρωτία": ["Thesprotia", "Epirus"],
  "Ιωάννινα": ["Ioannina", "Epirus"],
  "Καβάλα": ["Kavala", "East Macedonia and Thrace"],
  "Καρδίτσα": ["Karditsa", "Thessaly"],
  "Καστοριά": ["Kastoria", "West Macedonia"],
  "Κέρκυρα": ["Corfu", "Kerkyra", "Ionian Islands"],
  "Κεφαλληνία": ["Kefalonia", "Cephalonia", "Ionian Islands"],
  "Κιλκίς": ["Kilkis", "Central Macedonia"],
  "Κοζάνη": ["Kozani", "West Macedonia"],
  "Κορινθία": ["Corinthia", "Korinthia", "Peloponnese"],
  "Κυκλάδες": ["Cyclades", "South Aegean"],
  "Λακωνία": ["Laconia", "Lakonia", "Peloponnese"],
  "Λάρισα": ["Larissa", "Thessaly"],
  "Λασίθι": ["Lasithi", "Lasithio", "Crete"],
  "Λέσβος": ["Lesbos", "Lesvos", "North Aegean"],
  "Λευκάδα": ["Lefkada", "Ionian Islands"],
  "Μαγνησία": ["Magnesia", "Magnisia", "Thessaly"],
  "Μεσσηνία": ["Messenia", "Messinia", "Peloponnese"],
  "Ξάνθη": ["Xanthi", "East Macedonia and Thrace"],
  "Πέλλα": ["Pella", "Central Macedonia"],
  "Πιερία": ["Pieria", "Central Macedonia"],
  "Πρέβεζα": ["Preveza", "Epirus"],
  "Ρέθυμνο": ["Rethymno", "Crete"],
  "Ροδόπη": ["Rhodope", "Rodopi", "East Macedonia and Thrace"],
  "Σάμος": ["Samos", "North Aegean"],
  "Σέρρες": ["Serres", "Central Macedonia"],
  "Τρίκαλα": ["Trikala", "Thessaly"],
  "Φθιώτιδα": ["Phthiotis", "Fthiotida", "Central Greece"],
  "Φλώρινα": ["Florina", "West Macedonia"],
  "Φωκίδα": ["Phocis", "Fokida", "Central Greece"],
  "Χαλκιδική": ["Chalkidiki", "Halkidiki", "Central Macedonia"],
  "Χανιά": ["Chania", "Crete"],
  "Χίος": ["Chios", "North Aegean"],

  // --- ΠΟΛΕΙΣ & ΠΡΟΑΣΤΙΑ (ΑΤΤΙΚΗ) ---
  "Αθήνα": ["Athens", "Athina"],
  "Πειραιάς": ["Piraeus", "Pireas"],
  "Νέα Σμύρνη": ["Nea Smyrni"],
  "Καλλιθέα": ["Kallithea"],
  "Παλαιό Φάληρο": ["Palaio Faliro", "Palio Faliro"],
  "Άλιμος": ["Alimos", "Kalamaki"],
  "Ελληνικό": ["Elliniko", "Hellinikon"],
  "Αργυρούπολη": ["Argyroupoli"],
  "Γλυφάδα": ["Glyfada"],
  "Βούλα": ["Voula"],
  "Βουλιαγμένη": ["Vouliagmeni"],
  "Ηλιούπολη": ["Ilioupoli"],
  "Άγιος Δημήτριος": ["Agios Dimitrios", "Brahami"],
  "Ζωγράφου": ["Zografou"],
  "Καισαριανή": ["Kaisariani"],
  "Βύρωνας": ["Vyronas"],
  "Γαλάτσι": ["Galatsi"],
  "Νέα Ιωνία": ["Nea Ionia"],
  "Νέο Ηράκλειο": ["Irakleio", "Neo Irakleio", "Heraklion Athens"],
  "Νέα Φιλαδέλφεια": ["Nea Filadelfeia", "Nea Philadelfeia"],
  "Χαλάνδρι": ["Chalandri", "Halandri"],
  "Μαρούσι": ["Marousi", "Amarousion"],
  "Κηφισιά": ["Kifisia", "Kifissia"],
  "Πεύκη": ["Pefki"],
  "Μελίσσια": ["Melissia"],
  "Βριλήσσια": ["Vrilissia"],
  "Αγία Παρασκευή": ["Agia Paraskevi"],
  "Περιστέρι": ["Peristeri"],
  "Αιγάλεω": ["Egaleo", "Aigaleo"],
  "Χαϊδάρι": ["Haidari", "Chaidari"],
  "Ίλιον": ["Ilion", "Nea Liosia"],
  "Πετρούπολη": ["Petroupoli"],
  "Αγία Βαρβάρα": ["Agia Varvara"],
  "Νίκαια": ["Nikaia", "Nicaea"],
  "Κορυδαλλός": ["Korydallos"],
  "Κερατσίνι": ["Keratsini"],
  "Δραπετσώνα": ["Drapetsona"],
  "Πέραμα": ["Perama"],
  "Σαλαμίνα": ["Salamina", "Salamis"],
  "Ελευσίνα": ["Elefsina", "Eleusis"],
  "Αχαρνές": ["Acharnes", "Menidi"],
  "Παλλήνη": ["Pallini"],
  "Γέρακας": ["Gerakas"],
  "Κορωπί": ["Koropi", "Koropio"],
  "Μαρκόπουλο": ["Markopoulo"],
  "Ραφήνα": ["Rafina"],
  "Λαύριο": ["Lavrio", "Laurium"],

  // --- ΠΟΛΕΙΣ & ΠΡΟΑΣΤΙΑ (ΘΕΣΣΑΛΟΝΙΚΗ) ---
  "Θεσσαλονίκη": ["Thessaloniki", "Thessalonike", "Salonica"],
  "Καλαμαριά": ["Kalamaria"],
  "Εύοσμος": ["Evosmos"],
  "Κορδελιό": ["Kordelio", "Eleftherio-Kordelio"],
  "Αμπελόκηποι": ["Ampelokipoi", "Ambelokipi"],
  "Μενεμένη": ["Menemeni"],
  "Σταυρούπολη": ["Stavroupoli"],
  "Πολίχνη": ["Polichni"],
  "Νεάπολη": ["Neapoli"],
  "Συκιές": ["Sykies"],
  "Πυλαία": ["Pylaia"],
  "Χορτιάτης": ["Chortiatis"],
  "Πανόραμα": ["Panorama"],
  "Θέρμη": ["Thermi"],
  "Ωραιόκαστρο": ["Oraiokastro", "Oreokastro"],
  "Μηχανιώνα": ["Michaniona", "Nea Michaniona"],
  "Περαία": ["Peraia", "Perea"],
  "Σίνδος": ["Sindos"],
  "Χαλάστρα": ["Chalastra"],

  // --- ΠΟΛΕΙΣ & ΠΡΟΑΣΤΙΑ (ΥΠΟΛΟΙΠΗ ΕΛΛΑΔΑ) ---
  "Μεσολόγγι": ["Missolonghi", "Mesolongi"],
  "Αγρίνιο": ["Agrinio"],
  "Ναύπακτος": ["Nafpaktos"],
  "Ναύπλιο": ["Nafplio", "Nafplion"],
  "Άργος": ["Argos"],
  "Τρίπολη": ["Tripoli"],
  "Μεγαλόπολη": ["Megalopoli"],
  "Πάτρα": ["Patras", "Patra"],
  "Αίγιο": ["Aigio", "Egio"],
  "Καλάβρυτα": ["Kalavryta", "Kalavrita"],
  "Λιβαδειά": ["Livadeia", "Levadia"],
  "Θήβα": ["Thebes", "Thiva"],
  "Αράχωβα": ["Arachova"],
  "Γρεβενά": ["Grevena"],
  "Δράμα": ["Drama"],
  "Ρόδος": ["Rhodes", "Rodos"],
  "Κως": ["Kos"],
  "Κάλυμνος": ["Kalymnos"],
  "Κάρπαθος": ["Karpathos"],
  "Αλεξανδρούπολη": ["Alexandroupoli"],
  "Ορεστιάδα": ["Orestiada"],
  "Διδυμότειχο": ["Didymoteicho"],
  "Χαλκίδα": ["Chalcis", "Halkida"],
  "Κάρυστος": ["Karystos"],
  "Καρπενήσι": ["Karpenisi"],
  "Ζάκυνθος": ["Zakynthos", "Zante"],
  "Πύργος": ["Pyrgos"],
  "Αμαλιάδα": ["Amaliada"],
  "Βέροια": ["Veroia", "Veria"],
  "Νάουσα": ["Naousa", "Naoussa"],
  "Αλεξάνδρεια": ["Alexandreia", "Alexandria"],
  "Μοίρες": ["Moires", "Mires"],
  "Χερσόνησος": ["Hersonissos", "Chersonisos"],
  "Ηγουμενίτσα": ["Igoumenitsa"],
  "Μέτσοβο": ["Metsovo"],
  "Καβάλα": ["Kavala"],
  "Καρδίτσα": ["Karditsa"],
  "Καστοριά": ["Kastoria"],
  "Κέρκυρα": ["Corfu", "Kerkyra"],
  "Αργοστόλι": ["Argostoli"],
  "Ληξούρι": ["Lixouri"],
  "Κιλκίς": ["Kilkis"],
  "Κοζάνη": ["Kozani"],
  "Πτολεμαΐδα": ["Ptolemaida"],
  "Κόρινθος": ["Corinth", "Korinthos"],
  "Λουτράκι": ["Loutraki"],
  "Κιάτο": ["Kiato"],
  "Σύρος": ["Syros", "Ermoupoli"],
  "Νάξος": ["Naxos"],
  "Μύκονος": ["Mykonos"],
  "Σαντορίνη": ["Santorini", "Thira"],
  "Πάρος": ["Paros"],
  "Τήνος": ["Tinos"],
  "Μήλος": ["Milos"],
  "Σπάρτη": ["Sparta", "Sparti"],
  "Γύθειο": ["Gytheio", "Gythio"],
  "Ελασσόνα": ["Elassona"],
  "Φάρσαλα": ["Farsala"],
  "Άγιος Νικόλαος": ["Agios Nikolaos"],
  "Ιεράπετρα": ["Ierapetra"],
  "Σητεία": ["Sitia"],
  "Μυτιλήνη": ["Mytilene", "Mytilini"],
  "Λευκάδα": ["Lefkada"],
  "Αλμυρός": ["Almyros"],
  "Καλαμάτα": ["Kalamata"],
  "Μεσσήνη": ["Messini"],
  "Ξάνθη": ["Xanthi"],
  "Έδεσσα": ["Edessa"],
  "Γιαννιτσά": ["Giannitsa"],
  "Κατερίνη": ["Katerini"],
  "Πάργα": ["Parga"],
  "Ρέθυμνο": ["Rethymno"],
  "Κομοτηνή": ["Komotini"],
  "Σάμος": ["Samos"],
  "Σέρρες": ["Serres"],
  "Καλαμπάκα": ["Kalabaka", "Kalampaka"],
  "Λαμία": ["Lamia"],
  "Αμύνταιο": ["Amyntaio"],
  "Άμφισσα": ["Amfissa"],
  "Δελφοί": ["Delphi", "Delfoi"],
  "Πολύγυρος": ["Polygyros"],
  "Νέα Μουδανιά": ["Nea Moudania"],
  "Χαλκιδική": ["Chalkidiki", "Halkidiki"],
  "Κίσσαμος": ["Kissamos"],

  // --- ΚΥΠΡΟΣ ---
  "Λευκωσία": ["Nicosia", "Lefkosia"],
  "Στρόβολος": ["Strovolos"],
  "Λακατάμεια": ["Lakatamia"],
  "Λεμεσός": ["Limassol", "Lemesos"],
  "Λάρνακα": ["Larnaca", "Larnaka"],
  "Πάφος": ["Paphos", "Pafos"],
  "Αμμόχωστος": ["Famagusta", "Ammochostos"],
  "Παραλίμνι": ["Paralimni"],
  "Αγία Νάπα": ["Ayia Napa", "Agia Napa"],
  "Κερύνεια": ["Kyrenia", "Keryneia"],

  // --- ΕΞΩΤΕΡΙΚΟ ---
  "Ευρώπη": ["Europe"],
  "Αμερική": ["America", "United States", "USA", "US"],
  "Αυστραλία": ["Australia", "AU"],
  "Λονδίνο": ["London"],
  "Παρίσι": ["Paris"],
  "Βερολίνο": ["Berlin"],
  "Νέα Υόρκη": ["New York", "NY"],
  "Σικάγο": ["Chicago"],
  "Σίδνεϊ": ["Sydney"],
  "Μελβούρνη": ["Melbourne"]
};

const RequireTerms = ({ currentUser, children }) => {
  if (!currentUser) return children; 
  if (currentUser.role === 'admin') return children;
  if (currentUser.role === 'broadcaster') {
    return currentUser.hasAcceptedCurrentBroadcasterTerms === true
      ? children
      : <Navigate to="/broadcaster-terms" replace />;
  }
  if (currentUser.hasAcceptedTerms) return children;

  if (currentUser.role === 'agency') {
    return <Navigate to="/agency-terms" replace />;
  } else {
    return <Navigate to="/terms" replace />;
  }
};

const checkGeoMatch = (targetGreek, userLoc) => {
  if (!targetGreek || targetGreek === 'All') return true;
  if (!userLoc || !userLoc.city) return true;

  const userLocStrings = [userLoc.city, userLoc.region, userLoc.country, userLoc.countryName]
    .filter(Boolean)
    .map(s => s.toLowerCase());

  const allowedEnglishTerms = GEO_DICTIONARY[targetGreek];
  
  if (allowedEnglishTerms) {
    return allowedEnglishTerms.some(term => userLocStrings.includes(term.toLowerCase()));
  }
  
  return userLocStrings.includes(targetGreek.toLowerCase()); 
};

const MenuActionItem = ({ icon, label, onClick, disabled = false, highlight = false }) => (
  <button 
    onClick={(e) => { onClick(e); }}
    disabled={disabled}
    className={`w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors flex items-center gap-3 group disabled:opacity-40 disabled:cursor-not-allowed
      ${highlight ? 'text-[#ccff00] hover:bg-[#ccff00]/10' : 'text-zinc-300 hover:bg-white/10 hover:text-white'}
    `}
  >
    <div className={`transition-colors ${highlight ? '' : 'text-zinc-400 group-hover:text-white'}`}>
      {icon}
    </div>
    {label}
  </button>
);

// const PROXY_URL = "https://iradios-proxy.sales-926.workers.dev/?url="; 


// const getSmartStreamUrl = (rawUrl) => {
//   if (!rawUrl) return "";
//   return `${PROXY_URL}${encodeURIComponent(rawUrl)}`;
// };

const getSmartStreamUrl = (rawUrl) => {
  if (!rawUrl) return "";
  // 🚀 Χτυπάει πλέον απευθείας το δικό σου backend proxy
  return `/api/proxy-stream?url=${encodeURIComponent(rawUrl)}`;
};

const getLocalDeviceId = () => {
  let id = localStorage.getItem('iluma_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('iluma_device_id', id);
  }
  return id;
};

const getLocalDeviceName = (isCarMode = false) => {
  if (isCarMode) return "Αυτοκίνητο";

  const ua = navigator.userAgent;
  
  let browser = "Web";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("SamsungBrowser")) browser = "Samsung Int.";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";
  else if (ua.includes("Edge") || ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

  let os = "Συσκευή";
  if (/PlayStation 5/i.test(ua)) os = "PS5";
  else if (/PlayStation 4/i.test(ua)) os = "PS4";
  else if (/Nintendo Switch/i.test(ua)) os = "Nintendo Switch";
  else if (/Xbox/i.test(ua)) os = "Xbox";
  else if (/SMART-TV|Tizen|Web0S|WebOS|TV/i.test(ua)) os = "Smart TV";
  else if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac/i.test(ua)) os = "Mac";
  else if (/Windows/i.test(ua)) os = "Windows PC";
  else if (/Linux/i.test(ua)) os = "Linux";

  return `${os} - ${browser}`;
};

function MainApp() {
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const location = useLocation(); 
  const API_URL = `/api`;

  // 🟢 ΕΛΕΓΧΟΣ ΓΙΑ WIDGET
  const isWidget = location.pathname.startsWith('/widget');

  if (isWidget) {
    return (
      // 🟢 ΑΛΛΑΓΗ: Το w-screen έγινε w-full για να "ακούει" το iframe και να μην ξεχειλίζει στα κινητά!
      <div className="w-full h-full bg-transparent"> 
        <Routes>
          <Route path="/widget/:stationId" element={<WidgetPlayer API_URL={API_URL} />} />
          
          {/* 🟢 ΠΡΟΣΘΗΚΗ: Το νέο Route για το "μόνιμο" widget */}
          <Route path="/widget-now/:stationId" element={<WidgetNow API_URL={API_URL} />} />
        </Routes>
      </div>
    );
  }
  

  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  const [weather, setWeather] = useState({ temp: null, city: 'Φόρτωση...', icon: 'Sun' });

  // 2. Πρόσθεσε το useEffect που τραβάει τον καιρό
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const geoData = await geoRes.json();
        const lat = geoData.latitude;
        const lon = geoData.longitude;
        const city = geoData.city || 'Άγνωστο';

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const weatherData = await weatherRes.json();
        const temp = Math.round(weatherData.current_weather.temperature);
        const code = weatherData.current_weather.weathercode;

        let icon = 'Sun';
        if (code >= 1 && code <= 3) icon = 'Cloud'; 
        else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) icon = 'CloudRain'; 
        else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) icon = 'Snowflake'; 

        setWeather({ temp, city, icon });
      } catch (error) {
        console.error("Weather fetch error:", error);
        setWeather(prev => ({ ...prev, temp: '-', icon: 'Cloud' })); 
      }
    };

    fetchWeather();
    const weatherInterval = setInterval(fetchWeather, 600000); // 10 λεπτά
    return () => clearInterval(weatherInterval);
  }, []);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        const data = await res.json();
        const currentVersion = localStorage.getItem('app_version');

        if (currentVersion && data.version !== currentVersion) {
          setShowUpdateBanner(true);
        } else {
          localStorage.setItem('app_version', data.version);
        }
      } catch (e) {}
    };

    const interval = setInterval(checkVersion, 20000);
    checkVersion();

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    fetch(`/version.json?t=${Date.now()}`).then(res => res.json()).then(data => {
      localStorage.setItem('app_version', data.version);
      window.location.reload(true);
    });
  };

  const [isBuffering, setIsBuffering] = useState(false);

  const [currentUser, setCurrentUser] = useState(null); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState('');
  const [volume, setVolume] = useState(0.7);
  const [globalCoverArt, setGlobalCoverArt] = useState(null);

  const [sniperHit, setSniperHit] = useState(null);

  // 🚀 FIX: Καθαρό audio instance που φτιάχνεται μόνο μια φορά
  const silentAudioRef = useRef(null);
  useEffect(() => {
    silentAudioRef.current = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/w==");
    silentAudioRef.current.loop = true;
  }, []);

  useEffect(() => {
    if (isPlaying && silentAudioRef.current) {
      const p = silentAudioRef.current.play();
      if (p !== undefined) p.catch(()=>{});
    } else if (silentAudioRef.current) {
      silentAudioRef.current.pause();
    }
  }, [isPlaying]);
  
  const audioRef = useRef(null); 
  const lastMetaFetch = useRef(0);
  const intendedPlayState = useRef(false);

  const recognitionLock = useRef(false);
  const recognitionTimeout = useRef(null);

  const [showDiscovery, setShowDiscovery] = useState(false);

  const [globalSocket, setGlobalSocket] = useState(null);
  const [userLocation, setUserLocation] = useState({ city: 'Unknown', country: 'Unknown' });

  const [unreadListenerChat, setUnreadListenerChat] = useState(false);
  const [unreadBroadcasterChat, setUnreadBroadcasterChat] = useState(false);

  const [isRecognizing, setIsRecognizing] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState(null);
  
  const [currentStation, setCurrentStation] = useState(() => {
    try {
      const saved = localStorage.getItem('iluma_last_station');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [isCarModeActive, setIsCarModeActive] = useState(false);

  const [userOverrides, setUserOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('iluma_user_dsp_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  const isMobile = useMemo(() => {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const [availableDevices, setAvailableDevices] = useState([]);
  const localDeviceId = useMemo(() => getLocalDeviceId(), []);
  const localDeviceName = useMemo(() => getLocalDeviceName(isCarModeActive), [isCarModeActive]);

  const { 
    stations, searchTerm, setSearchTerm, showSearchResults, setShowSearchResults, 
    filteredSearch, zappingPlaylist, handleUpdateStationDSP, fetchGlobalStations 
  } = useStations(API_URL, currentUser, currentStation, setCurrentStation);

  // 🚀 FIX: Κρατάμε τα stations σε ref για να τα βρίσκουν τα sockets χωρίς να κρασάρουν
  const stationsRef = useRef([]);
  useEffect(() => {
    stationsRef.current = stations || [];
  }, [stations]);

  const {
    ads, isPlayingAd, setIsPlayingAd, currentAdInfo, setCurrentAdInfo,
    adTimeRemaining, setAdTimeRemaining, adWarning, setAdWarning,
    adQueue, adSchedules, stationSwitches, pendingStation, loadGlobalAds
  } = useAdEngine(API_URL);

  const lastPlayedTimeAds = useRef({});

  // 🟢 1. ΨΑΧΝΕΙ ΤΟ ΕΞΩΦΥΛΛΟ ΜΕΣΩ ΤΟΥ PROXY ΜΑΣ (CORS FIX)
  useEffect(() => {
    let isMounted = true;
    const LOADING_MESSAGES = ["Ακούμε τον σταθμό…", "Ψάχνουμε το τραγούδι…", "Λίγο ακόμη…", "Σχεδόν έτοιμο…", "Βρίσκουμε το τραγούδι…", "ΠΑΙΖΕΙ ΤΩΡΑ", ""];
    
    if (!nowPlaying || LOADING_MESSAGES.includes(nowPlaying)) {
      setGlobalCoverArt(null);
      return;
    }

    const fetchCover = async () => {
      try {
        const res = await fetch(`${API_URL}/cover-art?term=${encodeURIComponent(nowPlaying)}`);
        
        if (!res.ok) throw new Error("Backend Proxy Error");
        
        const data = await res.json();
        
        if (data && data.artworkUrl && isMounted) {
          setGlobalCoverArt(data.artworkUrl); 
        } else if (isMounted) {
          setGlobalCoverArt(null); 
        }
      } catch (err) {
        console.error("Cover Fetch Error:", err);
        if (isMounted) setGlobalCoverArt(null); 
      }
    };

    fetchCover();
    return () => { isMounted = false; };
  }, [nowPlaying]);

  const { analyserRef, fadeAudio, resetVolumeToZero, setVolumeToOne, resumeDSP } = useAudioDSP(
    audioRef, currentStation, currentAdInfo, isPlayingAd, isMobile, currentUser, userOverrides, volume
  );

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = parseFloat(volume);
      if (fadeAudio) {
        fadeAudio(parseFloat(volume), 0.1);
      }
    }
  }, [volume, fadeAudio]);

  useEffect(() => {
    // The public stage runs radio playback without the legacy user-sync socket.
    // Those socket events lack resource authorization; skip the connection
    // instead of repeatedly retrying a 403 and flooding browser Network logs.
    const isPublicStage = window.location.hostname === 'stage.iradios.gr';
    const socketUrl = window.location.origin;
    const s = isPublicStage ? null : io(socketUrl, { path: '/api/socket.io' });
    if (s) setGlobalSocket(s);
    
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.city) {
          setUserLocation({ 
            city: data.city, 
            region: data.region, 
            country: data.country_code, 
            countryName: data.country_name 
          });
        }
      })
      .catch(() => {});

    return () => { if (s) s.disconnect(); };
  }, []);

  // ==============================================================
  // 🟢 DEVICE SYNC (SOCKET LOGIC)
  // ==============================================================
  useEffect(() => {
    if (!globalSocket || !currentUser) return;

    const userId = String(currentUser._id || currentUser.id);

    const registerMyDevice = () => {
      if (globalSocket.connected) {
        globalSocket.emit('register_device', {
          userId,
          deviceId: localDeviceId,
          deviceName: localDeviceName
        });
      }
    };

    const handleUpdateDevices = (devices) => {
      const uniqueDevices = Array.from(new Map(devices.map(item => [item.deviceId, item])).values());
      setAvailableDevices(uniqueDevices);

      const amIIncluded = uniqueDevices.some(d => d.deviceId === localDeviceId);
      if (!amIIncluded && globalSocket.connected) {
        registerMyDevice();
      }
    };

    const handlePlayTransfer = async (data) => {
      if (data && data.station) {
        let fullStation = stationsRef.current.find(s => s._id === data.station._id);
        
        // Αν το socket έστειλε "μισό" αρχείο, τράβα το stream από το API!
        if (!fullStation || !fullStation.stream) {
          try {
            const res = await fetch(`${API_URL}/stations/${data.station._id}`);
            if (res.ok) fullStation = await res.json();
          } catch(e) {}
        }
        handleActualStationPlay(fullStation || data.station);
      }
    };

    const handleStopTransfer = () => {
      if (audioRef.current) audioRef.current.pause();
      setIsPlaying(false);
      intendedPlayState.current = false;
    };

    globalSocket.on('update_devices', handleUpdateDevices);
    globalSocket.on('play_transfer', handlePlayTransfer);
    globalSocket.on('stop_transfer', handleStopTransfer);
    
    globalSocket.on('ping_announce', () => {
      registerMyDevice();
    });

    if (globalSocket.connected) registerMyDevice();
    globalSocket.on('connect', registerMyDevice);

    const heartbeat = setInterval(() => {
      if (globalSocket.connected) registerMyDevice();
    }, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (globalSocket) {
          globalSocket.disconnect(); 
          setTimeout(() => {
            globalSocket.connect();  
            registerMyDevice();      
          }, 500);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      globalSocket.off('connect', registerMyDevice);
      globalSocket.off('update_devices', handleUpdateDevices);
      globalSocket.off('play_transfer', handlePlayTransfer);
      globalSocket.off('stop_transfer', handleStopTransfer);
      globalSocket.off('ping_announce');
    };
  }, [globalSocket, currentUser, localDeviceId, localDeviceName]);

  const handleRequestDevices = () => {
    if (globalSocket && currentUser) {
      if (!globalSocket.connected) {
        globalSocket.connect();
        setTimeout(() => {
          globalSocket.emit('request_devices', { userId: String(currentUser._id || currentUser.id) });
        }, 500);
      } else {
        globalSocket.emit('request_devices', { userId: String(currentUser._id || currentUser.id) });
      }
    }
  };

  const activeRemoteDevice = useMemo(() => {
    return availableDevices.find(d => d.isPlaying && d.deviceId !== localDeviceId);
  }, [availableDevices, localDeviceId]);

  // 🚀 ΑΝΤΙΚΑΤΕΣΤΗΣΕ ΑΥΤΟ ΤΟ useEffect:
  useEffect(() => {
    const syncRemoteStation = async () => {
      if (activeRemoteDevice && activeRemoteDevice.station) {
        if (!currentStation || currentStation._id !== activeRemoteDevice.station._id) {
          let fullStation = stations.find(s => s._id === activeRemoteDevice.station._id);
          
          if (!fullStation || !fullStation.stream) {
            try {
              const res = await fetch(`${API_URL}/stations/${activeRemoteDevice.station._id}`);
              if (res.ok) fullStation = await res.json();
            } catch(e) {}
          }
          
          if (fullStation) setCurrentStation(fullStation);
          else setCurrentStation(activeRemoteDevice.station);
        }
      }
    };
    syncRemoteStation();
  }, [activeRemoteDevice, currentStation, stations]);

  const handleTransferPlayback = (targetDeviceId) => {
    if (!globalSocket || !currentUser || !currentStation) return;
    
    globalSocket.emit('transfer_playback', {
      userId: String(currentUser._id || currentUser.id),
      targetDeviceId: targetDeviceId,
      station: currentStation
    });
  };

  useEffect(() => {
    if (!globalSocket) return;
    if (currentStation) {
      globalSocket.emit('join_station', currentStation._id);
    }
    if (currentUser?.role === 'broadcaster' && stations?.length > 0) {
      const myStations = stations.filter(s => s.broadcasterId === currentUser._id || s.broadcasterId === currentUser.id);
      myStations.forEach(st => { globalSocket.emit('join_station', st._id); });
    }
    return () => {
      if (currentStation && currentUser?.role !== 'broadcaster') {
        globalSocket.emit('leave_station', currentStation._id);
      }
    };
  }, [globalSocket, currentStation, currentUser, stations]);

  useEffect(() => {
    if (!globalSocket) return;
    const handleNewMessage = (newMsg) => {
      if (currentStation && newMsg.stationId === currentStation._id) {
        setUnreadListenerChat(true);
      }
      if (currentUser?.role === 'broadcaster' && location.pathname !== '/my-chat') {
        setUnreadBroadcasterChat(true);
      }
    };
    globalSocket.on('receive_message', handleNewMessage);
    return () => globalSocket.off('receive_message', handleNewMessage);
  }, [globalSocket, currentStation, currentUser, location.pathname]);

  useEffect(() => {
    if (globalSocket && currentStation && isPlaying && !isPlayingAd) {
      globalSocket.emit('start_listen', { stationId: currentStation._id, location: userLocation });
    } else if (globalSocket && (!isPlaying || isPlayingAd)) {
      globalSocket.emit('stop_listen');
    }
  }, [globalSocket, currentStation, isPlaying, isPlayingAd, userLocation]);

  useEffect(() => {
    if (!globalSocket || !currentUser?.isPremium) return;

    const handleSniperMatch = (data) => {
      if (currentStation?._id !== data.station._id) {
        setSniperHit(data);
      }
    };

    globalSocket.on('sniper_hit', handleSniperMatch);
    return () => globalSocket.off('sniper_hit', handleSniperMatch);
  }, [globalSocket, currentUser, currentStation]);


  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('iluma_token');
      if (token) {
        try {
          const res = await fetch(`${API_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) { setCurrentUser(await res.json()); } 
          else { localStorage.removeItem('iluma_token'); }
        } catch (err) { console.error("Auth failed", err); }
      }
    };
    initAuth();
  }, []);

  const handleToggleFavorite = async (stationId) => {
    if (!currentUser) return showAlert("Συνδεθείτε για να αποθηκεύσετε αγαπημένα!");
    try {
      const res = await fetch(`${API_URL}/users/${currentUser._id || currentUser.id}/favorites`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stationId })
      });
      if (res.ok) {
        const updatedFavorites = await res.json();
        setCurrentUser(prev => ({ ...prev, favorites: updatedFavorites }));
      }
    } catch (err) { console.error("Favorite toggle failed", err); }
  };

  const isFavorite = (stationId) => currentUser?.favorites?.includes(stationId);

  const handleLogout = () => {
    localStorage.removeItem('iluma_token');
    setCurrentUser(null);
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    intendedPlayState.current = false;
    navigate('/login');
  };

  // ==============================================================
  // 🎵 PLAYER LOGIC - BULLETPROOF SAFARI FIX
  // ==============================================================
  const handleActualStationPlay = async (rawStation) => {
    if (!rawStation || !audioRef.current) return;

    // 🚀 FIX: Βεβαιωνόμαστε ότι έχουμε το ΟΛΟΚΛΗΡΟ αντικείμενο του σταθμού πριν το παίξουμε!
    const station = stationsRef.current.find(s => s._id === rawStation._id) || rawStation;
    if (!station.stream) return;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isXboxOrTV = /Xbox|SMART-TV|Tizen|Web0S|WebOS|TV/.test(ua);
    
    const disableDSP = isIOS || isXboxOrTV;

    if (!disableDSP && typeof resumeDSP === 'function') {
      resumeDSP(); 
    }

    if (silentAudioRef.current) {
      const silentPromise = silentAudioRef.current.play();
      if (silentPromise !== undefined) silentPromise.catch(() => {});
    }

    const rawStreamUrl = station.streamUrl || station.stream;
    const finalStreamUrl = getSmartStreamUrl(rawStreamUrl);

    setCurrentStation(station);
    setIsPlayingAd(false);
    setNowPlaying('');
    intendedPlayState.current = true;

    audioRef.current.src = finalStreamUrl;
    
    try {
      audioRef.current.load(); 
      
      // 🚀 SAFE PLAY: Προστασία από το Autoplay Block του Safari!
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          if (!disableDSP && typeof resumeDSP === 'function') resumeDSP();
          
          if (globalSocket && currentUser) {
            globalSocket.emit('local_play_started', {
              userId: String(currentUser._id || currentUser.id),
              deviceId: localDeviceId,
              station: { _id: station._id, name: station.name, logo: station.logo } // Ελαφρύ Payload για γρήγορο Sync
            });
          }
        }).catch(e => {
          // Το Safari μπλόκαρε τον ήχο επειδή η εντολή ήρθε από το Socket και όχι από το δάχτυλο.
          console.warn("Autoplay blocked by Safari:", e);
          setIsPlaying(false); // Το αφήνουμε paused, απλά πατάει ο χρήστης το κουμπί play στο UI!
        });
      } else {
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("Playback Exception:", e);
    }
  };

  const handleStationSelectWithAds = (station) => {
    if (isPlayingAd || !audioRef.current) return;
    if (currentStation && currentStation._id === station._id && isPlaying) return;
    
    if (currentUser?.isPremium && activeRemoteDevice) {
      globalSocket.emit('transfer_playback', {
        userId: String(currentUser._id || currentUser.id),
        targetDeviceId: activeRemoteDevice.deviceId,
        station: station
      });
      return; 
    }

    if (currentUser?.isPremium) return handleActualStationPlay(station);

    stationSwitches.current += 1;
    const clicks = stationSwitches.current;
    
    // Φιλτράρουμε MONO τα ZAPPING ADS
    const zappingAdsToPlay = ads.filter(ad => {
      let frequencyMatch = false;
      if (ad.frequency === 'entry' && clicks === 1) frequencyMatch = true;
      if (ad.frequency === 'every_5_stations' && clicks % 5 === 0) frequencyMatch = true;
      if (ad.frequency === 'every_10_stations' && clicks % 10 === 0) frequencyMatch = true;
      if (ad.frequency === 'every_15_stations' && clicks % 15 === 0) frequencyMatch = true;
      if (ad.frequency === 'every_20_stations' && clicks % 20 === 0) frequencyMatch = true;
      if (ad.frequency === 'every_30_stations' && clicks % 30 === 0) frequencyMatch = true;
      
      if (!frequencyMatch) return false;

      const targetArea = (ad.targetLocations && ad.targetLocations.length > 0) ? ad.targetLocations[0] : 'All';
      if (!checkGeoMatch(targetArea, userLocation)) return false;

      return ad.isGlobal !== false ? !station.disableNetworkAds : ad.stationId === station._id;
    });

    if (zappingAdsToPlay.length > 0) {
      pendingStation.current = station; 
      adQueue.current = [...zappingAdsToPlay]; // Βάζουμε τα zapping ads στην ουρά
      playNextAdOrStation();
    } else {
      handleActualStationPlay(station);
    }
  };

  const playNextAdOrStation = () => {
    if (!audioRef.current) return;
    if (adQueue.current.length > 0) {
      const nextAd = adQueue.current.shift();
      audioRef.current.src = nextAd.audioUrl;
      audioRef.current.volume = parseFloat(volume);
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
         playPromise.catch((e) => {
            console.warn("Ad background playback prevented:", e);
            playNextAdOrStation(); 
         });
      }
      setCurrentAdInfo(nextAd); 
      setIsPlayingAd(true); setIsPlaying(true);
      intendedPlayState.current = true;
      fetch(`${API_URL}/ads/${nextAd._id}/impression`, { method: 'POST' }).catch(()=>{});
    } else {
      if (pendingStation.current) {
        handleActualStationPlay(pendingStation.current);
        pendingStation.current = null;
      }
    }
  };

  // ==============================================================
  // 🕒 TIME-BASED AD SCHEDULER (Το Ρολόι του iRadios: '15 και '45)
  // ==============================================================
  useEffect(() => {
    const checkClockAds = () => {
      // Αν δεν παίζει σταθμός, αν παίζει ήδη διαφήμιση, αν είναι premium, αγνόησε το
      if (!isPlaying || isPlayingAd || currentUser?.isPremium || !currentStation) return;

      const now = new Date();
      const minutes = now.getMinutes();
      
      // Παίζουμε μόνο στο και 15 ακριβώς ή στο και 45 ακριβώς
      if (minutes !== 15 && minutes !== 45) return;

      // 1. Βρίσκουμε όλα τα Time-Based Ads που ταιριάζουν Γεωγραφικά
      const timeBasedAds = ads.filter(ad => {
        const isTimeBased = [
          'every_1_hour', 'every_2_hours', 'every_6_hours', 
          'once_a_day', 'twice_a_day', 'four_times_a_day', 'once_a_week'
        ].includes(ad.frequency);
        
        if (!isTimeBased) return false;

        const targetArea = (ad.targetLocations && ad.targetLocations.length > 0) ? ad.targetLocations[0] : 'All';
        if (!checkGeoMatch(targetArea, userLocation)) return false;

        return ad.isGlobal !== false ? !currentStation.disableNetworkAds : ad.stationId === currentStation._id;
      });

      if (timeBasedAds.length === 0) return;

      // 2. Φιλτράρουμε ποια πρέπει ΠΡΑΓΜΑΤΙΚΑ να παίξουν τώρα (βάσει frequency rules)
      const currentTime = now.getTime();
      const adsEligibleToPlay = timeBasedAds.filter(ad => {
        const lastPlayed = lastPlayedTimeAds.current[ad._id] || 0;
        const timeSinceLastPlay = currentTime - lastPlayed;
        const hoursSinceLastPlay = timeSinceLastPlay / (1000 * 60 * 60);

        switch (ad.frequency) {
          case 'every_1_hour': return hoursSinceLastPlay >= 1;
          case 'every_2_hours': return hoursSinceLastPlay >= 2;
          case 'every_6_hours': return hoursSinceLastPlay >= 6;
          case 'once_a_day': return hoursSinceLastPlay >= 24;
          case 'twice_a_day': return hoursSinceLastPlay >= 12;
          case 'four_times_a_day': return hoursSinceLastPlay >= 6;
          case 'once_a_week': return hoursSinceLastPlay >= (24 * 7);
          default: return false;
        }
      });

      if (adsEligibleToPlay.length === 0) return;

      // 3. Shuffle (για να μην παίζουν πάντα τα ίδια με την ίδια σειρά)
      const shuffledAds = adsEligibleToPlay.sort(() => 0.5 - Math.random());
      
      // 4. Επιλέγουμε MAX 2 σποτ (Ad Break)
      const selectedAds = shuffledAds.slice(0, 2);

      // 5. Ενημερώνουμε το ιστορικό ότι παίχτηκαν ΤΩΡΑ
      selectedAds.forEach(ad => {
        lastPlayedTimeAds.current[ad._id] = currentTime;
      });

      // 6. ΠΡΟΕΤΟΙΜΑΣΙΑ ΚΑΙ ΕΚΤΕΛΕΣΗ!
      console.log("⏰ Ήρθε η ώρα για διαφημίσεις! Επιλέχθηκαν:", selectedAds.map(a => a.title));
      
      pendingStation.current = currentStation; // Θυμόμαστε ποιον σταθμό ακούγαμε
      adQueue.current = [...selectedAds];      // Βάζουμε τα 2 σποτ στην ουρά
      
      // Σταματάμε το live stream προσωρινά
      if (audioRef.current) audioRef.current.pause(); 
      
      // Ξεκινάμε το Ad Break
      playNextAdOrStation(); 
    };

    // Ελέγχει κάθε 60 δευτερόλεπτα (1 λεπτό) αν η ώρα είναι :15 ή :45
    const clockInterval = setInterval(checkClockAds, 60000);
    
    // Κάνουμε κι έναν έλεγχο τώρα αμέσως (σε περίπτωση που μπήκε ακριβώς στο :15)
    checkClockAds();

    return () => clearInterval(clockInterval);
  }, [isPlaying, isPlayingAd, currentStation, ads, userLocation, currentUser]);

  const handleNextStation = () => {
    if (isPlayingAd || zappingPlaylist.length === 0) return;
    let next;
    if (!currentStation) next = zappingPlaylist[0];
    else {
      const idx = zappingPlaylist.findIndex(s => s._id === currentStation._id);
      next = zappingPlaylist[(idx + 1) % zappingPlaylist.length];
    }

    if (currentUser?.isPremium && activeRemoteDevice) {
      globalSocket.emit('transfer_playback', {
        userId: String(currentUser._id || currentUser.id),
        targetDeviceId: activeRemoteDevice.deviceId,
        station: next
      });
      return; 
    }

    handleStationSelectWithAds(next);
  };

  const handlePrevStation = () => {
    if (isPlayingAd || zappingPlaylist.length === 0) return;
    let prev;
    if (!currentStation) prev = zappingPlaylist[0];
    else {
      const idx = zappingPlaylist.findIndex(s => s._id === currentStation._id);
      prev = zappingPlaylist[idx <= 0 ? zappingPlaylist.length - 1 : idx - 1];
    }

    if (currentUser?.isPremium && activeRemoteDevice) {
      globalSocket.emit('transfer_playback', {
        userId: String(currentUser._id || currentUser.id),
        targetDeviceId: activeRemoteDevice.deviceId,
        station: prev
      });
      return; 
    }

    handleStationSelectWithAds(prev);
  };

  const togglePlayPause = () => {
    if (isPlayingAd || !currentStation || !audioRef.current) return;
    
    if (isPlaying) {
      intendedPlayState.current = false; 
      audioRef.current.pause();
      setIsPlaying(false); 
      
      if (globalSocket && currentUser) {
        globalSocket.emit('local_play_stopped', {
          userId: String(currentUser._id || currentUser.id),
          deviceId: localDeviceId
        });
      }
    } else {
      intendedPlayState.current = true; 
      handleActualStationPlay(currentStation);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault(); 
        togglePlayPause();  
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlayPause]);

  const handleRecognizeTrack = async () => {
      if (!currentUser) {
        showAlert("Συνδέσου στο iRadios για να βρεις ποιο τραγούδι παίζει.");
        navigate('/login');
        return;
      }

      if (isRecognizing || isPlayingAd) return;

      setIsRecognizing(true);
      const previousNowPlaying = nowPlaying;
      
      setNowPlaying("Βρίσκουμε το τραγούδι…");

      const loadingMessages = [
        "Ακούμε τον σταθμό…",
        "Ψάχνουμε το τραγούδι…",
        "Λίγο ακόμη…",
        "Σχεδόν έτοιμο…"
      ];
      let messageIndex = 0;

      const intervalId = setInterval(() => {
        if (messageIndex < loadingMessages.length) {
          setNowPlaying(loadingMessages[messageIndex]);
          messageIndex++;
        }
      }, 4000);

      try {
        const res = await fetch(`${API_URL}/recognize-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('iluma_token') || ''}`
          },
          body: JSON.stringify({ stationId: currentStation._id || currentStation.id, streamUrl: currentStation.stream })
        });

        clearInterval(intervalId);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Η αναγνώριση δεν είναι διαθέσιμη.');

        if (data.status?.msg === 'Success' && data.metadata?.music?.length > 0) {
          const track = data.metadata.music[0];
          const songTitle = `${track.artists[0].name} - ${track.title}`;
          
          setNowPlaying(songTitle);
          
          const sId = track.external_metadata?.spotify?.track?.id;
          
          // 🚀 ΔΙΟΡΘΩΣΗ: Αν έχουμε το ID του τραγουδιού, το ανοίγουμε ΑΠΕΥΘΕΙΑΣ. 
          // Αλλιώς κάνουμε Search ως Fallback. (Μπήκε το $ για το string interpolation)
          if (sId) {
            // Link κατευθείαν στο τραγούδι
            setSpotifyUrl(`https://open.spotify.com/track/${sId}`);
          } else {
            // Link αναζήτησης
            setSpotifyUrl(`https://open.spotify.com/search/${encodeURIComponent(songTitle)}`);
          }

          recognitionLock.current = true;
          if (recognitionTimeout.current) clearTimeout(recognitionTimeout.current);
          
          recognitionTimeout.current = setTimeout(() => { 
            recognitionLock.current = false; 
            setSpotifyUrl(null);
            fetchMetadata(); 
          }, 60000);

        } else {
          setNowPlaying(previousNowPlaying);
          showAlert("Δεν αναγνωρίστηκε κάποιο τραγούδι αυτή τη στιγμή. Ίσως είναι ομιλία ή διαφημίσεις.");
        }
      } catch (err) {
        clearInterval(intervalId);
        console.error("Recognition API error:", err);
        setNowPlaying(previousNowPlaying);
        showAlert("Δεν μπορέσαμε να βρούμε το τραγούδι. Δοκίμασε ξανά σε λίγο.");
      } finally {
        clearInterval(intervalId); 
        setIsRecognizing(false);
      }
  };

  useEffect(() => {
    if (currentStation) localStorage.setItem('iluma_last_station', JSON.stringify(currentStation));
  }, [currentStation]);

  const fetchMetadata = async () => {
  if (!currentStation || !currentUser || isPlayingAd || isRecognizing || recognitionLock.current) return;

  try {
    const res = await fetch(`${API_URL}/metadata?stream=${encodeURIComponent(currentStation.stream)}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('iluma_token') || ''}` }
    });
    const data = await res.json();
    
    if (data && data.title) {
      // Παίρνουμε τον αρχικό τίτλο (βγάζοντας κενά και παύλες στο τέλος)
      const rawTitle = data.title.replace(/-$/, '').trim();
      
      // Τον περνάμε από το πλυντήριο
      const cleanTitle = cleanMetadata(rawTitle);
      
      // Αν το πλυντήριο επιστρέψει κενό, κρατάμε τον rawTitle!
      setNowPlaying(cleanTitle || rawTitle); 
    } else {
      setNowPlaying('');
    }
  } catch (e) { 
    setNowPlaying(''); 
  }

    try {
      const stationId = currentStation._id || currentStation.id;
      const stationRes = await fetch(`${API_URL}/stations`);
      
      if (stationRes.ok) {
        const allStations = await stationRes.json();
        const updatedStation = allStations.find(s => s._id === stationId || s.id === stationId);
        
        if (updatedStation) {
          setCurrentStation(prev => {
            if (updatedStation.dspPreset && updatedStation.dspPreset !== prev.dspPreset) {
              return { ...prev, dspPreset: updatedStation.dspPreset };
            }
            return prev; 
          });
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isPlaying && currentStation && !isPlayingAd && !isRecognizing && !recognitionLock.current) fetchMetadata(); 
    else if (!isRecognizing && !recognitionLock.current) setNowPlaying('');
  }, [currentStation, currentUser, isPlaying, isPlayingAd, isRecognizing]);

  useMediaSession({
    currentStation, nowPlaying, isPlayingAd, currentAdInfo,
    togglePlayPause, handleNextStation, handlePrevStation, globalCoverArt, currentUser
  });

  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (import.meta.env.PROD) {
        if (e.key === 'F12') e.preventDefault();
        if ((e.ctrlKey || e.metaKey) && ['u', 'U', 'θ', 'Θ'].includes(e.key)) e.preventDefault();
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'I', 'ι', 'Ι', 'j', 'J', 'ξ', 'Ξ', 'c', 'C', 'ψ', 'Ψ'].includes(e.key)) {
          e.preventDefault();
        }
        if ((e.ctrlKey || e.metaKey) && ['s', 'S', 'σ', 'Σ'].includes(e.key)) e.preventDefault();
      }
    };

    const handleContextMenu = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault(); 
      const menuWidth = 240;
      const menuHeight = 200;
      let x = e.clientX;
      let y = e.clientY;
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
      setContextMenu({ show: true, x, y });
    };

    const handleClickOutsideMenu = () => {
      if (contextMenu.show) setContextMenu({ show: false, x: 0, y: 0 });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleClickOutsideMenu);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleClickOutsideMenu);
    };
  }, [contextMenu.show]);

  useEffect(() => {
    if (currentStation && isPlaying) {
      handleActualStationPlay(currentStation);
    }
  }, [isCarModeActive]);

  return (
    <div className="h-screen bg-black text-white flex overflow-hidden font-sans antialiased">
      <Helmet>
        {/* Βασικά Meta Tags */}
        <title>Ραδιόφωνο στο iRadios - Το νέο κορυφαίο Radio App!</title>
        <meta 
          name="description" 
          content="Ακούστε Ραδιόφωνα LIVE στο iRadios App. Όλα τα ραδιόφωνα σε μία εφαρμογή. Streaming radio από Αθήνα, Θεσσαλονίκη, Κύπρο και τα κορυφαία Greek Radios είναι εδώ." 
        />
        <meta 
          name="keywords" 
          content="iRadios, ιραδιοσ, ελληνικά ραδιόφωνα, online radio, live radio, web radio, eradio, ακούστε ζωντανά, ελληνική μουσική, έντεχνο, ραδιοφωνικοί σταθμοί, podcasts, ιντερνετικό ραδιόφωνο" 
        />
        <meta name="author" content="iRadios by ILUMA Digital Agency" />
        
        {/* Open Graph / Facebook / Viber */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="__IRADIOS_SITE_ORIGIN__/" />
        <meta property="og:title" content="Ραδιόφωνο στο iRadios - Το νέο κορυφαίο Radio App!" />
        <meta property="og:description" content="Το κορυφαίο Ελληνικό Radio App. Όλοι οι ραδιοφωνικοί σταθμοί σε μία εφαρμογή. Ακούστε live online Ελληνική μουσική, επιτυχίες, έντεχνο και ειδήσεις." />
        <meta property="og:image" content="__IRADIOS_SITE_ORIGIN__/iradios-wall.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name" content="iRadios" />
        
        {/* Twitter Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="__IRADIOS_SITE_ORIGIN__/" />
        <meta name="twitter:title" content="Ραδιόφωνο στο iRadios - Το νέο κορυφαίο Radio App!" />
        <meta name="twitter:description" content="Όλοι οι ραδιοφωνικοί σταθμοί σε μία εφαρμογή. Ακούστε live online Ελληνική μουσική, επιτυχίες και ειδήσεις." />
        <meta name="twitter:image" content="__IRADIOS_SITE_ORIGIN__/iradios-wall.png" />
        
        <link rel="canonical" href={`__IRADIOS_SITE_ORIGIN__${location.pathname}`} />
      </Helmet>

      {contextMenu.show && (() => {
        const isFav = currentStation && currentUser?.favorites?.includes(currentStation._id);

        return (
          <div 
            className="fixed z-[99999] bg-zinc-950/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.9)] overflow-hidden w-64 animate-fade-in flex flex-col"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          >
            <div 
              onClick={() => {
                setContextMenu({ show: false, x: 0, y: 0 });
                if (currentStation) navigate(`/station/${currentStation.slug || currentStation._id}`);
              }}
              className="px-4 py-3 border-b border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors flex items-center gap-3"
            >
              {currentStation ? (
                <>
                  <img src={currentStation.logo} alt="Station Logo" className="w-11 h-11 rounded-xl object-contain bg-white border border-white/10 shadow-lg" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#ccff00] mb-0.5 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-[#ccff00] rounded-full animate-pulse"></div> ΑΚΟΥΣ ΤΩΡΑ
                    </span>
                    <span className="text-white text-sm font-bold truncate">{currentStation.name}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-11 h-11 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/10 shadow-lg">
                    <Music size={20} className="text-zinc-600" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 mb-0.5">IRADIOS</span>
                    <span className="text-white text-sm font-bold truncate">Επιλέξτε Σταθμό</span>
                  </div>
                </>
              )}
            </div>

            <div className="py-2 flex flex-col">
              
              {!currentUser && (
                <>
                  <MenuActionItem icon={<LogIn size={16} />} label="Συνδέσου" onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/login'); }} />
                  <MenuActionItem icon={<UserPlus size={16} />} label="Ξεκίνα Δωρεάν" onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/register'); }} />
                  <MenuActionItem icon={<Megaphone size={16} />} label="Διαφήμιση" onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/go-ads'); }} />
                  <MenuActionItem icon={<FileText size={16} />} label="Όροι Χρήσης" onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/terms'); }} />
                </>
              )}

              {currentUser && !currentUser.isPremium && (
                <>
                  <MenuActionItem 
                    icon={<Heart size={16} className={`transition-colors duration-300 ${isFav ? 'text-[#ccff00] fill-[#ccff00] group-hover:text-red-500 group-hover:fill-red-500' : 'text-white group-hover:text-[#ccff00]'}`} />} 
                    label={isFav ? "Αφαίρεση από Αγαπημένα" : "Προσθήκη στα Αγαπημένα"} 
                    disabled={!currentStation}
                    onClick={() => {
                      if (currentStation) handleToggleFavorite(currentStation._id);
                      setContextMenu({show: false, x: 0, y: 0});
                    }} 
                  />
                  <MenuActionItem icon={<User size={16} />} label="Το προφίλ μου" onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/profile'); }} />
                  <MenuActionItem 
                    icon={<Crown size={16} className="text-[#ccff00]" />} 
                    label="Γίνε Premium" 
                    onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/premium'); }} 
                    highlight={true}
                  />
                  <div className="my-1 border-t border-white/5"></div>
                  <MenuActionItem icon={<Megaphone size={16} />} label="Διαφήμιση" onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/go-ads'); }} />
                  <MenuActionItem icon={<FileText size={16} />} label="Όροι Χρήσης" onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/terms'); }} />
                </>
              )}

              {currentUser && currentUser.isPremium && (
                <>
                  <MenuActionItem 
                    icon={<Heart size={16} className={`transition-colors duration-300 ${isFav ? 'text-[#ccff00] fill-[#ccff00] group-hover:text-red-500 group-hover:fill-red-500' : 'text-white group-hover:text-[#ccff00]'}`} />} 
                    label={isFav ? "Αφαίρεση από Αγαπημένα" : "Προσθήκη στα Αγαπημένα"} 
                    disabled={!currentStation}
                    onClick={() => {
                      if (currentStation) handleToggleFavorite(currentStation._id);
                      setContextMenu({show: false, x: 0, y: 0});
                    }} 
                  />
                  <MenuActionItem icon={<User size={16} />} label="Το προφίλ μου" onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/profile'); }} />
                  <div className="my-1 border-t border-white/5"></div>
                  <MenuActionItem icon={<FileText size={16} />} label="Όροι Χρήσης" onClick={() => { setContextMenu({show: false, x: 0, y: 0}); navigate('/terms'); }} />
                </>
              )}

            </div>
          </div>
        );
      })()}

      {/* 🟢 FLOATING NEON BANNER */}
      {activeRemoteDevice && !isPlaying && (
        <div className="fixed top-[100px] lg:top-auto lg:bottom-[112px] left-0 right-0 flex justify-center z-[120] pointer-events-none animate-in fade-in zoom-in-95 duration-500">
          <button 
            onClick={() => {
              window.dispatchEvent(new Event('minify_player')); 
              
              if (currentUser?.isPremium) {
                handleTransferPlayback(localDeviceId);
              } else {
                navigate('/premium');
              }
            }}
            className="pointer-events-auto bg-[#ccff00] text-black px-4 py-2 lg:px-5 lg:py-2.5 rounded-full shadow-[0_10px_30px_rgba(204,255,0,0.3)] lg:shadow-[0_10px_40px_rgba(204,255,0,0.4)] flex items-center gap-2.5 lg:gap-3 hover:scale-105 active:scale-95 transition-all border border-[#ccff00]/50"
          >
            <MonitorSpeaker className="w-4 h-4 lg:w-5 lg:h-5 animate-pulse" />
            <div className="flex flex-col items-start text-left">
              <span className="text-[8px] lg:text-[9px] font-black tracking-widest opacity-80 leading-none mb-0.5">Τώρα Παίζει στο</span>
              <span className="text-[10px] lg:text-xs font-bold leading-none">{activeRemoteDevice.deviceName}</span>
            </div>
          </button>
        </div>
      )}

      {showUpdateBanner && (
        <div className="fixed top-20 left-3 right-3 md:left-auto md:top-6 md:right-6 z-[9999] animate-slide-in-right md:max-w-max">
          <div className="bg-zinc-950/95 backdrop-blur-2xl border border-[#ccff00]/30 p-2 md:pr-2 rounded-2xl shadow-[0_15px_40px_-10px_rgba(204,255,0,0.25)] flex items-center justify-between gap-2 md:gap-4 overflow-hidden">
            
            <div className="flex items-center gap-2 md:gap-3 pl-1 md:pl-2 min-w-0">
              <div className="relative flex items-center justify-center w-6 h-6 md:w-8 md:h-8 bg-[#ccff00]/10 rounded-full shrink-0 border border-[#ccff00]/30">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ccff00] opacity-20"></span>
                <Zap className="text-[#ccff00] w-3 h-3 md:w-[14px] md:h-[14px]" />
              </div>
              
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-white text-[10px] md:text-[12px] font-black uppercase tracking-wide truncate md:whitespace-nowrap">
                  ΝΕΑ ΕΚΔΟΣΗ IRADIOS
                </span>
                <span className="text-zinc-400 text-[8px] md:text-[10px] font-medium truncate md:whitespace-nowrap">
                  Πατήστε ενημέρωση για το νέο iRadios Player.
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 shrink-0 border-l border-white/10 pl-2 md:pl-3 ml-1">
              <button 
                onClick={handleUpdate}
                className="bg-[#ccff00] text-black px-3 py-1.5 md:px-4 md:py-2 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-[#b3e600] active:scale-95 transition-all flex items-center gap-1 md:gap-2"
              >
                <RefreshCw size={12} className="md:w-[14px] md:h-[14px]" /> 
                <span className="hidden sm:inline">ΕΝΗΜΕΡΩΣΗ</span>
                <span className="sm:hidden">UPDATE</span>
              </button>
              <button 
                onClick={() => setShowUpdateBanner(false)}
                className="p-1.5 md:p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0"
                title="Κλείσιμο"
              >
                <X size={16} />
              </button>
            </div>

          </div>
        </div>
      )}

      {showDiscovery && (
        <RadioDiscovery 
          API_URL={API_URL} 
          onClose={() => setShowDiscovery(false)} 
          onSelectStation={handleStationSelectWithAds}
          userOverrides={userOverrides} 
        />
      )}

      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
        preload="none" 
        playsInline 
        webkit-playsinline="true" 

        onLoadStart={() => setIsBuffering(true)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        
        onEnded={() => { 
          isPlayingAd ? playNextAdOrStation() : handleActualStationPlay(currentStation) 
        }} 

        onTimeUpdate={(e) => {
          if (isPlayingAd) {
            setAdTimeRemaining(Math.ceil(e.target.duration - e.target.currentTime));
          } else if (isPlaying && !isRecognizing && !recognitionLock.current && Date.now() - lastMetaFetch.current > 10000) {
            lastMetaFetch.current = Date.now(); 
            fetchMetadata();
          }
        }}

        onError={(e) => {
          console.warn("⚠️ Το stream του ραδιοφώνου διακόπηκε από τον server του σταθμού:", e);
          // A failed HTTP/stream request must not leave the UI spinning indefinitely.
          setIsBuffering(false);
          setIsPlaying(false);
          if (!isPlayingAd) showAlert("Ο σταθμός δεν ανταποκρίνεται αυτή τη στιγμή. Δοκίμασε έναν άλλο σταθμό.");
        }}
      />

      <Preloader />

      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} currentUser={currentUser} stations={stations} unreadBroadcasterChat={unreadBroadcasterChat} setUnreadBroadcasterChat={setUnreadBroadcasterChat} API_URL={API_URL} />
      
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/20 relative">
        <TopBar setIsMobileMenuOpen={setIsMobileMenuOpen} searchTerm={searchTerm} weather={weather} setSearchTerm={setSearchTerm} showSearchResults={showSearchResults} setShowSearchResults={setShowSearchResults} filteredSearch={filteredSearch} handleSearchResultClick={(id) => { const s = stations.find(x => x._id === id); if (s) handleStationSelectWithAds(s); navigate(`/station/${id}`); }} currentUser={currentUser} onLogout={handleLogout} />
        <div id="main-scroll-area" className="flex-1 overflow-y-auto custom-scrollbar pb-44 lg:pb-32" onClick={() => setShowSearchResults(false)}>
        <ScrollToTop />
          <Routes>
            <Route 
              path="/" 
              element={
                <SmartHomeRoute currentUser={currentUser}>
                  <Home 
                    stations={stations} weather={weather}
                    API_URL={API_URL}
                    currentStation={currentStation} 
                    setCurrentStation={handleStationSelectWithAds} 
                    userLocation={userLocation} 
                    checkGeoMatch={checkGeoMatch} 
                    isPlaying={isPlaying} 
                    onPlayPause={togglePlayPause} 
                    currentUser={currentUser} 
                    analyser={analyserRef.current} 
                    onOpenDiscovery={() => setShowDiscovery(true)} 
                  />
                </SmartHomeRoute>
              } 
            />
            <Route path="/profile" element={currentUser ? <Profile API_URL={API_URL} onLogout={handleLogout} /> : <Navigate to="/login" />} />
            <Route path="/settings" element={<Settings API_URL={API_URL} currentUser={currentUser} />} />
            <Route path="/press-kit" element={<PressKit />} />
            <Route path="/map" element={<MapMode stations={stations} currentStation={currentStation} onPlayStation={handleStationSelectWithAds} isPlaying={isPlaying} onPlayPause={togglePlayPause} />} />

            <Route path="/studio" element={
              <RequireTerms currentUser={currentUser}>
                {currentUser?.role === 'producer' 
                  ? <ProducerStudio currentUser={currentUser} API_URL={API_URL} unreadBroadcasterChat={unreadBroadcasterChat} currentStation={currentStation} isPlaying={isPlaying} analyser={analyserRef.current} /> 
                  : <BroadcasterStudio currentUser={currentUser} API_URL={API_URL} unreadBroadcasterChat={unreadBroadcasterChat} currentStation={currentStation} isPlaying={isPlaying} analyser={analyserRef.current} />
                }
              </RequireTerms>
            } />

            <Route path="/genre/:genreName" element={<Genre stations={stations} currentStation={currentStation} userLocation={userLocation} checkGeoMatch={checkGeoMatch} setCurrentStation={handleStationSelectWithAds} isPlaying={isPlaying} onPlayPause={togglePlayPause} analyser={analyserRef.current} currentUser={currentUser} />} />
            <Route path="/region/:regionName" element={<Region stations={stations} currentStation={currentStation} userLocation={userLocation} checkGeoMatch={checkGeoMatch} setCurrentStation={handleStationSelectWithAds} isPlaying={isPlaying} onPlayPause={togglePlayPause} analyser={analyserRef.current} currentUser={currentUser} />} />
            <Route path="/station/:id" element={<StationProfile stations={stations} API_URL={API_URL} currentStation={currentStation} isPlaying={isPlaying} onPlayPause={togglePlayPause} setCurrentStation={handleStationSelectWithAds} toggleFavorite={handleToggleFavorite} isFavorite={isFavorite} isRecognizing={isRecognizing} handleRecognizeTrack={handleRecognizeTrack} nowPlaying={nowPlaying} analyser={analyserRef.current} currentUser={currentUser} userOverrides={userOverrides} onUserDSPChange={(sid, p) => setUserOverrides(prev => ({...prev, [sid]: p}))} globalCoverArt={globalCoverArt} />} />
            <Route path="/login" element={<Login API_URL={API_URL} setCurrentUser={setCurrentUser} />} />
            <Route path="/register" element={<Register API_URL={API_URL} setCurrentUser={setCurrentUser} />} />
            <Route path="/favorites" element={<Favorites stations={stations} currentUser={currentUser} currentStation={currentStation} setCurrentStation={handleStationSelectWithAds} isPlaying={isPlaying} onPlayPause={togglePlayPause} toggleFavorite={handleToggleFavorite} isFavorite={isFavorite} analyser={analyserRef.current} />} />
            <Route path="/premium" element={<GoPremium API_URL={API_URL} currentUser={currentUser} />} />
            <Route path="/reset-password/:token" element={<ResetPassword API_URL={API_URL} />} />
            <Route path="/broadcast" element={<GoBroadcast API_URL={API_URL} setCurrentUser={setCurrentUser} />} />

            <Route path="/my-radios" element={
              <RequireTerms currentUser={currentUser}>
                {(currentUser?.role === 'broadcaster' || currentUser?.role === 'admin') ? <MyRadios API_URL={API_URL} currentUser={currentUser} /> : <Navigate to="/" />}
              </RequireTerms>
            } />
            <Route path="/my-schedules" element={
              <RequireTerms currentUser={currentUser}>
                {(currentUser?.role === 'broadcaster' || currentUser?.role === 'admin' || currentUser?.role === 'producer') ? <MySchedules API_URL={API_URL} currentUser={currentUser} refreshStations={fetchGlobalStations} /> : <Navigate to="/" />}
              </RequireTerms>
            } />
            <Route path="/dsp" element={
              <RequireTerms currentUser={currentUser}>
                {(currentUser?.role === 'admin' || currentUser?.broadcasterProfile?.features?.dspEngine) ? <DSP API_URL={API_URL} currentUser={currentUser} onUpdateDSP={handleUpdateStationDSP} resumeDSP={resumeDSP} /> : <Navigate to="/" />}
              </RequireTerms>
            } />
            <Route path="/ad-control" element={
              <RequireTerms currentUser={currentUser}>
                {(currentUser?.role === 'admin' || currentUser?.broadcasterProfile?.features?.adControl) ? <AdControl API_URL={API_URL} currentUser={currentUser} /> : <Navigate to="/" />}
              </RequireTerms>
            } />
            <Route path="/upgrade-station" element={
              <RequireTerms currentUser={currentUser}>
                {(currentUser?.role === 'admin' || currentUser?.role === 'broadcaster') ? <GoPremiumBroadcast API_URL={API_URL} currentUser={currentUser} /> : <Navigate to="/" />}
              </RequireTerms>
            } />
            <Route path="/my-chat" element={
              <RequireTerms currentUser={currentUser}>
                {(currentUser?.role === 'admin' || currentUser?.role === 'broadcaster' || currentUser?.role === 'producer') ? <MyChat API_URL={API_URL} currentUser={currentUser} stations={stations} /> : <Navigate to="/" />}
              </RequireTerms>
            } />
            <Route path="/boost-my-station" element={
              <RequireTerms currentUser={currentUser}>
                {(currentUser?.role === 'admin' || currentUser?.role === 'broadcaster') ? <BoostStation API_URL={API_URL} currentUser={currentUser} stations={stations} /> : <Navigate to="/" />}
              </RequireTerms>
            } />

            <Route path="/admin/home-slides" element={currentUser?.role === 'admin' ? <AdminHomeSlides /> : <Navigate to="/" />} />
            <Route path="/admin/banners" element={currentUser?.role === 'admin' ? <AdminBanners /> : <Navigate to="/" />} />
            <Route path="/admin" element={currentUser?.role === 'admin' ? <AdminDashboard API_URL={API_URL}/> : <Navigate to="/" />} />
            <Route path="/admin/radioset" element={currentUser?.role === 'admin' ? <AdminRadioSet API_URL={API_URL} /> : <Navigate to="/" />} />
            <Route path="/admin/radios" element={currentUser?.role === 'admin' ? <Admin API_URL={API_URL} refreshStations={fetchGlobalStations} /> : <Navigate to="/" />} />
            <Route path="/admin/billing" element={currentUser?.role === 'admin' ? <AdminPaid API_URL={API_URL} /> : <Navigate to="/" />} />
            <Route path="/admin/emails" element={currentUser?.role === 'admin' ? <AdminEmails API_URL={API_URL} /> : <Navigate to="/" />} />
            <Route path="/admin/users" element={currentUser?.role === 'admin' ? <AdminUsers API_URL={API_URL} currentUser={currentUser} /> : <Navigate to="/" />} />
            <Route path="/admin/ads" element={currentUser?.role === 'admin' ? <AdminAds API_URL={API_URL} refreshGlobalAds={loadGlobalAds} /> : <Navigate to="/" />} />
            <Route path="/admin/push" element={currentUser?.role === 'admin' ? <NewPush API_URL={API_URL} /> : <Navigate to="/" />} />
            <Route path="/admin/boost" element={currentUser?.role === 'admin' ? <Boost API_URL={API_URL} stations={stations} refreshStations={fetchGlobalStations} /> : <Navigate to="/" />} />
            <Route path="/admin/ad-control" element={currentUser?.role === 'admin' ? <AdminAdControl API_URL={API_URL} /> : <Navigate to="/" />} />

            <Route path="/accept-invite" element={<AcceptInvite API_URL={API_URL} />} />
            <Route path="/go-ads" element={<GoAgency API_URL={API_URL} currentUser={currentUser} setCurrentUser={setCurrentUser} />} />

            <Route path="/agency/dashboard" element={
              <RequireTerms currentUser={currentUser}>
                {currentUser && (currentUser.role === 'agency' || currentUser.role === 'admin') ? (
                  <AgencyDashboard API_URL={API_URL} currentUser={currentUser} />
                ) : (
                  <Navigate to="/go-ads" replace /> 
                )}
              </RequireTerms>
            } />

            <Route path="/terms" element={<TermsListeners API_URL={API_URL} currentUser={currentUser} />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            
            <Route path="/broadcaster-terms" element={(currentUser?.role === 'broadcaster' || currentUser?.role === 'admin') ? <TermsBroadcasters API_URL={API_URL} currentUser={currentUser} /> : <Navigate to="/terms" />} />
            <Route path="/agency-terms" element={<TermsAgency API_URL={API_URL} currentUser={currentUser} />} />
          </Routes>
        </div>

        <MobileNav currentUser={currentUser} onOpenDiscovery={() => setShowDiscovery(true)} />
        
        <MobileMiniPlayer 
          currentStation={currentStation} isPlayingAd={isPlayingAd} currentAdInfo={currentAdInfo}
          adTimeRemaining={adTimeRemaining} adWarning={adWarning} nowPlaying={nowPlaying}
          isPlaying={isPlaying} togglePlayPause={togglePlayPause} isBuffering={isBuffering}
          toggleFavorite={handleToggleFavorite} isFavorite={isFavorite}
          currentUser={currentUser} userOverrides={userOverrides} onUserDSPChange={(sid, p) => setUserOverrides(prev => ({...prev, [sid]: p}))}
          handleNextStation={handleNextStation} handlePrevStation={handlePrevStation}
          unreadListenerChat={unreadListenerChat} setUnreadListenerChat={setUnreadListenerChat}
          isRecognizing={isRecognizing} handleRecognizeTrack={handleRecognizeTrack} spotifyUrl={spotifyUrl}
          onOpenCarMode={() => setIsCarModeActive(true)}
          globalCoverArt={globalCoverArt}
          availableDevices={availableDevices}
          localDeviceId={localDeviceId}
          onTransferPlayback={handleTransferPlayback}
          onRequestDevices={handleRequestDevices}
        />
      </main>

      <Footer 
        currentStation={currentStation} isPlayingAd={isPlayingAd} currentAdInfo={currentAdInfo} isBuffering={isBuffering}    
        adTimeRemaining={adTimeRemaining} adWarning={adWarning} isPlaying={isPlaying} 
        nowPlaying={isPlayingAd ? `Sponsored: ${currentAdInfo?.title}` : nowPlaying} 
        volume={volume} setVolume={setVolume} togglePlayPause={togglePlayPause} 
        toggleFavorite={handleToggleFavorite} isFavorite={isFavorite} 
        handleNextStation={handleNextStation} handlePrevStation={handlePrevStation}  
        currentUser={currentUser} userOverrides={userOverrides} onUserDSPChange={(sid, p) => setUserOverrides(prev => ({...prev, [sid]: p}))}
        unreadListenerChat={unreadListenerChat} setUnreadListenerChat={setUnreadListenerChat}
        isRecognizing={isRecognizing} handleRecognizeTrack={handleRecognizeTrack} spotifyUrl={spotifyUrl}
        globalCoverArt={globalCoverArt}
        availableDevices={availableDevices}
        localDeviceId={localDeviceId}
        onTransferPlayback={handleTransferPlayback}
        onRequestDevices={handleRequestDevices}
      />
      <InstallPrompt />
      <NotificationModal />

      {isCarModeActive && currentStation && (
        <CarMode 
          station={currentStation}
          isPlaying={isPlaying}
          onPlayPause={togglePlayPause}
          onClose={() => setIsCarModeActive(false)}
          nowPlaying={nowPlaying}
          isRecognizing={isRecognizing}
          handleRecognizeTrack={handleRecognizeTrack}
          spotifyUrl={spotifyUrl}
          onNext={handleNextStation}
          onPrev={handlePrevStation}
        />
      )}

      {!isCarModeActive && currentStation && (
        <CarModePrompt 
          isPremium={currentUser?.isPremium} 
          onAccept={() => setIsCarModeActive(true)} 
        />
      )}

      <CookieConsent />
    </div>
  );
}

export default function App() { 
  return (
    <HelmetProvider>
      <Router>
        <AlertProvider>
          <MainApp />
        </AlertProvider>
      </Router>
    </HelmetProvider>
  ); 
}
