import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, ArrowLeft, MapPin, LayoutGrid, List, Music, Map as MapIcon, X, Zap, Globe, Activity, Megaphone, ExternalLink, SignalHigh } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CircularVU from '../components/CircularVU';
import EditorialPlacement from '../components/EditorialPlacement';
import CatalogFilterPopover from '../components/CatalogFilterPopover';
import StationCatalogCard from '../components/StationCatalogCard';
 

const REGIONS = [
  "Web Radio", "Αθήνα", "Θεσσαλονίκη",
  "Ανατολική Μακεδονία & Θράκη", "Κεντρική Μακεδονία", "Δυτική Μακεδονία",
  "Ήπειρος", "Θεσσαλία", "Ιόνια Νησιά", "Δυτική Ελλάδα", "Στερεά Ελλάδα",
  "Πελοπόννησος", "Βόρειο Αιγαίο", "Νότιο Αιγαίο", "Κρήτη", "Κύπρος", "Εξωτερικό"
];

// 🗺️ ΠΛΗΡΕΣ ΛΕΞΙΚΟ ΣΥΝΤΕΤΑΓΜΕΝΩΝ
const CITY_COORDINATES = {
  // --- ΓΕΝΙΚΑ ---
  "Ελλάδα": [37.9838, 23.7275], "Web Radio": [37.9838, 23.7275], 
  "Άλλη": [37.9838, 23.7275], "Άλλο": [37.9838, 23.7275], "Global": [37.9838, 23.7275],

  // --- ΑΤΤΙΚΗ ---
  "Αττική": [37.9838, 23.7275], "Αθήνα": [37.9838, 23.7275], "Πειραιάς": [37.9429, 23.6439], 
  "Νέα Σμύρνη": [37.9450, 23.7136], "Καλλιθέα": [37.9531, 23.7006], "Παλαιό Φάληρο": [37.9250, 23.6931], 
  "Άλιμος": [37.9111, 23.7228], "Ελληνικό": [37.8864, 23.7436], "Αργυρούπολη": [37.9022, 23.7461], 
  "Γλυφάδα": [37.8628, 23.7561], "Βούλα": [37.8425, 23.7744], "Βουλιαγμένη": [37.8131, 23.7803], 
  "Ηλιούπολη": [37.9306, 23.7556], "Άγιος Δημήτριος": [37.9333, 23.7333], "Ζωγράφου": [37.9733, 23.7667], 
  "Καισαριανή": [37.9667, 23.7500], "Βύρωνας": [37.9500, 23.7500], "Γαλάτσι": [38.0167, 23.7500], 
  "Νέα Ιωνία": [38.0417, 23.7583], "Νέο Ηράκλειο": [38.0500, 23.7667], "Νέα Φιλαδέλφεια": [38.0333, 23.7333], 
  "Χαλάνδρι": [38.0222, 23.7997], "Μαρούσι": [38.0560, 23.8055], "Κηφισιά": [38.0733, 23.8122], 
  "Πεύκη": [38.0667, 23.8000], "Μελίσσια": [38.0500, 23.8333], "Βριλήσσια": [38.0333, 23.8333], 
  "Αγία Παρασκευή": [38.0167, 23.8167], "Περιστέρι": [38.0154, 23.6919], "Αιγάλεω": [37.9933, 23.6817], 
  "Χαϊδάρι": [38.0167, 23.6500], "Ίλιον": [38.0333, 23.7000], "Πετρούπολη": [38.0333, 23.6833], 
  "Αγία Βαρβάρα": [37.9833, 23.6500], "Νίκαια": [37.9667, 23.6333], "Κορυδαλλός": [37.9760, 23.6470], 
  "Κερατσίνι": [37.9667, 23.6167], "Δραπετσώνα": [37.9500, 23.6167], "Πέραμα": [37.9667, 23.5667], 
  "Σαλαμίνα": [37.9667, 23.5000], "Ελευσίνα": [38.0333, 23.5333], "Αχαρνές": [38.0833, 23.7333], 
  "Παλλήνη": [38.0000, 23.8667], "Γέρακας": [38.0167, 23.8500], "Κορωπί": [37.9000, 23.8667], 
  "Μαρκόπουλο": [37.8833, 23.9333], "Ραφήνα": [38.0167, 24.0000], "Λαύριο": [37.7167, 24.0500],

  // --- ΘΕΣΣΑΛΟΝΙΚΗ ---
  "Θεσσαλονίκη": [40.6401, 22.9444], "Καλαμαριά": [40.5828, 22.9547], "Εύοσμος": [40.6631, 22.9090], 
  "Κορδελιό": [40.6667, 22.9000], "Αμπελόκηποι": [40.6500, 22.9333], "Μενεμένη": [40.6500, 22.9167], 
  "Σταυρούπολη": [40.6667, 22.9333], "Πολίχνη": [40.6667, 22.9500], "Νεάπολη": [40.6500, 22.9500], 
  "Συκιές": [40.6500, 22.9667], "Πυλαία": [40.6000, 22.9833], "Χορτιάτης": [40.6167, 23.1000], 
  "Πανόραμα": [40.5833, 23.0333], "Θέρμη": [40.5422, 23.0189], "Ωραιόκαστρο": [40.7286, 22.9173], 
  "Μηχανιώνα": [40.4667, 22.8333], "Περαία": [40.5000, 22.9333], "Σίνδος": [40.6667, 22.8000], 
  "Χαλάστρα": [40.6333, 22.7333],

  // --- ΥΠΟΛΟΙΠΗ ΕΛΛΑΔΑ ---
  "Αιτωλοακαρνανία": [38.6259, 21.4116], "Μεσολόγγι": [38.3687, 21.4286], "Αγρίνιο": [38.6259, 21.4116], "Ναύπακτος": [38.3934, 21.8268],
  "Αργολίδα": [37.5673, 22.8016], "Ναύπλιο": [37.5673, 22.8016], "Άργος": [37.6329, 22.7291],
  "Αρκαδία": [37.5089, 22.3732], "Τρίπολη": [37.5089, 22.3732], "Μεγαλόπολη": [37.4011, 22.1378],
  "Άρτα": [39.1611, 20.9856],
  "Αχαΐα": [38.2466, 21.7346], "Πάτρα": [38.2466, 21.7346], "Αίγιο": [38.2511, 22.0822], "Καλάβρυτα": [38.0315, 22.1105],
  "Βοιωτία": [38.4367, 22.8761], "Λιβαδειά": [38.4367, 22.8761], "Θήβα": [38.3243, 23.3182], "Αράχωβα": [38.4800, 22.5855],
  "Γρεβενά": [40.0845, 21.4274],
  "Δράμα": [41.1528, 24.1472],
  "Δωδεκάνησα": [36.4341, 28.2236], "Ρόδος": [36.4341, 28.2236], "Κως": [36.8932, 27.2885], "Κάλυμνος": [36.9497, 26.9772], "Κάρπαθος": [35.5070, 27.2132],
  "Έβρος": [40.8499, 25.8764], "Αλεξανδρούπολη": [40.8499, 25.8764], "Ορεστιάδα": [41.3811, 26.5333], "Διδυμότειχο": [41.3503, 26.4950],
  "Εύβοια": [38.4623, 23.5950], "Χαλκίδα": [38.4623, 23.5950], "Κάρυστος": [38.0163, 24.4196],
  "Ευρυτανία": [38.9135, 21.7954], "Καρπενήσι": [38.9135, 21.7954],
  "Ζάκυνθος": [37.7885, 20.8986],
  "Ηλεία": [37.6751, 21.4420], "Πύργος": [37.6751, 21.4420], "Αμαλιάδα": [37.7959, 21.3499],
  "Ημαθία": [40.5235, 22.2023], "Βέροια": [40.5235, 22.2023], "Νάουσα": [40.6277, 22.0673], "Αλεξάνδρεια": [40.6277, 22.4435],
  "Ηράκλειο": [35.3387, 25.1442], "Μοίρες": [35.0519, 24.8733], "Χερσόνησος": [35.3168, 25.3912],
  "Θεσπρωτία": [39.5055, 20.2655], "Ηγουμενίτσα": [39.5055, 20.2655],
  "Ιωάννινα": [39.6649, 20.8519], "Μέτσοβο": [39.7695, 21.1834],
  "Καβάλα": [40.9396, 24.4069],
  "Καρδίτσα": [39.3644, 21.9214],
  "Καστοριά": [40.5222, 21.2678],
  "Κέρκυρα": [39.6200, 19.9197],
  "Κεφαλληνία": [38.1764, 20.4892], "Αργοστόλι": [38.1764, 20.4892], "Ληξούρι": [38.2017, 20.4357],
  "Κιλκίς": [40.9930, 22.8743],
  "Κοζάνη": [40.3000, 21.7833], "Πτολεμαΐδα": [40.5147, 21.6781],
  "Κορινθία": [37.9396, 22.9271], "Κόρινθος": [37.9396, 22.9271], "Λουτράκι": [37.9747, 22.9754], "Κιάτο": [38.0131, 22.7483],
  "Κυκλάδες": [37.4385, 24.9405], "Σύρος": [37.4385, 24.9405], "Νάξος": [37.1056, 25.3764], "Μύκονος": [37.4467, 25.3289], "Σαντορίνη": [36.3932, 25.4615], "Πάρος": [37.0855, 25.1488], "Τήνος": [37.5375, 25.1627], "Μήλος": [36.7431, 24.4253],
  "Λακωνία": [37.0745, 22.4297], "Σπάρτη": [37.0745, 22.4297], "Γύθειο": [36.7621, 22.5647],
  "Λάρισα": [39.6390, 22.4191], "Ελασσόνα": [39.8953, 22.1882], "Φάρσαλα": [39.2946, 22.3857],
  "Λασίθι": [35.1906, 25.7155], "Άγιος Νικόλαος": [35.1906, 25.7155], "Ιεράπετρα": [35.0101, 25.7369], "Σητεία": [35.2057, 26.1050],
  "Λέσβος": [39.1061, 26.5560], "Μυτιλήνη": [39.1061, 26.5560],
  "Λευκάδα": [38.8313, 20.7061],
  "Μαγνησία": [39.3621, 22.9424], "Βόλος": [39.3621, 22.9424], "Αλμυρός": [39.1818, 22.7592],
  "Μεσσηνία": [37.0391, 22.1126], "Καλαμάτα": [37.0391, 22.1126], "Μεσσήνη": [37.0504, 22.0084],
  "Ξάνθη": [41.1349, 24.8896],
  "Πέλλα": [40.8016, 22.0461], "Έδεσσα": [40.8016, 22.0461], "Γιαννιτσά": [40.7937, 22.4118],
  "Πιερία": [40.2696, 22.5061], "Κατερίνη": [40.2696, 22.5061],
  "Πρέβεζα": [38.9562, 20.7431], "Πάργα": [39.2844, 20.4005],
  "Ρέθυμνο": [35.3656, 24.4820],
  "Ροδόπη": [41.1192, 25.4054], "Κομοτηνή": [41.1192, 25.4054],
  "Σάμος": [37.7554, 26.9749],
  "Σέρρες": [41.0921, 23.5498],
  "Τρίκαλα": [39.5557, 21.7679], "Καλαμπάκα": [39.7042, 21.6263],
  "Φθιώτιδα": [38.8953, 22.4336], "Λαμία": [38.8953, 22.4336],
  "Φλώρινα": [40.7816, 21.4093], "Αμύνταιο": [40.6896, 21.6789],
  "Φωκίδα": [38.5262, 22.3781], "Άμφισσα": [38.5262, 22.3781], "Δελφοί": [38.4805, 22.5029],
  "Χαλκιδική": [40.3776, 23.4398], "Πολύγυρος": [40.3776, 23.4398], "Νέα Μουδανιά": [40.2407, 23.2825],
  "Χανιά": [35.5138, 24.0180], "Κίσσαμος": [35.4947, 23.6543],
  "Χίος": [38.3678, 26.1361],

  // --- ΚΥΠΡΟΣ ---
  "Κύπρος": [35.1666, 33.3666],
  "Λευκωσία": [35.1856, 33.3823], "Στρόβολος": [35.1504, 33.3444], "Λακατάμεια": [35.1118, 33.3214],
  "Λεμεσός": [34.6786, 33.0420],
  "Λάρνακα": [34.9115, 33.6232],
  "Πάφος": [34.7720, 32.4265],
  "Αμμόχωστος": [35.0396, 33.9829], "Παραλίμνι": [35.0396, 33.9829], "Αγία Νάπα": [34.9915, 34.0017],
  "Κερύνεια": [35.3333, 33.3167],

  // --- ΕΞΩΤΕΡΙΚΟ ---
  "Εξωτερικό": [51.5074, -0.1278],
  "Ευρώπη": [51.5074, -0.1278], "Λονδίνο": [51.5074, -0.1278], "Παρίσι": [48.8566, 2.3522], "Βερολίνο": [52.5200, 13.4050],
  "Αμερική": [40.7128, -74.0060], "Νέα Υόρκη": [40.7128, -74.0060], "Σικάγο": [41.8781, -87.6298],
  "Αυστραλία": [-33.8688, 151.2093], "Σίδνεϊ": [-33.8688, 151.2093], "Μελβούρνη": [-37.8136, 144.9631]
};

