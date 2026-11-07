import React, { useState, useEffect } from 'react';
import { Cookie } from 'lucide-react';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Ελέγχουμε αν υπάρχει ήδη το cookie συγκατάθεσης
    const hasConsent = document.cookie.split('; ').find(row => row.startsWith('iRadios_cookie_consent='));
    
    // Αν δεν υπάρχει, εμφανίζουμε το prompt με μια μικρή καθυστέρηση (1.5 δευτερόλεπτο)
    // για να μην σκάει κατευθείαν στα μούτρα του χρήστη μόλις μπαίνει
    if (!hasConsent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (type) => {
    // 60 δευτερόλεπτα * 60 λεπτά * 24 ώρες * 365 ημέρες = 1 Χρόνος
    const oneYearInSeconds = 60 * 60 * 24 * 365;
    
    // Αποθηκεύουμε την επιλογή του χρήστη ως κανονικό browser cookie
    document.cookie = `iRadios_cookie_consent=${type}; max-age=${oneYearInSeconds}; path=/; SameSite=Lax`;
    
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full z-[9999] p-4 sm:p-6 pointer-events-none">
      <div className="max-w-4xl mx-auto bg-zinc-900/95 backdrop-blur-xl border border-white/10 p-5 sm:p-6 rounded-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-bottom-10 fade-in duration-700">
        
        {/* ICON & TEXT */}
        <div className="flex-1 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
            <Cookie size={24} />
          </div>
          <div>
            <h3 className="text-white font-black text-lg mb-1 tracking-tight">Σεβόμαστε την ιδιωτικότητά σου</h3>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed">
              Χρησιμοποιούμε cookies για να βελτιώσουμε την εμπειρία σου, να θυμόμαστε τους αγαπημένους σου σταθμούς και να αναλύουμε την επισκεψιμότητα (Analytics).
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 mt-2 md:mt-0">
          <button 
            onClick={() => handleConsent('necessary_only')}
            className="flex-1 md:flex-none px-5 py-3 rounded-xl font-bold text-xs tracking-widest uppercase text-zinc-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          >
            Απαραιτητα
          </button>
          <button 
            onClick={() => handleConsent('accepted_all')}
            className="flex-1 md:flex-none px-6 py-3 rounded-xl font-black text-xs tracking-widest uppercase bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.2)] hover:scale-105 active:scale-95 transition-all"
          >
            Αποδοχη
          </button>
        </div>
        
      </div>
    </div>
  );
}
