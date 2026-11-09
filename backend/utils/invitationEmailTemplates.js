'use strict';
const { renderBrandedEmail, actionButton, infoPanel, escapeHtml } = require('./emailDesign');

// Inline-styled table rows retain legibility in Gmail, Outlook and mobile mail.
function broadcasterFeature(number, title, description, accessNote = '') {
  return '<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;margin:0 0 12px;">' +
    '<tr><td valign="top" width="45" style="width:45px;padding:17px 0 17px 16px;background:#0C1520;border-top:1px solid #283647;border-bottom:1px solid #283647;border-left:1px solid #283647;border-radius:15px 0 0 15px;">' +
    '<span style="color:#CCFF00;font-size:12px;font-weight:800;">' + escapeHtml(number) + '</span></td>' +
    '<td valign="top" style="padding:15px 16px 15px 2px;background:#0C1520;border-top:1px solid #283647;border-right:1px solid #283647;border-bottom:1px solid #283647;border-radius:0 15px 15px 0;">' +
    '<p style="color:#F6F8FF!important;font-weight:800;font-size:15px;line-height:22px;margin:0 0 5px;">' + escapeHtml(title) + '</p>' +
    '<p style="color:#B7C4D4!important;font-size:13px;line-height:21px;margin:0;">' + escapeHtml(description) + '</p>' +
    (accessNote ? '<p style="color:#CCFF00!important;font-size:11px;font-weight:700;line-height:18px;margin:8px 0 0;">' + escapeHtml(accessNote) + '</p>' : '') +
    '</td></tr></table>';
}

