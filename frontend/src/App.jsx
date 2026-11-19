import React, { useState, useRef, useEffect, useMemo } from 'react';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { RefreshCw, X, Zap, Heart, Music, User, SlidersHorizontal, ShieldAlert, LogIn, UserPlus, Megaphone, FileText, Crown, MonitorSpeaker } from 'lucide-react';
import io from 'socket.io-client'; 


// --- CUSTOM HOOKS ---
import useAudioDSP from './hooks/useAudioDSP';
import {normalizeListenerMode} from './utils/dspEngine';
import {isDesktopDSPDevice} from './utils/dspDevice';
import useStations from './hooks/useStations';
import useListeningProfile from './hooks/useListeningProfile';
import useAdEngine from './hooks/useAdEngine';
import {geoAllowsAd} from './utils/adPlacements';
import {createPaidTransitionScheduler} from './utils/paidAudioStationTransitions.mjs';
import {stationBreakCandidates,timedBreakCandidates,MAX_AD_BREAK_SPOTS} from './utils/audioAdRules';
import {newAdListenClock,resumeAdListenClock,suspendAdListenClock,sampleAdListenClock,canSkipAd,secondsUntilAdSkip} from './utils/adSkipPolicy';
import useMediaSession from './hooks/useMediaSession';
import usePlayDevices from './hooks/usePlayDevices';
import {findPremiumOwner,remotePremiumPlayback,shouldShowPause,ownerTransportAction,remoteLocationLabel} from './utils/playbackPresentation.mjs';
import DevicePicker from './components/DevicePicker';
import {getAthensClock} from './utils/schedule';
import {resolveLiveShowArtwork,isBroadcastMetadata} from './utils/liveBroadcast';
import {showProducerNow,RDS_INTERVAL_MS} from './utils/rdsPresentation';

// --- CONTEXT ---
import { AlertProvider, useAlert } from './context/AlertContext';

// --- UTILS  ---
import { cleanMetadata } from './utils/cleanMetadata';
import { parseMusicMetadata } from './utils/musicMetadata';

// --- COMPONENTS ---
import Preloader from './components/Preloader';
import LiveUpdatesBridge from './components/LiveUpdatesBridge';
import {subscribeLiveUpdates} from './utils/liveUpdates';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import InstallPrompt from './components/InstallPrompt';
import TopBar from './components/TopBar';
import MobileNav from './components/MobileNav';
import MobileMiniPlayer from './components/MobileMiniPlayer';
import NotificationTicker from './components/NotificationTicker';
import MapMode from './components/MapMode';
import RadioDiscovery from './components/RadioDiscovery'; 
import CarMode from './components/CarMode';
import CarModePrompt from './components/CarModePrompt';
import CookieConsent from './components/CookieConsent';
import PremiumRenewalPopup from './components/PremiumRenewalPopup';
import EmailVerificationBanner from './components/EmailVerificationBanner';
import WinbackTicker from './components/WinbackTicker';
import ScrollToTop from './components/ScrollToTop';
import WidgetPlayer from './components/WidgetPlayer';
import WidgetNow from './components/WidgetNow';
import WidgetEmbedAccess from './components/WidgetEmbedAccess';

// --- PAGES ---
import Home from './pages/Home';
import HomeCategories from './components/HomeCategories';
import BroadcasterStudio from './pages/BroadcasterStudio';
import Backoffice from './pages/Backoffice';
import ProducerStudio from './pages/ProducerStudio';
import Admin from './pages/Admin';
import AdminRadioSet from './pages/AdminRadioSet';
import AdminPaid from './pages/AdminPaid';
import AdminBillingGrants from './pages/AdminBillingGrants';
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
import NewsFeed from './pages/NewsFeed';
import NewsArticle from './pages/NewsArticle';
import AdminNewsFeed from './pages/AdminNewsFeed';
import NewPush from './pages/NewPush';
import AdminAds from './pages/AdminAds';
import GoPremium from './pages/GoPremium';
import SandboxPremium from './pages/SandboxPremium';
import DSP from './pages/DSP';
import Profile from './pages/Profile';
import MySchedules from './pages/MySchedules';
import Boost from './pages/Boost';
import AdControl from './pages/AdControl';
import AdminAdControl from './pages/AdminAdControl';
import GoBroadcast from './pages/GoBroadcast';
import BroadcasterRegister, { BroadcasterPending } from './pages/BroadcasterRegister';
import GoPremiumBroadcast from './pages/GoPremiumBroadcast';
import BoostStation from './pages/BoostStation';
import AdminBanners from './pages/AdminBanners';
import AdminHomeSlides from './pages/AdminHomeSlides';
import AcceptInvite from './pages/AcceptInvite';
import BroadcasterInvitation from './pages/BroadcasterInvitation';
import GoAgency from './pages/GoAgency';
import AgencyDashboard from './pages/AgencyDashboard';
import AgencyAdvertisingV2 from './pages/AgencyAdvertisingV2';
import CampaignEditor from './pages/CampaignEditor';
import TermsListeners from './pages/TermsListeners';
import TermsBroadcasters from './pages/TermsBroadcasters';
import TermsAgency from './pages/TermsAgency';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
// Settings is unified into Profile; /settings remains a safe legacy redirect.
import PressKit from './pages/PressKit';
import PrivacyPolicy from './pages/PrivacyPolicy';
import CookiePolicy from './pages/CookiePolicy';
import PaymentMethods from './pages/PaymentMethods';

