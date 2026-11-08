import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { KeyRound, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import AuthShell, { AuthIntro } from '../components/AuthShell';

export default function ResetPassword({ API_URL }) {
  const { token } = useParams(); // Παίρνουμε το token από το URL (π.χ. /reset-password/abc123xyz)
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Έλεγχος αν οι κωδικοί ταιριάζουν
    if (password !== confirmPassword) {
      setError('Οι κωδικοί πρόσβασης δεν ταιριάζουν.');
      return;
    }

    // Έλεγχος για ασφαλή κωδικό (προαιρετικά)
    if (password.length < 6) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        // Μετά από 3 δευτερόλεπτα τον στέλνουμε στο Login
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(data.error || 'Το link έχει λήξει ή είναι άκυρο.');
      }
    } catch (err) {
      setError('Σφάλμα σύνδεσης με τον server.');
    }
    
    setLoading(false);
  };

  return (
    <AuthShell>
      <div className="ir-auth-card w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-10 rounded-[40px] shadow-2xl relative z-10">
        
        <AuthIntro icon={KeyRound} eyebrow="ACCOUNT SECURITY" title="Νέος κωδικός" description="Δημιούργησε έναν ασφαλή κωδικό για τον λογαριασμό σου." />

        {success ? (
          <div className="text-center space-y-6 animate-in zoom-in-95">
            <div className="bg-emerald-500/10 text-emerald-400 p-6 rounded-3xl border border-emerald-500/20">
              <CheckCircle2 size={48} className="mx-auto mb-4" />
              <h3 className="text-xl font-black uppercase tracking-widest mb-2">Επιτυχια!</h3>
              <p className="text-sm font-medium">Ο κωδικός σας ενημερώθηκε. Ανακατεύθυνση στην είσοδο...</p>
            </div>
            <button onClick={() => navigate('/login')} className="w-full bg-white text-black font-black uppercase tracking-widest h-14 rounded-2xl hover:bg-zinc-200 transition-all">
              Προς την Εισοδο
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div role="alert" className="ir-auth-feedback bg-red-500/10 border border-red-500/50 text-red-400 text-sm font-bold px-4 py-4 rounded-xl mb-6 text-center tracking-wide animate-in fade-in">
                {error}
              </div>
            )}

            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#ccff00] transition-colors" size={20} />
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Νέος Κωδικός" aria-label="Νέος κωδικός" autoComplete="new-password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full bg-black/50 border border-white/5 h-16 rounded-2xl pl-12 pr-12 text-sm font-medium focus:outline-none focus:border-[#ccff00]/50 text-white transition-colors" 
                required 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors outline-none focus:text-[#ccff00]"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="relative group">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#ccff00] transition-colors" size={20} />
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Επιβεβαίωση Νέου Κωδικού" aria-label="Επιβεβαίωση νέου κωδικού" autoComplete="new-password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className="w-full bg-black/50 border border-white/5 h-16 rounded-2xl pl-12 pr-12 text-sm font-medium focus:outline-none focus:border-[#ccff00]/50 text-white transition-colors" 
                required 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-[#ccff00] text-black font-black uppercase tracking-widest h-16 rounded-2xl hover:bg-[#b3e600] active:scale-95 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : "Αποθηκευση"}
            </button>

            <div className="text-center mt-6">
               <Link to="/login" className="text-xs text-zinc-500 font-bold hover:text-white transition-colors">Επιστροφή στην Είσοδο</Link>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
