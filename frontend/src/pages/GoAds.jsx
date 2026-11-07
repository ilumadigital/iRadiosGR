import React, { useState } from 'react';
import { 
  Rocket, Check, Target, Globe, ShieldCheck, Loader2, X, AlertTriangle,
  Crown, BarChart3, LayoutGrid, LayoutPanelTop, Rows3, Mic2, Star, Clock, Lock
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// ⚠️ Βάλε το LIVE Publishable Key σου
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

// --- STRIPE FORM COMPONENT ---
const StripeCheckoutForm = ({ plan, price, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message);
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={{ layout: 'tabs' }} />
      {errorMessage && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle size={16} /> {errorMessage}
        </div>
      )}
      <button 
        disabled={isProcessing || !stripe || !elements} 
        className="w-full h-14 bg-[#ccff00] text-black font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-2xl disabled:opacity-50"
      >
        {isProcessing ? <Loader2 className="animate-spin" /> : `ΠΛΗΡΩΜΗ ${price}€`}
      </button>
    </form>
  );
};

export default function GoAds({ API_URL, currentUser }) {
  const [period, setPeriod] = useState('month'); 
  const [loading, setLoading] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [activePlan, setActivePlan] = useState(null);
  const [clientSecret, setClientSecret] = useState("");

  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  // 🟢 ΕΛΕΓΧΟΣ ΔΙΚΑΙΩΜΑΤΩΝ ΓΙΑ ΕΜΦΑΝΙΣΗ ΤΙΜΩΝ
  const canSeePrices = currentUser?.role === 'admin' || currentUser?.role === 'agency';

  // 1. LIVE STRIPE PRICE IDS MAPPING 
  const stripePriceIds = {
    hero: { 
      day: 'price_1T96oJHiixNRiHTmeb9TWjQW', 
      month: 'price_1T96suHiixNRiHTmMnAGpnQZ', 
      '3months': 'price_1T96suHiixNRiHTmCPmZ3BRd', 
      '6months': 'price_1T96suHiixNRiHTmSQj85CK3', 
      year: 'price_1T96suHiixNRiHTmCdtdzMKm' 
    },
    radio_feed: { 
      day: 'price_1T96w3HiixNRiHTm8aqYWio0', 
      month: 'price_1T96x5HiixNRiHTmJMXhOg29', 
      '3months': 'price_1T96x5HiixNRiHTmOfnKC8OF', 
      '6months': 'price_1T96x5HiixNRiHTmlmTyYIsu', 
      year: 'price_1T96x5HiixNRiHTmmlZFKfwJ' 
    },
    home: { 
      day: 'price_1T96ydHiixNRiHTmRjYMJqnk', 
      month: 'price_1T96zNHiixNRiHTmPiLVQ3li', 
      '3months': 'price_1T96zNHiixNRiHTmtwJ6ntfW', 
      '6months': 'price_1T96zNHiixNRiHTmPeM5gw9G', 
      year: 'price_1T96zNHiixNRiHTmbYwsshrH' 
    },
    audio: { 
      day: 'price_1T971IHiixNRiHTm47OhohEf', 
      month: 'price_1T9726HiixNRiHTm8wXBwGU3', 
      '3months': 'price_1T9726HiixNRiHTmlS91sdPK', 
      '6months': 'price_1T9726HiixNRiHTmoK55GgRY', 
      year: 'price_1T9726HiixNRiHTmtD8XQIqi' 
    }
  };

  const displayPrices = {
    radio_feed: { day: 6.99, month: 149.00, '3months': 389.00, '6months': 699.00, year: 1199.00 },
    hero: { day: 3.99, month: 89.00, '3months': 239.00, '6months': 429.00, year: 749.00 },
    home: { day: 2.99, month: 69.00, '3months': 179.00, '6months': 319.00, year: 549.00 },
    audio: { day: 0.99, month: 24.00, '3months': 64.00, '6months': 119.00, year: 199.00 }
  };

  const handleCheckout = async (type, planName) => {
    if (!currentUser) return alert("Παρακαλώ συνδεθείτε για να αγοράσετε διαφήμιση.");
    if (!canSeePrices) return alert("Απαιτείται λογαριασμός Agency για προβολή τιμών και αγορά. Επικοινωνήστε μαζί μας.");
    
    setLoading(true);
    
    const priceId = stripePriceIds[type][period];
    const price = displayPrices[type][period];

    try {
      const res = await fetch(`${BASE_URL}/payments/create-ad-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUser._id || currentUser.id, 
          priceId: priceId,
          planId: `ad_${type}_${period}`,
          adType: type,
          duration: period
        }) 
      });
      
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setActivePlan({ type, name: planName, price });
        setShowStripeModal(true);
      } else {
         alert("Υπήρξε σφάλμα κατά τη δημιουργία της πληρωμής.");
      }
    } catch (err) { alert("Σφάλμα σύνδεσης με το σύστημα πληρωμών."); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden pb-40">
      
      {/* --- STRIPE MODAL --- */}
      {showStripeModal && clientSecret && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-12 md:pt-24 bg-black/98 backdrop-blur-3xl overflow-y-auto custom-scrollbar">
          <div className="bg-white p-8 md:p-12 rounded-[50px] w-full max-w-md relative shadow-2xl animate-in zoom-in-95 text-black">
            <button onClick={() => setShowStripeModal(false)} className="absolute top-8 right-8 text-zinc-400 hover:text-black transition-colors">
              <X size={28} />
            </button>
            <div className="text-center mb-10">
              <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100 mb-4 inline-block">Secure Stripe Gateway</span>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter">{activePlan?.name}</h3>
              <p className="text-5xl font-black mt-4 italic tracking-tighter">{activePlan?.price}€</p>
            </div>
            
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripeCheckoutForm 
                plan={activePlan} 
                price={activePlan?.price} 
                onSuccess={() => window.location.href = '/advertiser-dashboard'} 
              />
            </Elements>
          </div>
        </div>
      )}

      {/* --- BG EFFECTS --- */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none opacity-40"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-12 pt-24">
        
        {/* --- HEADER --- */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black tracking-[0.3em] uppercase mb-10">
            <Target size={14} className="animate-pulse" /> iRadios Ad Network
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter leading-[0.9] uppercase italic">
            Κυριαρχησε στο <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-500 to-pink-500">iRadios Network.</span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed mb-10">
            Προσέγγισε χιλιάδες ακροατές την ώρα που απολαμβάνουν τη μουσική τους. Στήσε την καμπάνια σου σε 2 λεπτά και δες το brand σου να απογειώνεται.
          </p>

          {/* 🟢 B2B PERKS & RULES */}
          <div className="flex flex-col md:flex-row justify-center gap-4 max-w-3xl mx-auto">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-3 text-left">
              <Crown size={24} className="text-[#ccff00] shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-sm text-white">Δωρεάν Premium Λογαριασμός</h4>
                <p className="text-[10px] text-zinc-400 mt-1">Για όσο διάστημα τρέχει η διαφήμισή σου, απολαμβάνεις το iRadios χωρίς διαφημίσεις, εντελώς δωρεάν.</p>
              </div>
            </div>
            <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-3 text-left">
              <Clock size={24} className="text-blue-400 shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-sm text-white">Δίκαιη Χρέωση Χρόνου</h4>
                <p className="text-[10px] text-zinc-400 mt-1">Ο χρόνος της καμπάνιας ξεκινάει να μετράει <b>μόνο</b> από τη στιγμή που η διαφήμισή σου εγκριθεί από την ομάδα μας και βγει live.</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- DURATION TOGGLE (Φαίνεται ΜΟΝΟ σε Agency/Admin) --- */}
        {canSeePrices && (
          <div className="flex justify-center mb-16 overflow-x-auto pb-4">
              <div className="inline-flex bg-zinc-900/80 border border-white/10 p-2 rounded-[30px] shadow-2xl whitespace-nowrap">
                  {['day', 'month', '3months', '6months', 'year'].map(p => (
                  <button key={p} onClick={() => setPeriod(p)} className={`px-6 md:px-10 py-4 rounded-[24px] text-xs font-black uppercase tracking-widest transition-all ${period === p ? 'bg-white text-black shadow-xl scale-105' : 'text-zinc-500 hover:text-white'}`}>
                      {p === 'day' ? '1 Ημερα' : p === 'month' ? '1 Μηνας' : p === '3months' ? '3 Μηνες' : p === '6months' ? '6 Μηνες' : '1 Ετος'}
                  </button>
                  ))}
              </div>
          </div>
        )}

        {/* --- CARDS GRID --- */}
        <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto ${!canSeePrices ? 'mt-16' : ''}`}>
          
          {/* 1. RADIO SEARCH PAGE PLACEMENT (Premium Native) */}
          <div className="bg-gradient-to-b from-purple-900/20 to-black border border-purple-500/30 hover:border-purple-500/60 rounded-[40px] p-8 flex flex-col relative shadow-[0_0_40px_rgba(168,85,247,0.05)] group transition-all">
            <div className="absolute top-0 right-0 bg-purple-500 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-2xl rounded-tr-[40px] uppercase tracking-widest">Best CTR</div>
            <div className="w-14 h-14 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-6">
                <LayoutGrid size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Native Radio<br/>Placement</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 min-h-[60px]">Εμφάνιση της διαφήμισής σου σαν κανονικό ραδιόφωνο μέσα στα grids των κατηγοριών και περιοχών.</p>
            
            {canSeePrices ? (
              <div className="text-4xl font-black tracking-tighter mb-8 text-white">
                  {displayPrices.radio_feed[period]}€ <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase">/ {period}</span>
              </div>
            ) : (
              <div className="flex flex-col mb-8">
                <div className="text-2xl font-black tracking-tighter text-white/40 uppercase flex items-center gap-2">
                  <Lock size={20} /> Κρυφη Τιμη
                </div>
                <span className="text-[10px] font-bold text-purple-500/70 tracking-widest mt-1">ΜΟΝΟ ΓΙΑ AGENCIES</span>
              </div>
            )}

            <div className="space-y-3 mb-10 flex-1">
              {['Highest Click-Through Rate', 'Native Design Experience', 'Square Format (1:1)', 'Targeted by Genre/Region'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
                    <Check size={14} className="text-purple-500" /> {f}
                </div>
              ))}
            </div>
            {/* <button onClick={() => handleCheckout('radio_feed', 'Native Radio Placement')} className="w-full py-4 bg-purple-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-purple-400 transition-all active:scale-95 shadow-xl">
              ΕΠΙΛΟΓΗ ΠΑΚΕΤΟΥ
            </button> */}
          </div>

          {/* 2. HERO SECTION BANNER */}
          <div className="bg-gradient-to-b from-blue-900/20 to-black border border-blue-500/30 hover:border-blue-500/60 rounded-[40px] p-8 flex flex-col relative shadow-[0_0_40px_rgba(59,130,246,0.05)] group transition-all">
            <div className="w-14 h-14 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6">
                <LayoutPanelTop size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Hero Section<br/>Banner</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 min-h-[60px]">Το πρώτο πράγμα που βλέπουν οι χρήστες. Τεράστια προβολή στην κορυφή της αρχικής σελίδας.</p>
            
            {canSeePrices ? (
              <div className="text-4xl font-black tracking-tighter mb-8 text-white">
                  {displayPrices.hero[period]}€ <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase">/ {period}</span>
              </div>
            ) : (
              <div className="flex flex-col mb-8">
                <div className="text-2xl font-black tracking-tighter text-white/40 uppercase flex items-center gap-2">
                  <Lock size={20} /> Κρυφη Τιμη
                </div>
                <span className="text-[10px] font-bold text-blue-500/70 tracking-widest mt-1">ΜΟΝΟ ΓΙΑ AGENCIES</span>
              </div>
            )}

            <div className="space-y-3 mb-10 flex-1">
              {['Massive Brand Awareness', 'Top of the Page Placement', 'Horizontal Format (16:9)', 'High Visibility Guarantee'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
                    <Check size={14} className="text-blue-500" /> {f}
                </div>
              ))}
            </div>
            {/* <button onClick={() => handleCheckout('hero', 'Hero Section Banner')} className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-400 transition-all active:scale-95 shadow-xl">
              ΕΠΙΛΟΓΗ ΠΑΚΕΤΟΥ
            </button> */}
          </div>

          {/* 3. HOME PAGE BANNER */}
          <div className="bg-gradient-to-b from-emerald-900/20 to-black border border-emerald-500/30 hover:border-emerald-500/60 rounded-[40px] p-8 flex flex-col relative shadow-[0_0_40px_rgba(16,185,129,0.05)] group transition-all">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
                <Rows3 size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Home Page<br/>Banner</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 min-h-[60px]">Οριζόντιο banner ανάμεσα στις κατηγορίες ραδιοφώνων για έξυπνη, οργανική προβολή.</p>
            
            {canSeePrices ? (
              <div className="text-4xl font-black tracking-tighter mb-8 text-white">
                  {displayPrices.home[period]}€ <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase">/ {period}</span>
              </div>
            ) : (
              <div className="flex flex-col mb-8">
                <div className="text-2xl font-black tracking-tighter text-white/40 uppercase flex items-center gap-2">
                  <Lock size={20} /> Κρυφη Τιμη
                </div>
                <span className="text-[10px] font-bold text-emerald-500/70 tracking-widest mt-1">ΜΟΝΟ ΓΙΑ AGENCIES</span>
              </div>
            )}

            <div className="space-y-3 mb-10 flex-1">
              {['In-Feed Scrolling View', 'Cost-Effective Choice', 'Horizontal Format (16:9)', 'Excellent for Promotions'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
                    <Check size={14} className="text-emerald-500" /> {f}
                </div>
              ))}
            </div>
            {/* <button onClick={() => handleCheckout('home', 'Home Page Banner')} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-all active:scale-95 shadow-xl">
              ΕΠΙΛΟΓΗ ΠΑΚΕΤΟΥ
            </button> */}
          </div>

          {/* 4. AUDIO INTERACTIVE AD */}
          <div className="bg-gradient-to-b from-orange-900/20 to-black border border-orange-500/30 hover:border-orange-500/60 rounded-[40px] p-8 flex flex-col relative shadow-[0_0_40px_rgba(249,115,22,0.05)] group transition-all">
            <div className="w-14 h-14 bg-orange-500/20 text-orange-400 rounded-2xl flex items-center justify-center mb-6">
                <Mic2 size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-white">Audio<br/>Interactive Ad</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 min-h-[60px]">Ακούγεται πριν την έναρξη του ραδιοφώνου με δυνατότητα Click-to-Action.</p>
            
            {canSeePrices ? (
              <div className="text-4xl font-black tracking-tighter mb-8 text-white">
                  {displayPrices.audio[period]}€ <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase">/ {period}</span>
              </div>
            ) : (
              <div className="flex flex-col mb-8">
                <div className="text-2xl font-black tracking-tighter text-white/40 uppercase flex items-center gap-2">
                  <Lock size={20} /> Κρυφη Τιμη
                </div>
                <span className="text-[10px] font-bold text-orange-500/70 tracking-widest mt-1">ΜΟΝΟ ΓΙΑ AGENCIES</span>
              </div>
            )}

            <div className="space-y-3 mb-10 flex-1">
                {['Pre-roll Audio Spot', 'Companion Display Ad', 'Unskippable Format', 'Direct Link Action'].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] font-bold text-zinc-300">
                    <Check size={14} className="text-orange-500" /> {f}
                </div>
                ))}
            </div>
            
            {/* <button 
                onClick={() => handleCheckout('audio', 'Audio Interactive Ad')} 
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-orange-400 transition-all active:scale-95 shadow-xl"
            >
                ΕΠΙΛΟΓΗ ΠΑΚΕΤΟΥ
            </button> */}
          </div>

        </div>

      </div>
    </div>
  );
}
