import React, { useState, useEffect } from 'react';
import { Bell, Loader2 } from 'lucide-react';

// Βοηθητική συνάρτηση: Μετατρέπει το VAPID Key σε μορφή που καταλαβαίνει ο browser
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

export default function EnableNotifications({ API_URL }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supportError, setSupportError] = useState('');

  // ΑΣΠΙΔΑ ΠΡΟΣΤΑΣΙΑΣ: Αν το API_URL λείπει ή είναι localhost, χρησιμοποιούμε το σχετικό '/api' 
  // που θα χτυπήσει κατευθείαν το play.iradios.gr/api
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  useEffect(() => {
    // 1. Ελέγχουμε αν ο browser υποστηρίζει Push Notifications
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupportError('Οι ειδοποιήσεις δεν υποστηρίζονται.');
      return;
    }
    
    // 2. Ελέγχουμε αν η συσκευή είναι ΗΔΗ εγγεγραμμένη
    navigator.serviceWorker.getRegistration().then(registration => {
      if (registration) {
        registration.pushManager.getSubscription().then(subscription => {
          if (subscription) {
            setIsSubscribed(true);
          }
        });
      }
    });
  }, []);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      // 1. Ζητάμε την επίσημη άδεια
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Πρέπει να επιτρέψετε τις ειδοποιήσεις από τον browser σας για να λαμβάνετε τα νέα μας!');
        setIsLoading(false);
        return;
      }

      // 2. Εγγραφή Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready; 
      
      // 3. Λήψη Public Key από το Backend
      const response = await fetch(`${BASE_URL}/notifications/vapidPublicKey`);
      
      if (!response.ok) throw new Error('Δεν βρέθηκε το VAPID Key στο Server');
      const vapidPublicKey = await response.text();
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // 4. Εγγραφή συσκευής στον Browser
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      console.log("Στέλνουμε τα δεδομένα στο:", `${BASE_URL}/notifications/subscribe`);

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
        setIsSubscribed(true);
        console.log("✅ Η συσκευή αποθηκεύτηκε επιτυχώς στη βάση!");
      } else {
        const errData = await saveResponse.json();
        console.error("Αποτυχία αποθήκευσης:", errData);
        alert('Σφάλμα κατά την αποθήκευση της συσκευής σας.');
      }
    } catch (error) {
      console.error('Σφάλμα εγγραφής:', error);
      alert('Σφάλμα εγγραφής: ' + error.message);
    }
    setIsLoading(false);
  };

  if (supportError) {
    return <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest px-4 text-center mt-4">{supportError}</div>;
  }

  return (
    <button 
      onClick={handleSubscribe}
      disabled={isSubscribed || isLoading}
      className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all border shadow-lg mt-4 ${
        isSubscribed 
          ? 'bg-[#ccff00]/10 border-[#ccff00]/20 text-[#ccff00] cursor-default'
          : 'bg-zinc-900 hover:bg-zinc-800 border-white/5 text-white hover:border-[#ccff00]/30 hover:scale-[1.02] active:scale-95'
      }`}
    >
      {isLoading ? (
        <Loader2 size={18} className="animate-spin text-[#ccff00]" />
      ) : isSubscribed ? (
        <><Bell size={18} fill="currentColor" /> Ενεργοποιηθηκαν</>
      ) : (
        <><Bell size={18} className="text-[#ccff00]" /> Ληψη Ειδοποιησεων</>
      )}
    </button>
  );
}
