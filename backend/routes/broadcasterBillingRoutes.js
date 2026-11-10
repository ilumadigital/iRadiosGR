'use strict';
const express=require('express');
const {protect}=require('../utils/authMiddleware');
const controller=require('../controllers/broadcasterBillingController');
const router=express.Router();
// All endpoints (including reads) fail closed outside staging.
router.use(protect,controller.requiresBroadcaster);
router.post('/billing/broadcaster/checkout',controller.checkout);
router.get('/billing/broadcaster/orders',controller.listOrders);
router.get('/billing/broadcaster/orders/:id',controller.readOrder);
router.get('/billing/broadcaster/recurring',controller.recurringStatus);
router.post('/billing/broadcaster/recurring/cancel',controller.cancel);
module.exports=router;
