'use strict';
const router=require('express').Router();
const {publicCatalogNowPlaying}=require('../controllers/catalogNowPlayingController');
router.get('/catalog/now-playing',publicCatalogNowPlaying);
router.get('/catalog/widget-native/:stationId',
  require('../controllers/catalogNowPlayingController').publicWidgetNowPlaying);
router.get('/catalog/widget-native/:stationId/playlist',
  require('../controllers/catalogNowPlayingController').publicWidgetPlaylist);
module.exports=router;
