const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/admin/clean-chat', adminController.cleanChat);
router.put('/admin/users/:id/password', adminController.updateUserPassword);
router.put('/admin/users/:id/full-update', adminController.fullUpdateUser);
router.get('/admin/users', adminController.getUsers);
router.put('/admin/users/:id/role', adminController.updateUserRole);
router.delete('/admin/users/:id', adminController.deleteUser);
router.get('/admin/fix-slugs', adminController.fixSlugs);

// 🟢 ΕΓΚΡΙΣΗ ΔΙΑΦΗΜΙΣΕΩΝ (AD NETWORK)
router.put('/admin/banners/:id/approve', adminController.approveBannerAd);
router.put('/admin/ads/:id/approve', adminController.approveAudioAd);

// 🟢 B2B PAYMENTS & INVOICES ROUTES
router.get('/admin/transactions', adminController.getAllTransactions);
router.put('/admin/transactions/:id/invoice', adminController.updateInvoiceStatus);

// 🟢 ADMIN MAILER ROUTES
router.get('/admin/emails', adminController.getEmailHistory);
router.post('/admin/emails/send', adminController.sendCustomEmail);

router.get('/admin/dashboard-stats', adminController.getDashboardStats);

module.exports = router;
