import React, { useState, useEffect } from 'react';

export default function Preloader() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // ⏱️ Μετά από 2 δευτερόλεπτα (2000ms), ξεκινάει το fade out
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2000);

    // 🗑️ Μετά από 2.3 δευτερόλεπτα (2000 + 300ms το animation), καταστρέφουμε το component
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2300);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // Αν τελείωσε ο χρόνος, μην κάνεις render τίποτα (ελευθερώνει τη μνήμη)
  if (!isVisible) return null;

  return (
    <div 
      className={`fixed inset-0 z-[99999] bg-black flex items-center justify-center transition-opacity duration-300 ease-in-out ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <style>
        {`
          @keyframes eq-bar {
            0% { height: 4px; }
            50% { height: 24px; } /* Το έκανα ελάχιστα πιο ψηλό για το κέντρο της οθόνης */
            100% { height: 4px; }
          }
          .eq-bar-1 { animation: eq-bar 0.6s infinite ease-in-out alternate; }
          .eq-bar-2 { animation: eq-bar 0.9s infinite ease-in-out alternate 0.2s; }
          .eq-bar-3 { animation: eq-bar 0.7s infinite ease-in-out alternate 0.4s; }
          .eq-bar-4 { animation: eq-bar 0.5s infinite ease-in-out alternate 0.1s; }
          .eq-bar-5 { animation: eq-bar 0.8s infinite ease-in-out alternate 0.3s; }
        `}
      </style>

      {/* ΚΕΝΤΡΙΚΟ WRAPPER LOGO & EQ */}
      <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-700">
        
        {/* EQ BARS */}
        <div className="flex items-end gap-[4px] h-[24px] shrink-0">
          <div className="w-[5px] bg-[#ccff00] rounded-full eq-bar-1" />
          <div className="w-[5px] bg-white rounded-full eq-bar-2" />
          <div className="w-[5px] bg-[#ccff00] rounded-full eq-bar-3" />
          <div className="w-[5px] bg-white rounded-full eq-bar-4" />
          <div className="w-[5px] bg-[#ccff00] rounded-full eq-bar-5" />
        </div>
        
        {/* LOGO */}
        <img 
          src="/noicon-iradios-app-logo.png" 
          alt="iRadios" 
          className="h-[28px] w-auto object-contain mt-1" 
        />
        
      </div>
    </div>
  );
}
