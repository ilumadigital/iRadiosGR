import React,{useState} from 'react';
import {ArrowRight,AudioLines,BarChart3,Check,ChevronRight,CirclePlay,
 CreditCard,Headphones,LayoutGrid,LayoutPanelTop,MapPinned,Mic2,MousePointer2,
 Pause,Radio,Rows3,ShieldCheck,SlidersHorizontal,Sparkles,Target,Volume2} from 'lucide-react';

const primary='inline-flex items-center justify-center gap-3 rounded-2xl bg-[#caff00] px-7 py-4 text-[12px] font-black uppercase tracking-[.08em] text-[#101309] shadow-[0_14px_40px_rgba(202,255,0,.13)] transition hover:-translate-y-0.5 hover:bg-[#ddff74] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#caff00]';
const glass='border border-white/10 bg-[#111018]/90 shadow-[0_24px_90px_rgba(0,0,0,.2)]';
const placements=[
 {name:'Hero Takeover',label:'High impact',type:'visual',icon:LayoutPanelTop,theme:'violet',
  desc:'Το δημιουργικό σου στο πιο προβεβλημένο σημείο της αρχικής.'},
 {name:'Native Radio Grid',label:'Discovery',type:'visual',icon:LayoutGrid,theme:'fuchsia',
  desc:'Φυσική παρουσία μέσα στην ανακάλυψη ραδιοφωνικών σταθμών.'},
 {name:'In-Feed Display',label:'Seamless',type:'visual',icon:Rows3,theme:'blue',
  desc:'Visual placements μέσα στη ροή περιεχομένου του iRadios.'},
 {name:'Station & News',label:'Contextual',type:'visual',icon:Radio,theme:'emerald',
  desc:'Εμφάνιση σε σχετικά σημεία του δικτύου, ανά τοποθέτηση.'},
 {name:'Audio Spots',label:'Listen & engage',type:'audio',icon:Mic2,theme:'amber',
  desc:'Ηχητικά δημιουργικά μέσα στην ακρόαση, με κατάλληλο companion visual.'}
];
const steps=[
 {id:'01',title:'Δημιουργείς το Agency σου',desc:'Εγγραφή και ασφαλής πρόσβαση στον ιδιωτικό χώρο διαχείρισης.'},
 {id:'02',title:'Στήνεις την καμπάνια',desc:'Visual, Audio, γεωγραφική στόχευση και δημιουργικά από το Backoffice.'},
 {id:'03',title:'Εγκρίνεται από την ομάδα μας',desc:'Κάθε νέα καμπάνια ή ουσιαστική αλλαγή περνά από έλεγχο Admin.'},
 {id:'04',title:'Παρακολουθείς την πορεία',desc:'Στατιστικά, διαθέσιμο budget και ιστορικό συγκεντρωμένα σε μία κονσόλα.'}
];
function DashboardIllustration(){
 return <div aria-label="Ενδεικτική απεικόνιση του Agency Backoffice" className="relative mx-auto w-full max-w-[535px]">
   <div className="pointer-events-none absolute -inset-7 rounded-[60px] bg-purple-600/20 blur-[65px]"/>
   <div className="relative overflow-hidden rounded-[30px] border border-white/15 bg-[#101018] shadow-[0_32px_100px_rgba(0,0,0,.65)]">
    <div className="flex items-center gap-2 border-b border-white/10 bg-[#171520] px-5 py-4">
     <div className="flex gap-1.5"><span className="size-2.5 rounded-full bg-rose-400/75"/><span className="size-2.5 rounded-full bg-amber-400/75"/><span className="size-2.5 rounded-full bg-emerald-400/75"/></div>
     <span className="ml-auto rounded-lg border border-purple-400/25 bg-purple-500/10 px-2.5 py-1 text-[9px] font-extrabold tracking-widest text-purple-200">AGENCY CONSOLE</span>
    </div>
    <div className="p-5 sm:p-7">
     <div className="flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-purple-300">Campaign workspace</p>
       <p className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">Η ιδέα σου. Παντού.</p>
      </div><span className="rounded-xl bg-[#caff00]/10 p-2.5 text-[#caff00]"><AudioLines size={23}/></span>
     </div>
     <div className="mt-7 grid grid-cols-3 gap-2.5">
      {['Visual + Audio','Geo targeting','Admin review'].map((value,i)=><div key={value} className="min-w-0 rounded-2xl border border-white/10 bg-white/[.035] p-3">
       <span className={['bg-purple-400','bg-[#caff00]','bg-sky-400'][i]+' mb-3 block h-1.5 w-7 rounded-full'}/>
       <p className="text-[10px] font-bold leading-4 text-zinc-200">{value}</p>
      </div>)}
     </div>
     <div className="mt-4 rounded-[22px] border border-purple-300/15 bg-gradient-to-br from-[#251a3a] to-[#171720] p-5">
      <div className="flex items-center justify-between gap-3">
       <p className="text-xs font-black text-white">Campaign delivery</p>
       <span className="rounded-full border border-amber-200/25 bg-amber-300/10 px-2.5 py-1 text-[9px] font-black text-amber-100">ΠΡΟΣ ΕΓΚΡΙΣΗ</span>
      </div>
      <div className="mt-6 flex h-24 items-end gap-2">
       {[33,52,40,69,48,80,59,92,75,88,64,96].map((height,index)=><span key={index} className="min-w-0 flex-1 rounded-t-md bg-gradient-to-t from-purple-600/45 to-fuchsia-400/90" style={{height:height+'%'}}/>)}
      </div>
      <div className="mt-3 flex justify-between text-[9px] font-bold uppercase tracking-widest text-zinc-500">
       <span>Reporting</span><span>Campaign insights</span>
      </div>
     </div>
     <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0d0d14] p-3.5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-purple-500/15 p-2.5 text-purple-300"><ShieldCheck size={18}/></span>
       <div><p className="text-[11px] font-black text-white">Κάθε αλλαγή με έγκριση</p><p className="mt-1 text-[10px] text-zinc-500">Εσύ δημιουργείς. Εμείς ελέγχουμε.</p></div>
      </div><ChevronRight className="shrink-0 text-zinc-500" size={17}/>
     </div>
    </div>
   </div>
   <p className="mt-4 text-center text-[10px] text-zinc-500">Ενδεικτική απεικόνιση περιβάλλοντος — όχι πραγματικά δεδομένα ή ενεργή καμπάνια.</p>
  </div>;
}
function PlacementCard({item,index}){
 const Icon=item.icon;
 const accent={
  violet:'border-violet-400/25 bg-violet-500/10 text-violet-300',
  fuchsia:'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-300',
  blue:'border-blue-400/25 bg-blue-500/10 text-blue-300',
  emerald:'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
  amber:'border-amber-400/25 bg-amber-500/10 text-amber-300'
 }[item.theme];
 return <article className={'group relative flex min-h-[250px] flex-col overflow-hidden rounded-[30px] p-6 transition duration-300 hover:-translate-y-1 hover:border-purple-400/35 '+glass+(index===0?' md:col-span-2':'')}>
  <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-purple-400/[.07] blur-3xl transition group-hover:bg-purple-400/[.16]"/>
  <div className="relative flex items-start justify-between">
   <span className={'flex size-12 items-center justify-center rounded-2xl border '+accent}><Icon size={23}/></span>
   <span className="text-[9px] font-black uppercase tracking-[.2em] text-zinc-500">{item.label}</span>
  </div>
  <div className="relative mt-auto pt-8">
   <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">{item.name}</h3>
   <p className="mt-2 max-w-md text-sm leading-6 text-zinc-400">{item.desc}</p>
  </div>
 </article>;
}
export default function GoAgencyLanding({currentUser,onAction}){
 const [selected,setSelected]=useState('visual');
 const agency=currentUser?.role==='agency';
 return <div className="relative overflow-hidden bg-[#08080e] pb-24 text-white">
  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
   <div className="absolute -top-80 left-1/3 size-[800px] rounded-full bg-purple-600/[.14] blur-[155px]"/>
   <div className="absolute right-0 top-[950px] size-[570px] rounded-full bg-fuchsia-500/[.06] blur-[140px]"/>
  </div>
  <div className="relative mx-auto max-w-[1450px] px-5 sm:px-8 lg:px-12">
   <section className="grid items-center gap-14 pb-24 pt-16 lg:grid-cols-[1.02fr_.98fr] lg:gap-20 lg:pb-32 lg:pt-28">
    <div>
     <span className="inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.22em] text-purple-200"><Sparkles size={14}/> iRadios Ad Network</span>
     <h1 className="mt-9 text-[clamp(3.15rem,6.1vw,6.8rem)] font-black uppercase italic leading-[.96] tracking-[-.075em]">
      Your brand.<br/><span className="bg-gradient-to-r from-purple-300 via-fuchsia-400 to-[#e6ff7a] bg-clip-text text-transparent">On Air.</span><br/>Everywhere.
     </h1>
     <p className="mt-8 max-w-[600px] text-lg leading-8 text-zinc-300 sm:text-xl">Φέρε το brand σου εκεί που βρίσκεται η μουσική. Visual, native και audio προβολή σε ένα ενιαίο διαφημιστικό περιβάλλον, φτιαγμένο για brands και agencies.</p>
     <div className="mt-9 flex flex-wrap gap-3">
      <button type="button" onClick={onAction} className={primary}>{agency?'Άνοιγμα Backoffice':'Ξεκίνα με Agency Account'}<ArrowRight size={19}/></button>
      <a href="#ad-formats" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[.05] px-6 py-4 text-[12px] font-black uppercase tracking-wide text-zinc-100 transition hover:border-purple-400/40 hover:bg-purple-400/10">Δες τις δυνατότητες <ChevronRight size={18}/></a>
     </div>
     <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-[12px] font-bold text-zinc-400">
      <span className="inline-flex items-center gap-2"><Check className="text-[#caff00]" size={16}/> Visual + Audio</span>
      <span className="inline-flex items-center gap-2"><Check className="text-[#caff00]" size={16}/> Στόχευση ανά περιοχή</span>
      <span className="inline-flex items-center gap-2"><Check className="text-[#caff00]" size={16}/> Admin approval</span>
     </div>
    </div>
    <DashboardIllustration/>
   </section>

   <section aria-label="Πλεονεκτήματα Ad Network" className="grid gap-4 md:grid-cols-3">
    <div className={'rounded-[28px] p-7 '+glass}><MapPinned className="text-purple-300" size={28}/><h2 className="mt-6 text-xl font-black">Στο σωστό κοινό.</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Οργάνωσε στόχευση σε επίπεδο χώρας, περιφέρειας και νομού — χωρίς επιλογές πόλης.</p></div>
    <div className={'rounded-[28px] p-7 '+glass}><SlidersHorizontal className="text-fuchsia-300" size={28}/><h2 className="mt-6 text-xl font-black">Με έλεγχο στο budget.</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Κάθε καμπάνια έχει ξεχωριστό budget, παρακολούθηση χρηματοδότησης και δυνατότητα top-up όταν ενεργοποιηθεί η τιμολόγηση.</p></div>
    <div className={'rounded-[28px] p-7 '+glass}><BarChart3 className="text-[#caff00]" size={28}/><h2 className="mt-6 text-xl font-black">Όλα σε ένα Backoffice.</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Καμπάνιες, δημιουργικά, έλεγχος κατάστασης και διαθέσιμα στατιστικά, μέσα στον ίδιο επαγγελματικό χώρο.</p></div>
   </section>

   <section id="ad-formats" className="scroll-mt-28 py-24 lg:py-32">
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
     <div><span className="text-[11px] font-black uppercase tracking-[.26em] text-purple-300">Your creative playground</span>
      <h2 className="mt-4 text-4xl font-black uppercase italic tracking-[-.06em] sm:text-6xl">More than <span className="text-purple-400">a banner.</span></h2>
      <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">Διάλεξε τον τρόπο που θα συναντήσει το κοινό το μήνυμά σου. Ο σχεδιασμός και η διαχείριση γίνονται από το Agency Backoffice.</p>
     </div>
     <div role="group" aria-label="Φίλτρο μορφής διαφήμισης" className="flex rounded-2xl border border-white/10 bg-[#14121d] p-1">
      {[{id:'visual',label:'Visual'},{id:'audio',label:'Audio'},{id:'all',label:'Όλα'}].map(tab=><button type="button" key={tab.id} aria-pressed={selected===tab.id} onClick={()=>setSelected(tab.id)}
       className={'rounded-xl px-5 py-2.5 text-xs font-black transition '+(selected===tab.id?'bg-purple-500 text-white':'text-zinc-400 hover:text-white')}>{tab.label}</button>)}
     </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
     {placements.filter(item=>selected==='all'||item.type===selected).map((item,index)=><PlacementCard key={item.name} item={item} index={index}/>)}
    </div>
   </section>

   <section className={'relative overflow-hidden rounded-[36px] border-purple-400/25 bg-gradient-to-br from-[#28173b] via-[#16111f] to-[#0c0b13] p-7 sm:p-10 lg:p-14'}>
    <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-96 rounded-full bg-purple-500/15 blur-[80px]"/>
    <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_.75fr]">
     <div><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-300"><AudioLines size={18}/> Audio advertising</span>
      <h2 className="mt-5 text-3xl font-black uppercase italic tracking-[-.05em] sm:text-5xl">Το μήνυμά σου.<br/><span className="text-[#caff00]">Μέσα στην ακρόαση.</span></h2>
      <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">Audio spots σε υποστηριζόμενα σημεία αναπαραγωγής, με επιλογές δημιουργικού και συνοδευτική οπτική παρουσία όπου υποστηρίζεται. Η πραγματική προβολή εξαρτάται από έγκριση και διαθεσιμότητα.</p>
     </div>
     <div className="rounded-[26px] border border-white/15 bg-black/30 p-6">
      <div className="flex items-center gap-4"><div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-700"><Headphones size={29}/></div><div><p className="text-sm font-black">Audio campaign preview</p><p className="mt-1 text-xs text-zinc-400">Illustrative creative layout</p></div></div>
      <div className="my-7 flex h-14 items-center gap-1.5">{[16,26,43,31,51,22,38,56,30,47,21,52,33,19,45,35,23,39].map((h,i)=><span key={i} className="min-w-0 flex-1 rounded-full bg-purple-400/70" style={{height:h+'px'}}/>)}</div>
      <div className="flex items-center justify-between border-t border-white/10 pt-4"><span className="flex items-center gap-2 text-xs font-bold text-zinc-300"><CirclePlay size={21}/> Ακρόαση με ταυτότητα</span><span className="text-[10px] text-purple-300">VISUAL + SOUND</span></div>
     </div>
    </div>
   </section>

   <section className="py-24 lg:py-32">
    <span className="text-[11px] font-black uppercase tracking-[.26em] text-purple-300">Built for professional teams</span>
    <h2 className="mt-4 text-4xl font-black uppercase italic tracking-[-.06em] sm:text-6xl">Από την ιδέα <span className="text-purple-400">στον αέρα.</span></h2>
    <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
     {steps.map(step=><div key={step.id} className={'rounded-[26px] p-6 '+glass}>
      <p className="text-4xl font-black tracking-tight text-purple-400/80">{step.id}</p>
      <h3 className="mt-6 text-lg font-black">{step.title}</h3><p className="mt-3 text-sm leading-6 text-zinc-400">{step.desc}</p>
     </div>)}
    </div>
   </section>

   <section className="relative overflow-hidden rounded-[38px] border border-[#caff00]/20 bg-[#171c14] px-7 py-12 text-center sm:px-12 sm:py-16">
    <div className="pointer-events-none absolute inset-x-0 -top-44 mx-auto size-80 rounded-full bg-[#caff00]/10 blur-[70px]"/>
    <div className="relative mx-auto max-w-3xl"><span className="text-[11px] font-black uppercase tracking-[.23em] text-[#caff00]">Make your brand heard</span>
     <h2 className="mt-5 text-4xl font-black uppercase italic leading-[1.04] tracking-[-.06em] sm:text-6xl">Η επόμενη καμπάνια<br/>ξεκινά εδώ.</h2>
     <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">Ένα σημείο για όλα τα δημιουργικά, τις εγκρίσεις και τη διαχείριση του brand σου στο iRadios GR.</p>
     <button type="button" onClick={onAction} className={primary+' mt-8'}>{agency?'Μετάβαση στο Agency Backoffice':'Δημιούργησε Agency Account'}<ArrowRight size={19}/></button>
     <p className="mt-5 text-xs leading-5 text-zinc-500">Οι χρεώσεις Advertising v2 και η πληρωμένη προβολή δεν έχουν ενεργοποιηθεί ακόμη στο staging. Οι τελικές τιμές ορίζονται στο Backoffice.</p>
    </div>
   </section>
  </div>
 </div>;
}
