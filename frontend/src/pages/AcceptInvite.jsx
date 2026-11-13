import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Lock, Loader2, AlertCircle } from 'lucide-react';

export default function AcceptInvite({ API_URL }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); // Παίρνει το token από το URL
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Μη έγκυρος ή κατεστραμμένος σύνδεσμος πρόσκλησης.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Οι κωδικοί δεν ταιριάζουν.");
      return;
    }

    if (password.length < 10) {
      setError("Ο κωδικός πρέπει να έχει τουλάχιστον 10 χαρακτήρες.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/producers/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login'); // Τον στέλνουμε στην αρχική για να κάνει Login (ή αν έχεις /login, βάλτο εδώ)
        }, 3000);
      } else {
        setError(data.message || "Η πρόσκληση έχει λήξει ή είναι άκυρη.");
      }
    } catch (err) {
      setError("Σφάλμα σύνδεσης. Δοκιμάστε ξανά.");
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-white/10 p-10 rounded-[40px] max-w-md w-full text-center shadow-2xl animate-fade-in">
          <div className="w-20 h-20 bg-[#ccff00]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-[#ccff00]" />
          </div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4">Account Active!</h2>
          <p className="text-zinc-400 font-medium mb-8">Ο λογαριασμός σας δημιουργήθηκε επιτυχώς. Μεταφέρεστε στη σελίδα σύνδεσης...</p>
          <Loader2 className="animate-spin text-[#ccff00] mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ccff00]/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="bg-zinc-900 border border-white/10 p-8 md:p-12 rounded-[40px] max-w-md w-full relative z-10 shadow-2xl">
        <div className="text-center mb-10">
          <img src="/noicon-iradios-app-logo.svg" alt="iRadios" className="h-8 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Ορισμος Κωδικου</h2>
          <p className="text-zinc-500 text-sm mt-2 font-medium">Δημιουργήστε έναν κωδικό πρόσβασης για τον λογαριασμό Producer σας.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-6 flex items-center gap-3 text-sm font-bold">
            <AlertCircle size={18} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Νέος Κωδικός</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-white/10 h-14 rounded-2xl pl-12 pr-4 text-white focus:border-[#ccff00]/50 outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Επιβεβαίωση Κωδικού</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input 
                type="password" 
                required 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black border border-white/10 h-14 rounded-2xl pl-12 pr-4 text-white focus:border-[#ccff00]/50 outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading || !token} 
            className="w-full bg-[#ccff00] text-black h-14 rounded-2xl font-black uppercase tracking-widest text-xs mt-4 hover:bg-[#b3e600] transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Ενεργοποιηση Λογαριασμου'}
          </button>
        </form>
      </div>
    </div>
  );
}
