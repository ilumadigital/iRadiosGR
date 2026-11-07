import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Play, Pause, ChevronRight, Star, Heart, History, 
  ChevronLeft, LogIn, UserPlus, ArrowRight, Radio, BellRing, Zap, Compass, 
  Megaphone, ExternalLink, ShieldCheck, SignalHigh,
  Sparkles, CloudRain, Sun, Moon, Music, MapPin
} from 'lucide-react';
import CircularVU from '../components/CircularVU';
import confetti from 'canvas-confetti';
import PlayingNow from './PlayingNow';
import HomeHeroSlider from '../components/HomeHeroSlider';
import HomeExplore from '../components/HomeExplore';
import StationPlaylistPanel from '../components/StationPlaylistPanel';
import HomeRadioShortlist from '../components/HomeRadioShortlist';
import HomeRecommendationDeck from '../components/HomeRecommendationDeck';

// 🌍 Αλγόριθμος Haversine: Υπολογίζει την απόσταση μεταξύ 2 συντεταγμένων σε χιλιόμετρα
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Ακτίνα της Γης σε χλμ
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 📍 Το Απόλυτο Λεξικό Συντεταγμένων
const CITY_COORDINATES = {
  "Ελλάδα": [37.9838, 23.7275], "Web Radio": [37.9838, 23.7275], "Άλλη": [37.9838, 23.7275], "Global": [37.9838, 23.7275],
  "Αττική": [37.9838, 23.7275], "Αθήνα": [37.9838, 23.7275], "Πειραιάς": [37.9429, 23.6439], "Νέα Σμύρνη": [37.9450, 23.7136], 
  "Καλλιθέα": [37.9531, 23.7006], "Παλαιό Φάληρο": [37.9250, 23.6931], "Άλιμος": [37.9111, 23.7228], "Ελληνικό": [37.8864, 23.7436], 
  "Αργυρούπολη": [37.9022, 23.7461], "Γλυφάδα": [37.8628, 23.7561], "Βούλα": [37.8425, 23.7744], "Βουλιαγμένη": [37.8131, 23.7803], 
  "Ηλιούπολη": [37.9306, 23.7556], "Άγιος Δημήτριος": [37.9333, 23.7333], "Ζωγράφου": [37.9733, 23.7667], "Καισαριανή": [37.9667, 23.7500], 
  "Βύρωνας": [37.9500, 23.7500], "Γαλάτσι": [38.0167, 23.7500], "Νέα Ιωνία": [38.0417, 23.7583], "Νέο Ηράκλειο": [38.0500, 23.7667], 
  "Νέα Φιλαδέλφεια": [38.0333, 23.7333], "Χαλάνδρι": [38.0222, 23.7997], "Μαρούσι": [38.0560, 23.8055], "Κηφισιά": [38.0733, 23.8122], 
  "Πεύκη": [38.0667, 23.8000], "Μελίσσια": [38.0500, 23.8333], "Βριλήσσια": [38.0333, 23.8333], "Αγία Παρασκευή": [38.0167, 23.8167], 
  "Περιστέρι": [38.0154, 23.6919], "Αιγάλεω": [37.9933, 23.6817], "Χαϊδάρι": [38.0167, 23.6500], "Ίλιον": [38.0333, 23.7000], 
  "Πετρούπολη": [38.0333, 23.6833], "Αγία Βαρβάρα": [37.9833, 23.6500], "Νίκαια": [37.9667, 23.6333], "Κορυδαλλός": [37.9760, 23.6470], 
  "Κερατσίνι": [37.9667, 23.6167], "Δραπετσώνα": [37.9500, 23.6167], "Πέραμα": [37.9667, 23.5667], "Σαλαμίνα": [37.9667, 23.5000], 
  "Ελευσίνα": [38.0333, 23.5333], "Αχαρνές": [38.0833, 23.7333], "Παλλήνη": [38.0000, 23.8667], "Γέρακας": [38.0167, 23.8500], 
  "Κορωπί": [37.9000, 23.8667], "Μαρκόπουλο": [37.8833, 23.9333], "Ραφήνα": [38.0167, 24.0000], "Λαύριο": [37.7167, 24.0500],
  "Κεντρική Μακεδονία": [40.6401, 22.9444], "Ανατολική Μακεδονία & Θράκη": [41.1192, 25.4054], "Δυτική Μακεδονία": [40.3000, 21.7833],
  "Θεσσαλονίκη": [40.6401, 22.9444], "Καλαμαριά": [40.5828, 22.9547], "Εύοσμος": [40.6631, 22.9090], "Κορδελιό": [40.6667, 22.9000], 
  "Αμπελόκηποι": [40.6500, 22.9333], "Μενεμένη": [40.6500, 22.9167], "Σταυρούπολη": [40.6667, 22.9333], "Πολίχνη": [40.6667, 22.9500], 
  "Νεάπολη": [40.6500, 22.9500], "Συκιές": [40.6500, 22.9667], "Πυλαία": [40.6000, 22.9833], "Χορτιάτης": [40.6167, 23.1000], 
  "Πανόραμα": [40.5833, 23.0333], "Θέρμη": [40.5422, 23.0189], "Ωραιόκαστρο": [40.7286, 22.9173], "Μηχανιώνα": [40.4667, 22.8333], 
  "Περαία": [40.5000, 22.9333], "Σίνδος": [40.6667, 22.8000], "Χαλάστρα": [40.6333, 22.7333],
  "Γρεβενά": [40.0845, 21.4274], "Δράμα": [41.1528, 24.1472], "Έβρος": [40.8499, 25.8764], "Αλεξανδρούπολη": [40.8499, 25.8764], 
  "Ορεστιάδα": [41.3811, 26.5333], "Διδυμότειχο": [41.3503, 26.4950], "Ημαθία": [40.5235, 22.2023], "Βέροια": [40.5235, 22.2023], 
  "Νάουσα": [40.6277, 22.0673], "Αλεξάνδρεια": [40.6277, 22.4435], "Καβάλα": [40.9396, 24.4069], "Καστοριά": [40.5222, 21.2678], 
  "Κιλκίς": [40.9930, 22.8743], "Κοζάνη": [40.3000, 21.7833], "Πτολεμαΐδα": [40.5147, 21.6781], "Ξάνθη": [41.1349, 24.8896], 
  "Πέλλα": [40.8016, 22.0461], "Έδεσσα": [40.8016, 22.0461], "Γιαννιτσά": [40.7937, 22.4118], "Πιερία": [40.2696, 22.5061], 
  "Κατερίνη": [40.2696, 22.5061], "Ροδόπη": [41.1192, 25.4054], "Κομοτηνή": [41.1192, 25.4054], "Σέρρες": [41.0921, 23.5498], 
  "Φλώρινα": [40.7816, 21.4093], "Αμύνταιο": [40.6896, 21.6789], "Χαλκιδική": [40.3776, 23.4398], "Πολύγυρος": [40.3776, 23.4398], "Νέα Μουδανιά": [40.2407, 23.2825],
  "Πελοπόννησος": [37.5089, 22.3732], "Αργολίδα": [37.5673, 22.8016], "Ναύπλιο": [37.5673, 22.8016], "Άργος": [37.6329, 22.7291], 
  "Αρκαδία": [37.5089, 22.3732], "Τρίπολη": [37.5089, 22.3732], "Μεγαλόπολη": [37.4011, 22.1378], "Αχαΐα": [38.2466, 21.7346], 
  "Πάτρα": [38.2466, 21.7346], "Αίγιο": [38.2511, 22.0822], "Καλάβρυτα": [38.0315, 22.1105], "Κορινθία": [37.9396, 22.9271], 
  "Κόρινθος": [37.9396, 22.9271], "Λουτράκι": [37.9747, 22.9754], "Κιάτο": [38.0131, 22.7483], "Λακωνία": [37.0745, 22.4297], 
  "Σπάρτη": [37.0745, 22.4297], "Γύθειο": [36.7621, 22.5647], "Μεσσηνία": [37.0391, 22.1126], "Καλαμάτα": [37.0391, 22.1126], 
  "Μεσσήνη": [37.0504, 22.0084], "Ηλεία": [37.6751, 21.4420], "Πύργος": [37.6751, 21.4420], "Αμαλιάδα": [37.7959, 21.3499],
  "Θεσσαλία": [39.6390, 22.4191], "Στερεά Ελλάδα": [38.8940, 22.4346], "Δυτική Ελλάδα": [38.2466, 21.7346],
  "Λάρισα": [39.6390, 22.4191], "Ελασσόνα": [39.8953, 22.1882], "Φάρσαλα": [39.2946, 22.3857], "Μαγνησία": [39.3621, 22.9424], 
  "Βόλος": [39.3621, 22.9424], "Αλμυρός": [39.1818, 22.7592], "Καρδίτσα": [39.3644, 21.9214], "Τρίκαλα": [39.5557, 21.7679], 
  "Καλαμπάκα": [39.7042, 21.6263], "Βοιωτία": [38.4367, 22.8761], "Λιβαδειά": [38.4367, 22.8761], "Θήβα": [38.3243, 23.3182], 
  "Αράχωβα": [38.4800, 22.5855], "Εύβοια": [38.4623, 23.5950], "Χαλκίδα": [38.4623, 23.5950], "Κάρυστος": [38.0163, 24.4196], 
  "Ευρυτανία": [38.9135, 21.7954], "Καρπενήσι": [38.9135, 21.7954], "Φθιώτιδα": [38.8953, 22.4336], "Λαμία": [38.8953, 22.4336], 
  "Φωκίδα": [38.5262, 22.3781], "Άμφισσα": [38.5262, 22.3781], "Δελφοί": [38.4805, 22.5029], "Αιτωλοακαρνανία": [38.3687, 21.4286], 
  "Μεσολόγγι": [38.3687, 21.4286], "Αγρίνιο": [38.6259, 21.4116], "Ναύπακτος": [38.3934, 21.8268],
  "Ήπειρος": [39.6649, 20.8519], "Άρτα": [39.1611, 20.9856], "Θεσπρωτία": [39.5055, 20.2655], "Ηγουμενίτσα": [39.5055, 20.2655], 
  "Ιωάννινα": [39.6649, 20.8519], "Μέτσοβο": [39.7695, 21.1834], "Πρέβεζα": [38.9562, 20.7431], "Πάργα": [39.2844, 20.4005],
  "Κρήτη": [35.3387, 24.7442], "Ηράκλειο": [35.3387, 25.1442], "Μοίρες": [35.0519, 24.8733], "Χερσόνησος": [35.3168, 25.3912], 
  "Λασίθι": [35.1906, 25.7155], "Άγιος Νικόλαος": [35.1906, 25.7155], "Ιεράπετρα": [35.0101, 25.7369], "Σητεία": [35.2057, 26.1050], 
  "Ρέθυμνο": [35.3656, 24.4820], "Χανιά": [35.5138, 24.0180], "Κίσσαμος": [35.4947, 23.6543],
  "Βόρειο Αιγαίο": [39.1062, 26.2517], "Νότιο Αιγαίο": [36.4429, 25.1458], "Ιόνια Νησιά": [38.6200, 20.6211],
  "Δωδεκάνησα": [36.4341, 28.2236], "Ρόδος": [36.4341, 28.2236], "Κως": [36.8932, 27.2885], "Κάλυμνος": [36.9497, 26.9772], "Κάρπαθος": [35.5070, 27.2132], 
  "Ζάκυνθος": [37.7885, 20.8986], "Κέρκυρα": [39.6200, 19.9197], "Κεφαλληνία": [38.1764, 20.4892], "Αργοστόλι": [38.1764, 20.4892], "Ληξούρι": [38.2017, 20.4357],
  "Κυκλάδες": [37.4385, 24.9405], "Σύρος": [37.4385, 24.9405], "Νάξος": [37.1056, 25.3764], "Μύκονος": [37.4467, 25.3289], "Σαντορίνη": [36.3932, 25.4615], "Πάρος": [37.0855, 25.1488], "Τήνος": [37.5375, 25.1627], "Μήλος": [36.7431, 24.4253], 
  "Λέσβος": [39.1061, 26.5560], "Μυτιλήνη": [39.1061, 26.5560], "Λευκάδα": [38.8313, 20.7061], "Σάμος": [37.7554, 26.9749], "Χίος": [38.3678, 26.1361],
  "Κύπρος": [35.1666, 33.3666], "Λευκωσία": [35.1856, 33.3823], "Στρόβολος": [35.1504, 33.3444], "Λακατάμεια": [35.1118, 33.3214], 
  "Λεμεσός": [34.6786, 33.0420], "Λάρνακα": [34.9115, 33.6232], "Πάφος": [34.7720, 32.4265], 
  "Αμμόχωστος": [35.0396, 33.9829], "Παραλίμνι": [35.0396, 33.9829], "Αγία Νάπα": [34.9915, 34.0017], "Κερύνεια": [35.3333, 33.3167],
  "Εξωτερικό": [51.5074, -0.1278], "Ευρώπη": [51.5074, -0.1278], "Λονδίνο": [51.5074, -0.1278], "Παρίσι": [48.8566, 2.3522], "Βερολίνο": [52.5200, 13.4050], 
  "Αμερική": [40.7128, -74.0060], "Νέα Υόρκη": [40.7128, -74.0060], "Σικάγο": [41.8781, -87.6298], 
  "Αυστραλία": [-33.8688, 151.2093], "Σίδνεϊ": [-33.8688, 151.2093], "Μελβούρνη": [-37.8136, 144.9631]
};

