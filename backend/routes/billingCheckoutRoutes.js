'use strict';
const express=require('express');
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const controller=require('../controllers/gatewayBillingController');
const router=express.Router();
// Apply the environment gate ONLY to the routes owned by this router.
// This module is mounted at /api; an unscoped router.use would block login,
// radio APIs, and unrelated endpoints outside staging.
const stageBillingOnly=(req,res,next)=>{
 res.set('Cache-Control','private, no-store');
 if(process.env.APP_ENV!=='staging')return res.status(404).json({error:'Not found'});
 next();
};
router.use('/billing',stageBillingOnly);
router.use('/admin/billing/sandbox-orders',stageBillingOnly);
router.post('/billing/checkout',protect,controller.checkout);
router.get('/billing/me/orders',protect,controller.listOwnOrders);
router.get('/billing/me/renewal-notice',protect,controller.renewalNotice);
router.get('/billing/me/winback',protect,controller.winbackStatus);
router.get('/billing/me/recurring-status',protect,controller.recurringStatus);
router.get('/billing/me/overview',protect,controller.billingOverview);
router.post('/billing/me/recurring/cancel',protect,controller.cancelAutomaticRenewal);
router.get('/billing/me/payment-method',protect,controller.savedCardStatus);
router.post('/billing/me/payment-method/revoke',protect,controller.revokeSavedCard);
router.post('/billing/me/renewal-notice/snooze',protect,controller.snoozeRenewalNotice);
router.get('/admin/billing/sandbox-orders',protect,authorizeRoles('admin'),controller.listAdminOrders);
router.get('/billing/orders/:id',protect,controller.readOrder);
module.exports=router;
