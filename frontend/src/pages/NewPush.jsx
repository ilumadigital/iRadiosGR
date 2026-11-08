import {adminFetch as fetch} from '../utils/adminFetch';
import React, { useState, useEffect } from 'react';
import { Send, Users, Crown, Radio, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function NewPush({ API_URL }) {
  // Ασπίδα προστασίας για το URL (όπως κάναμε και στο κουμπί εγγραφής)
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  const [stats, setStats] = useState({ all: 0, premium: 0, broadcasters: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  const [formData, setFormData] = useState({ title: '', body: '', topic: 'promotions', alsoEmail: false });
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

    if(!window.confirm('Να σταλεί η ειδοποίηση στις εγγεγραμμένες συσκευές; Έλεγξε το κείμενο πριν συνεχίσεις.'))return;
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
          body: formData.body,
          topic: formData.topic,
          alsoEmail: formData.alsoEmail 
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFeedback({ show: true, type: 'success', message: 'Η ειδοποίηση στάλθηκε με επιτυχία!' });
        setFormData({ title: '', body: '', topic: 'promotions', alsoEmail: false }); // Καθαρισμός φόρμας
      } else {
        setFeedback({ show: true, type: 'error', message: data.error || 'Σφάλμα κατά την αποστολή.' });
      }
    } catch (error) {
      setFeedback({ show: true, type: 'error', message: 'Αποτυχία σύνδεσης με τον Server.' });
    }
    setIsSending(false);
  };

  return (
    <div className="admin-legacy-page max-w-4xl space-y-6">
      {/* Header & Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Push ειδοποιήσεις</h2>
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
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Σύνολο συσκευών</p>
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
              <label htmlFor="ir-push-topic" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Κατηγορία ειδοποίησης</label>
              <select id="ir-push-topic" value={formData.topic} onChange={e=>setFormData(old=>({...old,topic:e.target.value}))}
                className="w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-white">
                <option value="newStations">Νέοι σταθμοί</option>
                <option value="favoriteSchedule">Πρόγραμμα αγαπημένων</option>
                <option value="shows">Εκπομπές</option>
                <option value="news">Ειδήσεις</option>
                <option value="promotions">Προωθητικές ενέργειες</option>
              </select>
              <p className="mt-2 text-xs leading-5 text-zinc-400">Η αποστολή γίνεται μόνο σε χρήστες που επιτρέπουν τη συγκεκριμένη κατηγορία. Για προωθητικές ενέργειες απαιτείται ρητή συγκατάθεση.</p>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-xs font-semibold text-white">
              <input type="checkbox" checked={formData.alsoEmail} onChange={e=>setFormData(old=>({...old,alsoEmail:e.target.checked}))}
                className="size-4 accent-[#ccff00]"/>
              Αποστολή και μέσω email, μόνο όπου έχει επιτραπεί
            </label>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Τίτλος ειδοποίησης</label>
              <input
                type="text"
                maxLength={90}
                aria-label="Τίτλος push ειδοποίησης"
                placeholder="π.χ. Νέος Διαγωνισμός στο iRadios!"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-[#ccff00]/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Μηνυμα</label>
              <textarea
                maxLength={300}
                aria-label="Κείμενο push ειδοποίησης"
                placeholder="π.χ. Μπείτε τώρα και κερδίστε πλούσια δώρα..."
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows="3"
                className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-[#ccff00]/50 transition-colors resize-none"
              ></textarea>
            </div>
          </div>

          <div className="rounded-2xl border border-[#caff00]/20 bg-[#0d1112] p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#caff00]">Προεπισκόπηση ειδοποίησης</p>
              <span className="text-[11px] text-zinc-400">{formData.title.length}/90 · {formData.body.length}/300</span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#1a1e21] p-4">
              <p className="text-xs font-black text-white">{formData.title.trim()||'Τίτλος ειδοποίησης'}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-300">{formData.body.trim()||'Το μήνυμα θα εμφανιστεί εδώ πριν την αποστολή.'}</p>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-zinc-500">Η αποστολή δεν μπορεί να αναιρεθεί. Θα ζητηθεί τελική επιβεβαίωση.</p>
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
