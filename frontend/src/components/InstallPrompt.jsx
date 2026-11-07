import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare, MonitorDown, Smartphone, Download, Check } from 'lucide-react';

export default function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [platform, setPlatform] = useState('');
  
  // Εδώ αποθηκεύουμε το "μαγικό" event της εγκατάστασης (μόνο για Android/PC)
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // 1. Αν τρέχει ήδη σαν App (PWA), δεν κάνουμε τίποτα!
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // 2. Αν ο χρήστης το έχει ήδη κλείσει, δεν τον ενοχλούμε.
    const hasDismissed = localStorage.getItem('iluma_install_dismissed');
    if (hasDismissed) return;

    // 3. Ανίχνευση συσκευής (iOS vs Υπόλοιπα)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    
    if (isIOS) {
      setPlatform('ios');
      // Στο iOS το δείχνουμε αμέσως γιατί δεν υπάρχει event εγκατάστασης να περιμένουμε
      setTimeout(() => setIsVisible(true), 10000);
    } else {
      setPlatform('android_or_desktop');
    }

    // 4. Ο "ΚΑΤΑΣΚΟΠΟΣ": Περιμένουμε το Chrome να μας δώσει το ΟΚ για εγκατάσταση
    const handleBeforeInstallPrompt = (e) => {
      // Εμποδίζουμε το Chrome να πετάξει το δικό του (άσχημο) mini-infobar
      e.preventDefault();
      // Αποθηκεύουμε το event για να το καλέσουμε όταν πατήσει το δικό μας κουμπί!
      setDeferredPrompt(e);
      // Τώρα που έχουμε το event έτοιμο, εμφανίζουμε το Modal μας
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('iluma_install_dismissed', 'true');
  };

  // Η συνάρτηση που τρέχει ΟΤΑΝ ΠΑΤΗΣΕΙ ΤΟ ΚΟΥΜΠΙ
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Πετάμε το επίσημο popup εγκατάστασης του Android/Windows
    deferredPrompt.prompt();
    
    // Περιμένουμε να δούμε τι επέλεξε ο χρήστης
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Ο χρήστης αποδέχτηκε την εγκατάσταση!');
      setIsVisible(false); // Κρύβουμε το modal μας
    } else {
      console.log('Ο χρήστης ακύρωσε την εγκατάσταση.');
    }
    
    // Μηδενίζουμε το prompt γιατί μπορεί να χρησιμοποιηθεί μόνο μία φορά
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
        
        {/* Κουμπί Κλεισίματος (X) */}
        <button 
          onClick={handleDismiss} 
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(204,255,0,0.15)] shrink-0">
            {platform === 'ios' ? <Smartphone className="text-[#ccff00]" size={28} /> : <MonitorDown className="text-[#ccff00]" size={28} />}
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight uppercase italic">Εγκατασταση App</h3>
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Free & No Ads</p>
          </div>
        </div>

        {/* --- ΣΕΝΑΡΙΟ 1: iOS --- */}
        {platform === 'ios' && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-300 leading-relaxed font-medium">
              Αναβάθμισε την εμπειρία σου! Πρόσθεσε το <strong>iRadios</strong> στην οθόνη σου για:
            </p>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center gap-3 text-sm text-zinc-400">
                <Check size={16} className="text-[#ccff00] shrink-0" /> Μουσική στο παρασκήνιο & με κλειδωμένη οθόνη
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-400">
                <Check size={16} className="text-[#ccff00] shrink-0" /> Full-screen εμπειρία, χωρίς τα μενού του browser
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-400">
                <Check size={16} className="text-[#ccff00] shrink-0" /> Άμεση πρόσβαση με ένα κλικ
              </li>
            </ul>

            <div className="bg-black/40 rounded-2xl p-4 border border-white/5 space-y-3 mt-4">
              <div className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-[#ccff00] font-bold text-xs shrink-0">1</span>
                <span>Πατήστε το <Share size={16} className="inline mx-1 text-blue-400" /> (Κοινοποίηση) στο κάτω μέρος.</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-[#ccff00] font-bold text-xs shrink-0">2</span>
                <span>Επιλέξτε <strong>"Προσθήκη στην οθόνη αφετηρίας"</strong> <PlusSquare size={16} className="inline mx-1 text-zinc-400" />.</span>
              </div>
            </div>
          </div>
        )}

        {/* --- ΣΕΝΑΡΙΟ 2: ANDROID / WINDOWS / MAC --- */}
        {platform === 'android_or_desktop' && deferredPrompt && (
          <div className="space-y-5">
            <p className="text-sm text-zinc-300 leading-relaxed font-medium">
              Αναβάθμισε την εμπειρία σου! Εγκατάστησε την εφαρμογή του <strong>iRadios</strong> για:
            </p>
            
            <ul className="space-y-2 mb-4">
              <li className="flex items-center gap-3 text-sm text-zinc-400">
                <Check size={16} className="text-[#ccff00] shrink-0" /> Αδιάκοπη μουσική στο παρασκήνιο
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-400">
                <Check size={16} className="text-[#ccff00] shrink-0" /> Έλεγχο από την οθόνη κλειδώματος
              </li>
              <li className="flex items-center gap-3 text-sm text-zinc-400">
                <Check size={16} className="text-[#ccff00] shrink-0" /> Ταχύτερη φόρτωση & 1-click πρόσβαση
              </li>
            </ul>
            
            <button 
              onClick={handleInstallClick} 
              className="w-full bg-[#ccff00] text-black font-black uppercase tracking-widest py-4 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_5px_20px_rgba(204,255,0,0.25)]"
            >
              <Download size={20} /> Εγκατασταση Τωρα
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
