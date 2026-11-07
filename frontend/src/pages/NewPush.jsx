import React, { useState, useEffect } from 'react';
import { Send, Users, Crown, Radio, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function NewPush({ API_URL }) {
  // Ασπίδα προστασίας για το URL (όπως κάναμε και στο κουμπί εγγραφής)
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  const [stats, setStats] = useState({ all: 0, premium: 0, broadcasters: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  const [formData, setFormData] = useState({ title: '', body: '' });
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState({ show: false, type: '', message: '' });

  // Φόρτωση Στατιστικών
  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      // Προσθέτουμε timestamp στο URL για να "σπάσουμε" την προσωρινή μνήμη (cache) του browser
      const response = await fetch(`${BASE_URL}/notifications/stats?t=${new Date().getTime()}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Σφάλμα φόρτωσης στατιστικών:", error);
    }
    setIsLoadingStats(false);
  };

  useEffect(() => {
    fetchStats();
  }, [BASE_URL]);

  // Χειρισμός Αποστολής
  const handleSendPush = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.body) {
      setFeedback({ show: true, type: 'error', message: 'Συμπληρώστε τον τίτλο και το μήνυμα.' });
      return;
    }

    setIsSending(true);
    setFeedback({ show: false, type: '', message: '' });

    try {
      const response = await fetch(`${BASE_URL}/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Προαιρετικά: Αν έχεις βάλει προστασία JWT στο Admin, πρόσθεσε το Authorization header εδώ
          // 'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        // Το backend σου περιμένει 'title' και 'body' (όχι message)
        body: JSON.stringify({ 
          title: formData.title, 
          body: formData.body 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ show: true, type: 'success', message: 'Η ειδοποίηση στάλθηκε με επιτυχία!' });
        setFormData({ title: '', body: '' }); // Καθαρισμός φόρμας
      } else {
        setFeedback({ show: true, type: 'error', message: data.error || 'Σφάλμα κατά την αποστολή.' });
      }
    } catch (error) {
      setFeedback({ show: true, type: 'error', message: 'Αποτυχία σύνδεσης με τον Server.' });
    }
    setIsSending(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header & Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Push Notifications</h2>
          <p className="text-sm text-zinc-400 mt-1">Στείλτε ζωντανές ειδοποιήσεις στους χρήστες του iRadios.</p>
        </div>
        <button 
          onClick={fetchStats}
          disabled={isLoadingStats}
          className="p-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-[#ccff00] rounded-xl transition-all disabled:opacity-50"
          title="Ανανέωση Στατιστικών"
        >
          <RefreshCw size={20} className={isLoadingStats ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Στατιστικά Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Συνολο Συσκευων</p>
            <p className="text-3xl font-black text-white">
              {isLoadingStats ? <Loader2 size={24} className="animate-spin text-zinc-600 mt-2" /> : stats.all}
            </p>
          </div>
          <div className="h-12 w-12 bg-[#ccff00]/10 rounded-full flex items-center justify-center text-[#ccff00]">
            <Radio size={24} />
          </div>
        </div>
      </div>

      {/* Φόρμα Αποστολής */}
      <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 md:p-8 relative overflow-hidden">
        {/* Διακοσμητικό glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#ccff00]/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

        <form onSubmit={handleSendPush} className="space-y-6 relative z-10">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Τιτλος Ειδοποιησης</label>
              <input
                type="text"
                placeholder="π.χ. Νέος Διαγωνισμός στο iRadios!"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-[#ccff00]/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Μηνυμα</label>
              <textarea
                placeholder="π.χ. Μπείτε τώρα και κερδίστε πλούσια δώρα..."
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows="3"
                className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-[#ccff00]/50 transition-colors resize-none"
              ></textarea>
            </div>
          </div>

          {/* Μηνύματα Επιτυχίας/Σφάλματος */}
          {feedback.show && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
              feedback.type === 'success' 
                ? 'bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20' 
                : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSending || stats.all === 0}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              stats.all === 0 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-[#ccff00] text-black hover:bg-[#b3e600] active:scale-[0.98]'
            }`}
          >
            {isSending ? (
              <><Loader2 size={18} className="animate-spin" /> ΑΠΟΣΤΟΛΗ...</>
            ) : (
              <><Send size={18} /> ΑΠΟΣΤΟΛΗ ΕΙΔΟΠΟΙΗΣΗΣ</>
            )}
          </button>
          
          {stats.all === 0 && (
            <p className="text-center text-xs text-zinc-500 mt-2 font-medium">
              Δεν υπάρχουν εγγεγραμμένες συσκευές για να στείλετε ειδοποίηση.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
