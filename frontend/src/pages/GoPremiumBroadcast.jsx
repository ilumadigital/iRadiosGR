import React, { useState, useEffect } from 'react';
import { 
  Radio, SlidersHorizontal, Target, Crown, Check, 
  Shield, CreditCard, Loader2, X, Zap, Rocket, 
  Speaker, Lock, Infinity, Sparkles, AlertCircle, CheckCircle2,
  BarChart3, MoveRight, ShieldCheck, Globe, Code2 
} from 'lucide-react';

export default function GoPremiumBroadcast({ currentUser }) {
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

      name: "AUDIENCE RADAR",
      price: 7.90,
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

      name: "THE PRO PACK",
      price: 119.00,
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

      name: "MONEY MAKER",
      price: 29.90,
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

      name: "STUDIO EVOLUTION",
      price: 49.90,
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

  return (
    <div className="max-w-[1400px] mx-auto p-4 lg:p-12 relative pb-32">
      
      <div className="text-center mb-20 pt-12 relative z-10">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00] text-[10px] font-black tracking-widest uppercase mb-8 shadow-2xl">
          <Zap size={14} className="animate-pulse" /> Studio Labs Upgrade
        </div>
        <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter uppercase italic leading-[0.9]">
          OWN THE <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] via-green-400 to-blue-500">AIRWAVES.</span>
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl max-w-3xl mx-auto font-medium leading-relaxed">
          Από ένα απλό stream σε μια αυτοκρατορία ήχου. Τα πακέτα εμφανίζονται ενημερωτικά· οι αγορές μέσω Nexi θα ανοίξουν μετά τις δοκιμές.
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
                type="button" disabled title="Οι συνδρομές Broadcaster δεν είναι ακόμη διαθέσιμες για αγορά"
                className={`w-full py-5 rounded-[24px] font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${
                  isOwned 
                    ? plan.isHero ? 'bg-black/10 text-black cursor-not-allowed' : 'bg-white/5 text-zinc-700 cursor-not-allowed'
                    : plan.isHero 
                      ? 'bg-black text-[#ccff00] hover:scale-[1.02] shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-95' 
                      : 'bg-white text-black hover:bg-[#ccff00] hover:scale-[1.02] active:scale-95'
                }`}
              >
                {isOwned ? <><ShieldCheck size={16} /> ACTIVE MODULE</> : 'ΑΓΟΡΕΣ ΣΥΝΤΟΜΑ ΜΕ NEXI'}
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
