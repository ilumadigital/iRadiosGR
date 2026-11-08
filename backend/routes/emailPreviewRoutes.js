'use strict';
const express = require('express');
const { protect } = require('../utils/authMiddleware');
const { authorizeRoles } = require('../utils/roleMiddleware');
const {
  otpVerificationEmail, welcomeEmail, customAdminEmail, passwordResetEmail,
  adPaymentSuccessEmail, adminTransactionAlertEmail, stationApprovedEmail,
  stationRejectedEmail, broadcasterPremiumSuccessEmail, listenerPremiumSuccessEmail
} = require('../utils/mailTemp');
const { broadcasterInvitationEmail, producerInvitationEmail } =
  require('../utils/invitationEmailTemplates');
const { notificationEmailTemplate } = require('../utils/notificationEmailTemplate');
const { siteOrigin, renderBrandedEmail, escapeHtml } = require('../utils/emailDesign');

const router = express.Router();
const sample = Object.freeze({
  broadcasterInvite: 'Πρόσκληση Broadcaster',
  producerInvite: 'Πρόσκληση Producer',
  otp: 'Επαλήθευση OTP',
  welcome: 'Καλωσόρισμα',
  passwordReset: 'Επαναφορά κωδικού',
  adPayment: 'Πληρωμή διαφήμισης',
  adminTransaction: 'Ενημέρωση διαχειριστή',
  stationApproved: 'Έγκριση σταθμού',
  stationRejected: 'Διόρθωση σταθμού',
  broadcasterPremium: 'Premium Broadcaster',
  listenerPremium: 'Premium Listener',
  notification: 'Ειδοποίηση χρήστη',
  custom: 'Email διαχειριστή'
});
const demo = () => siteOrigin() + '/login';
function previewTemplate(type, body) {
  const station = { name: 'iRadiosGR Demo FM' };
  const inviteUrl = siteOrigin() + '/broadcaster-invite?token=preview-only';
  switch (type) {
    case 'broadcasterInvite': return broadcasterInvitationEmail(station, inviteUrl);
    case 'producerInvite': return producerInvitationEmail({
      firstName: 'Αλέξανδρε', stationName: station.name,
      link: siteOrigin() + '/accept-invite?token=preview-only'
    });
    case 'otp': return otpVerificationEmail('Αλέξανδρε', '123456');
    case 'welcome': return welcomeEmail('Αλέξανδρε', false);
    case 'passwordReset': return passwordResetEmail('Αλέξανδρε', demo());
    case 'adPayment': return adPaymentSuccessEmail('Αλέξανδρε', 'iRadios Ad Network', '49.00');
    case 'adminTransaction': return adminTransactionAlertEmail('Demo Radio', '149.00',
      'iRadios Business', 'demo@example.com', 'broadcaster');
    case 'stationApproved': return stationApprovedEmail('Αλέξανδρε', station.name, 'demo-radio');
    case 'stationRejected': return stationRejectedEmail('Αλέξανδρε', station.name);
    case 'broadcasterPremium': return broadcasterPremiumSuccessEmail('Αλέξανδρε', 'full_premium', '19.00');
    case 'listenerPremium': return listenerPremiumSuccessEmail('Αλέξανδρε', '4.99');
    case 'notification': return {
      subject:'Η αγαπημένη σου εκπομπή είναι στον αέρα',
      html:notificationEmailTemplate({
        topic:'shows',title:'Η αγαπημένη σου εκπομπή είναι στον αέρα',
        body:'Συντονίσου τώρα στον σταθμό σου και απόλαυσε τη ζωντανή εκπομπή.',
        link:siteOrigin(),profileLink:siteOrigin()+'/profile'
      })
    };
    case 'custom': {
      const subject = typeof body?.subject === 'string' && body.subject.trim()
        ? body.subject.trim().slice(0,160) : 'Νέα ενημέρωση από το iRadiosGR';
      const text = typeof body?.body === 'string' && body.body.trim()
        ? body.body.slice(0,15000)
        : '<h3>Το iRadiosGR είναι εδώ.</h3><p>Το δοκιμαστικό σου email θα εμφανίζεται με αυτό το design.</p>';
      return { subject, html:customAdminEmail(text) };
    }
    default: return null;
  }
}

router.post('/admin/emails/preview', protect, authorizeRoles('admin'), (req,res) => {
  const type = typeof req.body?.type === 'string' ? req.body.type : '';
  if (!Object.hasOwn(sample,type)) return res.status(400).json({error:'Μη έγκυρο email template.'});
  try {
    const result = previewTemplate(type,req.body);
    res.set('Cache-Control','no-store');
    return res.json({
      title:sample[type], subject:result.subject,
      html:result.html,
      isDemo: type !== 'custom'
    });
  } catch (error) {
    console.error('[EMAIL PREVIEW] Failed:',error.message);
    return res.status(500).json({error:'Η προεπισκόπηση δεν είναι διαθέσιμη.'});
  }
});

module.exports = router;
