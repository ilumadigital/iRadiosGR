const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
// 🟢 ΠΡΟΣΘΗΚΗ ΤΟΥ IMPORT ΓΙΑ ΤΟ PROTECT
const { protect } = require('../utils/authMiddleware');

// Τα POST για τη δημιουργία (καλό είναι να έχουν protect, αλλά τα αφήνω όπως τα είχες αν περνάς το userId στο body)
router.post('/create-stripe-subscription', paymentController.createStripeSubscription);
router.post('/create-ad-checkout', paymentController.createAdCheckout);

// 🟢 Το endpoint της ακύρωσης (με το protect σωστά δηλωμένο)
router.post('/cancel-subscription', protect, paymentController.cancelSubscription);

module.exports = router;