function broadcasterInvitationEmail(station, link) {
  const name = String(station?.name || 'Ο σταθμός σου');
  const benefits = [
    ['01', 'Εβδομαδιαίο πρόγραμμα & μεγαλύτερη προβολή',
      'Πρόσθεσε ημέρες, ώρες, εκπομπές και φωτογραφίες παραγωγών. Έτσι ο σταθμός και οι εκπομπές σου μπορούν να προβάλλονται σωστά στις αρχικές ενότητες «Για σένα» και «Στον αέρα τώρα», όπου πληρούνται οι προϋποθέσεις εμφάνισης.'],
    ['02', 'Boost: προώθησε τον σταθμό σου',
      'Αξιοποίησε την προαιρετική λειτουργία Boost για επιπλέον προβολή στο δίκτυο, ανά κατηγορία ή συνολικά.',
      'Προαιρετική υπηρεσία · με τις εκάστοτε διαθέσιμες χρεώσεις'],
    ['03', 'iRadios Audio Engine / Web DSP',
      'Διάλεξε DSP presets για πιο ομοιόμορφο και ξεκούραστο ήχο στον υποστηριζόμενο iRadios player.',
      'Η λειτουργία διατίθεται σε επιλέξιμα προγράμματα Broadcaster'],
    ['04', 'Διαχείριση του σταθμού από το δικό σου account',
      'Επεξεργάσου λογότυπο, πληροφορίες, κατηγορία, περιοχή, stream, social links και στοιχεία επικοινωνίας μέσα από το Broadcaster Backoffice.'],
    ['05', 'Live Analytics: ακροατές σε πραγματικό χρόνο',
      'Δες πόσοι ακροατές ακούνε τον σταθμό σου εκείνη τη στιγμή και πρόσθετα στοιχεία ακροαματικότητας στο Broadcaster Studio.',
      'Η πρόσβαση στα Live Analytics απαιτεί ενεργοποιημένη υπηρεσία'],
    ['06', 'Πρόγραμμα, παραγωγοί & συνεργασίες',
      'Οργάνωσε τις εκπομπές σου και προσκάλεσε παραγωγούς για να συνεργάζονται στη διαχείριση του προγράμματος.'],
    ['07', 'Web Player Widget για το website σου',
      'Ενσωμάτωσε τον player του σταθμού στο δικό σου website. Οι διαθέσιμες λειτουργίες εξαρτώνται από το πρόγραμμά σου.']
  ];
  const cards = benefits.map(item => broadcasterFeature(...item));
  const content =
    '<h3>Ο σταθμός σου. Στο επίκεντρο.</h3>' +
    '<p>Έχεις λάβει <strong>προσωπική πρόσκληση</strong> για να αναλάβεις τη διαχείριση του <strong>' +
      escapeHtml(name) + '</strong> στο iRadiosGR.</p>' +
    infoPanel('ΣΤΑΘΜΟΣ ΠΡΟΣ ΑΝΑΘΕΣΗ', name, { highlight: true }) +
    '<p>Με τον δικό σου λογαριασμό <strong>Broadcaster</strong> διαχειρίζεσαι τον σταθμό, το πρόγραμμα και τις δυνατότητες προβολής του από ένα Backoffice.</p>' +
    actionButton('Δημιουργία λογαριασμού & αποδοχή', link) +
    '<h3 style="font-size:21px;margin:32px 0 15px;">Τι μπορείς να κάνεις στο iRadiosGR</h3>' +
    cards.slice(0, 3).join('') +
    '<p style="color:#F6F8FF!important;font-size:14px;font-weight:800;margin:20px 0 5px;">Έτοιμος να αξιοποιήσεις αυτές τις δυνατότητες;</p>' +
    actionButton('Ενεργοποίησε τον σταθμό σου', link) +
    cards.slice(3).join('') +
    '<h3 style="font-size:21px;margin:32px 0 14px;">Πώς ξεκινάς</h3>' +
    '<p><strong>1.</strong> Άνοιξε το προσωπικό κουμπί ενεργοποίησης παρακάτω.</p>' +
    '<p><strong>2.</strong> Δημιούργησε λογαριασμό Broadcaster ή συνδέσου με το <strong>ίδιο email</strong> που έλαβε την πρόσκληση. Επαλήθευσε το email σου, αν χρειάζεται.</p>' +
    '<p><strong>3.</strong> Συμπλήρωσε τα στοιχεία Broadcaster και αποδέξου τους ισχύοντες όρους.</p>' +
    '<p><strong>4.</strong> Ο σταθμός θα προστεθεί αυτόματα στο Broadcaster Backoffice. Ξεκίνα από το προφίλ και το εβδομαδιαίο πρόγραμμα.</p>' +
    actionButton('Αποδοχή πρόσκλησης & έναρξη', link) +
    '<p style="color:#95A2B5!important;font-size:12px;line-height:20px;margin-top:22px;">' +
    'Ο προσωπικός σύνδεσμος ισχύει για <strong>7 ημέρες</strong> και χρησιμοποιείται <strong>μία φορά</strong>. ' +
    'Μην τον κοινοποιείς. Αν δεν περίμενες αυτή την πρόσκληση, αγνόησε το μήνυμα.</p>';
  const text = [
    'Ο σταθμός σου. Στο επίκεντρο. | iRadiosGR',
    '',
    'Έχεις προσωπική πρόσκληση να διαχειριστείς τον σταθμό ' + name + ' στο iRadiosGR.',
    'ΔΗΜΙΟΥΡΓΙΑ ΛΟΓΑΡΙΑΣΜΟΥ & ΑΠΟΔΟΧΗ:',
    link,
    '',
    'ΤΙ ΜΠΟΡΕΙΣ ΝΑ ΚΑΝΕΙΣ:',
    '1. Εβδομαδιαίο πρόγραμμα: πρόσθεσε εκπομπές, ώρες, παραγωγούς και φωτογραφίες για καλύτερη προβολή στα «Για σένα» και «Στον αέρα τώρα», όπου ο σταθμός είναι επιλέξιμος.',
    '2. Boost: προαιρετική προώθηση ανά κατηγορία ή στο δίκτυο, με διαθέσιμες χρεώσεις.',
    '3. iRadios Audio Engine / Web DSP: presets για βελτιωμένο ήχο στον υποστηριζόμενο player (σε επιλέξιμα προγράμματα).',
    '',
    'ΕΝΕΡΓΟΠΟΙΗΣΕ ΤΟΝ ΣΤΑΘΜΟ ΣΟΥ:',
    link,
    '',
    '4. Διαχείριση: άλλαξε προφίλ, λογότυπο, κατηγορία, περιοχή, stream και social links.',
    '5. Live Analytics: δες τους ενεργούς ακροατές και στατιστικά, εφόσον έχεις ενεργοποιήσει την υπηρεσία.',
    '6. Συνεργάτες: οργάνωσε εκπομπές και προσκάλεσε παραγωγούς στη διαχείριση του προγράμματος.',
    '7. Web player: ενσωμάτωσε widget του σταθμού στο δικό σου website.',
    '',
    'ΠΩΣ ΞΕΚΙΝΑΣ:',
    '1. Άνοιξε το προσωπικό link πρόσκλησης.',
    '2. Δημιούργησε λογαριασμό Broadcaster ή συνδέσου με το ίδιο email. Επαλήθευσέ το αν χρειάζεται.',
    '3. Συμπλήρωσε τα στοιχεία σου και αποδέξου τους όρους Broadcaster.',
    '4. Ο σταθμός θα εμφανιστεί στο Backoffice. Ξεκίνα με το προφίλ και το εβδομαδιαίο πρόγραμμα.',
    '',
    'ΑΠΟΔΟΧΗ ΠΡΟΣΚΛΗΣΗΣ:',
    link,
    '',
    'Ο σύνδεσμος λήγει σε 7 ημέρες, χρησιμοποιείται μία φορά και δεν πρέπει να κοινοποιηθεί.',
    'Αν δεν περίμενες πρόσκληση, αγνόησε αυτό το μήνυμα.'
  ].join('\n');
  return {
    subject: 'Πρόσκληση διαχείρισης ' + name + ' | iRadiosGR',
    text,
    html: renderBrandedEmail({
      preheader: 'Το προσωπικό σου Broadcaster Backoffice: πρόγραμμα, Boost, DSP και Live Analytics για τον ' + name,
      category: 'BROADCASTER · YOUR STATION',
      content
    })
  };
}

