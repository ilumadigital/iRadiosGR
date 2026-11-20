'use strict';
const {
  renderBrandedEmail, actionButton, escapeHtml, verifiedHref
} = require('./emailDesign');

const CATEGORIES = Object.freeze({
  newStations: 'DISCOVER · NEW STATIONS',
  favoriteSchedule: 'YOUR RADIO · SCHEDULE',
  shows: 'FOLLOWING · ON AIR',
  news: 'IRADIOSGR · NEWS',
  promotions: 'IRADIOSGR · EXCLUSIVES'
});

function notificationEmailTemplate({ topic, title, body, link, profileLink, unsubscribeLink = '' }) {
  const profileHref = verifiedHref(profileLink);
  const unsubscribeHref = verifiedHref(unsubscribeLink);
  const safeTitle = String(title || '').slice(0,140);
  const safeBody = String(body || '').slice(0,600);
  const unsubscribeSection = topic === 'promotions' && unsubscribeHref !== '#'
    ? '<p style="margin-top:24px;color:#94A3B8;font-size:12px;line-height:20px;">' +
      'Προωθητικό μήνυμα · <a href="' + escapeHtml(unsubscribeHref) +
      '" style="color:#CCFF00;text-decoration:underline;">Διακοπή προωθητικών email</a></p>'
    : '';
  const preferences = profileHref !== '#'
    ? '<p style="color:#94A3B8;font-size:12px;line-height:20px;">' +
      'Διάλεξε ποιες ενημερώσεις θέλεις να λαμβάνεις από ' +
      '<a href="' + escapeHtml(profileHref) +
      '" style="color:#CCFF00;text-decoration:none;">το προφίλ σου</a>.</p>'
    : '';

  return renderBrandedEmail({
    preheader: safeBody.slice(0,115),
    category: CATEGORIES[topic] || 'IRADIOSGR · UPDATE',
    content:
      '<h3>' + escapeHtml(safeTitle) + '</h3>' +
      '<p>' + escapeHtml(safeBody).replace(/\r?\n/g, '<br>') + '</p>' +
      actionButton('Άνοιγμα στο iRadiosGR', link) +
      preferences + unsubscribeSection
  });
}

module.exports = { notificationEmailTemplate };
