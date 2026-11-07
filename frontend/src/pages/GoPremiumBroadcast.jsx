import React, { useState, useEffect } from 'react';
import { 
  Radio, SlidersHorizontal, Target, Crown, Check, 
  Shield, CreditCard, Loader2, X, Zap, Rocket, 
  Speaker, Lock, Infinity, Sparkles, AlertCircle, CheckCircle2,
  BarChart3, MoveRight, ShieldCheck, Globe, Code2 
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// ⚠️ ΒΑΛΕ ΕΔΩ ΤΟ PUBLISHABLE KEY ΣΟΥ (pk_test_...)
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_')
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : Promise.resolve(null);

// --- STRIPE CHECKOUT FORM COMPONENT ---
const StripeCheckoutForm = ({ plan, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
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
          <AlertCircle size={16} /> {errorMessage}
        </div>
      )}

      <button 
        disabled={isProcessing || !stripe || !elements} 
        className="w-full h-14 bg-black text-[#ccff00] font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-2 shadow-2xl disabled:opacity-50"
      >
        {isProcessing ? <Loader2 className="animate-spin" size={20} /> : `ΠΛΗΡΩΜΗ ${plan.price}€ / ΜΗΝΑ`}
      </button>
    </form>
  );
};


export default function GoPremiumBroadcast({ API_URL, currentUser }) {
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [clientSecret, setClientSecret] = useState(""); 
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const BASE_URL = (API_URL && !API_URL.includes('localhost')) ? API_URL : '/api';

  if (!currentUser || (currentUser.role !== 'broadcaster' && currentUser.role !== 'admin')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <Lock size={40} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Περιορισμένη Πρόσβαση</h2>
        <p className="text-zinc-500 max-w-sm">Αυτή η σελίδα απευθύνεται αποκλειστικά σε πιστοποιημένους Broadcasters.</p>
      </div>
    );
  }

  const getPlanStatus = (planId) => {
    const profile = currentUser.broadcasterProfile || {};
    const features = profile.features || {};
    const isFullPremium = profile.tier === 'premium';

    if (isFullPremium) return 'owned';
    if (planId === 'ad_control_solo' && features.adControl) return 'owned';
    if (planId === 'dsp_solo' && features.dspEngine) return 'owned';
    if (planId === 'analytics_solo' && features.analytics) return 'owned';

    return 'available';
  };

  const plans = [
    {
      id: 'analytics_solo',
      stripePriceId: 'price_1T8hLRHiixNRiHTmMPkeKidZ', 
      name: "AUDIENCE RADAR",
      price: 6.99,
      icon: <BarChart3 className="text-blue-500" size={28} />,
      description: "Μάθετε ποιοι σας ακούνε, από πού και για πόση ώρα. Intel σε πραγματικό χρόνο.",
      features: ["Live Listeners Tracker", "Real-time Heatmap", "Average Listen Time", "Device Analytics", "Listeners Locations LIVE", "LIVE Master Output db Meter"],
      notIncluded: ["DSP Audio Engine", "AdControl Manager"],
      colorClass: "blue",
      bgGradient: "from-blue-900/20 to-black",
      borderColor: "border-blue-500/20"
    },
    {
      id: 'full_premium',
      stripePriceId: 'price_1T8hNYHiixNRiHTmgYvLjU8q',
      name: "THE PRO PACK",
      price: 84.99,
      isHero: true,
      icon: <Crown className="text-[#ccff00]" size={32} />,
      description: "Η απόλυτη κυριαρχία στα FM του μέλλοντος. Όλα τα εργαλεία μας, χωρίς όρια.",
      features: [
        "Απεριόριστους σταθμούς στο iRadios", 
        "Full DSP Audio Engine (Included)", 
        "AdControl Manager (Included)", 
        "Audience Radar (Included)",
        "Premium Player Widget με ενσωματωμένο DSP, 1Click Spotify Save Κουμπί, metadata τραγουδιού με καθαρισμό περιττών λέξεων και Cover Artworks τραγουδιού", // 🟢 ΝΕΟ
        "Metadata Widget με metadata τραγουδιού με καθαρισμό περιττών λέξεων και Cover Artworks τραγουδιού & 1Click Spotify Save Κουμπί", // 🟢 ΝΕΟ
        "Priority 1-on-1 Support",
        "Beta Access σε νέα Labs"
      ],
      colorClass: "lime",
      bgGradient: "from-[#ccff00] to-green-500",
      borderColor: "border-[#ccff00]"
    },
    {
      id: 'ad_control_solo',
      stripePriceId: 'price_1T8hMWHiixNRiHTmAHjcqJOT',
      name: "MONEY MAKER",
      price: 44.99,
      icon: <Target className="text-emerald-500" size={28} />,
      description: "Μετατρέψτε το σταθμό σας σε επιχείρηση. Δικές σας διαφημίσεις, δικά σας έσοδα.",
      features: ["Custom Ad Injection", "Unlimited Ad Spots", "Frequency Targeting", "Network Ads Opt-out"],
      notIncluded: ["DSP Audio Engine", "Audience Radar"],
      colorClass: "emerald",
      bgGradient: "from-emerald-900/20 to-black",
      borderColor: "border-emerald-500/20"
    },
    {
      id: 'dsp_solo',
      stripePriceId: 'price_1T8hN6HiixNRiHTmBOTXDyiT',
      name: "STUDIO EVOLUTION",
      price: 79.99,
      icon: <SlidersHorizontal className="text-purple-500" size={28} />,
      description: "Ήχος που κόβει την ανάσα. Μεταμορφώστε ένα απλό stream σε FM υπερπαραγωγή.",
      features: [
        "Pro Audio Presets", 
        "Dynamic Range Control", 
        "Hi-Res Audio Upscaling",
        "Premium Player Widget με ενσωματωμένο DSP, 1Click Spotify Save Κουμπί, metadata τραγουδιού με καθαρισμό περιττών λέξεων και Cover Artworks τραγουδιού", // 🟢 ΝΕΟ
        "Metadata Widget με metadata τραγουδιού με καθαρισμό περιττών λέξεων και Cover Artworks τραγουδιού & 1Click Spotify Save Κουμπί" // 🟢 ΝΕΟ
      ],
      notIncluded: ["AdControl Manager", "Unlimited Stations"],
      colorClass: "purple",
      bgGradient: "from-purple-900/20 to-black",
      borderColor: "border-purple-500/20"
    }
  ];

  const handleSubscribe = async (plan) => {
    if (getPlanStatus(plan.id) === 'owned') return;

    setLoading(true);
    setSelectedPlan(plan);
    setPaymentSuccess(false);
    
    try {
      const res = await fetch(`${BASE_URL}/payments/create-stripe-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUser._id || currentUser.id, 
          priceId: plan.stripePriceId, 
          planId: plan.id 
        }) 
      });
      
      const data = await res.json();
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setShowStripeModal(true);
      } else {
        alert(`Σφάλμα Stripe: ${data.error || "Δεν λάβαμε το κλειδί πληρωμής."}\nΠοσό που είδε η Stripe: ${data.amount_due}€`);
      }
    } catch (err) {
      alert("Σφάλμα επικοινωνίας με το Stripe.");
    }
    setLoading(false);
  };

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 5000);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 lg:p-12 relative pb-32">
      
      {/* --- STRIPE MODAL --- */}
      {showStripeModal && clientSecret && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-12 md:pt-24 bg-black/95 backdrop-blur-2xl overflow-y-auto custom-scrollbar">
          
          <div className="bg-white p-8 md:p-10 rounded-[48px] w-full max-w-md relative shadow-2xl animate-in zoom-in-95 mb-12 transition-all duration-500">
            
            {!paymentSuccess && (
              <button 
                onClick={() => setShowStripeModal(false)} 
                className="absolute top-6 right-6 text-zinc-400 hover:text-black p-2 transition-colors bg-zinc-100 rounded-full z-10"
              >
                <X size={24} />
              </button>
            )}

            {paymentSuccess ? (
              <div className="text-center py-8 animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-[#ccff00] rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(204,255,0,0.4)]">
                  <CheckCircle2 size={48} className="text-black" />
                </div>
                <h3 className="text-3xl font-black text-black italic uppercase tracking-tighter">
                  MISSION ACCOMPLISHED
                </h3>
                <p className="text-zinc-500 mt-4 font-medium leading-relaxed">
                  Το πακέτο <strong className="text-black">{selectedPlan?.name}</strong> ενεργοποιήθηκε!<br/>
                  Γίνεται ανανέωση των Studio εργαλείων σας...
                </p>
                
                <div className="w-full h-1.5 bg-zinc-100 mt-10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#ccff00] animate-progress-5s"></div>
                </div>
                
                <p className="text-[10px] text-zinc-400 mt-4 font-black uppercase tracking-widest animate-pulse">
                  System Refresh in 5 seconds
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-8 pt-4">
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block">Stripe Secure Checkout</span>
                  <h3 className="text-2xl font-black text-black uppercase tracking-tight">{selectedPlan?.name}</h3>
                  <p className="text-4xl font-black text-white bg-black inline-block px-6 py-2 rounded-2xl mt-4 shadow-xl italic">
                    {selectedPlan?.price}€ <span className="text-sm text-zinc-400 font-medium not-italic">/ μήνα</span>
                  </p>
                </div>
                
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                  <StripeCheckoutForm plan={selectedPlan} onSuccess={handlePaymentSuccess} />
                </Elements>

                <p className="text-[10px] text-center text-zinc-400 mt-6 font-medium">
                  Η συνδρομή ανανεώνεται αυτόματα κάθε μήνα. Μπορείτε να ακυρώσετε οποιαδήποτε στιγμή.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="text-center mb-20 pt-12 relative z-10">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00] text-[10px] font-black tracking-widest uppercase mb-8 shadow-2xl">
          <Zap size={14} className="animate-pulse" /> Studio Labs Upgrade
        </div>
        <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter uppercase italic leading-[0.9]">
          OWN THE <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] via-green-400 to-blue-500">AIRWAVES.</span>
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl max-w-3xl mx-auto font-medium leading-relaxed">
          Από ένα απλό stream σε μια αυτοκρατορία ήχου. Επιλέξτε τα εργαλεία που θα απογειώσουν την ακροαματικότητα και τα έσοδά σας.
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 items-stretch relative z-10">
        {plans.map((plan) => {
          const status = getPlanStatus(plan.id);
          const isOwned = status === 'owned';

          return (
            <div 
              key={plan.id}
              className={`relative flex flex-col p-8 rounded-[44px] transition-all duration-700 group hover:-translate-y-3 ${
                plan.isHero 
                  ? `bg-gradient-to-b ${plan.bgGradient} border-2 ${plan.borderColor} transform lg:-translate-y-6 shadow-[0_30px_60px_rgba(204,255,0,0.1)] z-10 order-first lg:order-none` 
                  : `bg-[#0a0a0a] border border-white/5 hover:border-white/20`
              }`}
            >
              {plan.isHero && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black border border-[#ccff00] text-[#ccff00] text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-widest shadow-2xl flex items-center gap-2 whitespace-nowrap">
                  <Sparkles size={12} /> THE OMNIPOTENT CHOICE
                </div>
              )}

              <div className="mb-8">
                <div className="flex items-center justify-between mb-8">
                  <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110 duration-500 ${plan.isHero ? 'bg-black text-[#ccff00]' : 'bg-white/5 text-white'}`}>
                    {plan.icon}
                  </div>
                  <div className="text-right">
                    <span className={`text-3xl font-black ${plan.isHero ? 'text-black' : 'text-white'}`}>{plan.price}€</span>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${plan.isHero ? 'text-black/60' : 'text-zinc-600'}`}>/ MONTH</p>
                  </div>
                </div>
                <h3 className={`text-2xl font-black mb-3 uppercase italic tracking-tight ${plan.isHero ? 'text-black' : 'text-white'}`}>{plan.name}</h3>
                <p className={`text-sm font-medium leading-relaxed ${plan.isHero ? 'text-black/70' : 'text-zinc-500'}`}>{plan.description}</p>
              </div>

              <div className="flex-1 space-y-4 mb-12">
                {plan.features.map((f, i) => (
                  <div key={i} className={`flex items-start gap-3 text-xs font-bold ${plan.isHero ? 'text-black' : 'text-zinc-300'}`}>
                    <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${plan.isHero ? 'text-black' : `text-${plan.colorClass}-500`}`} />
                    <span className="leading-tight">{f}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => handleSubscribe(plan)}
                disabled={loading || isOwned}
                className={`w-full py-5 rounded-[24px] font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${
                  isOwned 
                    ? plan.isHero ? 'bg-black/10 text-black cursor-not-allowed' : 'bg-white/5 text-zinc-700 cursor-not-allowed'
                    : plan.isHero 
                      ? 'bg-black text-[#ccff00] hover:scale-[1.02] shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-95' 
                      : 'bg-white text-black hover:bg-[#ccff00] hover:scale-[1.02] active:scale-95'
                }`}
              >
                {loading && selectedPlan?.id === plan.id ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : isOwned ? (
                  <><ShieldCheck size={16} /> ACTIVE MODULE</>
                ) : (
                  <><CreditCard size={16} /> {plan.isHero ? 'ΑΝΑΒΑΘΜΙΣΗ ΣΕ PRO PACK' : 'ACTIVATE MODULE'}</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-24 bg-[#0a0a0a] border border-white/5 rounded-[50px] p-10 flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden relative z-10 group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 blur-[120px] -mr-40 -mt-40 opacity-50 transition-opacity group-hover:opacity-100"></div>
        <div className="flex items-center gap-8 relative z-10">
          <div className="w-20 h-20 bg-white/5 rounded-[28px] flex items-center justify-center text-white shrink-0 shadow-inner border border-white/5">
             <Globe size={38} className="text-blue-400" />
          </div>
          <div>
            <h4 className="text-white font-black italic text-2xl uppercase tracking-tight">Need a Global Custom Solution?</h4>
            <p className="text-zinc-500 text-base max-w-xl mt-2 leading-relaxed font-medium">
              Για μεγάλα δίκτυα με 10+ σταθμούς, White-label εφαρμογές και custom API integrations. Ας χτίσουμε το δικό σας οικοσύστημα.
            </p>
          </div>
        </div>
        <button onClick={() => window.open('https://iluma.gr/contact', '_blank')} className="px-10 py-5 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#ccff00] transition-all relative z-10 whitespace-nowrap active:scale-95 shadow-xl flex items-center gap-2">
          LET'S TALK <MoveRight size={16} />
        </button>
      </div>
    </div>
  );
}
