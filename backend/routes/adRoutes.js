const express = require('express');
const router = express.Router();
const adController = require('../controllers/adController');
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const admin=[protect,authorizeRoles('admin')];

router.get('/ads/public', adController.getPublicAds);
router.post('/ads/:id/impression', adController.logImpression);
router.post('/ads/:id/click', adController.logClick);

router.get('/admin/ads', ...admin, adController.getAdminAds);
router.get('/admin/local-ads', ...admin, adController.getAdminLocalAds);
router.post('/admin/ads', ...admin, adController.createAdminAd);
router.put('/admin/ads/:id', ...admin, adController.updateAd);
router.post('/admin/ads/:id/clone-stage', ...admin, adController.cloneStageAd);
router.delete('/admin/ads/:id', ...admin, adController.deleteAd);

router.get('/broadcaster/:userId/ads',protect,(req,res,next)=>{
  if(req.user.role==='admin'||String(req.user._id)===req.params.userId)return next();
  return res.status(403).json({error:'Forbidden'});
},adController.getBroadcasterAds);
router.post('/broadcaster/ads',protect,authorizeRoles('broadcaster'),adController.createBroadcasterAd);
router.put('/broadcaster/ads/:id',protect,authorizeRoles('broadcaster'),adController.updateBroadcasterAd); 
router.delete('/broadcaster/ads/:id',protect,authorizeRoles('broadcaster'),adController.deleteBroadcasterAd);

module.exports = router;
