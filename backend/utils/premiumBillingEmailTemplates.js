'use strict';
const {renderBrandedEmail,escapeHtml,actionButton,infoPanel,siteOrigin}=require('./emailDesign');

// This exact benefit inventory is shared by every listener Premium onboarding
// and remains contract-tested against the /premium comparison page.
const PREMIUM_BENEFITS=Object.freeze([
 {title:'Χωρίς in-app διαφημίσεις iRadios',description:'Ακρόαση χωρίς διαφημίσεις της εφαρμογής. Οι διαφημίσεις που μεταδίδουν οι σταθμοί δεν επηρεάζονται.'},
 {title:'Music Radar',description:'Αναγνώρισε χειροκίνητα το τραγούδι που ακούς.'},
 {title:'1Click to Spotify Search',description:'Αναζήτησε το τραγούδι στο Spotify με ένα πάτημα.'},
 {title:'1Click to Apple Music Search',description:'Αναζήτησε το τραγούδι στο Apple Music με ένα πάτημα.'},
 {title:'Audio DSP & ισοσταθμιστής',description:'Προσάρμοσε τον ήχο στη συσκευή σου, όπου υποστηρίζεται.'},
 {title:'Ενισχυμένες επιλογές ακρόασης',description:'Πρόσθετα εργαλεία και δυνατότητες Premium μέσα στην εφαρμογή.'}
]);
const fmt=value=>{
 if(!value)return '—';
 const date=new Date(value);
 if(!Number.isFinite(+date))return '—';
 return new Intl.DateTimeFormat('el-GR',{dateStyle:'long',timeStyle:'short',
  timeZone:'Europe/Athens'}).format(date);
};
const euros=cents=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(cents/100);
const paragraph=text=>'<p>'+escapeHtml(text)+'</p>';
const stageNote='<p style="color:#96A3B4;font-size:12px;">Στο δοκιμαστικό περιβάλλον οι επόμενες αυτόματες χρεώσεις παραμένουν απενεργοποιημένες μέχρι την ολοκλήρωση των ελέγχων. Η παρούσα ενημέρωση δεν αποτελεί νέα χρέωση.</p>';
const primary=(label,path)=>actionButton(label,siteOrigin()+path);
const list=()=>'<div style="border:1px solid #39442C;background:#141D19;border-radius:18px;padding:18px 22px;margin:20px 0;">'+
 '<p style="margin:0 0 12px;color:#CCFF00;font-size:12px;font-weight:800;letter-spacing:1.2px;">ΤΑ ΠΡΟΝΟΜΙΑ ΣΟΥ</p>'+
 PREMIUM_BENEFITS.map(item=>'<p style="margin:0 0 14px;color:#F6F8FF;font-size:14px;">'+
 '<strong>'+escapeHtml(item.title)+'</strong><br><span style="color:#B5C1C9;font-size:13px;">'+
 escapeHtml(item.description)+'</span></p>').join('')+'</div>';

