const express = require('express');
const router = express.Router();
const adController = require('../controllers/adController');

router.get('/ads/public', adController.getPublicAds);
router.post('/ads/:id/impression', adController.logImpression);
router.post('/ads/:id/click', adController.logClick);

router.get('/admin/ads', adController.getAdminAds);
router.get('/admin/local-ads', adController.getAdminLocalAds);
router.post('/admin/ads', adController.createAdminAd);
router.put('/admin/ads/:id', adController.updateAd);
router.delete('/admin/ads/:id', adController.deleteAd);

router.get('/broadcaster/:userId/ads', adController.getBroadcasterAds);
router.post('/broadcaster/ads', adController.createBroadcasterAd);
router.put('/broadcaster/ads/:id', adController.updateAd); 
router.delete('/broadcaster/ads/:id', adController.deleteAd);

module.exports = router;
