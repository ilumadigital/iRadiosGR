'use strict';
const express = require('express');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Station = require('../models/Station');
const User = require('../models/User');
const Invitation = require('../models/BroadcasterInvitation');
const { protect } = require('../utils/authMiddleware');
const { authorizeRoles } = require('../utils/roleMiddleware');
const { hasAcceptedCurrentBroadcasterTerms } = require('../utils/broadcasterTerms');
const { sendEmail } = require('../utils/myMailer');

const router = express.Router();
const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = email => typeof email === 'string' ? email.trim().toLowerCase() : '';
const validEmail = email => email.length <= 254 && emailPattern.test(email);
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
const validToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[c]));

async function findPending(token) {
  if (!validToken(token)) return null;
  return Invitation.findOne({
    tokenHash: tokenHash(token), status: 'pending', expiresAt: { $gt: new Date() }
  }).select('+tokenHash');
}

async function loadUnownedStation(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Station.findOne({ _id: id, broadcasterId: null }).select('_id name logo broadcasterId');
}

function invitationEmail(station, link) {
  const name = escapeHtml(station.name);
  const url = escapeHtml(link);
  return {
    subject: 'Πρόσκληση διαχείρισης ' + station.name + ' | iRadiosGR',
    text: 'Έχεις προσκληθεί να διαχειριστείς τον σταθμό ' + station.name +
      ' στο iRadiosGR. Ολοκλήρωσε την εγγραφή ως broadcaster, επιβεβαίωσε το email και αποδέξου τους όρους: ' +
      link + '\nΟ σύνδεσμος λήγει σε 7 ημέρες. Αν δεν περίμενες πρόσκληση, αγνόησε το μήνυμα.',
    html: '<div style="background:#101114;color:#f6f6f6;padding:36px;font-family:Arial,sans-serif;border-radius:20px">' +
      '<h1 style="color:#ccff00">iRadiosGR</h1><h2>Πρόσκληση Broadcaster</h2>' +
      '<p>Έχεις προσκληθεί να αναλάβεις τη διαχείριση του σταθμού <strong>' + name + '</strong>.</p>' +
      '<p>Για να ενεργοποιηθεί η πρόσβαση, δημιούργησε ή σύνδεσε λογαριασμό Broadcaster, επαλήθευσε το email σου και αποδέξου τους όρους.</p>' +
      '<p><a style="display:inline-block;background:#ccff00;color:#111;padding:15px 23px;border-radius:12px;text-decoration:none;font-weight:bold" href="' + url + '">Αποδοχή πρόσκλησης</a></p>' +
      '<p style="color:#aaa;font-size:12px">Ο σύνδεσμος ισχύει για 7 ημέρες και μία μόνο ανάθεση. Αν δεν αναγνωρίζεις την πρόσκληση, αγνόησε το μήνυμα.</p></div>'
  };
}

async function sendStationInvite(req, res) {
  const email = normalizeEmail(req.body?.email);
  if (!validEmail(email)) return res.status(400).json({ error: 'Δώσε έγκυρο email.' });
  const station = await loadUnownedStation(req.params.id);
  if (!station) return res.status(409).json({ error: 'Ο σταθμός δεν υπάρχει ή διαθέτει ήδη Broadcaster.' });

  const origin = process.env.FRONTEND_URL;
  if (!origin || !/^https:\/\/[a-z\d.-]+(?::\d+)?(?:\/)?$/i.test(origin)) {
    return res.status(503).json({ error: 'Δεν έχει ρυθμιστεί έγκυρο FRONTEND_URL για τις προσκλήσεις.' });
  }

  const secret = crypto.randomBytes(32).toString('hex');
  // Re-inviting invalidates the earlier link; the previous record stays for audit.
  await Invitation.updateMany({ stationId: station._id, status: 'pending' },
    { $set: { status: 'revoked', revokedAt: new Date() } });
  const invitation = await Invitation.create({
    stationId: station._id, email, tokenHash: tokenHash(secret), status: 'pending',
    expiresAt: new Date(Date.now() + INVITE_LIFETIME_MS), invitedBy: req.user._id
  });
  // Ownership can change while composing/sending. Recheck before delivery.
  if (!(await loadUnownedStation(station._id))) {
    await Invitation.updateOne({ _id: invitation._id }, { $set: { status: 'revoked', revokedAt: new Date() } });
    return res.status(409).json({ error: 'Ο σταθμός έχει ήδη ανατεθεί.' });
  }
  const link = origin.replace(/\/$/, '') + '/broadcaster-invite?token=' + secret;
  const delivery = await sendEmail({ to: email, ...invitationEmail(station, link) });
  if (!delivery.success) {
    await Invitation.updateOne({ _id: invitation._id, status: 'pending' },
      { $set: { status: 'revoked', revokedAt: new Date() } });
    return res.status(502).json({ error: 'Δεν ήταν δυνατή η αποστολή email. Δεν υπάρχει ενεργή πρόσκληση.' });
  }
  return res.status(201).json({
    message: 'Η πρόσκληση στάλθηκε.', invitation: {
      _id: invitation._id, stationId: station._id, email, status: invitation.status,
      expiresAt: invitation.expiresAt, lastSentAt: invitation.lastSentAt
    }
  });
}

