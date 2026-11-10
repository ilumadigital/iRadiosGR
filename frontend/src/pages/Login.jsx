import React, { useState, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { KeyRound, User, Mail, LogIn, Loader2, CheckCircle2, X, Eye, EyeOff, Send } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import useTurnstileSiteKey from '../hooks/useTurnstileSiteKey';
import AuthShell, { AuthIntro } from '../components/AuthShell';

export default function Login({ API_URL, setCurrentUser }) {
  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cfToken, setCfToken] = useState('');
  const turnstileRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const inviteToken = query.get('invite') || '';
  const requestedNext = query.get('next') || '';
  // Local station return only; never allow external post-login redirects.
  const stationReturn = /^\/station\/[^/?#]+(?:\?contact=1)?$/.test(requestedNext) ? requestedNext : null;
  const afterLogin = inviteToken ? `/broadcaster-invite?token=${encodeURIComponent(inviteToken)}` : stationReturn;

  // --- OTP STATES ---
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  // --- FORGOT PASSWORD STATES ---
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState({ type: '', text: '' });

  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';
  const {siteKey,turnstileError,retryTurnstile}=useTurnstileSiteKey(BASE_URL);
  const resetTurnstile = () => { setCfToken(''); turnstileRef.current?.reset(); };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!cfToken) {
      turnstileRef.current?.reset();
      setError('Παρακαλώ επιβεβαιώστε ότι δεν είστε ρομπότ.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, cfToken }) 
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok) {
        localStorage.removeItem('iradios_pending_otp_email');
        localStorage.setItem('iluma_token', data.token);
        setCurrentUser(data.user);
        
        if (afterLogin) navigate(afterLogin);
        else if (['admin','broadcaster','producer'].includes(data.user.role)) navigate('/backoffice');
        else navigate('/');
      } 
      else if (res.status === 403 && data.requireOtp) {
        setUnverifiedEmail(data.email);
        localStorage.setItem('iradios_pending_otp_email', data.email);
        setShowOtpModal(true);
      } else {
        setError(data.error || data.message || `Η σύνδεση απέτυχε (HTTP ${res.status}).`);
        resetTurnstile(); 
      }
    } catch (err) {
      setError('Σφάλμα σύνδεσης με τον server');
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
        body: JSON.stringify({ email: unverifiedEmail, otp, ...(inviteToken ? { inviteToken } : {}) })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.removeItem('iradios_pending_otp_email');
        localStorage.setItem('iluma_token', data.token);
        if (setCurrentUser) setCurrentUser(data.user);
        
        setShowOtpModal(false);
        
        if (afterLogin) navigate(afterLogin);
        else if (['admin','broadcaster','producer'].includes(data.user.role)) navigate('/backoffice');
        else navigate('/');
      } else {
        setError(data.error || 'Λάθος κωδικός OTP.');
      }
    } catch (err) {
      setError('Σφάλμα κατά την επαλήθευση.');
    }
    setOtpLoading(false);
  };

  // 🟢 ΛΕΙΤΟΥΡΓΙΑ: Αποστολή αιτήματος Forgot Password
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setForgotLoading(true);
    setForgotMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      
      const data = await res.json();

      if (res.ok) {
        setForgotMessage({ type: 'success', text: 'Το email ανάκτησης εστάλη! Ελέγξτε τα εισερχόμενά σας (και τα Spam).' });
        setForgotEmail(''); 
      } else {
        setForgotMessage({ type: 'error', text: data.error || 'Το email δεν βρέθηκε στο σύστημά μας.' });
      }
    } catch (err) {
      setForgotMessage({ type: 'error', text: 'Σφάλμα σύνδεσης με τον server.' });
    }
    
    setForgotLoading(false);
  };

  const closeOtpModal = () => {
    localStorage.removeItem('iradios_pending_otp_email');
    setShowOtpModal(false);
    setOtp('');
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotEmail('');
    setForgotMessage({ type: '', text: '' });
  };

  return (
    <AuthShell>
      
      {/* --- OTP MODAL --- */}
      {showOtpModal && (
        <div className="ir-auth-overlay fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="ir-auth-modal ir-auth-modal--narrow bg-[#111] border border-[#ccff00]/30 p-10 rounded-[40px] w-full max-w-md shadow-[0_0_50px_rgba(204,255,0,0.1)] text-center animate-in zoom-in-95 relative">
            <button aria-label="Κλείσιμο επαλήθευσης" onClick={closeOtpModal} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full">
              <X size={20} />
            </button>
            <div className="w-20 h-20 bg-[#ccff00]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <KeyRound size={40} className="text-[#ccff00]" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase italic tracking-wider">Επαληθευση Email</h2>
            <p className="text-zinc-400 text-sm mb-8">
              Ο λογαριασμός σας δεν είναι ενεργός. Σας είχαμε στείλει κωδικό στο <strong>{unverifiedEmail}</strong>. 
              <br/>Ελέγξτε τα εισερχόμενά σας.
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

      {/* 🟢 FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="ir-auth-overlay fixed inset-0 bg-black/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="ir-auth-modal ir-auth-modal--narrow bg-[#111] border border-white/10 p-10 rounded-[40px] w-full max-w-md shadow-2xl text-center animate-in zoom-in-95 relative">
            <button aria-label="Κλείσιμο ανάκτησης" onClick={closeForgotModal} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full">
              <X size={20} />
            </button>
            
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail size={32} className="text-white" />
            </div>
            
            <h2 className="text-2xl font-black text-white mb-2 uppercase italic tracking-wider">Ανακτηση Κωδικου</h2>
            <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
              Εισάγετε το email εγγραφής σας. Θα σας στείλουμε έναν σύνδεσμο για να δημιουργήσετε νέο κωδικό πρόσβασης.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-white transition-colors" size={20} />
                <input 
                  type="email" 
                  placeholder="Το Email σας" autoComplete="email" aria-label="Email ανάκτησης" 
                  value={forgotEmail} 
                  onChange={(e) => setForgotEmail(e.target.value)} 
                  className="w-full bg-black/50 border border-white/10 h-14 rounded-2xl pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-white/50 text-white transition-colors" 
                  required 
                  autoFocus
                />
              </div>
              
              {forgotMessage.text && (
                <div role="status" className={`ir-auth-feedback text-xs font-bold p-3 rounded-xl ${forgotMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {forgotMessage.text}
                </div>
              )}

              <button 
                type="submit" 
                disabled={forgotLoading || !forgotEmail}
                className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {forgotLoading ? <Loader2 size={18} className="animate-spin" /> : <><Send size={16}/> ΑΠΟΣΤΟΛΗ LINK</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- STANDARD LOGIN FORM --- */}
      {!showOtpModal && !showForgotModal && (
        <div className="ir-auth-card w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-10 rounded-[40px] shadow-2xl relative z-10 animate-fade-in">
          <AuthIntro icon={LogIn} eyebrow="WELCOME BACK" title="Καλώς ήρθες ξανά" description="Συνδέσου και συνέχισε να ακούς ό,τι αγαπάς." />

          {error && (
            <div role="alert" className="ir-auth-feedback bg-red-500/10 border border-red-500/50 text-red-400 text-sm font-bold px-4 py-4 rounded-xl mb-6 text-center tracking-wide">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative group">
              {identifier.includes('@') ? (
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#ccff00] transition-colors" size={20} />
              ) : (
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#ccff00] transition-colors" size={20} />
              )}
              <input 
                type="text" 
                placeholder="Username ή Email" autoComplete="username" aria-label="Username ή Email" 
                value={identifier} 
                onChange={(e) => { setIdentifier(e.target.value); setError(''); }} 
                className="w-full bg-black/50 border border-white/5 h-16 rounded-2xl pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-[#ccff00]/50 text-white transition-colors" 
                required 
              />
            </div>

            <div className="space-y-2">
              <div className="relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#ccff00] transition-colors" size={20} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Κωδικός Πρόσβασης" autoComplete="current-password" aria-label="Κωδικός πρόσβασης" 
                  value={password} 
                  onChange={(e) => { setPassword(e.target.value); setError(''); }} 
                  className="w-full bg-black/50 border border-white/5 h-16 rounded-2xl pl-12 pr-12 text-sm font-medium focus:outline-none focus:border-[#ccff00]/50 text-white transition-colors" 
                  required 
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors outline-none focus:text-[#ccff00]"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              
              {/* 🟢 ΚΟΥΜΠΙ FORGOT PASSWORD */}
              <div className="flex justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowForgotModal(true)} 
                  className="text-[11px] font-bold text-zinc-500 hover:text-white transition-colors"
                >
                  Ξεχάσατε τον κωδικό σας;
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile Widget */}
            <div className="ir-auth-turnstile flex justify-center my-6">
              {siteKey ? (
                <Turnstile
                  key={siteKey}
                  ref={turnstileRef}
                  siteKey={siteKey}
                  options={{ action: 'login' }}
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
              disabled={loading}
              className="w-full bg-[#ccff00] text-black font-black uppercase tracking-widest h-16 rounded-2xl hover:bg-[#b3e600] active:scale-95 transition-all mt-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : "Συνδεση"}
            </button>
            
            <p className="text-center text-[11px] text-zinc-500 mt-3 font-medium">
              Με τη σύνδεση αποδέχεστε τους <Link to="/terms" className="text-white hover:text-[#ccff00] underline decoration-white/30 underline-offset-2">Όρους Χρήσης</Link> του iRadios.
            </p>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-8 font-medium">
            Δεν έχετε λογαριασμό; <Link to={inviteToken ? `/broadcast?invite=${encodeURIComponent(inviteToken)}` : "/register"} className="text-white font-bold hover:text-[#ccff00] transition-colors">Εγγραφή</Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
