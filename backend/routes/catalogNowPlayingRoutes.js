'use strict';
const router=require('express').Router();
const {publicCatalogNowPlaying}=require('../controllers/catalogNowPlayingController');
router.get('/catalog/now-playing',publicCatalogNowPlaying);
module.exports=router;