function producerInvitationEmail({ firstName, stationName, link }) {
  const name = String(stationName || 'Radio Station');
  const person = String(firstName || 'Producer');
  const content =
    '<h3>Καλωσήρθες στην ομάδα!</h3>' +
    '<p>Γεια σου <strong>' + escapeHtml(person) + '</strong>.</p>' +
    '<p>Έχεις προσκληθεί να συνεργαστείς ως Producer για το πρόγραμμα του σταθμού.</p>' +
    infoPanel('RADIO STATION', name, { highlight: true }) +
    '<p>Ενεργοποίησε τον προσωπικό λογαριασμό σου και όρισε κωδικό για να αποκτήσεις ' +
    'πρόσβαση στο πρόγραμμα του σταθμού μέσω του iRadiosGR.</p>' +
    actionButton('Αποδοχή πρόσκλησης', link) +
    '<p style="color:#95A2B5;font-size:12px;line-height:20px;">' +
    'Ο σύνδεσμος ενεργοποίησης ισχύει για 7 ημέρες και χρησιμοποιείται μία φορά.</p>';
  return {
    subject: 'Πρόσκληση Producer · ' + name + ' | iRadiosGR',
    text: 'Γεια σου ' + person + '. Προσκλήθηκες στο πρόγραμμα του σταθμού ' +
      name + '. Αποδοχή πρόσκλησης: ' + link + '\nΟ σύνδεσμος ισχύει για 7 ημέρες.',
    html: renderBrandedEmail({
      preheader: 'Πρόσκληση Producer στον ' + name,
      category: 'PRODUCER · YOUR RADIO TEAM',
      content
    })
  };
}

module.exports = { broadcasterInvitationEmail, producerInvitationEmail };
