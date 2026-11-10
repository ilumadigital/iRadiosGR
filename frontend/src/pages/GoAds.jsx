import React, { useState } from 'react';
import { 
  Rocket, Check, Target, Globe, ShieldCheck, Loader2, X, AlertTriangle,
  Crown, BarChart3, LayoutGrid, LayoutPanelTop, Rows3, Mic2, Star, Clock, Lock
} from 'lucide-react';

export default function GoAds({ currentUser }) {
  const period = 'month';
  const canSeePrices = currentUser?.role === 'admin' || currentUser?.role === 'agency';
  const displayPrices = {
    radio_feed: { month: 29.00 },
    hero: { month: 289.00 },
    home: { month: 149.00 },
    audio: { month: 79.00 }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden pb-40">
      
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
            Προσέγγισε χιλιάδες ακροατές την ώρα που απολαμβάνουν τη μουσική τους. Σχεδίασε την επόμενη καμπάνια σου και δες το brand σου να απογειώνεται.
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

        <p className="mb-12 text-center text-sm text-amber-200/90">Κάθε καμπάνια έχει ξεχωριστή μηνιαία συνδρομή. Οι νέες αγορές μέσω Nexi δεν έχουν ενεργοποιηθεί ακόμη.</p>

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
            <p className="mt-auto text-xs font-semibold text-amber-300/80">Η αγορά θα είναι διαθέσιμη μέσω Nexi μετά την ολοκλήρωση των ελέγχων.</p>
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
            <p className="mt-auto text-xs font-semibold text-amber-300/80">Η αγορά θα είναι διαθέσιμη μέσω Nexi μετά την ολοκλήρωση των ελέγχων.</p>
          </div>

          {/* 3. HOME PAGE BANNER */}
          <div className="bg-gradient-to-b from-emerald-900/20 to-black border border-emerald-500/30 hover:border-emerald-500/60 rounded-[40px] p-8 flex flex-col relative shadow-[0_0_40px_rgba(16,185,129,0.05)] group transition-all">
            <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
                <Rows3 size={28} />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">News<br/>Grid</h3>
            <p className="text-zinc-400 text-xs font-medium mb-6 min-h-[60px]">Προβολή διαφημιστικού δημιουργικού στην ενότητα ειδήσεων του iRadios.</p>
            
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
            <p className="mt-auto text-xs font-semibold text-amber-300/80">Η αγορά θα είναι διαθέσιμη μέσω Nexi μετά την ολοκλήρωση των ελέγχων.</p>
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
            
            <p className="mt-auto text-xs font-semibold text-amber-300/80">Η αγορά θα είναι διαθέσιμη μέσω Nexi μετά την ολοκλήρωση των ελέγχων.</p>
          </div>

        </div>

      </div>
    </div>
  );
}
