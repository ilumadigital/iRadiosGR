import React from 'react';
import {Check,Minus,Crown,Headphones,Radio,ShieldCheck,SlidersHorizontal,Sparkles,ScanSearch,Volume2} from 'lucide-react';
const BENEFITS=[
 {label:'Ακρόαση σταθμών',desc:'Πρόσβαση στους διαθέσιμους ραδιοφωνικούς σταθμούς',free:true,premium:true},
 {label:'Αγαπημένοι σταθμοί',desc:'Αποθήκευση και γρήγορη πρόσβαση',free:true,premium:true},
 {label:'Βασική ανακάλυψη περιεχομένου',desc:'Κατηγορίες και εκπομπές',free:true,premium:true},
 {label:'Χωρίς in-app διαφημίσεις iRadios',desc:'Πιο καθαρή εμπειρία στην εφαρμογή',free:false,premium:true},
 {label:'Music Radar',desc:'Χειροκίνητη αναγνώριση τραγουδιών',free:false,premium:true},
 {label:'1Click to Spotify Search',desc:'Αναζήτηση του τραγουδιού στο Spotify με ένα πάτημα',free:false,premium:true},
 {label:'1Click to Apple Music Search',desc:'Αναζήτηση του τραγουδιού στο Apple Music με ένα πάτημα',free:false,premium:true},
 {label:'Audio DSP & ισοσταθμιστής',desc:'Προσαρμοσμένη επεξεργασία ήχου όπου υποστηρίζεται',free:false,premium:true},
 {label:'Ενισχυμένες επιλογές ακρόασης',desc:'Πρόσθετα εργαλεία Premium',free:false,premium:true}
];
function Mark({enabled}){
 return enabled?<span className="inline-flex size-7 items-center justify-center rounded-full bg-[#ccff00]/15 text-[#ccff00]"><Check size={16}/></span>:
 <span className="inline-flex size-7 items-center justify-center rounded-full bg-white/5 text-zinc-600"><Minus size={16}/></span>;
}
export default function PremiumCompare(){
 return <section className="mt-7 overflow-hidden rounded-[30px] border border-white/10 bg-[#111310]/90 shadow-[0_20px_70px_rgba(0,0,0,.2)]">
  <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-6 sm:flex-row sm:items-center sm:p-8">
   <div>
    <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.18em] text-[#ccff00]"><Sparkles size={14}/> Διάλεξε την εμπειρία σου</p>
    <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Free ή Premium;</h2>
    <p className="mt-2 text-sm text-zinc-400">Σύγκρινε ξεκάθαρα όσα περιλαμβάνει κάθε πλάνο.</p>
   </div>
   <div className="inline-flex items-center gap-2 rounded-full border border-[#ccff00]/20 bg-[#ccff00]/10 px-4 py-2 text-xs font-black text-[#ccff00]"><ShieldCheck size={15}/> 3,99 €/μήνα με ΦΠΑ</div>
  </div>
  <div className="overflow-x-auto">
   <table className="w-full min-w-[520px] border-collapse text-left">
    <thead><tr className="text-xs uppercase tracking-[.1em]">
      <th scope="col" className="px-5 py-5 font-bold text-zinc-400 sm:px-8">Χαρακτηριστικό</th>
      <th scope="col" className="w-[100px] px-3 py-5 text-center font-black text-zinc-400">Free</th>
      <th scope="col" className="w-[135px] bg-[#ccff00]/[.06] px-3 py-5 text-center font-black text-[#ccff00]"><Crown size={17} className="mx-auto mb-1"/> Premium</th>
    </tr></thead>
    <tbody>{BENEFITS.map((row,i)=><tr key={row.label} className="border-t border-white/[.065]">
      <th scope="row" className="px-5 py-4 sm:px-8"><span className="block text-sm font-bold text-white">{row.label}</span><span className="mt-1 block text-xs font-normal leading-5 text-zinc-500">{row.desc}</span></th>
      <td className="px-3 py-4 text-center"><div className="flex justify-center"><Mark enabled={row.free}/></div></td>
      <td className="bg-[#ccff00]/[.06] px-3 py-4 text-center"><div className="flex justify-center"><Mark enabled={row.premium}/></div></td>
    </tr>)}</tbody>
   </table>
  </div>
  <p className="border-t border-white/10 px-6 py-4 text-xs leading-6 text-zinc-500 sm:px-8">Τα διαθέσιμα εργαλεία ήχου εξαρτώνται από τη συσκευή και τις δυνατότητες του σταθμού. Το Premium αφαιρεί διαφημίσεις της εφαρμογής, όχι διαφημίσεις που μεταδίδονται από τους ίδιους τους σταθμούς.</p>
 </section>;
}
