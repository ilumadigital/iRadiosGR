'use strict';
const { renderBrandedEmail, actionButton, infoPanel, escapeHtml } = require('./emailDesign');

function broadcasterInvitationEmail(station, link) {
  const name = String(station?.name || 'Ο σταθμός σου');
  const content =
    '<h3>Ο σταθμός σου. Το δικό σου studio.</h3>' +
    '<p>Έχεις λάβει μία προσωπική πρόσκληση για τη διαχείριση του <strong>' +
      escapeHtml(name) + '</strong> στο iRadiosGR.</p>' +
    infoPanel('ΣΤΑΘΜΟΣ ΠΡΟΣ ΑΝΑΘΕΣΗ', name, { highlight: true }) +
    '<p>Δημιούργησε ή σύνδεσε τον λογαριασμό σου ως Broadcaster, επαλήθευσε το email σου ' +
    'και αποδέξου τους όρους. Ο σταθμός και τα υπάρχοντα στοιχεία του θα εμφανιστούν ' +
    'αυτόματα στο Broadcaster Backoffice.</p>' +
    actionButton('Αποδοχή πρόσκλησης', link) +
    '<p style="color:#95A2B5;font-size:12px;line-height:20px;margin-top:23px;">' +
    'Ο προσωπικός σύνδεσμος ισχύει για <strong>7 ημέρες</strong> και μπορεί να χρησιμοποιηθεί μία φορά. ' +
    'Αν δεν περίμενες αυτή την πρόσκληση, αγνόησε το μήνυμα.</p>';
  return {
    subject: 'Πρόσκληση διαχείρισης ' + name + ' | iRadiosGR',
    text: 'Έχεις προσκληθεί να διαχειριστείς τον σταθμό ' + name +
      ' στο iRadiosGR. Ολοκλήρωσε την εγγραφή ως broadcaster, επιβεβαίωσε το email και αποδέξου τους όρους: ' +
      link + '\nΟ σύνδεσμος λήγει σε 7 ημέρες. Αν δεν περίμενες πρόσκληση, αγνόησε το μήνυμα.',
    html: renderBrandedEmail({
      preheader: 'Προσωπική πρόσκληση για τον σταθμό ' + name,
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
