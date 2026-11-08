import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, ArrowRight, Loader2, KeyRound, CheckCircle2, X, Eye, EyeOff } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
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
  
  // --- OTP STATES ---
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';
  const resetTurnstile = () => { setCfToken(''); turnstileRef.current?.reset(); };

  useEffect(() => {
    const pendingEmail = localStorage.getItem('iradios_pending_otp_email');
    if (pendingEmail) {
      setFormData(prev => ({ ...prev, email: pendingEmail }));
      setShowOtpModal(true);
    }
  }, []);

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
        body: JSON.stringify({ ...formData, cfToken }) 
      });
      const data = await res.json();

      if (res.ok) {
        if (data.requireOtp) {
          localStorage.setItem('iradios_pending_otp_email', formData.email);
          setShowOtpModal(true); 
        } else {
          navigate('/login'); 
        }
      } else {
        setError(data.error || 'Σφάλμα κατά την εγγραφή');
        resetTurnstile();
      }
    } catch (err) {
      setError('Αποτυχία σύνδεσης με τον διακομιστή.');
      resetTurnstile();
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Ο κωδικός πρέπει να έχει 6 ψηφία.');
      return;
    }

    setOtpLoading(true);
    setError('');

    try {
      const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.removeItem('iradios_pending_otp_email');
        
        localStorage.setItem('iluma_token', data.token);
        localStorage.setItem('iluma_user', JSON.stringify(data.user));
        
        if (setCurrentUser) setCurrentUser(data.user);
        
        setShowOtpModal(false);
        navigate('/'); 
      } else {
        setError(data.error || 'Λάθος κωδικός OTP.');
      }
    } catch (err) {
      setError('Σφάλμα κατά την επαλήθευση.');
    }
    setOtpLoading(false);
  };

  const closeOtpModal = () => {
    localStorage.removeItem('iradios_pending_otp_email');
    setShowOtpModal(false);
    setOtp('');
  };

  return (
    <AuthShell>
      
      {/* --- OTP MODAL --- */}
      {showOtpModal && (
        <div className="ir-auth-overlay fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="ir-auth-modal ir-auth-modal--narrow bg-[#111] border border-[#ccff00]/30 p-10 rounded-[40px] w-full max-w-md shadow-[0_0_50px_rgba(204,255,0,0.1)] text-center animate-in zoom-in-95 relative">
            <button onClick={closeOtpModal} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full">
              <X size={20} />
            </button>

            <div className="w-20 h-20 bg-[#ccff00]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <KeyRound size={40} className="text-[#ccff00]" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase italic tracking-wider">Επαληθευση Email</h2>
            <p className="text-zinc-400 text-sm mb-8">
              Στείλαμε έναν 6-ψήφιο κωδικό στο <strong>{formData.email}</strong>. 
              <br/>Ελέγξτε τα εισερχόμενα (ή τα Spam) σας.
            </p>

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <input 
                type="text" 
                maxLength="6"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" autoComplete="one-time-code" inputMode="numeric" aria-label="Κωδικός επιβεβαίωσης"
                className="w-full bg-black border-2 border-white/10 h-20 rounded-2xl text-center text-4xl font-black text-[#ccff00] tracking-[0.5em] focus:border-[#ccff00] outline-none transition-colors"
                autoFocus
              />
              
              {error && <div role="alert" className="ir-auth-feedback text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl">{error}</div>}

              <button 
                type="submit" 
                disabled={otpLoading || otp.length !== 6}
                className="w-full bg-[#ccff00] text-black font-black py-5 rounded-2xl uppercase tracking-widest text-sm hover:bg-[#b3e600] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {otpLoading ? <Loader2 size={20} className="animate-spin" /> : <><CheckCircle2 size={20}/> ΕΝΕΡΓΟΠΟΙΗΣΗ ΛΟΓΑΡΙΑΣΜΟΥ</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- REGISTRATION FORM --- */}
      {!showOtpModal && (
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
              <Turnstile
                ref={turnstileRef}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} // Αν έχεις CRA, βάλε process.env.REACT_APP_TURNSTILE_SITE_KEY
                onSuccess={(token) => { setCfToken(token); setError(''); }}
                onError={() => setCfToken('')}
                onExpire={() => setCfToken('')}
                theme="dark"
              />
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
