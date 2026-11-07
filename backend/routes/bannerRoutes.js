const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');

// ==========================================
// 🌍 PUBLIC ROUTES (Για όλους τους χρήστες)
// ==========================================
router.get('/active', bannerController.getActiveBanners);

router.post('/:id/click', bannerController.registerClick);
router.post('/:id/impression', bannerController.registerImpression);

// ==========================================
// 👑 ADMIN ROUTES (Διαχείριση από το Panel)
// ==========================================
// ΣΗΜΕΙΩΣΗ: Αν έχεις κάποιο middleware για να ελέγχεις αν είναι Admin 
// (π.χ. authMiddleware.isAdmin), βάλτο ανάμεσα στο path και στον controller.

router.get('/admin', bannerController.getAllBanners);
router.post('/admin', bannerController.createBanner);
router.put('/admin/:id', bannerController.updateBanner);
router.delete('/admin/:id', bannerController.deleteBanner);

module.exports = router;