function premiumBillingEmail({kind,name='φίλε ακροατή',amountCents=399,periodEndsAt,
 graceEndsAt,offerEndsAt,unsubscribeLink}={}){
 const user=escapeHtml(name||'φίλε ακροατή');
 const menu=primary('Διαχείριση συνδρομής','/profile?tab=billing');
 let subject,headline,category='IRADIOSGR · PREMIUM',content='';
 switch(kind){
  case 'welcome':
   subject='Καλωσόρισες στο iRadios GR Premium!';
   headline='Καλωσόρισες στο iRadios GR Premium!';
   content='<p>Γεια σου <strong>'+user+'</strong>,</p>'+
    '<p>Η πρώτη πληρωμή ολοκληρώθηκε επιτυχώς και το Premium σου ενεργοποιήθηκε. Σε ευχαριστούμε που είσαι μαζί μας!</p>'+
    infoPanel('Η πληρωμή σου',euros(amountCents),{highlight:true})+
    '<p><strong>Επόμενη μηνιαία ανανέωση:</strong> 3,99 € με ΦΠΑ, εκτός αν ακυρώσεις τη συνδρομή.</p>'+
    '<p><strong>Πληρωμένη έως:</strong> '+escapeHtml(fmt(periodEndsAt))+'</p>'+
    list()+
    '<p>Για να δοκιμάσεις τις δυνατότητες του Premium, άνοιξε την εφαρμογή και ξεκίνα την ακρόαση. Μπορείς να διαχειριστείς ή να ακυρώσεις τις επόμενες χρεώσεις οποιαδήποτε στιγμή από το Billing, χωρίς να χάσεις την ήδη πληρωμένη περίοδο.</p>'+
    primary('Απόλαυσε το Premium','/premium')+menu+stageNote;
   break;
  case 'soon':
   subject='Το iRadios Premium σου λήγει σύντομα';
   headline='Το Premium σου λήγει σύντομα';
   content='<p>Γεια σου <strong>'+user+'</strong>, η τρέχουσα πληρωμένη περίοδος πλησιάζει στη λήξη.</p>'+
    infoPanel('Τέλος πληρωμένης περιόδου',fmt(periodEndsAt),{highlight:true})+
    '<p>Αν έχεις ενεργή αυτόματη ανανέωση, μπορείς να ελέγξεις την προγραμματισμένη χρέωση στο Billing. Αν έχεις ακυρώσει τη συνδρομή, δεν θα πραγματοποιηθούν νέες αυτόματες χρεώσεις.</p>'+
    menu+stageNote;
   break;
  case 'grace':
   subject='Το Premium σου βρίσκεται σε περίοδο χάριτος';
   headline='Η περίοδος Premium ολοκληρώθηκε';
   content='<p>Γεια σου <strong>'+user+'</strong>, η πληρωμένη περίοδος έληξε και τα προνόμιά σου διατηρούνται προσωρινά.</p>'+
    infoPanel('Λήξη περιόδου χάριτος',fmt(graceEndsAt),{highlight:true})+
    '<p>Έλεγξε την κατάσταση της συνδρομής σου. Η ενεργοποίηση νέας πληρωμένης περιόδου γίνεται μόνο μετά από επιβεβαιωμένη πληρωμή.</p>'+menu+stageNote;
   break;
  case 'cancelled':
   subject='Επιβεβαίωση ακύρωσης αυτόματης ανανέωσης Premium';
   headline='Η αυτόματη ανανέωση ακυρώθηκε';
   content='<p>Γεια σου <strong>'+user+'</strong>, ολοκληρώθηκε η ακύρωση της αυτόματης ανανέωσης της συνδρομής σου.</p>'+
    '<p><strong>Δεν θα γίνουν νέες αυτόματες χρεώσεις</strong> για τη συνδρομή που ακύρωσες. Δεν χάνεις την ήδη πληρωμένη περίοδο ή τυχόν ισχύουσα περίοδο χάριτος.</p>'+
    (periodEndsAt?infoPanel('Πληρωμένη έως',fmt(periodEndsAt)):'')+
    '<p>Αν αλλάξεις γνώμη, μπορείς να δεις τις διαθέσιμες επιλογές στο Billing.</p>'+
    menu+stageNote;
   break;
  case 'expired':
   subject='Η συνδρομή σου iRadios Premium έληξε';
   headline='Η συνδρομή σου έληξε';
   content='<p>Γεια σου <strong>'+user+'</strong>, η συνδρομή σου ολοκληρώθηκε και τα Premium προνόμια δεν είναι πλέον ενεργά.</p>'+
    infoPanel('Ημερομηνία λήξης',fmt(graceEndsAt||periodEndsAt))+
    '<p>Ο λογαριασμός σου συνεχίζει κανονικά ως Free. Για να επιστρέψεις στο Premium μπορείς να ξεκινήσεις νέα συνδρομή από την εφαρμογή.</p>'+
    primary('Δες το Premium','/premium')+menu+stageNote;
   break;
  case 'winback':
   subject='Επέστρεψε στο iRadios Premium με 1,99 €';
   headline='Μας έλειψες! Το Premium σε περιμένει.';
   category='IRADIOSGR · ΕΙΔΙΚΗ ΠΡΟΣΦΟΡΑ';
   content='<p>Γεια σου <strong>'+user+'</strong>, έχεις μία μοναδική προσφορά επιστροφής!</p>'+
    infoPanel('Μόνο για τον πρώτο μήνα',euros(199),{highlight:true})+
    '<p><strong>Από τον δεύτερο μήνα:</strong> 3,99 € κάθε μήνα (με ΦΠΑ), με αυτόματη ανανέωση μέχρι να ακυρώσεις.</p>'+
    '<p><strong>Δικαίωμα χρήσης:</strong> Μία μόνο φορά ανά λογαριασμό, εντός 30 ημερών από τη λήξη του Premium.</p>'+
    '<p><strong>Λήξη της προσφοράς:</strong> '+escapeHtml(fmt(offerEndsAt))+'</p>'+
    list()+
    '<p>Η χρέωση πραγματοποιείται μόνο αν επιλέξεις εσύ «Έναρξη συνδρομής» και ολοκληρώσεις την ασφαλή πληρωμή. Μπορείς να ακυρώσεις τις επόμενες χρεώσεις οποιαδήποτε στιγμή από το Billing.</p>'+
    primary('Επιστροφή στο Premium με 1,99 €','/premium?winback=1')+
    (unsubscribeLink?'<p style="font-size:12px;color:#96A3B4;"><a href="'+escapeHtml(unsubscribeLink)+'" style="color:#A7B2C0;">Διακοπή προωθητικών email</a></p>':'')+stageNote;
   break;
  default:throw Error('Unsupported Premium billing email');
 }
 return {subject,html:renderBrandedEmail({category,headline,preheader:subject,content}),
  text:[subject,kind==='welcome'?'Η συνδρομή σου ενεργοποιήθηκε.':'Ενημέρωση για τη συνδρομή Premium σου.',
   'Διαχείριση συνδρομής: '+siteOrigin()+'/profile?tab=billing',
   kind==='winback'?'Προσφορά 1,99 € για τον πρώτο μήνα, 3,99 €/μήνα μετά. Ισχύει μία φορά ανά λογαριασμό.':''].filter(Boolean).join('\n')};
}
module.exports={PREMIUM_BENEFITS,premiumBillingEmail,fmt};