// 🟢 ΠΡΟΣΘΗΚΗ: Δέχεται το `weather` από το App.jsx
export default function Home({ stations, weather, currentStation, setCurrentStation, userLocation, checkGeoMatch, isPlaying, onPlayPause, currentUser, analyser, onOpenDiscovery, API_URL }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [heroStationId,setHeroStationId] = useState(null);
  useEffect(()=>{
    if(new URLSearchParams(location.search).get('explore')==='playlist'){
      document.getElementById('home-playlist')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
  },[location.search]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeBanners, setActiveBanners] = useState([]);
  
  // 📍 ΜΟΝΟ Συντεταγμένες πλέον, OXI καιρός (τον παίρνουμε από το App.jsx)
  const [userCoords, setUserCoords] = useState(null);

  const getVocativeName = (name) => {
    if (!name) return '';
    let n = name.trim();
    if (n.endsWith('ος') || n.endsWith('ός') || n.endsWith('ης') || n.endsWith('ής') || n.endsWith('ας') || n.endsWith('άς')) {
      return n.slice(0, -1); 
    }
    return n;
  };

  const isFreeOrGuest = !currentUser || (!currentUser.isPremium && currentUser?.broadcasterProfile?.tier !== 'premium');

  // --- 0. ΦΟΡΤΩΣΗ ΚΑΙ ΦΙΛΤΡΑΡΙΣΜΑ BANNERS ---
  useEffect(() => {
    if (isFreeOrGuest) {
      fetch(`/api/banners/active`)
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
        .then(data => {
          const strictlyActiveBanners = data.filter(banner => banner.status === 'active');
          
          if (checkGeoMatch && userLocation) {
            const geoFilteredBanners = strictlyActiveBanners.filter(banner => {
              const targetArea = (banner.targetLocations && banner.targetLocations.length > 0) ? banner.targetLocations[0] : 'All';
              return checkGeoMatch(targetArea, userLocation);
            });
            setActiveBanners(geoFilteredBanners);
          } else {
            setActiveBanners(strictlyActiveBanners);
          }
        })
        .catch(err => console.error("Error fetching banners:", err));
    }
  }, [isFreeOrGuest, userLocation, checkGeoMatch]); 

  const homeBanners = activeBanners.filter(b => b.placement.includes('home'));

  const handleBannerView = async (bannerId) => {
    try {
      await fetch(`/api/banners/${bannerId}/impression`, { method: 'POST' });
    } catch (e) {
      console.error("View tracking failed", e);
    }
  };

  const handleBannerClick = async (banner) => {
    try {
      await fetch(`/api/banners/${banner._id}/click`, { method: 'POST' });
    } catch (e) {
      console.error("Click tracking failed", e);
    }
    
    const baseParams = "ref=iradiosapp&utm_medium=ilumadigitalagencyiradios&utm_source=iradios";
    let campaign = "general_ir";
    
    if (banner.placement && banner.placement.includes('hero')) campaign = "hero_section_ir";
    else if (banner.placement && banner.placement.includes('home')) campaign = "homefeed_ir";

    const utmParams = `${baseParams}&utm_campaign=${campaign}&utm_content=${campaign}`;
    const separator = banner.targetUrl.includes('?') ? '&' : '?';
    
    window.open(`${banner.targetUrl}${separator}${utmParams}`, '_blank', 'noopener,noreferrer');
  };

  // --- 📡 USER COORDINATES (Μόνο GPS, ΟΧΙ καιρός) ---
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
        },
        (error) => {
          console.warn("Geolocation denied or failed. Fallback to Athens.");
          setUserCoords({ lat: 37.9838, lon: 23.7275 });
        }
      );
    } else {
      setUserCoords({ lat: 37.9838, lon: 23.7275 });
    }
  }, []);

  // --- 1. BIRTHDAY & GREETING LOGIC ---
  const { finalGreeting, isBirthday } = useMemo(() => {
    if (!currentUser) return { finalGreeting: "Καλωσόρισες στο iRadios", isBirthday: false };
    const now = new Date();
    const hour = now.getHours();
    let bday = false;
    if (currentUser?.birthdate) {
      const userBday = new Date(currentUser.birthdate);
      if (userBday.getDate() === now.getDate() && userBday.getMonth() === now.getMonth()) {
        bday = true;
      }
    }
    const friendlyName = getVocativeName(currentUser.fname);
    if (bday) return { finalGreeting: `🎂 Χρόνια Πολλά, ${friendlyName}!`, isBirthday: true };
    let text = "Καληνύχτα";
    if (hour >= 5 && hour < 12) text = "Καλημέρα";
    else if (hour >= 12 && hour < 17) text = "Καλό μεσημέρι";
    else if (hour >= 17 && hour < 23) text = "Καλησπέρα";
    return { finalGreeting: `${text}${friendlyName ? ', ' + friendlyName : ''}`, isBirthday: false };
  }, [currentUser]);

  useEffect(() => {
    if (isBirthday) {
      const duration = 3 * 1000;
      const end = Date.now() + duration;
      (function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ccff00', '#ffffff'] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ccff00', '#ffffff'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      }());
    }
  }, [isBirthday]);

  const handleRequestNotif = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') alert("Οι ειδοποιήσεις ενεργοποιήθηκαν!");
    }
  };

  useEffect(() => {
    if (currentStation?._id && isPlaying) {
      const savedHistory = JSON.parse(localStorage.getItem('iluma_play_history') || '[]');
      const newHistory = [currentStation._id, ...savedHistory.filter(id => id !== currentStation._id)].slice(0, 8);
      localStorage.setItem('iluma_play_history', JSON.stringify(newHistory));
    }
  }, [currentStation, isPlaying]);

  // --- 🎧 USER LISTENING PROFILE ---
  const recentlyPlayed = useMemo(() => {
    const savedIds = JSON.parse(localStorage.getItem('iluma_play_history') || '[]');
    return savedIds.map(id => stations.find(s => s._id === id)).filter(Boolean).slice(0, 8);
  }, [stations, currentStation, isPlaying]);

  const userProfile = useMemo(() => {
    let prefGreek = 0, prefForeign = 0, prefNews = 0;
    
    recentlyPlayed.forEach(station => {
      const g = station.genre;
      if (['Ελληνικά Επιτυχίες', 'Ελληνικά Λαϊκά', 'Έντεχνη', 'Παραδοσιακά'].includes(g)) prefGreek++;
      else if (['Ειδήσεις', 'Αθλητικά'].includes(g)) prefNews++;
      else if (['Διεθνή Mainstream', "Cosmopolitan", 'House', 'Techno', 'Rock', 'HipHop / RnB / Rap', '80s / 90s', 'Sophisticated', 'Εναλλακτικά', 'Lounge'].includes(g)) prefForeign++;
    });

    if (prefNews > 0 && prefNews >= prefGreek && prefNews >= prefForeign) return 'news';
    if (prefGreek > prefForeign) return 'greek';
    return 'foreign'; 
  }, [recentlyPlayed]);

  // --- 🧠 HYPER-PERSONALIZED AI MOOD MATCHER (ΧΡΗΣΙΜΟΠΟΙΕΙ ΤΟ WEATHER PROP) ---
  const moodMatch = useMemo(() => {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    const isWeekendNight = (day === 5 || day === 6) && (hour >= 20 || hour < 4);
    const isNight = hour < 6 || hour > 20;

    // 🟢 Χρησιμοποιούμε το Global Weather (ή περιμένουμε να φορτώσει)
    if (!weather || weather.temp === null) {
      return {
        title: isNight ? "Late Night Vibes 🌙" : "Ημερήσια Ενέργεια ⚡",
        subtitle: "Το iRadios AI αναλύει τη στιγμή και ετοιμάζει τις προτάσεις σου...",
        genres: ["Διεθνή Mainstream", "Cosmopolitan", "Lounge"], 
        icon: <Sparkles size={28} className="text-zinc-400 animate-spin" />,
        gradient: "from-zinc-800/30 to-black",
        borderColor: "border-zinc-500/30",
        badgeColor: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
      };
    }

    const { icon: weatherIcon, temp } = weather;

    // 1. News Override (Πρωί & Βράδυ)
    if (userProfile === 'news' && ((hour >= 6 && hour <= 10) || (hour >= 19 && hour <= 23))) {
      return {
        title: `Η Επικαιρότητα Τώρα 📰`,
        subtitle: `Είναι η ώρα της ενημέρωσης. Άκουσε τις εξελίξεις, αναλύσεις και τα νέα της ημέρας.`,
        genres: ["Ειδήσεις", "Αθλητικά"],
        icon: <Megaphone size={28} className="text-emerald-400" />,
        gradient: "from-emerald-900/40 to-black",
        borderColor: "border-emerald-500/40",
        badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
      };
    }

    // 2. Weekend Nights (Party)
    if (isWeekendNight) {
      const genres = userProfile === 'greek' ? ["Ελληνικά Επιτυχίες", "Ελληνικά Λαϊκά"] : ["Sophisticated", "Techno", "Cosmopolitan", "House"];
      return {
        title: `Weekend Vibes 🪩`,
        subtitle: "Το Σαββατοκύριακο είναι εδώ! Ανέβασε τη διάθεσή σου με την απόλυτη μουσική επιλογή για απόψε.",
        genres: genres, 
        icon: <Zap size={28} className="text-purple-400" />,
        gradient: "from-purple-900/40 to-black",
        borderColor: "border-purple-500/40",
        badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/40"
      };
    }

    // 3. Βροχή / Χιόνι (Cozy)
    if (weatherIcon === 'CloudRain' || weatherIcon === 'Snowflake') {
      const genres = userProfile === 'greek' ? ["Έντεχνη", "Παραδοσιακά"] : ["Sophisticated", "Cosmopolitan", "Lounge"];
      return {
        title: `Cozy & Chill 🌧️`,
        subtitle: `Ιδανικός καιρός (${temp}°C) για να χαλαρώσεις μέσα. Η απόλυτη μουσική ατμόσφαιρα.`,
        genres: genres,
        icon: <CloudRain size={28} className="text-blue-400" />,
        gradient: "from-blue-900/40 to-black",
        borderColor: "border-blue-500/40",
        badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/40"
      };
    }

    // 4. Καθαρός Καιρός (Ήλιος)
    if (weatherIcon === 'Sun') {
      if (isNight) {
        const genres = userProfile === 'greek' ? ["Ελληνικά Λαϊκά", "Έντεχνη"] : ["Lounge", "Cosmopolitan", "80s / 90s"];
        return {
          title: `Late Night Vibes 🌙`,
          subtitle: "Χαλάρωσε, βάλε ένα ποτό και άσε τον αλγόριθμο να σε ταξιδέψει με τις ιδανικές νυχτερινές επιλογές.",
          genres: genres,
          icon: <Moon size={28} className="text-indigo-400" />,
          gradient: "from-indigo-900/40 to-black",
          borderColor: "border-indigo-500/40",
          badgeColor: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
        };
      } else {
        const genres = userProfile === 'greek' ? ["Ελληνικά Επιτυχίες", "Ελληνικά Λαϊκά"] : ["Διεθνή Mainstream", "House", "Rock"];
        return {
          title: `Ημερήσια Ενέργεια ☀️`,
          subtitle: `Ανεβαστική διάθεση και ρυθμός (${temp}°C)! Βάλε τα ακουστικά σου και γέμισε θετική ενέργεια.`,
          genres: genres,
          icon: <Sun size={28} className="text-yellow-400" />,
          gradient: "from-yellow-900/30 to-black",
          borderColor: "border-yellow-500/40",
          badgeColor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
        };
      }
    }

    // 5. Συννεφιά / Default
    const genres = userProfile === 'greek' ? ["Rock", "Έντεχνη", "Εναλλακτικά"] : ["Sophisticated", "House", "Cosmopolitan", "Εναλλακτικά"];
    return {
      title: `Alternative Mood ☁️`,
      subtitle: `Ο καιρός είναι μουντός (${temp}°C). Ψαγμένες μουσικές επιλογές που ταιριάζουν απόλυτα με την ατμόσφαιρα.`,
      genres: genres, 
      icon: <Music size={28} className="text-gray-300" />,
      gradient: "from-gray-800/40 to-black",
      borderColor: "border-gray-500/40",
      badgeColor: "bg-gray-500/20 text-gray-300 border-gray-500/40"
    };

  }, [weather, userProfile]);

  // --- 📡 AI DISCOVERY ENGINE (Πολλαπλά Genres + Randomize) ---
  const moodStations = useMemo(() => {
    const playedIds = recentlyPlayed.map(s => s._id);

    let localStations = [];
    if (userLocation && (userLocation.region || userLocation.city)) {
      localStations = stations.filter(s => 
        (s.region === userLocation.region || s.region === userLocation.city) && 
        !playedIds.includes(s._id)
      ).slice(0, 2);
      
      if (localStations.length === 0) {
        localStations = stations.filter(s => s.region === userLocation.region || s.region === userLocation.city).slice(0, 2);
      }
    }

    const localIds = localStations.map(s => s._id);
    
    // 🟢 Ψάχνουμε σταθμούς που ανήκουν ΣΕ ΕΝΑ ΑΠΟ ΤΑ ΠΟΛΛΑ GENRES του moodMatch!
    let discoveryStations = stations.filter(s => 
      moodMatch.genres.includes(s.genre) && 
      !playedIds.includes(s._id) && 
      !localIds.includes(s._id)
    ).sort(() => 0.5 - Math.random()); // Ανακάτεμα για να παίρνει λίγο από το κάθε είδος!

    let combined = [...localStations, ...discoveryStations].slice(0, 8);

    if (combined.length < 8) {
      const fillIns = stations.filter(s => 
        moodMatch.genres.includes(s.genre) && 
        !combined.map(c => c._id).includes(s._id)
      ).sort(() => 0.5 - Math.random());
      combined = [...combined, ...fillIns].slice(0, 8);
    }

    return combined;
  }, [stations, moodMatch.genres, recentlyPlayed, userLocation]);

  // --- 📍 NEARBY STATIONS LOGIC (ΕΝΤΟΣ 40 ΧΛΜ ΜΕ ΤΥΧΑΙΑ ΣΕΙΡΑ) ---
  const nearbyStations = useMemo(() => {
    if (!userCoords || !stations || stations.length === 0) return [];
    
    // 1. Υπολογίζουμε την απόσταση για κάθε σταθμό
    const stationsWithDistance = stations.map(s => {
      let sLat = s.latitude || s.lat; 
      let sLon = s.longitude || s.lng || s.lon;
      
      // Αν δεν έχει ακριβείς συντεταγμένες, ψάχνουμε στο λεξικό με βάση την πόλη ή την περιοχή
      if (!sLat || !sLon) {
        const coords = CITY_COORDINATES[s.city] || CITY_COORDINATES[s.region];
        if (coords) {
          sLat = coords[0];
          sLon = coords[1];
        }
      }
      
      // Αν πάλι δεν έχει, του βάζουμε μια τεράστια απόσταση για να κοπεί
      if (!sLat || !sLon) return { ...s, distance: Infinity };
      
      const distance = getDistanceFromLatLonInKm(userCoords.lat, userCoords.lon, sLat, sLon);
      return { ...s, distance };
    });

    // 2. Φιλτράρουμε αυτούς που είναι <= 40 χλμ, ΤΟΥΣ ΑΝΑΚΑΤΕΥΟΥΜΕ (Randomize) και κρατάμε 8
    const closeStations = stationsWithDistance
      .filter(s => s.distance <= 40)
      .sort(() => 0.5 - Math.random()) // 🎲 Το μαγικό τρικ για να ανακατεύεται η λίστα σε κάθε reload!
      .slice(0, 8);

    return closeStations;
  }, [userCoords, stations]);

  const isMobile = window.innerWidth <= 768;
  const itemsPerPage = isMobile ? 2 : 4;

  const favoriteStations = currentUser?.favorites ? stations.filter(s => currentUser.favorites.includes(s._id || s.id)) : [];
  const topStations = stations.filter(s => s.isFeatured === true || (s.boostStatus === true && s.position === 1));
  const homeDisplayStation = stations.find(s=>String(s._id)===String(heroStationId)) ||
    currentStation || recentlyPlayed[0] || topStations[0] || stations[0];
  const topRegions = ['Αττική', 'Αθήνα', 'Θεσσαλονίκη', 'WebRadios']; 
  const genres = [...new Set(stations.map(s => s.genre))].filter(Boolean).sort();

  // --- 📻 ΚΑΡΤΑ ΡΑΔΙΟΦΩΝΟΥ ---
  const StationCard = ({ station, isSmall = false, showRegion = false }) => {
    const isCurrent = currentStation && (currentStation._id === station._id);
    const isCurrentlyPlaying = isCurrent && isPlaying;

    const handlePlayBtnClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isCurrent) onPlayPause(); else setCurrentStation(station);
    };

    return (
      <div className={`group flex flex-col ${isSmall ? 'w-full' : ''}`}>
        <div
          className="group cursor-pointer flex flex-col relative"
          onClick={() => isCurrentlyPlaying ? navigate(`/station/${station.slug || station._id}`) : setCurrentStation(station)}
        >
          <div className={`ir-station-image relative aspect-square w-full rounded-2xl md:rounded-3xl overflow-hidden bg-white transition-all duration-500 group-hover:-translate-y-1`}>
            <img src={station.logo} alt={station.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isCurrentlyPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
            
            <div className={`absolute transition-all duration-500 z-10 ${isCurrentlyPlaying ? 'inset-0 flex items-center justify-center md:inset-auto md:bottom-4 md:right-4 md:w-10 md:h-10' : 'bottom-2 right-2 md:bottom-4 md:right-4 w-8 h-8 md:w-8 md:h-8 opacity-0 group-hover:opacity-100'}`}>
              <CircularVU analyser={analyser} isPlaying={isCurrentlyPlaying} />
              <div onClick={handlePlayBtnClick} className={`relative z-20 bg-[#ccff00] rounded-full flex items-center justify-center shadow-xl text-black ${isCurrentlyPlaying ? 'w-8 h-8 md:w-full md:h-full' : 'w-full h-full'}`}>
                {isCurrentlyPlaying ? <Pause size={isSmall ? 14 : 18} fill="currentColor" /> : <Play size={isSmall ? 14 : 18} className="ml-0.5" fill="currentColor" />}
              </div>
            </div>
          </div>
          
          <div className="mt-2 px-1 flex flex-col">
            <h3 className={`font-bold truncate transition-colors flex items-center gap-1 ${isSmall ? 'text-[10px]' : 'text-[14px] md:text-[18px]'} ${isCurrentlyPlaying ? 'text-[#ccff00]' : 'text-white'}`}>
              <span className="truncate">{station.name}</span>
              {station.boostStatus && (
                <Zap size={14} className="shrink-0 text-black bg-[#ccff00] rounded-full p-0.5 shadow-[0_0_10px_rgba(204,255,0,0.5)]" />
              )}
            </h3>
            
            {showRegion && (
              <div className="flex items-center gap-1.5 mt-1">
                {station.transmissionType && station.transmissionType !== 'Web Radio' && (
                   <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                     station.transmissionType === 'Επίγειο' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                   }`}>
                     <SignalHigh size={8} /> {station.transmissionType === 'Επίγειο' && station.frequency ? station.frequency : station.transmissionType}
                   </span>
                )}
                {station.region && (
                  <span className={`text-[10px] truncate font-bold transition-colors ${isCurrentlyPlaying ? 'text-[#ccff00]/70' : 'text-zinc-500'}`}>
                    {station.region}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TrackableAd = ({ banner, children, className }) => {
    const adRef = React.useRef(null);
    const tracked = React.useRef(false);

    React.useEffect(() => {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !tracked.current) {
          tracked.current = true;
          handleBannerView(banner._id);
        }
      }, { threshold: 0.5 });

      if (adRef.current) observer.observe(adRef.current);
      return () => observer.disconnect();
    }, [banner._id]);

    let campaign = "general_ir";
    if (banner.placement && banner.placement.includes('hero')) campaign = "hero_section_ir";
    else if (banner.placement && banner.placement.includes('home')) campaign = "homefeed_ir";
    
    const baseParams = `ref=iradiosapp&utm_medium=ilumadigitalagencyiradios&utm_source=iradios&utm_campaign=${campaign}&utm_content=${campaign}`;
    const finalUrl = `${banner.targetUrl}${banner.targetUrl.includes('?') ? '&' : '?'}${baseParams}`;

    return (
      <a 
        ref={adRef} 
        href={finalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} block cursor-pointer`} 
        onClick={(e) => {
          e.stopPropagation();
          fetch(`/api/banners/${banner._id}/click`, { method: 'POST' }).catch(err => console.error("Click error", err));
        }}
      >
        {children}
      </a>
    );
  };

  const HomeAdBanner = ({ banner }) => {
    if (!banner) return null;
    return (
      <TrackableAd 
        banner={banner}
        onClick={() => handleBannerClick(banner)} 
        className="w-full my-12 bg-emerald-900/10 border border-emerald-500/20 hover:border-emerald-500/50 rounded-[32px] p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 cursor-pointer group transition-all"
      >
        <div className="w-full md:w-1/3 h-32 md:h-40 rounded-2xl overflow-hidden shrink-0 bg-black">
          <img src={banner.imageUrl} alt="Ad" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-3 border border-emerald-500/30">
            <ShieldCheck size={10} /> SPONSORED
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{banner.title}</h3>
          <p className="text-sm text-zinc-400">{banner.description}</p>
        </div>
        <div className="shrink-0">
          <button className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors">
            ΔΕΙΤΕ ΠΕΡΙΣΣΟΤΕΡΑ <ExternalLink size={16} />
          </button>
        </div>
      </TrackableAd>
    );
  };

  return (
    <div className="ir-home-page relative mx-auto w-full max-w-[1720px] space-y-7 px-4 pb-36 pt-5 sm:px-6 md:space-y-8 md:pt-7 xl:px-8">
      
      {/* Personalized greeting and admin-managed editorial carousel. */}
      <div className="ir-home-heading relative overflow-hidden rounded-[26px] border border-[#ccff00]/10 bg-gradient-to-r from-[#191e17] via-[#101816] to-[#080b10] px-6 py-6 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-8 -top-24 h-64 w-64 rounded-full bg-[#ccff00]/10 blur-[75px]"/>
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-black tracking-[0.16em] text-[#ccff00]"><Radio size={17}/> iRadiosGR · Η ΜΟΥΣΙΚΗ ΣΟΥ</p>
            <h1 className={`text-3xl font-black italic tracking-tight sm:text-4xl ${isBirthday?'text-[#ccff00]':'text-white'}`}>{finalGreeting}</h1>
            <p className="mt-2 text-sm text-zinc-300 sm:text-base">
              {recentlyPlayed.length ? 'Οι σταθμοί που αγαπάς και νέες προτάσεις, όλα σε ένα μέρος.' : 'Βρες τον επόμενο αγαπημένο σου σταθμό, με ένα κλικ.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {currentUser&&<span className="rounded-full border border-[#ccff00]/25 bg-[#ccff00]/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#ccff00]">{isFreeOrGuest?'iRadios Member':'Premium Edition'}</span>}
            {!currentUser&&<button onClick={()=>navigate('/login')} className="ir-action-primary px-5"><LogIn size={16}/> Σύνδεση</button>}
            <button onClick={onOpenDiscovery} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-bold text-white hover:border-[#ccff00]/50"><Compass size={17}/> Ανακάλυψη</button>
          </div>
        </div>
      </div>
      <div className="ir-home-feature-grid grid items-stretch gap-4 xl:h-[390px] xl:grid-cols-[minmax(0,1.65fr)_minmax(310px,0.72fr)]">
        <HomeHeroSlider
          currentUser={currentUser}
          currentStation={currentStation}
          stations={stations}
          onPlayStation={setCurrentStation}
          onOpenDiscovery={onOpenDiscovery}
          onFeaturedStationChange={setHeroStationId}
        />
        <div id="home-playlist" className="min-h-0 scroll-mt-24">
        <StationPlaylistPanel
          station={homeDisplayStation}
          currentUser={currentUser}
          onPlayStation={setCurrentStation}
          compact
        />
        </div>
      </div>

      {/* Metadata-only Now Playing, plus actual listener history and favorites. */}
      <div className="ir-home-quick-grid grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(215px,0.75fr)_minmax(215px,0.75fr)]">
        <div className="min-w-0">
          {currentUser ? (
            <PlayingNow stations={stations} API_URL={API_URL} currentUser={currentUser}/>
          ) : (
            <section className="rounded-2xl border border-[#ccff00]/15 bg-[#ccff00]/[0.05] p-5">
              <h2 className="flex items-center gap-2 text-xl font-black text-white"><Radio size={21} className="text-[#ccff00]"/> Τώρα παίζουν</h2>
              <p className="mt-3 max-w-lg text-sm text-zinc-300">Συνδέσου για να βλέπεις τραγούδια και καλλιτέχνες μόνο από σταθμούς με πραγματικά metadata.</p>
              <button onClick={()=>navigate('/login')} className="ir-action-primary mt-4 px-5 text-sm"><LogIn size={16}/> Σύνδεση</button>
            </section>
          )}
        </div>
        <HomeRadioShortlist kind="recent" stations={recentlyPlayed} currentUser={currentUser} onPlayStation={setCurrentStation}/>
        <HomeRadioShortlist kind="favorites" stations={favoriteStations} currentUser={currentUser} onPlayStation={setCurrentStation}/>
      </div>

      <HomeRecommendationDeck moodStations={moodStations} topStations={topStations} onPlayStation={setCurrentStation}/>

      {/* The visual genre / region finder is the single browsing surface (no native selects). */}
      <HomeExplore
        stations={stations}
        currentUser={currentUser}
        recentStations={recentlyPlayed}
        favoriteStations={favoriteStations}
        onPlayStation={setCurrentStation}
        onOpenDiscovery={onOpenDiscovery}
      />

      {/* Existing paid home banners remain separate and clearly labelled as sponsored. */}
      {isFreeOrGuest && homeBanners.map(banner => <HomeAdBanner key={banner._id} banner={banner} />)}

      {/* 🟢 BROADCASTER PROMO BANNER (Bottom) */}
      {(!currentUser || currentUser?.role === 'user') && (
        <section className="mt-16 animate-fade-in">
          <div className="relative w-full overflow-hidden rounded-[32px] md:rounded-[40px] bg-[#0a0b0f] border border-white/5 hover:border-white/10 transition-all duration-500 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 group shadow-2xl">
            {/* Subtle Blue Glow from the image */}
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-blue-600/20 transition-all duration-700"></div>
            
            <div className="relative z-10 flex flex-col gap-4 max-w-3xl">
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter">Έχεις ραδιοφωνικό ή Web σταθμό;</h2>
              <p className="text-zinc-400 font-medium text-sm md:text-base leading-relaxed">
                Έλα στο δίκτυο του iRadios και πάρε τον απόλυτο έλεγχο. Αναβάθμισε τον ήχο σου με την ενσωματωμένη <strong className="text-white">DSP Engine</strong> (7 FM & Web presets) και διαχειρίσου τα έσοδά σου μέσω του <strong className="text-white">AdControl</strong>. 
                <br className="hidden md:block mt-2" />
                Οργάνωσε το 24ωρο πρόγραμμά σου, δώσε πρόσβαση στους <strong className="text-white">Producers</strong> του σταθμού, παρακολούθησε την ακροαματικότητά σου με <strong className="text-white">LIVE Analytics</strong> και αλληλεπίδρασε με το κοινό σε πραγματικό χρόνο μέσω του <strong className="text-white">Live Chat</strong>!
              </p>
            </div>
            
            <button 
              onClick={() => navigate('/broadcast')}
              className="relative z-10 w-full md:w-auto px-10 py-5 bg-white text-black hover:bg-zinc-200 rounded-2xl font-black uppercase text-xs md:text-sm tracking-[0.15em] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] group-hover:scale-105 shrink-0"
            >
              Ξεκινα δωρεαν
            </button>
          </div>
        </section>
      )}

    </div>
  );
}
