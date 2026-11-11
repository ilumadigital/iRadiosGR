import React,{useEffect,useState} from 'react';
import {Helmet} from 'react-helmet-async';
import {Link,useSearchParams} from 'react-router-dom';
import {ArrowLeft,ArrowRight,Banknote,AlertTriangle,BarChart3,BookOpen,CheckCircle2,
  CheckSquare,FileText,Lock,Loader2,MailCheck,MapPin,Radio,Scale,ShieldCheck,
  SlidersHorizontal,Users,Crown} from 'lucide-react';

const titles=["Πρόσβαση και ασφάλεια","Πνευματικά δικαιώματα","Συνδρομές & πληρωμές","DSP & παραγωγοί","Διαφημίσεις","Analytics & δεδομένα","Αναστολή συνεργασίας","Συγκατάθεση περιεχομένου","Εγγραφή και έγκριση σταθμών","Email & προσκλήσεις","Προσωπικά δεδομένα"];
export default function TermsBroadcasters({API_URL='/api',currentUser:initialUser=null}){
  const [query]=useSearchParams();
  const inviteToken=query.get('invite')||'';
  const [account,setAccount]=useState(initialUser);
  const [status,setStatus]=useState(initialUser?'ready':'loading');
  const [checked,setChecked]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const broadcaster=account?.role==='broadcaster';
  const verified=broadcaster&&account.isVerified===true;
  const accepted=account?.hasAcceptedCurrentBroadcasterTerms===true;
  const destination=inviteToken?'/broadcaster-invite?token='+encodeURIComponent(inviteToken):'/backoffice';

  useEffect(()=>{
    if(initialUser){setAccount(initialUser);setStatus('ready');return;}
    const token=localStorage.getItem('iluma_token');
    if(!token){setAccount(null);setStatus('guest');return;}
    let active=true;
    fetch(API_URL+'/auth/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
      .then(async response=>{
        if(!response.ok)throw new Error('Μη ενεργή σύνδεση.');
        return response.json();
      })
      .then(user=>{if(active){setAccount(user);setStatus('ready');}})
      .catch(()=>{if(active){setAccount(null);setStatus('guest');}});
    return ()=>{active=false;};
  },[API_URL,initialUser]);

  async function accept(event){
    event.preventDefault();
    if(!verified||accepted||!checked||saving)return;
    const termsVersion=account?.requiredBroadcasterTermsVersion;
    const token=localStorage.getItem('iluma_token');
    if(!token||!termsVersion){setError('Συνδέσου ξανά για να επιβεβαιώσεις την έκδοση των όρων.');return;}
    setSaving(true);setError('');
    try{
      const response=await fetch(API_URL+'/users/me/accept-terms',{
        method:'PUT',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({termsVersion})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.user?.hasAcceptedCurrentBroadcasterTerms!==true)
        throw new Error(data.error||'Η αποδοχή δεν αποθηκεύτηκε.');
      // Skip /studio entirely: never initialize the listener player.
      window.location.assign(destination);
    }catch(problem){setError(problem.message);}
    finally{setSaving(false);}
  }

  return <div className="min-h-screen bg-[#080c0c] font-sans text-white selection:bg-[#ccff00] selection:text-black">
    <Helmet><title>Όροι Broadcaster | iRadiosGR</title>
      <meta name="description" content="Όροι συνεργασίας Broadcaster στο iRadiosGR: επαλήθευση, σταθμοί, άδειες, υπηρεσίες και ασφαλής αποδοχή."/></Helmet>
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0c1111]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/broadcast" className="flex items-center gap-3"><img src="/iradios-app-logo.png" className="h-11 w-11 object-contain" alt=""/><span><strong className="block text-base font-black">iRadios<span className="text-[#ccff00]">GR</span></strong><small className="block text-[9px] font-bold uppercase tracking-[.2em] text-zinc-400">Broadcaster Network</small></span></Link>
        <div className="flex items-center gap-4"><Link to="/broadcast" className="flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-white"><ArrowLeft size={17}/> Broadcaster</Link>
          {verified&&accepted?<Link to={destination} className="rounded-xl bg-[#ccff00] px-4 py-2.5 text-xs font-black text-black">Backoffice</Link>:
          !broadcaster?<Link to="/broadcast/register" className="rounded-xl bg-[#ccff00] px-4 py-2.5 text-xs font-black text-black">Εγγραφή</Link>:null}</div>
      </div>
    </header>
    <main>
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-44 -top-40 h-[560px] w-[560px] rounded-full bg-[#ccff00]/[.1] blur-[120px]"/>
        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/25 bg-[#ccff00]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.18em] text-[#ccff00]"><Scale size={17}/> Broadcaster Agreement · B2B</p>
          <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1.1] tracking-[-.05em] sm:text-6xl">Μαζί στο δίκτυο.<span className="block text-[#ccff00]">Με ξεκάθαρους όρους.</span></h1>
          <p className="mt-6 max-w-3xl text-sm leading-8 text-zinc-300 sm:text-base">Η επαγγελματική συμφωνία του iRadiosGR καλύπτει τα δικαιώματα των σταθμών, τη χρήση της πλατφόρμας, την ασφάλεια, τις συνδρομές και την πρόσβαση στα εργαλεία Broadcaster.</p>
          <div className="mt-8 flex flex-wrap gap-3 text-[11px] font-bold"><span className="rounded-full border border-white/15 bg-white/[.05] px-4 py-2">11 αναλυτικές ενότητες</span><span className="rounded-full border border-white/15 bg-white/[.05] px-4 py-2">Έκδοση B2B v2</span><span className="rounded-full border border-white/15 bg-white/[.05] px-4 py-2">Μοναδική αποδοχή ανά έκδοση</span></div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
        <div className="mb-12 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-[#111819] p-6"><Radio size={29} className="text-[#ccff00]"/><h2 className="mt-6 text-lg font-black">Ταυτότητα σταθμού</h2><p className="mt-3 text-sm leading-7 text-zinc-400">Σωστά στοιχεία, νόμιμο stream και δυνατότητα διαχειριστικού ελέγχου πριν από τη δημοσίευση.</p></div>
          <div className="rounded-3xl border border-white/10 bg-[#111819] p-6"><MailCheck size={29} className="text-[#ccff00]"/><h2 className="mt-6 text-lg font-black">Επιβεβαίωση email</h2><p className="mt-3 text-sm leading-7 text-zinc-400">Προσωρινός σύνδεσμος μίας χρήσης πριν από τη διαχείριση σταθμών και την αποδοχή των όρων.</p></div>
          <div className="rounded-3xl border border-white/10 bg-[#111819] p-6"><ShieldCheck size={29} className="text-[#ccff00]"/><h2 className="mt-6 text-lg font-black">Δικαιώματα περιεχομένου</h2><p className="mt-3 text-sm leading-7 text-zinc-400">Άδειες, εμπορικά σήματα, μουσική και υλικό παραγωγών παραμένουν ευθύνη του κατόχου τους.</p></div>
        </div>
        <div className="grid items-start gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:sticky lg:top-28 lg:block">
            <p className="mb-4 text-[10px] font-black uppercase tracking-[.2em] text-[#ccff00]">Ενότητες</p>
            <nav className="space-y-1" aria-label="Περιεχόμενα όρων">{titles.map((title,i)=>
              <a key={title} href={'#term-'+(i+1)} className="flex gap-3 rounded-xl px-3 py-2 text-xs leading-5 text-zinc-400 transition hover:bg-white/[.06] hover:text-white"><span className="w-5 shrink-0 font-black text-[#ccff00]">{String(i+1).padStart(2,'0')}</span>{title}</a>)}</nav>
            <Link to="/privacy" className="mt-6 flex items-center gap-2 border-t border-white/10 pt-5 text-xs font-semibold text-zinc-300 hover:text-white"><FileText size={17}/> Πολιτική Απορρήτου</Link>
          </aside>
          <article className="min-w-0 space-y-9">
            <div className="rounded-3xl border border-[#ccff00]/25 bg-[#ccff00]/[.05] p-6 sm:p-8"><h2 className="flex items-center gap-3 text-xl font-black"><BookOpen className="text-[#ccff00]" size={25}/> Πλήρεις όροι συνεργασίας</h2><p className="mt-4 text-sm leading-7 text-zinc-300">Η αποδοχή της τρέχουσας σύμβασης είναι απαραίτητη για τον επαληθευμένο Broadcaster πριν από την πρόσβαση στο Backoffice. Μπορείς να διαβάσεις ολόκληρο το κείμενο και χωρίς σύνδεση.</p></div>
            <div className="space-y-9 text-sm leading-8 sm:text-base">
<div className="bg-[#ccff00]/[.055] border border-[#ccff00]/25 p-6 rounded-2xl text-[#e5f8c9]">
            <strong>ΠΡΟΣΟΧΗ (ΝΟΜΙΚΗ ΔΕΣΜΕΥΣΗ):</strong> Η εγγραφή, πρόσβαση και χρήση του Broadcaster Portal συνιστά νομικά δεσμευτική σύμβαση (Service Level Agreement - SLA) μεταξύ της επιχείρησής/οργανισμού σας (εφεξής "Broadcaster" ή "Πάροχος Περιεχομένου") και της <strong>ILUMA Digital Agency</strong> (Μοσχονησίων 1, Αιγάλεω), ιδιοκτήτριας και διαχειρίστριας της πλατφόρμας iRadios.
          </div>

          {/* 1. ΕΓΓΡΑΦΗ & ΚΥΒΕΡΝΟΑΣΦΑΛΕΙΑ */}
          <section id="term-1" className="space-y-4 scroll-mt-28">
            <h2 className="text-xl font-black text-white flex items-start gap-3 leading-snug"><Lock className="w-5 h-5 text-[#ccff00]" />1. Εγγραφή, Διαπιστευτήρια & Κυβερνοασφάλεια</h2>
            <div className="bg-[#111819] p-6 rounded-2xl border border-white/10 space-y-4 text-zinc-300 hover:border-[#ccff00]/30 transition-colors">
              <p>Η δημιουργία λογαριασμού απαιτεί την παροχή έγκυρων στοιχείων. Ο Broadcaster φέρει την <strong>απόλυτη και αδιαπραγμάτευτη ευθύνη</strong> για την ασφάλεια των διαπιστευτηρίων (username/password) του ιδίου και των εξουσιοδοτημένων Παραγωγών (Producers) του.</p>
              <p><strong>Μέτρα ασφαλείας:</strong> Η ILUMA Digital Agency εφαρμόζει πρωτόκολλα υψίστης ασφαλείας για την προστασία της υποδομής και των B2B λογαριασμών (επιβεβαίωση email με μοναδικό σύνδεσμο μίας χρήσης, έλεγχο πρόσβασης και Cloudflare Turnstile).</p>
            </div>
          </section>

          {/* 2. ΝΟΜΙΚΗ ΕΥΘΥΝΗ & ΠΝΕΥΜΑΤΙΚΑ ΔΙΚΑΙΩΜΑΤΑ */}
          <section id="term-2" className="space-y-4 scroll-mt-28">
            <h2 className="text-xl font-black text-white flex items-start gap-3 leading-snug"><Radio className="w-5 h-5 text-[#ccff00]" />2. Ρήτρα Αποποίησης Ευθύνης & Πνευματικά Δικαιώματα</h2>
            <div className="bg-[#111819] p-6 rounded-2xl border border-white/10 space-y-4 text-zinc-300 hover:border-[#ccff00]/30 transition-colors">
              <p>Η πλατφόρμα λειτουργεί <strong>αποκλειστικά ως ενδιάμεσος τεχνολογικός πάροχος</strong>. Κατέχετε στο ακέραιο όλες τις νόμιμες άδειες, δικαιώματα και εξουσιοδοτήσεις από τους αρμόδιους Οργανισμούς Συλλογικής Διαχείρισης (ΟΣΔ) για τη δημόσια εκτέλεση του περιεχομένου σας.</p>
              <p><strong>Ρήτρα Αποζημίωσης:</strong> Σε περίπτωση νομικής όχλησης από τρίτα μέρη κατά της ILUMA Digital Agency εξαιτίας του δικού σας περιεχομένου, υποχρεούστε να μας αποζημιώσετε στο ακέραιο για κάθε ζημία.</p>
            </div>
          </section>

          {/* 3. FREE VS PREMIUM & ΠΛΗΡΩΜΕΣ */}
          <section id="term-3" className="space-y-4 scroll-mt-28">
            <h2 className="text-xl font-black text-white flex items-start gap-3 leading-snug"><Crown className="w-5 h-5 text-[#ccff00]" />3. Εμπορική Πολιτική, Συνδρομές & Εκκαθάριση</h2>
            <div className="bg-[#111819] p-6 rounded-2xl border border-white/10 space-y-4 text-zinc-300 hover:border-[#ccff00]/30 transition-colors">
              <p>Οι μελλοντικές αγορές Broadcaster θα διεκπεραιώνονται μέσω ILUMA Gateway / Nexi, αφού ολοκληρωθούν οι έλεγχοι. Δεν πραγματοποιούνται αυτόματες ανανεώσεις στην παρούσα φάση. Οι ειδικοί όροι τιμολόγησης και ακύρωσης θα γνωστοποιούνται πριν από κάθε ενεργοποίηση.</p>
              <div className="bg-[#ccff00]/[.055] border border-[#ccff00]/20 p-4 rounded-xl mt-4">
                  <p className="text-[#d9ff7b] mb-2"><strong>Πολιτική Αναβάθμισης (Upgrade) & Συγχώνευσης Συνδρομών:</strong></p>
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    Σε περίπτωση που διατηρείτε ενεργές μία ή περισσότερες μεμονωμένες συνδρομές πρόσθετων υπηρεσιών (Add-ons) και επιλέξετε να αναβαθμίσετε στο πλήρες πακέτο ("THE PRO PACK"), <strong>η αλλαγή πακέτου θα απαιτεί ρητή επιβεβαίωση και επαλήθευση της επίδρασης στα ήδη ενεργά Add-ons</strong>. Η μετάβαση προϋποθέτει την πλήρη προπληρωμή της αξίας του πακέτου κατά τη στιγμή της αναβάθμισης. <strong>Δεν εφαρμόζεται αναλογικός συμψηφισμός (pro-rating) ή επιστροφή χρημάτων</strong> για τον υπολειπόμενο χρόνο των ακυρωθέντων Add-ons.
                  </p>
              </div>
            </div>
          </section>

          {/* 4. ΛΕΙΤΟΥΡΓΙΕΣ & ΠΕΡΙΟΡΙΣΜΟΙ */}
          <section id="term-4" className="space-y-4 scroll-mt-28">
            <h2 className="text-xl font-black text-white flex items-start gap-3 leading-snug"><SlidersHorizontal className="w-5 h-5 text-[#ccff00]" />4. Τεχνική Διαχείριση, DSP & Εποπτεία Παραγωγών</h2>
            <div className="bg-[#111819] p-6 rounded-2xl border border-white/10 space-y-6 text-zinc-300 hover:border-[#ccff00]/30 transition-colors">
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
          <section id="term-5" className="space-y-4 scroll-mt-28">
            <h2 className="text-xl font-black text-white flex items-start gap-3 leading-snug"><Banknote className="w-5 h-5 text-[#ccff00]" />5. Monetization, Πολιτική Διαφημίσεων & Geo-Targeting</h2>
            <div className="bg-[#111819] p-6 rounded-2xl border border-white/10 space-y-4 text-zinc-300 hover:border-[#ccff00]/30 transition-colors">
              <p>Για λογαριασμούς "Free Tier", το iRadios διατηρεί το αποκλειστικό δικαίωμα προβολής/αναπαραγωγής ιδίων εμπορικών μηνυμάτων (Network Ads) κατά την ακρόαση του σταθμού σας.</p>
              <div className="flex items-start gap-2 mt-2">
                <MapPin className="w-5 h-5 text-[#ccff00] shrink-0 mt-0.5" />
                <span>
                  <strong>Γεωγραφική Στόχευση (Geo-Targeting):</strong> Μέσω των Premium εργαλείων, παρέχεται η δυνατότητα τοπικής στόχευσης των δικών σας διαφημίσεων με βάση την τοποθεσία του ακροατή (Geo-Location IP). Η ILUMA <strong>δεν φέρει καμία ευθύνη</strong> για εσφαλμένη στόχευση λόγω χρήσης VPN ή Proxy.
                </span>
              </div>
            </div>
          </section>

          {/* 6. ΑΝΑΛΥΤΙΚΑ ΣΤΟΙΧΕΙΑ */}
          <section id="term-6" className="space-y-4 scroll-mt-28">
            <h2 className="text-xl font-black text-white flex items-start gap-3 leading-snug"><BarChart3 className="w-5 h-5 text-[#ccff00]" />6. Εμπιστευτικότητα Δεδομένων & Analytics</h2>
            <div className="bg-[#111819] p-6 rounded-2xl border border-white/10 space-y-4 text-zinc-300 hover:border-[#ccff00]/30 transition-colors">
              <p>Η παροχή στατιστικών δεδομένων προορίζεται αποκλειστικά για εσωτερική επιχειρηματική αξιολόγηση. Απαγορεύεται αυστηρά η πώληση ή μεταβίβαση αυτών των δεδομένων προς τρίτους (Data Brokers).</p>
            </div>
          </section>

          {/* 7. ΑΝΑΣΤΟΛΗ & ΔΙΑΓΡΑΦΗ */}
          <section id="term-7" className="space-y-4 scroll-mt-28">
            <h2 className="text-xl font-black text-white flex items-start gap-3 leading-snug"><AlertTriangle className="w-5 h-5 text-[#ccff00]" />7. Πολιτική Αναστολής & Λύσης Συνεργασίας</h2>
            <div className="bg-[#111819] p-6 rounded-2xl border border-white/10 space-y-4 text-zinc-300 hover:border-[#ccff00]/30 transition-colors">
              <p>Η ILUMA Digital Agency διατηρεί το δικαίωμα άμεσης αναστολής ή οριστικής διαγραφής του σταθμού/λογαριασμού σας, αζημίως, σε περιπτώσεις μακροχρόνιας τεχνικής αδυναμίας (downtime), λήψης DMCA, ή καταχρηστικής συμπεριφοράς.</p>
            </div>
          </section>

          {/* 🟢 8. ΡΗΤΗ ΣΥΓΚΑΤΑΘΕΣΗ */}
          <section id="term-8" className="space-y-4 scroll-mt-28">
            <h2 className="text-xl font-black text-white flex items-start gap-3 leading-snug">
              <ShieldCheck className="w-5 h-5 text-[#ccff00]" />
              8. Ρητή Συγκατάθεση Προσθήκης Σταθμών & Περιεχομένου
            </h2>
            <div className="bg-[#111819] p-6 rounded-2xl border border-white/10 space-y-4 text-zinc-300 hover:border-[#ccff00]/30 transition-colors">
              <p>Με την αποδοχή της παρούσας, παρέχετε τη <strong>ρητή, ειδική και ανεπιφύλακτη συγκατάθεσή σας</strong> προς την ILUMA Digital Agency προκειμένου να:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Εντάξει, κατηγοριοποιήσει και προβάλλει τους ραδιοφωνικούς σταθμούς που καταχωρείτε στον παγκόσμιο κατάλογο του iRadios.</li>
                <li>Αναπαράγει το ηχητικό σας stream (streaming URL) μέσω των Web, iOS, Android και Automotive εφαρμογών της.</li>
                <li>Χρησιμοποιήσει τα λογότυπα και τις ονομασίες των σταθμών σας αποκλειστικά για την αναγνώριση και προώθησή τους.</li>
              </ul>
              <p className="mt-4 text-xs italic text-zinc-500">Η συγκατάθεση αυτή παραμένει σε ισχύ καθ' όλη τη διάρκεια διατήρησης του λογαριασμού σας και ανακαλείται αυτοδικαίως με την οριστική διαγραφή του σταθμού σας.</p>
            </div>
          </section>

<section id="term-9" className="scroll-mt-28 space-y-4">
  <h2 className="flex items-center gap-3 text-xl font-black text-white"><Radio size={22} className="shrink-0 text-[#ccff00]"/>9. Καταχώριση, Έγκριση & Πληροφορίες Σταθμών</h2>
  <div className="space-y-4 rounded-2xl border border-white/10 bg-[#111819] p-6 text-zinc-300">
    <p>Ο Broadcaster οφείλει να καταχωρίζει αληθή και ενημερωμένα στοιχεία ταυτότητας, συχνότητας, ιστοσελίδας, stream, προγράμματος και επικοινωνίας. Δηλώνει ότι νομιμοποιείται να διαχειρίζεται τους αντίστοιχους σταθμούς.</p>
    <p>Η καταχώριση σταθμού, καθώς και οι προτεινόμενες αλλαγές δημόσιων πληροφοριών, μπορούν να υπόκεινται σε διαχειριστικό έλεγχο. Η δημιουργία λογαριασμού δεν αποτελεί αυτόματη έγκριση δημοσίευσης σταθμού.</p>
    <p>Ο Broadcaster είναι υπεύθυνος για τη λειτουργία και τη νομιμότητα της πηγής μετάδοσής του. Η πλατφόρμα δεν εγγυάται τη διαθεσιμότητα ή απόδοση εξωτερικών streaming υποδομών.</p>
  </div>
</section>
<section id="term-10" className="scroll-mt-28 space-y-4">
  <h2 className="flex items-center gap-3 text-xl font-black text-white"><MailCheck size={22} className="shrink-0 text-[#ccff00]"/>10. Επιβεβαίωση Email, Συνεδρίες & Προσκλήσεις</h2>
  <div className="space-y-4 rounded-2xl border border-white/10 bg-[#111819] p-6 text-zinc-300">
    <p>Για την πρόσβαση στο Broadcaster Backoffice απαιτείται επιβεβαίωση της διεύθυνσης email με προσωρινό σύνδεσμο μίας χρήσης. Η δημιουργία λογαριασμού ή η είσοδος χωρίς επαλήθευση δεν παρέχει δικαίωμα διαχείρισης.</p>
    <p>Η αποδοχή πρόσκλησης σταθμού επιτρέπεται μόνο από επαληθευμένο λογαριασμό με το email της πρόσκλησης και αποδοχή της ισχύουσας έκδοσης των όρων. Οι προσκλήσεις έχουν περιορισμένη διάρκεια και μπορούν να ανακληθούν.</p>
    <p>Ο Broadcaster φέρει ευθύνη να χορηγεί και να ανακαλεί εγκαίρως δικαιώματα πρόσβασης στους παραγωγούς και τους συνεργάτες του.</p>
  </div>
</section>
<section id="term-11" className="scroll-mt-28 space-y-4">
  <h2 className="flex items-center gap-3 text-xl font-black text-white"><ShieldCheck size={22} className="shrink-0 text-[#ccff00]"/>11. Προσωπικά Δεδομένα, Υλικό & Προβολή</h2>
  <div className="space-y-4 rounded-2xl border border-white/10 bg-[#111819] p-6 text-zinc-300">
    <p>Η επεξεργασία προσωπικών δεδομένων διέπεται από την <Link to="/privacy" className="font-bold text-[#ccff00] underline underline-offset-4">Πολιτική Απορρήτου</Link> του iRadios. Ο Broadcaster δηλώνει ότι διαθέτει τις απαιτούμενες άδειες ή συγκαταθέσεις για ονόματα και φωτογραφίες παραγωγών, λογότυπα και λοιπό υλικό.</p>
    <p>Τα στατιστικά δεδομένα αποτελούν τεχνικές μετρήσεις και ενδέχεται να επηρεάζονται από VPN, αποκλεισμούς δικτύου, συσκευές και εξωτερικούς παρόχους. Δεν αποτελούν εγγυημένο αριθμό μοναδικών φυσικών προσώπων.</p>
    <p>Οι αναβαθμίσεις Premium, τα Add-ons και τα Boost ενεργοποιούνται σύμφωνα με τα δικαιώματα του λογαριασμού ή του συγκεκριμένου σταθμού και τους ειδικότερους όρους κάθε ενεργοποίησης. Η προβολή Boost δεν εγγυάται συγκεκριμένο αριθμό ακροατών ή εμπορικό αποτέλεσμα.</p>
  </div>
</section>
            </div>
            <section id="acceptance" className="scroll-mt-28 rounded-[32px] border border-[#ccff00]/30 bg-gradient-to-br from-[#263519] to-[#101817] p-6 sm:p-9">
              <div className="flex items-center gap-3"><ShieldCheck size={30} className="text-[#ccff00]"/><h2 className="text-xl font-black sm:text-2xl">Αποδοχή όρων συνεργασίας</h2></div>
              {status==='loading'?<p role="status" className="mt-6 flex items-center gap-3 text-sm text-zinc-300"><Loader2 className="animate-spin" size={18}/> Έλεγχος σύνδεσης…</p>:
                !account?<div className="mt-5 space-y-5"><p className="text-sm leading-7 text-zinc-300">Μπορείς να διαβάσεις τους όρους ελεύθερα. Για αποδοχή απαιτείται επιβεβαιωμένος λογαριασμός Broadcaster.</p><div className="flex flex-wrap gap-3"><Link to="/broadcast/register" className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-5 py-3 text-sm font-black text-black">Εγγραφή Broadcaster <ArrowRight size={17}/></Link><Link to={'/login'+(inviteToken?'?invite='+encodeURIComponent(inviteToken):'')} className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Σύνδεση</Link></div></div>:
                !broadcaster?<p className="mt-5 text-sm leading-7 text-zinc-300">Οι όροι είναι διαθέσιμοι για ανάγνωση. Η αποδοχή τους απαιτεί λογαριασμό Broadcaster.</p>:
                !verified?<div className="mt-5 space-y-4"><p className="text-sm leading-7 text-amber-200">Το email σου πρέπει να επιβεβαιωθεί πριν από την αποδοχή της σύμβασης και την πρόσβαση στο Backoffice.</p><Link to="/broadcast/pending" className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-5 py-3 text-sm font-black text-black"><MailCheck size={18}/> Επιβεβαίωσε το email σου</Link></div>:
                accepted?<div className="mt-5 space-y-4"><p className="flex items-center gap-3 text-sm font-black text-[#ccff00]"><CheckCircle2 size={22}/> Η ισχύουσα σύμβαση έχει ήδη γίνει αποδεκτή.</p><Link to={destination} className="inline-flex items-center gap-2 rounded-xl bg-[#ccff00] px-5 py-3 text-sm font-black text-black">Άνοιγμα Backoffice <ArrowRight size={17}/></Link></div>:
                <form onSubmit={accept} className="mt-6 space-y-5"><p className="text-sm leading-7 text-zinc-300">Για να συνεχίσεις, αποδέξου ρητά την τρέχουσα έκδοση των όρων B2B.</p>
                  <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-white/15 bg-black/20 p-5 text-sm leading-7 text-zinc-200"><input type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)} required className="mt-1 h-5 w-5 shrink-0 accent-[#ccff00]"/><span>Διάβασα, κατανοώ και <strong className="text-white">αποδέχομαι τους όρους B2B συνεργασίας</strong>.</span></label>
                  {error&&<p role="alert" className="rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
                  <button type="submit" disabled={!checked||saving} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#ccff00] px-6 py-4 text-sm font-black text-black transition hover:bg-[#e1ff79] disabled:cursor-not-allowed disabled:opacity-50">{saving?<Loader2 size={18} className="animate-spin"/>:<CheckSquare size={18}/>} Αποδέχομαι και συνεχίζω <ArrowRight size={17}/></button>
                </form>}
            </section>
          </article>
        </div>
      </div>
    </main>
    <footer className="border-t border-white/10 px-5 py-8 text-xs text-zinc-500"><div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-5"><span>iRadiosGR · Broadcaster Network</span><div className="flex gap-5"><Link to="/broadcast" className="hover:text-white">Broadcaster</Link><Link to="/privacy" className="hover:text-white">Απόρρητο</Link><Link to="/terms" className="hover:text-white">Γενικοί όροι</Link></div></div></footer>
  </div>;
}
