import React, { useState, useEffect, useRef } from 'react';
import BrandLogo from '../components/BrandLogo';
import GoAgencyLanding from './GoAgencyLanding';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Target, Crown, Clock, LayoutGrid, LayoutPanelTop, Rows3, Mic2, Check, ArrowRight, 
  Building2, User, CheckCircle2, Loader2, X, ShieldCheck, KeyRound, MoveRight, Eye, EyeOff,
  BarChart, Zap, ShieldAlert, Sparkles, Lock, PieChart, Users
} from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import useTurnstileSiteKey from '../hooks/useTurnstileSiteKey';
import { useAlert } from '../context/AlertContext';

export default function GoAgency({ API_URL, setCurrentUser, currentUser }) {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';
  const {siteKey,turnstileError,retryTurnstile}=useTurnstileSiteKey(BASE_URL);
  const resetTurnstile = () => { setCfToken(''); turnstileRef.current?.reset(); };


  // --- UI STATES ---
  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // --- REGISTRATION & OTP STATES ---
  const [cfToken, setCfToken] = useState('');
  const turnstileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [vatLoading, setVatLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [feedback, setFeedback] = useState({ show: false, type: '', message: '' });

  const euCountries = [
    { code: 'EL', name: 'Ελλάδα' }, { code: 'CY', name: 'Κύπρος' },
    { code: 'DE', name: 'Γερμανία' }, { code: 'FR', name: 'Γαλλία' },
    { code: 'IT', name: 'Ιταλία' }, { code: 'BG', name: 'Βουλγαρία' },
  ];

  const phoneCodes = [
    { code: 'EL', prefix: '+30' }, { code: 'CY', prefix: '+357' },
    { code: 'DE', prefix: '+49' }, { code: 'UK', prefix: '+44' },
    { code: 'IT', prefix: '+39' },
  ];

  const [formData, setFormData] = useState({
    businessType: 'company', 
    countryCode: 'EL',
    vatNumber: '',
    companyName: '',
    username: '',
    email: '',
    password: '',
    fname: '',
    lname: '',
    phonePrefix: '+30',
    phone: ''
  });

  useEffect(() => {
    const pendingEmail = localStorage.getItem('iradios_agency_pending_otp');
    if (pendingEmail) {
      setFormData(prev => ({ ...prev, email: pendingEmail }));
      setShowOtpModal(true);
    }
  }, []);

  const handleActionClick = () => {
    if (!currentUser) {
      setShowModal(true);
    } else if (currentUser.role === 'agency') {
      navigate('/backoffice');
    } else {
      showAlert('Απαιτειται Agency Λογαριασμος', 'Για να δημιουργήσετε διαφημιστικές καμπάνιες, παρακαλώ αποσυνδεθείτε και δημιουργήστε έναν ξεχωριστό εταιρικό λογαριασμό (Agency).', 'warning');
    }
  };

  // --- VIES VERIFICATION ---
  const verifyVAT = async (vat, code = formData.countryCode) => {
    if (vat.length < 8) return;
    setVatLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/verify-vat/${code}/${vat}`);
      const data = await res.json();
      if (data.isValid || data.valid) {
        const rawName = data.name || "";
        const cleanName = rawName.split('||')[0].replace(/\n/g, ' ').trim();
        setFormData(prev => ({ ...prev, companyName: cleanName }));
        setFeedback({ show: true, type: 'success', message: 'Ταυτοποιήθηκε: ' + cleanName });
      } else {
        setFormData(prev => ({ ...prev, companyName: '' }));
        setFeedback({ show: true, type: 'error', message: 'Μη έγκυρο ΑΦΜ για τη χώρα ' + code });
      }
    } catch (error) {
      setFeedback({ show: true, type: 'error', message: 'Προσωρινή αδυναμία σύνδεσης με VIES.' });
    }
    setVatLoading(false);
  };

  const handleVatChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setFormData({ ...formData, vatNumber: val });
    if (val.length >= 8) verifyVAT(val);
  };

  // --- REGISTRATION SUBMIT ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!cfToken) {
      turnstileRef.current?.reset();
      setFeedback({ show: true, type: 'error', message: 'Παρακαλώ επιβεβαιώστε ότι δεν είστε ρομπότ.' });
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%*]).{6,}$/;
    if (!passwordRegex.test(formData.password)) {
      setFeedback({ show: true, type: 'error', message: 'Ο κωδικός πρέπει να έχει 6+ χαρακτήρες, 1 κεφαλαίο, 1 πεζό, 1 αριθμό και 1 σύμβολο (!@#$%*).' });
      return;
    }

    setLoading(true);
    setFeedback({ show: false, type: '', message: '' });

    try {
      const res = await fetch(`${BASE_URL}/auth/register-agency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phone: `${formData.phonePrefix}${formData.phone}`,
          cfToken 
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        if (data.requireOtp) {
          localStorage.setItem('iradios_agency_pending_otp', formData.email);
          setShowModal(false); 
          setShowOtpModal(true); 
        } else {
          setFeedback({ show: true, type: 'success', message: 'Επιτυχής Εγγραφή! Σε λίγο θα μεταφερθείτε στη σύνδεση.' });
          setTimeout(() => navigate('/login'), 3000);
        }
      } else {
        setFeedback({ show: true, type: 'error', message: data.error || 'Σφάλμα εγγραφής' });
        resetTurnstile(); 
      }
    } catch (error) {
      setFeedback({ show: true, type: 'error', message: 'Σφάλμα σύνδεσης με τον Server' });
      resetTurnstile(); 
    }
    setLoading(false);
  };

  // --- OTP VERIFICATION ---
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setOtpError('Ο κωδικός πρέπει να έχει 6 ψηφία.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');

    try {
      const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.removeItem('iradios_agency_pending_otp');
        localStorage.setItem('iluma_token', data.token);
        localStorage.setItem('iluma_user', JSON.stringify(data.user));
        if (setCurrentUser) setCurrentUser(data.user);
        setShowOtpModal(false);
        navigate('/backoffice');
      } else {
        setOtpError(data.error || 'Λάθος κωδικός OTP.');
      }
    } catch (err) {
      setOtpError('Σφάλμα κατά την επαλήθευση.');
    }
    setOtpLoading(false);
  };

  const closeOtpModal = () => {
    localStorage.removeItem('iradios_agency_pending_otp');
    setShowOtpModal(false);
    setOtp('');
    setOtpError('');
  };

  return (
    <div className="min-h-screen bg-[#08080e] text-white">
      <GoAgencyLanding currentUser={currentUser} onAction={handleActionClick}/>

      {/* --- AGENCY REGISTRATION MODAL --- */}
      {showModal && !showOtpModal && (
        <div className="ir-auth-overlay fixed inset-0 z-[200] flex items-start justify-center p-4 pt-12 md:pt-20 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
          
          <div className="ir-auth-modal ir-auth-modal--wide bg-zinc-950 border border-purple-500/20 p-6 md:p-8 rounded-[40px] w-full max-w-xl relative shadow-[0_0_80px_rgba(168,85,247,0.1)] mb-12 shrink-0">
            <button aria-label="Κλείσιμο φόρμας" onClick={() => { setShowModal(false); resetTurnstile(); }} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full z-10">
              <X size={20} />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                <BrandLogo variant="icon" title="iRadios GR" className="w-12 h-12 object-contain" />
              </div>
              <h3 className="text-3xl font-black text-white tracking-tight uppercase italic">Agency Portal</h3>
              <p className="text-sm text-zinc-400 mt-2">Δημιουργήστε τον εταιρικό λογαριασμό διαφημιστή.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* ΕΠΙΛΟΓΗ ΤΥΠΟΥ (Ιδιώτης / Εταιρεία) */}
              <div className="flex bg-black rounded-2xl p-1 border border-white/5">
                <button type="button" onClick={() => setFormData({...formData, businessType: 'individual'})} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${formData.businessType === 'individual' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                  <User size={16} /> Ιδιώτης / Freelancer
                </button>
                <button type="button" onClick={() => setFormData({...formData, businessType: 'company'})} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${formData.businessType === 'company' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                  <Building2 size={16} /> Εταιρεία (B2B)
                </button>
              </div>

              {/* ΠΕΔΙΑ ΕΤΑΙΡΕΙΑΣ VIES */}
              {formData.businessType === 'company' && (
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div>
                    <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <ShieldCheck size={14} /> ΑΦΜ ΕΤΑΙΡΕΙΑΣ (VIES)
                    </label>
                    <div className="flex gap-2">
                        <select 
                          value={formData.countryCode}
                          onChange={(e) => {
                              setFormData({...formData, countryCode: e.target.value});
                              if (formData.vatNumber.length >= 8) verifyVAT(formData.vatNumber, e.target.value);
                          }}
                          className="bg-black border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none cursor-pointer"
                        >
                          {euCountries.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                        <div className="relative flex-1">
                          <input 
                            type="text" required placeholder="ΑΦΜ..." value={formData.vatNumber} onChange={handleVatChange}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                          />
                          {vatLoading && <Loader2 size={18} className="absolute right-4 top-3.5 animate-spin text-purple-400" />}
                        </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Επωνυμια (Auto-fill)</label>
                    <input 
                      type="text" required placeholder="Επωνυμία επιχείρησης..." value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                      className={`w-full bg-black border rounded-xl px-4 py-3 text-white outline-none ${formData.companyName ? 'border-purple-500/50 text-purple-400' : 'border-white/10'}`}
                    />
                  </div>
                </div>
              )}

              {/* ΒΑΣΙΚΑ ΠΕΔΙΑ */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Ονομα</label>
                  <input type="text" aria-label="Όνομα" autoComplete="given-name" required value={formData.fname} onChange={(e) => setFormData({...formData, fname: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-purple-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Επιθετο</label>
                  <input type="text" aria-label="Επίθετο" autoComplete="family-name" required value={formData.lname} onChange={(e) => setFormData({...formData, lname: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-purple-500 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Username</label>
                  <input type="text" aria-label="Username" autoComplete="username" required value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})} className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-purple-500 transition-colors font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Τηλεφωνο</label>
                  <div className="flex gap-2">
                    <select value={formData.phonePrefix} onChange={(e) => setFormData({...formData, phonePrefix: e.target.value})} className="bg-black border border-white/10 rounded-2xl px-2 py-3.5 text-white text-xs outline-none focus:border-purple-500 cursor-pointer">
                      {phoneCodes.map(c => <option key={c.code} value={c.prefix}>{c.code} ({c.prefix})</option>)}
                    </select>
                    <input type="tel" aria-label="Τηλέφωνο" autoComplete="tel-national" required value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/[^0-9]/g, '')})} className="flex-1 w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-purple-500 transition-colors min-w-0" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Email (Επαγγελματικο)</label>
                <input type="email" aria-label="Email" autoComplete="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-purple-500 transition-colors" />
              </div>
              
              <div className="relative">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Κωδικος (Min 6)</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required minLength="6" 
                  value={formData.password} autoComplete="new-password"
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                  className="w-full bg-black border border-white/10 rounded-2xl px-4 pr-12 py-3.5 text-white outline-none focus:border-purple-500 transition-colors" 
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 bottom-3.5 text-zinc-500 hover:text-white transition-colors outline-none focus:text-purple-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="ir-auth-turnstile flex justify-center mt-6 mb-2">
                {siteKey ? (
                <Turnstile
                  key={siteKey}
                  ref={turnstileRef}
                  siteKey={siteKey}
                  options={{ action: 'register-agency' }}
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

              {feedback.show && (
                <div role="status" className={`ir-auth-feedback p-4 rounded-xl text-sm font-bold text-center border ${feedback.type === 'success' ? 'bg-[#ccff00]/10 text-[#ccff00] border-[#ccff00]/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {feedback.message}
                </div>
              )}

              <button 
                disabled={loading} 
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed tracking-widest uppercase mt-4 shadow-[0_10px_30px_rgba(168,85,247,0.3)]"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Target size={20} /> Ολοκληρωση Εγγραφης</>}
              </button>
              
              <p className="text-center text-[11px] text-zinc-500 mt-3 font-medium">
                Με την εγγραφή αποδέχεστε τους <Link to="/agency-terms" className="text-white hover:text-purple-400 underline decoration-white/30 underline-offset-2">Όρους Συνεργασίας (Agencies)</Link> του iRadios.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* --- OTP MODAL --- */}
      {showOtpModal && (
        <div className="ir-auth-overlay fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className="ir-auth-modal ir-auth-modal--narrow bg-[#111] border border-purple-500/30 p-10 rounded-[40px] w-full max-w-md shadow-[0_0_50px_rgba(168,85,247,0.15)] text-center relative">
            <button type="button" aria-label="Κλείσιμο επαλήθευσης" onClick={closeOtpModal} className="absolute right-5 top-5 rounded-full bg-white/5 p-2.5 text-zinc-400 hover:text-white"><X size={18} /></button>
            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <KeyRound size={40} className="text-purple-500" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase italic tracking-wider">Επαληθευση Email</h2>
            <p className="text-zinc-400 text-sm mb-8">
              Στείλαμε έναν 6-ψήφιο κωδικό στο <strong>{formData.email}</strong>. 
              <br/>Ελέγξτε τα εισερχόμενα σας.
            </p>

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <input 
                type="text" autoComplete="one-time-code" inputMode="numeric" aria-label="Κωδικός επιβεβαίωσης" maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="000000" autoFocus
                className="w-full bg-black border-2 border-white/10 h-20 rounded-2xl text-center text-4xl font-black text-purple-400 tracking-[0.5em] focus:border-purple-500 outline-none transition-colors"
              />
              
              {otpError && <div role="alert" className="ir-auth-feedback text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl">{otpError}</div>}

              <button 
                type="submit" disabled={otpLoading || otp.length !== 6}
                className="w-full bg-purple-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm hover:bg-purple-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {otpLoading ? <Loader2 size={20} className="animate-spin" /> : <><ShieldCheck size={20}/> ΕΝΕΡΓΟΠΟΙΗΣΗ ΛΟΓΑΡΙΑΣΜΟΥ</>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