router.get('/admin/broadcaster-invitations', protect, authorizeRoles('admin'), async (_req, res) => {
  try {
    const invitations = await Invitation.find().sort({ createdAt: -1 }).limit(1500)
      .select('_id stationId email status expiresAt createdAt lastSentAt invitedBy acceptedBy acceptedAt revokedAt')
      .lean();
    return res.json({ invitations: invitations.map(x => ({
      ...x, status: x.status === 'pending' && new Date(x.expiresAt) <= new Date() ? 'expired' : x.status
    })) });
  } catch (error) {
    return res.status(500).json({ error: 'Αδυναμία φόρτωσης προσκλήσεων.' });
  }
});

router.post('/admin/stations/:id/broadcaster-invitations', protect, authorizeRoles('admin'), async (req, res) => {
  try { return await sendStationInvite(req, res); }
  catch (error) {
    console.error('Broadcaster invite creation:', error);
    return res.status(error.code === 11000 ? 409 : 500).json({
      error: error.code === 11000 ? 'Υπάρχει ήδη ενεργή πρόσκληση. Δοκίμασε ξανά.' : 'Η πρόσκληση απέτυχε.'
    });
  }
});

router.delete('/admin/broadcaster-invitations/:id', protect, authorizeRoles('admin'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Μη έγκυρη πρόσκληση.' });
    const invitation = await Invitation.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { $set: { status: 'revoked', revokedAt: new Date() } }, { new: true }
    );
    if (!invitation) return res.status(409).json({ error: 'Η πρόσκληση δεν είναι πλέον ενεργή.' });
    return res.json({ message: 'Η πρόσκληση ανακλήθηκε.' });
  } catch (error) { return res.status(500).json({ error: 'Η ανάκληση απέτυχε.' }); }
});

// Public token-bound read: no account information, tokens or secrets returned.
router.get('/broadcaster-invitations/preview', async (req, res) => {
  try {
    const invitation = await findPending(req.query.token);
    if (!invitation) return res.status(410).json({ error: 'Η πρόσκληση έχει λήξει ή ακυρωθεί.' });
    const station = await loadUnownedStation(invitation.stationId);
    if (!station) return res.status(409).json({ error: 'Ο σταθμός έχει ήδη διαχειριστή.' });
    return res.json({
      station: { _id: station._id, name: station.name, logo: station.logo },
      email: invitation.email, expiresAt: invitation.expiresAt
    });
  } catch (error) { return res.status(500).json({ error: 'Δεν ήταν δυνατή η επαλήθευση.' }); }
});

