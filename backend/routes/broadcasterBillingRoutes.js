'use strict';
const express=require('express');
const {protect}=require('../utils/authMiddleware');
const controller=require('../controllers/broadcasterBillingController');
const router=express.Router();
// Scope authentication to Broadcaster billing only. This router is mounted at
// /api, so a global router.use(protect) would reject /api/auth/login,
// /api/auth/register and other unrelated public API routes before their handlers.
router.use('/billing/broadcaster',protect,controller.requiresBroadcaster);
router.post('/billing/broadcaster/checkout',controller.checkout);
router.get('/billing/broadcaster/orders',controller.listOrders);
router.get('/billing/broadcaster/orders/:id',controller.readOrder);
router.get('/billing/broadcaster/recurring',controller.recurringStatus);
router.post('/billing/broadcaster/recurring/cancel',controller.cancel);
router.get('/billing/broadcaster/premium-boost',controller.premiumBoostSelection);
router.post('/billing/broadcaster/premium-boost',controller.savePremiumBoostSelection);
module.exports=router;
