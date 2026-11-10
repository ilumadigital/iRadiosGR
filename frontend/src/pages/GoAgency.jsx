import React, { useState, useEffect, useRef } from 'react';
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

  const isGuest = !currentUser;

  // --- UI STATES ---
  const [billingCycle, setBillingCycle] = useState('month'); 
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

  const marketingPrices = {
    radio_feed: { day: 3.99, month: 89.00, quarter: 239.00, half: 449.00, year: 899.00 },
    home:       { day: 5.99, month: 129.00, quarter: 349.00, half: 649.00, year: 1290.00 },
    hero:       { day: 8.99, month: 199.00, quarter: 539.00, half: 999.00, year: 1990.00 },
    audio:      { day: 9.99, month: 229.00, quarter: 619.00, half: 1149.00, year: 2290.00 }
  };

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
      navigate('/agency/dashboard');
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
        navigate('/agency/dashboard');
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
    <div className="min-h-screen bg-black text-white relative overflow-hidden pb-40">
      
      {/* --- BG EFFECTS --- */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none opacity-50"></div>
      <div className="absolute top-1/3 -right-64 w-[600px] h-[600px] bg-[#ccff00]/5 blur-[150px] rounded-full pointer-events-none opacity-40"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-12 pt-24 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* --- HERO SECTION --- */}
        <div className="text-center max-w-4xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black tracking-[0.3em] mb-8 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
            <Building2 size={14} className="animate-pulse" /> iRadios AD NETWORK
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-[1] uppercase italic">
            Ο ΗΧΟΣ ΓΙΝΕΤΑΙ <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-500 to-pink-500">ACTIONABLE DATA.</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-3xl mx-auto font-medium leading-relaxed mb-10">
            Σταματήστε να μαντεύετε την απόδοση των audio campaigns. Συνδέστε τα brands σας με ένα Premium κοινό και παρακολουθήστε Impressions, Clicks και CTR σε πραγματικό χρόνο, σε ένα 100% Brand Safe περιβάλλον.
          </p>

          <button 
            onClick={handleActionClick}
            className="bg-[#ccff00] text-black px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(204,255,0,0.25)] inline-flex items-center gap-3"
          >
            {currentUser?.role === 'agency' ? 'Μεταβαση στο Dashboard' : 'Ξεκινηστε μια Καμπανια'} <ArrowRight size={20} />
          </button>
        </div>

        {/* --- VALUE PROPOSITION (KEY POINTS) --- */}
        <div className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Prop 1 */}
            <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[32px] hover:bg-zinc-900/60 transition-colors group">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-tight">AdBlock Immunity</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Τα ηχητικά μας σποτ (Audio Pre-rolls) γίνονται inject απευθείας στο audio stream. Αδύνατον να παρακαμφθούν από AdBlockers, εγγυώμενα <strong className="text-white">100% Listenability</strong>.
              </p>
            </div>

            {/* Prop 2 */}
            <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[32px] hover:bg-zinc-900/60 transition-colors group">
              <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <PieChart size={28} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-tight">Real-Time Metrics</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Τέλος στα reports με υποθέσεις. Μέσα από το Agency Dashboard παρακολουθείτε <strong className="text-white">Live Impressions, Clicks και CTR</strong> για να δείχνετε το ROI στους πελάτες σας.
              </p>
            </div>

            {/* Prop 3 */}
            <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[32px] hover:bg-zinc-900/60 transition-colors group">
              <div className="w-14 h-14 bg-[#ccff00]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users size={28} className="text-[#ccff00]" />
              </div>
              <h3 className="text-xl font-black text-white mb-3 tracking-tight">Premium High-Intent Audience</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Προβάλετε το brand σας δίπλα σε κορυφαίους ραδιοφωνικούς σταθμούς. Ένα <strong className="text-white">Brand Safe</strong> περιβάλλον χωρίς user-generated "σκουπίδια".
              </p>
            </div>

          </div>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-24"></div>

        {/* --- PRICING SECTION HEADER --- */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white mb-4">
            Ευέλικτο <span className="text-purple-400">Inventory.</span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Επιλέξτε τη διάρκεια και το format που ταιριάζει στο budget σας. Χωρίς κρυφές χρεώσεις, πληρώνετε εφάπαξ (One-off) ανά καμπάνια, και ο χρόνος μετράει αυστηρά μετά την έγκριση (Go-Live).
          </p>
        </div>

        {/* --- DURATION TOGGLE --- */}
        <div className="flex justify-center mb-16 px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-zinc-900/80 border border-white/10 p-2 rounded-3xl md:rounded-[40px] shadow-2xl w-full max-w-4xl mx-auto">
            {['day', 'month', 'quarter', 'half', 'year'].map(p => (
            <button 
              key={p} 
              onClick={() => setBillingCycle(p)} 
              className={`w-full md:flex-1 px-4 py-4 rounded-2xl md:rounded-[32px] text-[11px] md:text-xs font-black uppercase tracking-widest transition-all ${
                billingCycle === p ? 'bg-white text-black shadow-xl md:scale-105' : 'text-zinc-500 hover:text-white hover:bg-white/5 md:hover:bg-transparent'
              }`}
            >
                {p === 'day' ? '1 Ημερα' : p === 'month' ? '1 Μηνας' : p === 'quarter' ? '3 Μηνες' : p === 'half' ? '6 Μηνες' : '1 Ετος'}
            </button>
            ))}
          </div>
        </div>

        {/* --- CARDS GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          
          {/* Card 1 */}
          <div className="bg-gradient-to-b from-purple-900/20 to-black border border-purple-500/30 hover:border-purple-500/60 rounded-[40px] p-8 flex flex-col relative shadow-[0_0_40px_rgba(168,85,247,0.05)] group transition-all">
            <div className="absolute top-0 right-0 bg-purple-500 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-2xl rounded-tr-[40px] uppercase tracking-widest">Best CTR</div>
            <div className="w-14 h-14 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-6">
                <LayoutGrid size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Native Grid<br/>Injection</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 min-h-[60px]">Εμφάνιση της διαφήμισής σας σαν κανονικός σταθμός μέσα στα feed των κατηγοριών.</p>
            <div className="text-4xl font-black tracking-tighter mb-8 text-white flex items-end gap-1 h-10">
                {isGuest ? (
                  <span className="text-sm text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2"><Lock size={16} /> Συνδεση για €</span>
                ) : (
                  `${marketingPrices.radio_feed[billingCycle]}€`
                )}
            </div>
            <div className="space-y-3 mb-10 flex-1">
              {['Highest Click-Through Rate', 'Native Seamless Experience', 'Square Format (1:1)', 'Targeted by Genre'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
                    <Check size={14} className="text-purple-500" /> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-gradient-to-b from-blue-900/20 to-black border border-blue-500/30 hover:border-blue-500/60 rounded-[40px] p-8 flex flex-col relative shadow-[0_0_40px_rgba(59,130,246,0.05)] group transition-all">
            <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                <LayoutPanelTop size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Prime Hero<br/>Takeover</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 min-h-[60px]">Μέγιστο Brand Awareness. Το πρώτο οπτικό ερέθισμα στην κορυφή της αρχικής σελίδας.</p>
            <div className="text-4xl font-black tracking-tighter mb-8 text-white flex items-end gap-1 h-10">
                {isGuest ? (
                  <span className="text-sm text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2"><Lock size={16} /> Συνδεση για €</span>
                ) : (
                  `${marketingPrices.hero[billingCycle]}€`
                )}
            </div>
            <div className="space-y-3 mb-10 flex-1">
              {['Massive Brand Awareness', 'Top of the Page Placement', 'Horizontal Format (16:9)', 'Maximum Reach'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
                    <Check size={14} className="text-blue-500" /> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-gradient-to-b from-emerald-900/20 to-black border border-emerald-500/30 hover:border-emerald-500/60 rounded-[40px] p-8 flex flex-col relative shadow-[0_0_40px_rgba(16,185,129,0.05)] group transition-all">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
                <Rows3 size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">In-Feed<br/>Display</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 min-h-[60px]">Έξυπνη και οργανική προβολή μεγάλου banner ανάμεσα στις λίστες των ραδιοφώνων.</p>
            <div className="text-4xl font-black tracking-tighter mb-8 text-white flex items-end gap-1 h-10">
                {isGuest ? (
                  <span className="text-sm text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2"><Lock size={16} /> Συνδεση για €</span>
                ) : (
                  `${marketingPrices.home[billingCycle]}€`
                )}
            </div>
            <div className="space-y-3 mb-10 flex-1">
              {['In-Feed Scrolling View', 'Cost-Effective Choice', 'Horizontal Format (16:9)', 'Excellent for Direct Promos'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
                    <Check size={14} className="text-emerald-500" /> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-gradient-to-b from-orange-900/20 to-black border border-orange-500/30 hover:border-orange-500/60 rounded-[40px] p-8 flex flex-col relative shadow-[0_0_40px_rgba(249,115,22,0.05)] group transition-all">
            <div className="w-14 h-14 bg-orange-500/20 text-orange-400 rounded-2xl flex items-center justify-center mb-6">
                <Mic2 size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-white">Interactive<br/>Audio</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 min-h-[60px]">Το μέλλον του ραδιοφώνου. Ηχητικό σποτ πριν την ακρόαση με Click-to-Action Companion Ad.</p>
            <div className="text-4xl font-black tracking-tighter mb-8 text-white flex items-end gap-1 h-10">
                {isGuest ? (
                  <span className="text-sm text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2"><Lock size={16} /> Συνδεση για €</span>
                ) : (
                  `${marketingPrices.audio[billingCycle]}€`
                )}
            </div>
            <div className="space-y-3 mb-10 flex-1">
                {['Unskippable Audio Format', 'Companion Display Ad Link', '100% Listenability', 'Direct Conversion Action'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
                    <Check size={14} className="text-orange-500" /> {f}
                </div>
                ))}
            </div>
          </div>
        </div>

        {/* --- BOTTOM CALL TO ACTION --- */}
        <div className="mt-24 text-center pb-12">
          <h3 className="text-2xl font-bold text-white mb-6">Έτοιμοι να ανεβάσετε το ROI των πελατών σας;</h3>
          <button 
            onClick={handleActionClick}
            className="bg-white text-black px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_10px_40px_rgba(255,255,255,0.2)] inline-flex items-center gap-3"
          >
            {currentUser?.role === 'agency' ? 'Ανοιγμα Dashboard' : 'Δημιουργια Agency Account'} <ArrowRight size={20} />
          </button>
        </div>

      </div>

      {/* --- AGENCY REGISTRATION MODAL --- */}
      {showModal && !showOtpModal && (
        <div className="ir-auth-overlay fixed inset-0 z-[200] flex items-start justify-center p-4 pt-12 md:pt-20 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto custom-scrollbar">
          
          <div className="ir-auth-modal ir-auth-modal--wide bg-zinc-950 border border-purple-500/20 p-6 md:p-8 rounded-[40px] w-full max-w-xl relative shadow-[0_0_80px_rgba(168,85,247,0.1)] mb-12 shrink-0">
            <button aria-label="Κλείσιμο φόρμας" onClick={() => { setShowModal(false); resetTurnstile(); }} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full z-10">
              <X size={20} />
            </button>
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                <img src="/iradios-app-logo.png" alt="iRadiosGR" className="w-12 h-12 object-contain" />
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