const SmartHomeRoute = ({ currentUser, children }) => {
  const location = useLocation();

  if (location.state?.forceHome) {
    return children;
  }

  if (currentUser?.role === 'admin') {
    return <Navigate to="/backoffice" replace />;
  }
  if (currentUser?.role === 'agency') {
    return <Navigate to="/backoffice" replace />;
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

  // Remember the user's previous safe iRadios page within this browser tab.
  // The Gateway NEVER receives or trusts this return destination.
  useEffect(() => {
    const path=location.pathname;
    if(path==='/premium' || path==='/login' || path==='/register' ||
       path.startsWith('/backoffice') || path.startsWith('/widget'))return;
    const full=path+location.search;
    if(full.length>512 || !full.startsWith('/') || full.startsWith('//'))return;
    try{sessionStorage.setItem('iradios-billing-origin',
      JSON.stringify({path:full,at:Date.now()}));}catch{}
  },[location.pathname,location.search]);

  // Confirmation stays attached to the same-tab navigation after the hosted payment round trip.
  useEffect(() => {
    if(location.state?.billingCompleted===true){
      showAlert('Η πληρωμή επιβεβαιώθηκε και το Premium ενεργοποιήθηκε.');
      navigate(location.pathname+location.search,{replace:true,state:null});
    }
  },[location.state,location.pathname,location.search,navigate,showAlert]);

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
        setWeather(prev => ({ ...prev, city: prev.city === 'Φόρτωση...' ? 'Ελλάδα' : prev.city, temp: null, icon: 'Cloud' })); 
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
  const [authReady, setAuthReady] = useState(false); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState('');
  const [nowPlayingInfo,setNowPlayingInfo] = useState({source:'none',foundWithAI:false});
  const [volume, setVolume] = useState(0.7);
  const [coverArtState, setCoverArtState] = useState(null);

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
  // Actual radio source on this device (never the remote UI selection).
  const playbackStationIdRef=useRef(''); 
  const lastMetaFetch = useRef(0);
  const metadataRequest = useRef(0);
  const lastStationRefresh=useRef(0);
  const intendedPlayState = useRef(false);
  const premiumAuthorizationPendingRef=useRef(false);
  const playbackIntentRef=useRef(0);
  // A full app launch is one listening session. Persisted stations do not
  // consume First Play; background/foreground navigation does not reset it.
  const firstPlayStartedRef=useRef(false);

  // Admin's independent DSP audition must not be mixed with the global
  // listener player's audio when entering the full-page editor.
  useEffect(()=>{
    if(location.pathname!=='/dsp'&&location.pathname!=='/backoffice/admin/audio'&&
       location.pathname!=='/backoffice/audio-preview')return;
    intendedPlayState.current=false;
    if(audioRef.current&&!audioRef.current.paused)audioRef.current.pause();
    setIsPlaying(false);
  },[location.pathname]);

  const recognitionLock = useRef(false);
  const recognitionTimeout = useRef(null);

  const [showDiscovery, setShowDiscovery] = useState(false);
  // Incrementing request makes Home's welcome CTA open the existing header search.
  const [openSmartSearchRequest, setOpenSmartSearchRequest] = useState(0);

  const [globalSocket, setGlobalSocket] = useState(null);
  const [userLocation, setUserLocation] = useState({ city: 'Unknown', country: 'Unknown' });

  const [isRecognizing, setIsRecognizing] = useState(false);
  // A Spotify track ID must belong to the CURRENT recognized song, not to
  // a previous station or an older AI match.
  const [spotifyMatch,setSpotifyMatch] = useState(null);
  const spotifyUrl=spotifyMatch?.raw===nowPlaying?spotifyMatch.url:null;
  
  const [currentStation, setCurrentStation] = useState(() => {
    try {
      const saved = localStorage.getItem('iluma_last_station');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const activeStationIdRef=useRef('');
  activeStationIdRef.current=String(currentStation?._id||currentStation?.id||'');
  // Artwork belongs to a specific station AND song, never to the previous track.
  const globalCoverArt=coverArtState?.stationId===activeStationIdRef.current &&
    coverArtState?.track===nowPlaying?coverArtState.url:null;

  const [isCarModeActive, setIsCarModeActive] = useState(false);

  // Personal DSP is one listening preference across ALL stations. Keep it
  // local to each Premium account/browser; never persist it in Station docs.
  const premiumAccountId=currentUser?.isPremium===true?
    String(currentUser?._id||currentUser?.id||''):'';
  const [listenerDSPByAccount,setListenerDSPByAccount]=useState({accountId:'',mode:'DEFAULT'});
  const listenerDspMode=listenerDSPByAccount.accountId===premiumAccountId?
    listenerDSPByAccount.mode:'DEFAULT';
  useEffect(()=>{
    if(!premiumAccountId){setListenerDSPByAccount({accountId:'',mode:'DEFAULT'});return;}
    let mode='DEFAULT';
    try{
      const key='iluma_listener_dsp_v3:'+premiumAccountId;
      const stored=localStorage.getItem(key);
      if(stored!==null){
        mode=normalizeListenerMode(stored);
      }else{
        // Upgrade the restored station's v2 preference once to an account-wide
        // mode. Other station preferences remain untouched in the old key.
        const old=JSON.parse(localStorage.getItem('iluma_listener_dsp_v2:'+premiumAccountId)||'{}');
        const restored=JSON.parse(localStorage.getItem('iluma_last_station')||'null');
        const stationId=String(restored?._id||restored?.id||'');
        if(old&&typeof old==='object'&&!Array.isArray(old))
          mode=normalizeListenerMode(old[stationId]);
        localStorage.setItem(key,mode);
      }
    }catch{/* Private browsing may prevent storage; current session still works. */}
    setListenerDSPByAccount({accountId:premiumAccountId,mode});
  },[premiumAccountId]);
  const changeUserDSP=(_stationId,mode)=>{
    if(!premiumAccountId)return;
    const choice=normalizeListenerMode(mode);
    setListenerDSPByAccount({accountId:premiumAccountId,mode:choice});
    try{localStorage.setItem('iluma_listener_dsp_v3:'+premiumAccountId,choice);}catch{}
  };

  const isMobile = useMemo(() => {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const [devicesOpen,setDevicesOpen]=useState(false);
  const deviceCallbacksRef=useRef({});
  const {availableDevices,localDeviceId,connected:devicesConnected,
    requestDevices,acquirePlayback,startedPlayback,releasePlayback,
    transferPlayback,renameDevice,forgetDevice,controlPlayback,
    reportPlaybackBlocked}=usePlayDevices({
      currentUser,
      onRemotePlay:stationId=>deviceCallbacksRef.current.play?.(stationId),
      onRemoteStop:()=>deviceCallbacksRef.current.stop?.(),
      onRemotePause:()=>deviceCallbacksRef.current.pause?.(),
      onRemoteResume:stationId=>deviceCallbacksRef.current.resume?.(stationId),
      onRemoteStation:(stationId,shouldPlay)=>deviceCallbacksRef.current.station?.(stationId,shouldPlay)
    });
  const localDeviceName = useMemo(() => getLocalDeviceName(isCarModeActive), [isCarModeActive]);

  const { 
    stations, searchTerm, setSearchTerm, showSearchResults, setShowSearchResults, 
    filteredSearch, zappingPlaylist, handleUpdateStationDSP, fetchGlobalStations 
  } = useStations(API_URL, currentUser, currentStation, setCurrentStation);

  // A station may be marked offline while a listener is already tuned in.
  // Stop the player on the next catalog refresh; do not start new ads or streams.
  useEffect(() => {
    if(!currentStation?._id || !stations.length)return;
    const updated=stations.find(s=>String(s._id)===String(currentStation._id));
    if(updated?.isOffline !== true || currentStation.isOffline === true)return;
    audioRef.current?.pause();
    intendedPlayState.current=false;
    setIsPlaying(false);
    setCurrentStation(updated);
  }, [stations,currentStation?._id,currentStation?.isOffline]);

  // Keep the active player's displayed station name, logo and schedule in
  // sync with admin edits. No stream src/load/play change is made here.
  useEffect(()=>{
    if(!currentStation?._id || !stations.length)return;
    const updated=stations.find(station=>String(station._id)===String(currentStation._id));
    if(!updated)return;
    const visibleFields=['name','logo','slogan','description','genre','secondaryGenre',
      'secondaryGenres','city','region','position','rankings','schedule',
      'scheduleDayBase','isFeatured','status','isOffline'];
    setCurrentStation(previous=>{
      if(!previous||String(previous._id)!==String(updated._id))return previous;
      if(!visibleFields.some(field=>
        JSON.stringify(previous[field])!==JSON.stringify(updated[field])))return previous;
      const patch=Object.fromEntries(visibleFields.map(field=>[field,updated[field]]));
      return {...previous,...patch};
    });
  },[stations,currentStation?._id]);

  // Radio show artwork follows the latest station schedule, not an outdated
  // station object persisted before the last daily XML sync.
  const metadataStation=useMemo(()=>stations.find(item=>
    String(item._id)===String(currentStation?._id))||currentStation,[stations,currentStation]);
  const [broadcastClock,setBroadcastClock]=useState(()=>getAthensClock());
  useEffect(()=>{
    const refresh=()=>setBroadcastClock(getAthensClock());
    const timer=setInterval(refresh,30000);
    const onVisible=()=>{if(!document.hidden)refresh();};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
  },[]);
  const liveBroadcast=useMemo(()=>resolveLiveShowArtwork({
    station:metadataStation,nowPlaying,nowPlayingInfo,clock:broadcastClock
  }),[metadataStation,nowPlaying,nowPlayingInfo?.broadcastHint,
    broadcastClock.day,broadcastClock.minute]);
  // The shared ticker changes React state only at 20-second boundaries,
  // including when a suspended browser returns to the foreground.
  const [rdsSlot,setRdsSlot]=useState(()=>Math.floor(Date.now()/RDS_INTERVAL_MS));
  useEffect(()=>{
    const refresh=()=>{
      const slot=Math.floor(Date.now()/RDS_INTERVAL_MS);
      setRdsSlot(previous=>previous===slot?previous:slot);
    };
    const timer=setInterval(refresh,1000);
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('pageshow',refresh);
    return()=>{
      clearInterval(timer);
      document.removeEventListener('visibilitychange',refresh);
      window.removeEventListener('pageshow',refresh);
    };
  },[]);
  const rdsAt=rdsSlot*RDS_INTERVAL_MS;
  const rdsShowProducer=showProducerNow({currentUser,
    stationName:metadataStation?.name,nowPlaying,liveBroadcast,at:rdsAt});
  // 🚀 FIX: Κρατάμε τα stations σε ref για να τα βρίσκουν τα sockets χωρίς να κρασάρουν
  const stationsRef = useRef([]);
  useEffect(() => {
    stationsRef.current = stations || [];
  }, [stations]);

  const {
    ads, adsReady, isPlayingAd, setIsPlayingAd, currentAdInfo, setCurrentAdInfo,
    adTimeRemaining, setAdTimeRemaining, adWarning, setAdWarning,
    adQueue, adSchedules, stationSwitches, pendingStation, loadGlobalAds
  } = useAdEngine(API_URL);

  // Personal recommendations use real audible radio time (never audio ads),
  // keeping guests local and syncing authenticated listeners per device.
  const {listeningProfile,recordCategorySelection}=useListeningProfile({
    API_URL,currentUser,currentStation,isPlaying,isBuffering,isPlayingAd,audioRef
  });

  const lastPlayedTimeAds = useRef({});
  const adFallbackRef=useRef([]);
  const timedBreakBucketRef=useRef('');
  const stationTransitionRef=useRef(Promise.resolve(null));
  const stationSelectionIntentRef=useRef(0);
  const paidTransitionSchedulerRef=useRef(null);
  if(!paidTransitionSchedulerRef.current){
    paidTransitionSchedulerRef.current=createPaidTransitionScheduler({
      onFailure:({status,reason})=>console.warn('[ADS] Transition unavailable',
        {status,reason})
    });
  }
  const canReceiveAudioAds=()=>currentUser?.isPremium!==true;
  const canReceivePaidAds=()=>!currentUser||
    (currentUser.role==='user'&&currentUser.isPremium!==true);
  const paidAdHeaders=()=>{const token=currentUser?.role==='user'&&
    currentUser.isPremium!==true?localStorage.getItem('iluma_token'):null;
    return token?
    {'Content-Type':'application/json',Authorization:'Bearer '+token}:
    {'Content-Type':'application/json'};};
  const registerStationTransition=(station,intent)=>{
    const request=paidTransitionSchedulerRef.current.register({
      stationId:String(station._id),
      isCurrent:()=>stationSelectionIntentRef.current===intent,
      request:async({stationId,sessionToken})=>{
        const response=await fetch('/api/advertising/v2/transition',{
          method:'POST',headers:paidAdHeaders(),
          body:JSON.stringify({stationId,sessionToken})
        });
        const retryAfter=response.headers.get('Retry-After');
        return {ok:response.ok,status:response.status,
          retryAfterMs:/^\d+$/.test(retryAfter||'')?Number(retryAfter)*1000:null,
          data:await response.json().catch(()=>({}))};
      }
    });
    stationTransitionRef.current=request;
    return request;
  };
  const reportPaidAudio=(ad,audio,force=false)=>{
    if(!ad?.ticketCapability||!audio)return Promise.resolve(null);
    const now=performance.now();
    if(!force&&ad.lastHeartbeatMs&&now-ad.lastHeartbeatMs<800)
      return ad.heartbeatPromise||Promise.resolve(null);
    const report={positionMs:Math.max(0,Math.round(audio.currentTime*1000)),
     playing:!audio.paused||force,foreground:document.visibilityState==='visible',
     seeking:audio.seeking,muted:audio.muted||audio.volume<=0};
    ad.lastHeartbeatMs=now;
    // Server-side CAS requires chronological evidence. Serialize network
    // heartbeats so late responses cannot reorder progress/qualify a seek.
    const previous=ad.heartbeatPromise||Promise.resolve();
    const request=previous.catch(()=>null).then(()=>
      fetch('/api/advertising/v2/heartbeat',{
        method:'POST',headers:paidAdHeaders(),body:JSON.stringify({
          capability:ad.ticketCapability,report})
      }).catch(()=>null));
    ad.heartbeatPromise=request;
    return request;
  };
  const releasePaidAudio=(ad,reason='finished')=>{
    if(!ad?.ticketCapability||ad.releaseRequested)return;
    ad.releaseRequested=true;
    // Do not race wallet release ahead of the last heard 10s/completion
    // heartbeat. Failed requests still release; expiry also sweeps holds.
    void (ad.heartbeatPromise||Promise.resolve()).catch(()=>null).then(()=>
      fetch('/api/advertising/v2/release',{method:'POST',
        headers:paidAdHeaders(),keepalive:true,
        body:JSON.stringify({capability:ad.ticketCapability,reason})})
    ).catch(()=>{});
  };
  const activeAdRef = useRef(null);
  const adListenClockRef = useRef(newAdListenClock());
  const adBreakSpotCountRef = useRef(0);
  const [adSkipCountdown,setAdSkipCountdown] = useState(null);
  const resetAdSkipClock=()=>{
    adListenClockRef.current=newAdListenClock();
    adBreakSpotCountRef.current=0;
    setAdSkipCountdown(null);
  };
  const recoverUnplayedSlot=()=>{
    const replacement=adFallbackRef.current.shift();
    if(replacement)adQueue.current.push(replacement);
    else adBreakSpotCountRef.current=Math.max(1,adBreakSpotCountRef.current-1);
  };
  const logAdOutcome=(event,ad)=>{
    if(!ad?.id||!ad.started||ad.outcomeLogged)return;
    ad.outcomeLogged=true;
    fetch(`${API_URL}/ads/${ad.id}/${event}`,{method:'POST',keepalive:true}).catch(()=>{});
  };
  const adWatchdogRef = useRef(null);
  const clearAdWatchdog = () => {
    if (adWatchdogRef.current) clearTimeout(adWatchdogRef.current);
    adWatchdogRef.current = null;
  };
  useEffect(() => () => clearTimeout(adWatchdogRef.current), []);

  // Fetch artwork only for a verified track, and bind the response to the
  // exact station/song so a previous cover cannot leak into the iOS lock screen.
  useEffect(() => {
    const stationId=String(currentStation?._id||currentStation?.id||'');
    const song=parseMusicMetadata(nowPlaying,currentStation?.name);
    if(!stationId||!song||!currentUser||!isPlaying||isPlayingAd){
      setCoverArtState(null);
      return;
    }
    let active=true;
    const controller=new AbortController();
    const fetchCover=async()=>{
      try{
        const res=await fetch(`${API_URL}/cover-art?term=${encodeURIComponent(song.raw)}`,{
          signal:controller.signal
        });
        if(!res.ok)throw new Error('Cover lookup failed');
        const data=await res.json();
        let url=null;
        if(typeof data?.artworkUrl==='string'&&data.artworkUrl.trim()){
          try{
            const parsed=new URL(data.artworkUrl);
            if(parsed.protocol==='https:')url=parsed.href;
          }catch{ /* malformed artwork */ }
        }
        if(active)setCoverArtState({stationId,track:nowPlaying,url});
      }catch(error){
        if(active && error?.name!=='AbortError'){
          setCoverArtState({stationId,track:nowPlaying,url:null});
        }
      }
    };
    fetchCover();
    return ()=>{active=false;controller.abort();};
  },[nowPlaying,currentStation?._id,currentStation?.id,currentStation?.name,
    currentUser?._id,isPlaying,isPlayingAd]);

  const { analyserRef, fadeAudio, resetVolumeToZero, setVolumeToOne, resumeDSP } = useAudioDSP(
    audioRef, currentStation, currentAdInfo, isPlayingAd, currentUser, listenerDspMode
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
    // Legacy unauthenticated Socket.IO is disabled on both public environments.
    // Device pairing uses its separately authenticated /api/connect.io channel.
    const useLegacySocket = import.meta.env.VITE_LEGACY_SOCKET_ENABLED === 'true' && window.location.hostname === 'play.iradios.gr';
    const socketUrl = window.location.origin;
    const s = useLegacySocket ? io(socketUrl, { path: '/api/socket.io' }) : null;
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

  // iRadios Connect: persistent devices + JWT-authenticated playback leases.
  // The legacy public-stage Socket.IO endpoint is intentionally never used.
  const handleRequestDevices=()=>requestDevices();
  const premiumSync=Boolean(currentUser?.role==='user'&&currentUser?.isPremium===true);
  const playbackOwner=useMemo(()=>
    findPremiumOwner(availableDevices,premiumSync),[premiumSync,availableDevices]);
  const activeRemoteDevice=playbackOwner?.deviceId!==localDeviceId?playbackOwner:null;
  const remotePlayback=remotePremiumPlayback(playbackOwner,localDeviceId);
  const displayIsPlaying=shouldShowPause(isPlaying,remotePlayback);
  const handlePlaybackControl=async(action,stationId)=>{
    const result=await controlPlayback(action,stationId);
    if(!result.ok)showAlert('Ο συγχρονισμός αναπαραγωγής απέτυχε. Άνοιξε τις Συσκευές για έλεγχο.');
    return result;
  };
  // Every Premium controller shows the owner's station. This updates artwork,
  // labels and playback buttons without starting audio on the viewer.
  useEffect(()=>{
    const remoteId=String(activeRemoteDevice?.stationId||'');
    if(!remoteId||remoteId===String(currentStation?._id||''))return;
    let cancelled=false;
    const load=async()=>{
      let station=stationsRef.current.find(s=>String(s._id)===remoteId);
      if(!station){
        try{
          const response=await fetch(`${API_URL}/stations/${encodeURIComponent(remoteId)}`);
          if(response.ok)station=await response.json();
        }catch{/* The station list may still be loading. */}
      }
      if(cancelled||!station||String(station._id)!==remoteId)return;
      setCurrentStation(station);
      setNowPlaying('');
      setNowPlayingInfo({source:'none',foundWithAI:false});
      setCoverArtState(null);
    };
    void load();
    return()=>{cancelled=true;};
  },[activeRemoteDevice?.stationId,currentStation?._id,stations,API_URL]);
  const handleTransferPlayback=async targetDeviceId=>{
    // A handoff must carry the station actually playing on the owner, not
    // a potentially stale station selection cached on this controller.
    const stationId=String((premiumSync&&playbackOwner?.stationId)||
      currentStation?._id||activeRemoteDevice?.stationId||'');
    if(!stationId){showAlert('Επίλεξε πρώτα έναν σταθμό.');return {ok:false,error:'NO_STATION'};}
    const result=await transferPlayback(targetDeviceId,stationId);
    if(!result.ok)showAlert('Δεν ολοκληρώθηκε η μεταφορά αναπαραγωγής.');
    return result;
  };

  // The stage Socket.IO gateway is intentionally closed to public traffic.
  // Report only an anonymous, ephemeral heartbeat while the real audio element
  // is actually playing. No station URL, token, user ID or music data is sent.
  useEffect(()=>{
    if(window.location.hostname!=='stage.iradios.gr')return;
    const stationId=String(currentStation?._id||'');
    if(!/^[a-f0-9]{24}$/i.test(stationId)||!isPlaying||isPlayingAd||
       isBuffering||!audioRef.current||audioRef.current.readyState<2)return;
    if(!crypto?.randomUUID)return;
    const sessionId=crypto.randomUUID();
    const report=playing=>{
      fetch(`${API_URL}/listen/heartbeat`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({stationId,sessionId,playing}),keepalive:true
      }).catch(()=>{});
    };
    report(true);
    const timer=setInterval(()=>{if(!audioRef.current?.paused)report(true);},60000);
    return ()=>{clearInterval(timer);report(false);};
  },[API_URL,currentStation?._id,isPlaying,isBuffering,isPlayingAd]);

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
      setAuthReady(true);
    };
    initAuth();
  }, []);

  // Entitlement expiry is enforced by the backend on every access.
  // Refresh the listener-facing projection after checkout and periodically
  // so an expired paid/grace window is not left displayed as Premium.
  useEffect(() => {
    if(!['stage.iradios.gr','play.iradios.gr'].includes(window.location.hostname) || !authReady ||
      !currentUser || currentUser.role!=='user')return;
    let stopped=false;
    const refresh=async()=>{
      const token=localStorage.getItem('iluma_token');
      if(!token)return;
      try{
        const res=await fetch(`${API_URL}/auth/me`,{
          headers:{Authorization:`Bearer ${token}`},cache:'no-store'
        });
        if(res.ok){const data=await res.json();if(!stopped)setCurrentUser(data);}
      }catch{/* The next focus/poll will retry. */}
    };
    const interval=setInterval(refresh,60000);
    window.addEventListener('focus',refresh);
    const unsubscribe=subscribeLiveUpdates('backoffice',refresh);
    return()=>{stopped=true;clearInterval(interval);window.removeEventListener('focus',refresh);unsubscribe();};
  },[authReady,currentUser?._id,currentUser?.role]);

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

  // A plan upgrade while a guest/Free stream is already playing must
  // immediately claim the single Premium slot (no unleased playback).
  const previousPremiumRef=useRef(false);
  useEffect(()=>{
    const premium=Boolean(currentUser?.role==='user'&&currentUser?.isPremium===true);
    const wasPremium=previousPremiumRef.current;
    previousPremiumRef.current=premium;
    if(!wasPremium&&premium&&isPlaying&&!isPlayingAd&&currentStation?._id){
      void acquirePlayback(String(currentStation._id)).then(ok=>{
        if(ok)void startedPlayback(String(currentStation._id));
        else deviceCallbacksRef.current.stop?.();
      });
    }else if(wasPremium&&!premium)releasePlayback();
  },[currentUser?.role,currentUser?.isPremium]);

  const handleLogout = () => {
    localStorage.removeItem('iluma_token');
    setCurrentUser(null);
    playbackIntentRef.current++;
    premiumAuthorizationPendingRef.current=false;
    if (audioRef.current) audioRef.current.pause();
    releasePlayback();
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
    if (!station.stream || station.isOffline === true) return;

    // Also cover restored-station Play, Car Mode and any other direct call.
    // First Play must pass through the ad gate before starting the stream.
    if (!firstPlayStartedRef.current && canReceiveAudioAds()) {
      handleStationSelectWithAds(station);
      return;
    }
    firstPlayStartedRef.current=true;

    const disableDSP = !isDesktopDSPDevice();

    if (!disableDSP && typeof resumeDSP === 'function') {
      resumeDSP(); 
    }

    if (silentAudioRef.current) {
      const silentPromise = silentAudioRef.current.play();
      if (silentPromise !== undefined) silentPromise.catch(() => {});
    }

    // User-activated playback must unlock the SAME audio element synchronously
    // on Safari/iOS before the asynchronous Premium entitlement round-trip.
    // Only silent PCM is played before the account grants a station lease.
    const intent=++playbackIntentRef.current;
    const premiumClaim=Boolean(currentUser?.role==='user'&&currentUser?.isPremium===true);
    premiumAuthorizationPendingRef.current=premiumClaim;
    if(premiumClaim && audioRef.current.paused){
      audioRef.current.src='data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/w==';
      try{audioRef.current.play()?.catch(()=>{});}catch{/* Remote autoplay can be blocked. */}
    }
    if(!await acquirePlayback(String(station._id))){
      if(playbackIntentRef.current===intent){
        premiumAuthorizationPendingRef.current=false;
        audioRef.current.pause();
        intendedPlayState.current=false;
        setIsPlaying(false);
        showAlert('Η συσκευή δεν μπόρεσε να αποκτήσει δικαίωμα αναπαραγωγής. Έλεγξε τη σύνδεση iRadios Connect.');
      }
      return;
    }
    if(playbackIntentRef.current!==intent)return;
    premiumAuthorizationPendingRef.current=false;
    const rawStreamUrl = station.streamUrl || station.stream;
    const finalStreamUrl = getSmartStreamUrl(rawStreamUrl);

    setCurrentStation(station);
    resetAdSkipClock();
    clearAdWatchdog();
    activeAdRef.current = null;
    setIsPlayingAd(false);
    setCurrentAdInfo(null);
    setAdTimeRemaining(0);
    setNowPlaying('');
    setNowPlayingInfo({source:'none',foundWithAI:false});
    setSpotifyMatch(null);
    intendedPlayState.current = true;

    playbackStationIdRef.current=String(station._id);
    audioRef.current.src = finalStreamUrl;
    
    try {
      audioRef.current.load(); 
      
      // 🚀 SAFE PLAY: Προστασία από το Autoplay Block του Safari!
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if(playbackIntentRef.current!==intent)return;
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
          if(playbackIntentRef.current!==intent)return;
          // A remote-controlled Safari/iOS target may require a local Play tap.
          console.warn("Autoplay blocked by Safari:", e);
          reportPlaybackBlocked();
          setIsPlaying(false);
          setIsBuffering(false);
        });
      } else {
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("Playback Exception:", e);
    }
  };

  // These callbacks deliberately share the *same* audio element as all players.
  deviceCallbacksRef.current.stop=()=>{
    playbackIntentRef.current++;
    premiumAuthorizationPendingRef.current=false;
    intendedPlayState.current=false;
    if(audioRef.current&&!audioRef.current.paused)audioRef.current.pause();
    if(silentAudioRef.current)silentAudioRef.current.pause();
    setIsPlaying(false);setIsBuffering(false);
  };
  deviceCallbacksRef.current.pause=()=>{
    // A pause is NOT a transfer and must retain the Premium lease.
    playbackIntentRef.current++;
    premiumAuthorizationPendingRef.current=false;
    intendedPlayState.current=false;
    if(audioRef.current&&!audioRef.current.paused)audioRef.current.pause();
    if(silentAudioRef.current)silentAudioRef.current.pause();
    setIsPlaying(false);setIsBuffering(false);
  };
  deviceCallbacksRef.current.resume=stationId=>{
    const media=audioRef.current;
    if(!media)return;
    if(String(playbackStationIdRef.current)!==String(stationId)||!media.currentSrc||
      String(media.currentSrc).startsWith('data:')){
      deviceCallbacksRef.current.play?.(stationId);
      return;
    }
    intendedPlayState.current=true;
    try{
      const result=media.play();
      if(result)void result.then(()=>setIsPlaying(true)).catch(()=>{
        reportPlaybackBlocked();
        setIsPlaying(false);setIsBuffering(false);
      });
      else setIsPlaying(true);
    }catch{
      reportPlaybackBlocked();setIsPlaying(false);setIsBuffering(false);
    }
  };
  deviceCallbacksRef.current.station=async(stationId,shouldPlay)=>{
    if(shouldPlay){
      deviceCallbacksRef.current.play?.(stationId);
    }else{
      deviceCallbacksRef.current.pause?.();
      const station=stationsRef.current.find(s=>String(s._id)===String(stationId));
      if(station)setCurrentStation(station);
    }
  };
  deviceCallbacksRef.current.play=async stationId=>{
    let station=stationsRef.current.find(s=>String(s._id)===String(stationId));
    if(!station?.stream){
      try{
        const response=await fetch(`${API_URL}/stations/${encodeURIComponent(stationId)}`);
        if(response.ok)station=await response.json();
      }catch{/* Device may need to retry after reconnecting. */}
    }
    if(station?.stream){
      if(currentUser?.role==='user'&&currentUser?.isPremium===true)
        void handleActualStationPlay(station);
      else if(currentStation?._id===station._id&&isPlaying)void startedPlayback(String(station._id));
      else handleStationSelectWithAds(station);
    }
  };

  const handleStationSelectWithAds = (station) => {
    if(!station||station.isOffline===true||
       stationsRef.current.find(s=>String(s._id)===String(station._id))?.isOffline===true)return;
    if(!audioRef.current)return;
    if(isPlayingAd||activeAdRef.current){pendingStation.current=station;return;}
    if(currentStation&&currentStation._id===station._id&&isPlaying)return;
    if(premiumSync&&activeRemoteDevice){
      void handlePlaybackControl('station',String(station._id));
      return;
    }
    if(!canReceiveAudioAds()){
      firstPlayStartedRef.current=true;
      return handleActualStationPlay(station);
    }
    firstPlayStartedRef.current=true;
    const intent=++stationSelectionIntentRef.current;
    // Desktop WebAudio must be unlocked from the original user gesture.
    if(isDesktopDSPDevice())resumeDSP();
    const select=(available,count,verified)=>{
      if(stationSelectionIntentRef.current!==intent)return;
      stationSwitches.current=count;
      const pool=stationBreakCandidates(available,count,station,userLocation,checkGeoMatch)
        .filter(ad=>ad.paidDeliveryRequired!==true||(verified&&canReceivePaidAds()));
      const selected=pool.slice(0,MAX_AD_BREAK_SPOTS);
      adFallbackRef.current=pool.slice(MAX_AD_BREAK_SPOTS);
      if(selected.length){
        resetAdSkipClock();
        adBreakSpotCountRef.current=selected.length;
        pendingStation.current=station;
        adQueue.current=selected;
        playNextAdOrStation();
      }else void handleActualStationPlay(station);
    };
    const transition=canReceivePaidAds()?registerStationTransition(station,intent):Promise.resolve(null);
    // Existing nonbillable Admin spots retain synchronous click playback.
    if(adsReady&&(!canReceivePaidAds()||!ads.some(ad=>ad.paidDeliveryRequired===true))){
      const next=stationSwitches.current+1;
      select(ads,next,false);
      void transition.then(result=>{
        if(result)stationSwitches.current=Math.max(stationSwitches.current,result.count);
      });
      return;
    }
    // First Play waits for the first ad feed. Billable placements use only
    // the server's authoritative count/proof; failed transitions cannot bill.
    const feed=adsReady?Promise.resolve(ads):loadGlobalAds();
    void Promise.all([transition,feed]).then(([verified,latestAds])=>{
      if(stationSelectionIntentRef.current!==intent)return;
      const count=verified?.count||stationSwitches.current+1;
      select(Array.isArray(latestAds)?latestAds:ads,count,Boolean(verified));
    }).catch(error=>{
      console.warn('[ADS] Selection recovery',error?.name||'network');
      if(stationSelectionIntentRef.current===intent)void handleActualStationPlay(station);
    });
  };
  const skipCurrentAd=()=>{
    const ad=activeAdRef.current;
    const audio=audioRef.current;
    if(!ad||!audio||!canSkipAd(adListenClockRef.current,
      audio.duration,adBreakSpotCountRef.current,ad.nonSkippable))return;
    // Only skippable inventory is discarded. Higher-budget protected spots
    // retain their scheduled position and can never be bypassed by Skip.
    adQueue.current=adQueue.current.filter(item=>item.nonSkippable);
    adFallbackRef.current=[];
    if(ad.ticketCapability)releasePaidAudio(ad,'skipped');
    else logAdOutcome('skipped',ad);
    playNextAdOrStation();
  };

  const playNextAdOrStation=()=>{
    if(!audioRef.current)return;
    adListenClockRef.current=suspendAdListenClock(adListenClockRef.current);
    setAdSkipCountdown(null);
    clearAdWatchdog();
    activeAdRef.current=null;
    if(adQueue.current.length>0){
      const nextAd=adQueue.current.shift();
      if(!nextAd?.audioUrl)return playNextAdOrStation();
      const token=Symbol('ad-play');
      const record={token,id:nextAd._id,started:false,
        selectedPlacement:nextAd.selectedPlacement,timed:nextAd.timed===true,
        nonSkippable:nextAd.nonSkippable===true};
      activeAdRef.current=record;
      setCurrentAdInfo(nextAd);
      setIsPlayingAd(true);
      setIsPlaying(true);
      setAdTimeRemaining(0);
      intendedPlayState.current=true;
      const prepare=async()=>{
        let mediaUrl=nextAd.audioUrl;
        if(nextAd.paidDeliveryRequired){
          let result=null;
          try{
            const stationId=String(pendingStation.current?._id||
              currentStation?._id||'');
            const selectedPlacement=nextAd.selectedPlacement||nextAd.frequency;
            const switching=['entry','every_5_stations','every_10_stations',
              'every_20_stations','every_30_stations'].includes(selectedPlacement);
            const transition=switching?await stationTransitionRef.current.catch(()=>null):null;
            const transitionProof=switching&&String(transition?.stationId)===stationId?
              transition.proof:null;
            if(switching&&!transitionProof)throw Error('Verified station switch is unavailable');
            const response=await fetch('/api/advertising/v2/tickets',{
              method:'POST',headers:paidAdHeaders(),
              body:JSON.stringify({creativeId:nextAd._id,kind:'audio',
                placement:selectedPlacement,stationId,transitionProof})
            });
            if(response.ok)result=await response.json();
            else{
              const body=await response.json().catch(()=>({}));
              console.warn('[ADS] Ticket rejected',{
                status:response.status,
                reason:String(body.error||'unknown').slice(0,160)
              });
            }
          }catch(error){
            console.warn('[ADS] Ticket preparation failed',
              {reason:String(error?.message||'network').slice(0,160)});
          }
          if(!result?.capability){
            if(activeAdRef.current?.token===token){recoverUnplayedSlot();playNextAdOrStation();}
            return;
          }
          record.ticketCapability=result.capability;
          record.nonSkippable=result.nonSkippable===true;
          setCurrentAdInfo({...nextAd,ticketCapability:result.capability,
            nonSkippable:record.nonSkippable});
          mediaUrl+=((mediaUrl.includes('?'))?'&':'?')+
            'ticket='+encodeURIComponent(result.capability);
        }
        if(activeAdRef.current?.token!==token){
          releasePaidAudio(record,'canceled');return;
        }
        const audio=audioRef.current;
        if(isDesktopDSPDevice())resumeDSP();
        audio.src=mediaUrl;
        audio.volume=parseFloat(volume);
        audio.load();
        adWatchdogRef.current=setTimeout(()=>{
          if(activeAdRef.current?.token===token){
            releasePaidAudio(record,'failed');recoverUnplayedSlot();playNextAdOrStation();
          }
        },20000);
        try{
          const attempt=audio.play();
          if(attempt&&typeof attempt.catch==='function')
            attempt.catch(error=>{
              console.warn('[ADS] Spot playback failed; restoring station',error);
              if(activeAdRef.current?.token===token){
                releasePaidAudio(record,'failed');recoverUnplayedSlot();playNextAdOrStation();
              }
            });
        }catch{
          if(activeAdRef.current?.token===token){
            releasePaidAudio(record,'failed');recoverUnplayedSlot();playNextAdOrStation();
          }
        }
      };
      void prepare();
      return;
    }
    resetAdSkipClock();
    adFallbackRef.current=[];
    setIsPlayingAd(false);
    setCurrentAdInfo(null);
    setAdTimeRemaining(0);
    if(pendingStation.current){
      const station=pendingStation.current;
      pendingStation.current=null;
      handleActualStationPlay(station);
    }else if(currentStation)handleActualStationPlay(currentStation);
  };

  // ==============================================================
  // 🕒 TIME-BASED AD SCHEDULER (Το Ρολόι του iRadios: '15 και '45)
  // ==============================================================
  useEffect(() => {
    const checkClockAds = () => {
      // Αν δεν παίζει σταθμός, αν παίζει ήδη διαφήμιση, αν είναι premium, αγνόησε το
      if (!isPlaying || isPlayingAd || !canReceiveAudioAds() || !currentStation) return;

      const now = new Date();
      const minutes = now.getMinutes();
      
      // Παίζουμε μόνο στο και 15 ακριβώς ή στο και 45 ακριβώς
      if (minutes !== 15 && minutes !== 45) return;

      const bucket=now.toISOString().slice(0,16);
      if(timedBreakBucketRef.current===bucket)return;
      const pool=timedBreakCandidates(ads,currentStation,userLocation,
        checkGeoMatch,lastPlayedTimeAds.current,now.getTime())
        .filter(ad=>ad.paidDeliveryRequired!==true||canReceivePaidAds())
        .map(ad=>({...ad,timed:true}));
      const selectedAds=pool.slice(0,MAX_AD_BREAK_SPOTS);
      if(!selectedAds.length)return;
      timedBreakBucketRef.current=bucket;
      adFallbackRef.current=pool.slice(MAX_AD_BREAK_SPOTS);
      resetAdSkipClock();
      adBreakSpotCountRef.current=selectedAds.length;
      pendingStation.current=currentStation;
      adQueue.current=[...selectedAds];
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

  // Optional random station browsing. Keep one shared player/audio engine.
  const [stationShuffle, setStationShuffle] = useState(false);
  const shuffleHistoryRef = useRef([]);

  const handleNextStation = () => {
    if (isPlayingAd || zappingPlaylist.length === 0) return;
    let next;
    if (stationShuffle && zappingPlaylist.length > 1) {
      const options = zappingPlaylist.filter(s => s._id !== currentStation?._id);
      next = options[Math.floor(Math.random() * options.length)];
      if (currentStation?._id) {
        shuffleHistoryRef.current = [...shuffleHistoryRef.current.slice(-19), currentStation._id];
      }
    } else if (!currentStation) next = zappingPlaylist[0];
    else {
      const idx = zappingPlaylist.findIndex(s => s._id === currentStation._id);
      next = zappingPlaylist[(idx + 1) % zappingPlaylist.length];
    }

    handleStationSelectWithAds(next);
  };

  const handlePrevStation = () => {
    if (isPlayingAd || zappingPlaylist.length === 0) return;
    let prev;
    if (stationShuffle && shuffleHistoryRef.current.length) {
      const previousId = shuffleHistoryRef.current.pop();
      prev = zappingPlaylist.find(s => s._id === previousId);
    }
    if (!prev && !currentStation) prev = zappingPlaylist[0];
    else if (!prev) {
      const idx = zappingPlaylist.findIndex(s => s._id === currentStation._id);
      prev = zappingPlaylist[idx <= 0 ? zappingPlaylist.length - 1 : idx - 1];
    }

    handleStationSelectWithAds(prev);
  };

  const togglePlayPause = () => {
    if (isPlayingAd || !currentStation || !audioRef.current) return;
    if(!isPlaying && (currentStation.isOffline === true || stationsRef.current.find(s=>String(s._id)===String(currentStation._id))?.isOffline === true))return;

    // Play/Pause acts on the actual Premium playback owner, even when this
    // screen has no audio. An explicit Transfer is the ONLY way to move audio.
    if(premiumSync&&(playbackOwner||isPlaying)){
      const action=playbackOwner?ownerTransportAction(playbackOwner):'pause';
      void handlePlaybackControl(action).then(result=>{
        // A Premium player must never continue locally after losing the server
        // control channel or the exclusive playback authorization.
        if(!result.ok&&isPlaying)deviceCallbacksRef.current.stop?.();
      });
      return;
    }
    if (isPlaying) {
      intendedPlayState.current = false;
      audioRef.current.pause();
      releasePlayback();
      setIsPlaying(false);
    } else {
      intendedPlayState.current = true;
      // A saved station must NOT bypass First Play when a new session begins.
      if (!firstPlayStartedRef.current && canReceiveAudioAds())
        handleStationSelectWithAds(currentStation);
      else
        void handleActualStationPlay(currentStation);
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

      if (!(currentUser.role==='admin'||currentUser.isPremium===true||currentUser?.broadcasterProfile?.tier==='premium')) {
        showAlert('Το AI Music Discovery είναι προνόμιο του Premium.');
        navigate('/premium');return;
      }
      if (isRecognizing || isPlayingAd) return;

      // Invalidate older requests so they cannot overwrite a fresh AI match.
      metadataRequest.current += 1;
      setIsRecognizing(true);
      const previousNowPlaying = nowPlaying;
      const previousInfo=nowPlayingInfo;
      const recognizingStationId=String(currentStation?._id||currentStation?.id||'');
      
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
          // The backend uses the approved station's stored stream, never a client URL.
          body: JSON.stringify({stationId: currentStation._id || currentStation.id})
        });

        clearInterval(intervalId);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          // Only known, non-sensitive codes are exposed to listeners.
          const messages = {
            ACR_DISABLED: 'Η αναγνώριση δεν έχει ενεργοποιηθεί ακόμη.',
            ACR_CONFIG: 'Η αναγνώριση δεν είναι ακόμη έτοιμη.',
            ACR_AUTH: 'Δεν μπορέσαμε να συνδεθούμε με την αναγνώριση μουσικής.',
            ACR_QUOTA: 'Η υπηρεσία αναγνώρισης έχει φτάσει το όριό της. Δοκίμασε αργότερα.',
            ACR_RATE_LIMIT: 'Δοκίμασε ξανά σε 15 λεπτά.',
            ACR_PROVIDER: 'Η υπηρεσία ACRCloud δεν είναι διαθέσιμη αυτή τη στιγμή.',
            ACR_TIMEOUT: 'Το ACRCloud άργησε να απαντήσει. Δοκίμασε ξανά.',
            ACR_RESPONSE: 'Το ACRCloud δεν επέστρεψε έγκυρο αποτέλεσμα.',
            ACR_TRACK_FILTERED: 'Το τραγούδι βρέθηκε αλλά δεν είχε έγκυρα στοιχεία.',
            ACR_STORAGE: 'Το τραγούδι βρέθηκε αλλά δεν αποθηκεύτηκε στην κοινή playlist.',
            STREAM_UNAVAILABLE: 'Δεν μπορέσαμε να ακούσουμε τον σταθμό. Δοκίμασε ξανά σε λίγο.',
            STREAM_FORMAT: 'Αυτός ο σταθμός δεν υποστηρίζει ακόμη την αναγνώριση.',
            STREAM_SHORT: 'Δεν ακούστηκε αρκετή μουσική. Δοκίμασε ξανά σε λίγο.',
            STATION_INVALID: 'Επίλεξε έναν σταθμό.',
            STATION_MISSING: 'Ο σταθμός δεν βρέθηκε.',
            AUTH_REQUIRED: 'Συνδέσου ξανά στο iRadios για να βρεις το τραγούδι.',
            PREMIUM_REQUIRED: 'Αναβάθμισε σε Premium για την αναγνώριση τραγουδιών με AI.'
          };
          const message=messages[data?.code] ||
            (res.status===401?'Συνδέσου ξανά στο iRadios.':
              res.status===429?'Δοκίμασε ξανά αργότερα.':
              'Η αναγνώριση δεν είναι διαθέσιμη αυτή τη στιγμή.');
          throw new Error(message);
        }

        const music = data?.metadata?.music;
        const track = Array.isArray(music) ? music[0] : null;
        const artist = track?.artists?.find(a => typeof a?.name==='string' && a.name.trim())?.name;
        if (Number(data?.status?.code)===0 && track?.title && artist) {
          const songTitle = `${artist} - ${track.title}`;
          
          if(activeStationIdRef.current!==recognizingStationId)return;
          setNowPlaying(songTitle);
          setNowPlayingInfo({source:'acrcloud',foundWithAI:true,
            recognizedAt:data?.recognizedAt,expiresAt:data?.expiresAt});
          
          const sId = track.external_metadata?.spotify?.track?.id;
          
          // 🚀 ΔΙΟΡΘΩΣΗ: Αν έχουμε το ID του τραγουδιού, το ανοίγουμε ΑΠΕΥΘΕΙΑΣ. 
          // Αλλιώς κάνουμε Search ως Fallback. (Μπήκε το $ για το string interpolation)
          if(typeof sId==='string'&&/^[A-Za-z0-9]{22}$/.test(sId)){
            setSpotifyMatch({raw:songTitle,url:`https://open.spotify.com/track/${sId}`});
          }else{
            setSpotifyMatch(null); // validated native/AI songs use safe Spotify search fallback
          }

          // The server publishes this result for FOUR minutes to every listener.
          // A local lock is unnecessary and would hide subsequent shared updates.
          recognitionLock.current=false;
          if(recognitionTimeout.current)clearTimeout(recognitionTimeout.current);
          const expiresAt=Date.parse(data?.expiresAt||'');
          recognitionTimeout.current=setTimeout(()=>{
            setSpotifyMatch(null);
            if(activeStationIdRef.current===recognizingStationId)fetchMetadata();
          },Number.isFinite(expiresAt)?
            Math.max(0,expiresAt-Date.now()+100):4*60*1000);

        } else {
          if(activeStationIdRef.current===recognizingStationId){
            setNowPlaying(previousNowPlaying);
            setNowPlayingInfo(previousInfo);
          }
          showAlert("Δεν αναγνωρίστηκε τραγούδι αυτή τη στιγμή. Ίσως παίζει ομιλία ή διαφήμιση.");
        }
      } catch (err) {
        clearInterval(intervalId);
        // No secrets, stream URLs or upstream response bodies are printed.
        console.warn("Song recognition unavailable");
        if(activeStationIdRef.current===recognizingStationId){
          setNowPlaying(previousNowPlaying);
          setNowPlayingInfo(previousInfo);
        }
        showAlert(err?.message || "Δεν μπορέσαμε να βρούμε το τραγούδι. Δοκίμασε ξανά σε λίγο.");
      } finally {
        clearInterval(intervalId); 
        setIsRecognizing(false);
      }
  };

  useEffect(() => {
    if (currentStation) localStorage.setItem('iluma_last_station', JSON.stringify(currentStation));
  }, [currentStation]);

  const fetchMetadata=async()=>{
    if(!currentStation?._id||!currentUser||isPlayingAd||isRecognizing||recognitionLock.current)return;
    const stationId=String(currentStation._id);
    const requestId=++metadataRequest.current;
    const matches=()=>activeStationIdRef.current===stationId && metadataRequest.current===requestId;
    try{
      const res=await fetch(`${API_URL}/metadata?stationId=${encodeURIComponent(stationId)}`,{
        headers:{Authorization:`Bearer ${localStorage.getItem('iluma_token')||''}`}
      });
      if(!res.ok)throw new Error('Music data unavailable');
      const data=await res.json();
      if(!matches())return;
      const title=typeof data?.title==='string'?data.title.trim():'';
      setNowPlaying(title?cleanMetadata(title):'');
      setNowPlayingInfo({source:data?.source==='acrcloud'?'acrcloud':title?'station':'none',
        foundWithAI:Boolean(title&&data?.foundWithAI),
        premiumOnly:data?.premiumOnly===true,
        expiresAt:data?.expiresAt,
        recognizedAt:data?.source==='acrcloud'?data.recognizedAt:undefined,
        broadcastHint:typeof data?.broadcastHint==='string'?data.broadcastHint:
          isBroadcastMetadata(title,currentStation.name)?title:''});
    }catch{
      // Keep the last confirmed UI title on a transient network failure.
      // The server's native snapshot will expire if validation stops.
    }

    // Avoid refetching the entire station catalog with every 10-second audio event.
    if(!matches()||Date.now()-lastStationRefresh.current<5*60*1000)return;
    lastStationRefresh.current=Date.now();
    try{
      const response=await fetch(`${API_URL}/stations`);
      if(!response.ok)return;
      const available=await response.json();
      const updated=Array.isArray(available)?available.find(x=>String(x._id)===stationId):null;
      if(updated&&matches()){
        setCurrentStation(prev=>prev&&String(prev._id)===stationId&&
          updated.dspPreset && updated.dspPreset!==prev.dspPreset
          ? {...prev,dspPreset:updated.dspPreset} : prev);
      }
    }catch{ /* a station settings refresh must never interrupt playback */ }
  };

  useEffect(() => {
    if (isPlaying && currentStation && !isPlayingAd && !isRecognizing && !recognitionLock.current) fetchMetadata(); 
    else if (!isRecognizing && !recognitionLock.current) {setNowPlaying('');setNowPlayingInfo({source:'none',foundWithAI:false});}
  }, [currentStation, currentUser, isPlaying, isPlayingAd, isRecognizing]);

  // Live streams do not always fire timeupdate (especially in iOS Safari).
  // Poll independently so another listener's AI match reaches this player.
  useEffect(()=>{
    if(!currentStation?._id||!currentUser||!isPlaying||isPlayingAd||isRecognizing)return;
    const timer=setInterval(()=>{if(!recognitionLock.current)fetchMetadata();},30000);
    return ()=>clearInterval(timer);
  },[currentStation?._id,currentUser?._id,isPlaying,isPlayingAd,isRecognizing]);

  // Every listener uses the server's absolute four-minute deadline, including
  // when the player is left open without new stream timeupdate events.
  useEffect(()=>{
    if(nowPlayingInfo?.source!=='acrcloud'||!nowPlayingInfo?.expiresAt||
      !currentStation?._id||!isPlaying||isPlayingAd||isRecognizing)return;
    const expiry=Date.parse(nowPlayingInfo.expiresAt);
    if(!Number.isFinite(expiry))return;
    const stationId=String(currentStation._id);
    const timer=setTimeout(()=>{
      if(activeStationIdRef.current===stationId)void fetchMetadata();
    },Math.max(0,expiry-Date.now()+100));
    return ()=>clearTimeout(timer);
  },[nowPlayingInfo?.source,nowPlayingInfo?.expiresAt,currentStation?._id,
    currentUser?._id,isPlaying,isPlayingAd,isRecognizing]);

  useMediaSession({
    currentStation:metadataStation, nowPlaying, nowPlayingInfo, isPlaying, isPlayingAd, currentAdInfo,
    togglePlayPause, handleNextStation, handlePrevStation, globalCoverArt, currentUser,
    liveBroadcast, rdsShowProducer
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
      {location.pathname === '/' && <Helmet>
        <title>iRadios — Ελληνικό ραδιόφωνο live online</title>
        <meta name="description" content="Άκου ζωντανά ελληνικούς και διαδικτυακούς ραδιοφωνικούς σταθμούς. Βρες μουσική, ενημέρωση και το πρόγραμμα των αγαπημένων σου σταθμών στο iRadios." />
        <link rel="canonical" href="__IRADIOS_SITE_ORIGIN__/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="iRadios" />
        <meta property="og:title" content="iRadios — Ελληνικό ραδιόφωνο live online" />
        <meta property="og:description" content="Άκου ζωντανά ελληνικούς και διαδικτυακούς ραδιοφωνικούς σταθμούς στο iRadios." />
        <meta property="og:image" content="__IRADIOS_SITE_ORIGIN__/og-image.png" />
        <meta property="og:url" content="__IRADIOS_SITE_ORIGIN__/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="iRadios — Ελληνικό ραδιόφωνο live online" />
        <meta name="twitter:image" content="__IRADIOS_SITE_ORIGIN__/og-image.png" />
      </Helmet>}

      {location.pathname === '/map' && <Helmet>
        <title>Χάρτης ελληνικών ραδιοφωνικών σταθμών | iRadios</title>
        <meta name="description" content="Εξερεύνησε ραδιοφωνικούς σταθμούς από πόλεις και περιοχές της Ελλάδας στον χάρτη του iRadios."/>
        <link rel="canonical" href="__IRADIOS_SITE_ORIGIN__/map"/>
        <meta property="og:title" content="Χάρτης ελληνικών ραδιοφωνικών σταθμών | iRadios"/>
        <meta property="og:image" content="__IRADIOS_SITE_ORIGIN__/og-image.png"/>
        <meta name="twitter:card" content="summary_large_image"/>
      </Helmet>}

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
        <div className={"ir-remote-playback-banner " + (location.pathname.startsWith("/station/") ? "ir-remote-playback-banner--station " : "") + "fixed top-[100px] lg:top-auto lg:bottom-[112px] left-0 right-0 flex justify-center z-[120] pointer-events-none animate-in fade-in zoom-in-95 duration-500"}>
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
              <span className="text-[8px] lg:text-[9px] font-black tracking-widest opacity-80 leading-none mb-0.5">{remoteLocationLabel(activeRemoteDevice.playbackState)}</span>
              <span className="text-[10px] lg:text-xs font-bold leading-none">{activeRemoteDevice.deviceName} · Μεταφορά εδώ</span>
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
          onTogglePlayPause={togglePlayPause}
          catalogStations={stations}
          currentStation={currentStation}
          currentUser={currentUser}
          isPlaying={displayIsPlaying}
          isBuffering={isBuffering}
          isPlayingAd={isPlayingAd}
          currentAdInfo={currentAdInfo}
          nowPlaying={nowPlaying}
          nowPlayingInfo={nowPlayingInfo}
          globalCoverArt={globalCoverArt}
          analyser={analyserRef.current}
          toggleFavorite={handleToggleFavorite}
          isFavorite={isFavorite}
        />
      )}

      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
        preload="none" 
        playsInline 
        webkit-playsinline="true" 

        onLoadStart={() => setIsBuffering(true)}
        onWaiting={() => {
          setIsBuffering(true);
          if(activeAdRef.current)adListenClockRef.current=suspendAdListenClock(adListenClockRef.current);
          if (activeAdRef.current) {
            clearAdWatchdog();
            const token = activeAdRef.current.token;
            adWatchdogRef.current = setTimeout(() => {
              if(activeAdRef.current?.token===token){
                releasePaidAudio(activeAdRef.current,'failed');
                recoverUnplayedSlot();
                playNextAdOrStation();
              }
            }, 12000);
          }
        }}
        onPlaying={() => {
          setIsBuffering(false);
          const ad = activeAdRef.current;
          if(ad)adListenClockRef.current=resumeAdListenClock(
            adListenClockRef.current,audioRef.current?.currentTime||0,performance.now());
          if(ad&&!ad.started){
            ad.started=true;
            if(ad.timed&&ad.selectedPlacement)
              lastPlayedTimeAds.current[ad.id+':'+ad.selectedPlacement]=Date.now();
            if(ad.ticketCapability)void reportPaidAudio(ad,audioRef.current,true);
            else fetch(`${API_URL}/ads/${ad.id}/impression`,
              {method:'POST'}).catch(()=>{});
          }
          clearAdWatchdog();
          if(!ad&&!premiumAuthorizationPendingRef.current)
            void startedPlayback(String(playbackStationIdRef.current||''));
        }}
        
        onPause={() => {
          if(activeAdRef.current)adListenClockRef.current=suspendAdListenClock(adListenClockRef.current);
        }}
        onSeeking={()=>{
          if(activeAdRef.current)adListenClockRef.current=suspendAdListenClock(adListenClockRef.current);
        }}
        onSeeked={event=>{
          if(activeAdRef.current&&!event.currentTarget.paused)
            adListenClockRef.current=resumeAdListenClock(adListenClockRef.current,
              event.currentTarget.currentTime,performance.now());
        }}
        onDurationChange={event=>{
          if(activeAdRef.current)setAdSkipCountdown(
            secondsUntilAdSkip(adListenClockRef.current,event.currentTarget.duration,
              adBreakSpotCountRef.current,activeAdRef.current?.nonSkippable));
        }}
        onEnded={(event) => {
          // Safari prewarm is silent PCM, not a radio stream or ad break.
          if(premiumAuthorizationPendingRef.current||
             String(event.currentTarget.currentSrc||'').startsWith('data:audio/'))return;
          const ad=activeAdRef.current;
          if(ad){
            if(ad.ticketCapability){
              const media=event.currentTarget;
              void reportPaidAudio(ad,media,true).finally(()=>{
                releasePaidAudio(ad,'finished');
                if(activeAdRef.current?.token===ad.token)playNextAdOrStation();
              });
            }else{
              logAdOutcome('completed',ad);playNextAdOrStation();
            }
          }else handleActualStationPlay(currentStation);
        }} 

        onTimeUpdate={(e) => {
          if (activeAdRef.current) {
            const audio=e.currentTarget;
            adListenClockRef.current=sampleAdListenClock(adListenClockRef.current,{
              position:audio.currentTime,now:performance.now(),paused:audio.paused,
              seeking:audio.seeking,readyState:audio.readyState
            });
            const ad=activeAdRef.current;
            if(ad?.ticketCapability)void reportPaidAudio(ad,audio);
            const seconds=secondsUntilAdSkip(adListenClockRef.current,
              audio.duration,adBreakSpotCountRef.current,ad?.nonSkippable);
            setAdSkipCountdown(old=>old===seconds?old:seconds);
            setAdTimeRemaining(old=>{
              const next=Number.isFinite(audio.duration)?Math.max(0,Math.ceil(audio.duration-audio.currentTime)):0;
              return old===next?old:next;
            });
          } else if (isPlaying && !isRecognizing && !recognitionLock.current && Date.now() - lastMetaFetch.current > 10000) {
            lastMetaFetch.current = Date.now(); 
            fetchMetadata();
          }
        }}

        onError={(e) => {
          if(premiumAuthorizationPendingRef.current||
             String(e.currentTarget.currentSrc||'').startsWith('data:audio/'))return;
          // The same audio element serves spots and station streams.
          // A failed ad has its own diagnostic and must never be presented as
          // a broken radio station or trap the listener in a silent break.
          const media=e.currentTarget;
          const code=media.error?.code||0;
          const ad=activeAdRef.current;
          setIsBuffering(false);
          if (ad) {
            console.warn('[ADS] Spot playback failed; resuming station', {
              adId:ad.id,code,networkState:media.networkState,
              readyState:media.readyState,source:String(media.currentSrc||'').split('?')[0]
            });
            releasePaidAudio(ad,'failed');
            if(!ad.started)recoverUnplayedSlot();
            playNextAdOrStation();
          } else {
            console.warn('[RADIO] Station stream failed', {code,source:media.currentSrc});
            releasePlayback();
            setIsPlaying(false);
            showAlert("Ο σταθμός δεν ανταποκρίνεται αυτή τη στιγμή. Δοκίμασε έναν άλλο σταθμό.");
          }
        }}
      />

      <Preloader />

      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} currentUser={currentUser} stations={stations} API_URL={API_URL} />
      
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/20 relative">
        <TopBar setIsMobileMenuOpen={setIsMobileMenuOpen} openSmartSearchRequest={openSmartSearchRequest} stations={stations} weather={weather} handleSearchResultClick={(id) => { const s = stations.find(x => String(x._id) === String(id)); if (s) handleStationSelectWithAds(s); navigate(`/station/${s?.slug || id}`); }} currentUser={currentUser} onLogout={handleLogout} />
        <EmailVerificationBanner currentUser={currentUser} API_URL={API_URL} onUserUpdated={setCurrentUser} />
        <WinbackTicker currentUser={currentUser} API_URL={API_URL} />
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
                    isPlaying={displayIsPlaying} 
                    onPlayPause={togglePlayPause} 
                    currentUser={currentUser} 
                    analyser={analyserRef.current} 
                    onOpenDiscovery={() => setShowDiscovery(true)}
                    onOpenSmartSearch={() => setOpenSmartSearchRequest(request => request + 1)}
                    listeningProfile={listeningProfile}
                    onCategorySelected={recordCategorySelection}
                  />
                </SmartHomeRoute>
              } 
            />
            <Route path="/categories" element={
              <div className="ir-home-page relative mx-auto w-full max-w-[1720px] px-4 pb-36 pt-6 sm:px-6 xl:px-8">
                <HomeCategories stations={stations} currentUser={currentUser} allLink={false}/>
              </div>
            } />
            <Route path="/profile" element={currentUser ? <Profile API_URL={API_URL} currentUser={currentUser} onLogout={handleLogout} onUserUpdated={setCurrentUser} onOpenDevices={()=>setDevicesOpen(true)} /> : <Navigate to="/login" />} />
            <Route path="/settings" element={<Navigate to="/profile?tab=details" replace />} />
            <Route path="/press-kit" element={<PressKit />} />
            <Route path="/newsfeed" element={<NewsFeed stations={stations} userLocation={userLocation} checkGeoMatch={checkGeoMatch} currentUser={currentUser} currentStation={currentStation} isPlaying={displayIsPlaying} onPlayStation={handleStationSelectWithAds} onPlayPause={togglePlayPause} />} />
            <Route path="/newsfeed/:key" element={<NewsArticle />} />
            <Route path="/map" element={<MapMode stations={stations} currentUser={currentUser} currentStation={currentStation} onPlayStation={handleStationSelectWithAds} isPlaying={displayIsPlaying} onPlayPause={togglePlayPause} />} />

            <Route path="/studio" element={
              <RequireTerms currentUser={currentUser}>
                {currentUser?.role === 'producer' 
                  ? <ProducerStudio currentUser={currentUser} API_URL={API_URL} currentStation={currentStation} isPlaying={displayIsPlaying} analyser={analyserRef.current} /> 
                  : <BroadcasterStudio currentUser={currentUser} API_URL={API_URL} currentStation={currentStation} isPlaying={displayIsPlaying} analyser={analyserRef.current} />
                }
              </RequireTerms>
            } />

            <Route path="/genre/:genreName" element={<Genre stations={stations} currentStation={currentStation} userLocation={userLocation} checkGeoMatch={checkGeoMatch} setCurrentStation={handleStationSelectWithAds} isPlaying={displayIsPlaying} onPlayPause={togglePlayPause} analyser={analyserRef.current} currentUser={currentUser} />} />
            <Route path="/without-ads" element={<Genre noCommercialAds stations={stations} currentStation={currentStation} userLocation={userLocation} checkGeoMatch={checkGeoMatch} setCurrentStation={handleStationSelectWithAds} isPlaying={displayIsPlaying} onPlayPause={togglePlayPause} analyser={analyserRef.current} currentUser={currentUser} />} />
            <Route path="/region/:regionName" element={<Region stations={stations} currentStation={currentStation} userLocation={userLocation} checkGeoMatch={checkGeoMatch} setCurrentStation={handleStationSelectWithAds} isPlaying={displayIsPlaying} onPlayPause={togglePlayPause} analyser={analyserRef.current} currentUser={currentUser} />} />
            <Route path="/station/:id" element={<StationProfile stations={stations} API_URL={API_URL} currentStation={currentStation} isPlaying={displayIsPlaying} onPlayPause={togglePlayPause} setCurrentStation={handleStationSelectWithAds} toggleFavorite={handleToggleFavorite} isFavorite={isFavorite} isRecognizing={isRecognizing} handleRecognizeTrack={handleRecognizeTrack} nowPlaying={nowPlaying} nowPlayingInfo={nowPlayingInfo} analyser={analyserRef.current} currentUser={currentUser} listenerDspMode={listenerDspMode} onUserDSPChange={changeUserDSP} globalCoverArt={globalCoverArt} liveBroadcast={liveBroadcast} rdsShowProducer={rdsShowProducer} rdsAt={rdsAt} userLocation={userLocation} checkGeoMatch={checkGeoMatch} remoteDevice={activeRemoteDevice && !isPlaying ? activeRemoteDevice : null} onTransferHere={() => { window.dispatchEvent(new Event("minify_player")); if (currentUser?.isPremium) handleTransferPlayback(localDeviceId); else navigate("/premium"); }} />} />
            <Route path="/login" element={<Login API_URL={API_URL} setCurrentUser={setCurrentUser} />} />
            <Route path="/register" element={<Register API_URL={API_URL} setCurrentUser={setCurrentUser} />} />
            <Route path="/favorites" element={<Favorites stations={stations} currentUser={currentUser} currentStation={currentStation} setCurrentStation={handleStationSelectWithAds} isPlaying={displayIsPlaying} onPlayPause={togglePlayPause} toggleFavorite={handleToggleFavorite} isFavorite={isFavorite} analyser={analyserRef.current} />} />
            <Route path="/premium" element={<SandboxPremium API_URL={API_URL} currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
            <Route path="/reset-password/:token" element={<ResetPassword API_URL={API_URL} />} />
            <Route path="/verify-email" element={<VerifyEmail API_URL={API_URL} setCurrentUser={setCurrentUser} />} />
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
                {currentUser?.role === 'broadcaster' ? <Navigate to="/backoffice/audio" replace /> : currentUser?.role === 'admin' ? <Navigate to="/backoffice/admin/audio" replace /> : <Navigate to="/" />}
              </RequireTerms>
            } />
            <Route path="/ad-control" element={
              <RequireTerms currentUser={currentUser}>
                {currentUser?.role === 'broadcaster' ? <Navigate to="/backoffice/ad-control" replace /> : currentUser?.role === 'admin' ? <AdControl API_URL={API_URL} currentUser={currentUser} /> : <Navigate to="/" />}
              </RequireTerms>
            } />
            <Route path="/upgrade-station" element={
              <RequireTerms currentUser={currentUser}>
                {(currentUser?.role === 'admin' || currentUser?.role === 'broadcaster') ? <Navigate to="/backoffice/pro-features" replace /> : <Navigate to="/" />}
              </RequireTerms>
            } />
            <Route path="/boost-my-station" element={
              <RequireTerms currentUser={currentUser}>
                {(currentUser?.role === 'admin' || currentUser?.role === 'broadcaster') ? <Navigate to="/backoffice/boost" replace /> : <Navigate to="/" />}
              </RequireTerms>
            } />

            <Route path="/admin/newsfeed" element={currentUser?.role === 'admin' ? <AdminNewsFeed /> : <Navigate to="/" />} />
            <Route path="/admin/home-slides" element={currentUser?.role === 'admin' ? <AdminHomeSlides /> : <Navigate to="/" />} />
            <Route path="/admin/banners" element={currentUser?.role === 'admin' ? <AdminBanners /> : <Navigate to="/" />} />
            <Route path="/admin" element={currentUser?.role === 'admin' ? <AdminDashboard API_URL={API_URL}/> : <Navigate to="/" />} />
            <Route path="/admin/radioset" element={currentUser?.role === 'admin' ? <AdminRadioSet API_URL={API_URL} /> : <Navigate to="/" />} />
            <Route path="/admin/radios" element={currentUser?.role === 'admin' ? <Admin API_URL={API_URL} refreshStations={fetchGlobalStations} /> : <Navigate to="/" />} />
            <Route path="/admin/billing" element={currentUser?.role === 'admin' ? <AdminPaid API_URL={API_URL} /> : <Navigate to="/" />} />
            <Route path="/admin/billing/grants" element={currentUser?.role === 'admin' ? <AdminBillingGrants API_URL={API_URL} /> : <Navigate to="/" />} />
            <Route path="/admin/emails" element={currentUser?.role === 'admin' ? <AdminEmails API_URL={API_URL} /> : <Navigate to="/" />} />
            <Route path="/admin/users" element={currentUser?.role === 'admin' ? <AdminUsers API_URL={API_URL} currentUser={currentUser} /> : <Navigate to="/" />} />
            <Route path="/admin/ads" element={currentUser?.role === 'admin' ? <AdminAds API_URL={API_URL} refreshGlobalAds={loadGlobalAds} /> : <Navigate to="/" />} />
            <Route path="/admin/push" element={currentUser?.role === 'admin' ? <NewPush API_URL={API_URL} /> : <Navigate to="/" />} />
            <Route path="/admin/boost" element={currentUser?.role === 'admin' ? <Boost API_URL={API_URL} stations={stations} refreshStations={fetchGlobalStations} /> : <Navigate to="/" />} />
            <Route path="/admin/ad-control" element={currentUser?.role === 'admin' ? <AdminAdControl API_URL={API_URL} /> : <Navigate to="/" />} />

            <Route path="/accept-invite" element={<AcceptInvite API_URL={API_URL} />} />
            <Route path="/broadcaster-invite" element={<BroadcasterInvitation API_URL={API_URL} currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
            <Route path="/go-ads" element={<GoAgency API_URL={API_URL} currentUser={currentUser} setCurrentUser={setCurrentUser} />} />

            {['audio','banners'].map(type=>[
              <Route key={type+'-new'} path={'/agency/campaigns/'+type+'/new'}
                element={currentUser?.role==='agency'||currentUser?.role==='admin'
                  ?<RequireTerms currentUser={currentUser}><CampaignEditor scope="agency" kind={type} currentUser={currentUser}/></RequireTerms>
                  :<Navigate to="/go-ads" replace/>}/>,
              <Route key={type+'-edit'} path={'/agency/campaigns/'+type+'/:id/edit'}
                element={currentUser?.role==='agency'||currentUser?.role==='admin'
                  ?<RequireTerms currentUser={currentUser}><CampaignEditor scope="agency" kind={type} currentUser={currentUser}/></RequireTerms>
                  :<Navigate to="/go-ads" replace/>}/>
            ])}
            <Route path="/agency/v2/campaigns" element={
              <RequireTerms currentUser={currentUser}>
                {currentUser?.role==='agency'||currentUser?.role==='admin'
                  ?<AgencyAdvertisingV2/>
                  :<Navigate to="/go-ads" replace/>}
              </RequireTerms>
            }/>
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
            <Route path="/cookies" element={<CookiePolicy />} />
            <Route path="/cookie-policy" element={<Navigate to="/cookies" replace />} />
            <Route path="/payment-methods" element={<PaymentMethods />} />
            <Route path="/payments" element={<Navigate to="/payment-methods" replace />} />
            
            <Route path="/broadcaster-terms" element={!authReady ? <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">Έλεγχος σύνδεσης…</div> : (currentUser?.role === 'broadcaster' || currentUser?.role === 'admin') ? <TermsBroadcasters API_URL={API_URL} currentUser={currentUser} /> : <Navigate to="/terms" />} />
            <Route path="/agency-terms" element={<TermsAgency API_URL={API_URL} currentUser={currentUser} />} />
          </Routes>
        </div>

        <MobileNav currentUser={currentUser} onOpenDiscovery={() => setShowDiscovery(true)} />
        
        <MobileMiniPlayer 
          currentStation={currentStation} isPlayingAd={isPlayingAd} currentAdInfo={currentAdInfo}
          adTimeRemaining={adTimeRemaining} adWarning={adWarning}
          adSkipCountdown={adSkipCountdown} onSkipAd={skipCurrentAd} nowPlaying={nowPlaying} nowPlayingInfo={nowPlayingInfo}
          isPlaying={displayIsPlaying} togglePlayPause={togglePlayPause} isBuffering={isBuffering}
          toggleFavorite={handleToggleFavorite} isFavorite={isFavorite}
          currentUser={currentUser}
          handleNextStation={handleNextStation} handlePrevStation={handlePrevStation}
          shuffleEnabled={stationShuffle}
          onShuffleToggle={() => { shuffleHistoryRef.current = []; setStationShuffle(value => !value); }}
          isRecognizing={isRecognizing} handleRecognizeTrack={handleRecognizeTrack} spotifyUrl={spotifyUrl}
          onOpenCarMode={() => setIsCarModeActive(true)}
          globalCoverArt={globalCoverArt}
          liveBroadcast={liveBroadcast}
          rdsShowProducer={rdsShowProducer}
          availableDevices={availableDevices}
          localDeviceId={localDeviceId}
          onTransferPlayback={handleTransferPlayback}
          onRequestDevices={handleRequestDevices}
          onOpenDevices={()=>setDevicesOpen(true)}
          remotePlayback={remotePlayback}
        />
      </main>

      <Footer 
        currentStation={currentStation} isPlayingAd={isPlayingAd} currentAdInfo={currentAdInfo} isBuffering={isBuffering}    
        adTimeRemaining={adTimeRemaining} adWarning={adWarning}
        adSkipCountdown={adSkipCountdown} onSkipAd={skipCurrentAd} isPlaying={displayIsPlaying} 
        nowPlaying={isPlayingAd ? `Sponsored: ${currentAdInfo?.title}` : nowPlaying} nowPlayingInfo={nowPlayingInfo} 
        volume={volume} setVolume={setVolume} togglePlayPause={togglePlayPause} 
        toggleFavorite={handleToggleFavorite} isFavorite={isFavorite} 
        handleNextStation={handleNextStation} handlePrevStation={handlePrevStation}  
        currentUser={currentUser} listenerDspMode={listenerDspMode} onUserDSPChange={changeUserDSP}
        isRecognizing={isRecognizing} handleRecognizeTrack={handleRecognizeTrack} spotifyUrl={spotifyUrl}
        globalCoverArt={globalCoverArt}
        liveBroadcast={liveBroadcast}
        rdsShowProducer={rdsShowProducer}
        availableDevices={availableDevices}
        localDeviceId={localDeviceId}
        onTransferPlayback={handleTransferPlayback}
        onRequestDevices={handleRequestDevices}
        onOpenDevices={()=>setDevicesOpen(true)}
        remotePlayback={remotePlayback}
      />
      <DevicePicker open={devicesOpen} onClose={()=>setDevicesOpen(false)}
        devices={availableDevices} localDeviceId={localDeviceId}
        connected={devicesConnected} premium={currentUser?.role==='user'&&currentUser?.isPremium===true}
        onRefresh={requestDevices} onTransfer={handleTransferPlayback}
        onRename={renameDevice} onForget={forgetDevice} currentStation={currentStation}/>
      <InstallPrompt />
      <NotificationTicker API_URL={API_URL} currentUser={currentUser} />

      {isCarModeActive && currentStation && (
        <CarMode 
          station={currentStation}
          isPlaying={displayIsPlaying}
          isPlayingAd={isPlayingAd} currentAdInfo={currentAdInfo}
          adSkipCountdown={adSkipCountdown} onSkipAd={skipCurrentAd}
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
          audioRef={audioRef}
          onAccept={() => setIsCarModeActive(true)} 
        />
      )}

      <PremiumRenewalPopup currentUser={currentUser} authReady={authReady} API_URL={API_URL}/>
      <CookieConsent />
    </div>
  );
}

