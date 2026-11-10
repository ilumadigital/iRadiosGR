import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import useTurnstileSiteKey from '../hooks/useTurnstileSiteKey';
import AuthShell, { AuthIntro } from '../components/AuthShell';

export default function Register({ API_URL, setCurrentUser }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', fname: '', lname: '', birthdate: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cfToken, setCfToken] = useState('');
  const turnstileRef = useRef(null);
  
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';
  const {siteKey,turnstileError,retryTurnstile}=useTurnstileSiteKey(BASE_URL);
  const resetTurnstile = () => { setCfToken(''); turnstileRef.current?.reset(); };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (loading) return;

    // 💡 NEW: Έλεγχος Turnstile πριν από οτιδήποτε άλλο
    if (!cfToken) {
      turnstileRef.current?.reset();
      setError('Παρακαλώ επιβεβαιώστε ότι δεν είστε ρομπότ.');
      return;
    }
    
    // Έλεγχος ισχυρού κωδικού
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%*]).{6,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες, 1 κεφαλαίο, 1 πεζό, 1 αριθμό και 1 σύμβολο (!@#$%*).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 💡 NEW: Στέλνουμε και το cfToken μαζί με τα υπόλοιπα δεδομένα
        body: JSON.stringify({ ...formData, email:formData.email.trim().toLowerCase(), cfToken }) 
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.token && data.user) {
        localStorage.removeItem('iradios_pending_otp_email');
        localStorage.setItem('iluma_token', data.token);
        if (setCurrentUser) setCurrentUser(data.user);
        navigate('/');
      } else {
        setError(data.error || data.message || `Η εγγραφή απέτυχε (HTTP ${res.status}). Έλεγξε την επαλήθευση Cloudflare και τα στοιχεία σου.`);
        resetTurnstile();
      }
    } catch (err) {
      setError('Δεν ήταν δυνατή η σύνδεση με το backend. Έλεγξε τη σύνδεσή σου και προσπάθησε ξανά.');
      resetTurnstile();
    }
    setLoading(false);
  };

  return (
    <AuthShell>
      
      {/* --- REGISTRATION FORM --- */}
      {(
        <div className="ir-auth-card w-full max-w-md bg-zinc-900/50 border border-white/10 p-8 rounded-[40px] backdrop-blur-sm relative z-10 my-auto">
          
          <AuthIntro icon={UserPlus} eyebrow="JOIN THE EXPERIENCE" title="Φτιάξε τον λογαριασμό σου" description="Ένα προφίλ. Αμέτρητοι σταθμοί και μουσικές στιγμές." />

          {error && (
            <div role="alert" className="ir-auth-feedback mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input type="text" placeholder="Όνομα" aria-label="Όνομα" autoComplete="given-name" required value={formData.fname} onChange={(e) => setFormData({...formData, fname: e.target.value})} className="w-full bg-black border border-white/10 h-14 rounded-2xl pl-12 pr-4 text-white focus:border-[#ccff00] transition-colors outline-none" />
              </div>
              <input type="text" placeholder="Επίθετο" aria-label="Επίθετο" autoComplete="family-name" required value={formData.lname} onChange={(e) => setFormData({...formData, lname: e.target.value})} className="w-full bg-black border border-white/10 h-14 rounded-2xl px-4 text-white focus:border-[#ccff00] transition-colors outline-none" />
            </div>

            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" placeholder="Username" aria-label="Username" autoComplete="username" required value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})} className="w-full bg-black border border-white/10 h-14 rounded-2xl pl-12 pr-4 text-white focus:border-[#ccff00] transition-colors outline-none font-mono" />
            </div>

            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="email" placeholder="Email" aria-label="Email" autoComplete="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-white/10 h-14 rounded-2xl pl-12 pr-4 text-white focus:border-[#ccff00] transition-colors outline-none" />
            </div>

            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Κωδικός (Min 6 χαρακτήρες)" aria-label="Κωδικός πρόσβασης" autoComplete="new-password" 
                required 
                minLength="6" 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                className="w-full bg-black border border-white/10 h-14 rounded-2xl pl-12 pr-12 text-white focus:border-[#ccff00] transition-colors outline-none" 
              />
              <button
                type="button"
                aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                  onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors outline-none focus:text-[#ccff00]"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-2 mb-1 block">Ημερομηνία Γέννησης</label>
              <input type="date" aria-label="Ημερομηνία γέννησης" autoComplete="bday" required value={formData.birthdate} onChange={(e) => setFormData({...formData, birthdate: e.target.value})} className="w-full bg-black border border-white/10 h-14 rounded-2xl px-4 text-white focus:border-[#ccff00] transition-colors outline-none text-sm" />
            </div>

            {/* 💡 NEW: Cloudflare Turnstile Widget */}
            <div className="ir-auth-turnstile flex justify-center mt-6 mb-2">
              {siteKey ? (
                <Turnstile
                  key={siteKey}
                  ref={turnstileRef}
                  siteKey={siteKey}
                  options={{ action: 'register' }}
                  onSuccess={(token) => setCfToken(token)}
                  onError={() => setCfToken('')}
                  onExpire={() => setCfToken('')}
                  theme="dark"
                />
              ) : <div role="status" className="flex flex-col items-center gap-2 text-center">
                    <p className="text-xs text-amber-300">{turnstileError || 'Φόρτωση Cloudflare Turnstile…'}</p>
                    {turnstileError && <button type="button" onClick={retryTurnstile} className="text-xs font-bold text-[#ccff00] underline underline-offset-4 hover:text-white">Επανάληψη φόρτωσης</button>}
                  </div>}
            </div>

            <button 
              type="submit" 
              disabled={loading} // 💡 NEW: Απενεργοποίηση αν λείπει το token
              className="w-full mt-4 bg-white text-black font-black py-4 rounded-2xl uppercase tracking-widest text-sm hover:bg-[#ccff00] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>ΕΓΓΡΑΦΗ <ArrowRight size={18} /></>}
            </button>
            
            <p className="text-center text-[11px] text-zinc-500 mt-3 font-medium">
              Με την εγγραφή αποδέχεστε τους <Link to="/terms" className="text-white hover:text-[#ccff00] underline decoration-white/30 underline-offset-2">Όρους Χρήσης</Link> του iRadios.
            </p>
          </form>

          <p className="text-center text-zinc-500 text-sm mt-8">
            Έχεις ήδη λογαριασμό; <Link to="/login" className="text-white font-bold hover:text-[#ccff00] transition-colors">Συνδέσου</Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
