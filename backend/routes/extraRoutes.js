const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notificationController');
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const analyticsController = require('../controllers/analyticsController');
const miscController = require('../controllers/miscController');

// Notifications (Web Push)
router.get('/notifications/vapidPublicKey', notificationController.getVapidKey);
router.get('/notifications/unsubscribe', notificationController.unsubscribePage);
router.post('/notifications/unsubscribe', express.urlencoded({extended:false}), notificationController.unsubscribeSubmit);
// Legacy anonymous device subscriptions remain supported for guests. They may
// not claim arbitrary user IDs; authenticated profile devices use my-device.
router.post('/notifications/subscribe', notificationController.subscribe);
router.put('/notifications/my-device', protect, notificationController.registerMyDevice);
router.post('/notifications/my-device/status', protect, notificationController.checkMyDevice);
router.delete('/notifications/my-device', protect, notificationController.removeMyDevice);
router.get('/notifications/stats', protect, authorizeRoles('admin'), notificationController.getStats);
router.post('/notifications/send', protect, authorizeRoles('admin'), notificationController.sendNotification);

// Analytics & Metadata
router.get('/broadcaster/:userId/analytics',protect,authorizeRoles('admin','broadcaster'),analyticsController.getBroadcasterAnalytics);
// The original metadata extractor performs arbitrary upstream fetches.
// Keep the staging response deterministic until that endpoint gets the
// same approved-station SSRF protection as the stream proxy.
if(process.env.APP_ENV==='staging'){
  router.get('/metadata/live',require('../utils/stageSmartTracks').stageLiveAI);
}
router.get('/metadata', process.env.APP_ENV === 'staging'
  ? require('../utils/stageMetadata').stageMetadata
  : miscController.getMetadata);

module.exports = router;
