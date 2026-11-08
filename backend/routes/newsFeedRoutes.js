'use strict';
const router=require('express').Router();
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const c=require('../controllers/newsFeedController');
router.get('/newsfeed',c.publicFeed);
router.get('/newsfeed/articles/:key',c.articleDetail);
router.get('/admin/newsfeed',protect,authorizeRoles('admin'),c.adminFeed);
router.put('/admin/newsfeed',protect,authorizeRoles('admin'),c.save);
router.post('/admin/newsfeed/refresh',protect,authorizeRoles('admin'),c.refresh);
router.delete('/admin/newsfeed/articles/:key',protect,authorizeRoles('admin'),c.removeArticle);
router.post('/admin/newsfeed/hidden/restore',protect,authorizeRoles('admin'),c.restoreHiddenArticles);
// Route loaded once by the backend. Schedule independently of website visitors.
// Both staging and production use the same ten-minute schedule and MongoDB cache.
require('../utils/newsFeedScheduler').start();
module.exports=router;
