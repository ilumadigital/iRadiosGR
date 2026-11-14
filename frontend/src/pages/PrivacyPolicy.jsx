import React from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Shield, Eye, Database, Share2, Cookie, UserCheck, Mail, 
  Bot, UserX, CreditCard, Lock
} from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-zinc-300 p-6 md:p-12 font-sans selection:bg-[#ccff00] selection:text-black">
      <Helmet><title>Πολιτική Απορρήτου | iRadios</title></Helmet>

      <div className="max-w-4xl mx-auto space-y-12 pb-20">
        
        {/* HEADER SECTION */}
        <div className="text-center space-y-4 animate-fade-in">
          <Shield className="w-16 h-16 text-[#ccff00] mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">Πολιτική Απορρήτου</h1>
          <p className="text-zinc-500 text-sm tracking-widest uppercase">Τελευταια ενημερωση: {new Date().toLocaleDateString('el-GR')}</p>
        </div>

        <div className="space-y-6 text-sm md:text-base leading-relaxed">
          
          {/* 1. ΕΙΣΑΓΩΓΗ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-2 h-2 bg-[#ccff00] rounded-full shadow-[0_0_10px_#ccff00]"></span>
              1. Ποιοι Είμαστε
            </h2>
            <p className="text-zinc-400">
              Η πλατφόρμα <strong>iRadios</strong> ανήκει και λειτουργεί από την <strong>ILUMA Digital Agency</strong>, με έδρα τη διεύθυνση Μοσχονησίων 1, Αιγάλεω, Αττική. Η προστασία των προσωπικών σας δεδομένων και η ασφάλεια των συστημάτων μας αποτελεί απόλυτη προτεραιότητα. Η παρούσα Πολιτική Απορρήτου εξηγεί με διαφάνεια πώς συλλέγουμε, χρησιμοποιούμε, και προστατεύουμε τις πληροφορίες σας, σε πλήρη συμμόρφωση με τον GDPR και τις πολιτικές του Microsoft Store.
            </p>
          </section>

          {/* 2. ΔΕΔΟΜΕΝΑ ΠΟΥ ΣΥΛΛΕΓΟΥΜΕ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Database className="w-5 h-5 text-[#ccff00]" />
              2. Δεδομένα που Συλλέγουμε
            </h2>
            <div className="space-y-4 text-zinc-400">
              <p>Συλλέγουμε μόνο τα απολύτως απαραίτητα δεδομένα για τη λειτουργία της εφαρμογής:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong>Στοιχεία Λογαριασμού:</strong> Email, όνομα χρήστη και κωδικός πρόσβασης (ο οποίος αποθηκεύεται με ισχυρή μονόδρομη κρυπτογράφηση) κατά την εγγραφή σας.</li>
                <li><strong>Δεδομένα Χρήσης:</strong> Σταθμοί που προσθέτετε στα Αγαπημένα σας (Favorites), ιστορικό αναζητήσεων και ρυθμίσεις ήχου (DSP) για την εξατομίκευση της εμπειρίας σας.</li>
                <li><strong>Τεχνικά Δεδομένα:</strong> Διεύθυνση IP, τύπος συσκευής και λειτουργικό σύστημα, αποκλειστικά για σκοπούς εντοπισμού σφαλμάτων και προστασίας από κακόβουλες επιθέσεις.</li>
              </ul>
            </div>
          </section>

          {/* 3. ΑΣΦΑΛΕΙΑ & ΚΡΥΠΤΟΓΡΑΦΗΣΗ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#ccff00]" />
              3. Ασφάλεια & Προστασία Δεδομένων
            </h2>
            <p className="text-zinc-400">
              Η πρόσβαση, αποθήκευση και μετάδοση των δεδομένων σας πραγματοποιείται με χρήση σύγχρονων πρωτοκόλλων κρυπτογράφησης (HTTPS/TLS). Το iRadios εφαρμόζει αυστηρά τεχνικά μέτρα, συμπεριλαμβανομένης της αρχιτεκτονικής Double Token Authentication και τεχνολογιών Cloudflare, για την αποτροπή μη εξουσιοδοτημένης πρόσβασης, αλλοίωσης ή διαρροής των πληροφοριών σας.
            </p>
          </section>

          {/* 4. ΟΙΚΟΝΟΜΙΚΕΣ ΣΥΝΑΛΛΑΓΕΣ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-[#ccff00]" />
              4. Οικονομικές Συναλλαγές (Premium)
            </h2>
            <p className="text-zinc-400">
              Για τις αναβαθμίσεις σε Premium λογαριασμούς, η διεκπεραίωση των πληρωμών γίνεται αποκλειστικά μέσω του ILUMA Gateway και της Nexi, όταν ενεργοποιηθούν οι πληρωμές. Το iRadios <strong>δεν συλλέγει, δεν επεξεργάζεται και δεν αποθηκεύει</strong> στοιχεία πιστωτικών καρτών ή τραπεζικών λογαριασμών στους διακομιστές του. Όλες οι συναλλαγές συμμορφώνονται με τα αυστηρότερα διεθνή πρότυπα ασφαλείας (PCI DSS).
            </p>
          </section>

          {/* 5. AI FEATURES */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Bot className="w-5 h-5 text-[#ccff00]" />
              5. Τεχνητή Νοημοσύνη (Live Generative AI)
            </h2>
            <p className="text-zinc-400">
              Ορισμένες λειτουργίες του iRadios, όπως το AI Music Radar για την αναγνώριση μουσικής, χρησιμοποιούν μοντέλα μηχανικής μάθησης και παραγωγικής τεχνητής νοημοσύνης. Τα δεδομένα ήχου που αναλύονται, υφίστανται επεξεργασία τη δεδομένη χρονική στιγμή και δεν αποθηκεύονται ούτε συνδέονται με τον προσωπικό σας λογαριασμό. Οι χρήστες μπορούν να αναφέρουν τυχόν ανακριβή ή προβληματικά αποτελέσματα μέσω της φόρμας υποστήριξης.
            </p>
          </section>

          {/* 6. ΠΡΟΣΤΑΣΙΑ ΑΝΗΛΙΚΩΝ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <UserX className="w-5 h-5 text-[#ccff00]" />
              6. Προστασία Ανηλίκων (Child Safety)
            </h2>
            <p className="text-zinc-400">
              Η εφαρμογή δεν απευθύνεται σε παιδιά κάτω των 13 ετών και δεν συλλέγουμε εν γνώσει μας προσωπικά δεδομένα από ανηλίκους. Επιπλέον, το iRadios εφαρμόζει πολιτική <strong>Μηδενικής Ανοχής</strong> σε περιεχόμενο που προάγει την εκμετάλλευση, κακοποίηση, διαδικτυακό εκφοβισμό (cyber bullying) ή προσωποποίηση ανηλίκων. Λογαριασμοί που εμπλέκονται σε τέτοιες δραστηριότητες διαγράφονται άμεσα και αναφέρονται στις αρμόδιες αρχές.
            </p>
          </section>

          {/* 7. ΚΟΙΝΟΠΟΙΗΣΗ ΣΕ ΤΡΙΤΟΥΣ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Share2 className="w-5 h-5 text-[#ccff00]" />
              7. Κοινοποίηση σε Τρίτους
            </h2>
            <p className="text-zinc-400">
              <strong>Δεν πωλούμε, δεν ενοικιάζουμε και δεν ανταλλάσσουμε τα προσωπικά σας δεδομένα σε τρίτους.</strong> Η κοινοποίηση γίνεται αποκλειστικά σε εξουσιοδοτημένους παρόχους υποδομών (όπως Cloudflare και Nexi), οι οποίοι δεσμεύονται συμβατικά για την τήρηση των προτύπων ασφαλείας, αποκλειστικά και μόνο για την τεχνική λειτουργία και ασφάλεια της πλατφόρμας.
            </p>
          </section>

          {/* 8. COOKIES & LOCAL STORAGE */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Cookie className="w-5 h-5 text-[#ccff00]" />
              8. Cookies και Τοπικός Χώρος (Local Storage)
            </h2>
            <p className="text-zinc-400">
              Η εφαρμογή χρησιμοποιεί Local Storage και απαραίτητα cookies για να διατηρεί τη συνεδρία σας και τις ρυθμίσεις αναπαραγωγής. Μόνο εφόσον συναινέσετε, μπορεί να χρησιμοποιεί προαιρετικές τεχνολογίες στατιστικών και διαφήμισης, συμπεριλαμβανομένης της διαφημιστικής μέτρησης και της εξατομίκευσης. Η προεπιλογή για όλες τις προαιρετικές κατηγορίες είναι άρνηση (Google Consent Mode v2). Μπορείτε ανά πάσα στιγμή να αλλάξετε ή να ανακαλέσετε την επιλογή σας από τις Ρυθμίσεις Cookies στο μενού της εφαρμογής.
            </p>
          </section>

          {/* 9. ΤΑ ΔΙΚΑΙΩΜΑΤΑ ΣΑΣ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-[#ccff00]" />
              9. Τα Δικαιώματά Σας (GDPR)
            </h2>
            <p className="text-zinc-400 mb-4">
              Έχετε το δικαίωμα να ζητήσετε πρόσβαση στα δεδομένα σας, διόρθωση ανακριβειών ή φορητότητα αυτών. Επίσης, παρέχεται η δυνατότητα <strong>πλήρους και οριστικής διαγραφής του λογαριασμού και των δεδομένων σας</strong> απευθείας μέσα από τις Ρυθμίσεις του προφίλ σας, εντός της εφαρμογής.
            </p>
          </section>

          {/* 10. ΕΠΙΚΟΙΝΩΝΙΑ */}
          <section className="bg-zinc-900/50 p-6 md:p-8 rounded-3xl border border-white/5 hover:border-white/10 transition-colors">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
              <Mail className="w-5 h-5 text-[#ccff00]" />
              10. Επικοινωνία
            </h2>
            <p className="text-zinc-400">
              Εάν έχετε ερωτήσεις σχετικά με την παρούσα Πολιτική Απορρήτου ή την επεξεργασία των δεδομένων σας, μπορείτε να επικοινωνήσετε μαζί μας μέσω της φόρμας επικοινωνίας της εφαρμογής ή στέλνοντας email στο αρμόδιο τμήμα της ILUMA Digital Agency.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
