'use strict';
const router=require('express').Router();
const {protect}=require('../utils/authMiddleware');
const {authorizeRoles}=require('../utils/roleMiddleware');
const c=require('../controllers/promotedStationController');

router.get('/promoted-station',c.publicPromoted);
router.use('/admin/promoted-stations',protect,authorizeRoles('admin'));
router.get('/admin/promoted-stations',c.list);
router.put('/admin/promoted-stations',c.save);
router.delete('/admin/promoted-stations/:id',c.remove);
module.exports=router;
