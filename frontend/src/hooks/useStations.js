import { useState, useEffect, useMemo } from 'react';

// ⚠️ Helper function για εύκολο ανακάτεμα πινάκων
const shuffleArray = (array) => {
  return [...array].sort(() => Math.random() - 0.5);
};

export default function useStations(API_URL, currentUser, currentStation, setCurrentStation) {
  const [stations, setStations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const fetchGlobalStations = async () => {
    try {
      const response = await fetch(`${API_URL}/stations`);
      const data = await response.json();
      if (Array.isArray(data)) setStations(prev=>JSON.stringify(prev)===JSON.stringify(data)?prev:data);
    } catch (error) { 
      console.error(error); 
    }
  };

  useEffect(() => {
    fetchGlobalStations();
    // Daily XML programs can change while the app is open; refresh public
    // station schedules without remounting or interrupting the audio element.
    const refresh=()=>{if(!document.hidden)fetchGlobalStations();};
    const timer=setInterval(refresh,5*60*1000);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  }, [API_URL]);

  // ==============================================================
  // 🚀 ADMIN OVERRIDE FIX: Στέλνει το Token στο Backend για DSP!
  // ==============================================================
  const handleUpdateStationDSP = async (stationId, newPreset) => {
    try {
      // 1. Παίρνουμε το κλειδί του Admin/Broadcaster
      const token = localStorage.getItem('iluma_token'); 

      // 2. Στέλνουμε το αίτημα στο Backend με την Ταυτότητά μας
      const res = await fetch(`${API_URL}/stations/${stationId}/dsp`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // 🔑 ΕΔΩ ΕΙΝΑΙ ΤΟ ΜΥΣΤΙΚΟ!
        },
        body: JSON.stringify({ dspPreset: newPreset })
      });
      
      if (res.ok) {
        const updatedStation = await res.json();
        
        // 3. Ενημερώνουμε το UI
        setStations(prev => prev.map(s => s._id === stationId ? updatedStation : s));
        if (currentStation && currentStation._id === stationId) {
          setCurrentStation(prev => ({ ...prev, dspPreset: newPreset }));
        }
        return true;
      } else {
        const errorData = await res.json();
        console.error("Αποτυχία ενημέρωσης DSP:", errorData.error);
        return false;
      }
    } catch (err) {
      console.error("Σφάλμα κατά την επικοινωνία με τον server:", err);
      return false;
    }
  };

  const filteredSearch = searchTerm.length > 0 
    ? stations.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.genre.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // ==============================================================
  // 🧠 SMART ZAPPING LOGIC (Bulletproof Edition)
  // ==============================================================
  const zappingPlaylist = useMemo(() => {
    if (!stations || stations.length === 0) return [];

    let playlist = [];

    // --- 1. ΛΟΓΙΚΗ ΓΙΑ GUESTS (Χωρίς Σύνδεση) ---
    if (!currentUser) {
      const featured = shuffleArray(stations.filter(s => s.isFeatured));
      const others = shuffleArray(stations.filter(s => !s.isFeatured));

      playlist.push(...featured);
      playlist.push(...others.splice(0, 5));
      playlist.push(...shuffleArray(featured)); 
      playlist.push(...others);

      return playlist;
    }

    // --- ΟΡΓΑΝΩΣΗ ΔΕΔΟΜΕΝΩΝ ΓΙΑ USERS / PREMIUM ---
    const userFavIds = currentUser?.favorites || [];
    // Ασφαλής έλεγχος για το αν ένας σταθμός είναι στα αγαπημένα
    const isFav = (s) => userFavIds.includes(s._id) || userFavIds.includes(s.id);

    const favorites = stations.filter(s => isFav(s));
    const favGenres = [...new Set(favorites.map(s => s.genre).filter(Boolean))];

    // Διαθέσιμοι σταθμοί (που ΔΕΝ είναι στα αγαπημένα για να μην τους ακούσει διπλά)
    let availableFeatured = shuffleArray(stations.filter(s => s.isFeatured && !isFav(s)));
    let availableSameGenre = shuffleArray(stations.filter(s => favGenres.includes(s.genre) && !s.isFeatured && !isFav(s)));
    let availableRandom = shuffleArray(stations.filter(s => !favGenres.includes(s.genre) && !s.isFeatured && !isFav(s)));

    // --- 2. ΛΟΓΙΚΗ ΓΙΑ PREMIUM USERS ---
    if (currentUser.isPremium) {
      playlist.push(...favorites);
      
      // Προσπαθούμε να βάλουμε 4 από το ίδιο genre
      let addedGenres = availableSameGenre.splice(0, 4);
      playlist.push(...addedGenres);
      
      // 💡 FALLBACK: Αν δεν βρήκε 4 από το ίδιο genre, συμπληρώνει με τυχαία (Random)
      if (addedGenres.length < 4) {
        playlist.push(...availableRandom.splice(0, 4 - addedGenres.length));
      }
      
      // Βάζουμε 1 Featured (Αν δεν υπάρχουν featured, ρίχνει άλλο ένα τυχαίο)
      if (availableFeatured.length > 0) {
        playlist.push(availableFeatured.splice(0, 1)[0]);
      } else if (availableRandom.length > 0) {
        playlist.push(availableRandom.splice(0, 1)[0]);
      }
      
      return playlist;
    }

    // --- 3. ΛΟΓΙΚΗ ΓΙΑ ΑΠΛΟΥΣ USERS (Free) ---
    playlist.push(...favorites);
    
    // Προσπαθούμε να βάλουμε 2 από το ίδιο genre
    let sameGenreToAdd = availableSameGenre.splice(0, 2);
    playlist.push(...sameGenreToAdd);
    
    // 💡 FALLBACK: Αν δεν υπάρχουν 2 ίδια, βάζουμε 2 τυχαία
    if (sameGenreToAdd.length < 2) {
      playlist.push(...availableRandom.splice(0, 2 - sameGenreToAdd.length));
    }

    // Ενώνουμε όσους έμειναν από το ίδιο genre με τους υπόλοιπους τυχαίους
    let remainingRandom = shuffleArray([...availableSameGenre, ...availableRandom]);

    // Χτίζουμε το υπόλοιπο playlist με το μοτίβο [4 Τυχαία, 1 Featured]
    while (remainingRandom.length > 0 || availableFeatured.length > 0) {
      // Βάζει μέχρι 4 τυχαία
      if (remainingRandom.length > 0) {
        playlist.push(...remainingRandom.splice(0, 4));
      }
      // Πετάει "σφήνα" 1 featured
      if (availableFeatured.length > 0) {
        playlist.push(availableFeatured.splice(0, 1)[0]); 
      }
    }

    return playlist;

  }, [stations, currentUser]);

  return {
    stations,
    searchTerm,
    setSearchTerm,
    showSearchResults,
    setShowSearchResults,
    filteredSearch,
    zappingPlaylist,
    handleUpdateStationDSP,
    fetchGlobalStations
  };
}
