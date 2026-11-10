const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const center = require('../controllers/listenerCenterController');
const User = require('../models/User'); // Ίσως χρειαστεί για το reminder route
const { protect } = require('../utils/authMiddleware');

// Auth & OTP
router.get('/auth/verify-vat/:countryCode/:vat', authController.verifyVat);
const {requireTurnstile,isConfigured,siteKey}=require('../utils/turnstile');
router.get('/auth/turnstile-config', (_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json({siteKey:isConfigured()?siteKey():null,ready:isConfigured()});
});
router.post('/auth/register', requireTurnstile('register'), authController.register);
router.post('/auth/register-broadcaster', requireTurnstile('register-broadcaster'), authController.registerBroadcaster);
router.post('/auth/register-agency', requireTurnstile('register-agency'), authController.registerAgency);
router.post('/auth/verify-otp', authController.verifyOtp);
router.post('/auth/verify-email', authController.verifyEmail);
router.post('/auth/resend-verification', protect, authController.resendVerificationEmail);
router.post('/auth/login', requireTurnstile('login'), authController.login);
router.get('/auth/me', protect, authController.getMe);

// 🟢 ΑΝΑΚΤΗΣΗ ΚΩΔΙΚΟΥ
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

// 🟢 ΑΠΟΔΟΧΗ ΟΡΩΝ ΧΡΗΣΗΣ (Καλεί τον authController, όχι τον userController)
router.put('/users/me/accept-terms', protect, authController.acceptTerms);

// Users Profiles
router.put('/users/me', protect, authController.updateMe);
router.get('/users/me/notification-preferences', protect, authController.getNotificationPreferences);
router.patch('/users/me/notification-preferences', protect, authController.updateNotificationPreferences);
router.get('/users/me/follows', protect, center.listFollows);
router.post('/users/me/follows', protect, center.follow);
router.delete('/users/me/follows/:id', protect, center.unfollow);
router.get('/users/me/inbox/count', protect, center.unreadCount);
router.get('/users/me/inbox', protect, center.inbox);
router.post('/users/me/inbox/read-all', protect, center.markAllRead);
router.post('/users/me/inbox/:id/read', protect, center.markRead);
router.delete('/users/me/inbox/:id', protect, center.remove);
router.delete('/users/me/inbox', protect, center.clear);
router.delete('/users/me', protect, authController.deleteMe); // ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ
router.post('/users/:userId/favorites', authController.toggleFavorite);

// POST /api/reminders/toggle
router.post('/reminders/toggle', async (req, res) => {
  try {
    const { userId, stationId, showTitle, day, startTime } = req.body;

    if (!userId || !stationId || !showTitle || day === undefined || !startTime) {
      return res.status(400).json({ error: "Λείπουν απαραίτητα δεδομένα." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "Ο χρήστης δεν βρέθηκε." });

    const existingReminderIndex = user.reminders.findIndex(
      r => r.showTitle === showTitle && r.day === day && r.startTime === startTime
    );

    if (existingReminderIndex >= 0) {
      user.reminders.splice(existingReminderIndex, 1);
      await user.save();
      return res.json({ success: true, action: 'removed', reminders: user.reminders });
    } else {
      user.reminders.push({ stationId, showTitle, day, startTime });
      await user.save();
      return res.json({ success: true, action: 'added', reminders: user.reminders });
    }

  } catch (error) {
    console.error("Σφάλμα στο Toggle Reminder:", error);
    res.status(500).json({ error: "Σφάλμα διακομιστή" });
  }
});

module.exports = router;
