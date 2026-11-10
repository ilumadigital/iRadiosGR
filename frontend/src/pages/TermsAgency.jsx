import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  Scale, Megaphone, Banknote, ShieldCheck, AlertTriangle, 
  Target, BarChart3, Clock, FileCheck2, Lock, MapPin, CheckSquare, Loader2 
} from 'lucide-react';

export default function TermsAgency({ API_URL, currentUser }) {
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
        window.location.href = '/agency/dashboard'; // Reloads and redirects
      } else {
        alert("Σφάλμα κατά την αποθήκευση της συγκατάθεσης.");
      }
    } catch (error) {
      alert("Σφάλμα δικτύου.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-300 p-6 md:p-12 font-sans selection:bg-purple-500 selection:text-white">
      <Helmet><title>Agency Advertising Agreement | iRadios</title></Helmet>

      <div className="max-w-4xl mx-auto space-y-12 pb-40">
        
        {/* HEADER SECTION */}
        <div className="text-center space-y-4 animate-fade-in">
          <Scale className="w-16 h-16 text-purple-500 mx-auto mb-6" />
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">Σύμβαση Διαφημιστικής Προβολής (B2B)</h1>
          <p className="text-zinc-500 text-sm tracking-widest uppercase">Αυστηρα για επαγγελματικη χρηση - Agency & Advertiser Agreement</p>
        </div>

        <div className="space-y-8 text-sm md:text-base leading-relaxed">
          
          <div className="bg-purple-900/10 border border-purple-500/30 p-6 rounded-2xl text-purple-200">
            <strong>ΠΡΟΣΟΧΗ (ΝΟΜΙΚΗ ΔΕΣΜΕΥΣΗ):</strong> Η εγγραφή, αγορά και προβολή διαφημιστικού υλικού (Καμπάνιες) μέσω του Agency Dashboard συνιστά νομικά δεσμευτική σύμβαση (Advertising Service Agreement) μεταξύ του Διαφημιζόμενου/Διαφημιστικού Γραφείου (εφεξής "Agency") και της <strong>ILUMA Digital Agency</strong> (Μοσχονησίων 1, Αιγάλεω), ιδιοκτήτριας και διαχειρίστριας της πλατφόρμας iRadios.
          </div>

          {/* 1. ΕΓΓΡΑΦΗ & ΑΣΦΑΛΕΙΑ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Lock className="w-5 h-5 text-purple-500" />
              1. Πιστοποίηση Λογαριασμού & Εταιρικά Στοιχεία
            </h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Η πρόσβαση στο Ad Network του iRadios επιτρέπεται αυστηρά σε νομικά πρόσωπα, ατομικές επιχειρήσεις και διαφημιστικές εταιρείες. Το Agency δεσμεύεται για την ακρίβεια των φορολογικών στοιχείων (ΑΦΜ, Επωνυμία) που δηλώνονται κατά την εγγραφή. Η ILUMA Digital Agency διατηρεί το δικαίωμα διασταύρωσης των στοιχείων μέσω του Ευρωπαϊκού Συστήματος VIES.</p>
              <p>Η ασφάλεια των διαπιστευτηρίων εισόδου αποτελεί αποκλειστική ευθύνη του Agency. Οποιαδήποτε αγορά καμπάνιας πραγματοποιηθεί από τον λογαριασμό θεωρείται έγκυρη και δεσμευτική για τον κάτοχο του λογαριασμού.</p>
            </div>
          </section>

          {/* 2. ΟΙΚΟΝΟΜΙΚΟΙ ΟΡΟΙ & ONE-OFF PAYMENTS */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Banknote className="w-5 h-5 text-purple-500" />
              2. Οικονομικοί Όροι, Τιμολόγηση & Συνδρομές ανά Καμπάνια
            </h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Η αγορά διαφημιστικού χώρου/χρόνου στο iRadios λειτουργεί <strong>αποκλειστικά με το μοντέλο της προπληρωμής (Pre-paid)</strong>. Η τιμολόγηση διέπεται από τους εξής κανόνες:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Εφάπαξ Χρέωση (Non-Recurring):</strong> Κάθε καμπάνια έχει ξεχωριστή μηνιαία συνδρομή. Η αυτόματη ανανέωση δεν είναι ακόμη ενεργή και δεν πραγματοποιείται χρέωση χωρίς σαφή ενημέρωση κατά την αγορά.</li>
                <li><strong>Εκκαθάριση & Τιμολόγηση:</strong> Οι νέες συναλλαγές, μόλις ενεργοποιηθεί η υπηρεσία, θα διεκπεραιώνονται μέσω ILUMA Gateway / Nexi. Τα παραστατικά εκδίδονται σύμφωνα με τις ισχύουσες υποχρεώσεις.</li>
                <li><strong>Πολιτική Μη Επιστροφής:</strong> Λόγω της B2B φύσης της υπηρεσίας, <strong>δεν παρέχεται δικαίωμα υπαναχώρησης, μερικής ή ολικής επιστροφής χρημάτων (Refunds)</strong> μετά την έγκριση της καμπάνιας.</li>
              </ul>
            </div>
          </section>

          {/* 3. ΔΙΑΔΙΚΑΣΙΑ ΕΓΚΡΙΣΗΣ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <FileCheck2 className="w-5 h-5 text-purple-500" />
              3. Έλεγχος Υλικού (Review) & Έναρξη Καμπάνιας
            </h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Κάθε νέα καμπάνια υπόκειται σε διαδικασία ελέγχου (Moderation/Review).</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Έναρξη Χρόνου:</strong> Ο χρόνος διάρκειας του πακέτου <strong>ξεκινά να μετράει αυστηρά από τη στιγμή της τελικής Έγκρισης</strong> από τον διαχειριστή.</li>
                <li><strong>Απόρριψη:</strong> Εάν το υλικό κριθεί ακατάλληλο, το Agency θα ειδοποιηθεί για την αντικατάστασή του. Εάν η αντικατάσταση δεν είναι εφικτή, το ποσό επιστρέφεται στο ακέραιο.</li>
              </ul>
            </div>
          </section>

          {/* 4. ΠΟΙΟΤΗΤΑ & ΝΟΜΙΜΟΤΗΤΑ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
              4. Νομιμότητα & Περιορισμοί Περιεχομένου
            </h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Το Agency φέρει την αποκλειστική νομική ευθύνη για το περιεχόμενο των διαφημίσεων. Απαγορεύεται αυστηρά η ανάρτηση καμπανιών που προωθούν παραπλανητικές πρακτικές, τυχερά παίγνια χωρίς άδεια, περιεχόμενο ενηλίκων ή παραβιάζουν δικαιώματα τρίτων.</p>
              <p><strong>Ρήτρα Αποζημίωσης:</strong> Το Agency αναλαμβάνει να αποζημιώσει πλήρως την ILUMA Digital Agency για οποιαδήποτε νομική διένεξη προκύψει εξαιτίας του διαφημιστικού του υλικού.</p>
            </div>
          </section>

          {/* 5. ΑΠΟΔΟΣΗ & ΜΕΤΡΗΣΕΙΣ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              5. Analytics, Εγγυήσεις & Διαθεσιμότητα
            </h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <ul className="list-disc list-inside space-y-3 ml-4">
                <li className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <span><strong>Γεωγραφική Στόχευση (Geo-Targeting):</strong> Η πλατφόρμα παρέχει τη δυνατότητα τοπικής στόχευσης διαφημίσεων. Η ILUMA Digital Agency δεν φέρει καμία ευθύνη για τη μη εμφάνιση αποτελεσμάτων σε συσκευές που χρησιμοποιούν VPN ή Proxy servers.</span>
                </li>
                <li><strong>Καμία Εγγύηση Απόδοσης:</strong> Το iRadios εγγυάται την ορθή τεχνική τοποθέτηση των διαφημίσεων, αλλά όχι τον αριθμό των κλικ (clicks) ή το conversion rate.</li>
              </ul>
            </div>
          </section>

          {/* 6. ΑΚΥΡΩΣΗ & ΑΝΑΣΤΟΛΗ */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-purple-500" />
              6. Πολιτική Ακύρωσης & Διαγραφή Λογαριασμού
            </h2>
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-4 text-zinc-400 hover:border-white/10 transition-colors">
              <p>Η ILUMA Digital Agency διατηρεί το δικαίωμα μονομερούς αναστολής (suspension) της καμπάνιας, αζημίως και χωρίς προηγούμενη ειδοποίηση, σε περίπτωση αναδρομικής τροποποίησης υλικού σε παράνομο περιεχόμενο, αδικαιολόγητης αμφισβήτησης της χρέωσης (Chargeback) ή παραβίασης των παρόντων όρων.</p>
            </div>
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
                    onClick={() => navigate('/agency/dashboard')}
                    className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all"
                  >
                    Συνεχεια στο Agency Panel
                  </button>
                </div>
              ) : (
                <>
                  <div 
                    className="flex items-center gap-4 cursor-pointer group flex-1"
                    onClick={() => setIsChecked(!isChecked)}
                  >
                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors shrink-0 ${isChecked ? 'bg-purple-500 border-purple-500' : 'bg-black border-zinc-600 group-hover:border-purple-500'}`}>
                      {isChecked && <CheckSquare size={16} className="text-white" />}
                    </div>
                    <span className="text-xs md:text-sm text-zinc-400 font-medium select-none">
                      Διάβασα, κατανοώ πλήρως και <strong className="text-white">αποδέχομαι ανεπιφύλακτα</strong> τους παρόντες όρους B2B συνεργασίας.
                    </span>
                  </div>

                  <button 
                    onClick={handleAcceptTerms}
                    disabled={!isChecked || isSubmitting}
                    className="w-full md:w-auto px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all disabled:opacity-30 flex items-center justify-center gap-2"
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
