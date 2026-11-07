import React, { useState, useEffect } from 'react';
import { BellRing, X, Check, Loader2 } from 'lucide-react';

// Βοηθητική συνάρτηση: Μετατρέπει το VAPID Key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationModal({ API_URL }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Η ασπίδα μας για το URL
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  useEffect(() => {
    // Εμφάνιση μόνο αν ο browser υποστηρίζει notifications και δεν έχει ερωτηθεί ακόμα
    if ("Notification" in window && Notification.permission === "default") {
      const timer = setTimeout(() => setIsVisible(true), 60000);
      return () => clearTimeout(timer);
    }
  }, []);

  const enableNotifications = async () => {
    setIsLoading(true);
    try {
      // 1. Ζητάμε την άδεια
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setIsVisible(false);
        return;
      }

      // 2. Εγγραφή Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 3. Λήψη Public Key από το Backend
      const response = await fetch(`${BASE_URL}/notifications/vapidPublicKey`);
      if (!response.ok) throw new Error('Δεν βρέθηκε το VAPID Key');
      const vapidPublicKey = await response.text();
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // 4. Εγγραφή συσκευής στον Browser
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // 5. Αποθήκευση στη MongoDB
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const userId = user ? user._id : null;

      // 5. Στέλνουμε το subscription ΚΑΙ το userId στη Βάση 
      const saveResponse = await fetch(`${BASE_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, userId }) 
      });

      if (saveResponse.ok) {
        console.log("✅ Η συσκευή αποθηκεύτηκε επιτυχώς από το Modal!");
      } else {
        console.error("Σφάλμα αποθήκευσης στη βάση.");
      }
    } catch (error) {
      console.error('Σφάλμα εγγραφής από Modal:', error);
    }
    
    setIsLoading(false);
    setIsVisible(false); // Κλείνουμε το modal στο τέλος
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
      <div className="bg-[#111] border border-[#ccff00]/20 rounded-[40px] max-w-sm w-full p-8 shadow-2xl relative overflow-hidden">
        
        {/* ILUMA Glow Effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#ccff00]/10 blur-[80px]"></div>
        
        <button 
          onClick={() => setIsVisible(false)} 
          className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
          disabled={isLoading}
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#ccff00]/10 rounded-2xl flex items-center justify-center text-[#ccff00] mb-6">
            <BellRing size={32} className={isLoading ? "" : "animate-bounce"} />
          </div>

          <h3 className="text-xl font-black text-white italic tracking-tight mb-2">
            Μην χάνεις στιγμή
          </h3>
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Ενεργοποίησε τις ειδοποιήσεις για να μαθαίνεις πρώτος για νέα shows, διαγωνισμούς και breaking news.
          </p>

          <button 
            onClick={enableNotifications}
            disabled={isLoading}
            className="w-full bg-[#ccff00] text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_20px_rgba(204,255,0,0.2)] disabled:opacity-70 disabled:hover:scale-100"
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin" /> ΣΥΝΔΕΣΗ...</>
            ) : (
              <><Check size={18} /> ΕΝΕΡΓΟΠΟΙΗΣΗ</>
            )}
          </button>
          
          <button 
            onClick={() => setIsVisible(false)}
            disabled={isLoading}
            className="mt-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest hover:text-white transition-colors disabled:opacity-50"
          >
            ΙΣΩΣ ΑΡΓΟΤΕΡΑ
          </button>
        </div>
      </div>
    </div>
  );
}
