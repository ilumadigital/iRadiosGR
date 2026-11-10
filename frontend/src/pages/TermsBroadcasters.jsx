import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  Scale, Radio, Banknote, AlertTriangle, SlidersHorizontal, 
  BarChart3, Users, Crown, ShieldCheck, Lock, MapPin, CheckSquare, Loader2
} from 'lucide-react';

export default function TermsBroadcasters({ API_URL, currentUser }) {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const inviteToken = query.get('invite');
  const [isChecked, setIsChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasAlreadyAccepted = currentUser?.hasAcceptedCurrentBroadcasterTerms === true;
  const [submitError, setSubmitError] = useState('');

  const handleAcceptTerms = async () => {
    if (!isChecked || isSubmitting) return;

    const termsVersion = currentUser?.requiredBroadcasterTermsVersion;
    const token = localStorage.getItem('iluma_token');
    if (!token || !termsVersion) {
      setSubmitError('Η συνεδρία δεν είναι έτοιμη. Συνδεθείτε ξανά και ανανεώστε τη σελίδα.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_URL}/users/me/accept-terms`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ termsVersion })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.user?.hasAcceptedCurrentBroadcasterTerms === true) {
        // Reload the authenticated profile from /auth/me on the next page load.
        window.location.assign(inviteToken ? `/broadcaster-invite?token=${encodeURIComponent(inviteToken)}` : '/studio');
        return;
      }
      setSubmitError(data.error || 'Η αποθήκευση της συγκατάθεσης απέτυχε. Δοκιμάστε ξανά.');
    } catch (error) {
      setSubmitError('Δεν ήταν δυνατή η σύνδεση με τον server. Δοκιμάστε ξανά.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-300 p-6 md:p-12 font-sans selection:bg-blue-500 selection:text-white">
      <Helmet><title>Broadcaster Agreement | iRadios</title></Helmet>

      <div className="max-w-4xl mx-auto space-y-12 pb-40">
        
        {/* HEADER SECTION */}
        <div className="text-center space-y-4 animate-fade-in">
          <Scale className="w-16 h-16 text-blue-500 mx-auto mb-6" />
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">Σύμβαση Παροχής Υπηρεσιών (B2B)</h1>
          <p className="text-zinc-500 text-sm tracking-widest uppercase">Αυστηρα για επαγγελματικη χρηση - Broadcaster Agreement</p>
        </div>

        <div className="space-y-8 text-sm md:text-base leading-relaxed">
          
          <div className="bg-blue-900/10 border border-blue-500/30 p-6 rounded-2xl text-blue-200">
            <strong>ΠΡΟΣΟΧΗ (ΝΟΜΙΚΗ ΔΕΣΜΕΥΣΗ):</strong> Η εγγραφή, πρόσβαση και χρήση του Broadcaster Portal συνιστά νομικά δεσμευτική σύμβαση (Service Level Agreement - SLA) μεταξύ της επιχείρησής/οργανισμού σας (εφεξής "Broadcaster" ή "Πάροχος Περιεχομένου") και της <strong>ILUMA Digital Agency</strong> (Μοσχονησίων 1, Αιγάλεω), ιδιοκτήτριας και διαχειρίστριας της πλατφόρμας iRadios.
          </div>

          {/* 1. ΕΓΓΡΑΦΗ & ΚΥΒΕΡΝΟΑΣΦΑΛΕΙΑ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3"><Lock className="w-5 h-5 text-blue-500" />1. Εγγραφή, Διαπιστευτήρια & Κυβερνοασφάλεια</h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Η δημιουργία λογαριασμού απαιτεί την παροχή έγκυρων στοιχείων. Ο Broadcaster φέρει την <strong>απόλυτη και αδιαπραγμάτευτη ευθύνη</strong> για την ασφάλεια των διαπιστευτηρίων (username/password) του ιδίου και των εξουσιοδοτημένων Παραγωγών (Producers) του.</p>
              <p><strong>Τεχνική Θωράκιση (Enterprise-Grade Security):</strong> Η ILUMA Digital Agency εφαρμόζει πρωτόκολλα υψίστης ασφαλείας για την προστασία της υποδομής και των B2B λογαριασμών (Double Token Authentication, Cloudflare Turnstile).</p>
            </div>
          </section>

          {/* 2. ΝΟΜΙΚΗ ΕΥΘΥΝΗ & ΠΝΕΥΜΑΤΙΚΑ ΔΙΚΑΙΩΜΑΤΑ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3"><Radio className="w-5 h-5 text-blue-500" />2. Ρήτρα Αποποίησης Ευθύνης & Πνευματικά Δικαιώματα</h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Η πλατφόρμα λειτουργεί <strong>αποκλειστικά ως ενδιάμεσος τεχνολογικός πάροχος</strong>. Κατέχετε στο ακέραιο όλες τις νόμιμες άδειες, δικαιώματα και εξουσιοδοτήσεις από τους αρμόδιους Οργανισμούς Συλλογικής Διαχείρισης (ΟΣΔ) για τη δημόσια εκτέλεση του περιεχομένου σας.</p>
              <p><strong>Ρήτρα Αποζημίωσης:</strong> Σε περίπτωση νομικής όχλησης από τρίτα μέρη κατά της ILUMA Digital Agency εξαιτίας του δικού σας περιεχομένου, υποχρεούστε να μας αποζημιώσετε στο ακέραιο για κάθε ζημία.</p>
            </div>
          </section>

          {/* 3. FREE VS PREMIUM & ΠΛΗΡΩΜΕΣ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3"><Crown className="w-5 h-5 text-blue-500" />3. Εμπορική Πολιτική, Συνδρομές & Εκκαθάριση</h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Οι μελλοντικές αγορές Broadcaster θα διεκπεραιώνονται μέσω ILUMA Gateway / Nexi, αφού ολοκληρωθούν οι έλεγχοι. Δεν πραγματοποιούνται αυτόματες ανανεώσεις στην παρούσα φάση. Οι ειδικοί όροι τιμολόγησης και ακύρωσης θα γνωστοποιούνται πριν από κάθε ενεργοποίηση.</p>
              <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl mt-4">
                  <p className="text-blue-300 mb-2"><strong>Πολιτική Αναβάθμισης (Upgrade) & Συγχώνευσης Συνδρομών:</strong></p>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Σε περίπτωση που διατηρείτε ενεργές μία ή περισσότερες μεμονωμένες συνδρομές πρόσθετων υπηρεσιών (Add-ons) και επιλέξετε να αναβαθμίσετε στο πλήρες πακέτο ("THE PRO PACK"), <strong>η αλλαγή πακέτου θα απαιτεί ρητή επιβεβαίωση και επαλήθευση της επίδρασης στα ήδη ενεργά Add-ons</strong>. Η μετάβαση προϋποθέτει την πλήρη προπληρωμή της αξίας του πακέτου κατά τη στιγμή της αναβάθμισης. <strong>Δεν εφαρμόζεται αναλογικός συμψηφισμός (pro-rating) ή επιστροφή χρημάτων</strong> για τον υπολειπόμενο χρόνο των ακυρωθέντων Add-ons.
                  </p>
              </div>
            </div>
          </section>

          {/* 4. ΛΕΙΤΟΥΡΓΙΕΣ & ΠΕΡΙΟΡΙΣΜΟΙ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3"><SlidersHorizontal className="w-5 h-5 text-blue-500" />4. Τεχνική Διαχείριση, DSP & Εποπτεία Παραγωγών</h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-6 text-zinc-400 hover:border-white/10 transition-colors">
              <div>
                <h3 className="text-white font-bold flex items-center gap-2 mb-2"><SlidersHorizontal size={16} className="text-purple-400"/> DSP Engine (Ψηφιακή Επεξεργασία Ήχου)</h3>
                <p>Εάν η εφαρμογή ακραίων παραμέτρων προκαλέσει σημαντική ακουστική παραμόρφωση, η ILUMA διατηρεί το <strong>μονομερές δικαίωμα παράκαμψης (bypass)</strong> των ρυθμίσεών σας.</p>
              </div>
              <div>
                <h3 className="text-white font-bold flex items-center gap-2 mb-2"><Users size={16} className="text-green-400"/> Υπολογαριασμοί Παραγωγών (Producers)</h3>
                <p>Ως κεντρικός διαχειριστής, φέρετε εις ολόκληρον ευθύνη για κάθε ενέργεια που εκτελείται από τους προσκεκλημένους Παραγωγούς σας.</p>
              </div>
            </div>
          </section>

          {/* 5. ΔΙΑΦΗΜΙΣΕΙΣ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3"><Banknote className="w-5 h-5 text-blue-500" />5. Monetization, Πολιτική Διαφημίσεων & Geo-Targeting</h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Για λογαριασμούς "Free Tier", το iRadios διατηρεί το αποκλειστικό δικαίωμα προβολής/αναπαραγωγής ιδίων εμπορικών μηνυμάτων (Network Ads) κατά την ακρόαση του σταθμού σας.</p>
              <div className="flex items-start gap-2 mt-2">
                <MapPin className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Γεωγραφική Στόχευση (Geo-Targeting):</strong> Μέσω των Premium εργαλείων, παρέχεται η δυνατότητα τοπικής στόχευσης των δικών σας διαφημίσεων με βάση την τοποθεσία του ακροατή (Geo-Location IP). Η ILUMA <strong>δεν φέρει καμία ευθύνη</strong> για εσφαλμένη στόχευση λόγω χρήσης VPN ή Proxy.
                </span>
              </div>
            </div>
          </section>

          {/* 6. ΑΝΑΛΥΤΙΚΑ ΣΤΟΙΧΕΙΑ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3"><BarChart3 className="w-5 h-5 text-blue-500" />6. Εμπιστευτικότητα Δεδομένων & Analytics</h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Η παροχή στατιστικών δεδομένων προορίζεται αποκλειστικά για εσωτερική επιχειρηματική αξιολόγηση. Απαγορεύεται αυστηρά η πώληση ή μεταβίβαση αυτών των δεδομένων προς τρίτους (Data Brokers).</p>
            </div>
          </section>

          {/* 7. ΑΝΑΣΤΟΛΗ & ΔΙΑΓΡΑΦΗ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-blue-500" />7. Πολιτική Αναστολής & Λύσης Συνεργασίας</h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Η ILUMA Digital Agency διατηρεί το δικαίωμα άμεσης αναστολής ή οριστικής διαγραφής του σταθμού/λογαριασμού σας, αζημίως, σε περιπτώσεις μακροχρόνιας τεχνικής αδυναμίας (downtime), λήψης DMCA, ή καταχρηστικής συμπεριφοράς.</p>
            </div>
          </section>

          {/* 🟢 8. ΡΗΤΗ ΣΥΓΚΑΤΑΘΕΣΗ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              8. Ρητή Συγκατάθεση Προσθήκης Σταθμών & Περιεχομένου
            </h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Με την αποδοχή της παρούσας, παρέχετε τη <strong>ρητή, ειδική και ανεπιφύλακτη συγκατάθεσή σας</strong> προς την ILUMA Digital Agency προκειμένου να:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Εντάξει, κατηγοριοποιήσει και προβάλλει τους ραδιοφωνικούς σταθμούς που καταχωρείτε στον παγκόσμιο κατάλογο του iRadios.</li>
                <li>Αναπαράγει το ηχητικό σας stream (streaming URL) μέσω των Web, iOS, Android και Automotive εφαρμογών της.</li>
                <li>Χρησιμοποιήσει τα λογότυπα και τις ονομασίες των σταθμών σας αποκλειστικά για την αναγνώριση και προώθησή τους.</li>
              </ul>
              <p className="mt-4 text-xs italic text-zinc-500">Η συγκατάθεση αυτή παραμένει σε ισχύ καθ' όλη τη διάρκεια διατήρησης του λογαριασμού σας και ανακαλείται αυτοδικαίως με την οριστική διαγραφή του σταθμού σας.</p>
            </div>
          </section>

        </div>

        {/* 🟢 ACTION BAR (Sticky Bottom) - ΚΡΥΜΜΕΝΟ ΓΙΑ ADMIN */}
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
                    onClick={() => navigate('/studio')}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all"
                  >
                    Μεταβαση στο Studio
                  </button>
                </div>
              ) : (
                <>
                  <div 
                    className="flex items-center gap-4 cursor-pointer group flex-1"
                    onClick={() => setIsChecked(!isChecked)}
                  >
                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors shrink-0 ${isChecked ? 'bg-blue-500 border-blue-500' : 'bg-black border-zinc-600 group-hover:border-blue-500'}`}>
                      {isChecked && <CheckSquare size={16} className="text-white" />}
                    </div>
                    <span className="text-xs md:text-sm text-zinc-400 font-medium select-none">
                      Διάβασα, κατανοώ πλήρως και <strong className="text-white">αποδέχομαι ανεπιφύλακτα</strong> τους παρόντες όρους B2B συνεργασίας.
                    </span>
                  </div>

                  <button 
                    onClick={handleAcceptTerms}
                    disabled={!isChecked || isSubmitting}
                    className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-blue-600 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    Αποδοχη & Μεταβαση στο Studio
                  </button>
                  {submitError && <p role="alert" className="text-red-400 text-xs font-medium max-w-md">{submitError}</p>}
                </>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
