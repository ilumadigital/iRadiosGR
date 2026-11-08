import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  Radio, Mic2, BarChart3, Globe, Building2, User, CheckCircle2, Loader2, X, ShieldCheck, 
  Clock, KeyRound, MoveRight, MessageSquare, SlidersHorizontal, Target, Crown, Zap, Check, Eye, EyeOff, Activity, Volume2, Code2 
} from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';

export default function GoBroadcast({ API_URL, setCurrentUser }) {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const inviteToken = query.get('invite') || '';
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vatLoading, setVatLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cfToken, setCfToken] = useState('');

  // --- OTP STATES ---
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  const euCountries = [
    { code: 'EL', name: 'Ελλάδα' },
    { code: 'CY', name: 'Κύπρος' },
    { code: 'DE', name: 'Γερμανία' },
    { code: 'FR', name: 'Γαλλία' },
    { code: 'IT', name: 'Ιταλία' },
    { code: 'BG', name: 'Βουλγαρία' },
  ];

  const phoneCodes = [
    { code: 'EL', prefix: '+30' },
    { code: 'CY', prefix: '+357' },
    { code: 'DE', prefix: '+49' },
    { code: 'UK', prefix: '+44' },
    { code: 'IT', prefix: '+39' },
  ];

  const [formData, setFormData] = useState({
    businessType: 'individual',
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

  const [feedback, setFeedback] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    const pendingEmail = localStorage.getItem('iradios_broadcaster_pending_otp');
    if (pendingEmail) {
      setFormData(prev => ({ ...prev, email: pendingEmail }));
      setShowOtpModal(true);
    }
  }, []);

  useEffect(() => {
    if (!inviteToken) return;
    let alive = true;
    fetch(`${BASE_URL}/broadcaster-invitations/preview?token=${encodeURIComponent(inviteToken)}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; })
      .then(data => {
        if (alive) {
          setFormData(prev => ({ ...prev, email: data.email }));
          setShowModal(true);
        }
      })
      .catch(error => { if (alive) setFeedback({ show:true, type:'error', message:error.message || 'Η πρόσκληση δεν ισχύει.' }); });
    return () => { alive = false; };
  }, [inviteToken, BASE_URL]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!cfToken) {
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
      const res = await fetch(`${BASE_URL}/auth/register-broadcaster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phone: `${formData.phonePrefix}${formData.phone}`,
          cfToken,
          ...(inviteToken ? { inviteToken } : {})
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        if (data.requireOtp) {
          localStorage.setItem('iradios_broadcaster_pending_otp', formData.email);
          setShowModal(false); 
          setShowOtpModal(true); 
        } else {
          setFeedback({ show: true, type: 'success', message: 'Επιτυχής Εγγραφή! Σε λίγο θα μεταφερθείτε στη σύνδεση.' });
          setTimeout(() => window.location.href = inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login', 3000);
        }
      } else {
        setFeedback({ show: true, type: 'error', message: data.error || 'Σφάλμα εγγραφής' });
        setCfToken(''); 
      }
    } catch (error) {
      setFeedback({ show: true, type: 'error', message: 'Σφάλμα σύνδεσης με τον Server' });
      setCfToken(''); 
    }
    setLoading(false);
  };

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
        body: JSON.stringify({ email: formData.email, otp, ...(inviteToken ? { inviteToken } : {}) })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.removeItem('iradios_broadcaster_pending_otp');
        localStorage.setItem('iluma_token', data.token);
        localStorage.setItem('iluma_user', JSON.stringify(data.user));
        if (setCurrentUser) setCurrentUser(data.user);
        setShowOtpModal(false);
        navigate(inviteToken ? `/broadcaster-terms?invite=${encodeURIComponent(inviteToken)}` : '/'); 
      } else {
        setOtpError(data.error || 'Λάθος κωδικός OTP.');
      }
    } catch (err) {
      setOtpError('Σφάλμα κατά την επαλήθευση.');
    }
    setOtpLoading(false);
  };

  const closeOtpModal = () => {
    localStorage.removeItem('iradios_broadcaster_pending_otp');
    setShowOtpModal(false);
    setOtp('');
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden pb-32 animate-fade-in">
      
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[#ccff00]/10 blur-[150px] rounded-full pointer-events-none opacity-50"></div>
      <div className="absolute top-1/4 -right-40 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-full h-[300px] bg-gradient-to-t from-black to-transparent pointer-events-none z-10"></div>

      {/* --- OTP MODAL --- */}
      {showOtpModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in-95">
          <div className="bg-[#111] border border-blue-500/30 p-10 rounded-[40px] w-full max-w-md shadow-[0_0_50px_rgba(59,130,246,0.15)] text-center relative">
            <button onClick={closeOtpModal} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full">
              <X size={20} />
            </button>
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <KeyRound size={40} className="text-blue-500" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase italic tracking-wider">Επαληθευση Σταθμου</h2>
            <p className="text-zinc-400 text-sm mb-8">
              Στείλαμε έναν 6-ψήφιο κωδικό στο <strong>{formData.email}</strong>. 
              <br/>Ελέγξτε τα εισερχόμενα σας.
            </p>

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <input 
                type="text" 
                maxLength="6"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full bg-black border-2 border-white/10 h-20 rounded-2xl text-center text-4xl font-black text-blue-400 tracking-[0.5em] focus:border-blue-500 outline-none transition-colors"
                autoFocus
              />
              
              {otpError && <div className="text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl">{otpError}</div>}

              <button 
                type="submit" 
                disabled={otpLoading || otp.length !== 6}
                className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {otpLoading ? <Loader2 size={20} className="animate-spin" /> : <><ShieldCheck size={20}/> ΕΝΕΡΓΟΠΟΙΗΣΗ ΣΤΑΘΜΟΥ</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- REGISTRATION MODAL --- */}
      {showModal && !showOtpModal && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-12 md:pt-20 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
          
          <div className="bg-[#111] border border-white/10 p-6 md:p-8 rounded-[40px] w-full max-w-xl relative shadow-2xl mb-12 shrink-0">
            <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full z-10">
              <X size={20} />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#ccff00]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Radio size={32} className="text-[#ccff00]" />
              </div>
              <h3 className="text-3xl font-black text-white tracking-tight uppercase italic">Broadcaster Portal</h3>
              <p className="text-sm text-zinc-400 mt-2">Δημιουργήστε το προφίλ του σταθμού σας στο Network.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* ΕΠΙΛΟΓΗ ΤΥΠΟΥ */}
              <div className="flex bg-zinc-900 rounded-2xl p-1 border border-white/5">
                <button type="button" onClick={() => setFormData({...formData, businessType: 'individual'})} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${formData.businessType === 'individual' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                  <User size={16} /> Ιδιώτης
                </button>
                <button type="button" onClick={() => setFormData({...formData, businessType: 'company'})} className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${formData.businessType === 'company' ? 'bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20 shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                  <Building2 size={16} /> Εταιρεία
                </button>
              </div>

              {/* ΠΕΔΙΑ ΕΤΑΙΡΕΙΑΣ */}
              {formData.businessType === 'company' && (
                <div className="bg-[#ccff00]/5 border border-[#ccff00]/20 rounded-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  <div>
                    <label className="block text-xs font-bold text-[#ccff00] uppercase tracking-wider mb-2 flex items-center gap-2">
                        <ShieldCheck size={14} /> ΑΦΜ ΕΤΑΙΡΕΙΑΣ (VIES)
                    </label>
                    <div className="flex gap-2">
                        <select 
                          value={formData.countryCode}
                          onChange={(e) => {
                              setFormData({...formData, countryCode: e.target.value});
                              if (formData.vatNumber.length >= 8) verifyVAT(formData.vatNumber, e.target.value);
                          }}
                          className="bg-black/50 border border-white/10 rounded-xl px-3 py-3 text-white text-sm outline-none cursor-pointer"
                        >
                          {euCountries.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                        </select>
                        <div className="relative flex-1">
                          <input 
                            type="text" required placeholder="ΑΦΜ..." value={formData.vatNumber} onChange={handleVatChange}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#ccff00]/50 outline-none"
                          />
                          {vatLoading && <Loader2 size={18} className="absolute right-4 top-3.5 animate-spin text-[#ccff00]" />}
                        </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Επωνυμια (Auto-fill)</label>
                    <input 
                      type="text" required placeholder="Επωνυμία επιχείρησης..." value={formData.companyName} onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                      className={`w-full bg-black/50 border rounded-xl px-4 py-3 text-white outline-none ${formData.companyName ? 'border-[#ccff00]/50 text-[#ccff00]' : 'border-white/10'}`}
                    />
                  </div>
                </div>
              )}

              {/* ΒΑΣΙΚΑ ΠΕΔΙΑ */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Ονομα</label>
                  <input type="text" required value={formData.fname} onChange={(e) => setFormData({...formData, fname: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-[#ccff00]/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Επιθετο</label>
                  <input type="text" required value={formData.lname} onChange={(e) => setFormData({...formData, lname: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-[#ccff00]/50 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Username</label>
                  <input type="text" required value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '')})} className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-[#ccff00]/50 transition-colors font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Τηλεφωνο</label>
                  <div className="flex gap-2">
                    <select value={formData.phonePrefix} onChange={(e) => setFormData({...formData, phonePrefix: e.target.value})} className="bg-black/50 border border-white/10 rounded-2xl px-2 py-3.5 text-white text-xs outline-none focus:border-[#ccff00]/50 cursor-pointer">
                      {phoneCodes.map(c => <option key={c.code} value={c.prefix}>{c.code} ({c.prefix})</option>)}
                    </select>
                    <input type="tel" required value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/[^0-9]/g, '')})} className="flex-1 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-[#ccff00]/50 transition-colors min-w-0" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Email</label>
                <input type="email" required readOnly={Boolean(inviteToken)} value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-[#ccff00]/50 transition-colors" />
              </div>
              
              <div className="relative">
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">Κωδικος (Min 6)</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  minLength="6" 
                  value={formData.password} 
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                  className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 pr-12 py-3.5 text-white outline-none focus:border-[#ccff00]/50 transition-colors" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 bottom-3.5 text-zinc-500 hover:text-white transition-colors outline-none focus:text-[#ccff00]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="flex justify-center mt-6 mb-2">
                <Turnstile
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} 
                  onSuccess={(token) => setCfToken(token)}
                  onError={() => setCfToken('')}
                  onExpire={() => setCfToken('')}
                  theme="dark"
                />
              </div>

              {feedback.show && (
                <div className={`p-4 rounded-xl text-sm font-bold text-center border ${feedback.type === 'success' ? 'bg-[#ccff00]/10 text-[#ccff00] border-[#ccff00]/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {feedback.message}
                </div>
              )}

              <button 
                disabled={loading || !cfToken} 
                className="w-full bg-[#ccff00] hover:bg-[#b3e600] text-black font-black py-4.5 rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed tracking-widest uppercase mt-4 shadow-[0_10px_30px_rgba(204,255,0,0.2)]"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Mic2 size={20} /> Ολοκληρωση Εγγραφης</>}
              </button>
              
              <p className="text-center text-[11px] text-zinc-500 mt-3 font-medium">
                Με την εγγραφή αποδέχεστε τους <Link to="/terms" className="text-white hover:text-[#ccff00] underline decoration-white/30 underline-offset-2">Όρους Χρήσης</Link> του iRadios.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* --- MARKETING LANDING PAGE --- */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 lg:px-8 pt-20 pb-10">
        
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 border border-white/10 text-white text-xs font-bold tracking-widest uppercase mb-8 shadow-2xl hover:border-[#ccff00]/30 transition-colors cursor-default">
            <Radio size={16} className="text-[#ccff00] animate-pulse" />
            ΕΓΓΡΑΦΗ ΣΤΟ IRADIOS ΩΣ BROADCASTER
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 tracking-tighter leading-[1.1]">
            Ανέβασε τον Σταθμό σου.<br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 italic">
              Σήμερα, Δωρεάν.
            </span>
          </h1>
          
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed mb-10">
            Έλα στο μεγαλύτερο δίκτυο ραδιοφώνων εντελώς δωρεάν. Όταν είσαι έτοιμος, ξεκλείδωσε τα επαγγελματικά εργαλεία για DSP Ήχο και Διαφημίσεις.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={() => setShowModal(true)} className="w-full sm:w-auto bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-widest text-sm px-10 py-5 rounded-2xl inline-flex items-center justify-center gap-3 transition-transform hover:scale-[1.05] active:scale-95 shadow-[0_10px_40px_rgba(255,255,255,0.2)]">
              <Mic2 size={20} /> ΞΕΚΙΝΑ ΔΩΡΕΑΝ
            </button>
            <span className="text-zinc-500 text-sm font-medium">Δεν απαιτείται πιστωτική κάρτα</span>
          </div>
        </div>

        {/* Pricing/Features Funnel */}
        <div className="text-center mb-10">
          <h2 className="text-2xl font-black uppercase tracking-widest text-zinc-500">Το Scale Up ειναι στο χερι σου</h2>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          
          {/* Card 1: THE CORE NETWORK */}
          <div className="bg-[#0a0a0a] border border-white/5 hover:border-white/20 p-10 rounded-[50px] flex flex-col transition-all group relative overflow-hidden">
            {/* Subtle Glow Effect */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

            <div className="mb-8 relative z-10">
              <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center mb-10 border border-white/5 group-hover:scale-110 duration-500 shadow-2xl">
                <Globe size={32} className="text-white" />
              </div>
              <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">The Core</h3>
              <p className="text-zinc-500 font-medium leading-relaxed">
                Η είσοδός σας στο οικοσύστημα του iRadios. Ξεκινήστε να εκπέμπετε παγκόσμια με όλα τα βασικά εργαλεία identity.
              </p>
            </div>
            
            <div className="flex-1 space-y-4 mb-12 relative z-10">
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">ΒΑΣΙΚΕΣ ΠΑΡΟΧΕΣ:</p>
              
              <div className="flex items-center gap-3 text-xs font-bold text-zinc-300">
                <Check size={16} className="text-zinc-500" />
                <span>Καταχώρηση στο Παγκόσμιο Index</span>
              </div>
              
              <div className="flex items-center gap-3 text-xs font-bold text-zinc-300">
                <Check size={16} className="text-zinc-500" />
                <span>SEO & Reach Optimization</span>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold text-zinc-200">
                <Clock size={16} className="text-[#ccff00]" />
                <span>LIVE Πρόγραμμα Παραγωγών & Εκπομπών</span>
              </div>

              <div className="flex items-center gap-4 text-sm font-bold text-white bg-blue-500/10 p-4 rounded-[24px] -mx-2 border border-blue-500/10 shadow-lg">
                <MessageSquare size={18} className="text-blue-400" />
                <span>Live Chat με τους Ακροατές</span>
              </div>

              {/* 🟢 NEW: BASIC WIDGETS */}
              <div className="border border-white/10 bg-white/5 p-4 rounded-2xl mt-4 group/item">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-black text-white flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                    <Code2 size={14} className="text-blue-400" /> Web Widgets
                  </h4>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                  Ενσωματώστε το <strong className="text-zinc-300">Player Widget</strong> ή το <strong className="text-zinc-300">Metadata Widget</strong> στο site σας. Καθαρίζει τα μεταδεδομένα και βρίσκει τα εξώφυλλα των τραγουδιών αυτόματα!
                </p>
              </div>

            </div>
            
            <div className="relative z-10">
              <div className="text-3xl font-black text-white mb-6 tracking-tighter italic">FREE</div>
              <button 
                onClick={() => setShowModal(true)} 
                className="w-full py-5 bg-white/5 hover:bg-white text-zinc-400 hover:text-black border border-white/5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
              >
                ΞΕΚΙΝΑ ΔΩΡΕΑΝ <MoveRight size={14} />
              </button>
            
              <p className="text-center text-[9px] font-bold text-zinc-500 tracking-widest mt-6">
                ΧΩΡΙΣ ΑΠΑΙΤΗΣΗ ΚΑΡΤΑΣ
              </p>
            </div>
          </div>

          {/* Card 2: THE ADD-ONS */}
          <div className="bg-zinc-900/40 border border-white/5 hover:border-white/20 p-8 rounded-[40px] transition-all group flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-all duration-500">
              <Zap size={120} />
            </div>
            <div className="mb-6 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 shadow-lg">
                <SlidersHorizontal size={28} className="text-zinc-300" />
              </div>
              <h3 className="text-3xl font-black text-white uppercase italic tracking-tight">PRO Add-ons</h3>
              <p className="text-zinc-400 mt-2 font-medium">Ξεκλειδώστε την πλήρη ισχύ του σταθμού σας με μεμονωμένα εργαλεία επόμενης γενιάς.</p>
            </div>
            
            <div className="flex-1 space-y-4 mb-8 relative z-10">
              {/* DSP Engine */}
              <div className="border border-purple-500/20 bg-purple-500/5 p-4 rounded-2xl group/item hover:border-purple-500/40 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-black text-purple-400 flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                    <SlidersHorizontal size={14}/> Studio Evolution
                  </h4>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                  Ήχος επιπέδου FM. Pro Presets, AI Auto-leveling και Hi-Res Audio Upscaling.
                </p>
              </div>

              {/* Ad Control */}
              <div className="border border-emerald-500/20 bg-emerald-500/5 p-4 rounded-2xl group/item hover:border-emerald-500/40 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-black text-emerald-400 flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                    <Target size={14}/> Money Maker
                  </h4>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                  Custom Ad Injection, Frequency Targeting και απόλυτος έλεγχος των δικών σας εσόδων.
                </p>
              </div>

              {/* Audience Radar */}
              <div className="border border-blue-500/20 bg-blue-500/5 p-4 rounded-2xl group/item hover:border-blue-500/40 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-black text-blue-400 flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                    <BarChart3 size={14}/> Audience Radar
                  </h4>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                  Live χάρτης ακροατών, Heatmaps τοποθεσίας και Retention metrics σε πραγματικό χρόνο.
                </p>
              </div>

              {/* Live Control Room */}
              <div className="border border-orange-500/20 bg-orange-500/5 p-4 rounded-2xl group/item hover:border-orange-500/40 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-black text-orange-400 flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                    <Activity size={14}/> Live Control Room
                  </h4>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                  Live Server Health monitoring και ψηφιακό dB Meter για έλεγχο Master Out.
                </p>
              </div>

            </div>
            
            <button 
              onClick={() => setShowModal(true)}
              className="w-full py-5 bg-white text-black hover:bg-[#ccff00] rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all relative z-10 shadow-xl active:scale-95 flex items-center justify-center gap-2"
            >
              Εγγραφη & Αναβαθμιση <MoveRight size={14} />
            </button>
            <p className="text-center text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-6">
              ΕΝΕΡΓΟΠΟΙΗΣΗ ΜΕΣΩ ΤΟΥ BROADCASTER Menu
            </p>
          </div>

          {/* Card 3: THE FULL PREMIUM (THE EMPIRE BUNDLE) */}
          <div className="bg-gradient-to-b from-zinc-800 to-black border-2 border-[#ccff00] p-10 rounded-[50px] transition-all group flex flex-col transform lg:-translate-y-8 shadow-[0_40px_80px_rgba(204,255,0,0.15)] relative z-10">
            {/* Top Badge */}
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#ccff00] text-black text-[10px] font-black px-8 py-2 rounded-full uppercase tracking-[0.2em] shadow-[0_10px_20px_rgba(204,255,0,0.3)] whitespace-nowrap">
              ΤΟ ΑΠΟΛΥΤΟ ΠΑΚΕΤΟ
            </div>
            
            <div className="mb-8 mt-4 text-center md:text-left">
              <div className="w-16 h-16 rounded-3xl bg-[#ccff00]/20 flex items-center justify-center mb-8 border border-[#ccff00]/30 shadow-[0_0_30px_rgba(204,255,0,0.1)] group-hover:scale-110 transition-transform duration-500">
                <Crown size={36} className="text-[#ccff00]" />
              </div>
              <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4 leading-none">
                The Pro <span className="text-[#ccff00]">Pack</span>
              </h3>
              <p className="text-zinc-300 text-sm font-medium leading-relaxed">
                Η απόλυτη εμπειρία του iRadios. Ξεκλειδώστε όλη την τεχνολογία του iRadios, σε ένα πανίσχυρο πακέτο. 
              </p>
            </div>
            
            <div className="flex-1 space-y-4 mb-12">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">ΠΕΡΙΛΑΜΒΑΝΕΙ ΤΑ ΠΑΝΤΑ:</p>
              
              <div className="flex items-center gap-4 text-sm font-bold text-white bg-white/5 p-3 rounded-2xl border border-white/5">
                <CheckCircle2 size={20} className="text-[#ccff00] shrink-0" />
                <span>Απεριόριστοι Σταθμοί στο Δίκτυο</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm font-bold text-white">
                <Check size={20} className="text-[#ccff00] shrink-0" />
                <span>Full DSP Audio Mastering Engine</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm font-bold text-white">
                <Check size={20} className="text-[#ccff00] shrink-0" />
                <span>AdControl Injection Manager</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm font-bold text-white">
                <Check size={20} className="text-[#ccff00] shrink-0" />
                <span>Audience Radar (Full Analytics)</span>
              </div>

              <div className="flex items-center gap-4 text-sm font-bold text-white">
                <Check size={20} className="text-[#ccff00] shrink-0" />
                <span>Live Server Health & dB Meter</span>
              </div>

              {/* 🟢 NEW: PREMIUM WIDGETS */}
              <div className="flex items-start gap-4 text-sm font-bold text-white">
                <Check size={20} className="text-[#ccff00] shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span>Premium Web Widgets</span>
                  <span className="text-[10px] font-normal text-zinc-400 mt-1 leading-tight">Με ενσωματωμένο DSP επεξεργαστή, Cover Artworks και <strong>1-Click Spotify Save</strong> κουμπί για τους ακροατές σας.</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-sm font-bold text-white">
                <Check size={20} className="text-[#ccff00] shrink-0" />
                <span>Beta Access & 24/7 Priority Support</span>
              </div>
            </div>
            
            <button 
              onClick={() => setShowModal(true)}
              className="w-full py-6 bg-[#ccff00] hover:bg-[#b3e600] text-black rounded-[28px] font-black uppercase tracking-[0.2em] text-xs transition-all shadow-[0_20px_40px_rgba(204,255,0,0.2)] active:scale-95 flex items-center justify-center gap-3"
            >
              Εγγραφη & Αναβαθμιση <MoveRight size={14} />
            </button>
            <p className="text-center text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-6">
              ΕΝΕΡΓΟΠΟΙΗΣΗ ΜΕΣΩ ΤΟΥ BROADCASTER Menu
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
