'use strict';
const express=require('express');
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const controller=require('../controllers/gatewayBillingController');
const router=express.Router();
router.use((req,res,next)=>{
 res.set('Cache-Control','private, no-store');
 // Never expose staging payment history through a production backend.
 if(process.env.APP_ENV!=='staging')return res.status(404).json({error:'Not found'});
 next();
});
router.post('/billing/checkout',protect,controller.checkout);
router.get('/billing/me/orders',protect,controller.listOwnOrders);
router.get('/billing/me/renewal-notice',protect,controller.renewalNotice);
router.get('/billing/me/recurring-status',protect,controller.recurringStatus);
router.get('/billing/me/overview',protect,controller.billingOverview);
router.post('/billing/me/recurring/cancel',protect,controller.cancelAutomaticRenewal);
router.get('/billing/me/payment-method',protect,controller.savedCardStatus);
router.post('/billing/me/payment-method/revoke',protect,controller.revokeSavedCard);
router.post('/billing/me/renewal-notice/snooze',protect,controller.snoozeRenewalNotice);
router.get('/admin/billing/sandbox-orders',protect,authorizeRoles('admin'),controller.listAdminOrders);
router.get('/billing/orders/:id',protect,controller.readOrder);
module.exports=router;
