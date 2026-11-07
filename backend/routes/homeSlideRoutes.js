'use strict';
const router = require('express').Router();
const c = require('../controllers/homeSlideController');
const { protect } = require('../utils/authMiddleware');
const { authorizeRoles } = require('../utils/roleMiddleware');
router.get('/home-slides', c.publicSlides);
// Defense-in-depth in production as well as in isolated staging.
router.use('/admin/home-slides', protect, authorizeRoles('admin'));
router.get('/admin/home-slides', c.adminSlides);
router.post('/admin/home-slides', c.create);
router.put('/admin/home-slides/:id', c.update);
router.delete('/admin/home-slides/:id', c.remove);
module.exports = router;
