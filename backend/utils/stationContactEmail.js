'use strict';
const { renderBrandedEmail, escapeHtml, infoPanel } = require('./emailDesign');

function buildStationContactEmail({ stationName, senderName, senderEmail, message }) {
  const safeStation = String(stationName || 'Ραδιοφωνικός σταθμός').replace(/[\r\n]/g, ' ').slice(0, 100);
  const safeName = String(senderName || 'Ακροατής').replace(/[\r\n]/g, ' ').slice(0, 120);
  const safeEmail = String(senderEmail || '').replace(/[\r\n]/g, '').slice(0, 254);
  const safeMessage = String(message || '').trim();
  const content =
    '<p style="margin:0 0 18px;line-height:1.7;color:#C5CDD9">Έλαβες νέο μήνυμα από ακροατή μέσω του iRadiosGR για τον σταθμό <strong>' +
    escapeHtml(safeStation) + '</strong>.</p>' +
    infoPanel('Όνομα αποστολέα', safeName) +
    infoPanel('Email · Reply-To', safeEmail, { highlight:true }) +
    '<div style="margin:22px 0;padding:22px;border:1px solid #33404A;border-radius:18px;background:#0C121C">' +
    '<p style="color:#99A7B8;font-size:11px;font-weight:800;letter-spacing:1.4px">ΤΟ ΜΗΝΥΜΑ</p>' +
    '<p style="color:#F4F7FB;font-size:15px;line-height:1.75;overflow-wrap:anywhere;margin:0">' +
    escapeHtml(safeMessage).replace(/\r?\n/g, '<br>') + '</p></div>' +
    '<p style="color:#A9B8C3;font-size:13px;line-height:1.7">Πάτησε «Απάντηση» για να απαντήσεις απευθείας στον ακροατή.</p>';
  return {
    subject: 'iRadiosGR · Νέο μήνυμα για ' + safeStation,
    text: 'Μήνυμα μέσω iRadiosGR για ' + safeStation + '\nΑποστολέας: ' + safeName +
      '\nEmail: ' + safeEmail + '\n\nΜήνυμα:\n' + safeMessage +
      '\n\nΑπάντησε στο email για να επικοινωνήσεις με τον αποστολέα.',
    html: renderBrandedEmail({
      category:'STATION CONNECT', headline:'Έχεις νέο μήνυμα!',
      preheader:'Επικοινωνία ακροατή από το iRadiosGR',
      footerNote:'Το Reply-To έχει οριστεί στη διεύθυνση του ακροατή.',
      content
    })
  };
}
module.exports = { buildStationContactEmail };
