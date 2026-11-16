'use strict';
const router=require('express').Router();
const {protect}=require('../utils/authMiddleware');
const qa=require('../controllers/productionQaController');
// No broad router.use: only these exact staging listener endpoints are opened.
router.get('/billing/production-qa/availability',protect,qa.availability);
router.post('/billing/production-qa/checkout',protect,qa.checkout);
router.get('/billing/production-qa/status',protect,qa.status);
module.exports=router;