// Keep the business console completely isolated: no listener/audio hooks,
 // station playback, ad engine, player widgets or Socket.IO are mounted there.
// Invitations complete in the same player-free Broadcaster shell as registration.
function StandaloneBroadcasterInvitation(){
  const [currentUser,setCurrentUser]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const token=localStorage.getItem('iluma_token');
    if(!token){setLoading(false);return;}
    let alive=true;
    fetch('/api/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
      .then(async response=>response.ok?response.json():null)
      .then(user=>{if(alive)setCurrentUser(user);})
      .catch(()=>{if(alive)setCurrentUser(null);})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[]);
  if(loading)return <div role="status" className="flex min-h-screen items-center justify-center bg-[#080c0c] text-sm text-[#ccff00]">Έλεγχος πρόσκλησης Broadcaster…</div>;
  return <BroadcasterInvitation API_URL="/api" currentUser={currentUser} setCurrentUser={setCurrentUser}/>;
}

function AppContent(){
  const location=useLocation();
  // No MainApp, audio hooks, socket, player, menus or advertisements in Broadcaster onboarding.
  // Public widgets never mount the listener app or its global audio player.
  if(location.pathname.startsWith('/widget-embed/'))return <Routes>
    <Route path="/widget-embed/:variant/:stationId" element={<WidgetEmbedAccess/>}/>
  </Routes>;
  if(location.pathname==='/broadcast')return <GoBroadcast/>;
  if(location.pathname==='/broadcast/register')return <BroadcasterRegister/>;
  if(location.pathname==='/broadcast/pending')return <BroadcasterPending/>;
  // Keep the B2B agreement completely player-free like /broadcast.
  if(location.pathname==='/broadcaster-terms')return <TermsBroadcasters API_URL="/api"/>;
  if(location.pathname==='/broadcaster-invite')return <StandaloneBroadcasterInvitation/>;
  if(location.pathname==='/verify-email')return <VerifyEmail API_URL="/api"/>;
  // Existing bookmarks remain functional, but operational pages now open
  // the separate management shell instead of instantiating radio playback.
  const legacyBackofficePaths={
    '/admin':'/backoffice',
    '/studio':'/backoffice',
    '/my-radios':'/backoffice/stations',
    '/my-schedules':'/backoffice/schedules',
    '/admin/radios':'/backoffice/stations',
    '/admin/radioset':'/backoffice/admin/radioset',
    '/admin/users':'/backoffice/admin/users',
    '/admin/ads':'/backoffice/admin/ads',
    '/admin/banners':'/backoffice/admin/banners',
    '/admin/home-slides':'/backoffice/admin/slides',
    '/admin/billing':'/backoffice/admin/billing',
    '/admin/billing/grants':'/backoffice/admin/billing/grants',
    '/admin/billing/sandbox':'/backoffice/admin/billing/sandbox',
    '/admin/emails':'/backoffice/admin/emails',
    '/admin/boost':'/backoffice/admin/boost',
    '/admin/ad-control':'/backoffice/admin/adcontrol',
    '/admin/push':'/backoffice/admin/push',
    '/agency/dashboard':'/backoffice',
    '/agency/v2/campaigns':'/backoffice/agency/campaigns'
  };
  const legacyTarget=legacyBackofficePaths[location.pathname];
  if(legacyTarget)return <Navigate to={legacyTarget+location.search} replace/>;
  // Keep legacy bookmarks, but never instantiate listener playback for B2B work.
  if(/^\/agency\/campaigns\/(?:audio|banners)\/(?:new|[a-f0-9]{24}\/edit)$/i.test(location.pathname))
    return <Navigate to={'/backoffice/agency/creatives/'+location.pathname.slice('/agency/campaigns/'.length)+location.search} replace/>;
  return location.pathname==='/backoffice'||location.pathname.startsWith('/backoffice/')
    ? <Backoffice/> : <MainApp/>;
}

export default function App() { 
  return (
    <HelmetProvider>
      <Router>
        <AlertProvider>
          <LiveUpdatesBridge />
          <AppContent />
        </AlertProvider>
      </Router>
    </HelmetProvider>
  ); 
}
