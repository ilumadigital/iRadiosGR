import React, { useEffect, useState, useRef } from 'react';
import { Car, X, ChevronRight } from 'lucide-react';

export default function CarModePrompt({ onAccept, isPremium }) {
  const [isVisible, setIsVisible] = useState(false);
  const watchIdRef = useRef(null); // Για να κλείσουμε το GPS όταν δεν χρειάζεται

  useEffect(() => {
    if (!isPremium) return;
    if (sessionStorage.getItem('carModeDismissed')) return;

    const carKeywords = [
      // 1. Γενικοί Όροι Οχημάτων & Bluetooth
      'car', 'bt', 'bluetooth', 'hands-free', 'handsfree', 'carkit', 'hands free', 
      'infotainment', 'audio system', 'stereo', 'receiver', 'headunit', 'vehicle', 
      'auto', 'automotive', 'drive', 'carmt', 'car_bt', 'bt_car', 'car-bt', 'bt-car',

      // 2. Σκάφη / Marine Audio (ΝΕΟ)
      'marine', 'boat', 'yacht', 'vessel', 'fusion', 'fusionentertainment', 'garmin', 
      'simrad', 'lowrance', 'raymarine', 'jl audio', 'wet sounds', 'wetsounds', 
      'kicker marine', 'boss marine', 'clarion marine', 'ms-', 'ra-', 'nmea',

      // 3. Εργοστασιακά Συστήματα (OEM Infotainment)
      'sync', 'uconnect', 'mzd', 'mmcs', 'entune', 'intellilink', 'media nav', 
      'r-link', 'smeg', 'discover', 'columbus', 'ibeacon', 'idrive', 'mmi', 
      'mbux', 'pcm', 'comand', 'lexus', 'acura', 'infiniti', 'genesis', 'onstar',

      // 4. Premium Ηχοσυστήματα Αυτοκινήτων (Πολλές φορές είναι το όνομα του BT)
      'bose', 'harman', 'kardon', 'jbl', 'infinity', 'bang & olufsen', 'b&o', 
      'burmester', 'meridian', 'bowers & wilkins', 'b&w', 'mark levinson', 
      'mcintosh', 'fender', 'canton', 'dynaudio', 'focal', 'beats',

      // 5. Μάρκες Αυτοκινήτων
      'audi', 'bmw', 'mercedes', 'benz', 'vw', 'volkswagen', 'toyota', 'ford', 
      'mazda', 'hyundai', 'kia', 'nissan', 'peugeot', 'renault', 'fiat', 'honda', 
      'suzuki', 'opel', 'vauxhall', 'seat', 'skoda', 'volvo', 'jeep', 'alfa romeo', 
      'citroen', 'dacia', 'chevrolet', 'mitsubishi', 'subaru', 'land rover', 
      'jaguar', 'porsche', 'mini', 'smart', 'chrysler', 'dodge', 'ram', 'tesla',
      'cupra', 'abarth', 'lexus', 'byd', 'mg',

      // 6. Aftermarket Ηχοσυστήματα
      'pioneer', 'sony', 'alpine', 'kenwood', 'jvc', 'blaupunkt', 'clarion', 
      'parrot', 'asteroid', 'nakamichi', 'boss audio', 'kicker', 'rockford', 

      // 7. Μοντέλα / Σειρές Aftermarket (Prefixes)
      'sph', 'deh', 'mvh', 'avh', 'dmh', 'avic', // Pioneer
      'xav', 'mex', 'dsx', 'cdx',                // Sony
      'ute', 'cde', 'ilx', 'ine', 'ida',         // Alpine
      'kmm', 'ddx', 'dpx', 'kdc', 'dmx', 'dnx',  // Kenwood
      'kd-', 'kw-',                              // JVC

      // 8. Κινέζικες Android Οθόνες (Aftermarket / AliExpress)
      'joying', 'xtrons', 'pumpkin', 'eonon', 'dasaita', 'seicane', 'syu', 
      'ts10', 'ts7', 'ts9', 'rk3399', 'px5', 'px6', 'ac8227l', 'mtk', 'android-bt',
      'carkit_bt', 'carkit', 'bt_carkit', 'goc', 'bc8'
    ];

    const showPrompt = (reason) => {
      console.log(`iRadios: Car system detected via [${reason}]`);
      setIsVisible(true);
    };

    // --- ΜΕΘΟΔΟΣ 1: Έλεγχος Συσκευών Ήχου ---
    const checkIfCarDevice = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === 'audiooutput' || device.kind === 'audioinput');

        const isCar = audioOutputs.some(device => {
          const label = device.label.toLowerCase();
          // Αν το label είναι κενό, ο browser το κρύβει λόγω permissions.
          if (!label) return false; 
          return carKeywords.some(keyword => label.includes(keyword));
        });

        if (isCar) showPrompt('Bluetooth Audio Label');
      } catch (err) {
        console.error("Device detection error:", err);
      }
    };

    // --- ΜΕΘΟΔΟΣ 2: Έλεγχος Ταχύτητας (GPS) ---
    // Αν κινείται με πάνω από ~15km/h (4.5 m/s), τότε είναι σε όχημα.
    const checkSpeed = () => {
      if (!('geolocation' in navigator)) return;

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const speedInMetersPerSecond = position.coords.speed;
          // Το speed μπορεί να είναι null σε κάποιες συσκευές αν δεν υπολογίζεται
          if (speedInMetersPerSecond && speedInMetersPerSecond > 4.5) {
            showPrompt('GPS Speed > 15km/h');
            navigator.geolocation.clearWatch(watchIdRef.current); // Το βρήκαμε, σταματάμε το ραντάρ
          }
        },
        (error) => console.log("Speed tracking error or denied:", error.message),
        { enableHighAccuracy: false, maximumAge: 10000, timeout: 5000 }
      );
    };

    // --- ΜΕΘΟΔΟΣ 3: User Agent Check για ενσωματωμένα συστήματα ---
    const checkUserAgent = () => {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('car') || ua.includes('automotive') || ua.includes('tesla')) {
        showPrompt('Browser User-Agent');
      }
    };

    // --- ΕΚΤΕΛΕΣΗ ΟΛΩΝ ΤΩΝ ΕΛΕΓΧΩΝ ---
    checkUserAgent();
    checkIfCarDevice();
    checkSpeed();

    const handleDeviceChange = () => {
      checkIfCarDevice();
      
      // Όταν συνδέει κάτι, ελέγχουμε αν είναι και σε landscape το κινητό
      const isMobile = /iPhone|Android|iPad/i.test(navigator.userAgent);
      if (isMobile && window.innerWidth > window.innerHeight) {
         showPrompt('Device Change + Landscape Mode');
      }
    };

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    // Fallback Timer
    const timer = setTimeout(() => {
      checkIfCarDevice();
    }, 4000);

    // --- CLEANUP ---
    return () => {
      clearTimeout(timer);
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isPremium]);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('carModeDismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-white/10 p-8 rounded-[40px] shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-500">
        
        <div className="w-20 h-20 bg-orange-500/20 text-orange-400 rounded-3xl flex items-center justify-center shrink-0 mb-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-orange-400/20 animate-pulse"></div>
          <Car size={40} strokeWidth={2.5} className="relative z-10" />
        </div>

        <div className="space-y-2">
          <h4 className="text-xl font-black text-white italic tracking-tighter">Εντοπίστηκε Όχημα</h4>
          <p className="text-sm text-zinc-400 font-medium leading-relaxed">
            Θέλεις να ενεργοποιήσεις το <span className="text-white font-bold">Car Mode</span> για ασφαλή οδήγηση;
          </p>
        </div>

        <div className="w-full space-y-3 mt-2">
          <button 
            onClick={() => { setIsVisible(false); onAccept(); }} 
            className="w-full bg-[#ccff00] text-black h-16 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_25px_rgba(204,255,0,0.2)]"
          >
            ΕΝΕΡΓΟΠΟΙΗΣΗ <ChevronRight size={20} strokeWidth={3} />
          </button>
          
          <button 
            onClick={handleDismiss} 
            className="w-full bg-white/5 text-zinc-400 h-14 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={18} /> ΟΧΙ ΤΩΡΑ
          </button>
        </div>

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1.5 bg-[#ccff00] rounded-b-full shadow-[0_0_15px_#ccff00]"></div>
      </div>
    </div>
  );
}
