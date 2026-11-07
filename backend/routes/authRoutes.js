const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const User = require('../models/User'); // Ίσως χρειαστεί για το reminder route

// Auth & OTP
router.get('/auth/verify-vat/:countryCode/:vat', authController.verifyVat);
router.post('/auth/register', authController.register);
router.post('/auth/register-broadcaster', authController.registerBroadcaster);
router.post('/auth/register-agency', authController.registerAgency); 
router.post('/auth/verify-otp', authController.verifyOtp);
router.post('/auth/login', authController.login);
router.get('/auth/me', authController.getMe);

// 🟢 ΑΝΑΚΤΗΣΗ ΚΩΔΙΚΟΥ
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

// 🟢 ΑΠΟΔΟΧΗ ΟΡΩΝ ΧΡΗΣΗΣ (Καλεί τον authController, όχι τον userController)
router.put('/users/me/accept-terms', authController.acceptTerms);

// Users Profiles
router.put('/users/me', authController.updateMe);
router.delete('/users/me', authController.deleteMe); // ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ
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
