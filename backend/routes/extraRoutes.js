const express = require('express');
const router = express.Router();

const paymentController = require('../controllers/paymentController');
const notificationController = require('../controllers/notificationController');
const analyticsController = require('../controllers/analyticsController');
const miscController = require('../controllers/miscController');

// --- Payments (STRIPE - Νέο Σύστημα) ---
// Εδώ διορθώνουμε τα ονόματα ώστε να ταιριάζουν με τον controller
router.post('/payments/create-stripe-subscription', paymentController.createStripeSubscription);

// --- Payments (SUMUP - Παλιό Σύστημα) ---
// ⚠️ ΠΡΟΣΟΧΗ: Αν έχεις σβήσει τις παλιές συναρτήσεις από τον paymentController, 
// αυτές οι γραμμές πρέπει να μπουν σε σχόλια (comment out) για να μην κρασάρει ο server.
// router.post('/payments/create-sumup-checkout', paymentController.createCheckout);
// router.post('/payments/verify-and-apply', paymentController.verifyAndApply);
// router.post('/payments/apply-boost', paymentController.applyBoost);

// Notifications (Web Push)
router.get('/notifications/vapidPublicKey', notificationController.getVapidKey);
router.post('/notifications/subscribe', notificationController.subscribe);
router.get('/notifications/stats', notificationController.getStats);
router.post('/notifications/send', notificationController.sendNotification);

// Analytics & Metadata
router.get('/broadcaster/:userId/analytics', analyticsController.getBroadcasterAnalytics);
// The original metadata extractor performs arbitrary upstream fetches.
// Keep the staging response deterministic until that endpoint gets the
// same approved-station SSRF protection as the stream proxy.
router.get('/metadata', process.env.APP_ENV === 'staging'
  ? require('../utils/stageMetadata').stageMetadata
  : miscController.getMetadata);

module.exports = router;