// Existing verified listener may explicitly complete a broadcaster registration.
// This does not assign a station and requires separate broadcaster B2B consent.
router.post('/broadcaster-invitations/activate-broadcaster', protect, async (req, res) => {
  try {
    const invitation = await findPending(req.body?.token);
    if (!invitation) return res.status(410).json({ error: 'Η πρόσκληση δεν είναι ενεργή.' });
    const user = req.user;
    if (!user.isVerified || normalizeEmail(user.email) !== invitation.email)
      return res.status(403).json({ error: 'Χρειάζεται επαληθευμένος λογαριασμός με το email της πρόσκλησης.' });
    if (user.role !== 'user') return res.status(409).json({ error: 'Απαιτείται προσωπικός λογαριασμός χρήστη.' });
    if (!(await loadUnownedStation(invitation.stationId)))
      return res.status(409).json({ error: 'Ο σταθμός έχει ήδη διαχειριστή.' });
    const businessType = req.body?.businessType;
    const vatNumber = String(req.body?.vatNumber || '').trim().slice(0,40);
    const companyName = String(req.body?.companyName || '').trim().slice(0,180);
    if (req.body?.confirmBroadcaster !== true || !['individual','company'].includes(businessType) ||
       (businessType === 'company' && (!companyName || vatNumber.length < 8))) {
      return res.status(400).json({ error: 'Συμπλήρωσε τα στοιχεία Broadcaster και επιβεβαίωσε τη μετατροπή.' });
    }
    const updated = await User.findOneAndUpdate(
      { _id: user._id, role: 'user', isVerified: true, email: new RegExp('^' + invitation.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
      { $set: {
        role: 'broadcaster', businessType, vatNumber, companyName,
        hasAcceptedTerms: false, termsAcceptedAt: null, termsAcceptedVersion: null,
        broadcasterProfile: {
          tier:'free', maxStations:3, features:{
            adControl:false,dspEngine:false,betaAccess:false,liveChat:true,analytics:false
          }
        }
      } }, { new: true }
    );
    if (!updated) return res.status(409).json({ error: 'Ο λογαριασμός έχει αλλάξει. Συνδέσου ξανά.' });
    return res.json({ message: 'Ο ρόλος Broadcaster ενεργοποιήθηκε. Αποδέξου τους όρους για την ανάθεση.' });
  } catch (error) {
    console.error('Broadcaster activation:', error);
    return res.status(500).json({ error: 'Η ενεργοποίηση δεν ολοκληρώθηκε.' });
  }
});

// A signed-in verified broadcaster with current B2B consent can claim exactly
// the unowned station named by the emailed link. Neither email nor station ID
// supplied in the request body is trusted.
router.post('/broadcaster-invitations/claim', protect, authorizeRoles('broadcaster'), async (req, res) => {
  try {
    const invitation = await findPending(req.body?.token);
    if (!invitation) return res.status(410).json({ error: 'Η πρόσκληση έληξε ή χρησιμοποιήθηκε.' });
    if (!req.user.isVerified || normalizeEmail(req.user.email) !== invitation.email)
      return res.status(403).json({ error: 'Το επιβεβαιωμένο email πρέπει να ταυτίζεται με την πρόσκληση.' });
    if (!hasAcceptedCurrentBroadcasterTerms(req.user))
      return res.status(403).json({ error: 'Πρέπει πρώτα να αποδεχθείς τους ισχύοντες όρους Broadcaster.', code:'BROADCASTER_TERMS_REQUIRED' });
    const count = await Station.countDocuments({ broadcasterId: req.user._id });
    if (count >= (req.user.broadcasterProfile?.maxStations || 3))
      return res.status(409).json({ error: 'Έχεις συμπληρώσει το όριο σταθμών του λογαριασμού σου.' });

    // Token consumption is compare-and-set, so revoke and claim cannot both win.
    const locked = await Invitation.findOneAndUpdate(
      { _id: invitation._id, status: 'pending', expiresAt: { $gt: new Date() } },
      { $set: { status: 'accepted', acceptedBy: req.user._id, acceptedAt: new Date() } },
      { new: true }
    );
    if (!locked) return res.status(409).json({ error: 'Η πρόσκληση χρησιμοποιήθηκε ή ανακλήθηκε.' });
    const station = await Station.findOneAndUpdate(
      { _id: invitation.stationId, broadcasterId: null },
      { $set: { broadcasterId: req.user._id } }, { new: true }
    ).select('_id name logo broadcasterId');
    if (!station) {
      await Invitation.updateOne({ _id: invitation._id, status: 'accepted', acceptedBy: req.user._id },
        { $set: { status: 'revoked', revokedAt: new Date() }, $unset: { acceptedBy: '', acceptedAt: '' } });
      return res.status(409).json({ error: 'Ο σταθμός δεν είναι πλέον διαθέσιμος.' });
    }
    return res.json({ message: 'Ο σταθμός προστέθηκε στο Broadcaster Backoffice.', station });
  } catch (error) {
    console.error('Broadcaster invitation claim:', error);
    return res.status(500).json({ error: 'Η ανάθεση δεν ολοκληρώθηκε.' });
  }
});

module.exports = router;
