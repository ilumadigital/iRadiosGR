'use strict';
const {getProduct}=require('../config/billingCatalog');
const {renderBrandedEmail,escapeHtml,actionButton,infoPanel,siteOrigin}=
 require('./emailDesign');
const euro=cents=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(Number(cents)/100);
const formatDate=value=>{
 const when=new Date(value);
 return Number.isFinite(+when)?new Intl.DateTimeFormat('el-GR',{
  dateStyle:'long',timeStyle:'short',timeZone:'Europe/Athens'
 }).format(when):'—';
};
const BENEFITS=Object.freeze([
 ['Σταθμοί χωρίς περιορισμό','Διαχειρίσου τους εγκεκριμένους σταθμούς του λογαριασμού σου.'],
 ['WebDSP Audio Engine','Εργαλεία επεξεργασίας και βελτιστοποίησης ήχου ανά σταθμό.'],
 ['Audience Radar Analytics','Live ακροατές, ιστορικές και ενεργές περιοχές και στατιστικά ακρόασης.'],
 ['iRadios Ad Control','Έλεγχος των διαθέσιμων διαφημιστικών δυνατοτήτων του σταθμού.'],
 ['Premium Boost','Επίλεξε τους σταθμούς σου που θα έχουν Premium Boost. Τα αγορασμένα Boost έχουν μεγαλύτερη προτεραιότητα.']
]);
function benefits(){
 return '<div style="border-radius:18px;background:#141D19;border:1px solid #39442C;padding:18px 21px;margin:18px 0;">'+
 '<p style="font-size:12px;font-weight:800;color:#CCFF00;letter-spacing:1px;">ΤΑ PRO ΠΡΟΝΟΜΙΑ ΣΟΥ</p>'+
 BENEFITS.map(([title,description])=>'<p style="font-size:13px;color:#CCD5DD;line-height:1.6;">'+
 '<strong style="color:#FFFFFF;">'+escapeHtml(title)+'</strong><br>'+escapeHtml(description)+'</p>').join('')+
 '</div>';
}
function broadcasterBillingEmail({kind,sku,name='',stationName=null,amountCents,periodEndsAt,
 cancelledAt=null}={}){
 const product=getProduct(sku);
 if(!product||!['B-PREM','ADD-DSP','ADD-AN','ADD-ADS'].includes(sku)&&
    !sku.startsWith('BOOST-'))throw Error('Unrecognized Broadcaster billing product');
 if(!['welcome','renewed','failed','cancelled','soon','expired'].includes(kind))throw Error('Unknown billing email type');
 if(product.kind==='boost'&&['renewed','failed','cancelled'].includes(kind))
  throw Error('One-off Boost must not get recurring billing messages');
 const title=product.title;
 const resource=product.scopeType==='station'?escapeHtml(stationName||'Ο σταθμός σου'):'Όλος ο λογαριασμός';
 const who=escapeHtml(name||'συνεργάτη');
 const manage=actionButton('Οι συνδρομές μου',siteOrigin()+'/backoffice/billing');
 const features=actionButton('Δες τα Pro Features',siteOrigin()+'/backoffice/pro-features');
 const oneoff=product.kind==='boost';
 const amount=euro(amountCents);
 const end=formatDate(periodEndsAt);
 const term=oneoff?'Εφάπαξ αγορά — δεν πραγματοποιούνται αυτόματες ανανεώσεις.':
  'Επαναλαμβανόμενη μηνιαία συνδρομή μέχρι ακύρωσης από το Backoffice.';
 const line='<p><strong>Προϊόν:</strong> '+escapeHtml(title)+' ('+escapeHtml(sku)+')</p>'+
  '<p><strong>Εφαρμογή:</strong> iRadiosGR · <strong>Σταθμός:</strong> '+resource+'</p>';
 let subject='',headline='',content='';
 if(kind==='welcome'){
  subject=oneoff?'Το Boost του σταθμού σου ενεργοποιήθηκε!':
   'Καλωσόρισες στο iRadios GR Broadcaster Pro!';
  headline=oneoff?'Το Boost σου είναι ενεργό':'Τα Broadcaster Pro εργαλεία σου ενεργοποιήθηκαν';
  content='<p>Γεια σου <strong>'+who+'</strong>, η Nexi επιβεβαίωσε την αγορά σου και το iRadios ενεργοποίησε τις δυνατότητες που αγόρασες.</p>'+
    infoPanel('Επιβεβαιωμένη πληρωμή',amount,{highlight:true})+
    line+'<p><strong>Πληρωμένη πρόσβαση έως:</strong> '+escapeHtml(end)+'</p>'+
    '<p>'+escapeHtml(term)+'</p>'+
    (sku==='B-PREM'?benefits():oneoff?
     '<p>Η προβολή λήγει στην παραπάνω ημερομηνία. Αν έχεις ενεργό Broadcaster Premium, το αγορασμένο Boost έχει μεγαλύτερη προτεραιότητα στην αντίστοιχη θέση.</p>':
     '<p>Το συγκεκριμένο add-on ενεργοποιείται για αυτόν τον σταθμό. Τα υπόλοιπα Pro Features παραμένουν διαθέσιμα ξεχωριστά ή μέσα στο Broadcaster Premium.</p>')+
    manage+features;
 }else if(kind==='renewed'){
  subject='Επιτυχής μηνιαία ανανέωση iRadios Broadcaster';
  headline='Η συνδρομή σου ανανεώθηκε';
  content='<p>Γεια σου <strong>'+who+'</strong>, η νέα μηνιαία χρέωση επιβεβαιώθηκε από τη Nexi.</p>'+
   infoPanel('Πληρωμή ανανέωσης',amount,{highlight:true})+line+
   '<p><strong>Πληρωμένη περίοδος έως:</strong> '+escapeHtml(end)+'</p>'+
   '<p>Μπορείς να ελέγξεις ή να ακυρώσεις την επόμενη αυτόματη ανανέωση μέσα από το Backoffice.</p>'+manage;
 }else if(kind==='failed'){
  subject='Προσοχή: αποτυχημένη ανανέωση iRadios Broadcaster';
  headline='Η τελευταία αυτόματη χρέωση δεν ολοκληρώθηκε';
  content='<p>Γεια σου <strong>'+who+'</strong>, η Nexi δεν επιβεβαίωσε την τελευταία αυτόματη ανανέωση αυτής της συνδρομής.</p>'+
    line+infoPanel('Τελευταία επιβεβαιωμένη πληρωμένη περίοδος',end,{highlight:true})+
    '<p><strong>Δεν ενεργοποιήθηκε νέα πληρωμένη περίοδος.</strong> Τα ήδη πληρωμένα προνόμιά σου παραμένουν διαθέσιμα μέχρι τη λήξη της προηγούμενης περιόδου.</p>'+
    '<p>Η αυτόματη προσπάθεια δεν θα επαναλαμβάνεται ανεξέλεγκτα. Έλεγξε την κατάσταση της συνδρομής σου μέσα από το Backoffice για τα επόμενα βήματα.</p>'+manage;
 }else if(kind==='cancelled'){
  subject='Επιβεβαίωση ακύρωσης αυτόματης ανανέωσης Broadcaster';
  headline='Η αυτόματη ανανέωση ακυρώθηκε';
  content='<p>Γεια σου <strong>'+who+'</strong>, επιβεβαιώθηκε η διακοπή αυτόματης ανανέωσης για την παρακάτω συνδρομή.</p>'+
   line+'<p><strong>Δεν θα πραγματοποιηθούν νέες αυτόματες χρεώσεις</strong> για αυτή τη συνδρομή.</p>'+
   '<p>Η ήδη πληρωμένη περίοδος διατηρείται μέχρι '+escapeHtml(end)+'.</p>'+
   (cancelledAt?'<p><strong>Ακύρωση:</strong> '+escapeHtml(formatDate(cancelledAt))+'</p>':'')+manage;
 }else if(kind==='soon'){
  subject=oneoff?'Το Boost του σταθμού σου λήγει σύντομα':
   'Η συνδρομή Broadcaster λήγει σύντομα';
  headline=oneoff?'Το Boost σου λήγει σύντομα':'Η συνδρομή σου πλησιάζει στη λήξη';
  content='<p>Γεια σου <strong>'+who+'</strong>, η πληρωμένη περίοδος ολοκληρώνεται σύντομα.</p>'+
   line+infoPanel('Λήξη',end,{highlight:true})+
   (oneoff?'<p>Το Boost είναι εφάπαξ. Δεν θα δημιουργηθεί νέα χρέωση αυτόματα.</p>':
    '<p>Δες την κατάσταση της μηνιαίας ανανέωσης στο Backoffice. Δεν χρειάζεται νέα αγορά αν υπάρχει ενεργή ανανέωση.</p>')+
   manage;
 }else{
  subject=oneoff?'Το αγορασμένο Boost έληξε':'Η συνδρομή Broadcaster έληξε';
  headline=oneoff?'Η προβολή Boost ολοκληρώθηκε':'Τα πληρωμένα προνόμια ολοκληρώθηκαν';
  content='<p>Γεια σου <strong>'+who+'</strong>, η αγορασμένη περίοδος έληξε.</p>'+
   line+infoPanel('Ημερομηνία λήξης',end)+
   '<p>Αν υπάρχει άλλο ενεργό add-on, Broadcaster Premium ή δωρεάν παραχώρηση από διαχειριστή, τα αντίστοιχα προνόμια παραμένουν διαθέσιμα. Δεν αφαιρούνται ρυθμίσεις ή περιεχόμενο του σταθμού.</p>'+
   manage+features;
 }
 const sandbox='<p style="color:#96A3B4;font-size:12px;">Αυτή η ενημέρωση προέρχεται από το περιβάλλον Nexi Sandbox του iRadiosGR. Δεν αποτελεί φορολογικό παραστατικό.</p>';
 return {subject,html:renderBrandedEmail({category:'IRADIOSGR · BROADCASTER',
  headline,preheader:subject,content:content+sandbox}),
  text:[subject,'Γεια σου '+(name||'συνεργάτη'),title,
   'Σταθμός: '+(stationName||'Όλος ο λογαριασμός'),
   'Ποσό: '+amount,'Πληρωμένη έως: '+end,term,
   'Διαχείριση: '+siteOrigin()+'/backoffice/billing',
   'Nexi Sandbox · Δεν αποτελεί φορολογικό παραστατικό.'].join('\n')};
}
module.exports={broadcasterBillingEmail,BENEFITS};