const createNeonIcon = () => {
  return L.divIcon({
    className: 'custom-neon-marker',
    html: `
      <div class="relative w-6 h-6 flex items-center justify-center">
        <div class="absolute inset-0 bg-[#ccff00] rounded-full opacity-40 animate-ping"></div>
        <div class="w-3 h-3 bg-[#ccff00] border-2 border-black rounded-full shadow-[0_0_15px_#ccff00] z-10"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 9, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

export default function Region({ stations, currentStation, setCurrentStation, isPlaying, onPlayPause, analyser, currentUser, userLocation, checkGeoMatch }) {
  const { regionName } = useParams();
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState('popularity');
  const [viewMode, setViewMode] = useState('grid');
  
  const [selectedGenre, setSelectedGenre] = useState('all'); 
  const [selectedTransmission, setSelectedTransmission] = useState('all');
  
  const [activeBanners, setActiveBanners] = useState([]);

  const isPremiumUser = Boolean(
    currentUser && (
      currentUser.role === 'admin' || 
      currentUser.isPremium === true || 
      currentUser.isPremium === 'true' || 
      currentUser?.broadcasterProfile?.tier === 'premium'
    )
  );
  
  const isFreeOrGuest = !isPremiumUser;

  useEffect(() => {
    if (isFreeOrGuest) {
      fetch(`/api/banners/active`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          // 🚨 1. Κρατάμε ΑΥΣΤΗΡΑ μόνο τα active
          const strictlyActiveBanners = data.filter(banner => banner.status === 'active');
          
          if (checkGeoMatch && userLocation) {
            // 🚨 2. Φιλτράρουμε το strictlyActiveBanners (ΟΧΙ το data)
            const geoFilteredBanners = strictlyActiveBanners.filter(banner => {
              const targetArea = (banner.targetLocations && banner.targetLocations.length > 0) ? banner.targetLocations[0] : 'All';
              return checkGeoMatch(targetArea, userLocation);
            });
            setActiveBanners(geoFilteredBanners);
          } else {
            // 🚨 3. Περνάμε το strictlyActiveBanners (ΟΧΙ το data)
            setActiveBanners(strictlyActiveBanners);
          }
        })
        .catch(err => console.error(err));
    } else {
      setActiveBanners([]);
    }
  }, [isFreeOrGuest, userLocation, checkGeoMatch]);

  // SQUARE BANNERS (Για τα μικρά slots του grid)
  const radioFeedBanners = useMemo(() => {
    if (isPremiumUser) return []; 
    return activeBanners.filter(b => b.placement && b.placement.includes('radio_feed'));
  }, [activeBanners, isPremiumUser]);

  // 🔥 HERO BANNERS (Για τα μεγάλα full-width slots)
  const homeBanners = useMemo(() => {
    if (isPremiumUser) return []; 
    return activeBanners.filter(b => b.placement && b.placement.includes('home'));
  }, [activeBanners, isPremiumUser]);

  const baseStations = useMemo(() => stations.filter(s => s.region === regionName || s.city === regionName), [stations, regionName]);

  const availableGenres = useMemo(() => {
    return [...new Set(baseStations.map(s => s.genre))].filter(Boolean).sort();
  }, [baseStations]);

  const availableTransmissions = useMemo(() => {
    return [...new Set(baseStations.map(s => s.transmissionType || 'Web Radio'))].filter(Boolean).sort();
  }, [baseStations]);

  const filteredAndSorted = useMemo(() => {
    let result = [...baseStations];
    
    if (selectedGenre !== 'all') result = result.filter(s => s.genre === selectedGenre);
    if (selectedTransmission !== 'all') result = result.filter(s => (s.transmissionType || 'Web Radio') === selectedTransmission);

    return result.sort((a, b) => {
      if (sortBy === 'popularity') return (b.popularity || 0) - (a.popularity || 0);
      if (sortBy === 'alphabetical') return a.name.localeCompare(b.name);
      if (sortBy === 'frequency') {
        const getFreq = (st) => (st.transmissionType === 'Επίγειο' && st.frequency) ? parseFloat(st.frequency) || 9999 : 9999;
        return getFreq(a) - getFreq(b);
      }
      return 0;
    });
  }, [baseStations, selectedGenre, selectedTransmission, sortBy]);

  const cityGroups = useMemo(() => {
    const groups = {};
    filteredAndSorted.forEach(station => {
      const city = station.city && station.city !== "Άλλη" ? station.city : (station.region || "Άγνωστη");
      if (!groups[city]) groups[city] = [];
      groups[city].push(station);
    });
    return groups;
  }, [filteredAndSorted]);

  const formatGenre = (text) => text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";

  const mapCenter = useMemo(() => CITY_COORDINATES[regionName] || [38.2, 23.8], [regionName]);
  const canShowMap = CITY_COORDINATES[regionName] !== undefined;

  useEffect(() => {
    if (!canShowMap && viewMode === 'map') setViewMode('grid');
  }, [regionName, canShowMap, viewMode]);

  const handleBannerView = async (bannerId) => {
    try { await fetch(`/api/banners/${bannerId}/impression`, { method: 'POST' }); } catch (e) {}
  };

  const TrackableAdWrapper = ({ banner, children, className }) => {
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

    const baseParams = "ref=iradiosapp&utm_medium=ilumadigitalagencyiradios&utm_source=iradios&utm_campaign=radiofeed_ir&utm_content=radiofeed_ir";
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
          fetch(`/api/banners/${banner._id}/click`, { method: 'POST' }).catch(err => {});
        }}
      >
        {children}
      </a>
    );
  };

  const SquareAdCard = ({ banner }) => (
    <TrackableAdWrapper banner={banner} className="group flex flex-col relative cursor-pointer h-full">
      <div className="relative aspect-square w-full rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-900 shadow-lg border border-purple-500/30 transition-all duration-500 group-hover:-translate-y-1 group-hover:border-purple-500 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]">
        <img src={banner.squareImageUrl || banner.imageUrl} alt={banner.title} className="w-full h-full object-contain bg-white transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
        <div className="absolute top-2 right-2 bg-purple-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-1 shadow-md">
          <Megaphone size={8} /> AD
        </div>
      </div>
      <div className="mt-2 px-1">
        <h3 className="font-bold text-[14px] md:text-[18px] text-purple-400 truncate flex items-center gap-1">
          {banner.title} <ExternalLink size={12} />
        </h3>
        <p className="text-[9px] md:text-[12px] text-zinc-500 font-black tracking-widest truncate uppercase">Sponsored</p>
      </div>
    </TrackableAdWrapper>
  );

  return (
    <div className="ir-catalog-page relative w-full animate-fade-in px-4 pb-40 pt-6 md:px-8 md:pt-9">
      
      <Helmet>
        <title>{`Ραδιόφωνα από ${regionName} | iRadios`}</title>
        <meta name="keywords" content={`iRadios, ραδιόφωνο, ${regionName}, online radio, web radio, ελληνικό ραδιόφωνο, eradio, ζωντανή μουσική, ιντερνετικό ραδιόφωνο, εραδιο, ραδιοφωνικοί σταθμοί, podcasts, λιωε24, live24, ILUMA Digital Agency`} />
        <meta name="description" content={`Ραδιόφωνα ${regionName} LIVE στο iRadios App. Όλα τα ραδιόφωνα σε μία εφαρμογή. Streaming radio από Αθήνα, Θεσσαλονίκη, Κύπρο και τα κορυφαία Greek Radios είναι εδώ.`} />
        <meta property="og:title" content={`Ραδιόφωνα ${regionName} στο iRadios App`} />
        <meta property="og:description" content={`Ακούστε Ραδιόφωνα ${regionName} LIVE. Όλα τα ραδιόφωνα σε μία εφαρμογή. Streaming radio από Αθήνα, Θεσσαλονίκη, Κύπρο και τα κορυφαία Greek Radios είναι εδώ.`} />
      </Helmet>

      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-8 md:mb-12 group">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> 
        <span className="text-[10px] font-black tracking-[0.2em] uppercase">Επιστροφη</span>
      </button>

      <div className="ir-catalog-heading mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white italic flex items-center gap-4">
            {canShowMap ? <MapPin className="text-[#ccff00]" size={36} /> : <Globe className="text-[#ccff00]" size={36} />}
            {regionName}
          </h2>
          <p className="text-[11px] md:text-sm text-zinc-500 mt-2 font-bold tracking-widest uppercase">
            {filteredAndSorted.length} Σταθμοι 
            {selectedGenre !== 'all' && ` με μουσική ${selectedGenre}`}
            {selectedTransmission !== 'all' && ` (${selectedTransmission})`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <CatalogFilterPopover label="Είδος" value={selectedGenre} onChange={setSelectedGenre}
            options={availableGenres} allLabel="Όλα τα είδη"/>
          <CatalogFilterPopover label="Μετάδοση" value={selectedTransmission} onChange={setSelectedTransmission}
            options={availableTransmissions} allLabel="Όλες οι μεταδόσεις"/>
          <CatalogFilterPopover label="Ταξινόμηση" value={sortBy} onChange={setSortBy} searchable={false}
            options={[{value:'popularity',label:'Δημοτικότητα'},{value:'frequency',label:'Συχνότητα'},{value:'alphabetical',label:'Αλφαβητικά'}]}/>
          <div className="flex items-center bg-zinc-900 border border-white/10 rounded-xl p-1">
            {canShowMap && (
              <button type="button" aria-label="Προβολή χάρτη" onClick={() => setViewMode('map')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'map' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><MapIcon size={16} /></button>
            )}
            <button type="button" aria-label="Προβολή πλέγματος" onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><LayoutGrid size={16} /></button>
            <button type="button" aria-label="Προβολή λίστας" onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#ccff00] text-black shadow-md' : 'text-zinc-500 hover:text-white'}`}><List size={16} /></button>
          </div>
        </div>
      </div>

      <EditorialPlacement placement="region" value={regionName}
        currentUser={currentUser} stations={stations} currentStation={currentStation} isPlaying={isPlaying}
        onPlayStation={setCurrentStation} onPlayPause={onPlayPause} />

      {viewMode !== 'map' && filteredAndSorted.length > 0 && (
        <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 md:gap-5" : "flex flex-col gap-3 max-w-4xl"}>
          {filteredAndSorted.map((station, index) => {
            const isCurrent = currentStation && (currentStation._id === station._id);
            const isCurrentlyPlaying = isCurrent && isPlaying;
            
            // 🟢 ΤΑ ΜΙΚΡΑ (SQUARE) BANNERS
            const showAd = isFreeOrGuest && index > 0 && index % 5 === 0 && radioFeedBanners.length > 0;
            const currentBanner = showAd ? radioFeedBanners[Math.floor(index / 5) % radioFeedBanners.length] : null;

            // 🔥 ΤΑ ΜΕΓΑΛΑ (FULL WIDTH) BANNERS - Κάθε 12 σταθμούς στο GRID view
            const showFullBanner = viewMode === 'grid' && isFreeOrGuest && index > 0 && index % 12 === 0 && homeBanners.length > 0;
            const currentFullBanner = showFullBanner ? homeBanners[Math.floor(index / 12) % homeBanners.length] : null;

            return (
              <React.Fragment key={station._id}>
                
                {/* 🔥 FULL WIDTH BANNER INJECTION */}
                {showFullBanner && currentFullBanner && (
                  <div className="col-span-full py-4 md:py-8">
                    <TrackableAdWrapper banner={currentFullBanner} className="relative w-full h-[200px] md:h-[350px] rounded-[32px] md:rounded-[40px] overflow-hidden group border border-purple-500/20 hover:border-purple-500 shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)] transition-all duration-500 block">
                      <img src={currentFullBanner.imageUrl} alt={currentFullBanner.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                      
                      <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-purple-500 text-white text-[10px] md:text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg z-10">
                        <Megaphone size={14} /> Sponsored
                      </div>

                      <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="max-w-2xl">
                          <h3 className="text-2xl md:text-4xl font-black text-white mb-2 leading-tight group-hover:text-purple-300 transition-colors">{currentFullBanner.title}</h3>
                          <p className="text-zinc-300 text-xs md:text-base line-clamp-2 md:line-clamp-3">{currentFullBanner.description}</p>
                        </div>
                        <span className="inline-flex items-center justify-center gap-2 bg-[#ccff00] text-black px-6 py-3.5 md:px-8 md:py-4 rounded-2xl text-xs font-black uppercase tracking-widest group-hover:bg-white transition-colors shrink-0 shadow-xl">
                          Μαθε Περισσοτερα <ExternalLink size={16} />
                        </span>
                      </div>
                    </TrackableAdWrapper>
                  </div>
                )}

                {/* 🟢 SQUARE BANNER INJECTION */}
                {showAd && currentBanner && (
                  viewMode === 'grid' ? <SquareAdCard banner={currentBanner} /> : (
                    <TrackableAdWrapper 
                      banner={currentBanner} 
                      className="flex items-center gap-4 p-3 bg-purple-900/10 border border-purple-500/20 rounded-2xl cursor-pointer hover:bg-purple-900/20 transition-all"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-black">
                        <img src={currentBanner.squareImageUrl || currentBanner.imageUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-purple-400 text-sm">{currentBanner.title}</h3>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Sponsored Content</p>
                      </div>
                      <ExternalLink size={16} className="text-purple-500 mr-2" />
                    </TrackableAdWrapper>
                  )
                )}

                {/* Shared premium station card; profile navigation is separate from live playback. */}
                <StationCatalogCard station={station} currentStation={currentStation} isPlaying={isPlaying}
                  onPlayStation={setCurrentStation} onPlayPause={onPlayPause} mode={viewMode} />
              </React.Fragment>
            );
          })}
        </div>
      )}

      {viewMode === 'map' && canShowMap && (
        <div className="relative w-full h-[80vh] bg-zinc-950 rounded-[40px] border border-white/10 overflow-hidden shadow-2xl mt-4">
          <MapContainer center={mapCenter} zoom={9} className="w-full h-full z-[10]" zoomControl={false}>
            <MapUpdater center={mapCenter} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; CARTO' />
            
            {Object.entries(cityGroups).map(([city, stList]) => {
              const position = CITY_COORDINATES[city] || [mapCenter[0], mapCenter[1]];
              return (
                <Marker key={city} position={position} icon={createNeonIcon()}>
                  {/* 🪟 CUSTOM POPUP MODAL (Sexy, Dark & Wider) */}
                  <Popup className="custom-popup" closeButton={false}>
                    <div className="bg-zinc-950 border border-white/10 rounded-2xl w-[320px] overflow-hidden shadow-2xl p-0">
                      
                      {/* HEADER */}
                      <div className="bg-[#ccff00] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-black">
                          <MapPin size={16} className="fill-black" />
                          <span className="font-black text-sm tracking-widest uppercase">{city}</span>
                        </div>
                        <span className="text-[10px] font-bold text-black/70 bg-black/10 px-2.5 py-0.5 rounded-full">
                          {stList.length} ΣΤΑΘΜΟΙ
                        </span>
                      </div>
                      
                      {/* STATIONS LIST */}
                      <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {stList.map(station => {
                          const isThisStationPlaying = currentStation?._id === station._id && isPlaying;

                          return (
                            <div 
                              key={station._id} 
                              className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-colors cursor-pointer group" 
                              onClick={() => navigate(`/station/${station.slug || station._id}`)}
                            >
                              {/* Station Logo */}
                              <img src={station.logo} className="w-12 h-12 rounded-lg object-contain bg-white border border-white/10 bg-white shrink-0" alt="" />
                              
                              {/* Station Info */}
                              <div className="flex-1 min-w-0 text-left">
                                <h4 className={`font-bold text-sm truncate transition-colors ${isThisStationPlaying ? 'text-[#ccff00]' : 'text-white group-hover:text-[#ccff00]'}`}>
                                  {station.name}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-1">
                                  {station.transmissionType && station.transmissionType !== 'Web Radio' && (
                                     <span className={`shrink-0 text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center ${
                                       station.transmissionType === 'Επίγειο' ? 'text-blue-400 bg-blue-500/10' : 'text-purple-400 bg-purple-500/10'
                                     }`}>
                                       {station.transmissionType === 'Επίγειο' && station.frequency ? station.frequency : station.transmissionType}
                                     </span>
                                  )}
                                  <p className="text-[10px] text-zinc-500 font-medium truncate uppercase">{station.genre}</p>
                                </div>
                              </div>

                              {/* Play / Pause Button */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (currentStation?._id === station._id) {
                                    onPlayPause();
                                  } else {
                                    setCurrentStation(station); // Χρησιμοποιούμε το setCurrentStation εδώ
                                  }
                                }}
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${isThisStationPlaying ? 'bg-[#ccff00] text-black shadow-[0_0_10px_#ccff00]' : 'bg-white/10 text-white group-hover:bg-[#ccff00] group-hover:text-black'}`}
                              >
                                {isThisStationPlaying ? (
                                  <Activity size={14} className="animate-pulse" />
                                ) : (
                                  <Play size={14} className="ml-0.5" fill="currentColor" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}
      
      {filteredAndSorted.length === 0 && (
        <div className="text-zinc-500 font-bold italic py-20 text-center w-full bg-zinc-900/20 rounded-[32px] border border-white/5 mt-4">Δεν βρέθηκαν σταθμοί με αυτά τα κριτήρια.</div>
      )}

      {/* 🚨 ΑΥΣΤΗΡΟ CSS ΓΙΑ ΤΟ LEAFLET POPUP - Σκοτώνει το λευκό φόντο! */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          padding: 0 !important;
          border: none !important;
          border-radius: 1rem !important;
          box-shadow: none !important;
        }
        .custom-popup .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
        }
        .custom-popup .leaflet-popup-tip {
          background: #ccff00 !important;
          border: none !important;
          box-shadow: none !important;
        }
        .custom-popup a.leaflet-popup-close-button {
          display: none !important;
        }
      `}} />
    </div>
  );
}
