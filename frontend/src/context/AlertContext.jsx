// context/AlertContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, X, Info, CheckCircle, AlertTriangle } from 'lucide-react';

const AlertContext = createContext(null);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert πρέπει να χρησιμοποιείται μέσα σε ένα AlertProvider');
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState({
    isOpen: false,
    message: '',
    type: 'info', // 'info', 'success', 'warning', 'error'
    duration: 5000, // Χρόνος σε ms πριν κλείσει αυτόματα (0 = δεν κλείνει αυτόματα)
  });

  const showAlert = useCallback((message, type = 'info', duration = 5000) => {
    setAlertConfig({ isOpen: true, message, type, duration });
    
    // Αυτόματο κλείσιμο αν το duration είναι > 0
    if (duration > 0) {
      setTimeout(() => {
        closeAlert();
      }, duration);
    }
  }, []);

  const closeAlert = useCallback(() => {
    setAlertConfig(prev => ({ ...prev, isOpen: false }));
    // Καθαρίζουμε το μήνυμα μετά το animation κλεισίματος
    setTimeout(() => {
      setAlertConfig(prev => ({ ...prev, message: '' }));
    }, 300);
  }, []);

  // Επιλογή εικονιδίου και χρωμάτων ανάλογα με τον τύπο
  const getAlertStyles = (type) => {
    switch (type) {
      case 'warning':
        return { icon: <AlertTriangle className="text-yellow-500" />, bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
      case 'error':
        return { icon: <AlertCircle className="text-red-500" />, bg: 'bg-red-500/10', border: 'border-red-500/20' };
      case 'success':
        return { icon: <CheckCircle className="text-green-500" />, bg: 'bg-green-500/10', border: 'border-green-500/20' };
      case 'info':
      default:
        // Χρησιμοποιούμε το neon πράσινο/κίτρινο του iRadios για το default
        return { icon: <Info className="text-[#ccff00]" />, bg: 'bg-[#ccff00]/10', border: 'border-[#ccff00]/20' };
    }
  };

  const styles = getAlertStyles(alertConfig.type);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      
      {/* Το Custom Alert Component */}
      <div 
        className={`fixed z-[9999] top-0 left-0 right-0 p-4 md:p-6 pointer-events-none flex justify-center items-start transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          alertConfig.isOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        <div className={`pointer-events-auto max-w-lg w-full backdrop-blur-xl border rounded-2xl shadow-2xl p-4 md:p-5 flex items-start gap-4 ${styles.bg} ${styles.border} bg-zinc-950/80`}>
          <div className="shrink-0 mt-0.5">
            {styles.icon}
          </div>
          
          <div className="flex-1 flex flex-col justify-center min-w-0 pt-0.5">
            <p className="text-white text-sm md:text-base font-medium leading-relaxed">
              {alertConfig.message}
            </p>
          </div>
          
          <button 
            onClick={closeAlert}
            className="shrink-0 p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </AlertContext.Provider>
  );
};
