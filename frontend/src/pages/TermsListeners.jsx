import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  Shield, Headphones, Zap, CreditCard, MessageSquare, 
  Car, SlidersHorizontal, Radar, Heart, Activity, AlertTriangle, Lock, CheckSquare, Loader2
} from 'lucide-react';

export default function TermsListeners({ API_URL, currentUser }) {
  const navigate = useNavigate();
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasAlreadyAccepted = currentUser?.hasAcceptedTerms;

  const handleAcceptTerms = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/users/me/accept-terms`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('iluma_token')}`
        }
      });
      if (res.ok) {
        window.location.href = '/'; // Reloads and redirects to settings
      } else {
        alert("Σφάλμα κατά την αποθήκευση της συγκατάθεσης.");
      }
    } catch (error) {
      alert("Σφάλμα δικτύου.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-300 p-6 md:p-12 font-sans selection:bg-[#ccff00] selection:text-black">
      <Helmet><title>Όροι Χρήσης Ακροατών | iRadios</title></Helmet>

      <div className="max-w-4xl mx-auto space-y-12 pb-40">
        
        {/* HEADER SECTION */}
        <div className="text-center space-y-4 animate-fade-in">
          <Shield className="w-16 h-16 text-[#ccff00] mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Όροι Χρήσης Υπηρεσιών</h1>
          <p className="text-zinc-500 text-sm tracking-widest uppercase">Τελευταια ενημερωση: {new Date().toLocaleDateString('el-GR')}</p>
        </div>

        <div className="space-y-6 text-sm md:text-base leading-relaxed">
          
          {/* 1. ΕΙΣΑΓΩΓΗ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-2 h-2 bg-[#ccff00] rounded-full shadow-[0_0_10px_#ccff00]"></span>
              1. Εισαγωγή & Φορέας Λειτουργίας
            </h2>
            <p className="text-zinc-400">
              Η πλατφόρμα iRadios αποτελεί ψηφιακή υπηρεσία της <strong>ILUMA Digital Agency</strong>, η οποία εδρεύει στη διεύθυνση Μοσχονησίων 1, Αιγάλεω. Με την πρόσβαση, εγγραφή, περιήγηση ή οιαδήποτε χρήση της πλατφόρμας (ανεξαρτήτως τερματικής συσκευής ή περιβάλλοντος web/mobile), δηλώνετε ότι έχετε αναγνώσει, κατανοήσει και αποδεχθεί πλήρως και ανεπιφύλακτα τους παρόντες όρους. Η πλατφόρμα λειτουργεί αποκλειστικά ως διαδικτυακός κατάλογος, aggregator και μέσο αναπαραγωγής (player) ραδιοφωνικών σταθμών ιδιοκτησίας τρίτων.
            </p>
          </section>

          {/* 2. ΕΓΓΡΑΦΗ & ΑΣΦΑΛΕΙΑ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#ccff00]" />
              2. Εγγραφή, Σύνδεση & Ασφάλεια Δεδομένων
            </h2>
            <div className="space-y-4 text-zinc-400">
              <p>Για την πλήρη αξιοποίηση των υπηρεσιών του iRadios, απαιτείται η εγγραφή και η δημιουργία προσωπικού λογαριασμού. Ο χρήστης δεσμεύεται να παρέχει αληθή και ακριβή στοιχεία και φέρει την αποκλειστική νομική ευθύνη για τη διαφύλαξη της μυστικότητας των διαπιστευτηρίων πρόσβασης (username/password).</p>
              <p><strong>Τεχνικά Μέτρα Ασφαλείας:</strong> Αναγνωρίζοντας την κρισιμότητα της προστασίας των δεδομένων σας, το iRadios εφαρμόζει αυστηρά πρωτόκολλα κυβερνοασφάλειας:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong>Double Token Authentication:</strong> Η διαδικασία ταυτοποίησης θωρακίζεται μέσω προηγμένης αρχιτεκτονικής διπλού κρυπτογραφικού token.</li>
                <li><strong>Cloudflare Turnstile:</strong> Όλες οι φόρμες εγγραφής, σύνδεσης και επαλήθευσης προστατεύονται από την τεχνολογία Cloudflare Turnstile.</li>
              </ul>
            </div>
          </section>

          {/* 3. ΠΝΕΥΜΑΤΙΚΑ ΔΙΚΑΙΩΜΑΤΑ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Headphones className="w-5 h-5 text-[#ccff00]" />
              3. Πνευματικά Δικαιώματα & Αποποίηση Ευθύνης Περιεχομένου
            </h2>
            <p className="text-zinc-400">
              Το iRadios δεν φιλοξενεί (host), δεν εκπέμπει και δεν αναμεταδίδει πρωτογενώς ηχητικό περιεχόμενο. Οι ραδιοφωνικές ροές (audio streams) παρέχονται απευθείας από τους αντίστοιχους ραδιοφωνικούς σταθμούς μέσω δημόσια διαθέσιμων URL. Η ILUMA Digital Agency δεν φέρει ουδεμία νομική ή οικονομική ευθύνη για τα μεταδιδόμενα έργα.
            </p>
          </section>

          {/* 4. FREE VS PREMIUM */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Zap className="w-5 h-5 text-[#ccff00]" />
              4. Επίπεδα Πρόσβασης: Free & Premium Συνδρομές
            </h2>
            <div className="space-y-4 text-zinc-400">
              <p>Η πλατφόρμα διαθέτει δύο βαθμίδες χρήσης, οι οποίες διέπονται από τους κάτωθι όρους:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong>Free Χρήστες (Βασική Πρόσβαση):</strong> Παρέχεται δωρεάν πρόσβαση στο ευρετήριο των σταθμών, υποστηριζόμενη από διαφημιστικά μηνύματα.</li>
                <li><strong>Premium Χρήστες (Ενισχυμένη Πρόσβαση):</strong> Απολαμβάνουν μια απρόσκοπτη εμπειρία χρήσης, απαλλαγμένη από παρεμβάσεις διαφημίσεων του iRadios, και πρόσβαση σε αποκλειστικές premium λειτουργίες.</li>
              </ul>
            </div>
          </section>

          {/* 5. ΠΛΗΡΩΜΕΣ ΚΑΙ STRIPE */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-[#ccff00]" />
              5. Όροι Συναλλαγών (Stripe) & Πολιτική Ακυρώσεων
            </h2>
            <div className="space-y-4 text-zinc-400">
              <p>Για τις επί πληρωμή υπηρεσίες ισχύουν ρητά τα εξής:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong>Ασφάλεια Συναλλαγών:</strong> Η εκκαθάριση των συναλλαγών διεκπεραιώνεται αποκλειστικά μέσω του Stripe.</li>
                <li><strong>Αυτόματη Ανανέωση:</strong> Οι συνδρομές ανανεώνονται αυτοδίκαια στη λήξη του εκάστοτε τιμολογιακού κύκλου.</li>
                <li><strong>Πολιτική Ακύρωσης & Επιστροφών:</strong> Δεν παρέχονται αναλογικές επιστροφές χρημάτων (pro-rata refunds) για περιόδους μη χρήσης. Η πρόσβασή σας στα premium προνόμια θα διατηρηθεί έως τη λήξη.</li>
              </ul>
            </div>
          </section>

          {/* 6. ΕΙΔΙΚΑ FEATURES */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <SlidersHorizontal className="w-5 h-5 text-[#ccff00]" />
              6. Ειδικές Λειτουργίες Πλατφόρμας & Περιορισμός Ευθύνης
            </h2>
            <div className="space-y-6 text-zinc-400">
              <div>
                <h3 className="text-white font-bold flex items-center gap-2 mb-1"><Car size={16} className="text-orange-500"/> Car Mode (Οδική Ασφάλεια)</h3>
                <p>Ο χρήστης φέρει την πλήρη ευθύνη για την ασφαλή οδήγηση. Το iRadios αποποιείται ρητά κάθε ευθύνη για ατυχήματα.</p>
              </div>
              <div>
                <h3 className="text-white font-bold flex items-center gap-2 mb-1"><SlidersHorizontal size={16} className="text-blue-400"/> Custom DSP (Επεξεργασία Ήχου)</h3>
                <p>Το iRadios δεν φέρει νομική ευθύνη για ενδεχόμενη βλάβη σε hardware του χρήστη από ακραίες ρυθμίσεις.</p>
              </div>
              <div>
                <h3 className="text-white font-bold flex items-center gap-2 mb-1"><Radar size={16} className="text-purple-400"/> AI Music Radar</h3>
                <p>Το iRadios δεν δύναται να εγγυηθεί το αλάνθαστο (100% ακρίβεια) των επιστρεφόμενων μεταδεδομένων.</p>
              </div>
            </div>
          </section>

          {/* 7. CHAT & ΚΑΝΟΝΕΣ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-[#ccff00]" />
              7. Κώδικας Δεοντολογίας Κοινότητας & Live Chat
            </h2>
            <div className="space-y-4 text-zinc-400">
              <p>Η χρήση του Live Chat συνιστά προνόμιο και όχι δικαίωμα. Απαγορεύονται απολύτως η ρητορική μίσους, το εξυβριστικό λεξιλόγιο και το Spam.</p>
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 mt-4">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-red-200">
                  Οι διαχειριστές διατηρούν το δικαίωμα οριστικού αποκλεισμού (Permanent Ban) οποιουδήποτε λογαριασμού παραβιάζει τους όρους.
                </p>
              </div>
            </div>
          </section>

          {/* 8. ANALYTICS */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#ccff00]" />
              8. Προστασία Προσωπικών Δεδομένων
            </h2>
            <p className="text-zinc-400">
              Σε καμία περίπτωση δεν παραχωρούνται ή πωλούνται προσωπικά αναγνωρίσιμα στοιχεία σε τρίτους, σε πλήρη εναρμόνιση με τον Γενικό Κανονισμό Προστασίας Δεδομένων (GDPR).
            </p>
          </section>

        </div>

        {/* 🟢 ACTION BAR (Sticky Bottom) */}
        {currentUser && currentUser.role !== 'admin' && (
          <div className="fixed bottom-20 md:bottom-24 left-0 w-full bg-zinc-950/90 backdrop-blur-xl border-t-2 border-[#ccff00]/30 p-6 z-[9999] shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              
              {hasAlreadyAccepted ? (
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-3 text-green-500">
                    <CheckSquare size={24} />
                    <span className="font-bold text-sm uppercase tracking-widest">Έχετε αποδεχτεί τους όρους</span>
                  </div>
                  <button 
                    onClick={() => navigate('/settings')}
                    className="px-8 py-4 bg-[#ccff00] text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all"
                  >
                    Συνεχεια στο Προφιλ
                  </button>
                </div>
              ) : (
                <>
                  <div 
                    className="flex items-center gap-4 cursor-pointer group flex-1"
                    onClick={() => setIsChecked(!isChecked)}
                  >
                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors shrink-0 ${isChecked ? 'bg-[#ccff00] border-[#ccff00]' : 'bg-black border-zinc-600 group-hover:border-[#ccff00]'}`}>
                      {isChecked && <CheckSquare size={16} className="text-black" />}
                    </div>
                    <span className="text-xs md:text-sm text-zinc-400 font-medium select-none">
                      Διάβασα, κατανοώ πλήρως και <strong className="text-white">αποδέχομαι ανεπιφύλακτα</strong> τους παρόντες όρους χρήσης.
                    </span>
                  </div>

                  <button 
                    onClick={handleAcceptTerms}
                    disabled={!isChecked || isSubmitting}
                    className="w-full md:w-auto px-8 py-4 bg-[#ccff00] text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    Αποδοχη & Συνεχεια
                  </button>
                </>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
