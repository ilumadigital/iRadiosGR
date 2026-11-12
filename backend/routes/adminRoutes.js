const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const admin=[protect,authorizeRoles('admin')];

router.put('/admin/users/:id/password', adminController.updateUserPassword);
router.put('/admin/users/:id/full-update', adminController.fullUpdateUser);
router.get('/admin/users', adminController.getUsers);
router.put('/admin/users/:id/role', adminController.updateUserRole);
router.delete('/admin/users/:id', adminController.deleteUser);
router.get('/admin/fix-slugs', adminController.fixSlugs);

// 🟢 ΕΓΚΡΙΣΗ ΔΙΑΦΗΜΙΣΕΩΝ (AD NETWORK)
router.put('/admin/banners/:id/approve', ...admin, adminController.approveBannerAd);
router.put('/admin/ads/:id/approve', ...admin, adminController.approveAudioAd);

// 🟢 B2B PAYMENTS & INVOICES ROUTES
router.get('/admin/transactions', adminController.getAllTransactions);
router.put('/admin/transactions/:id/invoice', adminController.updateInvoiceStatus);

// 🟢 ADMIN MAILER ROUTES
router.get('/admin/emails', adminController.getEmailHistory);
router.post('/admin/emails/send', adminController.sendCustomEmail);

// Protect analytics on all environments, not just staging's global guard.
router.get('/admin/dashboard-stats',
  require('../utils/authMiddleware').protect,
  require('../utils/roleMiddleware').authorizeRoles('admin'),
  adminController.getDashboardStats);

module.exports = router;
