import React, { useState } from 'react';
import { 
  Crown, Check, Zap, Shield, CreditCard, Loader2, X, 
  Headphones, Star, SlidersHorizontal, Speaker, Sparkles, AlertCircle,
  Car, Music2, Volume2, ShieldCheck, Laptop, Smartphone, Target, Infinity, ScanSearch, MonitorSpeaker
} from 'lucide-react';

export default function GoPremium() {
  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-12 relative pb-40">
      
      {/* --- BACKGROUND GLOW --- */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[#ccff00]/5 blur-[120px] rounded-full pointer-events-none"></div>

      {/* --- HERO SECTION --- */}
      <div className="text-center mb-24 relative z-10">
        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/20 text-[#ccff00] text-[10px] font-black tracking-[0.3em] uppercase mb-10">
          <Zap size={14} className="fill-current" /> Beyond Stereo Experience
        </div>
        <h1 className="text-6xl md:text-[100px] font-black text-white mb-8 tracking-tighter leading-[0.85] uppercase italic">
          UNLEASH <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] via-white to-[#ccff00] bg-[length:200%_auto] animate-gradient">PURE SOUND.</span>
        </h1>
        <p className="text-zinc-400 text-lg md:text-2xl max-w-3xl mx-auto font-medium leading-relaxed">
          Σταμάτα απλά να ακούς. Ξεκίνα να νιώθεις. Μηδέν διαφημίσεις, <br className="hidden md:block"/> ζωντανή αναγνώριση τραγουδιών και απόλυτος έλεγχος στον ήχο σου.
        </p>
      </div>

      {/* --- FEATURES BENTO GRID --- */}
      <div className="grid lg:grid-cols-12 gap-6 items-start relative z-10">
        
        {/* BIG CARD: AI RECOGNITION (SHAZAM FEATURE) */}
        <div className="lg:col-span-8 bg-[#0a0a0a] border border-blue-500/20 rounded-[48px] p-10 relative overflow-hidden group shadow-[0_0_50px_rgba(59,130,246,0.1)]">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full -mr-48 -mt-48 transition-opacity group-hover:opacity-100 opacity-50 animate-pulse"></div>
            <div className="relative z-10">
                <div className="w-16 h-16 bg-blue-500/20 rounded-3xl flex items-center justify-center mb-8 border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                    <ScanSearch size={32} className="text-blue-400" />
                </div>
                <h3 className="text-4xl font-black text-white mb-4 italic tracking-tighter uppercase">AI Music Radar</h3>
                <p className="text-zinc-400 text-xl max-w-xl leading-relaxed">
                    Τέρμα το "Άγνωστο Κομμάτι" και το "Live Studio". Πάτα το κουμπί αναγνώρισης και το AI μας θα "σκανάρει" τον ήχο του σταθμού για να βρει <strong className="text-white">ακαριαία</strong> τον τίτλο και τον καλλιτέχνη. 
                </p>
                <div className="flex gap-4 mt-8">
                    <span className="px-4 py-2 bg-blue-500/10 rounded-xl text-[10px] font-black text-blue-400 uppercase tracking-widest border border-blue-500/20">Never Lose A Track</span>
                </div>
            </div>
        </div>

        {/* PRICE CARD (ΚΑΡΦΩΜΕΝΗ ΔΕΞΙΑ) */}
        <div className="lg:col-span-4 lg:row-span-4 bg-[#ccff00] rounded-[48px] p-10 flex flex-col justify-between h-full shadow-[0_0_80px_rgba(204,255,0,0.15)] relative overflow-hidden">
            <div className="absolute top-0 right-0 opacity-10 translate-x-1/4 -translate-y-1/4">
                <Crown size={300} strokeWidth={1} className="text-black" />
            </div>
            <div>
                <span className="text-[10px] font-black text-black bg-black/10 px-4 py-2 rounded-full uppercase tracking-widest mb-10 inline-block">Full Access Pass</span>
                <h3 className="text-5xl font-black text-black tracking-tighter italic mb-4">ELITE</h3>
                <div className="flex items-baseline gap-1 mb-10">
                    <span className="text-8xl font-black text-black tracking-tighter">3.99€</span>
                    <span className="text-black/60 font-black text-xl uppercase tracking-tighter">/mo</span>
                </div>
                <ul className="space-y-4 mb-12">
                    {[
                      'Live AI Song Recognition', 
                      'iRadios Connect (Cross-Device)',
                      'Zero In-App Ads', 
                      'Custom DSP Master Engine', 
                      'Unlimited High-Res Audio'
                    ].map((t, i) => (
                        <li key={i} className="flex items-center gap-3 text-black font-black text-sm uppercase tracking-tight">
                            <ShieldCheck size={20} className="fill-black/10 shrink-0" /> {t}
                        </li>
                    ))}
                </ul>
            </div>
            <button 
                type="button"
                disabled title="Η αγορά θα ενεργοποιηθεί μέσω Nexi μετά την ολοκλήρωση των ελέγχων"
                className="w-full bg-black text-[#ccff00] font-black py-6 rounded-3xl uppercase tracking-[0.2em] italic text-sm hover:scale-[1.03] transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3"
            >
                <><CreditCard /> ΑΓΟΡΕΣ ΣΥΝΤΟΜΑ ΜΕ NEXI</>
            </button>
        </div>

        {/* 🟢 NEW CARD: iRADIOS CONNECT (DEVICE SYNC) */}
        <div className="lg:col-span-8 bg-[#0a0a0a] border border-[#ccff00]/20 rounded-[48px] p-10 relative overflow-hidden group shadow-[0_0_50px_rgba(204,255,0,0.05)]">
            <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-[#ccff00]/10 blur-[100px] rounded-full -mr-32 -mb-32 transition-opacity group-hover:opacity-100 opacity-50"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                <div className="flex-1">
                    <div className="w-14 h-14 bg-[#ccff00]/10 rounded-2xl flex items-center justify-center mb-6 border border-[#ccff00]/20 group-hover:bg-[#ccff00] group-hover:text-black transition-all">
                        <MonitorSpeaker size={28} className="text-[#ccff00] group-hover:text-black" />
                    </div>
                    <h4 className="text-3xl font-black text-white mb-3 italic tracking-tight uppercase">iRadios Connect</h4>
                    <p className="text-zinc-400 text-lg leading-relaxed max-w-lg">
                        Ξεκίνα να ακούς στο PC σου και συνέχισε στο κινητό, <strong className="text-white">χωρίς να χάσεις δευτερόλεπτο</strong>. Μετάφερε την αναπαραγωγή ασύρματα σε οποιαδήποτε συνδεδεμένη συσκευή.
                    </p>
                </div>
                <div className="shrink-0 hidden md:flex items-center gap-4 text-zinc-600 bg-zinc-900/50 p-4 rounded-3xl border border-white/5">
                   <Laptop size={32} className="text-[#ccff00]" />
                   <div className="flex gap-1 animate-pulse">
                     <span className="w-2 h-2 rounded-full bg-[#ccff00]"></span>
                     <span className="w-2 h-2 rounded-full bg-[#ccff00]"></span>
                     <span className="w-2 h-2 rounded-full bg-[#ccff00]"></span>
                   </div>
                   <Smartphone size={32} className="text-zinc-500" />
                </div>
            </div>
        </div>

        {/* AD BLOCKER CARD */}
        <div className="lg:col-span-4 bg-[#0a0a0a] border border-white/5 rounded-[48px] p-8 group hover:border-red-500/30 transition-all">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/10 group-hover:bg-red-500 group-hover:text-black transition-all">
                <Infinity size={28} className="text-red-500 group-hover:text-black" />
            </div>
            <h4 className="text-2xl font-black text-white mb-3 italic tracking-tight uppercase">Zero Disruptions</h4>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                Η μουσική σου δεν είναι χώρος διαφημίσεων. Σκοτώνουμε κάθε ηχητικό σποτ του app. Μόνο εσύ και η μουσική.
            </p>
        </div>

        {/* DSP CARD */}
        <div className="lg:col-span-4 bg-[#0a0a0a] border border-white/5 rounded-[48px] p-8 group hover:border-[#ccff00]/30 transition-all">
            <div className="w-14 h-14 bg-[#ccff00]/10 rounded-2xl flex items-center justify-center mb-6 border border-[#ccff00]/10 group-hover:bg-[#ccff00] group-hover:text-black transition-all">
                <SlidersHorizontal size={28} />
            </div>
            <h4 className="text-2xl font-black text-white mb-3 italic tracking-tight uppercase">Custom DSP Engine</h4>
            <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                Γίνε ο ηχολήπτης του εαυτού σου. Παράκαμψε το processing του σταθμού και δώσε το χρώμα που θέλεις με το Studio-Grade EQ.
            </p>
        </div>

        {/* CAR & THEATER MODE */}
        <div className="lg:col-span-8 grid md:grid-cols-2 gap-6">
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[48px] p-10 flex items-center gap-8 group">
                <div className="w-20 h-20 bg-amber-500/10 rounded-[30px] flex items-center justify-center shrink-0 border border-amber-500/10 group-hover:bg-amber-500 group-hover:text-black transition-all">
                    <Car size={40} />
                </div>
                <div>
                    <h4 className="text-2xl font-black text-white italic uppercase tracking-tight">Car Mode Pro</h4>
                    <p className="text-zinc-500 text-sm mt-1">Smart interface για οδήγηση με minimal UI για μέγιστη ασφάλεια.</p>
                </div>
            </div>

            <div className="bg-[#0a0a0a] border border-white/5 rounded-[48px] p-10 flex items-center gap-8 group">
                <div className="w-20 h-20 bg-purple-500/10 rounded-[30px] flex items-center justify-center shrink-0 border border-purple-500/10 group-hover:bg-purple-500 group-hover:text-black transition-all">
                    <Speaker size={40} />
                </div>
                <div>
                    <h4 className="text-2xl font-black text-white italic uppercase tracking-tight">Hi-Res Theater</h4>
                    <p className="text-zinc-500 text-sm mt-1">Μετατρέψτε το σαλόνι σας σε live arena. Βελτιστοποιημένος ήχος για hi-fi.</p>
                </div>
            </div>
        </div>

      </div>

      {/* --- FOOTER INFO --- */}
      <div className="mt-20 text-center relative z-10">
        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.4em] mb-4">Payments by ILUMA Gateway & Nexi</p>
        <div className="flex justify-center gap-8 opacity-20">
            <Shield size={24} className="text-white" />
            <CreditCard size={24} className="text-white" />
            <Zap size={24} className="text-white" />
        </div>
      </div>
    </div>
  );
}
